import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { io } from 'socket.io-client';
import { fetchAPI, API_BASE_URL, API_URL, logout } from '../api';

const USER_COLORS = ['#00f2fe', '#4facfe', '#7000ff', '#ff3366', '#00ff88', '#f9d423', '#fb8c00'];
const getUserColor = (name) => {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return USER_COLORS[Math.abs(hash) % USER_COLORS.length];
};

const formatTime = (date) =>
  date
    ? new Date(date).toLocaleString([], { hour: '2-digit', minute: '2-digit', month: 'short', day: 'numeric' })
    : '---';

// ─── Message Bubble ───────────────────────────────────────────────────────────
const MessageBubble = ({ msg, isSent, isGroup, onInfoOpen, user }) => {
  const time = new Date(msg.createdAt || Date.now()).toLocaleTimeString([], {
    hour: '2-digit', minute: '2-digit',
  });

  const pressTimer = useRef(null);
  const startPress = () => {
    if (!isSent) return;
    pressTimer.current = setTimeout(() => onInfoOpen(msg._id), 600);
  };
  const cancelPress = () => clearTimeout(pressTimer.current);

  return (
    <div
      className={`message ${isSent ? 'sent' : 'received'}`}
      data-id={msg._id}
      onMouseDown={startPress}
      onMouseUp={cancelPress}
      onMouseLeave={cancelPress}
      onTouchStart={startPress}
      onTouchEnd={cancelPress}
      onClick={() => { if (isSent && !isGroup) onInfoOpen(msg._id); }}
    >
      {isGroup && !isSent && (
        <div style={{ fontSize: '0.7rem', opacity: 0.6, marginBottom: '4px' }}>
          {(msg.senderId && msg.senderId.username) ? msg.senderId.username : 'User'}
        </div>
      )}

      <div className="message-content-wrapper">
        {msg.imageUrl && (
          <img
            src={`${API_BASE_URL}${msg.imageUrl}`}
            alt="sent"
            onClick={() => window.open(`${API_BASE_URL}${msg.imageUrl}`, '_blank')}
          />
        )}
        {msg.content && <div>{msg.content}</div>}
      </div>

      {isSent && (
        <div className={`status-ticks ${msg.status === 'seen' ? 'seen' : ''}`}>
          {msg.status === 'seen' || msg.status === 'delivered' ? '✓✓' : '✓'}
        </div>
      )}

      <div className="message-time">{time}</div>

      {isSent && isGroup && msg.seen_by && msg.seen_by.length > 0 && (
        <div className="seen-avatars-container" onClick={(e) => { e.stopPropagation(); onInfoOpen(msg._id); }}>
          <div className="avatar-stack">
            {msg.seen_by.slice(0, 3).map((s) => (
              <div
                key={s.user_id}
                className="stacked-avatar"
                style={{ background: getUserColor(s.username) }}
                data-viewer-id={s.user_id}
              >
                {s.username.charAt(0).toUpperCase()}
              </div>
            ))}
            {msg.seen_by.length > 3 && (
              <div className="stacked-avatar" style={{ background: '#333', color: '#fff' }}>
                +{msg.seen_by.length - 3}
              </div>
            )}
          </div>
          <div className="seen-status-text seen-text-cyan">Seen by {msg.seen_by.length}</div>
        </div>
      )}

      {isSent && isGroup && msg.seen_by && msg.seen_by.length === 0 && (
        <div className="seen-avatars-container">
          <div className="seen-status-text not-seen-text-gray">Not seen yet</div>
        </div>
      )}

      {msg.expiresAt && (
        <div className="expiry-indicator">
          <i className="fas fa-history" /> Disappearing
        </div>
      )}
    </div>
  );
};

// ─── Message Info Bottom Sheet ─────────────────────────────────────────────────
const MessageInfoSheet = ({ messageId, onClose }) => {
  const [info, setInfo] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!messageId) return;
    setLoading(true);
    fetchAPI(`/messages/${messageId}/seen`)
      .then(setInfo)
      .catch(() => setInfo(null))
      .finally(() => setLoading(false));
  }, [messageId]);

  return (
    <div
      className="bottom-sheet-overlay active"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bottom-sheet">
        <div className="sheet-header">
          <div className="sheet-handle" onClick={onClose} />
          <div className="sheet-title">Message info</div>
        </div>

        {loading && <div style={{ padding: '20px', opacity: 0.6, textAlign: 'center' }}>Loading...</div>}

        {!loading && info && info.type === 'private' && (
          <div className="sheet-section">
            {[
              { label: 'Sent', time: info.sent_at, color: 'var(--primary-color)' },
              { label: 'Delivered', time: info.delivered_at, color: 'var(--secondary-color)' },
              { label: 'Seen', time: info.seen_at, color: 'var(--success-color)' },
            ].map(({ label, time, color }) => (
              <div className="info-user-item" key={label}>
                <div className="info-user-detail">
                  <div className="info-user-name" style={{ color }}>{label}</div>
                  <div className="info-user-time">{formatTime(time)}</div>
                </div>
              </div>
            ))}
          </div>
        )}

        {!loading && info && info.type !== 'private' && (
          <>
            <div className="sheet-section">
              <div className="section-head">Seen by</div>
              {info.seen_by.length === 0 ? (
                <div className="info-user-item"><div className="not-opened-yet">No one has seen it yet.</div></div>
              ) : (
                info.seen_by.map((s) => (
                  <div className="info-user-item" key={s.user_id}>
                    <div
                      className="header-avatar"
                      style={{ width: 35, height: 35, background: getUserColor(s.username), borderRadius: '50%', flexShrink: 0 }}
                    >
                      {s.username.charAt(0).toUpperCase()}
                    </div>
                    <div className="info-user-detail">
                      <div className="info-user-name">{s.username}</div>
                      <div className="info-user-time">
                        Seen at {new Date(s.seen_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
            <div className="sheet-section">
              <div className="section-head">Not seen yet</div>
              {info.not_seen_yet.length === 0 ? (
                <div className="info-user-item"><div className="not-opened-yet">Everyone has seen it!</div></div>
              ) : (
                info.not_seen_yet.map((ns) => (
                  <div className="info-user-item" key={ns.user_id}>
                    <div
                      className="header-avatar"
                      style={{ width: 35, height: 35, background: getUserColor(ns.username), borderRadius: '50%', flexShrink: 0 }}
                    >
                      {ns.username.charAt(0).toUpperCase()}
                    </div>
                    <div className="info-user-detail">
                      <div className="info-user-name">{ns.username}</div>
                      <div className="not-opened-yet">Not opened yet</div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
};

// ─── Camera Modal ─────────────────────────────────────────────────────────────
const CameraModal = ({ onClose, onCapture }) => {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const [stream, setStream] = useState(null);
  const [facingMode, setFacingMode] = useState('user');
  const [capturing, setCapturing] = useState(false);

  const startCamera = useCallback(async (mode) => {
    if (stream) stream.getTracks().forEach((t) => t.stop());
    try {
      const s = await navigator.mediaDevices.getUserMedia({ video: { facingMode: mode }, audio: false });
      setStream(s);
      if (videoRef.current) videoRef.current.srcObject = s;
    } catch (err) {
      alert('Could not access camera.');
      onClose();
    }
  }, [stream, onClose]);

  useEffect(() => {
    startCamera(facingMode);
    return () => {
      if (stream) stream.getTracks().forEach((t) => t.stop());
    };
  }, []);

  const flipCamera = () => {
    const newMode = facingMode === 'user' ? 'environment' : 'user';
    setFacingMode(newMode);
    startCamera(newMode);
  };

  const capture = () => {
    const canvas = canvasRef.current;
    const video = videoRef.current;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    if (facingMode === 'user') {
      ctx.translate(canvas.width, 0);
      ctx.scale(-1, 1);
    }
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    canvas.toBlob(async (blob) => {
      if (!blob) return;
      setCapturing(true);
      try {
        await onCapture(blob);
        onClose();
      } catch (err) {
        alert('Failed to send photo: ' + err.message);
      } finally {
        setCapturing(false);
      }
    }, 'image/jpeg', 0.85);
  };

  return (
    <div className="camera-modal-overlay">
      <div className="camera-container">
        <div className="camera-header">
          <button className="icon-btn" onClick={onClose}>✕</button>
          <span>Camera</span>
          <button className="icon-btn" onClick={flipCamera}>🔄</button>
        </div>
        <div className="camera-viewport">
          <video ref={videoRef} autoPlay playsInline />
          <canvas ref={canvasRef} style={{ display: 'none' }} />
        </div>
        <div className="camera-footer">
          <button className="capture-button" disabled={capturing} onClick={capture} />
        </div>
      </div>
    </div>
  );
};

// ─── Chat Page ────────────────────────────────────────────────────────────────
const ChatPage = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const targetId = searchParams.get('target');
  const targetName = searchParams.get('name');
  const groupId = searchParams.get('groupId');

  const user = JSON.parse(localStorage.getItem('user') || 'null');

  const [messages, setMessages] = useState([]);
  const [inputValue, setInputValue] = useState('');
  const [ghostMode, setGhostMode] = useState(user?.ghostMode || false);
  const [selectedDuration, setSelectedDuration] = useState(0);
  const [showTimer, setShowTimer] = useState(false);
  const [showEmoji, setShowEmoji] = useState(false);
  const [infoMsgId, setInfoMsgId] = useState(null);
  const [showCamera, setShowCamera] = useState(false);

  const socketRef = useRef(null);
  const messagesEndRef = useRef(null);
  const fileInputRef = useRef(null);
  const chatTokenRef = useRef(null);
  const currentRoomId = useRef(groupId ? `group_${groupId}` : null);

  const getRoomId = (id1, id2) => [id1, id2].sort().join('_');

  // Auth guard
  useEffect(() => {
    if (!user || !localStorage.getItem('token')) {
      navigate('/');
      return;
    }
    if (!groupId && !targetId) {
      navigate('/search');
      return;
    }
    if (!groupId && targetId) {
      const token = sessionStorage.getItem(`chatToken_${targetId}`);
      if (!token) { navigate('/search'); return; }
      chatTokenRef.current = token;
    }
  }, []);

  // Socket setup
  useEffect(() => {
    if (!user) return;

    const socket = io(API_BASE_URL);
    socketRef.current = socket;

    socket.emit('register', user.id);

    if (!groupId && targetId) {
      currentRoomId.current = getRoomId(user.id, targetId);
    }
    if (currentRoomId.current) socket.emit('join_room', currentRoomId.current);
    if (groupId) socket.emit('mark_group_seen', { groupId, roomId: currentRoomId.current });

    socket.on('receive_message', (msg) => {
      const isGroup = groupId && String(msg.groupId) === String(groupId);
      const isPrivate =
        !groupId && !msg.groupId &&
        (
          String(msg.senderId) === String(targetId) ||
          (msg.senderId && String(msg.senderId._id) === String(targetId)) ||
          String(msg.senderId) === String(user.id) ||
          (msg.senderId && String(msg.senderId._id) === String(user.id))
        );

      if (isGroup || isPrivate) {
        const isSent = (msg.senderId?._id || msg.senderId) === user.id;
        setMessages((prev) => {
          if (prev.some((m) => m._id === msg._id)) return prev;
          return [...prev, { ...msg, _isSent: isSent }];
        });
      }
    });

    socket.on('message_status_update', (data) => {
      if (data.senderId === user.id && data.readerId === targetId) {
        setMessages((prev) =>
          prev.map((m) =>
            m._isSent ? { ...m, status: 'seen' } : m
          )
        );
      }
    });

    socket.on('screenshot_taken', ({ username }) => {
      setMessages((prev) => [
        ...prev,
        {
          _id: Date.now(),
          content: `📸 ${username} took a screenshot`,
          _isSent: false,
          _system: true,
          createdAt: new Date(),
        },
      ]);
    });

    // Load messages
    const url = groupId ? `/groups/${groupId}/messages` : `/messages/${targetId}`;
    fetchAPI(url, { headers: { 'X-Chat-Token': chatTokenRef.current || '' } })
      .then((msgs) => {
        setMessages(msgs.map((m) => ({ ...m, _isSent: (m.senderId?._id || m.senderId) === user.id })));
      })
      .catch((err) => {
        console.error(err);
        if (!groupId) navigate('/search');
      });

    // Screenshot detection
    const handleKey = (e) => {
      if (e.key === 'PrintScreen' || e.keyCode === 44) {
        socket.emit('screenshot_taken', { userId: user.id, username: user.username, roomId: currentRoomId.current });
      }
    };
    window.addEventListener('keyup', handleKey);

    return () => {
      socket.disconnect();
      window.removeEventListener('keyup', handleKey);
    };
  }, []);

  // Auto scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendMessage = async () => {
    if (!inputValue.trim()) return;
    const body = {
      content: inputValue,
      duration: selectedDuration > 0 ? selectedDuration : undefined,
    };
    if (groupId) body.groupId = groupId;
    else body.receiverId = targetId;

    try {
      const msg = await fetchAPI('/messages', {
        method: 'POST',
        headers: { 'X-Chat-Token': chatTokenRef.current || '' },
        body: JSON.stringify(body),
      });
      setInputValue('');
      socketRef.current?.emit('send_message', { roomId: currentRoomId.current, message: msg });
      setMessages((prev) => [...prev, { ...msg, _isSent: true }]);
      socketRef.current?.emit('typing', { userId: user.id, roomId: currentRoomId.current, typing: false });
    } catch (err) {
      alert('Failed to send');
    }
  };

  const handleFileUpload = async (file) => {
    if (!file) return;
    const formData = new FormData();
    formData.append('image', file);
    const query = groupId ? `groupId=${groupId}` : `receiverId=${targetId}`;
    try {
      const res = await fetch(`${API_URL}/upload?${query}`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${localStorage.getItem('token')}`,
          'X-Chat-Token': chatTokenRef.current || '',
        },
        body: formData,
      });
      const data = await res.json();
      const body = { imageUrl: data.imageUrl, content: '', duration: selectedDuration > 0 ? selectedDuration : undefined };
      if (groupId) body.groupId = groupId;
      else body.receiverId = targetId;
      const msg = await fetchAPI('/messages', {
        method: 'POST',
        headers: { 'X-Chat-Token': chatTokenRef.current || '' },
        body: JSON.stringify(body),
      });
      socketRef.current?.emit('send_message', { roomId: currentRoomId.current, message: msg });
      setMessages((prev) => [...prev, { ...msg, _isSent: true }]);
    } catch (err) {
      alert('Upload failed');
    }
  };

  const handleCameraCapture = async (blob) => {
    const file = new File([blob], 'capture.jpg', { type: 'image/jpeg' });
    await handleFileUpload(file);
  };

  const toggleGhost = async () => {
    const newState = !ghostMode;
    try {
      await fetchAPI('/ghost-mode', { method: 'PATCH', body: JSON.stringify({ ghostMode: newState }) });
      setGhostMode(newState);
      const localUser = JSON.parse(localStorage.getItem('user'));
      localUser.ghostMode = newState;
      localStorage.setItem('user', JSON.stringify(localUser));
      socketRef.current?.emit('register', user.id);
    } catch (err) {
      alert('Failed to update Ghost Mode');
    }
  };

  if (!user) return null;

  const displayName = targetName || groupId ? (searchParams.get('name') || 'Chat') : 'Chat';

  return (
    <div className="chat-page-body">
      <div className="chat-bg-overlay" />
      <div className="app-container">
        <div className="chat-area">
          {/* Header */}
          <div className="chat-header">
            <Link to="/search" className="back-btn" title="Back to Search">
              <i className="fas fa-arrow-left" />
            </Link>
            <div className="header-info">
              <div style={{ position: 'relative' }}>
                <div
                  className={`header-avatar ${ghostMode ? 'ghost-avatar-glow' : ''}`}
                  id="headerAvatar"
                >
                  {displayName.charAt(0).toUpperCase()}
                </div>
                <div className={`ghost-badge ${ghostMode ? 'visible' : ''}`}>👻</div>
              </div>
              <div className="header-user-name">{displayName}</div>
              <button
                id="ghostToggle"
                className={ghostMode ? 'active' : ''}
                onClick={toggleGhost}
                title="Toggle Ghost Mode"
              >
                <i className="fas fa-ghost" />
                <span>Ghost Mode: {ghostMode ? 'ON' : 'OFF'}</span>
              </button>
            </div>
            <button
              className="back-btn"
              style={{ color: 'var(--error-color)' }}
              onClick={logout}
              title="Logout"
            >
              <i className="fas fa-sign-out-alt" />
            </button>
          </div>

          {/* Messages */}
          <div
            className="messages-container"
            onClick={() => { setShowTimer(false); setShowEmoji(false); }}
          >
            {messages.map((msg, i) => {
              if (msg._system) {
                return (
                  <div key={msg._id || i} className="message system">
                    {msg.content}
                  </div>
                );
              }
              return (
                <MessageBubble
                  key={msg._id || i}
                  msg={msg}
                  isSent={msg._isSent}
                  isGroup={!!groupId}
                  user={user}
                  onInfoOpen={setInfoMsgId}
                />
              );
            })}
            <div ref={messagesEndRef} />
          </div>

          {/* Input Bar */}
          <div className="message-input-container">
            <div className="input-actions">
              <button
                type="button"
                className="action-btn"
                title="Emojis"
                onClick={(e) => { e.stopPropagation(); setShowEmoji(!showEmoji); }}
              >
                😊
              </button>
              <button
                type="button"
                className="action-btn"
                title="Camera"
                onClick={() => setShowCamera(true)}
              >
                <i className="fas fa-camera" />
              </button>
              <button
                type="button"
                className="action-btn"
                title="Gallery"
                onClick={() => fileInputRef.current?.click()}
              >
                <i className="fas fa-image" />
              </button>
              <div className="timer-picker-container">
                <button
                  type="button"
                  className={`action-btn ${selectedDuration > 0 ? 'timer-active' : ''}`}
                  title="Disappearing Messages"
                  onClick={(e) => { e.stopPropagation(); setShowTimer(!showTimer); }}
                >
                  <i className="fas fa-history" />
                </button>
                {showTimer && (
                  <div className="timer-dropdown">
                    {[{ label: 'Off', value: 0 }, { label: '1 Hour', value: 1 }, { label: '24 Hours', value: 24 }, { label: '7 Days', value: 168 }].map((opt) => (
                      <div
                        key={opt.value}
                        className={`timer-option ${selectedDuration === opt.value ? 'active' : ''}`}
                        onClick={() => { setSelectedDuration(opt.value); setShowTimer(false); }}
                      >
                        {opt.label}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="main-input-wrapper">
              <input
                type="file"
                ref={fileInputRef}
                accept="image/*"
                style={{ display: 'none' }}
                onChange={(e) => handleFileUpload(e.target.files[0])}
              />
              <input
                type="text"
                id="messageInput"
                placeholder="Type a message..."
                autoComplete="off"
                value={inputValue}
                onChange={(e) => {
                  setInputValue(e.target.value);
                  socketRef.current?.emit('typing', { userId: user.id, roomId: currentRoomId.current, typing: true });
                  clearTimeout(window._typingTimer);
                  window._typingTimer = setTimeout(() =>
                    socketRef.current?.emit('typing', { userId: user.id, roomId: currentRoomId.current, typing: false })
                  , 2000);
                }}
                onKeyDown={(e) => { if (e.key === 'Enter') sendMessage(); }}
              />
              {showEmoji && (
                <emoji-picker
                  style={{
                    position: 'absolute', bottom: '70px', left: 0,
                    zIndex: 1000,
                    '--background': 'var(--bg-dark)',
                    '--border-color': 'var(--glass-border)',
                    '--text-color': 'var(--text-color)',
                  }}
                  onEmojiClick={(e) => setInputValue((prev) => prev + e.detail.unicode)}
                />
              )}
            </div>

            <button id="sendBtn" onClick={sendMessage}>
              <i className="fas fa-paper-plane" />
            </button>
          </div>
        </div>
      </div>

      {/* Camera Modal */}
      {showCamera && (
        <CameraModal
          onClose={() => setShowCamera(false)}
          onCapture={handleCameraCapture}
        />
      )}

      {/* Message Info Bottom Sheet */}
      {infoMsgId && (
        <MessageInfoSheet
          messageId={infoMsgId}
          onClose={() => setInfoMsgId(null)}
        />
      )}
    </div>
  );
};

export default ChatPage;
