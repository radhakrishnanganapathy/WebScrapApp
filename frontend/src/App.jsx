import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Youtube, Search, ArrowLeft, Users, PlaySquare, Eye, Calendar, Link as LinkIcon, MapPin, AtSign } from 'lucide-react';

const API_BASE = 'http://localhost:8000';

function App() {
  const [channels, setChannels] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [selectedChannel, setSelectedChannel] = useState(null);
  const [error, setError] = useState(null);
  const [scrapeType, setScrapeType] = useState('channel');

  useEffect(() => {
    fetchChannels();
  }, []);

  const fetchChannels = async () => {
    try {
      const response = await axios.get(`${API_BASE}/channels`);
      setChannels(response.data);
    } catch (err) {
      console.error("Failed to fetch channels", err);
    }
  };

  const handleScrape = async (e) => {
    e.preventDefault();
    if (!searchQuery) return;

    setIsLoading(true);
    setError(null);
    try {
      await axios.post(`${API_BASE}/scrape/${searchQuery}?type=${scrapeType}`);
      setSearchQuery('');
      await fetchChannels();
    } catch (err) {
      setError(err.response?.data?.detail || `Failed to scrape ${scrapeType}`);
    } finally {
      setIsLoading(false);
    }
  };

  const showDetails = async (channelId) => {
    setIsLoading(true);
    try {
      const response = await axios.get(`${API_BASE}/channels/${channelId}`);
      setSelectedChannel(response.data);
    } catch (err) {
      setError("Failed to load channel details");
    } finally {
      setIsLoading(false);
    }
  };

  const formatNumber = (num) => {
    if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
    if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
    return num;
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return 'N/A';
    return new Date(dateStr).toLocaleDateString('en-US', {
      year: 'numeric', month: 'long', day: 'numeric'
    });
  };

  const getPlaceholder = () => {
    if (scrapeType === 'channel') return "Enter Channel ID or Handle (e.g. @MrBeast or UC...)";
    if (scrapeType === 'video') return "Enter Video ID (e.g. dQw4w9WgXcQ)";
    if (scrapeType === 'comment') return "Enter Video ID to scrape comments";
    return "";
  };

  return (
    <div className="container">
      <header>
        <div className="logo" onClick={() => setSelectedChannel(null)} style={{ cursor: 'pointer' }}>
          <Youtube size={32} color="#FF0000" fill="#FF0000" />
          <span>YouTube</span> Scraper
        </div>
      </header>

      {selectedChannel ? (
        <div className="fade-in">
          <button onClick={() => setSelectedChannel(null)} style={{ background: 'none', border: '1px solid var(--border)', marginBottom: '1.5rem' }}>
            <ArrowLeft size={18} /> Back
          </button>

          <div className="channel-profile">
            <img src={selectedChannel.channel.profile_picture_url} alt="" className="channel-dp" />
            <div className="channel-meta">
              <h1>{selectedChannel.channel.name}</h1>
              <div className="card-stats" style={{ fontSize: '1rem', marginBottom: '1rem' }}>
                <span><AtSign size={14} style={{ verticalAlign: 'middle' }} /> {selectedChannel.channel.username || selectedChannel.channel.channel_id}</span>
                <span><Users size={14} style={{ verticalAlign: 'middle' }} /> {formatNumber(selectedChannel.channel.subscriber_count)} subscribers</span>
              </div>
              <p className="text-dim" style={{ maxWidth: '600px' }}>{selectedChannel.channel.description}</p>

              <div style={{ display: 'flex', gap: '1rem', marginTop: '1.5rem', flexWrap: 'wrap' }}>
                <div className="tag"><MapPin size={12} /> {selectedChannel.channel.location || 'Unknown'}</div>
                <div className="tag"><Calendar size={12} /> Joined {formatDate(selectedChannel.channel.published_at)}</div>
                <div className="tag"><Eye size={12} /> {formatNumber(selectedChannel.channel.total_views)} total views</div>
                <div className="tag"><PlaySquare size={12} /> {selectedChannel.channel.total_videos} videos</div>
              </div>
            </div>
          </div>

          <h3 style={{ marginBottom: '1.5rem', borderBottom: '1px solid var(--border)', paddingBottom: '0.5rem' }}>Recent Videos</h3>
          <div className="grid">
            {selectedChannel.videos.map(video => (
              <div key={video.video_id} className="card">
                <div className="card-content">
                  <div className="card-title">{video.title}</div>
                  <div className="card-stats">
                    <span>{formatNumber(video.views)} views</span>
                    <span>•</span>
                    <span>{formatDate(video.published_at)}</span>
                  </div>
                  <div className="card-stats" style={{ marginTop: '0.5rem' }}>
                    <span>{formatNumber(video.likes)} likes</span>
                    <span>{video.total_comments} comments</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="fade-in">

          <div className="search-section">
            <h2 style={{ marginBottom: '1rem' }}>
              Scrape New {scrapeType.charAt(0).toUpperCase() + scrapeType.slice(1)}
            </h2>

            <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
              <select
                value={scrapeType}
                onChange={(e) => setScrapeType(e.target.value)}
                style={{
                  padding: '0.8rem',
                  background: 'var(--card-bg)',
                  color: 'var(--text-main)',
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--radius)',
                  outline: 'none',
                  cursor: 'pointer'
                }}
              >
                <option value="channel">Channel</option>
                <option value="video">Video</option>
                <option value="comment">Comments</option>
              </select>
            </div>

            <form className="search-form" onSubmit={handleScrape}>
              <input
                type="text"
                placeholder={getPlaceholder()}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              <button type="submit" disabled={isLoading}>
                {isLoading ? <div className="loading-spinner"></div> : <><Search size={18} /> Scrape</>}
              </button>
            </form>
            {error && <p style={{ color: 'var(--primary)', marginTop: '1rem', fontSize: '0.9rem' }}>{error}</p>}
          </div>

          <h3 style={{ marginBottom: '1.5rem' }}>Scraped Channels</h3>
          {channels.length === 0 && !isLoading && (
            <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-dim)', border: '2px dashed var(--border)', borderRadius: 'var(--radius)' }}>
              No channels scraped yet. Start by searching above!
            </div>
          )}
          <div className="grid">
            {channels.map(channel => (
              <div key={channel.id} className="card" onClick={() => showDetails(channel.channel_id)}>
                <img src={channel.profile_picture_url} className="card-img" style={{ aspectRatio: '1', height: '180px', objectFit: 'cover', width: '100%' }} />
                <div className="card-content">
                  <div className="card-title">{channel.name}</div>
                  <div className="card-stats">
                    <Users size={14} /> {formatNumber(channel.subscriber_count)}
                    <PlaySquare size={14} /> {channel.total_videos}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)', marginTop: '0.8rem' }}>
                    Last scraped: {new Date(channel.scraped_at).toLocaleString()}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
