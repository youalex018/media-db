import jwt
import requests
import time
import logging
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from .config import get_config

config = get_config()

# Auth key set cache with TTL (Time To Live)
_jwks_cache = None
_jwks_cache_time = None
_jwks_ttl = 600  # 10 minutes

# Setup logging
logger = logging.getLogger(__name__)

def get_jwks(force_refresh=False):
    """Fetch Supabase auth key set with caching and TTL."""
    global _jwks_cache, _jwks_cache_time
    
    current_time = time.time()
    
    # Check if cache is valid and not forcing refresh
    if (not force_refresh and 
        _jwks_cache is not None and 
        _jwks_cache_time is not None and 
        current_time - _jwks_cache_time < _jwks_ttl):
        return _jwks_cache
    
    try:
        # Use the correct auth key set endpoint format for Supabase
        jwks_url = f"{config.SUPABASE_URL}/auth/v1/.well-known/jwks.json"
        
        logger.info(f"Fetching auth key set from: {jwks_url}")
        
        # Use anon key for auth key set fetching (some Supabase projects require it)
        headers = {}
        if config.SUPABASE_ANON_KEY:
            headers['apikey'] = config.SUPABASE_ANON_KEY
            
        response = requests.get(jwks_url, headers=headers, timeout=10)
        response.raise_for_status()
        
        _jwks_cache = response.json()
        _jwks_cache_time = current_time
        logger.info("[SUCCESS] Auth key set fetched and cached successfully")
        logger.debug(f"Auth key set response: {_jwks_cache}")
        logger.debug(f"Number of keys in auth key set: {len(_jwks_cache.get('keys', []))}")
        return _jwks_cache
        
    except requests.exceptions.RequestException as e:
        logger.error(f"[ERROR] Network error fetching auth key set: {e}")
        return _jwks_cache  # Return stale cache if available
    except Exception as e:
        logger.error(f"[ERROR] Failed to fetch auth key set: {e}")
        return _jwks_cache  # Return stale cache if available

def verify_jwt_token(token):
    """Verify Supabase access token and return payload with detailed error info.

    Supports both:
    - HS256 (Legacy): Uses shared secret for verification
    - ES256/RS256: Uses auth key set for verification
    """
    try:
        # First, validate token format and get header
        try:
            unverified_header = jwt.get_unverified_header(token)
        except jwt.DecodeError:
            logger.error("Invalid token format - cannot decode header")
            return None, "invalid_jwt_format"
        
        algorithm = unverified_header.get('alg', '')
        logger.info(f"Token algorithm: {algorithm}")
        
        # HS256 (Legacy) - Use secret for verification
        if algorithm == 'HS256':
            if not config.SUPABASE_JWT_SECRET:
                logger.error("HS256 token received but secret not configured")
                return None, "jwt_secret_not_configured"
            
            try:
                payload = jwt.decode(
                    token,
                    config.SUPABASE_JWT_SECRET,
                    algorithms=['HS256'],
                    options={'verify_exp': True, 'verify_aud': False}
                )
                
                # Verify issuer
                project_ref = config.SUPABASE_URL.split('//')[1].split('.')[0]
                expected_issuer = f"https://{project_ref}.supabase.co/auth/v1"
                if payload.get('iss') != expected_issuer:
                    logger.error(f"Invalid issuer: {payload.get('iss')} != {expected_issuer}")
                    return None, "invalid_issuer"
                
                logger.info("HS256 token verified successfully")
                return payload, None
                
            except jwt.ExpiredSignatureError:
                logger.info("Token has expired")
                return None, "token_expired"
            except jwt.InvalidTokenError as e:
                logger.error(f"HS256 token verification failed: {e}")
                return None, "signature_verification_failed"
        
        # ES256/RS256 - Use auth key set for verification
        jwks = get_jwks()
        if not jwks:
            logger.error("No auth key set available for token verification")
            return None, "jwks_unavailable"
        
        kid = unverified_header.get('kid')
        if not kid:
            logger.error("No key ID found in token header")
            return None, "missing_key_id"
        
        # Find the correct key (support both RSA and ECC)
        key = None
        key_algorithm = None
        for jwk in jwks.get('keys', []):
            if jwk.get('kid') == kid:
                try:
                    kty = jwk.get('kty', '')
                    if kty == 'RSA':
                        key = jwt.algorithms.RSAAlgorithm.from_jwk(jwk)
                        key_algorithm = 'RS256'
                    elif kty == 'EC':
                        key = jwt.algorithms.ECAlgorithm.from_jwk(jwk)
                        key_algorithm = 'ES256'
                    else:
                        logger.error(f"Unsupported key type: {kty}")
                        continue
                    break
                except Exception as e:
                    logger.error(f"Failed to create key from JWK: {e}")
                    continue
        
        # If key not found, try refreshing the auth key set once
        if not key:
            logger.info(f"Key ID {kid} not found in cache, refreshing auth key set")
            jwks = get_jwks(force_refresh=True)
            if jwks:
                available_kids = [jwk.get('kid') for jwk in jwks.get('keys', [])]
                logger.info(f"Available key IDs in auth key set: {available_kids}")
                logger.info(f"Looking for key ID: {kid}")
                
                for jwk in jwks.get('keys', []):
                    if jwk.get('kid') == kid:
                        try:
                            kty = jwk.get('kty', '')
                            if kty == 'RSA':
                                key = jwt.algorithms.RSAAlgorithm.from_jwk(jwk)
                                key_algorithm = 'RS256'
                            elif kty == 'EC':
                                key = jwt.algorithms.ECAlgorithm.from_jwk(jwk)
                                key_algorithm = 'ES256'
                            else:
                                logger.error(f"Unsupported key type: {kty}")
                                continue
                            break
                        except Exception as e:
                            logger.error(f"Failed to create key from JWK after refresh: {e}")
                            continue
        
        if not key:
            logger.error(f"Key ID {kid} not found in auth key set even after refresh")
            return None, "key_not_found"
        
        # Verify and decode token
        algorithms_to_try = [key_algorithm] if key_algorithm else ['RS256', 'ES256']
        payload = jwt.decode(
            token,
            key,
            algorithms=algorithms_to_try,
            options={'verify_exp': True, 'verify_aud': False}
        )
        
        # Verify issuer
        project_ref = config.SUPABASE_URL.split('//')[1].split('.')[0]
        expected_issuer = f"https://{project_ref}.supabase.co/auth/v1"
        if payload.get('iss') != expected_issuer:
            logger.error(f"Invalid issuer: {payload.get('iss')} != {expected_issuer}")
            return None, "invalid_issuer"
        
        return payload, None
        
    except jwt.ExpiredSignatureError:
        logger.info("Token has expired")
        return None, "token_expired"
    except jwt.InvalidTokenError as e:
        logger.error(f"Invalid token: {e}")
        return None, "signature_verification_failed"
    except Exception as e:
        logger.error(f"Token verification error: {e}")
        return None, "verification_error"

security = HTTPBearer(auto_error=False)


def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    """Dependency to require authenticated user with precise error reporting."""
    if credentials is None:
        logger.info("Missing Authorization header")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={'error': 'missing_authorization_header', 'message': 'Authorization header is required'}
        )

    if credentials.scheme.lower() != 'bearer':
        logger.info("Invalid Authorization header format")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={'error': 'invalid_bearer_format', 'message': 'Authorization header must be in format: Bearer <token>'}
        )

    token = credentials.credentials
    if not token:
        logger.info("Empty token in Authorization header")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={'error': 'empty_token', 'message': 'Token cannot be empty'}
        )

    payload, error_code = verify_jwt_token(token)
    if not payload:
        error_messages = {
            'jwks_unavailable': 'Authentication service temporarily unavailable',
            'invalid_jwt_format': 'Invalid token format',
            'missing_key_id': 'Token missing required key identifier',
            'key_not_found': 'Token key not recognized',
            'invalid_issuer': 'Token from invalid issuer',
            'token_expired': 'Token has expired',
            'signature_verification_failed': 'Token signature verification failed',
            'verification_error': 'Token verification failed',
            'jwt_secret_not_configured': 'Secret not configured for HS256 tokens'
        }

        message = error_messages.get(error_code, 'Authentication failed')
        logger.info(f"Token verification failed: {error_code}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={'error': error_code or 'authentication_failed', 'message': message}
        )

    return {
        'user_id': payload.get('sub'),
        'email': payload.get('email'),
        'payload': payload
    }
