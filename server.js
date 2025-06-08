#!/usr/bin/env node
const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const robot = require('robotjs');

// Optimize RobotJS for better performance
robot.setMouseDelay(1); // Reduce mouse delay from default 10ms to 1ms
robot.setKeyboardDelay(1); // Reduce keyboard delay from default 10ms to 1ms
const path = require('path');
const os = require('os');
const clipboardy = require('clipboardy');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

const PORT = process.env.PORT || 3000;

// Serve static files
app.use(express.static('public'));

// Store connected clients
const clients = new Map();
let hostId = null;

// Get local IP address
function getLocalIP() {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const interface of interfaces[name]) {
      if (interface.family === 'IPv4' && !interface.internal) {
        return interface.address;
      }
    }
  }
  return 'localhost';
}

// Generate unique ID
function generateId() {
  return Math.random().toString(36).substr(2, 9);
}

io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);
  
  // Generate unique client ID
  const clientId = generateId();
  clients.set(socket.id, { id: clientId, type: null, socket });
  
  // Send client ID
  socket.emit('client-id', clientId);
  
  // Handle client type registration
  socket.on('register', (data) => {
    const client = clients.get(socket.id);
    if (client) {
      client.type = data.type;
      console.log(`Client ${clientId} registered as ${data.type}`);
      
      if (data.type === 'host') {
        hostId = clientId;
        // Broadcast host availability
        socket.broadcast.emit('host-available', { hostId: clientId });
      }
      
      // Send updated client list
      const clientList = Array.from(clients.values()).map(c => ({
        id: c.id,
        type: c.type
      }));
      io.emit('clients-updated', clientList);
    }
  });
  
  // Handle host finding
  socket.on('find-host', () => {
    if (hostId) {
      socket.emit('host-found', hostId);
    } else {
      socket.emit('no-host');
    }
  });
  
  // Handle WebRTC signaling
  socket.on('offer', (data) => {
    console.log(`Offer from ${clients.get(socket.id).id} to ${data.target}`);
    const targetClient = Array.from(clients.values()).find(c => c.id === data.target);
    if (targetClient) {
      targetClient.socket.emit('offer', {
        from: clients.get(socket.id).id,
        offer: data.offer
      });
    } else {
      console.log('Target client not found:', data.target);
    }
  });
  
  socket.on('answer', (data) => {
    console.log(`Answer from ${clients.get(socket.id).id} to ${data.target}`);
    const targetClient = Array.from(clients.values()).find(c => c.id === data.target);
    if (targetClient) {
      targetClient.socket.emit('answer', {
        from: clients.get(socket.id).id,
        answer: data.answer
      });
    } else {
      console.log('Target client not found:', data.target);
    }
  });
  
  socket.on('ice-candidate', (data) => {
    console.log(`ICE candidate from ${clients.get(socket.id).id} to ${data.target}`);
    const targetClient = Array.from(clients.values()).find(c => c.id === data.target);
    if (targetClient) {
      targetClient.socket.emit('ice-candidate', {
        from: clients.get(socket.id).id,
        candidate: data.candidate
      });
    } else {
      console.log('Target client not found for ICE candidate:', data.target);
    }
  });
  
  // Handle mouse and keyboard control with queue-based processing
  socket.on('mouse-move', (data) => {
    const client = clients.get(socket.id);
    if (client && client.type === 'client') {
      try {
        // Store the latest position in global queue
        mouseMoveQueue.set(socket.id, {
          x: data.x,
          y: data.y,
          timestamp: Date.now()
        });
      } catch (error) {
        console.error('Mouse move error:', error);
      }
    }
  });
  
  socket.on('mouse-click', (data) => {
    const client = clients.get(socket.id);
    if (client && client.type === 'client') {
      try {
        robot.mouseClick(data.button || 'left', data.double || false);
      } catch (error) {
        console.error('Mouse click error:', error);
      }
    }
  });
  
  socket.on('mouse-scroll', (data) => {
    const client = clients.get(socket.id);
    if (client && client.type === 'client') {
      try {
        // Move mouse to position first if provided
        if (data.mouseX !== undefined && data.mouseY !== undefined) {
          const screenSize = robot.getScreenSize();
          const x = Math.floor((data.mouseX / 100) * screenSize.width);
          const y = Math.floor((data.mouseY / 100) * screenSize.height);
          robot.moveMouse(x, y);
        }
        
        // Normalize scroll values based on delta mode
        let scrollX = data.x || 0;
        let scrollY = data.y || 0;
        
        // Convert pixel deltas to scroll units
        if (data.deltaMode === 0) { // DOM_DELTA_PIXEL
          scrollX = Math.round(scrollX / 10);
          scrollY = Math.round(scrollY / 10);
        } else if (data.deltaMode === 1) { // DOM_DELTA_LINE
          scrollX = Math.round(scrollX * 3);
          scrollY = Math.round(scrollY * 3);
        }
        
        robot.scrollMouse(scrollX, scrollY);
      } catch (error) {
        console.error('Mouse scroll error:', error);
      }
    }
  });
  
  socket.on('key-press', (data) => {
    const client = clients.get(socket.id);
    if (client && client.type === 'client') {
      try {
        if (data.key) {
          let key = data.key;
          
          // Map of invalid keys to valid RobotJS keys
          const keyMap = {
            'arrowup': 'up',
            'arrowdown': 'down',
            'arrowleft': 'left',
            'arrowright': 'right',
            'meta': 'command',
            'control': 'ctrl',
            'delete': 'backspace',
            'insert': 'home',
            'pageup': 'page_up',
            'pagedown': 'page_down'
          };
          
          // Apply key mapping
          if (keyMap[key.toLowerCase()]) {
            key = keyMap[key.toLowerCase()];
          }
          
          // Skip obviously invalid keys
          if (key.length > 1 && !['backspace', 'delete', 'enter', 'tab', 'escape', 'up', 'down', 'left', 'right', 'home', 'end', 'space', 'command', 'alt', 'ctrl', 'shift'].includes(key.toLowerCase())) {
            console.log('Skipping invalid key:', key);
            return;
          }
          
          robot.keyTap(key, data.modifiers || []);
        }
      } catch (error) {
        console.error('Key press error:', error);
      }
    }
  });
  
  socket.on('key-type', (data) => {
    const client = clients.get(socket.id);
    if (client && client.type === 'client') {
      try {
        robot.typeString(data.text);
      } catch (error) {
        console.error('Key type error:', error);
      }
    }
  });

  // Clipboard events
  socket.on('clipboard-copy', async (data) => {
    const client = clients.get(socket.id);
    if (client && client.type === 'client') {
      try {
        // Copy current selection to clipboard
        robot.keyTap('c', process.platform === 'darwin' ? ['command'] : ['control']);
        
        // Wait a bit and then read clipboard content
        setTimeout(async () => {
          try {
            const clipboardContent = await clipboardy.read();
            socket.emit('clipboard-content', { text: clipboardContent });
          } catch (error) {
            console.error('Failed to read clipboard:', error);
            socket.emit('clipboard-content', { text: 'Content copied to host clipboard' });
          }
        }, 200);
      } catch (error) {
        console.error('Clipboard copy error:', error);
      }
    }
  });

  socket.on('clipboard-paste', async (data) => {
    const client = clients.get(socket.id);
    if (client && client.type === 'client') {
      try {
        if (data.text) {
          // Write to host clipboard first, then paste
          await clipboardy.write(data.text);
          robot.keyTap('v', process.platform === 'darwin' ? ['command'] : ['control']);
        } else {
          // Paste from host clipboard
          robot.keyTap('v', process.platform === 'darwin' ? ['command'] : ['control']);
        }
      } catch (error) {
        console.error('Clipboard paste error:', error);
      }
    }
  });

  socket.on('clipboard-cut', async (data) => {
    const client = clients.get(socket.id);
    if (client && client.type === 'client') {
      try {
        // Cut current selection to clipboard
        robot.keyTap('x', process.platform === 'darwin' ? ['command'] : ['control']);
        
        // Wait a bit and then read clipboard content
        setTimeout(async () => {
          try {
            const clipboardContent = await clipboardy.read();
            socket.emit('clipboard-content', { text: clipboardContent });
          } catch (error) {
            console.error('Failed to read clipboard:', error);
            socket.emit('clipboard-content', { text: 'Content cut to host clipboard' });
          }
        }, 200);
      } catch (error) {
        console.error('Clipboard cut error:', error);
      }
    }
  });

  // Drag and Drop events
  socket.on('drag-start', (data) => {
    const client = clients.get(socket.id);
    if (client && client.type === 'client') {
      try {
        const screenSize = robot.getScreenSize();
        const x = Math.floor((data.x / 100) * screenSize.width);
        const y = Math.floor((data.y / 100) * screenSize.height);
        
        robot.moveMouse(x, y);
        robot.mouseToggle('down', 'left');
      } catch (error) {
        console.error('Drag start error:', error);
      }
    }
  });

  socket.on('drag-over', (data) => {
    const client = clients.get(socket.id);
    if (client && client.type === 'client') {
      try {
        const screenSize = robot.getScreenSize();
        const x = Math.floor((data.x / 100) * screenSize.width);
        const y = Math.floor((data.y / 100) * screenSize.height);
        
        robot.dragMouse(x, y);
      } catch (error) {
        console.error('Drag over error:', error);
      }
    }
  });

  socket.on('drag-drop', (data) => {
    const client = clients.get(socket.id);
    if (client && client.type === 'client') {
      try {
        const screenSize = robot.getScreenSize();
        const x = Math.floor((data.x / 100) * screenSize.width);
        const y = Math.floor((data.y / 100) * screenSize.height);
        
        robot.moveMouse(x, y);
        robot.mouseToggle('up', 'left');
      } catch (error) {
        console.error('Drag drop error:', error);
      }
    }
  });

  // Touch events with drag support
  const touchSessions = new Map(); // Track touch sessions per client
  
  socket.on('touch-start', (data) => {
    const client = clients.get(socket.id);
    if (client && client.type === 'client') {
      try {
        const screenSize = robot.getScreenSize();
        const x = Math.floor((data.x / 100) * screenSize.width);
        const y = Math.floor((data.y / 100) * screenSize.height);
        
        robot.moveMouse(x, y);
        
        // Store touch session data
        touchSessions.set(socket.id, {
          startX: x,
          startY: y,
          isDragging: false,
          startTime: Date.now()
        });
      } catch (error) {
        console.error('Touch start error:', error);
      }
    }
  });

  socket.on('touch-move', (data) => {
    const client = clients.get(socket.id);
    if (client && client.type === 'client') {
      try {
        const screenSize = robot.getScreenSize();
        const x = Math.floor((data.x / 100) * screenSize.width);
        const y = Math.floor((data.y / 100) * screenSize.height);
        
        const touchSession = touchSessions.get(socket.id);
        if (touchSession) {
          // If this is the first significant movement, start dragging
          if (!touchSession.isDragging) {
            const deltaX = Math.abs(x - touchSession.startX);
            const deltaY = Math.abs(y - touchSession.startY);
            
            // Start dragging if moved more than 5 pixels
            if (deltaX > 5 || deltaY > 5) {
              touchSession.isDragging = true;
              robot.moveMouse(touchSession.startX, touchSession.startY);
              robot.mouseToggle('down', 'left');
              console.log('Started dragging from touch');
            }
          }
          
          // Continue dragging
          if (touchSession.isDragging) {
            robot.dragMouse(x, y);
          } else {
            robot.moveMouse(x, y);
          }
        } else {
          robot.moveMouse(x, y);
        }
      } catch (error) {
        console.error('Touch move error:', error);
      }
    }
  });

  socket.on('touch-end', (data) => {
    const client = clients.get(socket.id);
    if (client && client.type === 'client') {
      try {
        const screenSize = robot.getScreenSize();
        const x = Math.floor((data.x / 100) * screenSize.width);
        const y = Math.floor((data.y / 100) * screenSize.height);
        
        const touchSession = touchSessions.get(socket.id);
        if (touchSession) {
          if (touchSession.isDragging) {
            // End drag operation
            robot.moveMouse(x, y);
            robot.mouseToggle('up', 'left');
            console.log('Ended drag from touch');
          } else {
            // Simple tap - move mouse to position
            robot.moveMouse(x, y);
          }
          
          // Clean up touch session
          touchSessions.delete(socket.id);
        } else {
          robot.moveMouse(x, y);
        }
      } catch (error) {
        console.error('Touch end error:', error);
      }
    }
  });

  socket.on('touch-hold', (data) => {
    const client = clients.get(socket.id);
    if (client && client.type === 'client') {
      try {
        const screenSize = robot.getScreenSize();
        const x = Math.floor((data.x / 100) * screenSize.width);
        const y = Math.floor((data.y / 100) * screenSize.height);
        
        robot.moveMouse(x, y);
        
        // For touch hold, we can either right-click or start drag
        const touchSession = touchSessions.get(socket.id);
        if (touchSession && !touchSession.isDragging) {
          // Start a drag operation on hold
          touchSession.isDragging = true;
          robot.mouseToggle('down', 'left');
          console.log('Started drag from touch hold');
        }
      } catch (error) {
        console.error('Touch hold error:', error);
      }
    }
  });

  // Mouse hold events for desktop
  socket.on('mouse-hold-start', (data) => {
    const client = clients.get(socket.id);
    if (client && client.type === 'client') {
      try {
        const screenSize = robot.getScreenSize();
        const x = Math.floor((data.x / 100) * screenSize.width);
        const y = Math.floor((data.y / 100) * screenSize.height);
        
        robot.moveMouse(x, y);
        
        // Start drag operation
        robot.mouseToggle('down', data.button || 'left');
        console.log(`Mouse hold started with ${data.button} button`);
        
        // Store mouse session
        touchSessions.set(socket.id, {
          startX: x,
          startY: y,
          isDragging: true,
          startTime: Date.now(),
          button: data.button || 'left'
        });
      } catch (error) {
        console.error('Mouse hold start error:', error);
      }
    }
  });

  socket.on('mouse-hold-end', (data) => {
    const client = clients.get(socket.id);
    if (client && client.type === 'client') {
      try {
        const screenSize = robot.getScreenSize();
        const x = Math.floor((data.x / 100) * screenSize.width);
        const y = Math.floor((data.y / 100) * screenSize.height);
        
        robot.moveMouse(x, y);
        
        // End drag operation
        robot.mouseToggle('up', data.button || 'left');
        console.log(`Mouse hold ended with ${data.button} button`);
        
        // Clean up session
        touchSessions.delete(socket.id);
      } catch (error) {
        console.error('Mouse hold end error:', error);
      }
    }
  });
  
  // Handle disconnect
  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
    const client = clients.get(socket.id);
    
    // Clean up any ongoing touch/mouse sessions
    if (touchSessions.has(socket.id)) {
      const session = touchSessions.get(socket.id);
      if (session.isDragging) {
        try {
          // End any ongoing drag operation
          robot.mouseToggle('up', session.button || 'left');
          console.log('Cleaned up drag operation for disconnected client');
        } catch (error) {
          console.error('Error cleaning up drag operation:', error);
        }
      }
      touchSessions.delete(socket.id);
    }
    
    if (client && client.id === hostId) {
      hostId = null;
      socket.broadcast.emit('host-disconnected');
    }
    
    clients.delete(socket.id);
    
    // Clean up movement queues
    mouseMoveQueue.delete(socket.id);
    lastMouseMoveTime.delete(socket.id);
    
    // Send updated client list
    const clientList = Array.from(clients.values()).map(c => ({
      id: c.id,
      type: c.type
    }));
    io.emit('clients-updated', clientList);
  });
});

// Process mouse movement queue at regular intervals
const mouseMoveQueue = new Map();
const lastMouseMoveTime = new Map();

setInterval(() => {
  for (const [socketId, position] of mouseMoveQueue.entries()) {
    const lastTime = lastMouseMoveTime.get(socketId) || 0;
    const now = Date.now();
    
    // Process if enough time has passed and position is not too old
    if (now - lastTime >= 8 && now - position.timestamp < 100) {
      try {
        const screenSize = robot.getScreenSize();
        const x = Math.floor((position.x / 100) * screenSize.width);
        const y = Math.floor((position.y / 100) * screenSize.height);
        robot.moveMouse(x, y);
        lastMouseMoveTime.set(socketId, now);
        mouseMoveQueue.delete(socketId);
      } catch (error) {
        console.error('Background mouse move error:', error);
        mouseMoveQueue.delete(socketId);
      }
    } else if (now - position.timestamp > 100) {
      // Remove stale positions
      mouseMoveQueue.delete(socketId);
    }
  }
}, 5); // Run every 5ms for smooth movement

// Serve the main page
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

server.listen(PORT, () => {
  const localIP = getLocalIP();
  console.log(`\n🚀 Remote Desktop Server running on:`);
  console.log(`   Local:    http://localhost:${PORT}`);
  console.log(`   Network:  http://${localIP}:${PORT}`);
  console.log(`\n📱 Connect from other devices using the Network URL`);
}); 