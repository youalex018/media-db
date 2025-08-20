from flask import Flask, jsonify
from flask_cors import CORS
from .config import get_config
from . import routes

def create_app():
    """Application factory pattern."""
    app = Flask(__name__)
    
    # Load configuration
    config = get_config()
    app.config.from_object(config)
    
    # Setup CORS
    CORS(app, 
         origins=config.ALLOWED_ORIGINS,
         methods=['GET', 'POST', 'OPTIONS'],
         allow_headers=['Authorization', 'Content-Type'],
         supports_credentials=False)
    
    # Health check route (outside blueprint)
    @app.route('/healthz')
    def healthz():
        return jsonify({'status': 'ok'})
    
    # Register blueprints
    app.register_blueprint(routes.bp)
    
    # Error handlers
    @app.errorhandler(400)
    def bad_request(error):
        return jsonify({'error': 'Bad request'}), 400
    
    @app.errorhandler(401)
    def unauthorized(error):
        return jsonify({'error': 'Unauthorized'}), 401
    
    @app.errorhandler(403)
    def forbidden(error):
        return jsonify({'error': 'Forbidden'}), 403
    
    @app.errorhandler(404)
    def not_found(error):
        return jsonify({'error': 'Not found'}), 404
    
    @app.errorhandler(405)
    def method_not_allowed(error):
        return jsonify({'error': 'Method not allowed'}), 405
    
    @app.errorhandler(500)
    def internal_error(error):
        return jsonify({'error': 'Internal server error'}), 500
    
    print(f"🚀 Flask app created in {config.FLASK_ENV} mode")
    print(f"🔒 CORS enabled for origins: {config.ALLOWED_ORIGINS}")
    
    return app
