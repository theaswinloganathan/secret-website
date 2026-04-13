const user = JSON.parse(localStorage.getItem('user'));
if (!user || !localStorage.getItem('token')) {
  window.location.href = 'index.html';
}

document.getElementById('myUsername').textContent = user.username;

const socket = io(API_BASE_URL);
socket.emit('register', user.id);

const urlParams = new URLSearchParams(window.location.search);
const targetId = urlParams.get('target');
const targetName = urlParams.get('name');

let currentTargetId = targetId;
let currentChatToken = null;
let currentRoomId = null;

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
      body: JSON.stringify({ receiverId: currentTargetId, content })
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
        body: JSON.stringify({ receiverId: currentTargetId, imageUrl: uploadData.imageUrl, content: '' })
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
