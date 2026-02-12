# Quick script to check lecture transcript
import asyncio
import os
from dotenv import load_dotenv
from motor.motor_asyncio import AsyncIOMotorClient
from bson import ObjectId

load_dotenv()

async def check_lecture(lecture_id: str):
    # Get MongoDB settings from env
    mongo_uri = os.getenv("MONGODB_URI")
    db_name = os.getenv("MONGODB_DB_NAME", "TAP")
    
    # Connect directly to MongoDB
    client = AsyncIOMotorClient(mongo_uri)
    db = client[db_name]
    
    # Find the lecture
    lecture = await db.lectures.find_one({"_id": ObjectId(lecture_id)})
    
    if lecture:
        print(f"Lecture found: {lecture.get('title')}")
        print(f"Transcript length: {len(lecture.get('transcript', '') or '')} chars")
        print(f"Transcript preview: {(lecture.get('transcript', '') or '')[:200]}...")
        print(f"Generation status: {lecture.get('generation_status')}")
        print(f"Is transcribed: {lecture.get('is_transcribed')}")
        print(f"Is live recorded: {lecture.get('is_live_recorded')}")
    else:
        print("Lecture not found!")
    
    # Close connection
    client.close()

if __name__ == "__main__":
    # Use the lecture ID from the logs
    lecture_id = "69870fa2cdaa7ca5157f5eba"
    asyncio.run(check_lecture(lecture_id))
