#!/bin/bash

echo "🚀 Remote Desktop Local - Mac M1 ARM"
echo "======================================"
echo ""

# Check dependencies
if [ ! -d "node_modules" ]; then
    echo "📦 Installing dependencies..."
    npm install
    echo ""
fi

# Clear terminal
clear

echo "🖥️  Remote Desktop Server Starting..."
echo ""
echo "📋 Instructions:"
echo "---------------"
echo "1. HOST (Device yang akan dikontrol):"
echo "   - Buka: http://localhost:3000"
echo "   - Klik tombol 'Host'"
echo "   - Allow screen sharing permission"
echo ""
echo "2. CLIENT (Device pengontrol):"
echo "   - Buka dari device lain: http://[IP-ADDRESS]:3000"
echo "   - Klik tombol 'Client'"
echo "   - Otomatis terkoneksi ke Host"
echo ""
echo "🔍 Debug: Buka browser console (F12) untuk melihat logs"
echo ""
echo "=========================================="
echo ""

# Start server
node server.js 