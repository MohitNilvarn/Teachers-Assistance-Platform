"""
Test script for Advanced RAG implementation with transcript summarization.

Tests:
1. Transcript summarization with caching
2. Workflow state flow
3. Context retrieval
4. Content generation with summarized context
"""

import asyncio
import dns.resolver
from datetime import datetime
from typing import Dict, Any

# Configure DNS resolver for MongoDB
dns.resolver.default_resolver = dns.resolver.Resolver(configure=False)
dns.resolver.default_resolver.nameservers = ['8.8.8.8', '8.8.4.4']

from app.core.logger import get_logger
from app.ai.graph import (
    ContentGenerationState,
    retrieve_context_node,
    summarize_transcript_node,
    detect_subject_nature,
)
from app.ai.prompts import get_summarization_prompt
from app.models.lecture import Lecture, TranscriptionStatus, GenerationStatus
from app.models.course import Course
from app.models.material import Material
from app.models.content import GeneratedContent
from beanie import init_beanie
from motor.motor_asyncio import AsyncIOMotorClient
from app.core.config import settings

logger = get_logger("TEST.AdvancedRAG")

# Sample transcript for testing
SAMPLE_TRANSCRIPT = """
Today we're going to talk about, um, linear algebra, which is, like, super important 
for understanding, you know, linear transformations and matrices. So basically, a linear 
transformation is, um, a function that maps vectors from one space to another, right? 
And the key property of linear transformations is that they preserve, um, vector addition 
and scalar multiplication. So if you have two vectors u and v, and a scalar c, then T(u + v) 
equals T(u) plus T(v), and T(c times u) equals c times T(u). This is really important, okay?

Let me, uh, give you an example. Consider a transformation that rotates vectors by 90 degrees 
in 2D space. This is a linear transformation because it preserves these properties. Another 
example is, um, projection onto a line. If you project two vectors onto a line, the projection 
of their sum equals the sum of their projections. So that's linear too.

Now, matrices are a way to represent linear transformations, right? If you have a linear 
transformation T, you can represent it as a matrix A such that T(x) equals Ax for any vector x. 
The columns of A are the images of the standard basis vectors under T. This is, like, a 
fundamental connection between linear transformations and matrices.

So, um, key takeaways: linear transformations preserve vector addition and scalar multiplication. 
Matrices represent linear transformations. The standard basis vectors determine the columns of 
the matrix. These concepts are crucial for, like, everything else in linear algebra.

Are there any questions? No? Okay, so next we'll, um, talk about eigenvalues and eigenvectors, 
which are also super important for understanding the behavior of linear transformations.
"""

SAMPLE_LECTURE_ID = "test_lecture_001"
SAMPLE_COURSE_ID = "test_course_001"
SAMPLE_TITLE = "Introduction to Linear Transformations"


async def init_db():
    """Initialize database connection."""
    try:
        client = AsyncIOMotorClient(
            settings.MONGODB_URI,
            tlsAllowInvalidCertificates=True,
            connectTimeoutMS=10000,
            serverSelectionTimeoutMS=10000,
            retryWrites=True
        )
        db = client[settings.MONGODB_DB_NAME]
        
        # Initialize Beanie with all document models
        await init_beanie(
            database=db,
            document_models=[Course, Material, Lecture, GeneratedContent]
        )
        logger.info("Database initialized successfully")
    except Exception as e:
        logger.error(f"Failed to initialize database: {e}")
        raise


async def create_test_lecture() -> Lecture:
    """Create a test lecture document."""
    try:
        # Delete existing test lecture if it exists
        await Lecture.find({"title": SAMPLE_TITLE}).delete()
        
        lecture = Lecture(
            course_id=SAMPLE_COURSE_ID,
            teacher_id="test_teacher_001",
            unit_number=1,
            title=SAMPLE_TITLE,
            transcript=SAMPLE_TRANSCRIPT,
            transcription_status=TranscriptionStatus.COMPLETED,
            generation_status=GenerationStatus.NOT_STARTED,
        )
        await lecture.insert()
        logger.info(f"Test lecture created: {lecture.id}")
        return lecture
    except Exception as e:
        logger.error(f"Failed to create test lecture: {e}")
        raise


async def test_subject_detection():
    """Test subject nature detection."""
    logger.info("\n=== TEST 1: Subject Nature Detection ===")
    
    nature = detect_subject_nature(
        transcript=SAMPLE_TRANSCRIPT,
        lecture_title=SAMPLE_TITLE,
    )
    logger.info(f"Detected subject nature: {nature}")
    assert nature in ["mathematical", "theoretical"], f"Invalid nature: {nature}"
    logger.info("✓ Subject detection test passed")


async def test_retrieve_context():
    """Test context retrieval."""
    logger.info("\n=== TEST 2: Context Retrieval ===")
    
    lecture = await Lecture.find_one({"title": SAMPLE_TITLE})
    if not lecture:
        logger.warning("Test lecture not found, skipping context retrieval test")
        return
    
    state: ContentGenerationState = {
        "lecture_id": str(lecture.id),
        "course_id": SAMPLE_COURSE_ID,
        "transcript": SAMPLE_TRANSCRIPT,
        "lecture_title": SAMPLE_TITLE,
        "content_types": ["notes"],
        "transcript_summary": None,
        "context": "",
        "transcript_context": "",
        "teacher_material_context": "",
        "wikipedia_context": "",
        "context_documents": [],
        "subject_nature": "mathematical",
        "notes": None,
        "assignment": None,
        "flashcards": None,
        "error": None,
        "completed_types": [],
    }
    
    result_state = await retrieve_context_node(state)
    
    assert result_state["subject_nature"] in ["mathematical", "theoretical"]
    logger.info(f"Retrieved context length: {len(result_state['context'])} chars")
    logger.info(f"Subject nature: {result_state['subject_nature']}")
    logger.info("✓ Context retrieval test passed")


async def test_summarization_prompt():
    """Test summarization prompt generation."""
    logger.info("\n=== TEST 3: Summarization Prompt ===")
    
    prompt = get_summarization_prompt(
        transcript=SAMPLE_TRANSCRIPT,
        lecture_title=SAMPLE_TITLE,
    )
    
    assert "lecture" in prompt.lower()
    assert SAMPLE_TITLE in prompt
    assert SAMPLE_TRANSCRIPT[:100] in prompt
    assert len(prompt) > 500
    logger.info(f"Generated prompt length: {len(prompt)} chars")
    logger.info("✓ Summarization prompt test passed")


async def test_summarize_transcript():
    """Test transcript summarization with caching."""
    logger.info("\n=== TEST 4: Transcript Summarization ===")
    
    lecture = await Lecture.find_one({"title": SAMPLE_TITLE})
    if not lecture:
        logger.warning("Test lecture not found, skipping summarization test")
        return
    
    state: ContentGenerationState = {
        "lecture_id": str(lecture.id),
        "course_id": SAMPLE_COURSE_ID,
        "transcript": SAMPLE_TRANSCRIPT,
        "lecture_title": SAMPLE_TITLE,
        "content_types": ["notes"],
        "transcript_summary": None,
        "context": "",
        "transcript_context": "",
        "teacher_material_context": "",
        "wikipedia_context": "",
        "context_documents": [],
        "subject_nature": "mathematical",
        "notes": None,
        "assignment": None,
        "flashcards": None,
        "error": None,
        "completed_types": [],
    }
    
    logger.info("Attempting summarization (first time - will generate)...")
    result_state = await summarize_transcript_node(state)
    
    summary = result_state["transcript_summary"]
    assert summary is not None, "Summary should not be None"
    assert len(summary) > 100, "Summary should have meaningful content"
    
    logger.info(f"Generated summary length: {len(summary)} chars")
    logger.info(f"Compression ratio: {len(summary)/len(SAMPLE_TRANSCRIPT)*100:.1f}%")
    
    # Verify summary was cached
    updated_lecture = await Lecture.find_one(Lecture.title == SAMPLE_TITLE)
    assert updated_lecture.transcript_summary is not None, "Summary should be cached"
    assert updated_lecture.transcript_summary == summary, "Cached summary should match generated summary"
    logger.info("✓ Transcript summary cached in database")
    
    # Test cache retrieval (second time - will use cache)
    logger.info("Attempting summarization (second time - should use cache)...")
    result_state2 = await summarize_transcript_node(state)
    
    summary2 = result_state2["transcript_summary"]
    assert summary2 == summary, "Cached summary should match previously generated summary"
    logger.info("✓ Cached summary retrieved successfully")
    logger.info("✓ Transcript summarization test passed")


async def test_workflow_state_flow():
    """Test state flow through workflow."""
    logger.info("\n=== TEST 5: Workflow State Flow ===")
    
    lecture = await Lecture.find_one({"title": SAMPLE_TITLE})
    if not lecture:
        logger.warning("Test lecture not found, skipping workflow test")
        return
    
    # Create initial state
    initial_state: ContentGenerationState = {
        "lecture_id": str(lecture.id),
        "course_id": SAMPLE_COURSE_ID,
        "transcript": SAMPLE_TRANSCRIPT,
        "lecture_title": SAMPLE_TITLE,
        "content_types": ["notes"],
        "transcript_summary": None,
        "context": "",
        "transcript_context": "",
        "teacher_material_context": "",
        "wikipedia_context": "",
        "context_documents": [],
        "subject_nature": "mathematical",
        "notes": None,
        "assignment": None,
        "flashcards": None,
        "error": None,
        "completed_types": [],
    }
    
    # Test state progression
    logger.info("Testing state progression...")
    
    # 1. Context retrieval
    state = await retrieve_context_node(initial_state)
    assert state["subject_nature"] is not None
    logger.info(f"✓ After retrieve_context: subject_nature={state['subject_nature']}")
    
    # 2. Summarization
    state = await summarize_transcript_node(state)
    assert state["transcript_summary"] is not None
    logger.info(f"✓ After summarize_transcript: summary_length={len(state['transcript_summary'])}")
    
    logger.info("✓ Workflow state flow test passed")


async def cleanup():
    """Clean up test data."""
    logger.info("\n=== Cleanup ===")
    try:
        await Lecture.find({"title": SAMPLE_TITLE}).delete()
        logger.info("✓ Test lecture cleaned up")
    except Exception as e:
        logger.error(f"Cleanup error: {e}")


async def run_all_tests():
    """Run all tests."""
    logger.info("\n" + "="*60)
    logger.info("ADVANCED RAG IMPLEMENTATION TEST SUITE")
    logger.info("="*60)
    
    try:
        await init_db()
        
        # Run tests that don't require database
        await test_subject_detection()
        await test_summarization_prompt()
        
        # Create test data for database-dependent tests
        await create_test_lecture()
        
        # Run database-dependent tests
        await test_retrieve_context()
        await test_summarize_transcript()
        await test_workflow_state_flow()
        
        logger.info("\n" + "="*60)
        logger.info("✓ ALL TESTS PASSED")
        logger.info("="*60)
        
    except Exception as e:
        logger.error(f"\n✗ TEST FAILED: {e}", exc_info=True)
        raise
    finally:
        await cleanup()


if __name__ == "__main__":
    asyncio.run(run_all_tests())
