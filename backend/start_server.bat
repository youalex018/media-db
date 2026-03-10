@echo off
REM Start script for Windows Command Prompt/PowerShell

echo 🚀 Starting Mediarium Backend Server
echo ==================================

REM Activate virtual environment
echo 📦 Activating virtual environment...
call .venv\Scripts\activate.bat

REM Verify FastAPI is available  
echo 🔍 Checking FastAPI installation...
python -c "import fastapi; print(f'✅ FastAPI {fastapi.__version__} found')" || (
    echo ❌ FastAPI not found - installing dependencies...
    pip install -r requirements.txt
)

REM Check configuration
echo ⚙️ Validating configuration...
python -c "from app.config import get_config; get_config(); print('✅ Configuration OK')" || (
    echo ❌ Configuration failed - check your .env file
    echo Expected format:
    echo SUPABASE_URL=https://your-project.supabase.co
    echo SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
    pause
    exit /b 1
)

REM Start server
echo 🌐 Starting FastAPI server on http://localhost:5000...
uvicorn app.main:app --reload --host 0.0.0.0 --port 5000
