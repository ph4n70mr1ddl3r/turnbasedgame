#!/bin/bash
# Development environment setup script

set -e

echo "Setting up development environment for turnbasedgame..."

# Check for required tools
command -v node >/dev/null 2>&1 || { echo "Node.js not found. Please install Node.js 18+."; exit 1; }
command -v npm >/dev/null 2>&1 || { echo "npm not found. Please install npm."; exit 1; }
command -v cmake >/dev/null 2>&1 || { echo "CMake not found. Please install CMake 3.15+."; exit 1; }
command -v g++ >/dev/null 2>&1 || { echo "g++ not found. Please install GCC/g++."; exit 1; }

# Check for libhv
if ! pkg-config --exists libhv; then
    echo "Warning: libhv not found. C++ server may not build."
    echo "To install libhv:"
    echo "  git clone https://github.com/ithewei/libhv.git"
    echo "  cd libhv && mkdir build && cd build"
    echo "  cmake .. && make && sudo make install"
fi

# Install frontend dependencies
echo "Installing frontend dependencies..."
cd client
npm install
cd ..

# Create development configuration
echo "Creating development configuration..."

# Create .env.local for frontend
cat > client/.env.local <<EOF
# Development environment variables
NEXT_PUBLIC_WS_URL=ws://localhost:8080
NEXT_PUBLIC_DEBUG=true
EOF

echo "Development environment setup complete!"
echo ""
echo "To start development:"
echo "1. Frontend: cd client && npm run dev (runs on http://localhost:3000)"
echo "2. Backend: cd server && mkdir -p build && cd build && cmake .. && make && ./poker_server (runs on http://localhost:8080)"
echo ""
echo "Note: The frontend dev server proxies to the backend on port 8080."