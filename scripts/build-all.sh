#!/bin/bash
# Build script for turnbasedgame poker platform
# Builds both Next.js frontend and C++ backend

set -e  # Exit on error

echo "Building turnbasedgame poker platform..."

# Build frontend
echo "Building Next.js frontend..."
cd client
npm ci --silent
npm run build
cd ..

# Build backend
echo "Building C++ server..."
cd server
mkdir -p build
cd build
cmake .. -DCMAKE_BUILD_TYPE=Release
cmake --build . --config Release
cd ../..

echo "Build complete!"
echo ""
echo "Frontend built to: client/out/"
echo "Backend built to: server/build/poker_server"
echo ""
echo "To run: cd server/build && ./poker_server"