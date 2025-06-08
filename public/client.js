class RemoteDesktop {
  constructor() {
    this.socket = io();
    this.peerConnection = null;
    this.localStream = null;
    this.remoteStream = null;
    this.clientId = null;
    this.clientType = null;
    this.isConnected = false;
    this.stats = { fps: 0, latency: 0 };
    this.currentQuality = 'medium'; // Default quality setting
    
    this.setupSocketHandlers();
    this.setupUI();
    this.setupClipboardHandlers();
    this.startStatsMonitoring();
  }
  
  setupSocketHandlers() {
    this.socket.on('client-id', (id) => {
      this.clientId = id;
      this.updateUI('id', id);
    });
    
    this.socket.on('host-available', async (data) => {
      if (this.clientType === 'client' && !this.isConnected) {
        console.log('Host available:', data.hostId);
        this.updateUI('status', 'Host Available', 'status-connecting');
        // Wait a bit before connecting to ensure UI is updated
        setTimeout(() => {
          this.connectToHost(data.hostId);
        }, 500);
      }
    });
    
    this.socket.on('host-disconnected', () => {
      this.updateUI('status', 'Host Disconnected', 'status-disconnected');
      this.disconnect();
    });
    
    this.socket.on('offer', async (data) => {
      if (this.clientType === 'host') {
        await this.handleOffer(data);
      }
    });
    
    this.socket.on('answer', async (data) => {
      if (this.clientType === 'client') {
        await this.handleAnswer(data);
      }
    });
    
    this.socket.on('ice-candidate', async (data) => {
      await this.handleIceCandidate(data);
    });
    
    // Handle find-host responses
    this.socket.on('host-found', (hostId) => {
      if (this.clientType === 'client') {
        console.log('Found existing host:', hostId);
        this.connectToHost(hostId);
      }
    });
    
    this.socket.on('no-host', () => {
      if (this.clientType === 'client') {
        this.updateUI('status', 'No Host Available', 'status-disconnected');
      }
    });
  }
  
  setupUI() {
    // Client/Host buttons
    const clientBtn = document.querySelector('.btn[data-type="client"]');
    const hostBtn = document.querySelector('.btn[data-type="host"]');
    
    if (clientBtn) {
      clientBtn.onclick = () => this.setClientType('client');
    }
    if (hostBtn) {
      hostBtn.onclick = () => this.setClientType('host');
    }
    
    // Fullscreen button (find by icon class to be more specific)
    const fullscreenBtn = document.querySelector('.btn .fa-expand').parentElement;
    if (fullscreenBtn) {
      fullscreenBtn.onclick = () => this.toggleFullscreen();
    }

    // Clipboard buttons
    const clipboardCopyBtn = document.getElementById('clipboardCopy');
    const clipboardPasteBtn = document.getElementById('clipboardPaste');
    const clipboardCutBtn = document.getElementById('clipboardCut');
    
    if (clipboardCopyBtn) {
      clipboardCopyBtn.onclick = () => this.handleClipboardCopy();
    }
    if (clipboardPasteBtn) {
      clipboardPasteBtn.onclick = () => this.handleClipboardPaste();
    }
    if (clipboardCutBtn) {
      clipboardCutBtn.onclick = () => this.handleClipboardCut();
    }

    // Touch mode buttons
    const touchModeBtn = document.getElementById('touchMode');
    const dragModeBtn = document.getElementById('dragMode');
    
    if (touchModeBtn) {
      touchModeBtn.onclick = () => this.toggleTouchMode();
    }
    if (dragModeBtn) {
      dragModeBtn.onclick = () => this.toggleDragMode();
    }

    // Quality control buttons
    const qualityLowBtn = document.getElementById('qualityLow');
    const qualityMediumBtn = document.getElementById('qualityMedium');
    const qualityHighBtn = document.getElementById('qualityHigh');
    
    if (qualityLowBtn) {
      qualityLowBtn.onclick = () => this.setQuality('low');
    }
    if (qualityMediumBtn) {
      qualityMediumBtn.onclick = () => this.setQuality('medium');
    }
    if (qualityHighBtn) {
      qualityHighBtn.onclick = () => this.setQuality('high');
    }
    
    // Mouse and keyboard events for main area
    const mainArea = document.querySelector('.main');
    if (mainArea) {
      this.setupInputHandlers(mainArea);
    }
    
    // Don't auto-register, wait for user selection
  }
  
  getAccurateMousePosition(e, element) {
    const video = element.querySelector('video');
    if (video && video.videoWidth && video.videoHeight) {
      // Get video element bounds
      const videoRect = video.getBoundingClientRect();
      
      // Calculate video's actual display size (considering object-fit: contain)
      const videoAspectRatio = video.videoWidth / video.videoHeight;
      const containerAspectRatio = videoRect.width / videoRect.height;
      
      let displayWidth, displayHeight, offsetX, offsetY;
      
      if (videoAspectRatio > containerAspectRatio) {
        // Video is wider - fit to width
        displayWidth = videoRect.width;
        displayHeight = videoRect.width / videoAspectRatio;
        offsetX = 0;
        offsetY = (videoRect.height - displayHeight) / 2;
      } else {
        // Video is taller - fit to height
        displayWidth = videoRect.height * videoAspectRatio;
        displayHeight = videoRect.height;
        offsetX = (videoRect.width - displayWidth) / 2;
        offsetY = 0;
      }
      
      // Calculate mouse position relative to actual video content
      const mouseX = e.clientX - videoRect.left - offsetX;
      const mouseY = e.clientY - videoRect.top - offsetY;
      
      // Convert to percentage of actual video content
      const x = Math.max(0, Math.min(100, (mouseX / displayWidth) * 100));
      const y = Math.max(0, Math.min(100, (mouseY / displayHeight) * 100));
      
      return { x, y, valid: true };
    } else {
      // Fallback to container-based calculation
      const rect = element.getBoundingClientRect();
      const x = ((e.clientX - rect.left) / rect.width) * 100;
      const y = ((e.clientY - rect.top) / rect.height) * 100;
      
      return { x, y, valid: false };
    }
  }

  setupInputHandlers(element) {
    // Mouse events
    // Mouse movement throttling for better performance
    let lastMouseSent = 0;
    const mouseThrottle = 16; // ~60fps (1000/60)
    
    element.addEventListener('mousemove', (e) => {
      if (this.isConnected && this.clientType === 'client') {
        const now = Date.now();
        if (now - lastMouseSent >= mouseThrottle) {
          const position = this.getAccurateMousePosition(e, element);
          this.socket.emit('mouse-move', { x: position.x, y: position.y });
          lastMouseSent = now;
          
          // Debug: show coordinates in console occasionally
          if (Math.random() < 0.005) { // 0.5% chance to log
            console.log(`Mouse position: ${position.x.toFixed(1)}%, ${position.y.toFixed(1)}% (${position.valid ? 'accurate' : 'fallback'})`);
          }
        }
      }
    });
    
    // Mouse hold functionality for desktop
    let mouseHoldTimer = null;
    let isMouseHolding = false;
    let mouseStartPosition = null;

    element.addEventListener('mousedown', (e) => {
      if (this.isConnected && this.clientType === 'client') {
        e.preventDefault();
        
        const position = this.getAccurateMousePosition(e, element);
        mouseStartPosition = position;
        isMouseHolding = false;
        
        // Start mouse hold timer (300ms)
        mouseHoldTimer = setTimeout(() => {
          isMouseHolding = true;
          this.socket.emit('mouse-hold-start', {
            x: position.x,
            y: position.y,
            button: e.button === 0 ? 'left' : e.button === 2 ? 'right' : 'middle'
          });
          console.log('Mouse hold started');
        }, 300);
        
        // Send position immediately
        this.socket.emit('mouse-move', { x: position.x, y: position.y });
      }
    });

    element.addEventListener('mouseup', (e) => {
      if (this.isConnected && this.clientType === 'client') {
        e.preventDefault();
        
        // Clear mouse hold timer
        if (mouseHoldTimer) {
          clearTimeout(mouseHoldTimer);
          mouseHoldTimer = null;
        }
        
        const position = this.getAccurateMousePosition(e, element);
        
        if (isMouseHolding) {
          // End mouse hold
          this.socket.emit('mouse-hold-end', {
            x: position.x,
            y: position.y,
            button: e.button === 0 ? 'left' : e.button === 2 ? 'right' : 'middle'
          });
          console.log('Mouse hold ended');
        } else {
          // Regular click
          this.socket.emit('mouse-click', { 
            button: e.button === 0 ? 'left' : e.button === 2 ? 'right' : 'middle',
            double: e.detail === 2
          });
        }
        
        isMouseHolding = false;
        mouseStartPosition = null;
      }
    });

    element.addEventListener('click', (e) => {
      if (this.isConnected && this.clientType === 'client') {
        e.preventDefault();
        // Click is now handled by mousedown/mouseup for better control
      }
    });
    
    element.addEventListener('wheel', (e) => {
      if (this.isConnected && this.clientType === 'client') {
        e.preventDefault();
        const position = this.getAccurateMousePosition(e, element);
        this.socket.emit('mouse-scroll', { 
          x: e.deltaX,
          y: e.deltaY,
          deltaMode: e.deltaMode,
          mouseX: position.x,
          mouseY: position.y
        });
      }
    });
    
    element.addEventListener('contextmenu', (e) => {
      if (this.isConnected && this.clientType === 'client') {
        e.preventDefault();
      }
    });

    // Drag and Drop events
    element.addEventListener('dragstart', (e) => {
      if (this.isConnected && this.clientType === 'client') {
        const position = this.getAccurateMousePosition(e, element);
        this.socket.emit('drag-start', {
          x: position.x,
          y: position.y,
          dataType: e.dataTransfer.types[0] || 'text'
        });
      }
    });

    element.addEventListener('dragover', (e) => {
      if (this.isConnected && this.clientType === 'client') {
        e.preventDefault();
        const position = this.getAccurateMousePosition(e, element);
        this.socket.emit('drag-over', {
          x: position.x,
          y: position.y
        });
      }
    });

    element.addEventListener('drop', (e) => {
      if (this.isConnected && this.clientType === 'client') {
        e.preventDefault();
        const position = this.getAccurateMousePosition(e, element);
        this.socket.emit('drag-drop', {
          x: position.x,
          y: position.y
        });
      }
    });

    // Touch events for mobile and desktop touch support
    let touchStartTime = 0;
    let touchHoldTimer = null;
    let lastTouchPosition = null;
    let isDragging = false;
    let hasMoved = false;

    element.addEventListener('touchstart', (e) => {
      if (this.isConnected && this.clientType === 'client') {
        e.preventDefault();
        const touch = e.touches[0];
        const touchEvent = {
          clientX: touch.clientX,
          clientY: touch.clientY
        };
        const position = this.getAccurateMousePosition(touchEvent, element);
        
        touchStartTime = Date.now();
        lastTouchPosition = position;
        isDragging = false;
        hasMoved = false;
        
        // Start touch hold timer (300ms for faster response)
        touchHoldTimer = setTimeout(() => {
          if (!hasMoved) {
            this.socket.emit('touch-hold', {
              x: position.x,
              y: position.y
            });
          }
        }, 300);

        this.socket.emit('touch-start', {
          x: position.x,
          y: position.y
        });
      }
    });

    // Touch movement throttling
    let lastTouchSent = 0;
    const touchThrottle = 16; // ~60fps
    
    element.addEventListener('touchmove', (e) => {
      if (this.isConnected && this.clientType === 'client') {
        e.preventDefault();
        
        const now = Date.now();
        if (now - lastTouchSent >= touchThrottle) {
          const touch = e.touches[0];
          const touchEvent = {
            clientX: touch.clientX,
            clientY: touch.clientY
          };
          const position = this.getAccurateMousePosition(touchEvent, element);
          
          // Mark as moved
          hasMoved = true;
          
          // Clear touch hold timer on move
          if (touchHoldTimer) {
            clearTimeout(touchHoldTimer);
            touchHoldTimer = null;
          }

          // Check if we should start dragging
          if (lastTouchPosition && !isDragging) {
            const deltaX = Math.abs(position.x - lastTouchPosition.x);
            const deltaY = Math.abs(position.y - lastTouchPosition.y);
            
            // Start dragging if moved significantly (more than 2%)
            if (deltaX > 2 || deltaY > 2) {
              isDragging = true;
              console.log('Touch drag started');
            }
          }

          this.socket.emit('touch-move', {
            x: position.x,
            y: position.y,
            isDragging: isDragging
          });
          
          lastTouchSent = now;
        }
      }
    });

    element.addEventListener('touchend', (e) => {
      if (this.isConnected && this.clientType === 'client') {
        e.preventDefault();
        
        // Clear touch hold timer
        if (touchHoldTimer) {
          clearTimeout(touchHoldTimer);
          touchHoldTimer = null;
        }

        const touchDuration = Date.now() - touchStartTime;
        
        if (lastTouchPosition) {
          this.socket.emit('touch-end', {
            x: lastTouchPosition.x,
            y: lastTouchPosition.y,
            duration: touchDuration,
            wasDragging: isDragging
          });

          // Simulate click for short taps (only if not dragging)
          if (touchDuration < 200 && !isDragging && !hasMoved) {
            setTimeout(() => {
              this.socket.emit('mouse-click', {
                button: 'left',
                double: false
              });
            }, 10);
          }
        }
        
        // Reset touch state
        isDragging = false;
        hasMoved = false;
        lastTouchPosition = null;
      }
    });
    
    // Keyboard events
    document.addEventListener('keydown', (e) => {
      if (this.isConnected && this.clientType === 'client' && 
          document.activeElement.tagName !== 'INPUT') {
        
        // Handle clipboard shortcuts
        if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'c') {
          e.preventDefault();
          this.handleClipboardCopy();
          return;
        }
        
        if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'v') {
          e.preventDefault();
          this.handleClipboardPaste();
          return;
        }
        
        if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'x') {
          e.preventDefault();
          this.handleClipboardCut();
          return;
        }
        
        e.preventDefault();
        
        const modifiers = [];
        if (e.ctrlKey) modifiers.push('control');
        if (e.shiftKey) modifiers.push('shift');
        if (e.altKey) modifiers.push('alt');
        if (e.metaKey) modifiers.push('command');
        
        // Convert browser key codes to RobotJS format
        let key = e.code.toLowerCase()
          .replace('key', '')
          .replace('digit', '')
          .replace('space', 'space')
          .replace('enter', 'enter')
          .replace('backspace', 'backspace')
          .replace('tab', 'tab')
          .replace('escape', 'escape');
        
        this.socket.emit('key-press', { key, modifiers });
      }
    });
  }
  
  async setClientType(type) {
    this.clientType = type;
    
    // Update UI - only connection buttons
    const clientBtn = document.querySelector('.btn[data-type="client"]');
    const hostBtn = document.querySelector('.btn[data-type="host"]');
    
    // Remove active from both buttons
    clientBtn.classList.remove('active');
    hostBtn.classList.remove('active');
    
    if (type === 'client') {
      clientBtn.classList.add('active');
      this.updateUI('status', 'Looking for Host...', 'status-connecting');
      
      // Check if host is already available
      this.socket.emit('find-host');
      
    } else {
      hostBtn.classList.add('active');
      this.updateUI('status', 'Waiting for Connection', 'status-connecting');
      await this.startScreenShare();
    }
    
    this.socket.emit('register', { type });
  }
  
  async startScreenShare() {
    if (this.clientType !== 'host') return;
    
    try {
      console.log('Starting screen share...');
      
      // Stop existing stream if any
      if (this.localStream) {
        this.localStream.getTracks().forEach(track => track.stop());
      }
      
      // Get video constraints based on current quality setting
      const videoSettings = this.getVideoConstraints();
      const videoConstraints = {
        mediaSource: 'screen',
        frameRate: videoSettings.frameRate,
        width: videoSettings.width,
        height: videoSettings.height,
        cursor: 'always'
      };
      
      this.localStream = await navigator.mediaDevices.getDisplayMedia({
        video: videoConstraints,
        audio: {
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false
        }
      });
      
      console.log('Screen share started successfully:', this.localStream);
      console.log('Quality mode:', this.currentQuality);
      this.updateUI('status', 'Screen Sharing', 'status-connected');
      
      // Don't create peer connection yet, wait for client to connect
      
    } catch (error) {
      console.error('Error starting screen share:', error);
      this.updateUI('status', 'Screen Share Failed', 'status-disconnected');
    }
  }
  
  async createPeerConnection() {
    // Optimized RTC configuration for low latency
    this.peerConnection = new RTCPeerConnection({
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' }
      ],
      iceCandidatePoolSize: 10,
      bundlePolicy: 'max-bundle',
      rtcpMuxPolicy: 'require',
      iceTransportPolicy: 'all'
    });
    
    // Add local stream tracks for host with sender configuration
    if (this.localStream && this.clientType === 'host') {
      console.log('Adding local stream tracks to peer connection');
      this.localStream.getTracks().forEach(track => {
        const sender = this.peerConnection.addTrack(track, this.localStream);
        console.log('Added track:', track.kind, track.id);
        
        // Configure video sender parameters for better performance
        if (track.kind === 'video' && sender) {
          const params = sender.getParameters();
          if (params.encodings && params.encodings.length > 0) {
            // Get settings from current quality
            const videoSettings = this.getVideoConstraints();
            
            params.encodings[0].maxBitrate = videoSettings.bitrate;
            params.encodings[0].maxFramerate = videoSettings.maxFramerate;
            
            // Add adaptive resolution scaling for low quality
            if (this.currentQuality === 'low') {
              params.encodings[0].scaleResolutionDownBy = 1.5;
            }
            
            sender.setParameters(params).catch(e => 
              console.warn('Failed to set sender parameters:', e)
            );
          }
        }
      });
    }
    
    // Handle remote stream for client
    this.peerConnection.ontrack = (event) => {
      console.log('Received remote track:', event.track.kind);
      if (event.streams && event.streams[0]) {
        console.log('Received remote stream:', event.streams[0]);
        this.remoteStream = event.streams[0];
        this.displayRemoteStream();
      }
    };
    
    // Handle ICE candidates
    this.peerConnection.onicecandidate = (event) => {
      if (event.candidate) {
        console.log('Sending ICE candidate to:', this.targetId);
        this.socket.emit('ice-candidate', {
          target: this.targetId,
          candidate: event.candidate
        });
      } else {
        console.log('ICE gathering completed');
      }
    };
    
    // Handle connection state
    this.peerConnection.onconnectionstatechange = () => {
      const state = this.peerConnection.connectionState;
      console.log('Connection state changed:', state);
      
      if (state === 'connected') {
        this.isConnected = true;
        this.updateUI('status', 'Connected', 'status-connected');
      } else if (state === 'disconnected' || state === 'failed') {
        this.isConnected = false;
        this.updateUI('status', 'Disconnected', 'status-disconnected');
      } else if (state === 'connecting') {
        this.updateUI('status', 'Connecting...', 'status-connecting');
      }
    };
    
    // Add ICE connection state monitoring
    this.peerConnection.oniceconnectionstatechange = () => {
      console.log('ICE connection state:', this.peerConnection.iceConnectionState);
    };
    
    // For client, create offer after setting up
    if (this.clientType === 'client') {
      setTimeout(() => this.createOffer(), 100);
    }
  }
  
  async connectToHost(hostId) {
    this.targetId = hostId;
    await this.createPeerConnection();
  }
  
  async createOffer() {
    if (!this.targetId) {
      console.error('No target host ID available');
      return;
    }
    
    try {
      // Create offer with specific options for screen sharing
      const offer = await this.peerConnection.createOffer({
        offerToReceiveVideo: true,
        offerToReceiveAudio: true,
        iceRestart: false
      });
      
      // Optimize SDP for low latency
      offer.sdp = this.optimizeSDP(offer.sdp);
      
      await this.peerConnection.setLocalDescription(offer);
      
      console.log('Sending offer to:', this.targetId);
      console.log('Offer SDP:', offer.sdp.substring(0, 100) + '...');
      
      this.socket.emit('offer', {
        target: this.targetId,
        offer: offer
      });
    } catch (error) {
      console.error('Error creating offer:', error);
    }
  }
  
  async handleOffer(data) {
    console.log('Received offer from:', data.from);
    this.targetId = data.from;
    
    try {
      // Create peer connection if not exists
      if (!this.peerConnection) {
        await this.createPeerConnection();
      }
      
      // Set remote description
      await this.peerConnection.setRemoteDescription(new RTCSessionDescription(data.offer));
      
      // Create and send answer
      const answer = await this.peerConnection.createAnswer();
      
      // Optimize answer SDP
      answer.sdp = this.optimizeSDP(answer.sdp);
      
      await this.peerConnection.setLocalDescription(answer);
      
      console.log('Sending answer to:', data.from);
      console.log('Answer SDP:', answer.sdp.substring(0, 100) + '...');
      
      this.socket.emit('answer', {
        target: data.from,
        answer: answer
      });
    } catch (error) {
      console.error('Error handling offer:', error);
    }
  }
  
  async handleAnswer(data) {
    console.log('Received answer from:', data.from);
    try {
      // Optimize answer SDP
      data.answer.sdp = this.optimizeSDP(data.answer.sdp);
      await this.peerConnection.setRemoteDescription(new RTCSessionDescription(data.answer));
      console.log('Answer set successfully');
    } catch (error) {
      console.error('Error setting answer:', error);
    }
  }

  optimizeSDP(sdp) {
    // Optimize SDP for low latency and adaptive quality
    let optimizedSdp = sdp;
    
    // Get bitrate settings from current quality
    const videoSettings = this.getVideoConstraints();
    const videoBitrate = Math.round(videoSettings.bitrate / 1000); // Convert to kbps
    const audioBitrate = this.currentQuality === 'low' ? 64 : 128; // kbps
    
    // Set adaptive video bitrate
    optimizedSdp = optimizedSdp.replace(
      /(m=video.*\r\n)/,
      `$1b=AS:${videoBitrate}\r\n`
    );
    
    // Codec preference based on quality
    if (this.currentQuality === 'low') {
      // VP9 for better compression on low quality
      optimizedSdp = optimizedSdp.replace(
        /(a=rtpmap:(\d+) VP9\/90000\r\n)/,
        `$1a=fmtp:$2 max-fr=${videoSettings.maxFramerate};max-fs=921600\r\n`
      );
    } else {
      // VP8 for better performance on medium/high quality
      optimizedSdp = optimizedSdp.replace(
        /(a=rtpmap:(\d+) VP8\/90000\r\n)/,
        `$1a=fmtp:$2 max-fr=${videoSettings.maxFramerate};max-fs=${this.currentQuality === 'high' ? 2073600 : 1382400}\r\n`
      );
    }
    
    // H.264 fallback with adaptive settings
    const maxMbps = this.currentQuality === 'low' ? 40500 : (this.currentQuality === 'high' ? 125000 : 62500);
    optimizedSdp = optimizedSdp.replace(
      /(a=rtpmap:(\d+) H264\/90000\r\n)/,
      `$1a=fmtp:$2 level-asymmetry-allowed=1;packetization-mode=1;profile-level-id=42e01f;max-br=${videoBitrate};max-mbps=${maxMbps}\r\n`
    );
    
    // Set adaptive audio bitrate
    optimizedSdp = optimizedSdp.replace(
      /(m=audio.*\r\n)/,
      `$1b=AS:${audioBitrate}\r\n`
    );
    
    // Enable error resilience features
    if (!optimizedSdp.includes('a=rtcp-fb:')) {
      // Add for VP8
      optimizedSdp = optimizedSdp.replace(
        /(a=rtpmap:(\d+) VP8\/90000\r\n)/g,
        '$1a=rtcp-fb:$2 nack\r\na=rtcp-fb:$2 nack pli\r\na=rtcp-fb:$2 goog-remb\r\n'
      );
      
      // Add for VP9
      optimizedSdp = optimizedSdp.replace(
        /(a=rtpmap:(\d+) VP9\/90000\r\n)/g,
        '$1a=rtcp-fb:$2 nack\r\na=rtcp-fb:$2 nack pli\r\na=rtcp-fb:$2 goog-remb\r\n'
      );
      
      // Add for H.264
      optimizedSdp = optimizedSdp.replace(
        /(a=rtpmap:(\d+) H264\/90000\r\n)/g,
        '$1a=rtcp-fb:$2 nack\r\na=rtcp-fb:$2 nack pli\r\na=rtcp-fb:$2 goog-remb\r\n'
      );
    }
    
    return optimizedSdp;
  }
  
  async handleIceCandidate(data) {
    if (this.peerConnection && data.candidate) {
      console.log('Received ICE candidate from:', data.from);
      try {
        await this.peerConnection.addIceCandidate(new RTCIceCandidate(data.candidate));
        console.log('ICE candidate added successfully');
      } catch (error) {
        console.error('Error adding ICE candidate:', error);
      }
    }
  }
  
  displayRemoteStream() {
    console.log('Displaying remote stream:', this.remoteStream);
    const main = document.querySelector('.main');
    const placeholder = main.querySelector('.screen-placeholder');
    
    if (placeholder) {
      placeholder.style.display = 'none';
    }
    
    let video = main.querySelector('video');
    if (!video) {
      video = document.createElement('video');
      video.style.cssText = `
        width: 100%;
        height: 100%;
        object-fit: contain;
        background: #000;
        display: block;
        cursor: none;
        transition: all 0.3s ease;
      `;
      video.autoplay = true;
      video.playsInline = true;
      video.muted = true; // Add muted to prevent autoplay issues
      main.appendChild(video);
      console.log('Created video element');
      
      // Add resize listener untuk memastikan video menyesuaikan ukuran
      this.setupVideoResizeListener(video);
    }
    
    video.srcObject = this.remoteStream;
    
    // Add event listeners for debugging
    video.onloadedmetadata = () => {
      console.log('Video metadata loaded');
      console.log(`Video dimensions: ${video.videoWidth}x${video.videoHeight}`);
      console.log(`Video element size: ${video.getBoundingClientRect().width}x${video.getBoundingClientRect().height}`);
      video.play().catch(e => console.error('Video play error:', e));
    };
    
    video.onplay = () => {
      console.log('Video started playing');
      console.log(`Final video dimensions: ${video.videoWidth}x${video.videoHeight}`);
    };
    
    video.onerror = (e) => console.error('Video error:', e);
  }
  
  setupVideoResizeListener(video) {
    // Listen untuk window resize events
    const handleResize = () => {
      if (video && video.srcObject) {
        // Force repaint dengan mengubah style secara temporary
        const originalDisplay = video.style.display;
        video.style.display = 'none';
        
        // Trigger reflow
        void video.offsetHeight;
        
        video.style.display = originalDisplay;
        
        console.log('Video resized to fit new container');
      }
    };
    
    window.addEventListener('resize', handleResize);
    
    // Cleanup function
    if (!this.videoResizeCleanup) {
      this.videoResizeCleanup = () => {
        window.removeEventListener('resize', handleResize);
      };
    }
  }
  
  disconnect() {
    this.isConnected = false;
    
    if (this.peerConnection) {
      this.peerConnection.close();
      this.peerConnection = null;
    }
    
    if (this.localStream) {
      this.localStream.getTracks().forEach(track => track.stop());
      this.localStream = null;
    }
    
    // Cleanup video resize listener
    if (this.videoResizeCleanup) {
      this.videoResizeCleanup();
      this.videoResizeCleanup = null;
    }
    
    const video = document.querySelector('.main video');
    if (video) {
      video.remove();
    }
    
    const placeholder = document.querySelector('.screen-placeholder');
    if (placeholder) {
      placeholder.style.display = 'block';
    }
    
    this.updateUI('status', 'Disconnected', 'status-disconnected');
  }
  
  toggleFullscreen() {
    const main = document.querySelector('.main');
    
    if (!document.fullscreenElement) {
      main.requestFullscreen().catch(err => {
        console.error('Error attempting to enable fullscreen:', err);
      });
    } else {
      document.exitFullscreen();
    }
  }

  toggleTouchMode() {
    const touchModeBtn = document.getElementById('touchMode');
    if (touchModeBtn) {
      touchModeBtn.classList.toggle('active');
      const isActive = touchModeBtn.classList.contains('active');
      
      if (isActive) {
        console.log('Touch mode enabled');
        // Add visual feedback
        document.querySelector('.main').style.cursor = 'pointer';
      } else {
        console.log('Touch mode disabled');
        document.querySelector('.main').style.cursor = 'none';
      }
    }
  }

  toggleDragMode() {
    const dragModeBtn = document.getElementById('dragMode');
    if (dragModeBtn) {
      dragModeBtn.classList.toggle('active');
      const isActive = dragModeBtn.classList.contains('active');
      
      if (isActive) {
        console.log('Drag mode enabled');
        // Add visual feedback
        document.querySelector('.main').style.cursor = 'grab';
      } else {
        console.log('Drag mode disabled');
        document.querySelector('.main').style.cursor = 'none';
      }
    }
  }
  
  updateUI(type, value, className = '') {
    switch (type) {
      case 'id':
        const idElement = document.querySelector('.info-row span:nth-child(2)');
        if (idElement) idElement.textContent = value;
        break;
        
      case 'status':
        const statusElement = document.querySelector('.info-row:nth-child(2) span:nth-child(2)');
        if (statusElement) {
          statusElement.textContent = value;
          statusElement.className = className;
        }
        break;
    }
  }
  
  // Clipboard functionality
  async handleClipboardCopy() {
    try {
      // Request clipboard content from host
      this.socket.emit('clipboard-copy');
    } catch (error) {
      console.error('Clipboard copy error:', error);
    }
  }

  async handleClipboardPaste() {
    try {
      // Try to read from local clipboard first
      if (navigator.clipboard && navigator.clipboard.readText) {
        const text = await navigator.clipboard.readText();
        if (text) {
          this.socket.emit('clipboard-paste', { text });
          return;
        }
      }
      
      // Fallback: show paste dialog
      this.showPasteDialog();
    } catch (error) {
      console.error('Clipboard paste error:', error);
      this.showPasteDialog();
    }
  }

  async handleClipboardCut() {
    try {
      // Request clipboard cut from host
      this.socket.emit('clipboard-cut');
    } catch (error) {
      console.error('Clipboard cut error:', error);
    }
  }

  showPasteDialog() {
    const text = prompt('Paste your text here:');
    if (text) {
      this.socket.emit('clipboard-paste', { text });
    }
  }

  setupClipboardHandlers() {
    // Listen for clipboard content from host
    this.socket.on('clipboard-content', async (data) => {
      try {
        if (navigator.clipboard && navigator.clipboard.writeText) {
          await navigator.clipboard.writeText(data.text);
          console.log('Clipboard updated with host content');
        } else {
          // Fallback: show content in alert
          alert('Clipboard content: ' + data.text);
        }
      } catch (error) {
        console.error('Failed to write to clipboard:', error);
      }
    });
  }

  startStatsMonitoring() {
    let lastFramesDecoded = 0;
    let lastTimestamp = 0;
    
    setInterval(() => {
      if (this.isConnected && this.peerConnection) {
        this.peerConnection.getStats().then(stats => {
          stats.forEach(report => {
            if (report.type === 'inbound-rtp' && report.mediaType === 'video') {
              // Calculate real FPS
              if (report.framesDecoded && lastFramesDecoded) {
                const currentTime = report.timestamp;
                const timeDiff = (currentTime - lastTimestamp) / 1000; // Convert to seconds
                const framesDiff = report.framesDecoded - lastFramesDecoded;
                
                if (timeDiff > 0) {
                  this.stats.fps = Math.round(framesDiff / timeDiff);
                }
              }
              
              lastFramesDecoded = report.framesDecoded || 0;
              lastTimestamp = report.timestamp || Date.now();
              
              // Also try the direct FPS if available
              if (report.framesPerSecond) {
                this.stats.fps = Math.round(report.framesPerSecond);
              }
            }
            
            // Get real latency from RTT
            if (report.type === 'candidate-pair' && report.state === 'succeeded') {
              if (report.currentRoundTripTime) {
                this.stats.latency = Math.round(report.currentRoundTripTime * 1000);
              }
            }
          });
        }).catch(e => console.warn('Stats error:', e));
      } else {
        this.stats.fps = 0;
        this.stats.latency = 0;
      }
      
      // Update UI
      document.getElementById('fps').textContent = this.stats.fps;
      document.getElementById('latency').textContent = this.stats.latency + 'ms';
      document.getElementById('statsFps').textContent = this.stats.fps;
      document.getElementById('statsLatency').textContent = this.stats.latency;
      
    }, 1000);
  }

  // Quality control functionality
  async setQuality(quality) {
    this.currentQuality = quality;
    console.log(`Quality set to: ${quality}`);
    
    // Update UI - remove active from all quality buttons
    const qualityButtons = ['qualityLow', 'qualityMedium', 'qualityHigh'];
    qualityButtons.forEach(id => {
      const btn = document.getElementById(id);
      if (btn) btn.classList.remove('active');
    });
    
    // Add active to selected button
    const selectedBtn = document.getElementById(`quality${quality.charAt(0).toUpperCase() + quality.slice(1)}`);
    if (selectedBtn) selectedBtn.classList.add('active');
    
    // If currently screen sharing, restart with new quality
    if (this.clientType === 'host' && this.localStream) {
      console.log('Restarting screen share with new quality...');
      await this.startScreenShare();
    }
  }
  
  getVideoConstraints() {
    const qualitySettings = {
      low: {
        frameRate: { ideal: 24, max: 30 },
        width: { ideal: 1280, max: 1366 },
        height: { ideal: 720, max: 768 },
        bitrate: 1500000, // 1.5 Mbps
        maxFramerate: 24
      },
      medium: {
        frameRate: { ideal: 30, max: 35 },
        width: { ideal: 1600, max: 1680 },
        height: { ideal: 900, max: 1050 },
        bitrate: 3000000, // 3 Mbps
        maxFramerate: 30
      },
      high: {
        frameRate: { ideal: 45, max: 60 },
        width: { ideal: 1920, max: 2560 },
        height: { ideal: 1080, max: 1440 },
        bitrate: 6000000, // 6 Mbps
        maxFramerate: 45
      }
    };
    
    return qualitySettings[this.currentQuality] || qualitySettings.medium;
  }
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  new RemoteDesktop();
}); 