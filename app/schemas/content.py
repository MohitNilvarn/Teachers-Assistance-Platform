# File: app/schemas/content.py
"""
Pydantic schemas for Generated Content API operations.
"""
from datetime import datetime
from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field
from enum import Enum


class ContentType(str, Enum):
    NOTES = "notes"
    ASSIGNMENT = "assignment"
    FLASHCARDS = "flashcards"


# =====================
# Notes Schema
# =====================
class NoteSection(BaseModel):
    """A section within lecture notes."""
    heading: str
    content: str
    key_points: List[str] = []


class NotesContent(BaseModel):
    """Structured notes content."""
    title: str
    summary: str
    sections: List[NoteSection]
    key_takeaways: List[str] = []


# =====================
# Assignment Schema
# =====================
class MCQQuestion(BaseModel):
    """Multiple choice question."""
    type: str = "mcq"
    question: str
    options: List[str]
    correct_answer: str
    explanation: Optional[str] = None


class ShortAnswerQuestion(BaseModel):
    """Short answer question."""
    type: str = "short_answer"
    question: str
    expected_answer: str
    keywords: List[str] = []


class LongAnswerQuestion(BaseModel):
    """Long answer/essay question."""
    type: str = "long_answer"
    question: str
    rubric: Optional[str] = None
    points: Optional[int] = None


class AssignmentContent(BaseModel):
    """Structured assignment content."""
    title: str
    description: Optional[str] = None
    total_points: Optional[int] = None
    questions: List[Dict[str, Any]]  # Can be MCQ, short, or long answer


# =====================
# Flashcard Schema
# =====================
class Flashcard(BaseModel):
    """A single flashcard."""
    front: str = Field(..., description="Question or term")
    back: str = Field(..., description="Answer or definition")
    difficulty: Optional[str] = Field(None, description="easy/medium/hard")


class FlashcardsContent(BaseModel):
    """Structured flashcards content."""
    title: str
    description: Optional[str] = None
    cards: List[Flashcard]


# =====================
# API Response Schemas
# =====================
class ContentResponse(BaseModel):
    """Response for generated content."""
    id: str
    lecture_id: str
    course_id: str
    content_type: ContentType
    content: Dict[str, Any]
    metadata: Dict[str, Any] = {}
    version: int
    is_edited: bool
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class ContentListResponse(BaseModel):
    """List of content for a lecture."""
    lecture_id: str
    notes: Optional[ContentResponse] = None
    assignment: Optional[ContentResponse] = None
    flashcards: Optional[ContentResponse] = None


class ContentUpdateRequest(BaseModel):
    """Request to update/edit content."""
    content: Dict[str, Any] = Field(..., description="Updated content")


class GenerationStatusResponse(BaseModel):
    """Status of content generation."""
    lecture_id: str
    status: str
    notes_generated: bool = False
    assignment_generated: bool = False
    flashcards_generated: bool = False
    error: Optional[str] = None


# =====================
# Semantic Search Schemas
# =====================
class RecentContentItem(BaseModel):
    """A single recent content item with lecture info."""
    id: str
    lecture_id: str
    course_id: str
    content_type: ContentType
    title: str = ""
    lecture_title: str = ""
    course_name: str = ""
    content: Dict[str, Any] = {}
    created_at: datetime
    updated_at: datetime


class RecentContentListResponse(BaseModel):
    """Response for recent content list."""
    items: List[RecentContentItem]
    total: int


class SemanticSearchRequest(BaseModel):
    """Request for semantic search within a lecture or course."""
    query: str = Field(..., description="Natural language search query", min_length=1, max_length=1000)
    n_results: int = Field(default=5, description="Number of results to return", ge=1, le=20)
    source_filter: Optional[str] = Field(
        None,
        description="Filter by source type: 'lecture_transcript' or 'teacher_material'"
    )

    class Config:
        json_schema_extra = {
            "example": {
                "query": "What is a binary search tree?",
                "n_results": 5,
                "source_filter": "teacher_material"
            }
        }


class SearchResultItem(BaseModel):
    """A single semantic search result."""
    id: str
    text: str
    score: float = Field(..., description="Similarity score (0-1, higher is better)")
    source: Optional[str] = None
    lecture_id: Optional[str] = None
    metadata: Dict[str, Any] = {}


class SemanticSearchResponse(BaseModel):
    """Response for semantic search."""
    query: str
    results: List[SearchResultItem]
    total: int
