# File: app/models/material.py
"""
Study Material model for MongoDB.
"""
from datetime import datetime
from typing import Optional, List, Dict, Any
from beanie import Document, Link
from pydantic import Field
from enum import Enum


class MaterialType(str, Enum):
    PDF = "pdf"
    DOCX = "docx"
    PPTX = "pptx"
    TXT = "txt"
    MD = "md"


class ProcessingStatus(str, Enum):
    PENDING = "pending"
    PROCESSING = "processing"
    COMPLETED = "completed"
    FAILED = "failed"


class Material(Document):
    """
    Represents uploaded study material (PDF, DOCX, PPTX, etc.)
    
    Materials are always associated with a specific lecture so that the
    AI content generation pipeline only uses teacher-provided context
    relevant to that lecture.  If no lecture_id is set, the material is
    treated as general course-level reference material.
    """
    course_id: str = Field(..., description="Reference to the course")
    teacher_id: str = Field(..., description="Supabase user ID of the teacher")
    lecture_id: Optional[str] = Field(
        None,
        description="Reference to the lecture this material belongs to. "
                    "When set, the material's embeddings are scoped to this lecture."
    )
    unit_number: Optional[int] = Field(
        None,
        ge=1,
        le=6,
        description="Unit number (1-6) this material belongs to. "
                    "When set, the material is available as context for all "
                    "lectures within this unit."
    )
    
    # File info
    filename: str = Field(..., description="Original filename")
    file_type: MaterialType = Field(..., description="Type of file")
    file_path: Optional[str] = Field(None, description="Path to stored file")
    file_size_bytes: Optional[int] = Field(None, description="File size in bytes")
    
    # Extracted content
    content: Optional[str] = Field(None, description="Extracted text content")
    chunks: List[str] = Field(default_factory=list, description="Text chunks for embedding")
    
    # Metadata for grounding LLM
    metadata: Dict[str, Any] = Field(
        default_factory=dict,
        description="Additional metadata (topics, keywords, etc.)"
    )
    
    # Vector store references (MongoDB vector embeddings)
    embedding_ids: List[str] = Field(
        default_factory=list,
        description="MongoDB vector embedding document IDs"
    )
    
    # Processing status
    processing_status: ProcessingStatus = Field(
        default=ProcessingStatus.PENDING,
        description="Document processing status"
    )
    processing_error: Optional[str] = Field(None, description="Error message if failed")
    
    # Timestamps
    created_at: datetime = Field(default_factory=datetime.utcnow)
    processed_at: Optional[datetime] = Field(None, description="When processing completed")
    
    class Settings:
        name = "materials"
        
    class Config:
        json_schema_extra = {
            "example": {
                "course_id": "course-uuid-123",
                "teacher_id": "user-uuid-456",
                "lecture_id": "lecture-uuid-789",
                "filename": "lecture_notes.pdf",
                "file_type": "pdf",
                "processing_status": "completed"
            }
        }
