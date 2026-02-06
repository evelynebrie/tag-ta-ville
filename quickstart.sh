#!/bin/bash

# TagYourCity Quick Start Script
# This script helps you set up and run the project quickly

echo "╔════════════════════════════════════════╗"
echo "║   TagYourCity Quick Start Setup        ║"
echo "╚════════════════════════════════════════╝"
echo ""

# Check if PostgreSQL is running
echo "Checking PostgreSQL..."
if command -v psql &> /dev/null; then
    echo "✅ PostgreSQL found"
else
    echo "❌ PostgreSQL not found. Please install PostgreSQL first."
    exit 1
fi

# Check if Node.js is installed
echo "Checking Node.js..."
if command -v node &> /dev/null; then
    echo "✅ Node.js found ($(node --version))"
else
    echo "❌ Node.js not found. Please install Node.js from https://nodejs.org"
    exit 1
fi

# Create .env file if it doesn't exist
if [ ! -f .env ]; then
    echo ""
    echo "Creating .env file..."
    cp .env.example .env
    echo "⚠️  Please edit .env and add your PostgreSQL password!"
    echo "   Run: nano .env"
    echo ""
    read -p "Press Enter after you've edited .env file..."
fi

# Initialize database
echo ""
echo "Setting up database..."
echo "You'll be prompted for your PostgreSQL password."
psql -U postgres -f setup_database.sql

if [ $? -eq 0 ]; then
    echo "✅ Database setup complete!"
else
    echo "❌ Database setup failed. Check your PostgreSQL password."
    exit 1
fi

# Install npm dependencies
echo ""
echo "Installing Node.js dependencies..."
npm install

if [ $? -eq 0 ]; then
    echo "✅ Dependencies installed!"
else
    echo "❌ Failed to install dependencies."
    exit 1
fi

# Done!
echo ""
echo "╔════════════════════════════════════════╗"
echo "║   Setup Complete! 🎉                   ║"
echo "╚════════════════════════════════════════╝"
echo ""
echo "To start the backend server, run:"
echo "  npm start"
echo ""
echo "To start the frontend, run (in another terminal):"
echo "  python3 -m http.server 8080"
echo ""
echo "Then open: http://localhost:8080/index_modified.html"
echo ""
