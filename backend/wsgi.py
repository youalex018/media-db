"""
ASGI entry point for the FastAPI application.
Use with Uvicorn or other ASGI servers.
"""

from app.main import app

if __name__ == '__main__':
    import uvicorn
    uvicorn.run("app.main:app", host="0.0.0.0", port=5000, reload=True)
