# Testing Guide

This document provides comprehensive testing instructions for the Shelflife application.

## Quick Start

### Prerequisites
- Backend `.env` file configured with Supabase credentials
- Frontend `.env.local` file configured with Supabase URL and anon key
- Python virtual environment activated (backend)
- Node modules installed (frontend)

## Backend Tests

### 1. Basic Configuration Test

Tests that the FastAPI app can start with test configuration:

```bash
cd backend
.venv\Scripts\activate  # Windows
# or: source .venv/Scripts/activate  # Unix
python run_tests.py
```

**What it tests:**
- Configuration loading
- Auth key set fetch logic
- FastAPI app creation
- Health endpoint
- Protected endpoint error handling

### 2. Authentication Tests

Comprehensive authentication test suite:

```bash
# Make sure backend server is running first
cd backend
python test_auth.py
```

**What it tests:**
- Health endpoint
- Authentication error handling (all error codes)
- CORS configuration
- Missing/invalid/malformed tokens
- Token validation

**Test modes:**
- Default: Summary output
- `--verbose`: Detailed JSON results

### 3. RLS (Row Level Security) Tests

Tests that database security policies work correctly:

```bash
cd backend
python test_rls.py
```

**What it tests:**
- Creating test works (movies/books)
- Creating user items for different users
- Public read access to works
- Service role can bypass RLS
- Anonymous users cannot see user data
- User data is properly isolated

**Requirements:**
- Real Supabase credentials in `.env`
- Database migrations applied
- `SUPABASE_SERVICE_ROLE_KEY` set

## Frontend Tests

### Manual Browser Testing

1. **Start services:**
   ```bash
  # Terminal 1 - Backend
  cd backend
  .venv\Scripts\activate
  uvicorn app.main:app --reload --host 0.0.0.0 --port 5000
   
   # Terminal 2 - Frontend
   cd frontend
   npm run dev
   ```

2. **Test authentication flow:**
   - Visit `http://localhost:3000`
   - Use the Auth Test page
   - Sign in with email magic link
   - Check email and click magic link
   - Should redirect back showing "Signed In"
   - Click "Test Backend Auth" button
   - Should see success response with user_id

### Environment Variables Check

If auth test page is blank or not working:

1. Check browser console (F12) for errors
2. Verify frontend environment variables are set:
   ```javascript
   // In browser console:
   console.log(import.meta.env.VITE_SUPABASE_URL)
   console.log(import.meta.env.VITE_SUPABASE_ANON_KEY ? 'SET' : 'NOT SET')
   ```

## Test Error Codes Reference

### Authentication Errors

| Error Code | Cause | Test Case |
|------------|-------|-----------|
| `missing_authorization_header` | No Authorization header provided | No header |
| `invalid_bearer_format` | Header not "Bearer <token>" format | Wrong format |
| `empty_token` | Token value is empty | "Bearer " |
| `invalid_jwt_format` | Token is not valid structure | Malformed |
| `missing_key_id` | Token missing key ID in header | No `kid` |
| `key_not_found` | Unknown key ID (triggers key set refresh) | Fake `kid` |
| `invalid_issuer` | Token from wrong Supabase project | Wrong issuer |
| `token_expired` | Token past expiration time | Old token |
| `signature_verification_failed` | Invalid signature | Bad token |
| `jwks_unavailable` | Cannot fetch auth key set from Supabase | Network issue |

## Troubleshooting Tests

### Backend Tests Failing

**Problem:** `Configuration failed: Missing required environment variables`

**Solution:**
1. Create `backend/.env` from `.env.example`
2. Add your Supabase URL and service role key
3. Verify file encoding is UTF-8 (not UTF-8 BOM)

**Problem:** `jwks_unavailable` errors

**Solution:**
- Check internet connectivity
- Verify Supabase URL is correct
- Check firewall/proxy settings

**Problem:** `Connection failed - is the backend running?`

**Solution:**
- Start the backend server first: `uvicorn app.main:app --reload --host 0.0.0.0 --port 5000`
- Verify it's running on port 5000
- Check for port conflicts

### Frontend Tests Failing

**Problem:** Auth Test page is blank

**Solution:**
1. Check browser console for errors
2. Verify `frontend/.env.local` has both variables set
3. Restart Vite dev server (Ctrl+C, then `npm run dev`)
4. Hard refresh browser (Ctrl+Shift+R)

**Problem:** 401 errors from backend

**Solution:**
- Make sure you're signed in via Supabase first
- Verify frontend and backend use same Supabase project
- Check that anon key is correct

**Problem:** Magic link not working

**Solution:**
- Check spam folder
- Verify email auth is enabled in Supabase Dashboard → Authentication → Settings
- Ensure redirect URL is set to `http://localhost:3000`

### RLS Tests Failing

**Problem:** `Missing required environment variables`

**Solution:**
- Ensure `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, and `SUPABASE_ANON_KEY` are set
- Check `.env` file exists and is properly formatted

**Problem:** `relation 'works' does not exist`

**Solution:**
- Run database migrations: `npx supabase db push`
- Or apply migrations manually via Supabase SQL Editor

## Performance Benchmarks

Expected response times (p50):
- Health check: < 50ms
- Protected endpoint (cached key set): < 200ms
- Protected endpoint (key set refresh): < 1000ms

## CI/CD Integration

For automated testing in CI/CD pipelines:

```yaml
# Example GitHub Actions workflow
- name: Run Backend Tests
  run: |
    cd backend
    python -m venv .venv
    .venv/bin/activate
    pip install -r requirements.txt
    python run_tests.py
```

## Writing New Tests

### Backend Test Template

```python
def test_new_feature():
    """Test description."""
    print("[TEST] Testing new feature...")
    
    try:
        # Test logic here
        result = some_function()
        
        if result == expected:
            print("[PASS] New feature test passed")
            return {"status": "pass"}
        else:
            print(f"[FAIL] Expected {expected}, got {result}")
            return {"status": "fail"}
    except Exception as e:
        print(f"[FAIL] Test error: {e}")
        return {"status": "fail"}
```

### Test Output Format

Use consistent logging prefixes:
- `[TEST]` - Starting a test
- `[PASS]` - Test passed
- `[FAIL]` - Test failed
- `[SKIP]` - Test skipped
- `[WARN]` - Warning (non-critical)
- `[ERROR]` - Error occurred
- `[INFO]` - Informational message
- `[SUCCESS]` - Overall success

## Security Testing

### RLS Policy Verification

1. Create test users with different UUIDs
2. Insert data for each user
3. Verify users can only see their own data
4. Confirm anonymous users cannot see user data
5. Verify public catalog data is readable by all

### Token Testing

Test that tokens:
- Expire after configured time
- Are properly validated
- Include correct claims
- Use correct signing algorithm
- Have valid signatures

## Next Steps

After tests pass:
1. Review test coverage
2. Add new test cases for edge cases
3. Document any test failures
4. Update this guide with new tests

