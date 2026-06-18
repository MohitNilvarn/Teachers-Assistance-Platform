# File: app/api/v1/users.py
"""
User profile endpoints.
"""
from fastapi import APIRouter, Depends
from typing import Dict, Any

from app.core.dependencies import get_current_user
from app.core.logger import get_logger

logger = get_logger("TAP.Users")
router = APIRouter()


@router.get("/me")
async def get_current_user_profile(
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    """
    Get the current authenticated user's profile.
    """
    return {
        "id": current_user["id"],
        "email": current_user["email"],
        "role": current_user["role"],
        "first_name": current_user.get("first_name", ""),
        "last_name": current_user.get("last_name", ""),
        "year": current_user.get("year", "")
    }
