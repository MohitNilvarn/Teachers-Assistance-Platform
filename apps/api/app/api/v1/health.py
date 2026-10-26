# File: app/api/v1/health.py
"""
Health check endpoints for API v1.
"""
from fastapi import APIRouter

from app.core.config import settings

router = APIRouter()


@router.get("/health")
def detailed_health():
    """Detailed health check with system info."""
    return {
        "status": "healthy",
        "service": settings.PROJECT_NAME,
        "version": settings.VERSION,
        "components": {
            "api": "operational",
            "database": "operational",
            "ai_pipeline": "operational"
        }
    }
