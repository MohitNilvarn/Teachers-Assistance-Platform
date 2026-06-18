# Fix existing live-recorded lecture to have transcription_status = completed
import asyncio
import os
from pathlib import Path

from dotenv import load_dotenv
from motor.motor_asyncio import AsyncIOMotorClient

_env_loaded = False
for parent in Path(__file__).resolve().parents:
    dotenv_path = parent / ".env"
    if dotenv_path.exists():
        load_dotenv(dotenv_path=dotenv_path)
        _env_loaded = True
        break

if not _env_loaded:
    load_dotenv()

async def fix_live_lectures():
    mongo_uri = os.getenv("MONGODB_URI")
    db_name = os.getenv("MONGODB_DB_NAME", "TAP")
    
    client = AsyncIOMotorClient(mongo_uri)
    db = client[db_name]
    
    # Update all live-recorded lectures to have transcription_status = completed
    result = await db.lectures.update_many(
        {"is_live_recorded": True, "transcription_status": {"$exists": False}},
        {"$set": {"transcription_status": "completed", "generation_status": "not_started"}}
    )
    print(f"Updated {result.modified_count} live-recorded lectures")
    
    client.close()

if __name__ == "__main__":
    asyncio.run(fix_live_lectures())
