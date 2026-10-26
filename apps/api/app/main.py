# File: app/main.py
"""
Teacher Assistance Platform API - Main Application
"""
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import settings
from app.core.logger import setup_logging, get_logger
from app.db.mongodb import connect_to_mongodb, close_mongodb_connection
from app.db.redis import connect_to_redis, close_redis_connection
from app.api.v1.router import api_router

# Setup Logging
setup_logging()
logger = get_logger("TAP.Main")


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan manager for startup and shutdown."""
    # Startup
    logger.info("Application is STARTING UP...")
    
    # Connect to MongoDB (non-fatal — app starts even if DB is slow)
    try:
        await connect_to_mongodb()
    except Exception as e:
        logger.error(f"MongoDB connection failed on startup: {e}. Will retry on first request.")
    
    # Connect to Redis (optional)
    try:
        await connect_to_redis()
    except Exception as e:
        logger.warning(f"Redis connection failed: {e}")
    
    logger.info("Application startup complete!")
    
    yield
    
    # Shutdown
    logger.info("Application is SHUTTING DOWN...")
    await close_mongodb_connection()
    await close_redis_connection()
    logger.info("Application shutdown complete!")


# Create FastAPI app
app = FastAPI(
    title="Teacher Assistance Platform API",
    description="""
    A comprehensive API for the Teacher Assistance Platform (TAP).
    
    ## Features
    - **Course Management**: Create and manage courses
    - **Material Upload**: Upload study materials (PDF, DOCX, PPTX)
    - **Lecture Management**: Upload lecture audio and transcripts
    - **AI Content Generation**: Generate notes, assignments, and flashcards
    - **Semantic Search**: Context-aware content retrieval
    
    ## Tech Stack
    - FastAPI, MongoDB Atlas, MongoDB Vector Search
    - Groq LLM (llama3-70b), HuggingFace Embeddings
    - LangGraph for AI workflows
    """,
    version=settings.VERSION,
    lifespan=lifespan
)

# CORS Configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include Routers
app.include_router(api_router, prefix=settings.API_V1_PREFIX)


@app.get("/", tags=["Health"])
def health_check():
    """Health check endpoint."""
    return {
        "status": "ok",
        "message": "TAP API is running",
        "version": settings.VERSION
    }
