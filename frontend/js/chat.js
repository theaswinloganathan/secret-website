const user = JSON.parse(localStorage.getItem('user'));
if (!user || !localStorage.getItem('token')) {
  window.location.href = 'index.html';
}

// Set own username if element exists
const myUsernameEl = document.getElementById('myUsername');
if (myUsernameEl) {
  myUsernameEl.textContent = user.username;
}

const socket = io(API_BASE_URL);
socket.emit('register', user.id);

const urlParams = new URLSearchParams(window.location.search);
const targetId = urlParams.get('target');
const targetName = urlParams.get('name');

let currentTargetId = targetId;
let currentChatToken = null;
let currentRoomId = null;
let selectedDuration = 0; // 0 = Off

const getRoomId = (id1, id2) => [id1, id2].sort().join('_');

socket.on('receive_message', (msg) => {
  // Check if we already have this message (e.g. from Optimistic UI)
  const existing = document.querySelector(`[data-id="${msg._id}"]`);
  if (existing) {
    // Just update status if needed
    const ticks = existing.querySelector('.status-ticks');
    if (ticks && msg.status === 'delivered') {
      ticks.innerHTML = '✓✓';
    }
    return;
  }

  if (msg.senderId === currentTargetId || msg.senderId === user.id) {
    appendMessage(msg, msg.senderId === user.id);
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
  
  const contentWrapper = document.createElement('div');
  contentWrapper.className = 'message-content-wrapper';

  if (msg.imageUrl) {
    const fullImageUrl = `${API_BASE_URL}${msg.imageUrl}`;
    const img = document.createElement('img');
    img.src = fullImageUrl;
    img.loading = 'lazy';
    img.onclick = () => window.open(img.src, '_blank');
    contentWrapper.appendChild(img);

    const actions = document.createElement('div');
    actions.className = 'image-actions';
    actions.innerHTML = `
      <a href="${fullImageUrl}" target="_blank" class="img-action-btn"><i class="fas fa-expand"></i> View</a>
      <a href="${fullImageUrl}" download class="img-action-btn"><i class="fas fa-download"></i> Save</a>
    `;
    contentWrapper.appendChild(actions);

    if (msg.content) {
      const text = document.createElement('div');
      text.style.marginTop = '10px';
      text.textContent = msg.content;
      contentWrapper.appendChild(text);
    }
  } else {
    contentWrapper.textContent = msg.content;
  }
  
  div.appendChild(contentWrapper);

  const delBtn = document.createElement('button');
  delBtn.className = 'msg-delete-btn';
  delBtn.innerHTML = '<i class="fas fa-times"></i>';
  delBtn.title = 'Delete';
  
  delBtn.onclick = async (e) => {
    e.stopPropagation();
    if (confirm('Delete this message for everyone?')) {
      try {
        await fetchAPI(`/messages/${msg._id}`, {
          method: 'DELETE',
          headers: { 'X-Chat-Token': currentChatToken }
        });
        socket.emit('delete_message', { roomId: currentRoomId, messageId: msg._id });
        div.remove();
      } catch (err) {
        console.error('Delete failed:', err);
        alert('Could not delete message: ' + err.message);
      }
    }
  };
  div.appendChild(delBtn);

  // Add Status Ticks
  const statusDiv = document.createElement('div');
  statusDiv.className = 'status-ticks';
  if (msg.status === 'seen') {
    statusDiv.classList.add('seen');
    statusDiv.innerHTML = '✓✓';
  } else if (msg.status === 'delivered') {
    statusDiv.classList.add('delivered');
    statusDiv.innerHTML = '✓✓';
  } else {
    statusDiv.innerHTML = '✓';
  }
  div.appendChild(statusDiv);

  if (msg.expiresAt) {
    const expiry = document.createElement('div');
    expiry.className = 'expiry-indicator';
    expiry.innerHTML = `<i class="fas fa-history"></i> Disappearing`;
    div.appendChild(expiry);
  }

  if (!isSent) {
    socket.emit('mark_as_seen', {
      senderId: currentTargetId,
      readerId: user.id,
      roomId: currentRoomId
    });
  }

  container.appendChild(div);
  container.scrollTop = container.scrollHeight;
};

// Screenshot Detection (Desktop)
window.addEventListener('keyup', (e) => {
  if (e.key === 'PrintScreen' || e.keyCode === 44) {
    socket.emit('screenshot_taken', {
      userId: user.id,
      username: user.username,
      roomId: currentRoomId
    });
  }
});

// Detect typical screenshot shortcuts (Ctrl+S, etc. though restricted)
window.addEventListener('keydown', (e) => {
  if ((e.ctrlKey || e.metaKey) && e.key === 's') {
    // Some people use this, but PrintScreen is the main one we can catch
  }
});

const showModal = () => {
  window.location.href = 'search.html';
};

const hideModal = () => {};

const loadMessages = async () => {
  try {
    const messages = await fetchAPI(`/messages/${currentTargetId}`, {
      headers: { 'X-Chat-Token': currentChatToken }
    });
    const container = document.getElementById('messagesContainer');
    container.innerHTML = '';
    messages.forEach(msg => appendMessage(msg, msg.senderId === user.id));
    
    // Mark all as seen when opening
    socket.emit('mark_as_seen', {
      senderId: currentTargetId,
      readerId: user.id,
      roomId: currentRoomId
    });
  } catch (err) {
    console.error(err);
    alert('Session expired or access denied. Please verify again.');
    showModal();
  }
};

const openChat = () => {
  document.getElementById('placeholderArea').style.display = 'none';
  document.getElementById('chatArea').style.display = 'flex';
  document.getElementById('chatTargetName').textContent = targetName;
  document.getElementById('headerAvatar').textContent = targetName.charAt(0).toUpperCase();
  currentRoomId = getRoomId(user.id, currentTargetId);
  socket.emit('join_room', currentRoomId);
  loadMessages();
};

if (currentTargetId && targetName) {
  const savedToken = sessionStorage.getItem(`chatToken_${currentTargetId}`);
  if (savedToken) {
    currentChatToken = savedToken;
    openChat();
  } else {
    showModal();
  }
}

// Verification now happens on search.html

document.getElementById('sendBtn').addEventListener('click', async () => {
  const input = document.getElementById('messageInput');
  const btn = document.getElementById('sendBtn');
  const content = input.value.trim();
  if (!content || btn.disabled) return;
  
  // Optimistic UI: Create temporary message ID
  const tempId = 'temp_' + Date.now();
  const tempMsg = {
    _id: tempId,
    senderId: user.id,
    receiverId: currentTargetId,
    content: content,
    status: 'sending',
    createdAt: new Date().toISOString()
  };
  
  // Append immediately
  appendMessage(tempMsg, true);
  input.value = '';
  input.focus();
  
  try {
    btn.disabled = true;
    const msg = await fetchAPI('/messages', {
      method: 'POST',
      headers: { 'X-Chat-Token': currentChatToken },
      body: JSON.stringify({ 
        receiverId: currentTargetId, 
        content,
        duration: selectedDuration > 0 ? selectedDuration : undefined
      })
    });
    
    // Replace temp message with real one in DOM
    const tempEl = document.querySelector(`[data-id="${tempId}"]`);
    if (tempEl) {
      tempEl.setAttribute('data-id', msg._id);
      const statusTicks = tempEl.querySelector('.status-ticks');
      if (statusTicks) statusTicks.innerHTML = '✓';
    }

    socket.emit('send_message', { roomId: currentRoomId, message: msg });
  } catch (err) {
    console.error(err);
    const tempEl = document.querySelector(`[data-id="${tempId}"]`);
    if (tempEl) {
      tempEl.style.opacity = '0.5';
      const statusTicks = tempEl.querySelector('.status-ticks');
      if (statusTicks) statusTicks.innerHTML = '⚠️';
    }
    alert('Failed to send message.');
  } finally {
    btn.disabled = false;
  }
});

document.getElementById('messageInput').addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    document.getElementById('sendBtn').click();
    socket.emit('typing', { userId: user.id, roomId: currentRoomId, typing: false });
  } else {
    // Emit typing status
    socket.emit('typing', { userId: user.id, roomId: currentRoomId, typing: true });
    
    // Stop typing indicator after 2 seconds of inactivity
    clearTimeout(window.typingTimer);
    window.typingTimer = setTimeout(() => {
      socket.emit('typing', { userId: user.id, roomId: currentRoomId, typing: false });
    }, 2000);
  }
});

const photoBtn = document.getElementById('photoBtn');
const fileInput = document.getElementById('fileInput');

if (photoBtn && fileInput) {
  const galleryBtn = document.getElementById('galleryBtn');
  
  photoBtn.addEventListener('click', () => {
    if (window.openCameraFeature) {
      window.openCameraFeature();
    }
  });

  if (galleryBtn) {
    galleryBtn.addEventListener('click', () => {
      fileInput.click();
    });
  }

  fileInput.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      alert('File size too large (max 5MB)');
      return;
    }

    const formData = new FormData();
    formData.append('image', file);

    try {
      photoBtn.textContent = '⏳';
      photoBtn.disabled = true;

      const uploadRes = await fetch(`${API_URL}/upload?receiverId=${currentTargetId}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'X-Chat-Token': currentChatToken
        },
        body: formData
      });

      if (!uploadRes.ok) {
        const errorData = await uploadRes.json().catch(() => ({}));
        throw new Error(errorData.message || `Server returned ${uploadRes.status}`);
      }
      const uploadData = await uploadRes.json();

      const msg = await fetchAPI('/messages', {
        method: 'POST',
        headers: { 'X-Chat-Token': currentChatToken },
        body: JSON.stringify({ 
          receiverId: currentTargetId, 
          imageUrl: uploadData.imageUrl, 
          content: '',
          duration: selectedDuration > 0 ? selectedDuration : undefined
        })
      });

      socket.emit('send_message', { roomId: currentRoomId, message: msg });
      fileInput.value = '';
    } catch (err) {
      console.error(err);
      alert('Failed to upload image: ' + err.message);
    } finally {
      photoBtn.textContent = '📷';
      photoBtn.disabled = false;
    }
  });
}

const emojiBtn = document.getElementById('emojiBtn');
const emojiPicker = document.getElementById('emojiPicker');
const msgInput = document.getElementById('messageInput');

if (emojiBtn && emojiPicker) {
  emojiBtn.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    emojiPicker.style.display = emojiPicker.style.display === 'none' ? 'block' : 'none';
  });

  emojiPicker.addEventListener('emoji-click', event => {
    msgInput.value += event.detail.unicode;
  });

  document.addEventListener('click', (e) => {
    if (!emojiBtn.contains(e.target) && !emojiPicker.contains(e.target)) {
      emojiPicker.style.display = 'none';
    }
  });
}

// Timer Dropdown Logic
const timerBtn = document.getElementById('timerBtn');
const timerDropdown = document.getElementById('timerDropdown');

if (timerBtn && timerDropdown) {
  timerBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    timerDropdown.style.display = timerDropdown.style.display === 'none' ? 'block' : 'none';
  });

  document.querySelectorAll('.timer-option').forEach(option => {
    option.addEventListener('click', () => {
      document.querySelectorAll('.timer-option').forEach(opt => opt.classList.remove('active'));
      option.classList.add('active');
      selectedDuration = parseInt(option.dataset.value);
      
      if (selectedDuration > 0) {
        timerBtn.classList.add('timer-active');
      } else {
        timerBtn.classList.remove('timer-active');
      }
      
      timerDropdown.style.display = 'none';
    });
  });

  document.addEventListener('click', () => {
    timerDropdown.style.display = 'none';
  });
}

// Ghost Mode Logic
const ghostToggle = document.getElementById('ghostToggle');
const selfGhostBadge = document.getElementById('selfGhostBadge');
const headerAvatar = document.getElementById('headerAvatar');

const updateGhostUI = (active) => {
  if (active) {
    ghostToggle.classList.add('active');
    selfGhostBadge.style.display = 'block';
    headerAvatar.classList.add('ghost-avatar-glow');
    ghostToggle.querySelector('span').textContent = 'Ghost Mode: ON';
  } else {
    ghostToggle.classList.remove('active');
    selfGhostBadge.style.display = 'none';
    headerAvatar.classList.remove('ghost-avatar-glow');
    ghostToggle.querySelector('span').textContent = 'Ghost Mode: OFF';
  }
};

// Initial state
const currentUser = JSON.parse(localStorage.getItem('user'));
if (currentUser && currentUser.ghostMode) {
  updateGhostUI(true);
}

if (ghostToggle) {
  ghostToggle.addEventListener('click', async () => {
    const isActive = ghostToggle.classList.contains('active');
    const newState = !isActive;
    
    try {
      const updatedUser = await fetchAPI('/ghost-mode', {
        method: 'PATCH',
        body: JSON.stringify({ ghostMode: newState })
      });
      
      updateGhostUI(newState);
      
      // Update local storage
      const localUser = JSON.parse(localStorage.getItem('user'));
      localUser.ghostMode = newState;
      localStorage.setItem('user', JSON.stringify(localUser));
      
      // Notify server to update status real-time
      socket.emit('register', user.id); 
      
    } catch (err) {
      console.error(err);
      alert('Failed to update Ghost Mode');
    }
  });
}
