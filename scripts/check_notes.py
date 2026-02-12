# Quick script to check if notes exist for the lecture
import asyncio
import os
from dotenv import load_dotenv
from motor.motor_asyncio import AsyncIOMotorClient
from bson import ObjectId

load_dotenv()

async def check_notes(lecture_id: str):
    # Get MongoDB settings from env
    mongo_uri = os.getenv("MONGODB_URI")
    db_name = os.getenv("MONGODB_DB_NAME", "TAP")
    
    # Connect directly to MongoDB
    client = AsyncIOMotorClient(mongo_uri)
    db = client[db_name]
    
    # Find notes for the lecture
    notes = await db.notes.find_one({"lecture_id": lecture_id})
    
    if notes:
        print(f"Notes found!")
        print(f"Content length: {len(notes.get('content', '') or '')} chars")
        print(f"Content preview: {(notes.get('content', '') or '')[:300]}...")
    else:
        print("Notes NOT found - need to run content generation")
        
        # Check the lecture transcript again
        lecture = await db.lectures.find_one({"_id": ObjectId(lecture_id)})
        if lecture:
            print(f"\nLecture transcript ({len(lecture.get('transcript', ''))} chars):")
            print(lecture.get('transcript', '')[:500])
    
    # Close connection
    client.close()

if __name__ == "__main__":
    lecture_id = "69870fa2cdaa7ca5157f5eba"
    asyncio.run(check_notes(lecture_id))
