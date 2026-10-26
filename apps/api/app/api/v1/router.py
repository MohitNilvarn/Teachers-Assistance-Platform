# File: app/api/v1/router.py
"""
Aggregates all v1 endpoint routers into a single APIRouter.

main.py mounts this under settings.API_V1_PREFIX. Registration order is
significant: routers sharing the bare prefix (materials, lectures, content,
realtime, chat) declare overlapping path patterns, so keep new routers
appended rather than inserted.
"""
from fastapi import APIRouter

from app.api.v1 import (
    auth,
    chat,
    content,
    courses,
    health,
    lectures,
    materials,
    realtime,
    subjects,
    teachers,
    users,
)

api_router = APIRouter()

api_router.include_router(auth.router, prefix="/auth", tags=["Authentication"])
api_router.include_router(courses.router, prefix="/courses", tags=["Courses"])
api_router.include_router(materials.router, tags=["Materials"])
api_router.include_router(lectures.router, tags=["Lectures"])
api_router.include_router(content.router, tags=["Content"])
api_router.include_router(users.router, prefix="/users", tags=["Users"])
api_router.include_router(realtime.router, tags=["Real-time Transcription"])
api_router.include_router(subjects.router, prefix="/subjects", tags=["Subjects"])
api_router.include_router(teachers.router, prefix="/teachers", tags=["Teachers"])
api_router.include_router(chat.router, tags=["Chat"])
api_router.include_router(health.router, tags=["Health"])
