import logging
from fastapi import FastAPI, Request, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from .config import get_config
from .rate_limit import limiter
from .routes import router as api_router
from .auth import get_jwks


def create_app() -> FastAPI:
    """Application factory for FastAPI with startup validation."""
    config = get_config()

    app = FastAPI()
    app.state.limiter = limiter
    app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

    # Configure logging
    if config.FLASK_ENV == 'development':
        logging.basicConfig(
            level=logging.INFO,
            format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
        )

    # Test Supabase connectivity on startup
    try:
        keyset = get_jwks()
        if not keyset:
            print("[WARN] Could not fetch auth key set on startup - authentication may fail")
        else:
            print("[SUCCESS] Auth key set fetched successfully on startup")
    except Exception as e:
        print(f"[WARN] Auth key set connectivity test failed: {e}")
        print("   Authentication may fail until connectivity is restored")

    # Setup CORS
    app.add_middleware(
        CORSMiddleware,
        allow_origins=config.ALLOWED_ORIGINS,
        allow_credentials=False,
        allow_methods=['GET', 'POST', 'PATCH', 'OPTIONS'],
        allow_headers=['Authorization', 'Content-Type'],
        expose_headers=['Content-Type'],
        max_age=3600
    )

    # Request logging middleware
    request_logger = logging.getLogger("media_db.request")

    @app.middleware("http")
    async def log_request_info(request: Request, call_next):
        if config.FLASK_ENV == 'development':
            request_logger.info("%s %s", request.method, request.url.path)
        response = await call_next(request)
        if config.FLASK_ENV == 'development':
            request_logger.info("%s %s - %s", request.method, request.url.path, response.status_code)
        return response

    # Health check route
    @app.get('/healthz')
    async def healthz():
        return {'status': 'ok'}

    # Error handler for consistent JSON errors
    @app.exception_handler(HTTPException)
    async def http_exception_handler(_request: Request, exc: HTTPException):
        if isinstance(exc.detail, dict) and 'error' in exc.detail:
            return JSONResponse(status_code=exc.status_code, content=exc.detail, headers=exc.headers)
        return JSONResponse(status_code=exc.status_code, content={'error': str(exc.detail)})

    # Register routes
    app.include_router(api_router, prefix='/api')

    print(f"[INFO] FastAPI app created in {config.FLASK_ENV} mode")
    print(f"[INFO] CORS enabled for origins: {config.ALLOWED_ORIGINS}")

    return app


app = create_app()

