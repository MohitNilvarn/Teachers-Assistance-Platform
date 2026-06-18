# File: app/core/config.py
import os
from pathlib import Path
from dotenv import load_dotenv
from app.core.logger import get_logger

# Note: We don't run setup_logging() here because main.py handles it.
# We just get a logger instance.
logger = get_logger("TAP.Config")

API_ROOT = Path(__file__).resolve().parents[2]

logger.info("Loading environment variables...")
_env_loaded = False
for parent in Path(__file__).resolve().parents:
    dotenv_path = parent / ".env"
    if dotenv_path.exists():
        load_dotenv(dotenv_path=dotenv_path)
        _env_loaded = True
        break

if not _env_loaded:
    load_dotenv()


class Settings:
    """Application settings loaded from environment variables."""
    
    # Project Info
    PROJECT_NAME: str = "Teacher Assistance Platform"
    
    # Supabase (Auth)
    SUPABASE_URL: str = os.getenv("SUPABASE_URL", "")
    SUPABASE_KEY: str = os.getenv("SUPABASE_KEY", "")
    
    # MongoDB Atlas
    MONGODB_URI: str = os.getenv("MONGODB_URI", "mongodb://localhost:27017")
    MONGODB_DB_NAME: str = os.getenv("MONGODB_DB_NAME", "tap_database")
    
    # Redis (Optional - for caching and Celery)
    REDIS_URL: str = os.getenv("REDIS_URL", "")
    REDIS_ENABLED: bool = bool(os.getenv("REDIS_URL"))
    
    # Groq API (LLM)
    GROQ_API_KEY: str = os.getenv("GROQ_API_KEY", "your-groq-api-key-here")
    GROQ_MODEL: str = os.getenv("GROQ_MODEL", "llama3-70b-8192")
    
    # HuggingFace (Embeddings)
    HUGGINGFACE_API_KEY: str = os.getenv("HUGGINGFACE_API_KEY", "your-huggingface-api-key-here")
    EMBEDDING_MODEL: str = os.getenv("EMBEDDING_MODEL", "sentence-transformers/all-MiniLM-L6-v2")
    
    # MongoDB Vector Search
    VECTOR_COLLECTION: str = os.getenv("VECTOR_COLLECTION", "vector_embeddings")
    
    # File Upload Settings
    MAX_UPLOAD_SIZE_MB: int = int(os.getenv("MAX_UPLOAD_SIZE_MB", "50"))
    UPLOAD_DIR: str = os.getenv("UPLOAD_DIR", str(API_ROOT / "uploads"))
    
    # Deepgram API (Real-time Transcription)
    DEEPGRAM_API_KEY: str = os.getenv("DEEPGRAM_API_KEY", "")
    
    # AI Content Generation Strategy
    # Always summarize entire transcript using LLM before content generation
    TRANSCRIPT_SUMMARIZATION_ENABLED: bool = os.getenv("TRANSCRIPT_SUMMARIZATION_ENABLED", "true").lower() == "true"
    SUMMARIZATION_TEMPERATURE: float = float(os.getenv("SUMMARIZATION_TEMPERATURE", "0.3"))
    SUMMARIZATION_MAX_TOKENS: int = int(os.getenv("SUMMARIZATION_MAX_TOKENS", "8000"))
    
    # Advanced RAG Configuration
    RAG_USE_HYDE: bool = os.getenv("RAG_USE_HYDE", "true").lower() == "true"
    RAG_USE_QUERY_DECOMPOSITION: bool = os.getenv("RAG_USE_QUERY_DECOMPOSITION", "true").lower() == "true"
    RAG_USE_RERANKING: bool = os.getenv("RAG_USE_RERANKING", "true").lower() == "true"
    RAG_USE_BM25: bool = os.getenv("RAG_USE_BM25", "true").lower() == "true"
    RAG_USE_CONTEXTUAL_COMPRESSION: bool = os.getenv("RAG_USE_CONTEXTUAL_COMPRESSION", "true").lower() == "true"
    RAG_USE_PARENT_CHILD: bool = os.getenv("RAG_USE_PARENT_CHILD", "true").lower() == "true"
    RAG_MAX_CONTEXT_TOKENS: int = int(os.getenv("RAG_MAX_CONTEXT_TOKENS", "8000"))
    RAG_RERANK_TOP_K: int = int(os.getenv("RAG_RERANK_TOP_K", "10"))
    RAG_MAX_SUB_QUERIES: int = int(os.getenv("RAG_MAX_SUB_QUERIES", "4"))
    
    def __init__(self):
        self._validate_config()
    
    def _validate_config(self):
        """Validate required configuration values."""
        errors = []
        
        if not self.SUPABASE_URL:
            errors.append("SUPABASE_URL")
        if not self.SUPABASE_KEY:
            errors.append("SUPABASE_KEY")
        
        if errors:
            for var in errors:
                logger.warning(f"MISSING ENV VAR: {var}")
        
        # Log optional config status
        if not self.REDIS_URL:
            logger.info("Redis not configured - caching disabled")
        
        if self.GROQ_API_KEY == "your-groq-api-key-here":
            logger.warning("Using placeholder GROQ_API_KEY - LLM calls will fail")
        
        if self.HUGGINGFACE_API_KEY == "your-huggingface-api-key-here":
            logger.info("Using placeholder HUGGINGFACE_API_KEY - using local embeddings")
        
        logger.info("Config loaded successfully.")


settings = Settings()