# File: app/api/v1/content.py
"""
Generated content retrieval and editing endpoints.
"""
from fastapi import APIRouter, HTTPException, status, Depends
from typing import Dict, Any, Optional
from datetime import datetime

from app.core.logger import get_logger
from app.core.dependencies import get_current_user, require_teacher
from app.schemas.content import (
    ContentResponse,
    ContentListResponse,
    ContentUpdateRequest,
    ContentType,
    SemanticSearchRequest,
    SearchResultItem,
    SemanticSearchResponse,
    RecentContentItem,
    RecentContentListResponse,
)
from app.models.course import Course
from app.models.lecture import Lecture
from app.models.content import GeneratedContent, ContentType as ModelContentType
from app.services.vector_store import (
    search_by_lecture,
    search_documents,
    get_lecture_embedding_count,
    get_collection_stats,
)

logger = get_logger("TAP.Content")
router = APIRouter()


# =====================
# Recent Content Endpoints
# =====================

@router.get("/recent/notes", response_model=RecentContentListResponse)
async def get_recent_notes(
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """
    Get the 6 most recently generated notes across all accessible courses.
    """
    return await _get_recent_content(ModelContentType.NOTES, current_user)


@router.get("/recent/assignments", response_model=RecentContentListResponse)
async def get_recent_assignments(
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """
    Get the 6 most recently generated assignments across all accessible courses.
    """
    return await _get_recent_content(ModelContentType.ASSIGNMENT, current_user)


@router.get("/recent/flashcards", response_model=RecentContentListResponse)
async def get_recent_flashcards(
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """
    Get the 6 most recently generated flashcards across all accessible courses.
    """
    return await _get_recent_content(ModelContentType.FLASHCARDS, current_user)


@router.get("/lectures/{lecture_id}/notes", response_model=Optional[ContentResponse])
async def get_notes(
    lecture_id: str,
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """
    Get generated notes for a lecture.
    """
    return await _get_content(lecture_id, ModelContentType.NOTES, current_user)


@router.get("/lectures/{lecture_id}/assignment", response_model=Optional[ContentResponse])
async def get_assignment(
    lecture_id: str,
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """
    Get generated assignment for a lecture.
    """
    return await _get_content(lecture_id, ModelContentType.ASSIGNMENT, current_user)


@router.get("/lectures/{lecture_id}/flashcards", response_model=Optional[ContentResponse])
async def get_flashcards(
    lecture_id: str,
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """
    Get generated flashcards for a lecture.
    """
    return await _get_content(lecture_id, ModelContentType.FLASHCARDS, current_user)


@router.get("/lectures/{lecture_id}/content", response_model=ContentListResponse)
async def get_all_content(
    lecture_id: str,
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """
    Get all generated content (notes, assignment, flashcards) for a lecture.
    """
    # Verify access
    lecture = await Lecture.get(lecture_id)
    if not lecture:
        raise HTTPException(status_code=404, detail="Lecture not found")
    
    await _verify_course_access(lecture.course_id, current_user)
    
    # Fetch all content
    notes = await GeneratedContent.find_one(
        GeneratedContent.lecture_id == lecture_id,
        GeneratedContent.content_type == ModelContentType.NOTES
    )
    
    assignment = await GeneratedContent.find_one(
        GeneratedContent.lecture_id == lecture_id,
        GeneratedContent.content_type == ModelContentType.ASSIGNMENT
    )
    
    flashcards = await GeneratedContent.find_one(
        GeneratedContent.lecture_id == lecture_id,
        GeneratedContent.content_type == ModelContentType.FLASHCARDS
    )
    
    return ContentListResponse(
        lecture_id=lecture_id,
        notes=_to_response(notes) if notes else None,
        assignment=_to_response(assignment) if assignment else None,
        flashcards=_to_response(flashcards) if flashcards else None
    )


@router.patch("/content/{content_id}", response_model=ContentResponse)
async def update_content(
    content_id: str,
    update_data: ContentUpdateRequest,
    current_user: Dict[str, Any] = Depends(require_teacher)
):
    """
    Update/edit generated content. Teachers only.
    """
    content = await GeneratedContent.get(content_id)
    
    if not content:
        raise HTTPException(status_code=404, detail="Content not found")
    
    # Verify ownership
    lecture = await Lecture.get(content.lecture_id)
    if not lecture or lecture.teacher_id != current_user["id"]:
        raise HTTPException(status_code=403, detail="Access denied")
    
    # Update content
    content.content = update_data.content
    content.is_edited = True
    content.version += 1
    content.updated_at = datetime.utcnow()
    
    await content.save()
    
    logger.info(f"Content updated: {content_id} (version {content.version})")
    
    return _to_response(content)


@router.delete("/content/{content_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_content(
    content_id: str,
    current_user: Dict[str, Any] = Depends(require_teacher)
):
    """
    Delete generated content. Teachers only.
    """
    content = await GeneratedContent.get(content_id)
    
    if not content:
        raise HTTPException(status_code=404, detail="Content not found")
    
    # Verify ownership
    lecture = await Lecture.get(content.lecture_id)
    if not lecture or lecture.teacher_id != current_user["id"]:
        raise HTTPException(status_code=403, detail="Access denied")
    
    await content.delete()
    logger.info(f"Content deleted: {content_id}")


# =====================
# Semantic Search Endpoints
# =====================

@router.post(
    "/lectures/{lecture_id}/search",
    response_model=SemanticSearchResponse,
    summary="Semantic search within a lecture",
)
async def search_lecture_content(
    lecture_id: str,
    request: SemanticSearchRequest,
    current_user: Dict[str, Any] = Depends(get_current_user),
):
    """
    Semantic vector search scoped to a **specific lecture**.

    Searches across both the lecture transcript and the teacher-provided
    materials for that lecture.  Use ``source_filter`` to narrow to one type:
    - ``lecture_transcript`` — only transcript chunks
    - ``teacher_material``  — only teacher-uploaded materials
    """
    lecture = await Lecture.get(lecture_id)
    if not lecture:
        raise HTTPException(status_code=404, detail="Lecture not found")

    await _verify_course_access(lecture.course_id, current_user)

    results = await search_by_lecture(
        lecture_id=str(lecture.id),
        query=request.query,
        n_results=request.n_results,
        source_filter=request.source_filter,
    )

    return SemanticSearchResponse(
        query=request.query,
        results=[
            SearchResultItem(
                id=r["id"],
                text=r["text"],
                score=r["score"],
                source=r.get("source"),
                lecture_id=r.get("lecture_id"),
                metadata=r.get("metadata", {}),
            )
            for r in results
        ],
        total=len(results),
    )


@router.post(
    "/courses/{course_id}/search",
    response_model=SemanticSearchResponse,
    summary="Semantic search across an entire course",
)
async def search_course_content(
    course_id: str,
    request: SemanticSearchRequest,
    current_user: Dict[str, Any] = Depends(get_current_user),
):
    """
    Perform semantic vector search across **all lectures and materials**
    within a course.
    """
    await _verify_course_access(course_id, current_user)

    results = await search_documents(
        course_id=course_id,
        query=request.query,
        n_results=request.n_results,
        source_filter=request.source_filter,
    )

    return SemanticSearchResponse(
        query=request.query,
        results=[
            SearchResultItem(
                id=r["id"],
                text=r["text"],
                score=r["score"],
                source=r.get("source"),
                lecture_id=r.get("lecture_id"),
                metadata=r.get("metadata", {}),
            )
            for r in results
        ],
        total=len(results),
    )


@router.get(
    "/lectures/{lecture_id}/embeddings/stats",
    summary="Get embedding statistics for a lecture",
)
async def get_lecture_embeddings_stats(
    lecture_id: str,
    current_user: Dict[str, Any] = Depends(get_current_user),
):
    """
    Return the number of vector embedding chunks stored for a lecture.
    """
    lecture = await Lecture.get(lecture_id)
    if not lecture:
        raise HTTPException(status_code=404, detail="Lecture not found")

    await _verify_course_access(lecture.course_id, current_user)

    count = await get_lecture_embedding_count(str(lecture.id))
    return {
        "lecture_id": str(lecture.id),
        "embedding_count": count,
    }


@router.get(
    "/courses/{course_id}/embeddings/stats",
    summary="Get embedding statistics for a course",
)
async def get_course_embeddings_stats(
    course_id: str,
    current_user: Dict[str, Any] = Depends(get_current_user),
):
    """
    Return aggregated vector embedding statistics for all lectures and
    materials in a course.
    """
    await _verify_course_access(course_id, current_user)
    stats = await get_collection_stats(course_id)
    return stats


# Helper functions

async def _get_content(
    lecture_id: str,
    content_type: ModelContentType,
    current_user: Dict[str, Any]
) -> Optional[ContentResponse]:
    """Helper to get specific content type."""
    lecture = await Lecture.get(lecture_id)
    if not lecture:
        raise HTTPException(status_code=404, detail="Lecture not found")
    
    await _verify_course_access(lecture.course_id, current_user)
    
    content = await GeneratedContent.find_one(
        GeneratedContent.lecture_id == lecture_id,
        GeneratedContent.content_type == content_type
    )
    
    if not content:
        return None
    
    return _to_response(content)


async def _verify_course_access(course_id: str, current_user: Dict[str, Any]):
    """Verify user has access to course."""
    course = await Course.get(course_id)
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")
    
    if current_user["role"] == "teacher" and course.teacher_id != current_user["id"]:
        raise HTTPException(status_code=403, detail="Access denied")
    
    if current_user["role"] == "student" and current_user["id"] not in course.enrolled_students:
        raise HTTPException(status_code=403, detail="Not enrolled in this course")


async def _get_recent_content(
    content_type: ModelContentType,
    current_user: Dict[str, Any],
    limit: int = 6
) -> RecentContentListResponse:
    """Helper to fetch recent content of a specific type for the current user."""
    user_id = current_user["id"]
    role = current_user["role"]

    # Get courses the user has access to
    if role == "teacher":
        courses = await Course.find(Course.teacher_id == user_id).to_list()
    else:
        courses = await Course.find(
            {"enrolled_students": user_id}
        ).to_list()

    if not courses:
        return RecentContentListResponse(items=[], total=0)

    course_ids = [str(c.id) for c in courses]
    course_map = {str(c.id): c.name for c in courses}

    # Fetch recent content of the given type from those courses
    content_items = await GeneratedContent.find(
        {"course_id": {"$in": course_ids}, "content_type": content_type.value},
    ).sort(-GeneratedContent.created_at).limit(limit).to_list()

    if not content_items:
        return RecentContentListResponse(items=[], total=0)

    # Gather lecture titles in batch
    lecture_ids = list({c.lecture_id for c in content_items})
    lecture_map: Dict[str, str] = {}
    for lid in lecture_ids:
        lec = await Lecture.get(lid)
        if lec:
            lecture_map[lid] = lec.title

    items = []
    for c in content_items:
        title = c.content.get("title", "")
        items.append(RecentContentItem(
            id=str(c.id),
            lecture_id=c.lecture_id,
            course_id=c.course_id,
            content_type=ContentType(c.content_type.value),
            title=title,
            lecture_title=lecture_map.get(c.lecture_id, ""),
            course_name=course_map.get(c.course_id, ""),
            content=c.content,
            created_at=c.created_at,
            updated_at=c.updated_at,
        ))

    return RecentContentListResponse(items=items, total=len(items))


def _to_response(content: GeneratedContent) -> ContentResponse:
    """Convert model to response schema."""
    return ContentResponse(
        id=str(content.id),
        lecture_id=content.lecture_id,
        course_id=content.course_id,
        content_type=ContentType(content.content_type.value),
        content=content.content,
        metadata=content.metadata,
        version=content.version,
        is_edited=content.is_edited,
        created_at=content.created_at,
        updated_at=content.updated_at
    )
