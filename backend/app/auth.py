import jwt
import requests
from functools import wraps
from flask import request, jsonify, g
from .config import get_config

config = get_config()

# Cache for JWKS (in production, consider using Redis)
_jwks_cache = None

def get_jwks():
    """Fetch Supabase JWKS (JSON Web Key Set) with caching."""
    global _jwks_cache
    
    if _jwks_cache is None:
        try:
            # Extract project ref from Supabase URL
            project_ref = config.SUPABASE_URL.split('//')[1].split('.')[0]
            jwks_url = f"https://{project_ref}.supabase.co/auth/v1/keys"
            
            response = requests.get(jwks_url, timeout=10)
            response.raise_for_status()
            _jwks_cache = response.json()
        except Exception as e:
            print(f"❌ Failed to fetch JWKS: {e}")
            return None
    
    return _jwks_cache

def verify_jwt_token(token):
    """Verify Supabase JWT token and return payload."""
    try:
        # Get JWKS
        jwks = get_jwks()
        if not jwks:
            return None
        
        # Decode token header to get key ID
        unverified_header = jwt.get_unverified_header(token)
        kid = unverified_header.get('kid')
        
        # Find the correct key
        key = None
        for jwk in jwks.get('keys', []):
            if jwk.get('kid') == kid:
                key = jwt.algorithms.RSAAlgorithm.from_jwk(jwk)
                break
        
        if not key:
            return None
        
        # Verify and decode token
        payload = jwt.decode(
            token,
            key,
            algorithms=['RS256'],
            audience='authenticated',
            options={'verify_exp': True}
        )
        
        return payload
        
    except jwt.ExpiredSignatureError:
        print("❌ JWT token has expired")
        return None
    except jwt.InvalidTokenError as e:
        print(f"❌ Invalid JWT token: {e}")
        return None
    except Exception as e:
        print(f"❌ JWT verification error: {e}")
        return None

def require_user(f):
    """Decorator to require authenticated user."""
    @wraps(f)
    def decorated_function(*args, **kwargs):
        # Extract Authorization header
        auth_header = request.headers.get('Authorization')
        if not auth_header or not auth_header.startswith('Bearer '):
            return jsonify({'error': 'Unauthorized'}), 401
        
        # Extract token
        token = auth_header.split(' ')[1]
        
        # Verify token
        payload = verify_jwt_token(token)
        if not payload:
            return jsonify({'error': 'Unauthorized'}), 401
        
        # Store user ID in Flask g context
        g.user_id = payload.get('sub')
        g.user_email = payload.get('email')
        
        return f(*args, **kwargs)
    
    return decorated_function
