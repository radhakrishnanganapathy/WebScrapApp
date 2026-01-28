import os
import tweepy
import re
from datetime import datetime
from dotenv import load_dotenv

load_dotenv()

# Twitter API Credentials
API_KEY = os.getenv("TWITTER_API_KEY")
API_SECRET = os.getenv("TWITTER_API_SECRET")
BEARER_TOKEN = os.getenv("TWITTER_BEARER_TOKEN")
ACCESS_TOKEN = os.getenv("TWITTER_ACCESS_TOKEN")
ACCESS_TOKEN_SECRET = os.getenv("TWITTER_ACCESS_TOKEN_SECRET")

def get_twitter_client():
    """Get Tweepy client for Twitter API v2."""
    return tweepy.Client(
        bearer_token=BEARER_TOKEN,
        consumer_key=API_KEY,
        consumer_secret=API_SECRET,
        access_token=ACCESS_TOKEN,
        access_token_secret=ACCESS_TOKEN_SECRET,
        wait_on_rate_limit=True
    )

def extract_tweet_id(url_or_id):
    """Extract numeric tweet ID from a URL or return the ID if already numeric."""
    if url_or_id.isdigit():
        return url_or_id
    match = re.search(r'status/(\d+)', url_or_id)
    if match:
        return match.group(1)
    return url_or_id

def fetch_twitter_user(username):
    """Fetch profile info for a Twitter user using official API."""
    client = get_twitter_client()
    try:
        # Remove @ if present
        uname = username.replace('@', '')
        response = client.get_user(username=uname, user_fields=['description', 'profile_image_url', 'public_metrics', 'location'])
        user = response.data
        if not user:
            return None
            
        return {
            "username": user.username,
            "display_name": user.name,
            "description": user.description,
            "profile_image_url": user.profile_image_url,
            "follower_count": user.public_metrics.get("followers_count", 0),
            "location": user.location
        }
    except Exception as e:
        print(f"Twitter API User Error: {e}")
        return None

def fetch_tweet_details(tweet_id_input):
    """Fetch a single tweet details using official API."""
    tweet_id = extract_tweet_id(tweet_id_input)
    client = get_twitter_client()
    try:
        response = client.get_tweet(
            id=tweet_id, 
            tweet_fields=['created_at', 'public_metrics', 'text', 'author_id'],
            expansions=['author_id']
        )
        tweet = response.data
        if not tweet:
            return None
            
        # Get username from expansions
        username = "unknown"
        if response.includes and 'users' in response.includes:
            user = response.includes['users'][0]
            username = user.username

        return {
            "post_id": str(tweet.id),
            "username": username,
            "text": tweet.text,
            "like_count": tweet.public_metrics.get('like_count', 0),
            "retweet_count": tweet.public_metrics.get('retweet_count', 0),
            "reply_count": tweet.public_metrics.get('reply_count', 0),
            "published_at": tweet.created_at.isoformat() if tweet.created_at else None,
        }
    except Exception as e:
        print(f"Twitter API Tweet Error: {e}")
        return None

def fetch_tweet_replies(tweet_id_input, username=None, limit=20):
    """Fetch replies to a specific tweet using Search API (requires Basic or Pro tier)."""
    tweet_id = extract_tweet_id(tweet_id_input)
    client = get_twitter_client()
    try:
        # Query for replies to a specific tweet ID
        query = f"conversation_id:{tweet_id}"
        response = client.search_recent_tweets(
            query=query,
            tweet_fields=['author_id', 'created_at', 'public_metrics', 'text'],
            expansions=['author_id'],
            max_results=min(limit, 100)
        )
        
        replies = []
        if not response.data:
            return []
            
        # Map user IDs to usernames from expansions
        user_map = {}
        if response.includes and 'users' in response.includes:
            for u in response.includes['users']:
                user_map[u.id] = {"username": u.username, "name": u.name}

        for t in response.data:
            user_info = user_map.get(t.author_id, {"username": "unknown", "name": "Unknown"})
            replies.append({
                "reply_id": str(t.id),
                "author_username": user_info["username"],
                "author_display_name": user_info["name"],
                "text": t.text,
                "like_count": t.public_metrics.get('like_count', 0),
                "published_at": t.created_at.isoformat() if t.created_at else None
            })
                
        return replies
    except Exception as e:
        print(f"Twitter API Replies Error: {e}")
        # If search fails (e.g. Free tier), return empty
        return []
