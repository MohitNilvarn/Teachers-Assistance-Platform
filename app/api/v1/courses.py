# File: app/api/v1/courses.py
"""
Course management endpoints for teachers and students.
"""
from fastapi import APIRouter, HTTPException, status, Depends, Query
from typing import Dict, Any, List, Optional
from datetime import datetime
from beanie import PydanticObjectId

from app.core.logger import get_logger
from app.core.dependencies import get_current_user, require_teacher, require_student
from app.schemas.course import (
    CourseCreate,
    CourseUpdate,
    CourseResponse,
    CourseListResponse,
    EnrollRequest,
    UnitSchema,
)
from app.models.course import Course

logger = get_logger("TAP.Courses")
router = APIRouter()


# ──────────────────────────────────────────────
# Helper
# ──────────────────────────────────────────────

def _course_to_response(course: Course) -> CourseResponse:
    """Convert a Course document to a CourseResponse schema."""
    return CourseResponse(
        id=str(course.id),
        teacher_id=course.teacher_id,
        name=course.name,
        code=course.code,
        description=course.description,
        semester=course.semester,
        year=course.year,
        subject_code=course.subject_code,
        units=[UnitSchema(number=u.number, title=u.title) for u in course.units],
        syllabus_content=course.syllabus_content,
        enrolled_students=course.enrolled_students,
        created_at=course.created_at,
        updated_at=course.updated_at,
    )


# ──────────────────────────────────────────────
# CRUD
# ──────────────────────────────────────────────

@router.post("", response_model=CourseResponse, status_code=status.HTTP_201_CREATED)
async def create_course(
    course_data: CourseCreate,
    current_user: Dict[str, Any] = Depends(require_teacher),
):
    """Create a new course. Teachers only."""
    try:
        logger.info(f"Creating course: {course_data.name} by teacher {current_user['id']}")

        existing = await Course.find_one(
            Course.teacher_id == current_user["id"],
            Course.code == course_data.code,
        )
        if existing:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Course with code {course_data.code} already exists",
            )

        course = Course(
            teacher_id=current_user["id"],
            name=course_data.name,
            code=course_data.code,
            description=course_data.description,
            semester=course_data.semester,
            year=course_data.year,
            subject_code=course_data.subject_code,
            syllabus_content=course_data.syllabus_content,
        )
        await course.insert()
        logger.info(f"Course created: {course.id}")

        return _course_to_response(course)

    except HTTPException:
        raise
    except Exception as e:
        import traceback
        logger.error(f"Error creating course: {str(e)}\n{traceback.format_exc()}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error creating course: {str(e)}",
        )


@router.get("", response_model=CourseListResponse)
async def list_courses(
    current_user: Dict[str, Any] = Depends(get_current_user),
):
    """List courses. Teachers see their own; students see enrolled courses."""
    if current_user["role"] == "teacher":
        courses = await Course.find({"teacher_id": current_user["id"]}).to_list()
    else:
        courses = await Course.find({"enrolled_students": current_user["id"]}).to_list()

    return CourseListResponse(
        courses=[_course_to_response(c) for c in courses],
        total=len(courses),
    )


@router.get("/by-year", summary="List all courses for a given academic year")
async def list_courses_by_year(
    year: str = Query(..., description="Academic year: FE, SE, TE, or BE"),
    current_user: Dict[str, Any] = Depends(get_current_user),
):
    """
    Return every course whose `year` field matches.
    Students use this to discover and auto-enroll in courses for their year.
    """
    courses = await Course.find({"year": year.upper()}).to_list()
    return CourseListResponse(
        courses=[_course_to_response(c) for c in courses],
        total=len(courses),
    )


@router.get("/{course_id}", response_model=CourseResponse)
async def get_course(
    course_id: str,
    current_user: Dict[str, Any] = Depends(get_current_user),
):
    """Get a specific course by ID."""
    course = await Course.get(course_id)
    if not course:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Course not found")

    if current_user["role"] == "teacher" and course.teacher_id != current_user["id"]:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")

    if current_user["role"] == "student" and current_user["id"] not in course.enrolled_students:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="You are not enrolled in this course")

    return _course_to_response(course)


@router.put("/{course_id}", response_model=CourseResponse)
async def update_course(
    course_id: str,
    course_data: CourseUpdate,
    current_user: Dict[str, Any] = Depends(require_teacher),
):
    """Update a course. Teachers only, own courses only."""
    course = await Course.get(course_id)
    if not course:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Course not found")
    if course.teacher_id != current_user["id"]:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="You can only update your own courses")

    for field, value in course_data.model_dump(exclude_unset=True).items():
        setattr(course, field, value)

    course.updated_at = datetime.utcnow()
    await course.save()
    logger.info(f"Course updated: {course_id}")

    return _course_to_response(course)


@router.delete("/{course_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_course(
    course_id: str,
    current_user: Dict[str, Any] = Depends(require_teacher),
):
    """Delete a course. Teachers only, own courses only."""
    course = await Course.get(course_id)
    if not course:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Course not found")
    if course.teacher_id != current_user["id"]:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="You can only delete your own courses")

    await course.delete()
    logger.info(f"Course deleted: {course_id}")


# ──────────────────────────────────────────────
# Enrollment
# ──────────────────────────────────────────────

@router.post("/{course_id}/enroll", status_code=status.HTTP_200_OK)
async def enroll_student(
    course_id: str,
    enroll_data: EnrollRequest,
    current_user: Dict[str, Any] = Depends(require_teacher),
):
    """Enroll a student in a course. Teachers only."""
    course = await Course.get(course_id)
    if not course:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Course not found")
    if course.teacher_id != current_user["id"]:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="You can only manage your own courses")
    if enroll_data.student_id in course.enrolled_students:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Student already enrolled")

    course.enrolled_students.append(enroll_data.student_id)
    await course.save()
    logger.info(f"Student {enroll_data.student_id} enrolled in course {course_id}")

    return {"message": "Student enrolled successfully"}


@router.post("/enroll-by-year", status_code=status.HTTP_200_OK, summary="Auto-enroll student in all courses for their year")
async def auto_enroll_by_year(
    current_user: Dict[str, Any] = Depends(require_student),
):
    """
    Automatically enroll the current student in every course matching
    their academic year. Also auto-creates courses for any catalog
    subjects that don't have a course record yet.
    """
    from app.data.subjects import get_subjects_for_year
    from app.models.course import Unit

    year = current_user.get("year", "")
    if not year:
        raise HTTPException(status_code=400, detail="Student year not set in profile")

    year_upper = year.upper()

    # Ensure every catalog subject has a course record
    catalog_subjects = get_subjects_for_year(year_upper)
    existing_courses = await Course.find({"year": year_upper}).to_list()
    existing_codes = set()
    for c in existing_courses:
        if c.subject_code:
            existing_codes.add(c.subject_code)
        if c.code:
            existing_codes.add(c.code)

    created_count = 0
    for subj in catalog_subjects:
        if subj["code"] not in existing_codes:
            course = Course(
                teacher_id="system",
                name=subj["name"],
                code=subj["code"],
                subject_code=subj["code"],
                semester=str(subj["semester"]),
                year=year_upper,
                units=[
                    Unit(number=u["number"], title=u["title"])
                    for u in subj["units"]
                ],
            )
            await course.insert()
            created_count += 1
            logger.info(f"Auto-created course for catalog subject {subj['code']} ({subj['name']})")

    # Re-fetch all courses for the year (including newly created ones)
    courses = await Course.find({"year": year_upper}).to_list()
    enrolled_count = 0

    for course in courses:
        if current_user["id"] not in course.enrolled_students:
            course.enrolled_students.append(current_user["id"])
            await course.save()
            enrolled_count += 1

    logger.info(f"Student {current_user['id']} auto-enrolled in {enrolled_count} courses for year {year} ({created_count} new courses created)")

    return {
        "message": f"Enrolled in {enrolled_count} new courses for {year}",
        "total_courses": len(courses),
        "newly_enrolled": enrolled_count,
    }
