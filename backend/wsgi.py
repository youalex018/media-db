"""
WSGI entry point for the Flask application.
Used by gunicorn and other WSGI servers.
"""

from app import create_app

# Create application instance
app = create_app()

if __name__ == '__main__':
    # This allows running with `python wsgi.py` for development
    app.run(debug=True, host='0.0.0.0', port=5000)
