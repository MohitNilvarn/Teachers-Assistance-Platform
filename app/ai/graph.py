# File: app/ai/graph.py
"""
LangGraph workflow for content generation.

This module implements a state machine using LangGraph that:
1. Retrieves teacher-provided materials + transcript for the SPECIFIC lecture
2. Generates notes grounded in the teacher's material
3. Generates assignments grounded in the teacher's material
4. Generates flashcards grounded in the teacher's material
5. Saves all generated content to MongoDB

All context retrieval is lecture-scoped so the LLM never produces
content outside what the teacher actually covered.
"""
from typing import TypedDict, Optional, List, Dict, Any
from datetime import datetime
from langgraph.graph import StateGraph, END
from beanie import PydanticObjectId

from app.core.logger import get_logger
from app.core.config import settings
from app.services.vector_store import search_by_lecture, search_documents
from app.ai.llm import generate_json, generate_text
from app.ai.prompts import (
    get_system_prompt,
    detect_subject_nature,
    get_notes_prompt,
    get_assignment_prompt,
    get_flashcards_prompt,
    get_summarization_prompt,
)
from app.ai.wikipedia_tool import get_wikipedia_context
from app.models.content import GeneratedContent, ContentType
from app.models.lecture import Lecture, GenerationStatus

logger = get_logger("TAP.AIGraph")


# Define the state schema
class ContentGenerationState(TypedDict):
    """State for content generation workflow."""
    # Input
    lecture_id: str
    course_id: str
    transcript: str
    lecture_title: str
    content_types: List[str]  # Which types to generate
    unit_number: Optional[int]  # Unit number for KB material retrieval
    
    # Transcript summary (always generated and cached)
    transcript_summary: Optional[str]
    
    # Retrieved context
    context: str                               # combined text from teacher materials
    transcript_context: str                    # relevant transcript chunks
    teacher_material_context: str              # teacher-uploaded material chunks
    unit_kb_context: str                       # unit-level Knowledge Base chunks
    wikipedia_context: str                     # Wikipedia fact-check context
    context_documents: List[Dict[str, Any]]
    subject_nature: str                        # "mathematical" or "theoretical"
    
    # Generated content
    notes: Optional[Dict[str, Any]]
    assignment: Optional[Dict[str, Any]]
    flashcards: Optional[Dict[str, Any]]
    
    # Status
    error: Optional[str]
    completed_types: List[str]


async def retrieve_context_node(state: ContentGenerationState) -> ContentGenerationState:
    """
    Node: Retrieve teacher-provided materials for this lecture.

    This node retrieves context from:
    1. Lecture-specific teacher-uploaded materials (PDFs, docs)
    2. Unit-level Knowledge Base materials (shared across the unit)
    3. Relevant transcript chunks (via semantic search)

    No adaptive strategy selection — transcripts will be summarized separately.
    """
    logger.info(f"Retrieving lecture-scoped context for: {state['lecture_id']}")

    try:
        query = (
            state["transcript"][:500]
            if state["transcript"]
            else state["lecture_title"]
        )

        # 1. Teacher-uploaded materials for THIS lecture
        material_results = await search_by_lecture(
            lecture_id=state["lecture_id"],
            query=query,
            n_results=8,
            source_filter="teacher_material",
        )

        # 2. Unit-level Knowledge Base materials
        unit_kb_results = []
        unit_number = state.get("unit_number")
        if unit_number and state.get("course_id"):
            unit_vector_id = f"unit_{state['course_id']}_{unit_number}"
            unit_kb_results = await search_by_lecture(
                lecture_id=unit_vector_id,
                query=query,
                n_results=8,
                source_filter="teacher_material",
            )
            logger.info(
                f"Unit KB search (unit={unit_number}): {len(unit_kb_results)} results"
            )

        # 3. Transcript chunks for THIS lecture (for context, not primary source)
        transcript_results = await search_by_lecture(
            lecture_id=state["lecture_id"],
            query=query,
            n_results=5,
            source_filter="lecture_transcript",
        )

        # Build separate context strings
        material_parts = [
            r["text"] for r in material_results if r.get("text")
        ]
        unit_kb_parts = [
            r["text"] for r in unit_kb_results if r.get("text")
        ]
        transcript_parts = [
            r["text"] for r in transcript_results if r.get("text")
        ]

        teacher_material_ctx = (
            "\n\n---\n\n".join(material_parts)
            if material_parts
            else ""
        )
        unit_kb_ctx = (
            "\n\n---\n\n".join(unit_kb_parts)
            if unit_kb_parts
            else ""
        )
        transcript_ctx = (
            "\n\n---\n\n".join(transcript_parts)
            if transcript_parts
            else ""
        )

        # Combined context — teacher material first (higher priority)
        combined = []
        if teacher_material_ctx:
            combined.append(
                "=== TEACHER-PROVIDED MATERIALS (LECTURE-SPECIFIC) ===\n" + teacher_material_ctx
            )
        if unit_kb_ctx:
            combined.append(
                "=== UNIT KNOWLEDGE BASE MATERIALS ===\n" + unit_kb_ctx
            )
        if transcript_ctx:
            combined.append(
                "=== LECTURE TRANSCRIPT EXCERPTS ===\n" + transcript_ctx
            )
        context = (
            "\n\n".join(combined)
            if combined
            else "No additional context available."
        )

        all_results = material_results + unit_kb_results + transcript_results

        # Detect subject nature from transcript + title
        nature = detect_subject_nature(
            transcript=state["transcript"],
            lecture_title=state["lecture_title"],
        )
        logger.info(
            f"Context retrieval complete: {len(material_results)} lecture materials + "
            f"{len(unit_kb_results)} unit KB + "
            f"{len(transcript_results)} transcript chunks | subject_nature={nature}"
        )

        return {
            **state,
            "context": context,
            "transcript_context": transcript_ctx,
            "teacher_material_context": teacher_material_ctx,
            "unit_kb_context": unit_kb_ctx,
            "context_documents": all_results,
            "subject_nature": nature,
        }
    except Exception as e:
        logger.error(f"Context retrieval error: {str(e)}")
        fallback_nature = "theoretical"
        try:
            fallback_nature = detect_subject_nature(
                transcript=state["transcript"],
                lecture_title=state["lecture_title"],
            )
        except Exception:
            pass
        return {
            **state,
            "context": "No additional context available.",
            "transcript_context": "",
            "teacher_material_context": "",
            "unit_kb_context": "",
            "wikipedia_context": "",
            "context_documents": [],
            "subject_nature": fallback_nature,
        }


async def wikipedia_fact_check_node(state: ContentGenerationState) -> ContentGenerationState:
    """
    Node: Fetch Wikipedia context as a fallback fact-checking source.

    This runs after context retrieval. It extracts key topics from the
    lecture title and transcript, then queries Wikipedia for reference
    material. The Wikipedia text is NEVER the primary source — it is
    only used to improve factual accuracy.
    """
    logger.info(f"Running Wikipedia fact-check for: {state['lecture_title']}")

    try:
        # Extract a few key topics from the transcript (first 500 chars)
        # Use the lecture title + first sentence-like chunks
        key_topics: List[str] = []
        transcript_snippet = (state.get("transcript") or "")[:500]
        # Simple heuristic: split transcript into phrases and pick meaningful ones
        if transcript_snippet:
            # Take a few key phrases from transcription
            words = transcript_snippet.split()
            if len(words) > 5:
                # Grab the first meaningful phrase as a topic
                key_topics.append(" ".join(words[:8]))

        wiki_context = await get_wikipedia_context(
            lecture_title=state["lecture_title"],
            key_topics=key_topics if key_topics else None,
        )

        if wiki_context:
            logger.info(
                f"Wikipedia context retrieved ({len(wiki_context)} chars)"
            )
        else:
            logger.info("No Wikipedia context found (proceeding without)")

        return {
            **state,
            "wikipedia_context": wiki_context,
        }
    except Exception as e:
        logger.warning(f"Wikipedia fact-check failed (non-fatal): {e}")
        return {
            **state,
            "wikipedia_context": "",
        }


async def summarize_transcript_node(state: ContentGenerationState) -> ContentGenerationState:
    """
    Node: Summarize the entire transcript using the same LLM.
    
    Always runs (not conditional). Checks for cached summary first.
    If not cached, generates summary using Groq LLM and stores in database.
    
    This ensures all content generation uses the same high-quality summary
    instead of truncated transcripts.
    """
    logger.info(f"Processing transcript summary for lecture: {state['lecture_id']}")
    
    try:
        # Fetch the lecture to check for cached summary
        lecture = await Lecture.get(state["lecture_id"])
        
        if lecture and lecture.transcript_summary:
            logger.info(f"Using cached transcript summary ({len(lecture.transcript_summary)} chars)")
            return {
                **state,
                "transcript_summary": lecture.transcript_summary,
            }
        
        # No cached summary — generate one
        logger.info(f"Generating transcript summary (transcript: {len(state['transcript'])} chars)")
        
        prompt = get_summarization_prompt(
            transcript=state["transcript"],
            lecture_title=state["lecture_title"],
        )
        
        # Use the same Groq model for summarization
        summary = await generate_text(
            prompt=prompt,
            system_prompt="You are an expert at creating clean, comprehensive lecture summaries that preserve all key concepts while removing transcription noise.",
            max_tokens=8000,
            temperature=0.3,  # Lower temp for faithful summarization
        )
        
        if not summary or not summary.strip():
            logger.warning("Summarization produced empty result, using original transcript")
            summary = state["transcript"]
        
        logger.info(
            f"Transcript summary generated: {len(state['transcript'])} → {len(summary)} chars "
            f"(compression ratio: {len(summary)/len(state['transcript'])*100:.1f}%)"
        )
        
        # Cache the summary in the lecture document
        if lecture:
            lecture.transcript_summary = summary
            await lecture.save()
            logger.info("Transcript summary cached in database")
        
        return {
            **state,
            "transcript_summary": summary,
        }
        
    except Exception as e:
        logger.error(f"Transcript summarization failed: {str(e)}")
        logger.warning("Falling back to original transcript (summary failed)")
        return {
            **state,
            "transcript_summary": state["transcript"],
            "error": f"Summarization failed (using original): {str(e)}",
        }


async def generate_notes_node(state: ContentGenerationState) -> ContentGenerationState:
    """
    Node: Generate lecture notes.
    
    Uses the transcript summary (generated and cached by summarize_transcript_node)
    as the primary input source, combined with teacher materials and Wikipedia context.
    """
    if "notes" not in state["content_types"]:
        logger.info("Skipping notes generation (not requested)")
        return state
    
    logger.info(f"Generating notes for lecture: {state['lecture_id']}")
    
    try:
        # Select transcript based on strategy
        transcript_to_use = state.get("transcript_summary") or state["transcript"]
        
        # Include Wikipedia context in the combined context
        context = state["context"]
        wiki_ctx = state.get("wikipedia_context", "")
        if wiki_ctx:
            context = context + "\n\n" + wiki_ctx

        sn = state.get("subject_nature", "mathematical")
        prompt = get_notes_prompt(
            transcript=transcript_to_use,
            context=context,
            lecture_title=state["lecture_title"],
            subject_nature=sn,
        )
        
        notes = await generate_json(prompt, get_system_prompt(sn))
        
        logger.info("Notes generated successfully")
        
        completed = state.get("completed_types", [])
        completed.append("notes")
        
        return {
            **state,
            "notes": notes,
            "completed_types": completed
        }
    except Exception as e:
        logger.error(f"Notes generation error: {str(e)}")
        return {
            **state,
            "error": f"Notes generation failed: {str(e)}"
        }


async def generate_assignment_node(state: ContentGenerationState) -> ContentGenerationState:
    """
    Node: Generate practice assignment.
    
    Uses the transcript summary (generated and cached by summarize_transcript_node)
    as the primary input source, combined with teacher materials and Wikipedia context.
    """
    if "assignment" not in state["content_types"]:
        logger.info("Skipping assignment generation (not requested)")
        return state
    
    logger.info(f"Generating assignment for lecture: {state['lecture_id']}")
    
    try:
        # Select transcript based on strategy
        transcript_to_use = state.get("transcript_summary") or state["transcript"]
        
        # Include Wikipedia context
        context = state["context"]
        wiki_ctx = state.get("wikipedia_context", "")
        if wiki_ctx:
            context = context + "\n\n" + wiki_ctx

        sn = state.get("subject_nature", "mathematical")
        prompt = get_assignment_prompt(
            transcript=transcript_to_use,
            context=context,
            lecture_title=state["lecture_title"],
            subject_nature=sn,
        )
        
        assignment = await generate_json(prompt, get_system_prompt(sn))
        
        logger.info("Assignment generated successfully")
        
        completed = state.get("completed_types", [])
        completed.append("assignment")
        
        return {
            **state,
            "assignment": assignment,
            "completed_types": completed
        }
    except Exception as e:
        logger.error(f"Assignment generation error: {str(e)}")
        return {
            **state,
            "error": f"Assignment generation failed: {str(e)}"
        }


async def generate_flashcards_node(state: ContentGenerationState) -> ContentGenerationState:
    """
    Node: Generate flashcards.
    
    Uses the transcript summary (generated and cached by summarize_transcript_node)
    as the primary input source, combined with teacher materials and Wikipedia context.
    """
    if "flashcards" not in state["content_types"]:
        logger.info("Skipping flashcards generation (not requested)")
        return state
    
    logger.info(f"Generating flashcards for lecture: {state['lecture_id']}")
    
    try:
        # Select transcript based on strategy
        transcript_to_use = state.get("transcript_summary") or state["transcript"]
        
        # Include Wikipedia context
        context = state["context"]
        wiki_ctx = state.get("wikipedia_context", "")
        if wiki_ctx:
            context = context + "\n\n" + wiki_ctx

        sn = state.get("subject_nature", "mathematical")
        prompt = get_flashcards_prompt(
            transcript=transcript_to_use,
            context=context,
            lecture_title=state["lecture_title"],
            subject_nature=sn,
        )
        
        flashcards = await generate_json(prompt, get_system_prompt(sn))
        
        logger.info("Flashcards generated successfully")
        
        completed = state.get("completed_types", [])
        completed.append("flashcards")
        
        return {
            **state,
            "flashcards": flashcards,
            "completed_types": completed
        }
    except Exception as e:
        logger.error(f"Flashcards generation error: {str(e)}")
        return {
            **state,
            "error": f"Flashcards generation failed: {str(e)}"
        }


async def save_content_node(state: ContentGenerationState) -> ContentGenerationState:
    """
    Node: Save generated content to MongoDB.
    """
    logger.info(f"Saving generated content for lecture: {state['lecture_id']}")
    
    try:
        saved_count = 0
        
        # Save notes
        if state.get("notes"):
            notes_doc = GeneratedContent(
                lecture_id=state["lecture_id"],
                course_id=state["course_id"],
                content_type=ContentType.NOTES,
                content=state["notes"],
                metadata={
                    "context_docs_used": len(state.get("context_documents", [])),
                    "generated_at": datetime.utcnow().isoformat()
                }
            )
            await notes_doc.insert()
            saved_count += 1
            logger.info("Notes saved to database")
        
        # Save assignment
        if state.get("assignment"):
            assignment_doc = GeneratedContent(
                lecture_id=state["lecture_id"],
                course_id=state["course_id"],
                content_type=ContentType.ASSIGNMENT,
                content=state["assignment"],
                metadata={
                    "context_docs_used": len(state.get("context_documents", [])),
                    "generated_at": datetime.utcnow().isoformat()
                }
            )
            await assignment_doc.insert()
            saved_count += 1
            logger.info("Assignment saved to database")
        
        # Save flashcards
        if state.get("flashcards"):
            flashcards_doc = GeneratedContent(
                lecture_id=state["lecture_id"],
                course_id=state["course_id"],
                content_type=ContentType.FLASHCARDS,
                content=state["flashcards"],
                metadata={
                    "context_docs_used": len(state.get("context_documents", [])),
                    "generated_at": datetime.utcnow().isoformat()
                }
            )
            await flashcards_doc.insert()
            saved_count += 1
            logger.info("Flashcards saved to database")
        
        # Update lecture status
        lecture = await Lecture.get(state["lecture_id"])
        if lecture:
            lecture.generation_status = GenerationStatus.COMPLETED
            lecture.generated_at = datetime.utcnow()
            await lecture.save()
        
        logger.info(f"Saved {saved_count} content items")
        
        return state
        
    except Exception as e:
        logger.error(f"Content save error: {str(e)}")
        return {
            **state,
            "error": f"Failed to save content: {str(e)}"
        }


def build_content_generation_graph() -> StateGraph:
    """
    Build the LangGraph workflow for content generation.
    
    Simplified workflow (always summarize first):
    1. retrieve_context → fetch teacher materials + relevant transcript chunks
    2. wikipedia_fact_check → fetch Wikipedia context for fact-checking
    3. summarize_transcript → summarize entire transcript using Groq LLM, cache result
    4. generate_notes → generate notes from summary + context
    5. generate_assignment → generate assignment from summary + context
    6. generate_flashcards → generate flashcards from summary + context
    7. save_content → save all generated content to database
    8. END
    
    All content generation uses the same cached summary (no truncation, no hallucination risk).
    """
    workflow = StateGraph(ContentGenerationState)
    
    # Add nodes
    workflow.add_node("retrieve_context", retrieve_context_node)
    workflow.add_node("wikipedia_fact_check", wikipedia_fact_check_node)
    workflow.add_node("summarize_transcript", summarize_transcript_node)
    workflow.add_node("generate_notes", generate_notes_node)
    workflow.add_node("generate_assignment", generate_assignment_node)
    workflow.add_node("generate_flashcards", generate_flashcards_node)
    workflow.add_node("save_content", save_content_node)
    
    # Define edges (simple sequential flow, always summarize)
    workflow.set_entry_point("retrieve_context")
    workflow.add_edge("retrieve_context", "wikipedia_fact_check")
    workflow.add_edge("wikipedia_fact_check", "summarize_transcript")
    workflow.add_edge("summarize_transcript", "generate_notes")
    workflow.add_edge("generate_notes", "generate_assignment")
    workflow.add_edge("generate_assignment", "generate_flashcards")
    workflow.add_edge("generate_flashcards", "save_content")
    workflow.add_edge("save_content", END)
    
    return workflow.compile()


# Compiled workflow instance
content_generation_graph = build_content_generation_graph()


async def run_content_generation(
    lecture_id: str,
    course_id: str,
    transcript: str,
    lecture_title: str,
    content_types: List[str] = None
) -> Dict[str, Any]:
    """
    Run the content generation workflow.
    
    Args:
        lecture_id: ID of the lecture
        course_id: ID of the course
        transcript: Lecture transcript text
        lecture_title: Title of the lecture
        content_types: List of content types to generate
    
    Returns:
        Final state with generated content
    """
    if content_types is None:
        content_types = ["notes", "assignment", "flashcards"]
    
    # Fetch unit_number from the lecture document
    unit_number = None
    try:
        lecture = await Lecture.get(lecture_id)
        if lecture:
            unit_number = lecture.unit_number
    except Exception:
        pass

    initial_state: ContentGenerationState = {
        "lecture_id": lecture_id,
        "course_id": course_id,
        "transcript": transcript,
        "lecture_title": lecture_title,
        "content_types": content_types,
        "unit_number": unit_number,
        "transcript_summary": None,
        "context": "",
        "transcript_context": "",
        "teacher_material_context": "",
        "unit_kb_context": "",
        "wikipedia_context": "",
        "context_documents": [],
        "subject_nature": "mathematical",
        "notes": None,
        "assignment": None,
        "flashcards": None,
        "error": None,
        "completed_types": [],
    }
    
    logger.info(f"Starting content generation workflow for lecture: {lecture_id}")
    
    # Run the workflow
    final_state = await content_generation_graph.ainvoke(initial_state)
    
    logger.info(f"Content generation complete. Types: {final_state.get('completed_types', [])}")
    
    return final_state
