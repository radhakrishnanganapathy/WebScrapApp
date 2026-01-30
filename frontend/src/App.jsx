import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Youtube, Twitter, Search, ArrowLeft, Users, PlaySquare, Eye, Calendar, Link as LinkIcon, MapPin, AtSign, Bell, Trash2, Power, MessageSquare, Filter } from 'lucide-react';

const API_BASE = 'http://localhost:8000';

function App() {
  const [activeTab, setActiveTab] = useState('scraper'); // 'scraper' or 'monitor'
  const [channels, setChannels] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [selectedChannel, setSelectedChannel] = useState(null);
  const [selectedVideo, setSelectedVideo] = useState(null);
  const [error, setError] = useState(null);
  const [scrapeType, setScrapeType] = useState('channel');
  const [platform, setPlatform] = useState('youtube'); // 'youtube' or 'twitter'
  const [twitterAccounts, setTwitterAccounts] = useState([]);
  const [selectedTwitterAccount, setSelectedTwitterAccount] = useState(null);
  const [channelType, setChannelType] = useState('');
  const [ideology, setIdeology] = useState('');

  // Monitoring States
  const [monitoredChannels, setMonitoredChannels] = useState([]);
  const [monitorLogs, setMonitorLogs] = useState([]);
  const [isMonitoring, setIsMonitoring] = useState(false);
  const [newMonitorId, setNewMonitorId] = useState('');
  const [newMonitorComment, setNewMonitorComment] = useState('');

  // Channel List Filter States
  const [filterType, setFilterType] = useState('');
  const [filterIdeology, setFilterIdeology] = useState('');

  // All Comments State
  const [commentsList, setCommentsList] = useState([]);

  useEffect(() => {
    if (activeTab === 'channels') {
      fetchChannels(filterType, filterIdeology);
    } else {
      fetchChannels();
    }
    fetchTwitterAccounts();
    fetchMonitoringStatus();
    fetchMonitoredChannels();
    fetchLogs();

    if (activeTab === 'comments') {
      fetchCommentsList();
    }

    const timer = setInterval(() => {
      if (activeTab === 'monitor') {
        fetchLogs();
      }
    }, 30000);
    return () => clearInterval(timer);
  }, [activeTab]);

  useEffect(() => {
    if (activeTab === 'channels') {
      fetchChannels(filterType, filterIdeology);
    }
  }, [filterType, filterIdeology]);

  const fetchChannels = async (cType = '', ideo = '') => {
    try {
      let url = `${API_BASE}/channels`;
      const params = [];
      if (cType) params.push(`channel_type=${encodeURIComponent(cType)}`);
      if (ideo) params.push(`ideology=${encodeURIComponent(ideo)}`);
      if (params.length > 0) url += `?${params.join('&')}`;

      const response = await axios.get(url);
      setChannels(response.data);
    } catch (err) {
      console.error("Failed to fetch channels", err);
    }
  };

  const fetchTwitterAccounts = async () => {
    try {
      const response = await axios.get(`${API_BASE}/twitter/accounts`);
      setTwitterAccounts(response.data);
    } catch (err) {
      console.error("Failed to fetch twitter accounts", err);
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

  const fetchCommentsList = async () => {
    try {
      const resp = await axios.get(`${API_BASE}/comments`);
      setCommentsList(resp.data);
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
        comment_text: newMonitorComment,
        channel_type: channelType,
        ideology: ideology
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
      if (platform === 'youtube') {
        let url = `${API_BASE}/scrape/${searchQuery}?type=${scrapeType}`;
        if (channelType) url += `&channel_type=${encodeURIComponent(channelType)}`;
        if (ideology) url += `&ideology=${encodeURIComponent(ideology)}`;
        await axios.post(url);
        await fetchChannels();
      } else {
        // Twitter mapping
        let type = scrapeType;
        if (type === 'channel') type = 'user';
        if (type === 'video') type = 'post';
        if (type === 'comment') type = 'reply';

        await axios.post(`${API_BASE}/scrape_twitter/${searchQuery}?type=${type}`);
        await fetchTwitterAccounts();
      }
      setSearchQuery('');
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
      setSelectedTwitterAccount(null);
      setActiveTab('scraper');
    } catch (err) {
      setError("Failed to load channel details");
    } finally {
      setIsLoading(false);
    }
  };

  const showTwitterDetails = async (username) => {
    setIsLoading(true);
    try {
      const response = await axios.get(`${API_BASE}/twitter/accounts/${username}`);
      setSelectedTwitterAccount(response.data);
      setSelectedChannel(null);
      setActiveTab('scraper');
    } catch (err) {
      setError("Failed to load twitter details");
    } finally {
      setIsLoading(false);
    }
  };

  const showVideoDetails = async (videoId) => {
    setIsLoading(true);
    try {
      const response = await axios.get(`${API_BASE}/videos/${videoId}`);
      setSelectedVideo(response.data);
      // We keep selectedChannel as is if we came from there, otherwise it might be null
      setActiveTab('scraper');
    } catch (err) {
      setError("Failed to load video details");
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
    if (platform === 'youtube') {
      if (scrapeType === 'channel') return "Enter YouTube Channel ID or Handle (e.g. @MrBeast)";
      if (scrapeType === 'video') return "Enter YouTube Video ID (e.g. dQw4w9WgXcQ)";
      if (scrapeType === 'comment') return "Enter Video ID to scrape comments";
    } else {
      if (scrapeType === 'channel') return "Enter Twitter Username (e.g. elonmusk)";
      if (scrapeType === 'video') return "Enter Tweet ID (e.g. 123456789)";
      if (scrapeType === 'comment') return "Enter Tweet ID to scrape replies";
    }
    return "";
  };

  return (
    <div className="container">
      <header>
        <div className="logo" onClick={() => { setSelectedChannel(null); setSelectedTwitterAccount(null); setActiveTab('scraper'); }} style={{ cursor: 'pointer' }}>
          {platform === 'youtube' ? (
            <Youtube size={32} color="#FF0000" fill="#FF0000" />
          ) : (
            <Twitter size={32} color="#1DA1F2" fill="#1DA1F2" />
          )}
          <span>Scrap</span> App
        </div>

        <div className="tab-container">
          <div className={`tab ${activeTab === 'scraper' ? 'active' : ''}`} onClick={() => { setActiveTab('scraper'); setSelectedChannel(null); setSelectedTwitterAccount(null); setSelectedVideo(null); }}>
            <Search size={18} /> Scraper
          </div>
          <div className={`tab ${activeTab === 'monitor' ? 'active' : ''}`} onClick={() => setActiveTab('monitor')}>
            <Bell size={18} /> Auto Comment
          </div>
          <div className={`tab ${activeTab === 'channels' ? 'active' : ''}`} onClick={() => setActiveTab('channels')}>
            <Filter size={18} /> Channel List
          </div>
          <div className={`tab ${activeTab === 'comments' ? 'active' : ''}`} onClick={() => setActiveTab('comments')}>
            <MessageSquare size={18} /> All Comments
          </div>
        </div>
      </header>

      <div className="platform-toggle" style={{ display: 'flex', gap: '1rem', marginBottom: '2rem' }}>
        <button
          onClick={() => { setPlatform('youtube'); setScrapeType('channel'); }}
          style={{ flex: 1, background: platform === 'youtube' ? 'var(--primary)' : 'var(--bg-secondary)', border: platform === 'youtube' ? 'none' : '1px solid var(--border)' }}
        >
          YOUTUBE
        </button>
        <button
          onClick={() => { setPlatform('twitter'); setScrapeType('channel'); }}
          style={{ flex: 1, background: platform === 'twitter' ? 'var(--accent)' : 'var(--bg-secondary)', border: platform === 'twitter' ? 'none' : '1px solid var(--border)' }}
        >
          TWITTER (X)
        </button>
      </div>

      {activeTab === 'scraper' && (
        selectedVideo ? (
          <div className="fade-in">
            <button
              onClick={() => setSelectedVideo(null)}
              style={{ background: 'none', border: '1px solid var(--border)', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}
            >
              <ArrowLeft size={18} /> Back
            </button>

            <div className="channel-profile" style={{ marginBottom: '2rem' }}>
              <div className="channel-meta" style={{ width: '100%' }}>
                <h1 style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>{selectedVideo.video.title}</h1>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', borderBottom: '1px solid var(--border)', paddingBottom: '1rem', marginBottom: '1rem' }}>
                  <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                    <span className="text-dim" style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}><Calendar size={14} /> {formatDate(selectedVideo.video.published_at)}</span>
                    <span className="text-dim" style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}><Eye size={14} /> {formatNumber(selectedVideo.video.views)} views</span>
                  </div>
                  <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', color: '#4CAF50' }}><Users size={14} /> {selectedVideo.video.likes} Likes</span>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}><MessageSquare size={14} /> {selectedVideo.video.total_comments} Comments</span>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.5rem' }}>
                  {selectedVideo.channel && (
                    <>
                      <img src={selectedVideo.channel.profile_picture_url} style={{ width: '40px', height: '40px', borderRadius: '50%' }} alt="" />
                      <div>
                        <div style={{ fontWeight: 'bold' }}>{selectedVideo.channel.name}</div>
                        <div className="text-dim" style={{ fontSize: '0.8rem' }}>Channel</div>
                      </div>
                    </>
                  )}
                </div>

                <div style={{ background: 'var(--bg-secondary)', padding: '1rem', borderRadius: 'var(--radius)', fontSize: '0.9rem', color: 'var(--text-dim)', marginBottom: '2rem', whiteSpace: 'pre-wrap' }}>
                  {selectedVideo.video.description}
                </div>
              </div>
            </div>

            <h3 style={{ marginBottom: '1.5rem' }}>Comments ({selectedVideo.comments.length})</h3>
            {selectedVideo.comments.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-dim)', border: '1px dashed var(--border)' }}>No comments scraped for this video yet.</div>
            ) : (
              <div className="grid" style={{ gridTemplateColumns: '1fr' }}>
                {selectedVideo.comments.map(comment => (
                  <div key={comment.id} className="card" style={{ cursor: 'default' }}>
                    <div className="card-content">
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                        <div style={{ fontWeight: 600, color: 'var(--primary)' }}>{comment.author_name}</div>
                        <div style={{ fontSize: '0.8rem', color: 'var(--text-dim)' }}>{formatDate(comment.published_at)}</div>
                      </div>
                      <div style={{ margin: '0.5rem 0' }}>{comment.text}</div>
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-dim)', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                        <Users size={12} /> {comment.like_count} likes
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : selectedChannel ? (
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
                  {selectedChannel.channel.channel_type && (
                    <div className="tag" style={{ background: 'var(--accent)', color: 'white' }}>{selectedChannel.channel.channel_type}</div>
                  )}
                  {selectedChannel.channel.ideology && (
                    <div className="tag" style={{ background: '#4CAF50', color: 'white' }}>{selectedChannel.channel.ideology}</div>
                  )}
                </div>
              </div>
            </div>

            <h3 style={{ marginBottom: '1.5rem', borderBottom: '1px solid var(--border)', paddingBottom: '0.5rem' }}>Recent Videos</h3>
            <div className="grid">
              {selectedChannel.videos.map(video => (
                <div key={video.video_id} className="card" onClick={() => showVideoDetails(video.video_id)}>
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
        ) : selectedTwitterAccount ? (
          <div className="fade-in">
            <button onClick={() => setSelectedTwitterAccount(null)} style={{ background: 'none', border: '1px solid var(--border)', marginBottom: '1.5rem' }}>
              <ArrowLeft size={18} /> Back
            </button>

            <div className="channel-profile">
              <img src={selectedTwitterAccount.account.profile_image_url} alt="" className="channel-dp" />
              <div className="channel-meta">
                <h1>{selectedTwitterAccount.account.display_name}</h1>
                <div className="card-stats" style={{ fontSize: '1rem', marginBottom: '1rem' }}>
                  <span><AtSign size={14} style={{ verticalAlign: 'middle' }} /> @{selectedTwitterAccount.account.username}</span>
                  <span><Users size={14} style={{ verticalAlign: 'middle' }} /> {formatNumber(selectedTwitterAccount.account.follower_count)} followers</span>
                </div>
                <p className="text-dim" style={{ maxWidth: '600px' }}>{selectedTwitterAccount.account.description}</p>

                <div style={{ display: 'flex', gap: '1rem', marginTop: '1.5rem', flexWrap: 'wrap' }}>
                  <div className="tag"><MapPin size={12} /> {selectedTwitterAccount.account.location || 'Cyber Space'}</div>
                  <div className="tag"><LinkIcon size={12} /> Scraped {new Date(selectedTwitterAccount.account.scraped_at).toLocaleDateString()}</div>
                </div>
              </div>
            </div>

            <h3 style={{ marginBottom: '1.5rem', borderBottom: '1px solid var(--border)', paddingBottom: '0.5rem' }}>Recent Posts</h3>
            <div className="grid">
              {selectedTwitterAccount.posts.map(post => (
                <div key={post.post_id} className="card">
                  <div className="card-content">
                    <div className="card-title" style={{ fontSize: '1rem', fontWeight: 400 }}>{post.text}</div>
                    <div className="card-stats" style={{ marginTop: '1rem' }}>
                      <span>{post.like_count} likes</span>
                      <span>{post.retweet_count} retweets</span>
                      <span>{post.reply_count} replies</span>
                    </div>
                    <div style={{ fontSize: '0.75rem', color: '#666', marginTop: '0.5rem' }}>
                      Posted: {formatDate(post.published_at)}
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
                Scrape {platform === 'youtube' ? 'YouTube' : 'Twitter'} {scrapeType.charAt(0).toUpperCase() + scrapeType.slice(1)}
              </h2>

              <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
                <select
                  value={scrapeType}
                  onChange={(e) => setScrapeType(e.target.value)}
                  className="select-scrape-type"
                >
                  <option value="channel">{platform === 'youtube' ? 'Channel' : 'User'}</option>
                  <option value="video">{platform === 'youtube' ? 'Video' : 'Post'}</option>
                  <option value="comment">{platform === 'youtube' ? 'Comments' : 'Replies'}</option>
                </select>
              </div>

              <form className="search-form" onSubmit={handleScrape}>
                <input
                  type="text"
                  placeholder={getPlaceholder()}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
                <button type="submit" disabled={isLoading} style={{ background: platform === 'youtube' ? 'var(--primary)' : 'var(--accent)' }}>
                  {isLoading ? <div className="loading-spinner"></div> : <><Search size={18} /> Scrape</>}
                </button>
              </form>

              {scrapeType === 'channel' && platform === 'youtube' && (
                <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem' }}>
                  <div style={{ flex: 1 }}>
                    <label style={{ fontSize: '0.8rem', display: 'block', marginBottom: '0.3rem', color: 'var(--text-dim)' }}>Channel Type (Optional)</label>
                    <input
                      list="channel-types"
                      value={channelType}
                      onChange={(e) => setChannelType(e.target.value)}
                      placeholder="Select or enter type..."
                      style={{ width: '100%', background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', color: 'white', padding: '0.6rem' }}
                    />
                  </div>
                  <div style={{ flex: 1 }}>
                    <label style={{ fontSize: '0.8rem', display: 'block', marginBottom: '0.3rem', color: 'var(--text-dim)' }}>Ideology (Optional)</label>
                    <input
                      list="ideologies"
                      value={ideology}
                      onChange={(e) => setIdeology(e.target.value)}
                      placeholder="Select or enter ideology..."
                      style={{ width: '100%', background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', color: 'white', padding: '0.6rem' }}
                    />
                  </div>
                </div>
              )}
              {error && <p style={{ color: 'var(--primary)', marginTop: '1rem', fontSize: '0.9rem' }}>{error}</p>}
            </div>

            <h3 style={{ marginBottom: '1.5rem' }}>Scraped {platform === 'youtube' ? 'YouTube Channels' : 'Twitter Accounts'}</h3>

            {platform === 'youtube' ? (
              <>
                {channels.length === 0 && !isLoading && (
                  <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-dim)', border: '2px dashed var(--border)', borderRadius: 'var(--radius)' }}>
                    No channels scraped yet.
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
                        <div style={{ display: 'flex', gap: '0.4rem', marginTop: '0.5rem', flexWrap: 'wrap' }}>
                          {channel.channel_type && <span style={{ fontSize: '0.65rem', background: 'var(--accent)', padding: '1px 4px', borderRadius: '3px' }}>{channel.channel_type}</span>}
                          {channel.ideology && <span style={{ fontSize: '0.65rem', background: '#4CAF50', padding: '1px 4px', borderRadius: '3px' }}>{channel.ideology}</span>}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <>
                {twitterAccounts.length === 0 && !isLoading && (
                  <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-dim)', border: '2px dashed var(--border)', borderRadius: 'var(--radius)' }}>
                    No Twitter accounts scraped yet.
                  </div>
                )}
                <div className="grid">
                  {twitterAccounts.map(acc => (
                    <div key={acc.id} className="card" onClick={() => showTwitterDetails(acc.username)}>
                      <img src={acc.profile_image_url} className="card-img" style={{ aspectRatio: '1', height: '180px', objectFit: 'cover', width: '100%' }} />
                      <div className="card-content">
                        <div className="card-title">{acc.display_name}</div>
                        <div className="card-stats">
                          <AtSign size={14} /> @{acc.username}
                          <Users size={14} /> {formatNumber(acc.follower_count)}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        )
      )}

      {activeTab === 'monitor' && (
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
                  />
                </div>
                <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem' }}>
                  <div style={{ flex: 1 }}>
                    <label style={{ fontSize: '0.8rem', display: 'block', marginBottom: '0.3rem', color: 'var(--text-dim)' }}>Channel Type</label>
                    <input
                      list="channel-types"
                      value={channelType}
                      onChange={(e) => setChannelType(e.target.value)}
                      placeholder="Select or enter type..."
                      style={{ width: '100%', background: '#2A2A2A', border: '1px solid var(--border)', borderRadius: 'var(--radius)', color: 'white', padding: '0.6rem' }}
                    />
                  </div>
                  <div style={{ flex: 1 }}>
                    <label style={{ fontSize: '0.8rem', display: 'block', marginBottom: '0.3rem', color: 'var(--text-dim)' }}>Ideology</label>
                    <input
                      list="ideologies"
                      value={ideology}
                      onChange={(e) => setIdeology(e.target.value)}
                      placeholder="Select or enter ideology..."
                      style={{ width: '100%', background: '#2A2A2A', border: '1px solid var(--border)', borderRadius: 'var(--radius)', color: 'white', padding: '0.6rem' }}
                    />
                  </div>
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
                      <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.3rem' }}>
                        {ch.channel_type && <span style={{ fontSize: '0.7rem', background: 'var(--accent)', padding: '1px 5px', borderRadius: '3px' }}>{ch.channel_type}</span>}
                        {ch.ideology && <span style={{ fontSize: '0.7rem', background: '#4CAF50', padding: '1px 5px', borderRadius: '3px' }}>{ch.ideology}</span>}
                      </div>
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

      {activeTab === 'channels' && (
        <div className="fade-in">
          <h2 style={{ marginBottom: '1.5rem' }}>Filtered Channel List</h2>
          <div style={{ display: 'flex', gap: '1rem', marginBottom: '2rem', background: 'var(--bg-secondary)', padding: '1.5rem', borderRadius: 'var(--radius)', border: '1px solid var(--border)' }}>
            <div style={{ flex: 1 }}>
              <label style={{ fontSize: '0.8rem', display: 'block', marginBottom: '0.5rem', color: 'var(--text-dim)' }}>Filter by Channel Type</label>
              <input
                list="channel-types"
                value={filterType}
                onChange={(e) => setFilterType(e.target.value)}
                placeholder="All Types"
                style={{ width: '100%', background: '#2A2A2A', border: '1px solid var(--border)', borderRadius: 'var(--radius)', color: 'white', padding: '0.8rem' }}
              />
            </div>
            <div style={{ flex: 1 }}>
              <label style={{ fontSize: '0.8rem', display: 'block', marginBottom: '0.5rem', color: 'var(--text-dim)' }}>Filter by Ideology</label>
              <input
                list="ideologies"
                value={filterIdeology}
                onChange={(e) => setFilterIdeology(e.target.value)}
                placeholder="All Ideologies"
                style={{ width: '100%', background: '#2A2A2A', border: '1px solid var(--border)', borderRadius: 'var(--radius)', color: 'white', padding: '0.8rem' }}
              />
            </div>
          </div>

          {channels.length === 0 && (
            <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-dim)', border: '2px dashed var(--border)', borderRadius: 'var(--radius)' }}>
              No channels match the selected filters.
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
                  <div style={{ display: 'flex', gap: '0.4rem', marginTop: '0.5rem', flexWrap: 'wrap' }}>
                    {channel.channel_type && <span style={{ fontSize: '0.65rem', background: 'var(--accent)', padding: '1px 4px', borderRadius: '3px' }}>{channel.channel_type}</span>}
                    {channel.ideology && <span style={{ fontSize: '0.65rem', background: '#4CAF50', padding: '1px 4px', borderRadius: '3px' }}>{channel.ideology}</span>}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}



      {activeTab === 'comments' && (
        <div className="fade-in">
          <h2 style={{ marginBottom: '1.5rem' }}>All Scraped Comments</h2>

          {commentsList.length === 0 && (
            <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-dim)', border: '2px dashed var(--border)', borderRadius: 'var(--radius)' }}>
              No comments found in database. scraping comments for videos via the Scraper tab to populate this list.
            </div>
          )}

          <div className="grid">
            {commentsList.map(comment => (
              <div key={comment.id} className="card">
                <div className="card-content">
                  <div style={{ fontSize: '0.85rem', color: 'var(--text-dim)', marginBottom: '0.5rem' }}>
                    On video: <span style={{ color: 'var(--accent)', cursor: 'pointer' }} onClick={() => showVideoDetails(comment.video_id)}>{comment.video_title}</span>
                  </div>
                  <div style={{ fontWeight: 600, marginBottom: '0.3rem' }}>{comment.author_name}</div>
                  <div style={{ marginBottom: '0.8rem' }}>{comment.text}</div>
                  <div className="card-stats">
                    <span><Users size={12} /> {comment.like_count} likes</span>
                    <span>{formatDate(comment.published_at)}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <datalist id="channel-types">
        <option value="news" />
        <option value="entertainment" />
        <option value="tech" />
        <option value="politics" />
        <option value="vlog" />
        <option value="education" />
      </datalist>

      <datalist id="ideologies">
        <option value="admk" />
        <option value="dmk" />
        <option value="bjp" />
        <option value="leftist" />
        <option value="rightist" />
        <option value="neutral" />
      </datalist>
    </div>
  );
}

export default App;
