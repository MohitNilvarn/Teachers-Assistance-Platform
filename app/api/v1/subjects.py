"""
Subject catalog endpoints.

Serves the predefined subject list so the frontend can populate
dropdowns during teacher onboarding.
"""
from fastapi import APIRouter, HTTPException, Query
from typing import List, Dict, Any

from app.data.subjects import get_subjects_for_year, get_subject_by_code, SUBJECTS
from app.core.logger import get_logger

logger = get_logger("TAP.Subjects")
router = APIRouter()


@router.get("", summary="List subjects for a year")
async def list_subjects(
    year: str = Query(..., description="Academic year: FE, SE, TE, or BE"),
) -> List[Dict[str, Any]]:
    """Return all predefined subjects for the given academic year."""
    year_upper = year.upper()
    if year_upper not in SUBJECTS:
        raise HTTPException(status_code=400, detail=f"Invalid year '{year}'. Must be FE, SE, TE, or BE.")

    subjects = get_subjects_for_year(year_upper)
    logger.info(f"Returned {len(subjects)} subjects for year={year_upper}")
    return subjects


@router.get("/{code}", summary="Get a single subject by code")
async def get_subject(code: str) -> Dict[str, Any]:
    """Look up a single subject by its course code."""
    subject = get_subject_by_code(code.upper())
    if not subject:
        raise HTTPException(status_code=404, detail=f"Subject with code '{code}' not found.")
    return subject
