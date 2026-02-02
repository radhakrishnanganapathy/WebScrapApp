from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Text, JSON
from sqlalchemy.orm import relationship
from datetime import datetime
from database import Base

class Channel(Base):
    __tablename__ = "channels"

    id = Column(Integer, primary_key=True, index=True)
    channel_id = Column(String, unique=True, index=True)
    name = Column(String)
    description = Column(Text)
    published_at = Column(DateTime)
    last_video_uploaded_at = Column(DateTime)
    subscriber_count = Column(Integer)
    profile_picture_url = Column(String)
    total_views = Column(Integer)
    total_videos = Column(Integer)
    links = Column(JSON) # Store social links or related links as JSON
    location = Column(String)
    username = Column(String)
    custom_url = Column(String)
    channel_type = Column(String, nullable=True) # e.g., news, entertainment, tech
    ideology = Column(String, nullable=True)     # e.g., admk, dmk, bjp, leftist, neutral
    scraped_at = Column(DateTime, default=datetime.utcnow)

    videos = relationship("Video", back_populates="channel", cascade="all, delete-orphan")

class Video(Base):
    __tablename__ = "videos"

    id = Column(Integer, primary_key=True, index=True)
    video_id = Column(String, unique=True, index=True)
    channel_db_id = Column(Integer, ForeignKey("channels.id"))
    title = Column(String)
    description = Column(Text)
    likes = Column(Integer)
    views = Column(Integer)
    total_comments = Column(Integer)
    published_at = Column(DateTime)
    scraped_at = Column(DateTime, default=datetime.utcnow)

    channel = relationship("Channel", back_populates="videos")
    comments = relationship("Comment", back_populates="video", cascade="all, delete-orphan")

class Comment(Base):
    __tablename__ = "comments"

    id = Column(Integer, primary_key=True, index=True)
    comment_id = Column(String, unique=True, index=True)
    video_db_id = Column(Integer, ForeignKey("videos.id"))
    text = Column(Text)
    author_name = Column(String)
    like_count = Column(Integer)
    published_at = Column(DateTime)
    scraped_at = Column(DateTime, default=datetime.utcnow)

    video = relationship("Video", back_populates="comments")

class MonitoredChannel(Base):
    __tablename__ = "monitored_channels"

    id = Column(Integer, primary_key=True, index=True)
    channel_id = Column(String, index=True)
    name = Column(String)
    comment_text = Column(Text)
    is_active = Column(Integer, default=1) # 1 for active, 0 for inactive
    last_checked_video_id = Column(String)
    channel_type = Column(String, nullable=True)
    ideology = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

class MonitorLog(Base):
    __tablename__ = "monitor_logs"

    id = Column(Integer, primary_key=True, index=True)
    monitor_id = Column(Integer, ForeignKey("monitored_channels.id", ondelete="CASCADE"))
    video_id = Column(String)
    video_title = Column(String, nullable=True)
    status = Column(String) # "pending", "success", "failed"
    comment_text = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)
    channel_id = Column(String)

    monitor = relationship("MonitoredChannel")

# --- Twitter (X) Models ---

class TwitterAccount(Base):
    __tablename__ = "twitter_accounts"
    
    id = Column(Integer, primary_key=True, index=True)
    username = Column(String, unique=True, index=True)
    display_name = Column(String)
    description = Column(Text)
    profile_image_url = Column(String)
    follower_count = Column(Integer)
    location = Column(String)
    scraped_at = Column(DateTime, default=datetime.utcnow)
    
    posts = relationship("TwitterPost", back_populates="account", cascade="all, delete-orphan")

class TwitterPost(Base):
    __tablename__ = "twitter_posts"
    
    id = Column(Integer, primary_key=True, index=True)
    post_id = Column(String, unique=True, index=True)
    account_id = Column(Integer, ForeignKey("twitter_accounts.id"))
    text = Column(Text)
    view_count = Column(Integer, default=0)
    like_count = Column(Integer, default=0)
    retweet_count = Column(Integer, default=0)
    reply_count = Column(Integer, default=0)
    published_at = Column(DateTime)
    scraped_at = Column(DateTime, default=datetime.utcnow)
    
    account = relationship("TwitterAccount", back_populates="posts")
    replies = relationship("TwitterReply", back_populates="post", cascade="all, delete-orphan")

class TwitterReply(Base):
    __tablename__ = "twitter_replies"
    
    id = Column(Integer, primary_key=True, index=True)
    reply_id = Column(String, unique=True, index=True)
    post_db_id = Column(Integer, ForeignKey("twitter_posts.id"))
    text = Column(Text)
    author_username = Column(String)
    author_display_name = Column(String)
    like_count = Column(Integer, default=0)
    published_at = Column(DateTime)
    scraped_at = Column(DateTime, default=datetime.utcnow)
    
    post = relationship("TwitterPost", back_populates="replies")
