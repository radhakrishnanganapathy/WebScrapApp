from fastapi import FastAPI, Depends, HTTPException, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc
from datetime import datetime, timedelta
import json
import asyncio

from database import get_db, init_db
from models import (
    Channel, Video, Comment, CommentReply, MonitoredChannel, 
    MonitorLog, TwitterAccount, TwitterPost, TwitterReply
)
from youtube_api import (
    fetch_channel_info, fetch_recent_videos, fetch_video_details, 
    fetch_video_comments, get_latest_video, fetch_comment_replies
)
from twitter_api import fetch_twitter_user, fetch_tweet_details, fetch_tweet_replies
from pydantic import BaseModel

app = FastAPI(title="YouTube & Twitter Scraper API")

# Global state for monitoring
monitoring_active = False
monitoring_task_running = False

class MonitorCreate(BaseModel):
    channel_id: str
    comment_text: str
    channel_type: str = None
    ideology: str = None

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

async def monitor_loop():
    global monitoring_active
    while True:
        if monitoring_active:
            print("Running monitoring check...")
            try:
                from database import AsyncSessionLocal
                async with AsyncSessionLocal() as db:
                    result = await db.execute(select(MonitoredChannel).where(MonitoredChannel.is_active == 1))
                    monitored_list = result.scalars().all()
                    
                    for ch in monitored_list:
                        latest_vid_data = get_latest_video(ch.channel_id) # Returns dict {video_id, title} or None
                        
                        if latest_vid_data:
                            latest_vid_id = latest_vid_data['video_id']
                            latest_vid_title = latest_vid_data['title']

                            if latest_vid_id != ch.last_checked_video_id:
                                log = MonitorLog(
                                    monitor_id=ch.id,
                                    video_id=latest_vid_id,
                                    video_title=latest_vid_title,
                                    comment_text=ch.comment_text,
                                    status="pending",
                                    channel_id=ch.channel_id
                                )
                                db.add(log)
                                ch.last_checked_video_id = latest_vid_id
                                print(f"New video detected: {latest_vid_title} for channel {ch.channel_id}")
                    
                    await db.commit()
            except Exception as e:
                print(f"Error in monitor loop: {e}")
        
        await asyncio.sleep(60)

@app.on_event("startup")
async def on_startup():
    global monitoring_task_running
    await init_db()
    if not monitoring_task_running:
        asyncio.create_task(monitor_loop())
        monitoring_task_running = True

def parse_date(date_str):
    if not date_str:
        return None
    try:
        if isinstance(date_str, datetime):
            return date_str
        return datetime.fromisoformat(date_str.replace('Z', '+00:00'))
    except Exception:
        try:
            return datetime.strptime(date_str.split('·')[0].strip(), "%b %d, %Y")
        except:
            return datetime.utcnow()

# --- YouTube Endpoints ---

@app.post("/scrape/{identifier}")
async def scrape_data(
    identifier: str, 
    type: str = "channel", 
    channel_type: str = None, 
    ideology: str = None, 
    pages: int = 1,
    max_results: int = 50,
    db: AsyncSession = Depends(get_db)
):
    if type == "channel":
        try:
            channel_info = fetch_channel_info(identifier)
        except Exception as e:
            raise HTTPException(status_code=400, detail=str(e))
        if not channel_info:
            raise HTTPException(status_code=404, detail="Channel not found")
        result = await db.execute(select(Channel).where(Channel.channel_id == channel_info["channel_id"]))
        db_channel = result.scalar_one_or_none()
        if not db_channel:
            db_channel = Channel(channel_id=channel_info["channel_id"])
            db.add(db_channel)
        db_channel.name = channel_info["name"]
        db_channel.description = channel_info["description"]
        db_channel.published_at = parse_date(channel_info["published_at"])
        db_channel.subscriber_count = channel_info["subscriber_count"]
        db_channel.profile_picture_url = channel_info["profile_picture_url"]
        db_channel.total_views = channel_info["total_views"]
        db_channel.total_videos = channel_info["total_videos"]
        db_channel.location = channel_info["location"]
        db_channel.username = channel_info["username"]
        db_channel.links = channel_info["links"]
        if channel_type:
            db_channel.channel_type = channel_type
        if ideology:
            db_channel.ideology = ideology
        db_channel.scraped_at = datetime.utcnow()
        videos_data = fetch_recent_videos(channel_info["upload_playlist_id"], pages=pages, max_results=max_results)
        if videos_data:
            db_channel.last_video_uploaded_at = parse_date(videos_data[0]["published_at"])
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
                db_video.published_at = parse_date(v["published_at"])
        await db.commit()
        await db.refresh(db_channel)
        return {"message": "Channel Scraped", "id": db_channel.channel_id}
    elif type == "video":
        video_details = fetch_video_details(identifier)
        if not video_details:
             raise HTTPException(status_code=404, detail="Video not found")
        channel_id = video_details["channel_id"]
        result = await db.execute(select(Channel).where(Channel.channel_id == channel_id))
        db_channel = result.scalar_one_or_none()
        if not db_channel:
             channel_info = fetch_channel_info(channel_id)
             if channel_info:
                db_channel = Channel(
                    channel_id=channel_info["channel_id"],
                    name=channel_info["name"],
                    description=channel_info["description"],
                    published_at=parse_date(channel_info["published_at"]),
                    subscriber_count=channel_info["subscriber_count"],
                    profile_picture_url=channel_info["profile_picture_url"],
                    location=channel_info["location"],
                    username=channel_info["username"],
                    channel_type=channel_type,
                    ideology=ideology
                )
                db.add(db_channel)
                await db.commit()
                await db.refresh(db_channel)
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
        db_video.published_at = parse_date(video_details["published_at"])
        db_video.scraped_at = datetime.utcnow()
        await db.commit()
        return {"message": "Video Scraped", "id": video_details["video_id"]}
    elif type == "comment":
        comments_data = fetch_video_comments(identifier, pages=pages, max_results=max_results)
        if not comments_data:
            return {"message": "No comments found or comments disabled", "count": 0}
        v_result = await db.execute(select(Video).where(Video.video_id == identifier))
        db_video = v_result.scalar_one_or_none()
        if not db_video:
            video_details = fetch_video_details(identifier)
            if video_details:
                 channel_id = video_details["channel_id"]
                 c_result = await db.execute(select(Channel).where(Channel.channel_id == channel_id))
                 db_channel = c_result.scalar_one_or_none()
                 if not db_channel:
                     channel_info = fetch_channel_info(channel_id)
                     if channel_info:
                         db_channel = Channel(channel_id=channel_id, name=channel_info["name"]) 
                         db.add(db_channel)
                         await db.commit()
                         await db.refresh(db_channel)
                 db_video = Video(video_id=identifier, channel_db_id=db_channel.id if db_channel else None)
                 db.add(db_video)
                 await db.commit()
                 await db.refresh(db_video)
            else:
                 raise HTTPException(status_code=404, detail="Video not found for these comments")
        count = 0
        for c in comments_data:
            c_result = await db.execute(select(Comment).where(Comment.comment_id == c["comment_id"]))
            db_comment = c_result.scalar_one_or_none()
            if not db_comment:
                db_comment = Comment(comment_id=c["comment_id"], video_db_id=db_video.id)
                db.add(db_comment)
            db_comment.text = c["text"]
            db_comment.author_name = c["author_name"]
            db_comment.like_count = c["like_count"]
            db_comment.published_at = parse_date(c["published_at"])
            db_comment.scraped_at = datetime.utcnow()
            count += 1
        await db.commit()
        return {"message": "Comments Scraped", "count": count}
    else:
        raise HTTPException(status_code=400, detail="Invalid scrape type")

# --- Twitter (X) Endpoints ---

@app.post("/scrape_twitter/{identifier}")
async def scrape_twitter(identifier: str, type: str = "user", db: AsyncSession = Depends(get_db)):
    if type == "user":
        user_info = fetch_twitter_user(identifier)
        if not user_info:
            raise HTTPException(status_code=404, detail="Twitter user not found")
        result = await db.execute(select(TwitterAccount).where(TwitterAccount.username == user_info["username"]))
        db_user = result.scalar_one_or_none()
        if not db_user:
            db_user = TwitterAccount(username=user_info["username"])
            db.add(db_user)
        db_user.display_name = user_info["display_name"]
        db_user.description = user_info["description"]
        db_user.profile_image_url = user_info["profile_image_url"]
        db_user.follower_count = user_info["follower_count"]
        db_user.location = user_info["location"]
        db_user.scraped_at = datetime.utcnow()
        await db.commit()
        return {"message": "Twitter User Scraped", "username": db_user.username}
    elif type == "post":
        post_info = fetch_tweet_details(identifier)
        if not post_info:
            raise HTTPException(status_code=404, detail="Tweet not found")
        username = post_info["username"]
        result = await db.execute(select(TwitterAccount).where(TwitterAccount.username == username))
        db_user = result.scalar_one_or_none()
        if not db_user:
            db_user = TwitterAccount(username=username, display_name=username)
            db.add(db_user)
            await db.commit()
            await db.refresh(db_user)
        p_result = await db.execute(select(TwitterPost).where(TwitterPost.post_id == identifier))
        db_post = p_result.scalar_one_or_none()
        if not db_post:
            db_post = TwitterPost(post_id=identifier, account_id=db_user.id)
            db.add(db_post)
        db_post.text = post_info["text"]
        db_post.like_count = post_info["like_count"]
        db_post.retweet_count = post_info["retweet_count"]
        db_post.reply_count = post_info["reply_count"]
        db_post.published_at = parse_date(post_info["published_at"])
        db_post.scraped_at = datetime.utcnow()
        await db.commit()
        return {"message": "Twitter Post Scraped", "id": identifier}
    elif type == "reply":
        post_info = fetch_tweet_details(identifier)
        if not post_info:
            raise HTTPException(status_code=404, detail="Tweet not found for replies")
        replies_data = fetch_tweet_replies(identifier, post_info["username"])
        result = await db.execute(select(TwitterPost).where(TwitterPost.post_id == identifier))
        db_post = result.scalar_one_or_none()
        if not db_post:
            username = post_info["username"]
            u_res = await db.execute(select(TwitterAccount).where(TwitterAccount.username == username))
            db_user = u_res.scalar_one_or_none()
            if not db_user:
                db_user = TwitterAccount(username=username, display_name=username)
                db.add(db_user)
                await db.commit()
                await db.refresh(db_user)
            db_post = TwitterPost(post_id=identifier, account_id=db_user.id, text=post_info["text"])
            db.add(db_post)
            await db.commit()
            await db.refresh(db_post)
        count = 0
        for r in replies_data:
            r_res = await db.execute(select(TwitterReply).where(TwitterReply.reply_id == r["reply_id"]))
            db_reply = r_res.scalar_one_or_none()
            if not db_reply:
                db_reply = TwitterReply(reply_id=r["reply_id"], post_db_id=db_post.id)
                db.add(db_reply)
            db_reply.text = r["text"]
            db_reply.author_username = r["author_username"]
            db_reply.author_display_name = r["author_display_name"]
            db_reply.like_count = r["like_count"]
            db_reply.published_at = parse_date(r["published_at"])
            db_reply.scraped_at = datetime.utcnow()
            count += 1
        await db.commit()
        return {"message": f"Scraped {count} replies for tweet {identifier}", "count": count}
    else:
        raise HTTPException(status_code=400, detail="Invalid Twitter scrape type")

@app.get("/twitter/accounts")
async def list_twitter_accounts(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(TwitterAccount).order_by(TwitterAccount.scraped_at.desc()))
    return result.scalars().all()

@app.get("/twitter/accounts/{username}")
async def get_twitter_account_details(username: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(TwitterAccount).where(TwitterAccount.username == username))
    account = result.scalar_one_or_none()
    if not account:
        raise HTTPException(status_code=404, detail="Account not found")
    p_result = await db.execute(select(TwitterPost).where(TwitterPost.account_id == account.id).order_by(TwitterPost.published_at.desc()))
    posts = p_result.scalars().all()
    return {"account": account, "posts": posts}

# --- Generic List Endpoints ---

@app.get("/channels")
async def list_channels(channel_type: str = None, ideology: str = None, db: AsyncSession = Depends(get_db)):
    query = select(Channel)
    if channel_type:
        query = query.where(Channel.channel_type == channel_type)
    if ideology:
        query = query.where(Channel.ideology == ideology)
    
    query = query.order_by(Channel.scraped_at.desc())
    result = await db.execute(query)
    return result.scalars().all()

@app.get("/channels/{channel_id}")
async def get_channel_details(channel_id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Channel).where(Channel.channel_id == channel_id))
    channel = result.scalar_one_or_none()
    if not channel:
        raise HTTPException(status_code=404, detail="Channel not found")
    v_result = await db.execute(select(Video).where(Video.channel_db_id == channel.id).order_by(Video.published_at.desc()))
    videos = v_result.scalars().all()
    return {"channel": channel, "videos": videos}

@app.get("/videos/{video_id}")
async def get_video_details(video_id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Video).where(Video.video_id == video_id))
    video = result.scalar_one_or_none()
    if not video:
        raise HTTPException(status_code=404, detail="Video not found")
    
    # Get associated channel info
    c_result = await db.execute(select(Channel).where(Channel.id == video.channel_db_id))
    channel = c_result.scalar_one_or_none()

    # Get associated comments
    cm_result = await db.execute(select(Comment).where(Comment.video_db_id == video.id).order_by(Comment.published_at.desc()))
    comments = cm_result.scalars().all()
    
    return {"video": video, "channel": channel, "comments": comments}

@app.get("/video_list")
async def list_videos(
    channel_type: str = None, 
    ideology: str = None, 
    channel_name: str = None,
    db: AsyncSession = Depends(get_db)
):
    # If no filters provided, maybe return empty? 
    # Frontend logic will control when to call this.
    # We'll allow returning all videos if requested carefully, but let's stick to returning matches.
    
    query = select(Video).join(Channel, Video.channel_db_id == Channel.id)
    
    if channel_type:
        query = query.where(Channel.channel_type.ilike(f"%{channel_type}%"))
    if ideology:
        query = query.where(Channel.ideology.ilike(f"%{ideology}%"))
    if channel_name:
        query = query.where(Channel.name.ilike(f"%{channel_name}%"))
        
    query = query.order_by(Video.published_at.desc())
    
    result = await db.execute(query)
    videos = result.scalars().all()
    return videos

@app.get("/comments")
async def list_all_comments(video_id: str = None, db: AsyncSession = Depends(get_db)):
    # Join Comment with Video to get video title
    stmt = select(Comment, Video.title, Video.video_id).join(Video, Comment.video_db_id == Video.id)
    
    if video_id:
        stmt = stmt.where(Video.video_id == video_id)
        
    stmt = stmt.order_by(Comment.published_at.desc())
    
    if not video_id:
        stmt = stmt.limit(100) # Limit default view if no video selected

    result = await db.execute(stmt)
    comments_with_video = []
    for comment, title, vid in result.all():
        c_dict = comment.__dict__
        if '_sa_instance_state' in c_dict:
            del c_dict['_sa_instance_state']
        c_dict['video_title'] = title
        c_dict['video_id'] = vid
        comments_with_video.append(c_dict)
    return comments_with_video

@app.post("/scrape_replies/{video_id}")
async def scrape_replies(video_id: str, author_name: str = None, author_channel_id: str = None, db: AsyncSession = Depends(get_db)):
    # 1. Fetch info from YouTube
    parent_data, replies_data = fetch_comment_replies(video_id, author_name=author_name, author_channel_id=author_channel_id)
    
    if not parent_data:
        raise HTTPException(status_code=404, detail="Parent comment not found in this video.")
        
    # 2. Ensure Video exists
    result = await db.execute(select(Video).where(Video.video_id == video_id))
    video = result.scalar_one_or_none()
    
    if not video:
        vol_data = fetch_video_details(video_id)
        if not vol_data:
             raise HTTPException(status_code=404, detail="Video details not found.")
        
        c_res = await db.execute(select(Channel).where(Channel.channel_id == vol_data['channel_id']))
        channel = c_res.scalar_one_or_none()
        if not channel:
            channel = Channel(channel_id=vol_data['channel_id'], name="Auto-scraped Channel")
            db.add(channel)
            await db.flush()
            
        video = Video(
            video_id=video_id,
            channel_db_id=channel.id,
            title=vol_data['title'],
            published_at=datetime.strptime(vol_data['published_at'], "%Y-%m-%dT%H:%M:%SZ") if vol_data['published_at'] else None
        )
        db.add(video)
        await db.flush()

    # Ensure parent comment exists
    c_res = await db.execute(select(Comment).where(Comment.comment_id == parent_data['comment_id']))
    parent_comment = c_res.scalar_one_or_none()
    
    if not parent_comment:
        parent_comment = Comment(
            comment_id=parent_data['comment_id'],
            video_db_id=video.id,
            text=parent_data['text'],
            author_name=parent_data['author_name'],
            like_count=parent_data['like_count'],
            published_at=datetime.strptime(parent_data['published_at'], "%Y-%m-%dT%H:%M:%SZ") if parent_data['published_at'] else None
        )
        db.add(parent_comment)
        await db.flush()

    # 3. Add Replies
    added_count = 0
    for r in replies_data:
        r_res = await db.execute(select(CommentReply).where(CommentReply.reply_id == r['reply_id']))
        if not r_res.scalar_one_or_none():
            reply = CommentReply(
                reply_id=r['reply_id'],
                comment_db_id=parent_comment.id,
                text=r['text'],
                author_name=r['author_name'],
                like_count=r['like_count'],
                published_at=datetime.strptime(r['published_at'], "%Y-%m-%dT%H:%M:%SZ") if r['published_at'] else None
            )
            db.add(reply)
            added_count += 1
            
    await db.commit()
    return {"message": f"Successfully scraped {added_count} replies.", "parent_comment": parent_data}

@app.get("/comment_replies")
async def list_comment_replies(video_id: str = None, db: AsyncSession = Depends(get_db)):
    stmt = select(CommentReply, Comment.author_name.label("parent_author"), Video.video_id)\
           .join(Comment, CommentReply.comment_db_id == Comment.id)\
           .join(Video, Comment.video_db_id == Video.id)
           
    if video_id:
        stmt = stmt.where(Video.video_id == video_id)
        
    stmt = stmt.order_by(CommentReply.published_at.desc())
    
    result = await db.execute(stmt)
    replies = []
    for reply, parent_author, vid in result.all():
        r_dict = {}
        for column in reply.__table__.columns:
            r_dict[column.name] = getattr(reply, column.name)
        r_dict['parent_author'] = parent_author
        r_dict['video_id'] = vid
        replies.append(r_dict)
    return replies

# --- Monitoring Endpoints ---

@app.post("/monitoring/channels")
async def add_monitored_channel(data: MonitorCreate, db: AsyncSession = Depends(get_db)):
    channel_info = fetch_channel_info(data.channel_id)
    if not channel_info:
        raise HTTPException(status_code=404, detail="YouTube channel not found")
    result = await db.execute(select(MonitoredChannel).where(MonitoredChannel.channel_id == channel_info["channel_id"]))
    existing = result.scalar_one_or_none()
    if existing:
        existing.comment_text = data.comment_text
        existing.is_active = 1
        if data.channel_type:
            existing.channel_type = data.channel_type
        if data.ideology:
            existing.ideology = data.ideology
    else:
        latest_vid_data = get_latest_video(channel_info["channel_id"])
        latest_vid_id = latest_vid_data['video_id'] if latest_vid_data else None
        
        new_monitor = MonitoredChannel(
            channel_id=channel_info["channel_id"],
            name=channel_info["name"],
            comment_text=data.comment_text,
            last_checked_video_id=latest_vid_id,

            channel_type=data.channel_type,
            ideology=data.ideology
        )
        db.add(new_monitor)
    await db.commit()
    return {"message": "Channel added to monitoring"}

@app.get("/monitoring/channels")
async def list_monitored_channels(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(MonitoredChannel))
    return result.scalars().all()

@app.delete("/monitoring/channels/{id}")
async def remove_monitored_channel(id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(MonitoredChannel).where(MonitoredChannel.id == id))
    channel = result.scalar_one_or_none()
    if channel:
        await db.delete(channel)
        await db.commit()
    return {"message": "Channel removed from monitoring"}

@app.get("/monitoring/logs")
async def get_monitoring_logs(db: AsyncSession = Depends(get_db)):
    # Filter logs created in the last 24 hours
    one_day_ago = datetime.utcnow() - timedelta(hours=24)
    
    result = await db.execute(
        select(MonitorLog, MonitoredChannel.name)
        .join(MonitoredChannel, MonitorLog.monitor_id == MonitoredChannel.id)
        .where(MonitorLog.created_at >= one_day_ago)
        .order_by(desc(MonitorLog.created_at))
    )
    
    logs = []
    rows = result.all() # .all() on execute result gives list of rows
    for row in rows:
        log = row[0]
        channel_name = row[1]
        logs.append({
            "id": log.id,
            "video_id": log.video_id,
            "video_title": log.video_title,
            "channel_name": channel_name,
            "status": log.status,
            "comment_text": log.comment_text,
            "created_at": log.created_at,
            "channel_id": log.channel_id
        })
    return logs

@app.post("/monitoring/toggle")
async def toggle_monitoring():
    global monitoring_active
    monitoring_active = not monitoring_active
    return {"status": "active" if monitoring_active else "inactive"}

@app.get("/monitoring/status")
async def get_monitoring_status():
    global monitoring_active
    return {"status": "active" if monitoring_active else "inactive"}

@app.get("/monitoring/logs")
async def get_monitoring_logs(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(AutomatedCommentReport).order_by(AutomatedCommentReport.created_at.desc()).limit(50))
    return result.scalars().all()

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
