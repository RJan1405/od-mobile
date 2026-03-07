#!/bin/bash

echo "🚀 Setting up Odnix Mobile App..."
echo ""

# Check Node.js
echo "Checking Node.js version..."
node --version || { echo "❌ Node.js not found. Please install Node.js 18+"; exit 1; }

# Check npm
echo "Checking npm version..."
npm --version || { echo "❌ npm not found. Please install npm"; exit 1; }

# Install dependencies
echo ""
echo "📦 Installing dependencies..."
npm install

# Check for Android
echo ""
echo "Checking Android environment..."
if [ -d "$ANDROID_HOME" ]; then
    echo "✅ Android SDK found at: $ANDROID_HOME"
else
    echo "⚠️  ANDROID_HOME not set. Please configure Android SDK"
fi

# Setup complete
echo ""
echo "✅ Setup complete!"
echo ""
echo "Next steps:"
echo "1. Ensure Django backend is running on http://127.0.0.1:8000"
echo "2. Update src/config/index.ts with your backend IP if using physical device"
echo "3. Run 'npm run android' to start the app"
echo ""
echo "For detailed instructions, see QUICKSTART.md"
