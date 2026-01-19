from fastapi import APIRouter, Depends, HTTPException, Request, status
from .auth import get_current_user

router = APIRouter()


@router.get('/health')
async def health():
    """Health check endpoint."""
    return {'status': 'ok'}


@router.get('/me')
async def me(user=Depends(get_current_user)):
    """Get current user information (protected endpoint)."""
    return {
        'user_id': user['user_id'],
        'email': user.get('email')
    }


# Placeholder endpoints for future implementation
@router.get('/search')
async def search(request: Request, user=Depends(get_current_user)):
    """Search external sources (placeholder)."""
    query = request.query_params.get('q', '')
    if not query:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={'error': 'Query parameter "q" is required'}
        )
    # TODO: Implement TMDb and Open Library search
    return {
        'message': 'Search endpoint not yet implemented',
        'query': query
    }


@router.post('/library/add')
async def add_to_library(request: Request, user=Depends(get_current_user)):
    """Add item to user's library (placeholder)."""
    data = await request.json()
    if not data:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={'error': 'JSON body required'}
        )

    # TODO: Implement work upsert and user_item creation
    return {
        'message': 'Add to library endpoint not yet implemented',
        'received_data': data
    }


@router.get('/library')
async def get_library(user=Depends(get_current_user)):
    """Get user's library (placeholder)."""
    # TODO: Implement user library retrieval
    return {
        'message': 'Library endpoint not yet implemented',
        'user_id': user['user_id']
    }
