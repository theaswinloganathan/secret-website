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
  if (msg.groupId === currentGroupId || (!currentGroupId && (msg.senderId === currentTargetId || msg.senderId === user.id))) {
    appendMessage(msg, msg.senderId === user.id || msg.senderId._id === user.id);
  }
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

const appendMessage = (msg, isSent) => {
  const container = document.getElementById('messagesContainer');
  const div = document.createElement('div');
  div.className = `message ${isSent ? 'sent' : 'received'}`;
  div.setAttribute('data-id', msg._id);

  if (currentGroupId && !isSent) {
    const nameEl = document.createElement('div');
    nameEl.className = 'sender-name';
    nameEl.style.fontSize = '0.7rem';
    nameEl.style.opacity = '0.6';
    nameEl.style.marginBottom = '4px';
    nameEl.textContent = msg.senderId.username || 'User';
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
  statusTicks.innerHTML = msg.status === 'seen' ? '✓✓' : (msg.status === 'delivered' ? '✓✓' : '✓');
  div.appendChild(statusTicks);

  container.appendChild(div);
  container.scrollTop = container.scrollHeight;
};

const loadMessages = async () => {
  const url = currentGroupId ? `/groups/${currentGroupId}/messages` : `/messages/${currentTargetId}`;
  const messages = await fetchAPI(url, { headers: { 'X-Chat-Token': currentChatToken } });
  document.getElementById('messagesContainer').innerHTML = '';
  messages.forEach(msg => appendMessage(msg, (msg.senderId._id || msg.senderId) === user.id));
};

const openChat = () => {
  document.getElementById('placeholderArea').style.display = 'none';
  document.getElementById('chatArea').style.display = 'flex';
  document.getElementById('chatTargetName').textContent = targetName;
  document.getElementById('headerAvatar').textContent = targetName.charAt(0).toUpperCase();
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

document.getElementById('sendBtn').onclick = async () => {
  const input = document.getElementById('messageInput');
  const content = input.value.trim();
  if (!content) return;

  const body = { content, duration: selectedDuration > 0 ? selectedDuration : undefined };
  if (currentGroupId) body.groupId = currentGroupId;
  else body.receiverId = currentTargetId;

  const msg = await fetchAPI('/messages', {
    method: 'POST',
    headers: { 'X-Chat-Token': currentChatToken },
    body: JSON.stringify(body)
  });

  input.value = '';
  socket.emit('send_message', { roomId: currentRoomId, message: msg });
  appendMessage(msg, true);
};

document.getElementById('messageInput').onkeydown = (e) => {
  if (e.key === 'Enter') document.getElementById('sendBtn').click();
};

// Ghost Mode & Timer logic remains similar...
