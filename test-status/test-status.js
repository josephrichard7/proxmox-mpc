#!/usr/bin/env node

const { spawn } = require('child_process');

const env = {
  ...process.env,
  PROXMOX_HOST: '192.168.0.19',
  PROXMOX_USERNAME: 'root@pam',
  PROXMOX_TOKEN_ID: 'claude-test',
  PROXMOX_TOKEN_SECRET: 'your-token-secret'
};

const child = spawn('proxmox-mpc', [], {
  stdio: ['pipe', 'inherit', 'inherit'],
  env
});

// Initialize workspace first, then check status
child.stdin.write('/init\n');

// Wait for init to complete, then check status
setTimeout(() => {
  child.stdin.write('/status\n');
}, 2000);

// Exit after status
setTimeout(() => {
  child.stdin.write('/exit\n');
  child.stdin.end();
}, 5000);

child.on('close', (code) => {
  console.log(`\nProcess exited with code ${code}`);
});