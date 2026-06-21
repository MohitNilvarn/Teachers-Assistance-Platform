# File: app/ai/graph.py
"""
LangGraph workflow for content generation — Advanced RAG Pipeline.

This module implements a state machine using LangGraph with a
NotebookLM-grade Retrieval-Augmented Generation pipeline:

1. Summarizes the transcript (for semantic query generation)
2. ADVANCED RETRIEVAL:
   a. Query Decomposition + HyDE (hypothetical document embeddings)
   b. Hybrid Search: dense vectors + BM25 keyword search
   c. Reciprocal Rank Fusion (RRF) to merge results
   d. Cross-encoder re-ranking for precision
   e. Parent-child chunk resolution (small-to-big)
   f. Contextual compression + deduplication
   g. Citation-level source attribution
3. External knowledge enrichment (Wikipedia + GeeksForGeeks)
4. Generates notes, assignments, flashcards — grounded in cited sources
5. Evaluates all generated content on 6 quality dimensions
6. Saves content + quality scores + retrieval metadata to MongoDB

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
from app.services.hybrid_search import (
    hybrid_search,
    advanced_search_by_lecture,
)
from app.services.query_engine import (
    generate_multi_query_embeddings,
    decompose_query,
)
from app.services.context_builder import build_context, BuiltContext
from app.services.retrieval_cache import (
    get_cached_search_results,
    cache_search_results,
    get_all_cache_stats,
)
from app.ai.llm import generate_json, generate_text
from app.ai.prompts import (
    get_system_prompt,
    detect_subject_nature,
    get_notes_prompt,
    get_assignment_prompt,
    get_flashcards_prompt,
    get_summarization_prompt,
)
from app.ai.external_knowledge import (
    fetch_external_knowledge,
    extract_key_topics,
)
from app.ai.evaluation import evaluate_content
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
    
    # Retrieved context (advanced RAG)
    context: str                               # combined text from teacher materials
    transcript_context: str                    # relevant transcript chunks
    teacher_material_context: str              # teacher-uploaded material chunks
    unit_kb_context: str                       # unit-level Knowledge Base chunks
    wikipedia_context: str                     # Wikipedia fact-check context
    geeksforgeeks_context: str                 # GeeksForGeeks reference context
    external_knowledge_context: str            # combined external knowledge (Wiki + GFG)
    verified_facts: List[Dict[str, str]]       # key facts for cross-validation
    context_documents: List[Dict[str, Any]]
    subject_nature: str                        # "mathematical" or "theoretical"
    
    # Advanced RAG metadata
    retrieval_metadata: Dict[str, Any]         # hybrid search metrics
    query_embeddings_count: int                # number of query embeddings used
    chunks_deduplicated: int                   # chunks removed by dedup
    chunks_compressed: int                     # chunks compressed
    citations: List[Dict[str, str]]            # citation_id → source mappings
    
    # Generated content
    notes: Optional[Dict[str, Any]]
    assignment: Optional[Dict[str, Any]]
    flashcards: Optional[Dict[str, Any]]
    
    # Quality evaluation scores (populated by evaluate_content node)
    notes_quality: Optional[Dict[str, Any]]
    assignment_quality: Optional[Dict[str, Any]]
    flashcards_quality: Optional[Dict[str, Any]]
    
    # Fetched diagrams (populated by fetch_diagrams_node)
    diagrams: Optional[List[Dict[str, Any]]]
    
    # Status
    error: Optional[str]
    completed_types: List[str]


async def retrieve_context_node(state: ContentGenerationState) -> ContentGenerationState:
    """
    Node: ADVANCED RETRIEVAL — NotebookLM-grade RAG pipeline.

    This node performs multi-stage retrieval:

    1. **Query Decomposition** — Breaks the transcript summary into
       focused sub-queries targeting specific concepts.
    2. **HyDE** — Generates hypothetical document embeddings for
       better semantic alignment.
    3. **Multi-Query Hybrid Search** — Searches with multiple embeddings
       across dense vectors + BM25, fused via Reciprocal Rank Fusion.
    4. **Cross-Encoder Re-ranking** — Filters and reorders results
       using a cross-encoder for precision.
    5. **Parent-Child Resolution** — Expands matched child chunks to
       their full parent sections for richer context.
    6. **Contextual Compression** — Removes irrelevant sentences from
       each chunk.
    7. **Citation Tracking** — Assigns citation IDs to every chunk for
       grounded generation.

    Uses the transcript summary (from summarize_transcript_node) as the
    primary search query.  The summary captures all key terms, definitions,
    and topics from the entire lecture.
    """
    logger.info(
        f"[Advanced RAG] Starting multi-stage retrieval for: {state['lecture_id']}"
    )

    try:
        # --- Stage 0: Prepare the search query ---
        transcript_summary = state.get("transcript_summary") or ""
        if transcript_summary:
            query = transcript_summary[:1500]
        elif state.get("transcript"):
            query = state["transcript"][:500]
        else:
            query = state["lecture_title"]

        # Detect subject nature early (needed for HyDE)
        nature = detect_subject_nature(
            transcript=state["transcript"],
            lecture_title=state["lecture_title"],
        )

        # --- Stage 1: Generate multi-query embeddings ---
        # This produces: raw query + HyDE + decomposed sub-queries
        query_embeddings = await generate_multi_query_embeddings(
            query=query,
            lecture_title=state["lecture_title"],
            subject_nature=nature,
            use_hyde=True,
            use_decomposition=True,
            max_sub_queries=4,
        )
        logger.info(
            f"[Advanced RAG] Generated {len(query_embeddings)} query embeddings "
            f"(raw + HyDE + decomposed)"
        )

        # --- Stage 2: Hybrid search for each source type ---
        # Teacher materials (highest priority)
        material_results = await hybrid_search(
            query=query,
            lecture_id=state["lecture_id"],
            source_filter="teacher_material",
            n_results=10,
            use_bm25=True,
            use_reranking=True,
            use_multi_query=True,
            use_parent_resolution=True,
            query_embeddings=query_embeddings,
        )

        # Unit knowledge base materials
        unit_kb_results = []
        unit_number = state.get("unit_number")
        if unit_number and state.get("course_id"):
            unit_vector_id = f"unit_{state['course_id']}_{unit_number}"
            unit_kb_results = await hybrid_search(
                query=query,
                lecture_id=unit_vector_id,
                source_filter="teacher_material",
                n_results=8,
                use_bm25=True,
                use_reranking=True,
                use_multi_query=True,
                query_embeddings=query_embeddings,
            )
            logger.info(
                f"[Advanced RAG] Unit KB search (unit={unit_number}): "
                f"{len(unit_kb_results)} results"
            )

        # Transcript chunks
        transcript_results = await hybrid_search(
            query=query,
            lecture_id=state["lecture_id"],
            source_filter="lecture_transcript",
            n_results=6,
            use_bm25=True,
            use_reranking=True,
            use_multi_query=True,
            query_embeddings=query_embeddings,
        )

        # --- Stage 3: Build context with compression + citations ---
        built_context: BuiltContext = build_context(
            teacher_material_chunks=material_results,
            transcript_chunks=transcript_results,
            kb_chunks=unit_kb_results,
            external_knowledge="",  # Added in external_knowledge_node
            query=query,
            max_context_tokens=6000,
            enable_compression=True,
        )

        # Extract separate context strings for backward compatibility
        material_parts = [r.get("text", "") for r in material_results if r.get("text")]
        unit_kb_parts = [r.get("text", "") for r in unit_kb_results if r.get("text")]
        transcript_parts = [r.get("text", "") for r in transcript_results if r.get("text")]

        teacher_material_ctx = "\n\n---\n\n".join(material_parts) if material_parts else ""
        unit_kb_ctx = "\n\n---\n\n".join(unit_kb_parts) if unit_kb_parts else ""
        transcript_ctx = "\n\n---\n\n".join(transcript_parts) if transcript_parts else ""

        all_results = material_results + unit_kb_results + transcript_results

        # Build citation map for the state
        citation_dicts = [
            {"id": c.citation_id, "source": c.source_type, "heading": c.section_heading}
            for c in built_context.citations
        ]

        logger.info(
            f"[Advanced RAG] Retrieval complete: "
            f"{len(material_results)} teacher + {len(unit_kb_results)} KB + "
            f"{len(transcript_results)} transcript | "
            f"{built_context.chunks_used} chunks used, "
            f"{built_context.chunks_deduplicated} deduped, "
            f"{built_context.chunks_compressed} compressed | "
            f"~{built_context.total_tokens_estimate} tokens | "
            f"subject_nature={nature}"
        )
        
        # Transparent logging of the fetched RAG content
        logger.info(
            f"\n{'='*50}\n"
            f"TRANSPARENT RAG CONTENT LOG\n"
            f"{'='*50}\n"
            f"[TEACHER MATERIALS FETCHED]:\n"
            f"{teacher_material_ctx if teacher_material_ctx else '(None fetched)'}\n\n"
            f"[UNIT KNOWLEDGE BASE FETCHED]:\n"
            f"{unit_kb_ctx if unit_kb_ctx else '(None fetched)'}\n"
            f"{'='*50}\n"
        )

        return {
            **state,
            "context": built_context.context_text,
            "transcript_context": transcript_ctx,
            "teacher_material_context": teacher_material_ctx,
            "unit_kb_context": unit_kb_ctx,
            "context_documents": all_results,
            "subject_nature": nature,
            "retrieval_metadata": {
                **built_context.retrieval_metadata,
                "query_embeddings_count": len(query_embeddings),
                "chunks_used": built_context.chunks_used,
                "chunks_deduplicated": built_context.chunks_deduplicated,
                "chunks_compressed": built_context.chunks_compressed,
                "total_tokens_estimate": built_context.total_tokens_estimate,
            },
            "query_embeddings_count": len(query_embeddings),
            "chunks_deduplicated": built_context.chunks_deduplicated,
            "chunks_compressed": built_context.chunks_compressed,
            "citations": citation_dicts,
        }
    except Exception as e:
        logger.error(f"[Advanced RAG] Context retrieval error: {str(e)}")
        # Graceful fallback to basic retrieval
        logger.info("[Advanced RAG] Falling back to basic vector search")
        fallback_nature = "theoretical"
        try:
            fallback_nature = detect_subject_nature(
                transcript=state["transcript"],
                lecture_title=state["lecture_title"],
            )
        except Exception:
            pass

        # Basic fallback using legacy search
        try:
            fallback_query = (state.get("transcript_summary") or state["transcript"])[:500]
            material_results = await search_by_lecture(
                lecture_id=state["lecture_id"],
                query=fallback_query,
                n_results=8,
                source_filter="teacher_material",
            )
            transcript_results = await search_by_lecture(
                lecture_id=state["lecture_id"],
                query=fallback_query,
                n_results=5,
                source_filter="lecture_transcript",
            )

            material_parts = [r["text"] for r in material_results if r.get("text")]
            transcript_parts = [r["text"] for r in transcript_results if r.get("text")]

            combined = []
            if material_parts:
                combined.append(
                    "=== TEACHER-PROVIDED MATERIALS ===\n"
                    + "\n\n---\n\n".join(material_parts)
                )
            if transcript_parts:
                combined.append(
                    "=== LECTURE TRANSCRIPT EXCERPTS ===\n"
                    + "\n\n---\n\n".join(transcript_parts)
                )
            fallback_context = "\n\n".join(combined) if combined else "No additional context available."

            return {
                **state,
                "context": fallback_context,
                "transcript_context": "\n\n---\n\n".join(transcript_parts) if transcript_parts else "",
                "teacher_material_context": "\n\n---\n\n".join(material_parts) if material_parts else "",
                "unit_kb_context": "",
                "context_documents": material_results + transcript_results,
                "subject_nature": fallback_nature,
                "retrieval_metadata": {"fallback": True},
                "query_embeddings_count": 0,
                "chunks_deduplicated": 0,
                "chunks_compressed": 0,
                "citations": [],
            }
        except Exception as fallback_err:
            logger.error(f"Fallback retrieval also failed: {fallback_err}")
            return {
                **state,
                "context": "No additional context available.",
                "transcript_context": "",
                "teacher_material_context": "",
                "unit_kb_context": "",
                "wikipedia_context": "",
                "context_documents": [],
                "subject_nature": fallback_nature,
                "retrieval_metadata": {"fallback": True, "error": str(e)},
                "query_embeddings_count": 0,
                "chunks_deduplicated": 0,
                "chunks_compressed": 0,
                "citations": [],
            }


async def external_knowledge_node(state: ContentGenerationState) -> ContentGenerationState:
    """
    Node: Fetch external knowledge from Wikipedia AND GeeksForGeeks.

    This runs after context retrieval. It uses the transcript summary
    (from summarize_transcript_node) to intelligently extract key topics,
    then queries both Wikipedia and GeeksForGeeks in parallel.

    The external content is:
    - Used to VERIFY facts and SUPPLEMENT definitions
    - NEVER used as a substitute for teacher materials
    - Tagged with source attribution for transparency
    - Accompanied by verified key facts for cross-validation
    """
    logger.info(
        f"Fetching external knowledge for: {state['lecture_title']}"
    )

    try:
        # Use the transcript summary for intelligent topic extraction
        transcript_summary = state.get("transcript_summary") or ""
        if not transcript_summary:
            transcript_summary = (state.get("transcript") or "")[:2000]

        # Extract key topics from the summary
        key_topics = extract_key_topics(
            transcript_summary=transcript_summary,
            lecture_title=state["lecture_title"],
        )
        logger.info(f"Extracted key topics: {key_topics}")

        # Fetch from both sources in parallel
        external_context, verified_facts = await fetch_external_knowledge(
            lecture_title=state["lecture_title"],
            transcript_summary=transcript_summary,
            key_topics=key_topics,
        )

        # Truncate external knowledge to avoid exceeding model context limits
        # groq/compound uses models with tight TPM limits; 4000 chars ≈ 1000 tokens
        MAX_EXT_KNOWLEDGE_CHARS = 2000
        if external_context and len(external_context) > MAX_EXT_KNOWLEDGE_CHARS:
            logger.info(
                f"Truncating external knowledge from {len(external_context)} "
                f"to {MAX_EXT_KNOWLEDGE_CHARS} chars to respect model limits"
            )
            external_context = external_context[:MAX_EXT_KNOWLEDGE_CHARS]

        if external_context:
            logger.info(
                f"External knowledge retrieved: {len(external_context)} chars, "
                f"{len(verified_facts)} verified facts"
            )
            
            # Transparent logging of the fetched external knowledge
            logger.info(
                f"\n{'='*50}\n"
                f"TRANSPARENT EXTERNAL KNOWLEDGE LOG (Wikipedia / GFG)\n"
                f"{'='*50}\n"
                f"{external_context}\n"
                f"{'='*50}\n"
            )
        else:
            logger.info(
                "No external knowledge found (proceeding without)"
            )

        return {
            **state,
            "external_knowledge_context": external_context,
            "wikipedia_context": external_context,  # backward compat
            "verified_facts": verified_facts,
        }
    except Exception as e:
        logger.warning(
            f"External knowledge fetch failed (non-fatal): {e}"
        )
        return {
            **state,
            "external_knowledge_context": "",
            "wikipedia_context": "",
            "geeksforgeeks_context": "",
            "verified_facts": [],
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
            max_tokens=2000,
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
    
    # Removed sleep since we are using OpenRouter now
    
    try:
        # Select transcript based on strategy
        transcript_to_use = state.get("transcript_summary") or state["transcript"]
        
        # Pass teacher materials and external knowledge as separate sources
        context = state["context"]
        ext_knowledge = state.get("external_knowledge_context", "")

        sn = state.get("subject_nature", "mathematical")
        prompt = get_notes_prompt(
            transcript=transcript_to_use,
            context=context,
            lecture_title=state["lecture_title"],
            subject_nature=sn,
            external_knowledge=ext_knowledge,
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
    
    # Removed sleep since we are using OpenRouter now
    
    try:
        # Select transcript based on strategy
        transcript_to_use = state.get("transcript_summary") or state["transcript"]
        
        # Pass teacher materials and external knowledge as separate sources
        context = state["context"]
        ext_knowledge = state.get("external_knowledge_context", "")

        sn = state.get("subject_nature", "mathematical")
        prompt = get_assignment_prompt(
            transcript=transcript_to_use,
            context=context,
            lecture_title=state["lecture_title"],
            subject_nature=sn,
            external_knowledge=ext_knowledge,
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
    
    # Removed sleep since we are using OpenRouter now
    
    try:
        # Select transcript based on strategy
        transcript_to_use = state.get("transcript_summary") or state["transcript"]
        
        # Pass teacher materials and external knowledge as separate sources
        context = state["context"]
        ext_knowledge = state.get("external_knowledge_context", "")

        sn = state.get("subject_nature", "mathematical")
        prompt = get_flashcards_prompt(
            transcript=transcript_to_use,
            context=context,
            lecture_title=state["lecture_title"],
            subject_nature=sn,
            external_knowledge=ext_knowledge,
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


async def evaluate_content_node(state: ContentGenerationState) -> ContentGenerationState:
    """
    Node: Evaluate all generated content using the evaluation engine.
    
    Runs after all generation nodes and before save_content.  Computes
    quality scores across 6 dimensions (structure, depth, groundedness,
    writing style, topic coverage, difficulty distribution) for each
    generated content type.
    
    Scores are stored in the state and later persisted alongside the
    content in MongoDB.
    """
    logger.info(f"Evaluating generated content for lecture: {state['lecture_id']}")
    
    # Gather source texts for groundedness and coverage checks
    source_texts: List[str] = []
    
    # Add transcript (or summary)
    transcript_text = state.get("transcript_summary") or state.get("transcript", "")
    if transcript_text:
        # Split into smaller chunks for better embedding comparison
        chunk_size = 500
        for i in range(0, len(transcript_text), chunk_size):
            chunk = transcript_text[i:i + chunk_size].strip()
            if chunk:
                source_texts.append(chunk)
    
    # Add retrieved context documents
    for doc in state.get("context_documents", []):
        text = doc.get("text", "")
        if text:
            source_texts.append(text)
    
    # Add verified facts from external knowledge for groundedness checks
    for fact in state.get("verified_facts", []):
        fact_text = fact.get("fact", "")
        if fact_text:
            source_texts.append(fact_text)
    
    lecture_title = state.get("lecture_title", "")
    verified_facts = state.get("verified_facts", [])
    
    notes_quality = None
    assignment_quality = None
    flashcards_quality = None
    
    try:
        # Evaluate notes
        if state.get("notes"):
            try:
                notes_quality = await evaluate_content(
                    content=state["notes"],
                    content_type="notes",
                    source_texts=source_texts,
                    lecture_title=lecture_title,
                    verified_facts=verified_facts,
                )
                logger.info(
                    f"Notes evaluation: score={notes_quality['overall_score']} "
                    f"grade={notes_quality['grade']}"
                )
            except Exception as e:
                logger.warning(f"Notes evaluation failed (non-fatal): {e}")
                notes_quality = {"overall_score": 0.0, "grade": "?", "error": str(e)}
        
        # Evaluate assignment
        if state.get("assignment"):
            try:
                assignment_quality = await evaluate_content(
                    content=state["assignment"],
                    content_type="assignment",
                    source_texts=source_texts,
                    lecture_title=lecture_title,
                    verified_facts=verified_facts,
                )
                logger.info(
                    f"Assignment evaluation: score={assignment_quality['overall_score']} "
                    f"grade={assignment_quality['grade']}"
                )
            except Exception as e:
                logger.warning(f"Assignment evaluation failed (non-fatal): {e}")
                assignment_quality = {"overall_score": 0.0, "grade": "?", "error": str(e)}
        
        # Evaluate flashcards
        if state.get("flashcards"):
            try:
                flashcards_quality = await evaluate_content(
                    content=state["flashcards"],
                    content_type="flashcards",
                    source_texts=source_texts,
                    lecture_title=lecture_title,
                    verified_facts=verified_facts,
                )
                logger.info(
                    f"Flashcards evaluation: score={flashcards_quality['overall_score']} "
                    f"grade={flashcards_quality['grade']}"
                )
            except Exception as e:
                logger.warning(f"Flashcards evaluation failed (non-fatal): {e}")
                flashcards_quality = {"overall_score": 0.0, "grade": "?", "error": str(e)}
        
    except Exception as e:
        logger.error(f"Content evaluation error (non-fatal): {str(e)}")
    
    return {
        **state,
        "notes_quality": notes_quality,
        "assignment_quality": assignment_quality,
        "flashcards_quality": flashcards_quality,
    }


async def save_content_node(state: ContentGenerationState) -> ContentGenerationState:
    """
    Node: Save generated content (with quality scores + retrieval metadata) to MongoDB.
    """
    logger.info(f"Saving generated content for lecture: {state['lecture_id']}")
    
    try:
        saved_count = 0
        
        # Build shared retrieval metadata for all content items
        retrieval_info = {
            "context_docs_used": len(state.get("context_documents", [])),
            "generated_at": datetime.utcnow().isoformat(),
            "advanced_rag": {
                "query_embeddings_count": state.get("query_embeddings_count", 0),
                "chunks_deduplicated": state.get("chunks_deduplicated", 0),
                "chunks_compressed": state.get("chunks_compressed", 0),
                "citations_count": len(state.get("citations", [])),
                "retrieval_metadata": state.get("retrieval_metadata", {}),
            },
        }
        
        # Save notes (merge diagram results into content)
        if state.get("notes"):
            notes_content = {**state["notes"]}

            notes_doc = GeneratedContent(
                lecture_id=state["lecture_id"],
                course_id=state["course_id"],
                content_type=ContentType.NOTES,
                content=notes_content,
                metadata=retrieval_info,
                quality_scores=state.get("notes_quality") or {},
            )
            await notes_doc.insert()
            saved_count += 1
            grade = (state.get("notes_quality") or {}).get("grade", "?")
            logger.info(f"Notes saved to database (quality grade: {grade})")
        
        # Save assignment
        if state.get("assignment"):
            assignment_doc = GeneratedContent(
                lecture_id=state["lecture_id"],
                course_id=state["course_id"],
                content_type=ContentType.ASSIGNMENT,
                content=state["assignment"],
                metadata=retrieval_info,
                quality_scores=state.get("assignment_quality") or {},
            )
            await assignment_doc.insert()
            saved_count += 1
            grade = (state.get("assignment_quality") or {}).get("grade", "?")
            logger.info(f"Assignment saved to database (quality grade: {grade})")
        
        # Save flashcards
        if state.get("flashcards"):
            flashcards_doc = GeneratedContent(
                lecture_id=state["lecture_id"],
                course_id=state["course_id"],
                content_type=ContentType.FLASHCARDS,
                content=state["flashcards"],
                metadata=retrieval_info,
                quality_scores=state.get("flashcards_quality") or {},
            )
            await flashcards_doc.insert()
            saved_count += 1
            grade = (state.get("flashcards_quality") or {}).get("grade", "?")
            logger.info(f"Flashcards saved to database (quality grade: {grade})")
        
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
    
    Workflow — summarize FIRST so the summary drives context retrieval:
    1. summarize_transcript → summarize entire transcript (or use cache)
    2. retrieve_context → use summary to fetch relevant teacher materials
    3. external_knowledge → fetch Wikipedia + GFG context for fact-checking
    4. generate_notes → generate notes from summary + context + ext knowledge
    5. generate_assignment → generate assignment from summary + context + ext knowledge
    6. generate_flashcards → generate flashcards from summary + context + ext knowledge
    7. evaluate_content → score all generated content on 6 quality dimensions
    8. save_content → save content + quality scores to database
    9. END
    
    Summarizing first means the vector search query contains ALL key
    topics, terms and definitions from the lecture — not just the first
    500 characters (which might be an intro or greeting).
    
    External knowledge (Wikipedia + GeeksForGeeks) is fetched in parallel
    and merged into a structured reference block. The LLM receives explicit
    instructions on how to use it without hallucinating.
    """
    workflow = StateGraph(ContentGenerationState)
    
    # Add nodes
    workflow.add_node("summarize_transcript", summarize_transcript_node)
    workflow.add_node("retrieve_context", retrieve_context_node)
    workflow.add_node("external_knowledge", external_knowledge_node)
    workflow.add_node("generate_notes", generate_notes_node)
    workflow.add_node("generate_assignment", generate_assignment_node)
    workflow.add_node("generate_flashcards", generate_flashcards_node)
    workflow.add_node("evaluate_content", evaluate_content_node)
    workflow.add_node("save_content", save_content_node)
    
    # Define edges — summarize first, then retrieve using the summary
    workflow.set_entry_point("summarize_transcript")
    workflow.add_edge("summarize_transcript", "retrieve_context")
    workflow.add_edge("retrieve_context", "external_knowledge")
    workflow.add_edge("external_knowledge", "generate_notes")
    workflow.add_edge("generate_notes", "generate_assignment")
    workflow.add_edge("generate_assignment", "generate_flashcards")
    workflow.add_edge("generate_flashcards", "evaluate_content")
    workflow.add_edge("evaluate_content", "save_content")
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
        "geeksforgeeks_context": "",
        "external_knowledge_context": "",
        "verified_facts": [],
        "context_documents": [],
        "subject_nature": "mathematical",
        # Advanced RAG metadata
        "retrieval_metadata": {},
        "query_embeddings_count": 0,
        "chunks_deduplicated": 0,
        "chunks_compressed": 0,
        "citations": [],
        # Generated content
        "notes": None,
        "assignment": None,
        "flashcards": None,
        "notes_quality": None,
        "assignment_quality": None,
        "flashcards_quality": None,
        "diagrams": None,
        "error": None,
        "completed_types": [],
    }
    
    logger.info(f"Starting content generation workflow for lecture: {lecture_id}")
    
    # Run the workflow
    final_state = await content_generation_graph.ainvoke(initial_state)
    
    # Log completion with advanced RAG metrics
    retrieval_meta = final_state.get("retrieval_metadata", {})
    logger.info(
        f"Content generation complete. "
        f"Types: {final_state.get('completed_types', [])} | "
        f"Advanced RAG: "
        f"queries={final_state.get('query_embeddings_count', 0)}, "
        f"chunks_used={retrieval_meta.get('chunks_used', '?')}, "
        f"deduped={final_state.get('chunks_deduplicated', 0)}, "
        f"compressed={final_state.get('chunks_compressed', 0)}, "
        f"citations={len(final_state.get('citations', []))}"
    )
    
    return final_state
