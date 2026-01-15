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

from models import Channel, Video, Comment
from youtube_api import fetch_channel_info, fetch_recent_videos, fetch_video_details, fetch_video_comments

# ... imports ...

@app.post("/scrape/{identifier}")
async def scrape_data(identifier: str, type: str = "channel", db: AsyncSession = Depends(get_db)):
    if type == "channel":
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
        return {"message": "Channel Scraped", "id": db_channel.channel_id}

    elif type == "video":
        # identifier is video_id
        video_details = fetch_video_details(identifier)
        if not video_details:
             raise HTTPException(status_code=404, detail="Video not found")
        
        # We need the channel to exist
        channel_id = video_details["channel_id"]
        result = await db.execute(select(Channel).where(Channel.channel_id == channel_id))
        db_channel = result.scalar_one_or_none()
        
        if not db_channel:
             # Fetch channel info if not exists
             channel_info = fetch_channel_info(channel_id)
             if channel_info:
                db_channel = Channel(
                    channel_id=channel_info["channel_id"],
                    name=channel_info["name"],
                    description=channel_info["description"],
                    published_at=parse_yt_date(channel_info["published_at"]),
                    subscriber_count=channel_info["subscriber_count"],
                    profile_picture_url=channel_info["profile_picture_url"],
                    location=channel_info["location"],
                    username=channel_info["username"]
                )
                db.add(db_channel)
                await db.commit()
                await db.refresh(db_channel)
        
        # Now upsert video
        v_result = await db.execute(select(Video).where(Video.video_id == video_details["video_id"]))
        db_video = v_result.scalar_one_or_none()

        if not db_video:
            db_video = Video(video_id=video_details["video_id"], channel_db_id=db_channel.id if db_channel else None)
            db.add(db_video)

        db_video.title = video_details["title"]
        db_video.description = video_details["description"]
        db_video.views = video_details["views"]
        db_video.likes = video_details["likes"]
        db_video.total_comments = video_details["total_comments"]
        db_video.published_at = parse_yt_date(video_details["published_at"])
        db_video.scraped_at = datetime.utcnow()

        await db.commit()
        return {"message": "Video Scraped", "id": video_details["video_id"]}

    elif type == "comment":
        # identifier is video_id
        comments_data = fetch_video_comments(identifier)
        if not comments_data:
            return {"message": "No comments found or comments disabled", "count": 0}

        # Ensure video exists
        v_result = await db.execute(select(Video).where(Video.video_id == identifier))
        db_video = v_result.scalar_one_or_none()

        if not db_video:
            # If video doesn't exist, try to fetch it first (recursively or just call logic)
            # For simplicity, let's just fetch it quickly
            video_details = fetch_video_details(identifier)
            if video_details:
                # Need channel...
                 channel_id = video_details["channel_id"]
                 # Check channel...
                 c_result = await db.execute(select(Channel).where(Channel.channel_id == channel_id))
                 db_channel = c_result.scalar_one_or_none()
                 if not db_channel:
                     # Just create a dummy channel entry if real fetch is too heavy, OR fetch it.
                     # Let's fetch it to be safe and consistent
                     channel_info = fetch_channel_info(channel_id)
                     if channel_info:
                         db_channel = Channel(channel_id=channel_id, name=channel_info["name"]) # Minimal
                         db.add(db_channel)
                         await db.commit()
                         await db.refresh(db_channel)
                
                 db_video = Video(video_id=identifier, channel_db_id=db_channel.id if db_channel else None)
                 db.add(db_video)
                 await db.commit()
                 await db.refresh(db_video)
            else:
                 raise HTTPException(status_code=404, detail="Video not found for these comments")

        # Now save comments
        count = 0
        for c in comments_data:
            # Check exist
            c_result = await db.execute(select(Comment).where(Comment.comment_id == c["comment_id"]))
            db_comment = c_result.scalar_one_or_none()

            if not db_comment:
                db_comment = Comment(comment_id=c["comment_id"], video_db_id=db_video.id)
                db.add(db_comment)
            
            db_comment.text = c["text"]
            db_comment.author_name = c["author_name"]
            db_comment.like_count = c["like_count"]
            db_comment.published_at = parse_yt_date(c["published_at"])
            db_comment.scraped_at = datetime.utcnow()
            count += 1
        
        await db.commit()
        return {"message": "Comments Scraped", "count": count}

    else:
        raise HTTPException(status_code=400, detail="Invalid scrape type")

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
