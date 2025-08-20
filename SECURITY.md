# 🔒 Security Overview

This document outlines the security model and best practices for the Media DB application.

## 🛡️ Row Level Security (RLS) Model

### User-Scoped Tables (RLS Enforced)
Tables that contain user-specific data with RLS policies:

- **`profiles`** - User profile information
  - Policy: Users can only CRUD their own profile (`user_id = auth.uid()`)
  
- **`user_items`** - User's media library entries
  - Policy: Users can only CRUD their own items (`user_id = auth.uid()`)
  
- **`user_tag_names`** - User's custom tags
  - Policy: Users can only CRUD their own tags (`user_id = auth.uid()`)
  
- **`user_item_tags`** - Tags applied to user items
  - Policy: Users can only CRUD tags for their own items

### Catalog Tables (Public Read, Service Role Write)
Tables containing shared reference data:

- **`works`** - Movies, shows, books (canonical data)
- **`people`** - Authors, actors, directors
- **`genres`** - Genre classifications
- **`work_people`**, **`work_genres`** - Relationships
- **`sources`** - External API cache data
- **`work_embeddings`** - Vector embeddings for recommendations

**Security Model:**
- ✅ **Public READ access** - All authenticated users can read
- ❌ **No public WRITE access** - Only service role can insert/update/delete
- 🔒 **Service role writes only** - Backend uses service role for catalog management

## 🔑 Authentication & Authorization

### Supabase JWT Tokens
- **Frontend**: Uses `SUPABASE_ANON_KEY` for authentication
- **Backend**: Verifies JWT tokens using Supabase JWKS
- **Token Validation**: RSA signature verification with key rotation support

### Service Role Usage
- **Purpose**: Backend service for privileged operations
- **Scope**: Catalog data writes, RLS-bypassed reads for aggregations
- **Security**: Never exposed to client-side code

### Key Management
```
Frontend (Public)          Backend (Private)
├── SUPABASE_URL           ├── SUPABASE_URL
├── SUPABASE_ANON_KEY      ├── SUPABASE_SERVICE_ROLE_KEY
└── (Safe to expose)       ├── TMDB_API_KEY
                          └── (Server-only secrets)
```

## 🚫 Security Boundaries

### What Users CAN Access
- ✅ Their own user items, tags, and profile
- ✅ All public catalog data (works, people, genres)
- ✅ Search results from external APIs (via backend proxy)

### What Users CANNOT Access
- ❌ Other users' personal data
- ❌ Direct external API keys
- ❌ Service role operations
- ❌ Raw source cache data from other users

## 🔐 Storage Security (Future)

When user uploads are implemented:

### Private Bucket Strategy
- **Bucket Type**: Private (no public access)
- **Access Control**: User ID-based paths
- **File Serving**: Signed URLs only
- **Path Structure**: `users/{user_id}/uploads/{filename}`

### Upload Restrictions
- **File Types**: Images only (posters, avatars)
- **Size Limits**: Max 5MB per file
- **Scanning**: Malware/virus scanning on upload
- **Validation**: Content-type verification

## 🧪 Testing RLS

### Verification Steps
1. **Create test users** with different UUIDs
2. **Insert user items** for each user
3. **Verify isolation** using "Run as user" in Supabase SQL editor
4. **Test anonymous access** (should see no user data)
5. **Confirm public read** (works accessible to all)

### Test Script
Run `backend/test_rls.py` to verify RLS policies:
```bash
cd backend
python test_rls.py
```

## 🚨 Security Checklist

### Deployment Security
- [ ] Environment files (`.env*`) are gitignored
- [ ] Service role key is server-side only
- [ ] CORS is restricted to allowed origins
- [ ] HTTPS is enforced in production
- [ ] Database connections use SSL

### Code Security
- [ ] No secrets in source code
- [ ] JWT tokens are validated on every request
- [ ] RLS policies are tested and verified
- [ ] Input validation on all API endpoints
- [ ] Error messages don't leak sensitive info

### Infrastructure Security
- [ ] Supabase project has proper access controls
- [ ] Database backups are encrypted
- [ ] Logs don't contain sensitive data
- [ ] Rate limiting is configured
- [ ] Security headers are set

## 🔍 Monitoring & Alerts

### Security Events to Monitor
- Failed JWT verification attempts
- RLS policy violations
- Unusual API access patterns
- Large data exports
- Failed authentication attempts

### Logging Strategy
- **Request logs**: User ID (hashed), endpoint, duration, status
- **Security events**: Authentication failures, policy violations
- **No sensitive data**: Tokens, passwords, personal info excluded

## 📞 Security Contact

For security concerns or vulnerability reports, please:
1. Do not create public issues
2. Contact repository maintainers directly
3. Provide detailed reproduction steps
4. Allow time for investigation and fixes

---

> **Remember**: Security is a shared responsibility. Always follow the principle of least privilege and keep dependencies updated.
