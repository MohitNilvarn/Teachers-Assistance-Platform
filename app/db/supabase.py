# File: app/db/supabase.py
from supabase import create_client, Client
from typing import Optional
from app.core.config import settings
from app.core.logger import get_logger

logger = get_logger("TAP.Database")

supabase: Optional[Client] = None

try:
    if settings.SUPABASE_URL and settings.SUPABASE_KEY:
        logger.info("Initializing Supabase Client...")
        supabase = create_client(settings.SUPABASE_URL, settings.SUPABASE_KEY)
        logger.info("Supabase Client initialized.")
    else:
        logger.warning("SUPABASE_URL or SUPABASE_KEY not set — Supabase auth disabled")
except Exception as e:
    logger.critical(f"FAILED to initialize Supabase: {str(e)}", exc_info=True)
    supabase = None