from typing import List, Dict, Any, Optional
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel

from app.core.logger import get_logger
from app.services.hybrid_search import advanced_search_documents
from app.ai.llm import chat_with_rag

logger = get_logger("TAP.ChatAPI")
router = APIRouter()

class ChatMessage(BaseModel):
    role: str
    content: str

class ChatRequest(BaseModel):
    query: str
    course_id: Optional[str] = None
    lecture_id: Optional[str] = None
    history: List[ChatMessage] = []

class ChatResponse(BaseModel):
    response: str
    sources: List[Dict[str, Any]]

@router.post("/chat", response_model=ChatResponse)
async def chat_endpoint(request: ChatRequest):
    """
    RAG-powered chatbot endpoint.
    Retrieves relevant context based on course_id or lecture_id and answers the query.
    """
    if not request.course_id and not request.lecture_id:
        raise HTTPException(status_code=400, detail="Must provide either course_id or lecture_id")

    logger.info(f"Chat request received. Query: '{request.query[:50]}...' Course: {request.course_id} Lecture: {request.lecture_id}")

    try:
        # 1. Retrieve context
        # We will use advanced_search_documents since it handles hybrid search and reranking
        search_results = await advanced_search_documents(
            course_id=request.course_id,
            lecture_id=request.lecture_id,
            query=request.query,
            n_results=10
        )
        
        # 2. Format context
        context_parts = []
        sources = []
        for i, res in enumerate(search_results):
            text = res.get("text", "").strip()
            source = res.get("source", "unknown")
            if text:
                context_parts.append(f"--- Source {i+1} ({source}) ---\n{text}\n")
                sources.append({
                    "id": str(res.get("id")),
                    "source": source,
                    "score": res.get("score")
                })
                
        context = "\n".join(context_parts)
        if not context:
            context = "No specific materials found for this query."
            
        # 3. Call LLM
        history_dicts = [{"role": msg.role, "content": msg.content} for msg in request.history]
        
        answer = await chat_with_rag(
            query=request.query,
            context=context,
            history=history_dicts
        )
        
        return ChatResponse(
            response=answer,
            sources=sources
        )

    except Exception as e:
        logger.error(f"Chat endpoint error: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Chat generation failed: {str(e)}")
