# Quick script to fix the invalid 'pending' status in lectures collection
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

async def fix_pending_status():
    # Get MongoDB settings from env
    mongo_uri = os.getenv("MONGODB_URI")
    db_name = os.getenv("MONGODB_DB_NAME", "TAP")
    
    # Connect directly to MongoDB
    client = AsyncIOMotorClient(mongo_uri)
    db = client[db_name]
    
    # Update all documents with 'pending' status
    result = await db.lectures.update_many(
        {"generation_status": "pending"},
        {"$set": {"generation_status": "generating"}}
    )
    print(f"Updated {result.modified_count} documents with 'pending' -> 'generating'")
    
    # Close connection
    client.close()

if __name__ == "__main__":
    asyncio.run(fix_pending_status())
