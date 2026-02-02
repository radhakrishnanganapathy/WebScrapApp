import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Youtube, Twitter, Search, ArrowLeft, Users, PlaySquare, Eye, Calendar, Link as LinkIcon, MapPin, AtSign, Bell, Trash2, Power, MessageSquare, Filter, Menu, X, CheckCircle, AlertCircle } from 'lucide-react';
import { LocalNotifications } from '@capacitor/local-notifications';

const API_BASE = 'https://webscrapappyt.onrender.com';

function App() {
  const [activeTab, setActiveTab] = useState('monitor'); // Default now 'monitor' for Dashboard
  const [showAddForm, setShowAddForm] = useState(false); // Controls "Add Monitor" modal
  const [isDrawerOpen, setIsDrawerOpen] = useState(false); // Controls Side Drawer
  const [channels, setChannels] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [selectedChannel, setSelectedChannel] = useState(null);
  const [selectedVideo, setSelectedVideo] = useState(null);
  const [toast, setToast] = useState(null); // { message, type }
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
  // Channel List Filter States
  const [filterType, setFilterType] = useState('');
  const [filterIdeology, setFilterIdeology] = useState('');
  const [monitorFilterType, setMonitorFilterType] = useState('');
  const [monitorFilterIdeology, setMonitorFilterIdeology] = useState('');

  // Video List State
  const [videoList, setVideoList] = useState([]);
  const [videoFilterType, setVideoFilterType] = useState('');
  const [videoFilterIdeology, setVideoFilterIdeology] = useState('');
  const [videoFilterChannel, setVideoFilterChannel] = useState('');

  // Comment Filter State
  const [filteredVideosForComments, setFilteredVideosForComments] = useState([]);
  const [commentFilterChannel, setCommentFilterChannel] = useState('');
  const [commentFilterType, setCommentFilterType] = useState('');
  const [commentFilterIdeology, setCommentFilterIdeology] = useState('');
  const [commentFilterVideoId, setCommentFilterVideoId] = useState('');

  // All Comments State
  const [commentsList, setCommentsList] = useState([]);

  // Notification State
  const [previousLogIds, setPreviousLogIds] = useState(new Set());


  useEffect(() => {
    // Request notification permissions on app load
    requestNotificationPermission();

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
      // Don't auto-fetch all comments. Wait for user selection.
      // fetchCommentsList(); 
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
    if (activeTab === 'videos') {
      if (videoFilterType || videoFilterIdeology || videoFilterChannel) {
        fetchVideoListReal(videoFilterType, videoFilterIdeology, videoFilterChannel);
      } else {
        setVideoList([]); // Clear list if no filters
      }
    }
  }, [filterType, filterIdeology, videoFilterType, videoFilterIdeology, videoFilterChannel, activeTab]);

  // Effect to populate Video Dropdown in Comments tab
  useEffect(() => {
    if (activeTab === 'comments') {
      fetchFilteredVideosForDropdown();
    }
  }, [commentFilterChannel, commentFilterType, commentFilterIdeology, activeTab]);

  // Effect to fetch comments when a video is selected
  useEffect(() => {
    if (activeTab === 'comments' && commentFilterVideoId) {
      fetchCommentsList(commentFilterVideoId);
    } else if (activeTab === 'comments') {
      setCommentsList([]); // Clear if no video selected
    }
  }, [commentFilterVideoId, activeTab]);

  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
  };

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
      const newLogs = resp.data;

      // Check for new videos and send notifications
      if (previousLogIds.size > 0) {
        const newVideoLogs = newLogs.filter(log => !previousLogIds.has(log.id));

        for (const log of newVideoLogs) {
          await sendNotification(
            'New Video Detected! 🎥',
            `${log.channel_name || 'Channel'}: ${log.video_title || 'New video uploaded'}`,
            log.video_id
          );
        }
      }

      // Update previous log IDs
      setPreviousLogIds(new Set(newLogs.map(log => log.id)));
      setMonitorLogs(newLogs);
    } catch (err) {
      console.error(err);
    }
  };

  const requestNotificationPermission = async () => {
    try {
      const result = await LocalNotifications.requestPermissions();
      if (result.display === 'granted') {
        console.log('Notification permissions granted');
      }
    } catch (err) {
      console.error('Error requesting notification permissions:', err);
    }
  };

  const sendNotification = async (title, body, videoId) => {
    try {
      await LocalNotifications.schedule({
        notifications: [
          {
            title: title,
            body: body,
            id: Date.now(),
            schedule: { at: new Date(Date.now() + 100) }, // Schedule immediately
            sound: 'default',
            attachments: null,
            actionTypeId: '',
            extra: { videoId: videoId }
          }
        ]
      });
    } catch (err) {
      console.error('Error sending notification:', err);
    }
  };

  const fetchVideoList = async (cType = '', ideo = '') => {
    if (!cType && !ideo) return; // Keep this for the specific "Video List" tab logic if needed, but we reused this function name.
    // ... wait, the Video List tab logic was "if (!cType && !ideo) return;"
    // For dropdown, we might want fewer restrictions or different ones.
    // Let's make a separate function for the dropdown to avoid regression on the other tab.
  };

  const fetchVideoListReal = async (cType, ideo, cName) => {
    try {
      let url = `${API_BASE}/video_list`;
      const params = [];
      if (cType) params.push(`channel_type=${encodeURIComponent(cType)}`);
      if (ideo) params.push(`ideology=${encodeURIComponent(ideo)}`);
      if (cName) params.push(`channel_name=${encodeURIComponent(cName)}`);

      if (params.length > 0) url += `?${params.join('&')}`;

      const resp = await axios.get(url);
      setVideoList(resp.data);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchFilteredVideosForDropdown = async () => {
    try {
      // If no filters are set, we don't want to fetch *all* videos, maybe just clear it.
      if (!commentFilterChannel && !commentFilterType && !commentFilterIdeology) {
        setFilteredVideosForComments([]);
        return;
      }

      let url = `${API_BASE}/video_list`;
      const params = [];

      if (commentFilterChannel) params.push(`channel_name=${encodeURIComponent(commentFilterChannel)}`);
      if (commentFilterType) params.push(`channel_type=${encodeURIComponent(commentFilterType)}`);
      if (commentFilterIdeology) params.push(`ideology=${encodeURIComponent(commentFilterIdeology)}`);

      if (params.length > 0) url += `?${params.join('&')}`;

      const resp = await axios.get(url);
      setFilteredVideosForComments(resp.data);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchCommentsList = async (vidId = null) => {
    try {
      let url = `${API_BASE}/comments`;
      if (vidId) url += `?video_id=${vidId}`;
      const resp = await axios.get(url);
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
      showToast("Monitor added successfully", "success");
    } catch (err) {
      showToast(err.response?.data?.detail || "Failed to add monitor", "error");
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
    try {
      if (platform === 'youtube') {
        let url = `${API_BASE}/scrape/${searchQuery}?type=${scrapeType}`;
        if (channelType) url += `&channel_type=${encodeURIComponent(channelType)}`;
        if (ideology) url += `&ideology=${encodeURIComponent(ideology)}`;
        await axios.post(url);
      } else {
        // Twitter mapping
        let type = scrapeType;
        if (type === 'channel') type = 'user';
        if (type === 'video') type = 'post';
        if (type === 'comment') type = 'reply';

        await axios.post(`${API_BASE}/scrape_twitter/${searchQuery}?type=${type}`);
      }
      showToast(`${scrapeType} scraped successfully!`, "success");
      setSearchQuery('');
    } catch (err) {
      showToast(err.response?.data?.detail || `Failed to scrape ${scrapeType}`, "error");
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
    return new Date(dateStr).toLocaleDateString('en-IN', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      timeZone: 'Asia/Kolkata'
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
      {toast && (
        <div className="toast-container">
          <div className={`toast ${toast.type}`}>
            {toast.type === 'success' ? <CheckCircle size={20} /> : <AlertCircle size={20} />}
            {toast.message}
          </div>
        </div>
      )}
      <header>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <button onClick={() => setIsDrawerOpen(true)} style={{ background: 'none', padding: '0.5rem', border: 'none', color: 'var(--text)' }}>
            <Menu size={28} />
          </button>
          <div className="logo" onClick={() => { setSelectedChannel(null); setSelectedTwitterAccount(null); setActiveTab('scraper'); }} style={{ cursor: 'pointer' }}>
            {platform === 'youtube' ? (
              <Youtube size={32} color="#FF0000" fill="#FF0000" />
            ) : (
              <Twitter size={32} color="#1DA1F2" fill="#1DA1F2" />
            )}
            <span>Scrap</span> App
          </div>
        </div>

      </header>

      {/* Side Drawer */}
      {isDrawerOpen && (
        <>
          <div className="drawer-overlay" onClick={() => setIsDrawerOpen(false)}></div>
          <div className="drawer open">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem', paddingBottom: '1rem', borderBottom: '1px solid var(--border)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: '800', fontSize: '1.2rem' }}>
                {platform === 'youtube' ? <Youtube color="#FF0000" fill="#FF0000" /> : <Twitter color="#1DA1F2" fill="#1DA1F2" />}
                ScrapApp
              </div>
              <button onClick={() => setIsDrawerOpen(false)} style={{ background: 'none', border: 'none', color: 'var(--text-dim)' }}>
                <X size={24} />
              </button>
            </div>

            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0.5rem', overflowY: 'auto' }}>

              <div style={{ fontSize: '0.75rem', fontWeight: 'bold', color: 'var(--text-dim)', textTransform: 'uppercase', marginBottom: '0.5rem' }}>Menu</div>

              <button
                onClick={() => { setActiveTab('monitor'); setIsDrawerOpen(false); }}
                className="drawer-option"
                style={{
                  display: 'flex', alignItems: 'center', gap: '1rem', padding: '0.8rem 1rem', border: 'none',
                  background: activeTab === 'monitor' ? 'rgba(255, 255, 255, 0.1)' : 'transparent',
                  color: activeTab === 'monitor' ? 'white' : 'var(--text-dim)'
                }}
              >
                <Bell size={20} /> Dashboard
              </button>

              <button
                onClick={() => { setActiveTab('scraper'); setSelectedChannel(null); setSelectedTwitterAccount(null); setSelectedVideo(null); setIsDrawerOpen(false); }}
                className="drawer-option"
                style={{
                  display: 'flex', alignItems: 'center', gap: '1rem', padding: '0.8rem 1rem', border: 'none',
                  background: activeTab === 'scraper' ? 'rgba(255, 255, 255, 0.1)' : 'transparent',
                  color: activeTab === 'scraper' ? 'white' : 'var(--text-dim)'
                }}
              >
                <Search size={20} /> Scraper
              </button>

              <button
                onClick={() => { setActiveTab('channels'); setIsDrawerOpen(false); }}
                className="drawer-option"
                style={{
                  display: 'flex', alignItems: 'center', gap: '1rem', padding: '0.8rem 1rem', border: 'none',
                  background: activeTab === 'channels' ? 'rgba(255, 255, 255, 0.1)' : 'transparent',
                  color: activeTab === 'channels' ? 'white' : 'var(--text-dim)'
                }}
              >
                <Filter size={20} /> Channel List
              </button>

              <button
                onClick={() => { setActiveTab('comments'); setIsDrawerOpen(false); }}
                className="drawer-option"
                style={{
                  display: 'flex', alignItems: 'center', gap: '1rem', padding: '0.8rem 1rem', border: 'none',
                  background: activeTab === 'comments' ? 'rgba(255, 255, 255, 0.1)' : 'transparent',
                  color: activeTab === 'comments' ? 'white' : 'var(--text-dim)'
                }}
              >
                <MessageSquare size={20} /> All Comments
              </button>

              <button
                onClick={() => { setActiveTab('videos'); setIsDrawerOpen(false); }}
                className="drawer-option"
                style={{
                  display: 'flex', alignItems: 'center', gap: '1rem', padding: '0.8rem 1rem', border: 'none',
                  background: activeTab === 'videos' ? 'rgba(255, 255, 255, 0.1)' : 'transparent',
                  color: activeTab === 'videos' ? 'white' : 'var(--text-dim)'
                }}
              >
                <PlaySquare size={20} /> Video List
              </button>

              <div style={{ fontSize: '0.75rem', fontWeight: 'bold', color: 'var(--text-dim)', textTransform: 'uppercase', marginBottom: '0.5rem', marginTop: '1.5rem' }}>Platform</div>

              <button
                onClick={() => { setPlatform('youtube'); setScrapeType('channel'); setIsDrawerOpen(false); }}
                className={`drawer-option ${platform === 'youtube' ? 'active-youtube' : ''}`}
                style={{
                  display: 'flex', alignItems: 'center', gap: '1rem', padding: '0.8rem 1rem',
                  background: platform === 'youtube' ? 'rgba(255, 0, 0, 0.1)' : 'transparent',
                  border: platform === 'youtube' ? '1px solid #FF0000' : '1px solid transparent',
                  color: platform === 'youtube' ? '#FF0000' : 'var(--text-dim)'
                }}
              >
                <Youtube size={20} /> YouTube
              </button>
              <button
                onClick={() => { setPlatform('twitter'); setScrapeType('channel'); setIsDrawerOpen(false); }}
                className={`drawer-option ${platform === 'twitter' ? 'active-twitter' : ''}`}
                style={{
                  display: 'flex', alignItems: 'center', gap: '1rem', padding: '0.8rem 1rem',
                  background: platform === 'twitter' ? 'rgba(29, 161, 242, 0.1)' : 'transparent',
                  border: platform === 'twitter' ? '1px solid #1DA1F2' : '1px solid transparent',
                  color: platform === 'twitter' ? '#1DA1F2' : 'var(--text-dim)'
                }}
              >
                <Twitter size={20} /> Twitter (X)
              </button>
            </div>

            <div style={{ marginTop: 'auto', paddingTop: '2rem', color: 'var(--text-dim)', fontSize: '0.8rem', textAlign: 'center' }}>
              v1.0.0 Alpha
            </div>
          </div>
        </>
      )}

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

                <div className="tag-container">
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

                <div className="tag-container">
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
            <div className="search-section" style={{ minHeight: '60vh', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
              <h2 style={{ marginBottom: '2rem', textAlign: 'center', fontSize: '1.8rem' }}>
                Scrape {platform === 'youtube' ? 'YouTube' : 'Twitter'}
              </h2>

              <div style={{ maxWidth: '600px', margin: '0 auto', width: '100%' }}>
                <form className="search-form" onSubmit={handleScrape} style={{ flexDirection: 'column', gap: '1.5rem' }}>

                  <div>
                    <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 600 }}>Scrape Type</label>
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      <select
                        value={scrapeType}
                        onChange={(e) => setScrapeType(e.target.value)}
                        className="select-scrape-type"
                        style={{ flex: 1, padding: '1rem' }}
                      >
                        <option value="channel">{platform === 'youtube' ? 'Channel Info' : 'User Profile'}</option>
                        <option value="video">{platform === 'youtube' ? 'Video Details' : 'Post Details'}</option>
                        <option value="comment">{platform === 'youtube' ? 'Video Comments' : 'Post Replies'}</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 600 }}>Target</label>
                    <input
                      type="text"
                      placeholder={getPlaceholder()}
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      style={{ width: '100%' }}
                    />
                  </div>

                  {scrapeType === 'channel' && platform === 'youtube' && (
                    <div className="monitor-form-row">
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

                  <button type="submit" disabled={isLoading} style={{ background: platform === 'youtube' ? 'var(--primary)' : 'var(--accent)', justifyContent: 'center', padding: '1rem', marginTop: '1rem', fontSize: '1.1rem' }}>
                    {isLoading ? <div className="loading-spinner"></div> : <><Search size={20} /> Start Scraping</>}
                  </button>
                </form>
              </div>

            </div>

          </div>
        )
      )}

      {activeTab === 'monitor' && (
        <div className="fade-in">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
            <h2>Dashboard</h2>
            <div style={{ display: 'flex', gap: '1rem' }}>
              <button
                onClick={() => setShowAddForm(true)}
                style={{
                  background: 'var(--primary)',
                  padding: '0.8rem 1.5rem',
                  borderRadius: 'var(--radius)',
                  display: 'flex', alignItems: 'center', gap: '0.5rem'
                }}
              >
                <span style={{ fontSize: '1.2rem', fontWeight: 'bold' }}>+</span> Add Channel
              </button>
              <button
                onClick={toggleMonitoring}
                style={{
                  background: isMonitoring ? '#d32f2f' : '#2e7d32',
                  padding: '0.8rem 1.5rem',
                  borderRadius: 'var(--radius)',
                  display: 'flex', alignItems: 'center', gap: '0.5rem'
                }}
              >
                <Power size={18} /> {isMonitoring ? 'STOP' : 'START'}
              </button>
            </div>
          </div>

          {showAddForm && (
            <div className="modal-overlay" style={{
              position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
              background: 'rgba(0,0,0,0.8)', zIndex: 1000,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '1rem'
            }}>
              <div className="modal-content" style={{
                background: 'var(--bg-secondary)',
                padding: '2rem',
                borderRadius: 'var(--radius)',
                width: '100%',
                maxWidth: '500px',
                border: '1px solid var(--border)',
                position: 'relative',
                maxHeight: '90vh',
                overflowY: 'auto'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
                  <h3>Add Channel to Monitor</h3>
                  <button onClick={() => setShowAddForm(false)} style={{ background: 'none', padding: 0 }}><ArrowLeft size={24} /></button>
                </div>
                <form onSubmit={async (e) => { await addMonitor(e); setShowAddForm(false); }}>
                  <div className="form-group">
                    <label>Channel ID or Handle</label>
                    <input
                      type="text"
                      placeholder="@handle or UC..."
                      value={newMonitorId}
                      onChange={(e) => setNewMonitorId(e.target.value)}
                      required
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
                      required
                    />
                  </div>
                  <div className="monitor-form-row">
                    <div style={{ flex: 1 }}>
                      <label style={{ fontSize: '0.8rem', display: 'block', marginBottom: '0.3rem', color: 'var(--text-dim)' }}>Channel Type</label>
                      <input
                        list="channel-types"
                        value={channelType}
                        onChange={(e) => setChannelType(e.target.value)}
                        placeholder="Type..."
                        style={{ width: '100%', background: '#2A2A2A', border: '1px solid var(--border)', borderRadius: 'var(--radius)', color: 'white', padding: '0.6rem' }}
                      />
                    </div>
                    <div style={{ flex: 1 }}>
                      <label style={{ fontSize: '0.8rem', display: 'block', marginBottom: '0.3rem', color: 'var(--text-dim)' }}>Ideology</label>
                      <input
                        list="ideologies"
                        value={ideology}
                        onChange={(e) => setIdeology(e.target.value)}
                        placeholder="Ideology..."
                        style={{ width: '100%', background: '#2A2A2A', border: '1px solid var(--border)', borderRadius: 'var(--radius)', color: 'white', padding: '0.6rem' }}
                      />
                    </div>
                  </div>
                  <button type="submit" disabled={isLoading} style={{ width: '100%', justifyContent: 'center' }}>
                    {isLoading ? <div className="loading-spinner"></div> : <><Bell size={18} /> Monitor Channel</>}
                  </button>
                </form>
              </div>
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '2rem' }}>
            {/* Left Column: Monitored Channels */}
            <div>
              <h3 style={{ marginBottom: '1rem' }}>Monitored Channels List</h3>

              {/* Filters */}
              <div className="filter-container" style={{ padding: '1rem', marginBottom: '1rem' }}>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <input
                    list="channel-types"
                    value={monitorFilterType}
                    onChange={(e) => setMonitorFilterType(e.target.value)}
                    placeholder="Type"
                    style={{ flex: 1, background: '#2A2A2A', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '0.5rem', fontSize: '0.8rem', color: 'white' }}
                  />
                  <input
                    list="ideologies"
                    value={monitorFilterIdeology}
                    onChange={(e) => setMonitorFilterIdeology(e.target.value)}
                    placeholder="Ideology"
                    style={{ flex: 1, background: '#2A2A2A', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '0.5rem', fontSize: '0.8rem', color: 'white' }}
                  />
                </div>
              </div>

              <div style={{ maxHeight: '60vh', overflowY: 'auto', paddingRight: '0.5rem' }}>
                {monitoredChannels
                  .filter(ch =>
                    (!monitorFilterType || (ch.channel_type && ch.channel_type.toLowerCase().includes(monitorFilterType.toLowerCase()))) &&
                    (!monitorFilterIdeology || (ch.ideology && ch.ideology.toLowerCase().includes(monitorFilterIdeology.toLowerCase())))
                  )
                  .map(ch => (
                    <div key={ch.id} className="card" style={{ marginBottom: '1rem', padding: '1rem' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <div>
                          <div style={{ fontWeight: 'bold', fontSize: '1rem' }}>{ch.name || ch.channel_id}</div>
                          <div style={{ fontSize: '0.8rem', color: 'var(--text-dim)', marginBottom: '0.5rem' }}>{ch.channel_id}</div>
                          <div className="tag-container" style={{ marginTop: '0.5rem', gap: '0.5rem' }}>
                            {ch.channel_type && <span style={{ fontSize: '0.7rem', background: 'var(--accent)', padding: '2px 6px', borderRadius: '4px' }}>{ch.channel_type}</span>}
                            {ch.ideology && <span style={{ fontSize: '0.7rem', background: '#4CAF50', padding: '2px 6px', borderRadius: '4px' }}>{ch.ideology}</span>}
                          </div>
                        </div>
                        <button onClick={() => removeMonitor(ch.id)} style={{ background: 'none', color: '#d32f2f', padding: '0.5rem' }}>
                          <Trash2 size={16} />
                        </button>
                      </div>
                      <div style={{ marginTop: '0.8rem', fontSize: '0.85rem', color: 'var(--text-dim)', background: '#111', padding: '0.5rem', borderRadius: '4px' }}>
                        "{ch.comment_text}"
                      </div>
                    </div>
                  ))}
                {monitoredChannels.length === 0 && <div className="text-dim">No channels monitored. Add one!</div>}
              </div>
            </div>

            {/* Right Column: Latest Opportunities */}
            <div>
              <h3 style={{ marginBottom: '1rem' }}>Latest Video Opportunities</h3>
              <div style={{ maxHeight: '75vh', overflowY: 'auto', paddingRight: '0.5rem' }}>
                {monitorLogs.length === 0 && (
                  <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-dim)', border: '1px dashed var(--border)', borderRadius: 'var(--radius)' }}>
                    No opportunities found yet. <br /> Ensure monitoring is ACTIVE.
                  </div>
                )}
                {monitorLogs.map(log => (
                  <div key={log.id} className="card fade-in" style={{ marginBottom: '1rem', padding: '1rem' }}>
                    <div style={{ borderBottom: '1px solid var(--border)', paddingBottom: '0.5rem', marginBottom: '0.5rem', display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ fontWeight: 'bold', color: 'var(--accent)' }}>New Video Detected</span>
                      <span style={{ fontSize: '0.7rem', color: 'var(--text-dim)' }}>{new Date(log.created_at).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', dateStyle: 'short', timeStyle: 'short' })}</span>
                    </div>

                    <div style={{ marginBottom: '0.5rem' }}>
                      <div style={{ fontSize: '1rem', fontWeight: 'bold' }}>{log.channel_name || log.channel_id}</div>
                      <div style={{ fontSize: '0.9rem', color: 'var(--text)' }}>{log.video_title || log.video_id}</div>
                      <div style={{ fontSize: '0.7rem', color: 'var(--text-dim)', marginTop: '0.3rem' }}>ID: {log.video_id}</div>
                    </div>

                    <div style={{ background: '#222', padding: '0.8rem', borderRadius: 'var(--radius)', marginBottom: '1rem', fontSize: '0.9rem', fontStyle: 'italic' }}>
                      "{log.comment_text}"
                    </div>

                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(log.comment_text);
                        window.open(`https://www.youtube.com/watch?v=${log.video_id}`, '_blank');
                      }}
                      style={{
                        width: '100%',
                        background: 'var(--primary)',
                        padding: '0.8rem',
                        justifyContent: 'center'
                      }}
                    >
                      <LinkIcon size={16} /> Copy Comment & Open Video
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'channels' && (
        <div className="fade-in">
          <h2 style={{ marginBottom: '1.5rem' }}>Filtered Channel List</h2>
          <div className="filter-container">
            <div style={{ flex: 1 }}>
              <label style={{ fontSize: '0.8rem', display: 'block', marginBottom: '0.5rem', color: 'var(--text-dim)' }}>Filter by Channel Name</label>
              <input
                list="scraped-channels"
                value={videoFilterChannel}
                onChange={(e) => setVideoFilterChannel(e.target.value)}
                placeholder="Type Channel Name..."
                style={{ width: '100%', background: '#2A2A2A', border: '1px solid var(--border)', borderRadius: 'var(--radius)', color: 'white', padding: '0.8rem' }}
              />
            </div>
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
          <h2 style={{ marginBottom: '1.5rem' }}>Filtered Comments</h2>

          {/* Filters for Comments */}
          <div className="filter-container" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
              <div>
                <label style={{ fontSize: '0.8rem', display: 'block', marginBottom: '0.3rem', color: 'var(--text-dim)' }}>Channel Name</label>
                <input
                  list="scraped-channels"
                  placeholder="Type to search..."
                  value={commentFilterChannel}
                  onChange={e => { setCommentFilterChannel(e.target.value); setCommentFilterVideoId(''); }}
                  style={{ width: '100%', background: '#2A2A2A', border: '1px solid var(--border)', borderRadius: 'var(--radius)', color: 'white', padding: '0.5rem' }}
                />
              </div>
              <div>
                <label style={{ fontSize: '0.8rem', display: 'block', marginBottom: '0.3rem', color: 'var(--text-dim)' }}>Channel Type</label>
                <input
                  list="channel-types"
                  placeholder="Select Type..."
                  value={commentFilterType}
                  onChange={e => { setCommentFilterType(e.target.value); setCommentFilterVideoId(''); }}
                  style={{ width: '100%', background: '#2A2A2A', border: '1px solid var(--border)', borderRadius: 'var(--radius)', color: 'white', padding: '0.5rem' }}
                />
              </div>
              <div>
                <label style={{ fontSize: '0.8rem', display: 'block', marginBottom: '0.3rem', color: 'var(--text-dim)' }}>Ideology</label>
                <input
                  list="ideologies"
                  placeholder="Select Ideology..."
                  value={commentFilterIdeology}
                  onChange={e => { setCommentFilterIdeology(e.target.value); setCommentFilterVideoId(''); }}
                  style={{ width: '100%', background: '#2A2A2A', border: '1px solid var(--border)', borderRadius: 'var(--radius)', color: 'white', padding: '0.5rem' }}
                />
              </div>
            </div>

            <div>
              <label style={{ fontSize: '0.8rem', display: 'block', marginBottom: '0.3rem', color: 'var(--text-dim)' }}>Select Video</label>
              <select
                value={commentFilterVideoId}
                onChange={e => setCommentFilterVideoId(e.target.value)}
                style={{ width: '100%', background: '#2A2A2A', border: '1px solid var(--border)', borderRadius: 'var(--radius)', color: 'white', padding: '0.8rem' }}
                disabled={filteredVideosForComments.length === 0}
              >
                <option value="">{filteredVideosForComments.length > 0 ? "-- Select a Video --" : "-- No videos match filters --"}</option>
                {filteredVideosForComments.map(v => (
                  <option key={v.video_id} value={v.video_id}>
                    {v.title.length > 60 ? v.title.substring(0, 60) + '...' : v.title} ({formatDate(v.published_at)})
                  </option>
                ))}
              </select>
            </div>
          </div>

          <hr style={{ borderColor: 'var(--border)', margin: '2rem 0' }} />

          {commentsList.length === 0 && (
            <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-dim)', border: '2px dashed var(--border)', borderRadius: 'var(--radius)' }}>
              {commentFilterVideoId ? "No comments found for this video." : "Please select a video to view comments."}
            </div>
          )}

          <div className="grid">
            {commentsList.map(comment => (
              <div key={comment.id} className="card">
                <div className="card-content">
                  <div style={{ fontSize: '0.85rem', color: 'var(--text-dim)', marginBottom: '0.5rem' }}>
                    On video: <span style={{ color: 'var(--accent)' }}>{comment.video_title}</span>
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

      <datalist id="scraped-channels">
        {channels.map(c => <option key={c.id} value={c.name} />)}
      </datalist>

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

      {activeTab === 'videos' && (
        <div className="fade-in">
          <h2 style={{ marginBottom: '1.5rem' }}>Filtered Video List</h2>
          <div className="filter-container">
            <div style={{ flex: 1 }}>
              <label style={{ fontSize: '0.8rem', display: 'block', marginBottom: '0.5rem', color: 'var(--text-dim)' }}>Filter by Channel Name</label>
              <input
                list="scraped-channels"
                value={videoFilterChannel}
                onChange={(e) => setVideoFilterChannel(e.target.value)}
                placeholder="Type Channel Name..."
                style={{ width: '100%', background: '#2A2A2A', border: '1px solid var(--border)', borderRadius: 'var(--radius)', color: 'white', padding: '0.8rem' }}
              />
            </div>
            <div style={{ flex: 1 }}>
              <label style={{ fontSize: '0.8rem', display: 'block', marginBottom: '0.5rem', color: 'var(--text-dim)' }}>Filter by Channel Type</label>
              <input
                list="channel-types"
                value={videoFilterType}
                onChange={(e) => setVideoFilterType(e.target.value)}
                placeholder="Select Type or Type..."
                style={{ width: '100%', background: '#2A2A2A', border: '1px solid var(--border)', borderRadius: 'var(--radius)', color: 'white', padding: '0.8rem' }}
              />
            </div>
            <div style={{ flex: 1 }}>
              <label style={{ fontSize: '0.8rem', display: 'block', marginBottom: '0.5rem', color: 'var(--text-dim)' }}>Filter by Ideology</label>
              <input
                list="ideologies"
                value={videoFilterIdeology}
                onChange={(e) => setVideoFilterIdeology(e.target.value)}
                placeholder="Select Ideology or Type..."
                style={{ width: '100%', background: '#2A2A2A', border: '1px solid var(--border)', borderRadius: 'var(--radius)', color: 'white', padding: '0.8rem' }}
              />
            </div>
          </div>

          {(!videoFilterType && !videoFilterIdeology && !videoFilterChannel) ? (
            <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-dim)', border: '2px dashed var(--border)', borderRadius: 'var(--radius)' }}>
              Please select a Channel Name, Type, or Ideology filter to view videos.
            </div>
          ) : (
            <>
              {videoList.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-dim)', border: '2px dashed var(--border)', borderRadius: 'var(--radius)' }}>
                  No videos found for the selected filters.
                </div>
              ) : (
                <div className="grid">
                  {videoList.map(video => (
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
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

export default App;
