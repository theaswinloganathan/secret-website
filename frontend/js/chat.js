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
let currentInfoMessageId = null;

const getRoomId = (id1, id2) => [id1, id2].sort().join('_');

socket.emit('register', user.id);
if (currentRoomId) socket.emit('join_room', currentRoomId);

// Mark as seen on load
if (currentGroupId) {
  fetchAPI(`/groups/${currentGroupId}/messages/seen`, { method: 'POST' })
    .then(data => {
      if (data.message_ids && data.message_ids.length > 0) {
        socket.emit('group_messages_seen', { 
          roomId: currentRoomId, 
          messageIds: data.message_ids, 
          viewer: data.viewer 
        });
      }
    }).catch(console.error);
}

socket.on('receive_message', (msg) => {
  const isCorrectGroup = currentGroupId && String(msg.groupId) === String(currentGroupId);
  const isCorrectPrivate = !currentGroupId && !msg.groupId && (String(msg.senderId) === String(currentTargetId) || (msg.senderId && String(msg.senderId._id) === String(currentTargetId)) || String(msg.senderId) === String(user.id) || (msg.senderId && String(msg.senderId._id) === String(user.id)));

  if (isCorrectGroup || isCorrectPrivate) {
    appendMessage(msg, (msg.senderId._id || msg.senderId) === user.id);
  }
});

socket.on('group_messages_seen_update', (data) => {
  if (!data.messageIds) return;

  data.messageIds.forEach(msgId => {
    const el = document.querySelector(`[data-id="${msgId}"]`);
    if (el) {
      updateMessageSeenUI(el, data.viewer);
    }
    // Update active info sheet if open for this message
    if (currentInfoMessageId === msgId) {
      addViewerToInfoSheet(data.viewer);
    }
  });
});

socket.on('message_status_update', (data) => {
  if (data.senderId === user.id && data.readerId === currentTargetId) {
    document.querySelectorAll('.message.sent .status-ticks').forEach(tick => {
      tick.classList.add('seen');
      tick.innerHTML = '✓✓';
    });
  }
});

const updateMessageSeenUI = (msgEl, viewer) => {
  let seenContainer = msgEl.querySelector('.seen-avatars-container');
  if (!seenContainer) {
    seenContainer = document.createElement('div');
    seenContainer.className = 'seen-avatars-container';
    msgEl.appendChild(seenContainer);
  }

  let stack = seenContainer.querySelector('.avatar-stack');
  if (!stack) {
    stack = document.createElement('div');
    stack.className = 'avatar-stack';
    seenContainer.appendChild(stack);
  }

  // Prevent duplicate avatars
  if (stack.querySelector(`[data-viewer-id="${viewer.user_id}"]`)) return;

  const count = stack.children.length;
  if (count < 3) {
    const avatar = document.createElement('div');
    avatar.className = 'stacked-avatar';
    avatar.setAttribute('data-viewer-id', viewer.user_id);
    avatar.textContent = viewer.username.charAt(0).toUpperCase();
    avatar.style.background = getUserColor(viewer.username);
    stack.appendChild(avatar);
  } else if (count === 3) {
    const more = document.createElement('div');
    more.className = 'stacked-avatar more-count';
    more.style.background = '#333';
    more.style.color = '#fff';
    more.textContent = '+1';
    stack.appendChild(more);
  } else {
    const more = stack.querySelector('.more-count');
    const currentMore = parseInt(more.textContent.replace('+', '')) || 0;
    more.textContent = `+${currentMore + 1}`;
  }

  let seenText = seenContainer.querySelector('.seen-status-text');
  if (!seenText) {
    seenText = document.createElement('div');
    seenText.className = 'seen-status-text seen-text-cyan';
    seenContainer.appendChild(seenText);
  }
  const totalCount = parseInt(seenText.getAttribute('data-total') || 0) + 1;
  seenText.setAttribute('data-total', totalCount);
  seenText.textContent = `Seen by ${totalCount}`;
};

const getUserColor = (name) => {
  const colors = ['#00f2fe', '#4facfe', '#7000ff', '#ff3366', '#00ff88', '#f9d423', '#fb8c00'];
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return colors[Math.abs(hash) % colors.length];
};

const appendMessage = (msg, isSent) => {
  const container = document.getElementById('messagesContainer');
  const div = document.createElement('div');
  div.className = `message ${isSent ? 'sent' : 'received'}`;
  div.setAttribute('data-id', msg._id);

  // Long press or Click for info (if sent by user)
  if (isSent) {
    let pressTimer;
    const startPress = () => { pressTimer = setTimeout(() => openMessageInfo(msg._id), 600); };
    const cancelPress = () => { clearTimeout(pressTimer); };
    div.addEventListener('mousedown', startPress);
    div.addEventListener('touchstart', startPress);
    div.addEventListener('mouseup', cancelPress);
    div.addEventListener('mouseleave', cancelPress);
    div.addEventListener('touchend', cancelPress);
    div.onclick = (e) => {
      if (currentGroupId) return; // For groups, handled by seenContainer. For private, allow click.
      openMessageInfo(msg._id);
    };
  }

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

  // Time indicator
  const time = new Date(msg.createdAt || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const timeEl = document.createElement('div');
  timeEl.className = 'message-time';
  timeEl.textContent = time;
  div.appendChild(timeEl);

  if (isSent && currentGroupId && msg.seen_by) {
    const seenContainer = document.createElement('div');
    seenContainer.className = 'seen-avatars-container';
    seenContainer.style.cursor = 'pointer';
    seenContainer.onclick = (e) => { e.stopPropagation(); openMessageInfo(msg._id); };
    
    if (msg.seen_by.length > 0) {
      const stack = document.createElement('div');
      stack.className = 'avatar-stack';
      msg.seen_by.slice(0, 3).forEach(s => {
        const avatar = document.createElement('div');
        avatar.className = 'stacked-avatar';
        avatar.textContent = s.username.charAt(0).toUpperCase();
        avatar.style.background = getUserColor(s.username);
        avatar.setAttribute('data-viewer-id', s.user_id);
        stack.appendChild(avatar);
      });
      if (msg.seen_by.length > 3) {
        const more = document.createElement('div');
        more.className = 'stacked-avatar more-count';
        more.style.background = '#333';
        more.textContent = `+${msg.seen_by.length - 3}`;
        stack.appendChild(more);
      }
      seenContainer.appendChild(stack);

      const seenText = document.createElement('div');
      seenText.className = 'seen-status-text seen-text-cyan';
      seenText.setAttribute('data-total', msg.seen_by.length);
      seenText.textContent = `Seen by ${msg.seen_by.length}`;
      seenContainer.appendChild(seenText);
    } else {
      const notSeen = document.createElement('div');
      notSeen.className = 'seen-status-text not-seen-text-gray';
      notSeen.textContent = 'Not seen yet';
      seenContainer.appendChild(notSeen);
    }
    div.appendChild(seenContainer);
  }

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

const openMessageInfo = async (messageId) => {
  currentInfoMessageId = messageId;
  const sheet = document.getElementById('messageInfoSheet');
  const seenList = document.getElementById('seenByList');
  const notSeenList = document.getElementById('notSeenList');
  const sections = document.querySelectorAll('.sheet-section');
  
  seenList.innerHTML = '<div style="padding:10px; opacity:0.6;">Loading...</div>';
  notSeenList.innerHTML = '';
  sheet.classList.add('active');

  try {
    const data = await fetchAPI(`/messages/${messageId}/seen`);
    seenList.innerHTML = '';
    notSeenList.innerHTML = '';

    if (data.type === 'private') {
      const formatTime = (date) => date ? new Date(date).toLocaleString([], { hour: '2-digit', minute: '2-digit', month: 'short', day: 'numeric' }) : '---';
      
      seenList.innerHTML = `
        <div class="info-user-item">
          <div class="info-user-detail">
            <div class="info-user-name" style="color:var(--primary-color)">Sent</div>
            <div class="info-user-time">${formatTime(data.sent_at)}</div>
          </div>
        </div>
        <div class="info-user-item">
          <div class="info-user-detail">
            <div class="info-user-name" style="color:var(--secondary-color)">Delivered</div>
            <div class="info-user-time">${formatTime(data.delivered_at)}</div>
          </div>
        </div>
        <div class="info-user-item">
          <div class="info-user-detail">
            <div class="info-user-name" style="color:var(--success-color)">Seen</div>
            <div class="info-user-time">${formatTime(data.seen_at)}</div>
          </div>
        </div>
      `;
      // Hide Not Seen section for private chats
      if (sections[1]) sections[1].style.display = 'none';
      return;
    }

    // Restore Not Seen section for groups
    if (sections[1]) sections[1].style.display = 'block';

    if (data.seen_by.length === 0) {
      seenList.innerHTML = '<div class="info-user-item"><div class="not-opened-yet">No one has seen it yet.</div></div>';
    } else {
      data.seen_by.forEach(s => addViewerToInfoSheet(s));
    }

    if (data.not_seen_yet.length === 0) {
      notSeenList.innerHTML = '<div class="info-user-item"><div class="not-opened-yet">Everyone has seen it!</div></div>';
    } else {
      data.not_seen_yet.forEach(ns => {
        const item = document.createElement('div');
        item.className = 'info-user-item';
        item.setAttribute('data-user-id', ns.user_id);
        item.innerHTML = `
          <div class="header-avatar" style="width:35px; height:35px; background:${getUserColor(ns.username)}">${ns.username.charAt(0).toUpperCase()}</div>
          <div class="info-user-detail">
            <div class="info-user-name">${ns.username}</div>
            <div class="not-opened-yet">Not opened yet</div>
          </div>
        `;
        notSeenList.appendChild(item);
      });
    }
  } catch (err) {
    seenList.innerHTML = '<div style="padding:10px; color:var(--error-color);">Error loading info</div>';
  }
};

const addViewerToInfoSheet = (viewer) => {
  const seenList = document.getElementById('seenByList');
  const notSeenList = document.getElementById('notSeenList');
  
  // Remove from not seen list if present
  const existingNotSeen = notSeenList.querySelector(`[data-user-id="${viewer.user_id}"]`);
  if (existingNotSeen) existingNotSeen.remove();
  if (notSeenList.children.length === 0) {
    notSeenList.innerHTML = '<div class="info-user-item"><div class="not-opened-yet">Everyone has seen it!</div></div>';
  }

  // Add to seen list
  if (seenList.querySelector(`[data-user-id="${viewer.user_id}"]`)) return;

  const time = new Date(viewer.seen_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const item = document.createElement('div');
  item.className = 'info-user-item';
  item.setAttribute('data-user-id', viewer.user_id);
  item.innerHTML = `
    <div class="header-avatar" style="width:35px; height:35px; background:${getUserColor(viewer.username)}">${viewer.username.charAt(0).toUpperCase()}</div>
    <div class="info-user-detail">
      <div class="info-user-name">${viewer.username}</div>
      <div class="info-user-time">Seen at ${time}</div>
    </div>
  `;
  seenList.appendChild(item);
  
  // Clean up "No one seen yet" if it was there
  const emptyMsg = seenList.querySelector('.not-opened-yet');
  if (emptyMsg && seenList.children.length > 1) emptyMsg.parentElement.remove();
};

document.getElementById('messageInfoSheet').onclick = (e) => {
  if (e.target.id === 'messageInfoSheet' || e.target.className === 'sheet-handle') {
    document.getElementById('messageInfoSheet').classList.remove('active');
    currentInfoMessageId = null;
  }
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
