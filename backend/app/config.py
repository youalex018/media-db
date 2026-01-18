import os
import sys
from dotenv import load_dotenv

# Load environment variables (ignore errors if .env file doesn't exist)
try:
    load_dotenv()
except Exception as e:
    print(f"[WARN] Could not load .env file: {e}")
    print("Using environment variables only")

class Config:
    """Base configuration class."""
    
    # Required environment variables
    SUPABASE_URL = os.getenv('SUPABASE_URL')
    SUPABASE_SERVICE_ROLE_KEY = os.getenv('SUPABASE_SERVICE_ROLE_KEY')
    SUPABASE_ANON_KEY = os.getenv('SUPABASE_ANON_KEY')
    SUPABASE_JWT_SECRET = os.getenv('SUPABASE_JWT_SECRET')
    
    # Optional environment variables with defaults
    FLASK_ENV = os.getenv('FLASK_ENV', 'production')
    ALLOWED_ORIGINS = os.getenv('ALLOWED_ORIGINS', 'http://localhost:3000').split(',')
    TMDB_API_KEY = os.getenv('TMDB_API_KEY')
    
    # Validation
    @classmethod
    def validate_config(cls):
        """Validate that required configuration is present."""
        required_vars = ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'SUPABASE_ANON_KEY']
        missing_vars = []
        
        for var in required_vars:
            if not getattr(cls, var):
                missing_vars.append(var)
        
        if missing_vars:
            print("[ERROR] Configuration Error: Missing required environment variables:")
            for var in missing_vars:
                print(f"   - {var}")
            print("\nPlease set these variables in your .env file.")
            print("See .env.example for the required format.")
            sys.exit(1)
        
        print("[SUCCESS] Configuration validated successfully")

class DevelopmentConfig(Config):
    """Development configuration."""
    DEBUG = True
    FLASK_ENV = 'development'

class ProductionConfig(Config):
    """Production configuration."""
    DEBUG = False
    FLASK_ENV = 'production'

# Configuration mapping
config_map = {
    'development': DevelopmentConfig,
    'production': ProductionConfig,
    'default': DevelopmentConfig
}

def get_config():
    """Get configuration based on FLASK_ENV."""
    env = os.getenv('FLASK_ENV', 'development')
    config_class = config_map.get(env, config_map['default'])
    config_class.validate_config()
    return config_class
