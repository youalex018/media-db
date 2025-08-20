from flask import Blueprint, jsonify, g, request
from .auth import require_user

# Create blueprint
bp = Blueprint('api', __name__, url_prefix='/api')

@bp.route('/health')
def health():
    """Health check endpoint."""
    return jsonify({'status': 'ok'})

@bp.route('/me')
@require_user
def me():
    """Get current user information (protected endpoint)."""
    return jsonify({
        'user_id': g.user_id,
        'email': g.user_email
    })

# Placeholder endpoints for future implementation
@bp.route('/search')
@require_user
def search():
    """Search external sources (placeholder)."""
    query = request.args.get('q', '')
    if not query:
        return jsonify({'error': 'Query parameter "q" is required'}), 400
    
    # TODO: Implement TMDb and Open Library search
    return jsonify({
        'message': 'Search endpoint not yet implemented',
        'query': query
    }), 501

@bp.route('/library/add', methods=['POST'])
@require_user
def add_to_library():
    """Add item to user's library (placeholder)."""
    data = request.get_json()
    if not data:
        return jsonify({'error': 'JSON body required'}), 400
    
    # TODO: Implement work upsert and user_item creation
    return jsonify({
        'message': 'Add to library endpoint not yet implemented',
        'received_data': data
    }), 501

@bp.route('/library')
@require_user 
def get_library():
    """Get user's library (placeholder)."""
    # TODO: Implement user library retrieval
    return jsonify({
        'message': 'Library endpoint not yet implemented',
        'user_id': g.user_id
    }), 501
