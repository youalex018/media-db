from supabase import create_client, Client
from .config import get_config

config = get_config()

# Initialize Supabase client with service role key
supabase: Client = create_client(
    config.SUPABASE_URL,
    config.SUPABASE_SERVICE_ROLE_KEY
)

def get_supabase_client():
    """Get the Supabase client instance."""
    return supabase

def execute_rpc(function_name: str, params: dict = None):
    """Execute a Supabase RPC function."""
    try:
        result = supabase.rpc(function_name, params or {}).execute()
        return result.data
    except Exception as e:
        print(f"[ERROR] RPC execution error: {e}")
        raise

def safe_insert(table: str, data: dict):
    """Safely insert data with error handling."""
    try:
        result = supabase.table(table).insert(data).execute()
        return result.data
    except Exception as e:
        print(f"[ERROR] Insert error for table {table}: {e}")
        raise

def safe_upsert(table: str, data: dict, on_conflict: str = None):
    """Safely upsert data with error handling."""
    try:
        query = supabase.table(table).upsert(data)
        if on_conflict:
            query = query.on_conflict(on_conflict)
        result = query.execute()
        return result.data
    except Exception as e:
        print(f"[ERROR] Upsert error for table {table}: {e}")
        raise

def safe_select(table: str, columns: str = "*", filters: dict = None):
    """Safely select data with error handling."""
    try:
        query = supabase.table(table).select(columns)
        if filters:
            for key, value in filters.items():
                query = query.eq(key, value)
        result = query.execute()
        return result.data
    except Exception as e:
        print(f"[ERROR] Select error for table {table}: {e}")
        raise
