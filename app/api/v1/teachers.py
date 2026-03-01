"""
Teacher-specific endpoints: onboarding, dashboard, subject management.
"""
from fastapi import APIRouter, HTTPException, status, Depends
from typing import Dict, Any, List
from datetime import datetime

from app.core.logger import get_logger
from app.core.dependencies import require_teacher, get_current_user
from app.data.subjects import get_subject_by_code, UNIT_COUNT
from app.models.course import Course, Unit
from app.models.lecture import Lecture
from app.models.content import GeneratedContent, ContentType as ModelContentType
from app.schemas.lecture import TranscriptionStatus, GenerationStatus

logger = get_logger("TAP.Teachers")
router = APIRouter()


# ──────────────────────────────────────────────
# Onboarding — teacher selects subject
# ──────────────────────────────────────────────

@router.post("/select-subject", status_code=status.HTTP_201_CREATED, summary="Teacher selects a subject")
async def select_subject(
    payload: Dict[str, str],
    current_user: Dict[str, Any] = Depends(require_teacher),
):
    """
    Called once after signup. Creates a Course for the teacher
    with 6 units based on the selected subject code.

    Body: { "subject_code": "BE401" }
    """
    subject_code = payload.get("subject_code", "").upper()
    if not subject_code:
        raise HTTPException(status_code=400, detail="subject_code is required.")

    subject = get_subject_by_code(subject_code)
    if not subject:
        raise HTTPException(status_code=404, detail=f"Subject '{subject_code}' not found in catalog.")

    # Prevent duplicate — teacher may only own one course per subject
    existing = await Course.find_one(
        Course.teacher_id == current_user["id"],
        Course.subject_code == subject_code,
    )
    if existing:
        raise HTTPException(
            status_code=400,
            detail=f"You already have a course for {subject['name']}.",
        )

    # Build 6 units
    units = [
        Unit(number=u["number"], title=u["title"])
        for u in subject["units"]
    ]

    course = Course(
        teacher_id=current_user["id"],
        name=subject["name"],
        code=subject_code,
        description=f"{subject['name']} — auto-created from subject catalog",
        semester=str(subject["semester"]),
        year=subject["year"],
        subject_code=subject_code,
        units=units,
    )
    await course.insert()

    logger.info(f"Course created for teacher {current_user['id']}: {subject_code} ({subject['name']})")

    return {
        "message": f"Course '{subject['name']}' created with {UNIT_COUNT} units.",
        "course_id": str(course.id),
        "subject_code": subject_code,
        "units": [{"number": u.number, "title": u.title} for u in units],
    }


# ──────────────────────────────────────────────
# Dashboard — teacher's subject + units overview
# ──────────────────────────────────────────────

@router.get("/dashboard", summary="Teacher dashboard data")
async def teacher_dashboard(
    current_user: Dict[str, Any] = Depends(require_teacher),
):
    """
    Returns the teacher's course (subject), its 6 units,
    and lecture/content counts per unit.
    
    If the teacher signed up with a subject_code but hasn't created
    a course yet, auto-creates one from the subject catalog.
    """
    courses = await Course.find(Course.teacher_id == current_user["id"]).to_list()

    # Auto-create course if teacher has subject_code in profile but no course yet
    if not courses:
        subject_code = current_user.get("subject_code", "")
        if subject_code:
            subject = get_subject_by_code(subject_code)
            if subject:
                units = [
                    Unit(number=u["number"], title=u["title"])
                    for u in subject["units"]
                ]
                course = Course(
                    teacher_id=current_user["id"],
                    name=subject["name"],
                    code=subject_code,
                    description=f"{subject['name']} — auto-created from signup",
                    semester=str(subject["semester"]),
                    year=subject["year"],
                    subject_code=subject_code,
                    units=units,
                )
                await course.insert()
                logger.info(f"Auto-created course for teacher {current_user['id']}: {subject_code}")
                courses = [course]

    if not courses:
        return {
            "has_subject": False,
            "message": "No subject selected yet. Please choose your subject.",
            "courses": [],
        }

    result: List[Dict[str, Any]] = []

    for course in courses:
        # Fetch all lectures for this course
        lectures = await Lecture.find(Lecture.course_id == str(course.id)).to_list()

        # Group lectures by unit_number
        unit_data: List[Dict[str, Any]] = []
        for unit in course.units:
            unit_lectures = [l for l in lectures if l.unit_number == unit.number]

            unit_info = {
                "number": unit.number,
                "title": unit.title,
                "lecture_count": len(unit_lectures),
                "lectures": [
                    {
                        "id": str(l.id),
                        "title": l.title,
                        "transcription_status": l.transcription_status.value,
                        "generation_status": l.generation_status.value,
                        "created_at": l.created_at.isoformat(),
                    }
                    for l in unit_lectures
                ],
            }
            unit_data.append(unit_info)

        result.append({
            "course_id": str(course.id),
            "subject_code": course.subject_code or course.code,
            "name": course.name,
            "year": course.year,
            "semester": course.semester,
            "enrolled_students": len(course.enrolled_students),
            "units": unit_data,
        })

    return {
        "has_subject": True,
        "courses": result,
    }


# ──────────────────────────────────────────────
# Unit detail — lectures + content for one unit
# ──────────────────────────────────────────────

@router.get("/courses/{course_id}/units/{unit_number}", summary="Get unit details with lectures and content")
async def get_unit_detail(
    course_id: str,
    unit_number: int,
    current_user: Dict[str, Any] = Depends(get_current_user),
):
    """
    Returns all lectures and their generated content for a specific unit.
    Accessible by the owning teacher AND enrolled students.
    """
    course = await Course.get(course_id)
    if not course:
        raise HTTPException(status_code=404, detail="Course not found")

    # Access check
    if current_user["role"] == "teacher" and course.teacher_id != current_user["id"]:
        raise HTTPException(status_code=403, detail="Access denied")
    if current_user["role"] == "student" and current_user["id"] not in course.enrolled_students:
        raise HTTPException(status_code=403, detail="Not enrolled in this course")

    if unit_number < 1 or unit_number > len(course.units):
        raise HTTPException(status_code=400, detail=f"Invalid unit number. Must be 1-{len(course.units)}.")

    unit = next((u for u in course.units if u.number == unit_number), None)
    if not unit:
        raise HTTPException(status_code=404, detail="Unit not found")

    # Fetch lectures for this unit
    lectures = await Lecture.find(
        Lecture.course_id == course_id,
        Lecture.unit_number == unit_number,
    ).to_list()

    lectures_data: List[Dict[str, Any]] = []
    for lecture in lectures:
        # Fetch generated content for this lecture
        contents = await GeneratedContent.find(
            GeneratedContent.lecture_id == str(lecture.id),
        ).to_list()

        content_map = {}
        for c in contents:
            content_map[c.content_type.value] = {
                "id": str(c.id),
                "content_type": c.content_type.value,
                "created_at": c.created_at.isoformat(),
                "version": c.version,
            }

        lectures_data.append({
            "id": str(lecture.id),
            "title": lecture.title,
            "description": lecture.description,
            "audio_filename": lecture.audio_filename,
            "transcription_status": lecture.transcription_status.value,
            "generation_status": lecture.generation_status.value,
            "has_notes": "notes" in content_map,
            "has_assignment": "assignment" in content_map,
            "has_flashcards": "flashcards" in content_map,
            "content": content_map,
            "created_at": lecture.created_at.isoformat(),
        })

    return {
        "course_id": course_id,
        "subject_code": course.subject_code or course.code,
        "course_name": course.name,
        "unit_number": unit.number,
        "unit_title": unit.title,
        "lectures": lectures_data,
        "total_lectures": len(lectures_data),
    }
