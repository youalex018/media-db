# Authentication Testing Guide

This document provides step-by-step instructions for testing the authentication system end-to-end.

## Prerequisites

1. **Environment Setup**: Ensure both backend and frontend `.env` files are configured with valid Supabase credentials
2. **Services Running**: Both FastAPI backend (port 5000) and React frontend (port 3000) must be running

## Quick Start Testing

### 1. Start Services

## Start the Server

# Terminal 1 - Backend
Start the server using Git Bash:

```bash
cd backend
chmod +x start_server.sh
./start_server.sh
```

Or using Command Prompt/PowerShell:
```cmd
cd backend
start_server.bat
```

Or manually:
```bash
cd backend
source .venv/Scripts/activate
uvicorn app.main:app --reload --host 0.0.0.0 --port 5000
```

# Terminal 2 - Frontend  
cd frontend
npm run dev
```

### 2. Health Check

Verify backend is responding:
```bash
curl http://localhost:5000/healthz
# Expected: {"status":"ok"}
```

### 3. Browser Authentication Test

1. Open browser to `http://localhost:3000`
2. You should see the Auth Test page
3. Enter your email and click "Send Magic Link"
4. Check email and click the magic link
5. You should be redirected back and see "✅ Signed In"
6. Click "Test Backend Auth" button
7. You should see a success response with your user_id

### 4. Manual API Testing

After signing in via browser, get your token:

```javascript
// In browser console:
const { data } = await supabase.auth.getSession();
console.log(data.session?.access_token);
```

Test the protected endpoint:
```bash
# Replace TOKEN with your actual token
curl -i http://localhost:5000/api/me \
  -H "Authorization: Bearer TOKEN"
```

Expected response:
```json
{
  "user_id": "your-user-uuid-here",
  "email": "your-email@example.com"
}
```

## Comprehensive Test Cases

### Positive Tests

| Test Case | Expected Result |
|-----------|----------------|
| Valid token to `/api/me` | 200 with user data |
| Health check `/healthz` | 200 with status ok |
| Fresh login flow | Successful authentication |

### Negative Tests

| Test Case | Command | Expected Error |
|-----------|---------|----------------|
| No Authorization header | `curl http://localhost:5000/api/me` | `missing_authorization_header` |
| Invalid Bearer format | `curl -H "Authorization: Token abc" http://localhost:5000/api/me` | `invalid_bearer_format` |
| Empty token | `curl -H "Authorization: Bearer " http://localhost:5000/api/me` | `empty_token` |
| Malformed token | `curl -H "Authorization: Bearer invalid-token" http://localhost:5000/api/me` | `invalid_jwt_format` |
| Expired token | (Use old token) | `token_expired` |

## Error Code Reference

| Error Code | Meaning | Resolution |
|------------|---------|------------|
| `missing_authorization_header` | No Authorization header provided | Add `Authorization: Bearer <token>` header |
| `invalid_bearer_format` | Header not in `Bearer <token>` format | Fix header format |
| `empty_token` | Token is empty | Provide valid token |
| `invalid_jwt_format` | Token is not valid | Get fresh token |
| `missing_key_id` | Token missing key ID | Token may be corrupted |
| `key_not_found` | Auth key set doesn't contain token's key | May need key set refresh or token re-issue |
| `invalid_issuer` | Token from wrong Supabase project | Check environment configuration |
| `token_expired` | Token past expiration time | Re-authenticate to get fresh token |
| `signature_verification_failed` | Token signature invalid | Re-authenticate |
| `jwks_unavailable` | Cannot fetch auth key set from Supabase | Check network connectivity |

## Troubleshooting

### Backend Not Starting
- Check environment variables are set correctly
- Verify Supabase URL and service role key
- Check Python dependencies are installed

### CORS Errors
- Verify `ALLOWED_ORIGINS` includes `http://localhost:3000`
- Check frontend is running on expected port

### Authentication Failing
- Verify Supabase project configuration
- Check that email authentication is enabled
- Ensure service role key has necessary permissions

### Auth Key Set Issues
- Check internet connectivity from backend
- Verify Supabase project reference is correct
- Review logs for specific auth key set fetch errors

## Security Validation

### RLS Testing (Future Phase)
Once database tables are created:

1. Create two test users
2. Add data for each user  
3. Verify users can only see their own data

### Token Validation
- Tokens should expire after configured time
- Refresh should work properly
- Invalid tokens should be rejected with specific errors

## Automation

For CI/CD pipelines, use the test script:

```bash
# Will be created as backend/test_auth.py
python backend/test_auth.py
```

## Performance Benchmarks

Expected response times:
- Health check: < 50ms
- Protected endpoint with cached key set: < 200ms  
- Protected endpoint with key set refresh: < 1000ms