const user = JSON.parse(localStorage.getItem('user'));
if (!user || !localStorage.getItem('token')) {
  window.location.href = 'index.html';
}

const socket = io(API_BASE_URL);
const urlParams = new URLSearchParams(window.location.search);
const targetId = urlParams.get('target');
const targetName = urlParams.get('name');
const groupId = urlParams.get('groupId');

let currentTargetId = targetId;
let currentGroupId = groupId;
let currentChatToken = null;
let currentRoomId = groupId ? `group_${groupId}` : null;
let selectedDuration = 0;

const getRoomId = (id1, id2) => [id1, id2].sort().join('_');

socket.emit('register', user.id);
if (currentRoomId) socket.emit('join_room', currentRoomId);

socket.on('receive_message', (msg) => {
  const isCorrectGroup = currentGroupId && msg.groupId === currentGroupId;
  const isCorrectPrivate = !currentGroupId && !msg.groupId && (msg.senderId === currentTargetId || msg.senderId._id === currentTargetId || msg.senderId === user.id || msg.senderId._id === user.id);

  if (isCorrectGroup || isCorrectPrivate) {
    appendMessage(msg, (msg.senderId._id || msg.senderId) === user.id);
  }
});

socket.on('message_deleted', (messageId) => {
  const el = document.querySelector(`[data-id="${messageId}"]`);
  if (el) el.remove();
});

socket.on('system_notification', (data) => {
  const container = document.getElementById('messagesContainer');
  const div = document.createElement('div');
  div.className = 'message system';
  div.innerHTML = `<i class="fas fa-shield-alt"></i> ${data.content}`;
  container.appendChild(div);
  container.scrollTop = container.scrollHeight;
});

socket.on('user_status', (data) => {
  if (data.userId === currentTargetId) {
    const headerAvatar = document.getElementById('headerAvatar');
    if (data.status === 'online') {
      headerAvatar.style.border = '2px solid var(--success-color)';
    } else {
      headerAvatar.style.border = '1px solid var(--glass-border)';
    }
  }
});

socket.on('user_typing', (data) => {
  if (data.userId === currentTargetId) {
    const headerInfo = document.querySelector('.header-info');
    let typingEl = document.getElementById('typingIndicator');
    if (data.typing) {
      if (!typingEl) {
        typingEl = document.createElement('div');
        typingEl.id = 'typingIndicator';
        typingEl.style.fontSize = '0.7rem';
        typingEl.style.color = 'var(--primary-color)';
        typingEl.style.marginLeft = '10px';
        typingEl.textContent = 'typing...';
        headerInfo.appendChild(typingEl);
      }
    } else if (typingEl) {
      typingEl.remove();
    }
  }
});

socket.on('message_status_update', (data) => {
  if (data.senderId === user.id && data.readerId === currentTargetId) {
    document.querySelectorAll('.message.sent .status-ticks').forEach(tick => {
      tick.classList.add('seen');
      tick.innerHTML = '✓✓';
    });
  }
});

const appendMessage = (msg, isSent) => {
  const container = document.getElementById('messagesContainer');
  const div = document.createElement('div');
  div.className = `message ${isSent ? 'sent' : 'received'}`;
  div.setAttribute('data-id', msg._id);

  if (currentGroupId && !isSent) {
    const nameEl = document.createElement('div');
    nameEl.style.fontSize = '0.7rem';
    nameEl.style.opacity = '0.6';
    nameEl.style.marginBottom = '4px';
    nameEl.textContent = (msg.senderId && msg.senderId.username) ? msg.senderId.username : 'User';
    div.appendChild(nameEl);
  }

  const contentWrapper = document.createElement('div');
  contentWrapper.className = 'message-content-wrapper';
  
  if (msg.imageUrl) {
    const img = document.createElement('img');
    img.src = `${API_BASE_URL}${msg.imageUrl}`;
    img.className = 'message-image';
    img.onclick = () => window.open(img.src, '_blank');
    contentWrapper.appendChild(img);
  }

  if (msg.content) {
    const text = document.createElement('div');
    text.textContent = msg.content;
    contentWrapper.appendChild(text);
  }
  div.appendChild(contentWrapper);

  const statusTicks = document.createElement('div');
  statusTicks.className = 'status-ticks';
  if (msg.status === 'seen') { statusTicks.classList.add('seen'); statusTicks.innerHTML = '✓✓'; }
  else if (msg.status === 'delivered') { statusTicks.classList.add('delivered'); statusTicks.innerHTML = '✓✓'; }
  else { statusTicks.innerHTML = '✓'; }
  div.appendChild(statusTicks);

  if (msg.expiresAt) {
    const expiry = document.createElement('div');
    expiry.className = 'expiry-indicator';
    expiry.innerHTML = `<i class="fas fa-history"></i> Disappearing`;
    div.appendChild(expiry);
  }

  if (!isSent && !currentGroupId) {
    socket.emit('mark_as_seen', { senderId: currentTargetId, readerId: user.id, roomId: currentRoomId });
  }

  container.appendChild(div);
  container.scrollTop = container.scrollHeight;
};

const loadMessages = async () => {
  const url = currentGroupId ? `/groups/${currentGroupId}/messages` : `/messages/${currentTargetId}`;
  try {
    const messages = await fetchAPI(url, { headers: { 'X-Chat-Token': currentChatToken } });
    document.getElementById('messagesContainer').innerHTML = '';
    messages.forEach(msg => appendMessage(msg, (msg.senderId._id || msg.senderId) === user.id));
  } catch (err) {
    console.error(err);
    if (!currentGroupId) window.location.href = 'search.html';
  }
};

const openChat = () => {
  document.getElementById('placeholderArea').style.display = 'none';
  document.getElementById('chatArea').style.display = 'flex';
  if (targetName) {
    document.getElementById('chatTargetName').textContent = targetName;
    document.getElementById('headerAvatar').textContent = targetName.charAt(0).toUpperCase();
  }
  if (!currentGroupId) currentRoomId = getRoomId(user.id, currentTargetId);
  socket.emit('join_room', currentRoomId);
  loadMessages();
};

if (currentGroupId) {
  openChat();
} else if (currentTargetId) {
  const token = sessionStorage.getItem(`chatToken_${currentTargetId}`);
  if (token) { currentChatToken = token; openChat(); }
  else window.location.href = 'search.html';
}

// Event Listeners
document.getElementById('sendBtn').onclick = async () => {
  const input = document.getElementById('messageInput');
  const content = input.value.trim();
  if (!content) return;

  const body = { content, duration: selectedDuration > 0 ? selectedDuration : undefined };
  if (currentGroupId) body.groupId = currentGroupId;
  else body.receiverId = currentTargetId;

  try {
    const msg = await fetchAPI('/messages', {
      method: 'POST',
      headers: { 'X-Chat-Token': currentChatToken },
      body: JSON.stringify(body)
    });
    input.value = '';
    socket.emit('send_message', { roomId: currentRoomId, message: msg });
    appendMessage(msg, true);
    socket.emit('typing', { userId: user.id, roomId: currentRoomId, typing: false });
  } catch (err) { alert('Failed to send'); }
};

document.getElementById('messageInput').onkeydown = (e) => {
  if (e.key === 'Enter') document.getElementById('sendBtn').click();
  else {
    socket.emit('typing', { userId: user.id, roomId: currentRoomId, typing: true });
    clearTimeout(window.typingTimer);
    window.typingTimer = setTimeout(() => socket.emit('typing', { userId: user.id, roomId: currentRoomId, typing: false }), 2000);
  }
};

// Screenshot Detection
window.addEventListener('keyup', (e) => {
  if (e.key === 'PrintScreen' || e.keyCode === 44) {
    socket.emit('screenshot_taken', { userId: user.id, username: user.username, roomId: currentRoomId });
  }
});

// Image Upload Logic
const photoBtn = document.getElementById('photoBtn');
const galleryBtn = document.getElementById('galleryBtn');
const fileInput = document.getElementById('fileInput');

if (photoBtn) photoBtn.onclick = () => window.openCameraFeature && window.openCameraFeature();
if (galleryBtn) galleryBtn.onclick = () => fileInput.click();
if (fileInput) fileInput.onchange = async (e) => {
  const file = e.target.files[0];
  if (!file) return;
  const formData = new FormData();
  formData.append('image', file);
  try {
    const res = await fetch(`${API_URL}/upload?${currentGroupId ? `groupId=${currentGroupId}` : `receiverId=${currentTargetId}`}`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}`, 'X-Chat-Token': currentChatToken },
      body: formData
    });
    const data = await res.json();
    const body = { imageUrl: data.imageUrl, content: '', duration: selectedDuration > 0 ? selectedDuration : undefined };
    if (currentGroupId) body.groupId = currentGroupId; else body.receiverId = currentTargetId;
    const msg = await fetchAPI('/messages', { method: 'POST', headers: { 'X-Chat-Token': currentChatToken }, body: JSON.stringify(body) });
    socket.emit('send_message', { roomId: currentRoomId, message: msg });
    appendMessage(msg, true);
  } catch (err) { alert('Upload failed'); }
};

// Emoji Logic
const emojiBtn = document.getElementById('emojiBtn');
const emojiPicker = document.getElementById('emojiPicker');
if (emojiBtn && emojiPicker) {
  emojiBtn.onclick = (e) => { e.stopPropagation(); emojiPicker.style.display = emojiPicker.style.display === 'none' ? 'block' : 'none'; };
  emojiPicker.addEventListener('emoji-click', e => document.getElementById('messageInput').value += e.detail.unicode);
  document.addEventListener('click', () => emojiPicker.style.display = 'none');
}

// Timer Logic
const timerBtn = document.getElementById('timerBtn');
const timerDropdown = document.getElementById('timerDropdown');
if (timerBtn && timerDropdown) {
  timerBtn.onclick = (e) => { e.stopPropagation(); timerDropdown.style.display = timerDropdown.style.display === 'none' ? 'block' : 'none'; };
  document.querySelectorAll('.timer-option').forEach(opt => {
    opt.onclick = () => {
      document.querySelectorAll('.timer-option').forEach(o => o.classList.remove('active'));
      opt.classList.add('active');
      selectedDuration = parseInt(opt.dataset.value);
      timerBtn.classList.toggle('timer-active', selectedDuration > 0);
      timerDropdown.style.display = 'none';
    };
  });
  document.addEventListener('click', () => timerDropdown.style.display = 'none');
}

// Ghost Mode Logic
const ghostToggle = document.getElementById('ghostToggle');
const updateGhostUI = (active) => {
  if (!ghostToggle) return;
  ghostToggle.classList.toggle('active', active);
  document.getElementById('selfGhostBadge').style.display = active ? 'block' : 'none';
  document.getElementById('headerAvatar').classList.toggle('ghost-avatar-glow', active);
  ghostToggle.querySelector('span').textContent = `Ghost Mode: ${active ? 'ON' : 'OFF'}`;
};

if (user.ghostMode) updateGhostUI(true);
if (ghostToggle) ghostToggle.onclick = async () => {
  const newState = !ghostToggle.classList.contains('active');
  try {
    await fetchAPI('/ghost-mode', { method: 'PATCH', body: JSON.stringify({ ghostMode: newState }) });
    updateGhostUI(newState);
    const localUser = JSON.parse(localStorage.getItem('user'));
    localUser.ghostMode = newState;
    localStorage.setItem('user', JSON.stringify(localUser));
    socket.emit('register', user.id);
  } catch (err) { alert('Failed to update Ghost Mode'); }
};
