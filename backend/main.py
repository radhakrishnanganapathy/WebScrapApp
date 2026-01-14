from fastapi import FastAPI, Depends, HTTPException, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from datetime import datetime
import json

from database import get_db, init_db
from models import Channel, Video
from youtube_api import fetch_channel_info, fetch_recent_videos

app = FastAPI(title="YouTube Scraper API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("startup")
async def on_startup():
    await init_db()

def parse_yt_date(date_str):
    if not date_str:
        return None
    # YouTube API dates can be "2021-01-10T12:02:20Z" or "2021-01-10T12:02:20.098389Z"
    try:
        return datetime.fromisoformat(date_str.replace('Z', '+00:00'))
    except ValueError:
        return None

@app.post("/scrape/{identifier}")
async def scrape_channel(identifier: str, db: AsyncSession = Depends(get_db)):
    # 1. Fetch from YouTube
    try:
        channel_info = fetch_channel_info(identifier)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

    if not channel_info:
        raise HTTPException(status_code=404, detail="Channel not found")

    # 2. Check if exists in DB
    result = await db.execute(select(Channel).where(Channel.channel_id == channel_info["channel_id"]))
    db_channel = result.scalar_one_or_none()

    if not db_channel:
        db_channel = Channel(channel_id=channel_info["channel_id"])
        db.add(db_channel)

    # 3. Update info
    db_channel.name = channel_info["name"]
    db_channel.description = channel_info["description"]
    db_channel.published_at = parse_yt_date(channel_info["published_at"])
    db_channel.subscriber_count = channel_info["subscriber_count"]
    db_channel.profile_picture_url = channel_info["profile_picture_url"]
    db_channel.total_views = channel_info["total_views"]
    db_channel.total_videos = channel_info["total_videos"]
    db_channel.location = channel_info["location"]
    db_channel.username = channel_info["username"]
    db_channel.links = channel_info["links"]
    db_channel.scraped_at = datetime.utcnow()

    # 4. Fetch videos
    videos_data = fetch_recent_videos(channel_info["upload_playlist_id"])
    
    if videos_data:
        db_channel.last_video_uploaded_at = parse_yt_date(videos_data[0]["published_at"])
        
        # Upsert videos
        for v in videos_data:
            v_result = await db.execute(select(Video).where(Video.video_id == v["video_id"]))
            db_video = v_result.scalar_one_or_none()
            
            if not db_video:
                db_video = Video(video_id=v["video_id"], channel_db_id=db_channel.id)
                db.add(db_video)
            
            db_video.title = v["title"]
            db_video.description = v["description"]
            db_video.views = v["views"]
            db_video.likes = v["likes"]
            db_video.total_comments = v["total_comments"]
            db_video.published_at = parse_yt_date(v["published_at"])

    await db.commit()
    await db.refresh(db_channel)
    return {"message": "Success", "channel_id": db_channel.channel_id}

@app.get("/channels")
async def list_channels(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Channel).order_by(Channel.scraped_at.desc()))
    return result.scalars().all()

@app.get("/channels/{channel_id}")
async def get_channel_details(channel_id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Channel).where(Channel.channel_id == channel_id))
    channel = result.scalar_one_or_none()
    
    if not channel:
        raise HTTPException(status_code=404, detail="Channel not found")
    
    v_result = await db.execute(select(Video).where(Video.channel_db_id == channel.id).order_by(Video.published_at.desc()))
    videos = v_result.scalars().all()
    
    return {
        "channel": channel,
        "videos": videos
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
