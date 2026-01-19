#!/bin/bash
# Start script for Git Bash on Windows

echo "🚀 Starting Media DB Backend Server"
echo "=================================="

# Activate virtual environment
echo "📦 Activating virtual environment..."
source .venv/Scripts/activate

# Verify FastAPI is available
echo "🔍 Checking FastAPI installation..."
python -c "import fastapi; print(f'✅ FastAPI {fastapi.__version__} found')" || {
    echo "❌ FastAPI not found - installing dependencies..."
    pip install -r requirements.txt
}

# Check configuration
echo "⚙️  Validating configuration..."
python -c "from app.config import get_config; get_config(); print('✅ Configuration OK')" || {
    echo "❌ Configuration failed - check your .env file"
    echo "Expected format:"
    echo "SUPABASE_URL=https://your-project.supabase.co"
    echo "SUPABASE_SERVICE_ROLE_KEY=your-service-role-key"
    exit 1
}

# Start server
echo "🌐 Starting FastAPI server on http://localhost:5000..."
uvicorn app.main:app --reload --host 0.0.0.0 --port 5000
