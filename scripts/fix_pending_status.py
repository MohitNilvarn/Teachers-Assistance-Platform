# Quick script to fix the invalid 'pending' status in lectures collection
import asyncio
import os
from dotenv import load_dotenv
from motor.motor_asyncio import AsyncIOMotorClient

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
