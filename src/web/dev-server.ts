/**
 * Development server for Proxmox-MPC Web Dashboard
 * Quick startup script with mock data for local testing
 */

import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { Server } from 'socket.io';
import jwt from 'jsonwebtoken';

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: ['http://localhost:3001', 'http://192.168.0.24:3001'],
    credentials: true
  }
});

// Middleware
app.use(cors({
  origin: ['http://localhost:3001', 'http://192.168.0.24:3001'],
  credentials: true
}));
app.use(express.json());

// Mock JWT secret
const JWT_SECRET = 'dev-secret-key';

// Mock user
const mockUser = {
  id: '1',
  username: 'admin',
  email: 'admin@example.com',
  role: 'admin'
};

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Auth endpoints
app.post('/api/auth/login', (req, res) => {
  const { username, password } = req.body;
  
  if (username === 'admin' && password === 'admin123') {
    const token = jwt.sign({ userId: mockUser.id, username: mockUser.username }, JWT_SECRET, { expiresIn: '24h' });
    const refreshToken = jwt.sign({ userId: mockUser.id, type: 'refresh' }, JWT_SECRET, { expiresIn: '7d' });
    
    res.json({
      success: true,
      data: {
        user: mockUser,
        token,
        refreshToken
      }
    });
  } else {
    res.status(401).json({
      success: false,
      error: 'Invalid credentials'
    });
  }
});

app.post('/api/auth/refresh', (req, res) => {
  const { refreshToken } = req.body;
  
  try {
    const decoded = jwt.verify(refreshToken, JWT_SECRET) as any;
    const newToken = jwt.sign({ userId: decoded.userId, username: 'admin' }, JWT_SECRET, { expiresIn: '24h' });
    const newRefreshToken = jwt.sign({ userId: decoded.userId, type: 'refresh' }, JWT_SECRET, { expiresIn: '7d' });
    
    res.json({
      success: true,
      data: {
        token: newToken,
        refreshToken: newRefreshToken
      }
    });
  } catch (error) {
    res.status(401).json({
      success: false,
      error: 'Invalid refresh token'
    });
  }
});

app.get('/api/auth/profile', (req, res) => {
  // Simple auth check
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    res.json({
      success: true,
      data: mockUser
    });
  } else {
    res.status(401).json({
      success: false,
      error: 'Unauthorized'
    });
  }
});

// Infrastructure status endpoint
app.get('/api/infrastructure/status', (req, res) => {
  res.json({
    success: true,
    data: {
      vms: {
        total: 5,
        running: 3,
        stopped: 2
      },
      containers: {
        total: 3,
        running: 2,
        stopped: 1
      },
      nodes: {
        total: 2,
        online: 2,
        offline: 0
      },
      resources: {
        cpu: 45.2,
        memory: 62.8,
        storage: 72.5
      }
    }
  });
});

// VMs endpoints
app.get('/api/vms', (req, res) => {
  res.json({
    success: true,
    data: [
      {
        id: 'vm-001',
        name: 'web-server-01',
        status: 'running',
        node: 'pve-01',
        cores: 2,
        memory: 4096,
        disk: 50,
        created: '2024-08-01T10:00:00Z'
      },
      {
        id: 'vm-002',
        name: 'database-01',
        status: 'running',
        node: 'pve-01',
        cores: 4,
        memory: 8192,
        disk: 100,
        created: '2024-08-01T11:00:00Z'
      },
      {
        id: 'vm-003',
        name: 'test-vm',
        status: 'stopped',
        node: 'pve-02',
        cores: 1,
        memory: 2048,
        disk: 20,
        created: '2024-08-02T09:00:00Z'
      }
    ]
  });
});

// Containers endpoints
app.get('/api/containers', (req, res) => {
  res.json({
    success: true,
    data: [
      {
        id: 'ct-001',
        name: 'nginx-proxy',
        status: 'running',
        node: 'pve-01',
        cores: 1,
        memory: 1024,
        disk: 10,
        template: 'ubuntu-22.04',
        created: '2024-08-01T12:00:00Z'
      },
      {
        id: 'ct-002',
        name: 'redis-cache',
        status: 'running',
        node: 'pve-02',
        cores: 1,
        memory: 512,
        disk: 5,
        template: 'alpine-3.18',
        created: '2024-08-01T13:00:00Z'
      },
      {
        id: 'ct-003',
        name: 'test-container',
        status: 'stopped',
        node: 'pve-01',
        cores: 1,
        memory: 256,
        disk: 2,
        template: 'debian-12',
        created: '2024-08-03T10:00:00Z'
      }
    ]
  });
});

// Nodes endpoints
app.get('/api/nodes', (req, res) => {
  res.json({
    success: true,
    data: [
      {
        name: 'pve-01',
        status: 'online',
        cpu: 45.2,
        memory: 62.8,
        disk: 78.3,
        uptime: 1234567,
        load: [0.45, 0.52, 0.38],
        version: 'pve-manager/8.0.3'
      },
      {
        name: 'pve-02',
        status: 'online',
        cpu: 23.1,
        memory: 41.5,
        disk: 56.7,
        uptime: 987654,
        load: [0.23, 0.21, 0.19],
        version: 'pve-manager/8.0.3'
      }
    ]
  });
});

// WebSocket connection handling
io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);
  
  // Send initial status
  socket.emit('infrastructure-update', {
    vms: { total: 5, running: 3, stopped: 2 },
    containers: { total: 3, running: 2, stopped: 1 },
    nodes: { total: 2, online: 2, offline: 0 }
  });
  
  // Simulate periodic updates
  const updateInterval = setInterval(() => {
    socket.emit('infrastructure-update', {
      vms: { 
        total: 5, 
        running: Math.floor(Math.random() * 5) + 1, 
        stopped: Math.floor(Math.random() * 3) 
      },
      containers: { 
        total: 3, 
        running: Math.floor(Math.random() * 3) + 1, 
        stopped: Math.floor(Math.random() * 2) 
      },
      nodes: { total: 2, online: 2, offline: 0 },
      resources: {
        cpu: 40 + Math.random() * 20,
        memory: 50 + Math.random() * 30,
        storage: 70 + Math.random() * 10
      }
    });
  }, 5000);
  
  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
    clearInterval(updateInterval);
  });
});

// Start server
const PORT = process.env.PORT || 3000;
httpServer.listen(PORT, () => {
  console.log(`🚀 Proxmox-MPC Web API Server running on http://localhost:${PORT}`);
  console.log(`📡 WebSocket server ready for connections`);
  console.log(`\n🔐 Login credentials: admin / admin123`);
  console.log(`🌐 Frontend should connect from http://localhost:3001`);
});