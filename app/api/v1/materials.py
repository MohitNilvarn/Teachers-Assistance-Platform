# File: app/api/v1/materials.py
"""
Study material upload and management endpoints.

Materials can be uploaded either at the **course** level (general reference)
or tied to a **specific lecture**.  When a ``lecture_id`` is provided the
material's vector embeddings are stored under that lecture so that the AI
content-generation pipeline only retrieves teacher-provided context for that
particular lecture — keeping the LLM tightly grounded.
"""
import os
import uuid
from fastapi import APIRouter, HTTPException, status, Depends, UploadFile, File, Form
from typing import Dict, Any, List, Optional
from datetime import datetime

from app.core.config import settings
from app.core.logger import get_logger
from app.core.dependencies import require_teacher, get_current_user
from app.schemas.material import (
    MaterialUploadResponse,
    MaterialResponse,
    MaterialListResponse,
    MaterialType,
    ProcessingStatus,
)
from app.models.course import Course
from app.models.lecture import Lecture
from app.models.material import (
    Material,
    MaterialType as ModelMaterialType,
    ProcessingStatus as ModelProcessingStatus,
)
from app.services.document_processor import process_document
from app.services.vector_store import add_documents, delete_documents

logger = get_logger("TAP.Materials")
router = APIRouter()

# Allowed file extensions
ALLOWED_EXTENSIONS = {"pdf", "docx", "pptx", "txt", "md"}


def _get_file_extension(filename: str) -> str:
    """Extract file extension from filename."""
    return filename.rsplit(".", 1)[-1].lower() if "." in filename else ""


# ---------------------------------------------------------------------------
# Upload – supports both course-level and lecture-level materials
# ---------------------------------------------------------------------------

@router.post(
    "/lectures/{lecture_id}/materials",
    response_model=MaterialUploadResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Upload material for a specific lecture",
)
async def upload_material_for_lecture(
    lecture_id: str,
    file: UploadFile = File(...),
    current_user: Dict[str, Any] = Depends(require_teacher),
):
    """
    Upload study material tied to a **specific lecture**.

    The file is processed, chunked, embedded and indexed under the given
    lecture so that:
    - AI content generation only uses this material when generating notes /
      assignments / flashcards for *this* lecture.
    - Students searching within the lecture will find these material chunks.
    """
    lecture = await Lecture.get(lecture_id)
    if not lecture:
        raise HTTPException(status_code=404, detail="Lecture not found")

    course = await Course.get(lecture.course_id)
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")
    if course.teacher_id != current_user["id"]:
        raise HTTPException(status_code=403, detail="Access denied")

    return await _process_and_save_material(
        file=file,
        course_id=lecture.course_id,
        lecture_id=str(lecture.id),
        teacher_id=current_user["id"],
    )


@router.post(
    "/{course_id}/materials",
    response_model=MaterialUploadResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Upload material at the course level (optionally linked to a lecture)",
)
async def upload_material(
    course_id: str,
    file: UploadFile = File(...),
    lecture_id: Optional[str] = Form(None),
    current_user: Dict[str, Any] = Depends(require_teacher),
):
    """
    Upload study material to a course.

    If ``lecture_id`` is provided the material is **linked to that lecture**
    and its vector embeddings are scoped accordingly.  Otherwise it is stored
    as general course-level reference material.
    """
    course = await Course.get(course_id)
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")
    if course.teacher_id != current_user["id"]:
        raise HTTPException(status_code=403, detail="Access denied")

    # Validate the lecture belongs to this course when provided
    resolved_lecture_id: Optional[str] = None
    if lecture_id:
        lecture = await Lecture.get(lecture_id)
        if not lecture:
            raise HTTPException(status_code=404, detail="Lecture not found")
        if lecture.course_id != course_id:
            raise HTTPException(
                status_code=400,
                detail="Lecture does not belong to this course",
            )
        resolved_lecture_id = str(lecture.id)

    return await _process_and_save_material(
        file=file,
        course_id=course_id,
        lecture_id=resolved_lecture_id,
        teacher_id=current_user["id"],
    )


# ---------------------------------------------------------------------------
# List / Get / Delete
# ---------------------------------------------------------------------------

@router.get(
    "/lectures/{lecture_id}/materials",
    response_model=MaterialListResponse,
    summary="List materials for a specific lecture",
)
async def list_lecture_materials(
    lecture_id: str,
    current_user: Dict[str, Any] = Depends(get_current_user),
):
    """
    List all materials the teacher uploaded for a specific lecture.
    """
    lecture = await Lecture.get(lecture_id)
    if not lecture:
        raise HTTPException(status_code=404, detail="Lecture not found")

    await _verify_course_access(lecture.course_id, current_user)

    materials = await Material.find(
        Material.lecture_id == str(lecture.id)
    ).to_list()

    return MaterialListResponse(
        materials=[_to_response(m, truncate_content=True) for m in materials],
        total=len(materials),
    )


@router.get(
    "/{course_id}/materials",
    response_model=MaterialListResponse,
    summary="List all materials for a course",
)
async def list_materials(
    course_id: str,
    current_user: Dict[str, Any] = Depends(get_current_user),
):
    """
    List all materials for a course (both lecture-specific and course-level).
    """
    await _verify_course_access(course_id, current_user)

    materials = await Material.find(Material.course_id == course_id).to_list()

    return MaterialListResponse(
        materials=[_to_response(m, truncate_content=True) for m in materials],
        total=len(materials),
    )


@router.get(
    "/materials/{material_id}",
    response_model=MaterialResponse,
    summary="Get a specific material",
)
async def get_material(
    material_id: str,
    current_user: Dict[str, Any] = Depends(get_current_user),
):
    """Get a specific material by ID."""
    material = await Material.get(material_id)
    if not material:
        raise HTTPException(status_code=404, detail="Material not found")

    await _verify_course_access(material.course_id, current_user)

    return _to_response(material)


@router.delete(
    "/materials/{material_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete a material",
)
async def delete_material(
    material_id: str,
    current_user: Dict[str, Any] = Depends(require_teacher),
):
    """Delete a material and its vector embeddings. Teachers only."""
    material = await Material.get(material_id)
    if not material:
        raise HTTPException(status_code=404, detail="Material not found")
    if material.teacher_id != current_user["id"]:
        raise HTTPException(
            status_code=403, detail="You can only delete your own materials"
        )

    # Remove physical file
    if material.file_path and os.path.exists(material.file_path):
        os.remove(material.file_path)

    # Remove vector embeddings
    if material.embedding_ids:
        await delete_documents(material.course_id, material.embedding_ids)

    await material.delete()
    logger.info(f"Material deleted: {material_id}")


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

async def _process_and_save_material(
    *,
    file: UploadFile,
    course_id: str,
    lecture_id: Optional[str],
    teacher_id: str,
) -> MaterialUploadResponse:
    """
    Shared logic for saving, processing, embedding, and indexing a material.

    When ``lecture_id`` is not None the embeddings are stored with that
    lecture_id so that vector search scoped to the lecture will find them.
    When ``lecture_id`` is None a synthetic ``course_material_{id}`` value
    is used to keep course-level material retrievable separately.
    """
    ext = _get_file_extension(file.filename)
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=400,
            detail=f"File type not allowed. Allowed: {', '.join(ALLOWED_EXTENSIONS)}",
        )

    # ---- Save file to disk ------------------------------------------------
    os.makedirs(settings.UPLOAD_DIR, exist_ok=True)
    file_id = str(uuid.uuid4())
    file_path = os.path.join(settings.UPLOAD_DIR, f"{file_id}.{ext}")

    try:
        raw_content = await file.read()
        file_size = len(raw_content)

        max_size = settings.MAX_UPLOAD_SIZE_MB * 1024 * 1024
        if file_size > max_size:
            raise HTTPException(
                status_code=400,
                detail=f"File too large. Max size: {settings.MAX_UPLOAD_SIZE_MB}MB",
            )

        with open(file_path, "wb") as f:
            f.write(raw_content)

        logger.info(f"Saved file: {file_path}")
    except HTTPException:
        raise
    except Exception as exc:
        logger.error(f"File save error: {exc}")
        raise HTTPException(status_code=500, detail="Failed to save file")

    # ---- Create Material document -----------------------------------------
    material = Material(
        course_id=course_id,
        teacher_id=teacher_id,
        lecture_id=lecture_id,
        filename=file.filename,
        file_type=ModelMaterialType(ext),
        file_path=file_path,
        file_size_bytes=file_size,
        processing_status=ModelProcessingStatus.PROCESSING,
    )
    await material.insert()

    # ---- Process & embed --------------------------------------------------
    try:
        logger.info(f"Processing document: {file.filename}")
        result = process_document(file_path, ext)

        material.content = result["content"]
        material.chunks = result["chunks"]
        material.metadata = result["metadata"]
        material.processing_status = ModelProcessingStatus.COMPLETED
        material.processed_at = datetime.utcnow()

        # Determine the lecture_id to use for vector scoping
        vector_lecture_id = lecture_id if lecture_id else f"course_material_{material.id}"

        if result["chunks"]:
            chunk_ids = [
                f"{material.id}_chunk_{i}" for i in range(len(result["chunks"]))
            ]
            metadatas = [
                {
                    "source": "teacher_material",
                    "material_id": str(material.id),
                    "lecture_id": lecture_id,  # None for course-level
                    "filename": file.filename,
                    "chunk_index": i,
                }
                for i in range(len(result["chunks"]))
            ]

            await add_documents(
                course_id=course_id,
                lecture_id=vector_lecture_id,
                documents=result["chunks"],
                metadatas=metadatas,
                ids=chunk_ids,
            )

            material.embedding_ids = chunk_ids
            logger.info(
                f"Indexed {len(chunk_ids)} chunks for material {material.id} "
                f"(lecture={lecture_id or 'course-level'})"
            )

        await material.save()

    except Exception as exc:
        logger.error(f"Document processing error: {exc}")
        material.processing_status = ModelProcessingStatus.FAILED
        material.processing_error = str(exc)
        await material.save()

    return MaterialUploadResponse(
        id=str(material.id),
        course_id=course_id,
        lecture_id=lecture_id,
        filename=file.filename,
        file_type=MaterialType(ext),
        processing_status=ProcessingStatus(material.processing_status.value),
        message=(
            "Material uploaded and processing complete"
            if material.processing_status == ModelProcessingStatus.COMPLETED
            else "Material uploaded, processing failed"
        ),
    )


async def _verify_course_access(course_id: str, current_user: Dict[str, Any]):
    """Verify user has access to course."""
    course = await Course.get(course_id)
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")

    if current_user["role"] == "teacher" and course.teacher_id != current_user["id"]:
        raise HTTPException(status_code=403, detail="Access denied")

    if (
        current_user["role"] == "student"
        and current_user["id"] not in course.enrolled_students
    ):
        raise HTTPException(status_code=403, detail="Not enrolled in this course")


def _to_response(
    m: Material, *, truncate_content: bool = False
) -> MaterialResponse:
    """Convert Material document to response schema."""
    return MaterialResponse(
        id=str(m.id),
        course_id=m.course_id,
        teacher_id=m.teacher_id,
        lecture_id=m.lecture_id,
        filename=m.filename,
        file_type=MaterialType(m.file_type.value),
        file_size_bytes=m.file_size_bytes,
        content=m.content[:500] if (truncate_content and m.content) else m.content,
        metadata=m.metadata,
        processing_status=ProcessingStatus(m.processing_status.value),
        processing_error=m.processing_error,
        created_at=m.created_at,
        processed_at=m.processed_at,
    )
