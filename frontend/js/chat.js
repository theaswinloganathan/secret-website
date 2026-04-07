const user = JSON.parse(localStorage.getItem('user'));
if (!user || !localStorage.getItem('token')) {
  window.location.href = 'index.html';
}

document.getElementById('myUsername').textContent = user.username;

const socket = io('https://secret-website-6ggb.onrender.com');
socket.emit('register', user.id);

const urlParams = new URLSearchParams(window.location.search);
const targetId = urlParams.get('target');
const targetName = urlParams.get('name');

let currentTargetId = targetId;
let currentChatToken = null;
let currentRoomId = null;

const getRoomId = (id1, id2) => [id1, id2].sort().join('_');

socket.on('user_status', (data) => {
  if (currentTargetId === data.userId && targetName) {
    const indicator = document.getElementById('statusIndicator');
    if (data.status === 'online') {
      indicator.classList.add('online');
    } else {
      indicator.classList.remove('online');
    }
  }
});

socket.on('receive_message', (msg) => {
  if (msg.senderId === currentTargetId || msg.senderId === user.id) {
    appendMessage(msg, msg.senderId === user.id);
  }
});

const appendMessage = (msg, isSent) => {
  const container = document.getElementById('messagesContainer');
  const div = document.createElement('div');
  div.className = `message ${isSent ? 'sent' : 'received'}`;
  div.textContent = msg.content;
  container.appendChild(div);
  container.scrollTop = container.scrollHeight;
};

const showModal = () => {
  document.getElementById('passwordModal').classList.remove('hidden');
  document.getElementById('targetNameHighlight').textContent = targetName;
};

const hideModal = () => {
  document.getElementById('passwordModal').classList.add('hidden');
  document.getElementById('targetChatPassword').value = '';
};

const loadMessages = async () => {
  try {
    const messages = await fetchAPI(`/messages/${currentTargetId}`, {
      headers: { 'X-Chat-Token': currentChatToken }
    });
    const container = document.getElementById('messagesContainer');
    container.innerHTML = '';
    messages.forEach(msg => appendMessage(msg, msg.senderId === user.id));
  } catch (err) {
    console.error(err);
    alert('Session expired or access denied. Please verify again.');
    showModal();
  }
};

const openChat = () => {
  document.getElementById('placeholderArea').style.display = 'none';
  document.getElementById('chatArea').style.display = 'flex';
  document.getElementById('chatTitle').textContent = targetName;
  currentRoomId = getRoomId(user.id, currentTargetId);
  socket.emit('join_room', currentRoomId);
  loadMessages();
  
  const sidebarList = document.getElementById('sidebarList');
  sidebarList.innerHTML = `
    <div class="user-item" style="background-color: rgba(255,255,255,0.1);">
      <div class="avatar">${targetName.charAt(0).toUpperCase()}</div>
      <div>${targetName}</div>
    </div>
  `;
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

document.getElementById('verifyBtn').addEventListener('click', async () => {
  const cpInput = document.getElementById('targetChatPassword').value;
  const errorMsg = document.getElementById('modalErrorMsg');
  const btn = document.getElementById('verifyBtn');
  
  try {
    btn.disabled = true;
    errorMsg.style.display = 'none';
    const data = await fetchAPI('/verify-chat-password', {
      method: 'POST',
      body: JSON.stringify({ targetUserId: currentTargetId, chatPassword: cpInput })
    });
    
    currentChatToken = data.chatToken;
    sessionStorage.setItem(`chatToken_${currentTargetId}`, currentChatToken);
    hideModal();
    openChat();
  } catch (err) {
    errorMsg.textContent = err.message;
    errorMsg.style.display = 'block';
  } finally {
    btn.disabled = false;
  }
});

document.getElementById('sendBtn').addEventListener('click', async () => {
  const input = document.getElementById('messageInput');
  const content = input.value.trim();
  if (!content) return;
  
  try {
    const msg = await fetchAPI('/messages', {
      method: 'POST',
      headers: { 'X-Chat-Token': currentChatToken },
      body: JSON.stringify({ receiverId: currentTargetId, content })
    });
    
    socket.emit('send_message', { roomId: currentRoomId, message: msg });
    input.value = '';
  } catch (err) {
    console.error(err);
    alert('Failed to send message.');
  }
});

document.getElementById('messageInput').addEventListener('keypress', (e) => {
  if (e.key === 'Enter') {
    document.getElementById('sendBtn').click();
  }
});

const emojiBtn = document.getElementById('emojiBtn');
const emojiPicker = document.getElementById('emojiPicker');
const msgInput = document.getElementById('messageInput');

if (emojiBtn && emojiPicker) {
  emojiBtn.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation(); // Prevent the click from bubbling to the document
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
