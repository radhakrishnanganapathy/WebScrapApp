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
