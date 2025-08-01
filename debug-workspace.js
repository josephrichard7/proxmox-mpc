#!/usr/bin/env node

// Simple test to debug workspace detection
const fs = require('fs').promises;
const path = require('path'); 
const yaml = require('js-yaml');

// Set the working directory back to the script location to fix module resolution
process.chdir(__dirname);

async function testWorkspaceDetection(searchPath) {
  console.log('Testing workspace detection in:', searchPath);
  
  const configPath = path.join(searchPath, '.proxmox', 'config.yml');
  console.log('Looking for config at:', configPath);
  
  try {
    // Check if file exists
    const stats = await fs.stat(configPath);
    console.log('✅ Config file exists, size:', stats.size);
    
    // Try to read it
    const configContent = await fs.readFile(configPath, 'utf8');
    console.log('✅ Config content length:', configContent.length);
    console.log('Raw content:');
    console.log(configContent);
    
    // Try to parse YAML
    const config = yaml.load(configContent);
    console.log('✅ Parsed config:', config);
    
    return config;
    
  } catch (error) {
    console.log('❌ Error:', error.message);
    return null;
  }
}

// Test the workspace detection
const testPath = process.argv[2] || process.cwd();
testWorkspaceDetection(testPath);