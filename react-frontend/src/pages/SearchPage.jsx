import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { fetchAPI, logout } from '../api';

const USER_COLORS = ['#00f2fe', '#4facfe', '#7000ff', '#ff3366', '#00ff88', '#f9d423', '#fb8c00'];
const getUserColor = (name) => {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return USER_COLORS[Math.abs(hash) % USER_COLORS.length];
};

// ─── Verification Modal ────────────────────────────────────────────────────────
const VerifyModal = ({ targetUser, onClose }) => {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleVerify = async () => {
    if (!password.trim()) return;
    setLoading(true);
    setError('');
    try {
      const data = await fetchAPI('/verify-chat-password', {
        method: 'POST',
        body: JSON.stringify({ targetUserId: targetUser._id, chatPassword: password }),
      });
      sessionStorage.setItem(`chatToken_${targetUser._id}`, data.chatToken);
      navigate(`/chat?target=${targetUser._id}&name=${encodeURIComponent(targetUser.username)}`);
    } catch (err) {
      setError(err.message || 'Verification failed');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const handler = (e) => { if (e.key === 'Enter') handleVerify(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  });

  return (
    <div className="modal-overlay active">
      <div className="modal-content">
        <h3>Verify Access</h3>
        <p>
          Please enter the chat password for <br />
          <b>{targetUser.username}</b> to start the conversation.
        </p>
        {error && <div className="modal-error">{error}</div>}
        <div className="modal-input-wrapper">
          <input
            type="password"
            className="modal-input"
            placeholder="••••••••"
            autoComplete="off"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoFocus
          />
        </div>
        <div className="modal-actions">
          <button className="btn-modal btn-cancel" onClick={onClose}>Cancel</button>
          <button
            className="btn-modal btn-verify"
            disabled={loading}
            onClick={handleVerify}
          >
            <i className="fas fa-shield-alt" />
            <span>{loading ? 'Verifying...' : 'Verify'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};

// ─── Group Modal ───────────────────────────────────────────────────────────────
const GroupModal = ({ type, onClose, onSuccess }) => {
  const [name, setName] = useState('');
  const [key, setKey] = useState('');

  const handleSubmit = async () => {
    if (!name.trim() || !key.trim()) return alert('Fill all fields');
    try {
      if (type === 'create') {
        await fetchAPI('/groups', { method: 'POST', body: JSON.stringify({ name, groupKey: key }) });
      } else {
        await fetchAPI('/groups/join', { method: 'POST', body: JSON.stringify({ name, groupKey: key }) });
      }
      onSuccess();
    } catch (err) {
      alert(err.message);
    }
  };

  return (
    <div className="modal-overlay active">
      <div className="modal">
        <h2 className="modal-title">
          {type === 'create' ? 'Create Private Group' : 'Join Existing Group'}
        </h2>
        <div className="form-group">
          <label>Group Name</label>
          <input
            type="text"
            placeholder={type === 'create' ? 'Enter group name...' : 'Enter target group name...'}
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </div>
        <div className="form-group">
          <label>Secret Key</label>
          <input
            type="password"
            placeholder={type === 'create' ? "Set a group access key..." : "Enter the group's secret key..."}
            value={key}
            onChange={(e) => setKey(e.target.value)}
          />
        </div>
        <div className="modal-actions">
          <button className="btn-cancel" onClick={onClose}>Cancel</button>
          <button className="btn-confirm" onClick={handleSubmit}>
            {type === 'create' ? 'Create Group' : 'Join Group'}
          </button>
        </div>
      </div>
    </div>
  );
};

// ─── User Card ─────────────────────────────────────────────────────────────────
const UserCard = ({ user, onClick }) => (
  <div className="user-card" onClick={() => onClick(user)}>
    <div className="user-info">
      <div className="user-avatar">{user.username.charAt(0).toUpperCase()}</div>
      <div className="user-name">{user.username}</div>
    </div>
    <button className="btn-message">
      <i className="fas fa-paper-plane" /> Message
    </button>
  </div>
);

// ─── Group Card ────────────────────────────────────────────────────────────────
const GroupCard = ({ group }) => {
  const navigate = useNavigate();
  return (
    <div
      className="group-card"
      onClick={() => navigate(`/chat?groupId=${group._id}&name=${encodeURIComponent(group.name)}`)}
    >
      <div className="group-info">
        <div className="group-avatar">{group.name.charAt(0).toUpperCase()}</div>
        <div>
          <div className="group-name">{group.name}</div>
          <div className="group-members">{group.members.length} members</div>
        </div>
      </div>
      <button className="btn-join">
        <i className="fas fa-comments" /> Enter
      </button>
    </div>
  );
};

// ─── Search Page ───────────────────────────────────────────────────────────────
const SearchPage = () => {
  const [groups, setGroups] = useState([]);
  const [recentChats, setRecentChats] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [showResults, setShowResults] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const [groupModal, setGroupModal] = useState(null); // 'create' | 'join' | null
  const navigate = useNavigate();

  // Auth guard
  useEffect(() => {
    const user = localStorage.getItem('user');
    const token = localStorage.getItem('token');
    if (!user || !token) navigate('/');
  }, [navigate]);

  const loadContent = async () => {
    try {
      const [g, u] = await Promise.all([fetchAPI('/groups'), fetchAPI('/recent')]);
      setGroups(g);
      setRecentChats(u);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => { loadContent(); }, []);

  const handleSearch = async (e) => {
    const q = e.target.value;
    setSearchQuery(q);
    if (!q.trim()) { setShowResults(false); setSearchResults([]); return; }
    setShowResults(true);
    try {
      const users = await fetchAPI(`/search-users?query=${encodeURIComponent(q)}`);
      setSearchResults(users);
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div style={{ minHeight: '100vh', paddingTop: '20px' }}>
      <div className="bg-overlay" />

      <div className="search-app-container">
        {/* Header */}
        <div className="search-header">
          <h2 className="search-title">Discover</h2>
          <div className="action-buttons">
            <button
              className="btn-icon btn-chat"
              onClick={() => setGroupModal('create')}
            >
              <i className="fas fa-plus-circle" />
              <span>Create Group</span>
            </button>
            <button
              className="btn-icon btn-chat secondary"
              onClick={() => setGroupModal('join')}
            >
              <i className="fas fa-sign-in-alt" />
              <span>Join Group</span>
            </button>
            <button className="btn-icon btn-logout" onClick={logout}>
              <i className="fas fa-sign-out-alt" />
              <span>Logout</span>
            </button>
          </div>
        </div>

        {/* Search Bar */}
        <div className="search-bar-wrapper">
          <i className="fas fa-search search-icon" />
          <input
            type="text"
            className="search-input"
            placeholder="Search by username..."
            autoComplete="off"
            value={searchQuery}
            onChange={handleSearch}
          />
          {searchQuery && (
            <button
              className="search-clear"
              onClick={() => { setSearchQuery(''); setShowResults(false); setSearchResults([]); }}
            >
              <i className="fas fa-times-circle" />
            </button>
          )}
          <div className="search-glow" />
        </div>

        {/* Groups Section */}
        <div className="search-section">
          <h3 className="section-title">
            <i className="fas fa-users" /> My Groups
          </h3>
          <div className="users-list">
            {groups.length === 0 ? (
              <div className="no-results">No groups joined yet.</div>
            ) : (
              groups.map((g) => <GroupCard key={g._id} group={g} />)
            )}
          </div>
        </div>

        {/* Recent Chats Section */}
        <div className="search-section">
          <h3 className="section-title">
            <i className="fas fa-history" /> Recent Chats
          </h3>
          <div className="users-list">
            {recentChats.length === 0 ? (
              <div className="no-results">No recent chats yet. Start searching to chat!</div>
            ) : (
              recentChats.map((u) => (
                <UserCard key={u._id} user={u} onClick={setSelectedUser} />
              ))
            )}
          </div>
        </div>

        {/* Search Results */}
        <div className={`results-container ${showResults ? 'active' : ''}`}>
          <div className="section-title">Search Results</div>
          <div className="users-list">
            {searchResults.map((u) => (
              <UserCard key={u._id} user={u} onClick={setSelectedUser} />
            ))}
            {showResults && searchResults.length === 0 && (
              <div className="no-results">No users found.</div>
            )}
          </div>
        </div>
      </div>

      {/* Verification Modal */}
      {selectedUser && (
        <VerifyModal
          targetUser={selectedUser}
          onClose={() => setSelectedUser(null)}
        />
      )}

      {/* Group Modals */}
      {groupModal && (
        <GroupModal
          type={groupModal}
          onClose={() => setGroupModal(null)}
          onSuccess={() => { setGroupModal(null); loadContent(); }}
        />
      )}
    </div>
  );
};

export default SearchPage;
