let cameraStream = null;
let currentFacingMode = 'user'; // 'user' for front, 'environment' for back

const cameraModal = document.getElementById('cameraModal');
const cameraVideo = document.getElementById('cameraVideo');
const cameraCanvas = document.getElementById('cameraCanvas');
const captureBtn = document.getElementById('captureBtn');
const flipCameraBtn = document.getElementById('flipCameraBtn');
const closeCameraBtn = document.getElementById('closeCameraBtn');

const startCamera = async () => {
  try {
    if (cameraStream) {
      cameraStream.getTracks().forEach(track => track.stop());
    }
    
    cameraStream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: currentFacingMode },
      audio: false
    });
    
    cameraVideo.srcObject = cameraStream;
    cameraModal.classList.remove('hidden');
  } catch (err) {
    console.error('Error accessing camera:', err);
    alert('Could not access camera. Please ensure you have given permission.');
    closeCamera();
  }
};

const closeCamera = () => {
  if (cameraStream) {
    cameraStream.getTracks().forEach(track => track.stop());
    cameraStream = null;
  }
  cameraModal.classList.add('hidden');
};

const flipCamera = () => {
  currentFacingMode = currentFacingMode === 'user' ? 'environment' : 'user';
  startCamera();
};

const captureImage = async () => {
  const context = cameraCanvas.getContext('2d');
  cameraCanvas.width = cameraVideo.videoWidth;
  cameraCanvas.height = cameraVideo.videoHeight;
  
  // Mirror if it's the front camera for correct horizontal orientation
  if (currentFacingMode === 'user') {
    context.translate(cameraCanvas.width, 0);
    context.scale(-1, 1);
  }
  
  context.drawImage(cameraVideo, 0, 0, cameraCanvas.width, cameraCanvas.height);
  
  cameraCanvas.toBlob(async (blob) => {
    if (!blob) return;
    
    try {
      captureBtn.disabled = true;
      const file = new File([blob], "capture.jpg", { type: "image/jpeg" });
      
      const formData = new FormData();
      formData.append('image', file);

      // Reuse the existing upload logic
      const uploadRes = await fetch(`${API_URL}/upload?receiverId=${currentTargetId}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'X-Chat-Token': currentChatToken
        },
        body: formData
      });

      if (!uploadRes.ok) throw new Error('Upload failed');
      const uploadData = await uploadRes.json();

      const msg = await fetchAPI('/messages', {
        method: 'POST',
        headers: { 'X-Chat-Token': currentChatToken },
        body: JSON.stringify({ receiverId: currentTargetId, imageUrl: uploadData.imageUrl, content: '' })
      });

      socket.emit('send_message', { roomId: currentRoomId, message: msg });
      
      closeCamera();
    } catch (err) {
      console.error(err);
      alert('Failed to send photo: ' + err.message);
    } finally {
      captureBtn.disabled = false;
    }
  }, 'image/jpeg', 0.85);
};

// Event Listeners
flipCameraBtn.addEventListener('click', flipCamera);
closeCameraBtn.addEventListener('click', closeCamera);
captureBtn.addEventListener('click', captureImage);

// Expose start function for chat.js
window.openCameraFeature = startCamera;
