#!/usr/bin/env node

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('🚀 Building Remote Desktop Application...\n');

// Create dist directory if it doesn't exist
if (!fs.existsSync('dist')) {
  fs.mkdirSync('dist', { recursive: true });
}

// Get platform and method arguments
const platform = process.argv[2] || 'current';
const method = process.argv[3] || 'pkg'; // pkg or nexe

console.log(`🔧 Using build method: ${method}`);

try {
  let command;
  
  if (method === 'nexe') {
    switch (platform.toLowerCase()) {
      case 'mac':
      case 'macos':
        console.log('📱 Building for macOS (ARM64) with nexe...');
        command = 'npm run build-nexe:mac';
        break;
      case 'win':
      case 'windows':
        console.log('🪟 Building for Windows (x64) with nexe...');
        command = 'npm run build-nexe:win';
        break;
      case 'linux':
        console.log('🐧 Building for Linux (x64) with nexe...');
        command = 'npm run build-nexe:linux';
        break;
      default:
        console.log('💻 Building for current platform with nexe...');
        command = 'npm run build-nexe';
        break;
    }
  } else {
    switch (platform.toLowerCase()) {
      case 'mac':
      case 'macos':
        console.log('📱 Building for macOS (ARM64) with pkg...');
        command = 'npm run build:mac';
        break;
      case 'win':
      case 'windows':
        console.log('🪟 Building for Windows (x64) with pkg...');
        command = 'npm run build:win';
        break;
      case 'linux':
        console.log('🐧 Building for Linux (x64) with pkg...');
        command = 'npm run build:linux';
        break;
      case 'all':
        console.log('🌍 Building for all platforms with pkg...');
        command = 'npm run build:all';
        break;
      default:
        console.log('💻 Building for current platform with pkg...');
        command = 'npm run build';
        break;
    }
  }
  
  // Run the build command
  execSync(command, { stdio: 'inherit' });
  
  console.log('\n✅ Build completed successfully!');
  console.log('\n📁 Built files are located in the "dist" folder:');
  
  // List built files
  const distFiles = fs.readdirSync('dist');
  distFiles.forEach(file => {
    const filePath = path.join('dist', file);
    const stats = fs.statSync(filePath);
    const size = (stats.size / 1024 / 1024).toFixed(2);
    console.log(`   📦 ${file} (${size} MB)`);
  });
  
  console.log('\n🎯 Usage:');
  console.log('   • Copy the executable to target device');
  console.log('   • Run directly without Node.js installed');
  console.log('   • Access via browser at http://localhost:3000');
  
} catch (error) {
  console.error('\n❌ Build failed:', error.message);
  process.exit(1);
} 