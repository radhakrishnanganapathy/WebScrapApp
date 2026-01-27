import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Youtube, Search, ArrowLeft, Users, PlaySquare, Eye, Calendar, Link as LinkIcon, MapPin, AtSign, Bell, Trash2, Power, MessageSquare } from 'lucide-react';

const API_BASE = 'http://localhost:8000';

function App() {
  const [activeTab, setActiveTab] = useState('scraper'); // 'scraper' or 'monitor'
  const [channels, setChannels] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [selectedChannel, setSelectedChannel] = useState(null);
  const [error, setError] = useState(null);
  const [scrapeType, setScrapeType] = useState('channel');

  // Monitoring States
  const [monitoredChannels, setMonitoredChannels] = useState([]);
  const [monitorLogs, setMonitorLogs] = useState([]);
  const [isMonitoring, setIsMonitoring] = useState(false);
  const [newMonitorId, setNewMonitorId] = useState('');
  const [newMonitorComment, setNewMonitorComment] = useState('');

  useEffect(() => {
    fetchChannels();
    fetchMonitoringStatus();
    fetchMonitoredChannels();
    fetchLogs();

    const timer = setInterval(() => {
      if (activeTab === 'monitor') {
        fetchLogs();
      }
    }, 30000);
    return () => clearInterval(timer);
  }, [activeTab]);

  const fetchChannels = async () => {
    try {
      const response = await axios.get(`${API_BASE}/channels`);
      setChannels(response.data);
    } catch (err) {
      console.error("Failed to fetch channels", err);
    }
  };

  const fetchMonitoringStatus = async () => {
    try {
      const resp = await axios.get(`${API_BASE}/monitoring/status`);
      setIsMonitoring(resp.data.status === 'active');
    } catch (err) {
      console.error(err);
    }
  };

  const fetchMonitoredChannels = async () => {
    try {
      const resp = await axios.get(`${API_BASE}/monitoring/channels`);
      setMonitoredChannels(resp.data);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchLogs = async () => {
    try {
      const resp = await axios.get(`${API_BASE}/monitoring/logs`);
      setMonitorLogs(resp.data);
    } catch (err) {
      console.error(err);
    }
  };

  const toggleMonitoring = async () => {
    try {
      const resp = await axios.post(`${API_BASE}/monitoring/toggle`);
      setIsMonitoring(resp.data.status === 'active');
    } catch (err) {
      setError("Failed to toggle monitoring");
    }
  };

  const addMonitor = async (e) => {
    e.preventDefault();
    if (!newMonitorId || !newMonitorComment) return;
    setIsLoading(true);
    try {
      await axios.post(`${API_BASE}/monitoring/channels`, {
        channel_id: newMonitorId,
        comment_text: newMonitorComment
      });
      setNewMonitorId('');
      setNewMonitorComment('');
      fetchMonitoredChannels();
    } catch (err) {
      setError(err.response?.data?.detail || "Failed to add monitor");
    } finally {
      setIsLoading(false);
    }
  };

  const removeMonitor = async (id) => {
    try {
      await axios.delete(`${API_BASE}/monitoring/channels/${id}`);
      fetchMonitoredChannels();
    } catch (err) {
      setError("Failed to remove monitor");
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
      setActiveTab('scraper');
    } catch (err) {
      setError("Failed to load channel details");
    } finally {
      setIsLoading(false);
    }
  };

  const formatNumber = (num) => {
    if (!num) return '0';
    if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
    if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
    return num.toString();
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
        <div className="logo" onClick={() => { setSelectedChannel(null); setActiveTab('scraper'); }} style={{ cursor: 'pointer' }}>
          <Youtube size={32} color="#FF0000" fill="#FF0000" />
          <span>YouTube</span> Scraper
        </div>

        <div className="tab-container">
          <div className={`tab ${activeTab === 'scraper' ? 'active' : ''}`} onClick={() => { setActiveTab('scraper'); setSelectedChannel(null); }}>
            <Search size={18} /> Scraper
          </div>
          <div className={`tab ${activeTab === 'monitor' ? 'active' : ''}`} onClick={() => setActiveTab('monitor')}>
            <Bell size={18} /> Auto Comment
          </div>
        </div>
      </header>

      {activeTab === 'scraper' ? (
        selectedChannel ? (
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
                  className="select-scrape-type"
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
        )
      ) : (
        <div className="fade-in">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
            <h2>Automated Comment Module</h2>
            <button
              onClick={toggleMonitoring}
              style={{
                background: isMonitoring ? '#d32f2f' : '#2e7d32',
                padding: '1rem 2rem'
              }}
            >
              <Power size={20} /> {isMonitoring ? 'STOP MONITORING' : 'START MONITORING'}
            </button>
          </div>

          <div className="grid">
            <div className="monitor-form">
              <h3 style={{ marginBottom: '1.5rem' }}>Add Channel to Monitor</h3>
              <form onSubmit={addMonitor}>
                <div className="form-group">
                  <label>Channel ID or Handle</label>
                  <input
                    type="text"
                    placeholder="@handle or UC..."
                    value={newMonitorId}
                    onChange={(e) => setNewMonitorId(e.target.value)}
                  />
                </div>
                <div className="form-group">
                  <label>Comment Text</label>
                  <textarea
                    style={{
                      width: '100%',
                      background: '#2A2A2A',
                      border: '1px solid var(--border)',
                      borderRadius: 'var(--radius)',
                      color: 'white',
                      padding: '1rem',
                      minHeight: '100px'
                    }}
                    placeholder="Write your automated comment here..."
                    value={newMonitorComment}
                    onChange={(e) => setNewMonitorComment(e.target.value)}
                  />
                </div>
                <button type="submit" disabled={isLoading} style={{ width: '100%', justifyContent: 'center' }}>
                  {isLoading ? <div className="loading-spinner"></div> : <><Bell size={18} /> Monitor Channel</>}
                </button>
              </form>
              {error && <p style={{ color: 'var(--primary)', marginTop: '1rem' }}>{error}</p>}
            </div>

            <div>
              <h3 style={{ marginBottom: '1.5rem' }}>Monitored Channels</h3>
              <div style={{ background: 'var(--bg-secondary)', borderRadius: 'var(--radius)', border: '1px solid var(--border)', maxHeight: '400px', overflowY: 'auto' }}>
                {monitoredChannels.length === 0 && (
                  <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-dim)' }}>
                    No channels monitored yet.
                  </div>
                )}
                {monitoredChannels.map(ch => (
                  <div key={ch.id} className="monitor-list-item">
                    <div>
                      <strong>{ch.name}</strong>
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-dim)' }}>{ch.channel_id}</div>
                    </div>
                    <button onClick={() => removeMonitor(ch.id)} style={{ background: 'none', color: '#d32f2f', padding: '0.5rem' }}>
                      <Trash2 size={18} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <h3 style={{ marginTop: '3rem', marginBottom: '1.5rem' }}>Execution Logs</h3>
          <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
            {monitorLogs.length === 0 && (
              <div className="log-item" style={{ textAlign: 'center', color: 'var(--text-dim)' }}>
                No logs yet. Once a new video is detected, logs will appear here.
              </div>
            )}
            {monitorLogs.map(log => (
              <div key={log.id} className="log-item fade-in">
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                  <div style={{ fontWeight: 700 }}>Video ID: {log.video_id}</div>
                  <span className={`status-badge status-${log.status}`}>
                    {log.status === 'pending' ? 'ACTION REQUIRED' : log.status}
                  </span>
                </div>
                <div style={{ color: 'var(--text-dim)', fontSize: '0.9rem', marginBottom: '1rem' }}>
                  <MessageSquare size={14} style={{ verticalAlign: 'middle', marginRight: '5px' }} />
                  "{log.comment_text}"
                </div>

                {log.status === 'pending' && (
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(log.comment_text);
                      window.open(`https://www.youtube.com/watch?v=${log.video_id}`, '_blank');
                      alert("Comment copied to clipboard! Just paste and click send on YouTube.");
                    }}
                    style={{
                      width: '100%',
                      background: 'var(--accent)',
                      color: 'white',
                      fontSize: '0.8rem',
                      padding: '0.6rem'
                    }}
                  >
                    <LinkIcon size={14} /> COPY & OPEN VIDEO
                  </button>
                )}

                <div style={{ fontSize: '0.75rem', color: '#666', marginTop: '1rem' }}>
                  Channel: {log.channel_id} • {new Date(log.created_at).toLocaleString()}
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
