import os
from googleapiclient.discovery import build
from datetime import datetime
from dotenv import load_dotenv

load_dotenv()

# YOUTUBE_API_KEY = os.getenv("YOUTUBE_API_KEY")
YOUTUBE_API_KEY = "AIzaSyAApu9S5i_T7aS5flDg0qHOiBy69VP10LI"

def get_youtube_client():
    if not YOUTUBE_API_KEY:
        raise ValueError("YOUTUBE_API_KEY not found in environment variables")
    return build("youtube", "v3", developerKey=YOUTUBE_API_KEY)

def fetch_channel_info(channel_handle_or_id):
    youtube = get_youtube_client()
    
    channel_id = None
    
    # 1. Resolve to a Channel ID
    if channel_handle_or_id.startswith('UC') and len(channel_handle_or_id) == 24:
        # Looks like a direct Channel ID
        channel_id = channel_handle_or_id
    else:
        # Treat as a handle or search query
        search_query = channel_handle_or_id if channel_handle_or_id.startswith('@') else f"@{channel_handle_or_id}"
        
        search_response = youtube.search().list(
            q=search_query,
            type='channel',
            part='id',
            maxResults=1
        ).execute()
        
        if search_response.get('items'):
            channel_id = search_response['items'][0]['id']['channelId']
        else:
            # Try searching without @ if search failed
            search_response = youtube.search().list(
                q=channel_handle_or_id,
                type='channel',
                part='id',
                maxResults=1
            ).execute()
            if search_response.get('items'):
                channel_id = search_response['items'][0]['id']['channelId']

    if not channel_id:
        return None

    # 2. Get full details using resolved ID
    channel_response = youtube.channels().list(
        part="snippet,statistics,contentDetails,brandingSettings",
        id=channel_id
    ).execute()

    if not channel_response.get('items'):
        return None

    item = channel_response['items'][0]
    snippet = item['snippet']
    stats = item['statistics']
    branding = item.get('brandingSettings', {})
    channel_settings = branding.get('channel', {})
    
    channel_data = {
        "channel_id": item['id'],
        "name": snippet.get('title'),
        "username": snippet.get('customUrl'),
        "description": snippet.get('description'),
        "published_at": snippet.get('publishedAt'),
        "subscriber_count": int(stats.get('subscriberCount', 0)),
        "profile_picture_url": snippet.get('thumbnails', {}).get('high', {}).get('url'),
        "total_views": int(stats.get('viewCount', 0)),
        "total_videos": int(stats.get('videoCount', 0)),
        "custom_url": snippet.get('customUrl'),
        "location": snippet.get('country'),
        "links": channel_settings.get('keywords', ''), # Using keywords as a proxy for 'links' if direct links unavailable
        "upload_playlist_id": item['contentDetails']['relatedPlaylists']['uploads']
    }

    return channel_data

def fetch_recent_videos(upload_playlist_id, limit=10):
    youtube = get_youtube_client()
    
    playlist_items = youtube.playlistItems().list(
        part="snippet,contentDetails",
        playlistId=upload_playlist_id,
        maxResults=limit
    ).execute()

    video_ids = [item['contentDetails']['videoId'] for item in playlist_items.get('items', [])]
    
    if not video_ids:
        return []

    video_details = youtube.videos().list(
        part="snippet,statistics",
        id=",".join(video_ids)
    ).execute()

    videos = []
    for item in video_details.get('items', []):
        snippet = item['snippet']
        stats = item['statistics']
        videos.append({
            "video_id": item['id'],
            "title": snippet.get('title'),
            "description": snippet.get('description'),
            "published_at": snippet.get('publishedAt'),
            "views": int(stats.get('viewCount', 0)),
            "likes": int(stats.get('likeCount', 0)),
            "total_comments": int(stats.get('commentCount', 0))
        })
    
    return videos

def fetch_video_details(video_id):
    youtube = get_youtube_client()
    
    video_response = youtube.videos().list(
        part="snippet,statistics",
        id=video_id
    ).execute()
    
    if not video_response.get('items'):
        return None
        
    item = video_response['items'][0]
    snippet = item['snippet']
    stats = item['statistics']
    
    return {
        "video_id": item['id'],
        "channel_id": snippet.get('channelId'),
        "title": snippet.get('title'),
        "description": snippet.get('description'),
        "published_at": snippet.get('publishedAt'),
        "views": int(stats.get('viewCount', 0)),
        "likes": int(stats.get('likeCount', 0)),
        "total_comments": int(stats.get('commentCount', 0))
    }

def fetch_video_comments(video_id, limit=20):
    youtube = get_youtube_client()
    
    try:
        comments_response = youtube.commentThreads().list(
            part="snippet",
            videoId=video_id,
            maxResults=limit,
            textFormat="plainText"
        ).execute()
    except Exception:
        # Comments might be disabled
        return []

    comments = []
    for item in comments_response.get('items', []):
        snippet = item['snippet']['topLevelComment']['snippet']
        comments.append({
            "comment_id": item['id'],
            "text": snippet.get('textDisplay'),
            "author_name": snippet.get('authorDisplayName'),
            "like_count": snippet.get('likeCount', 0),
            "published_at": snippet.get('publishedAt')
        })
    
    return comments
