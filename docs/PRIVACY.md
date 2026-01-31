## Privacy & Security Overview

This project is open-source, but user data stays private by default and is protected
by Supabase Row Level Security (RLS) and server-side access controls.

### Default Privacy Behavior

- New users are private by default (`profiles.is_public = false`).
- Public visibility is opt-in and controlled by the user.
- Per-field visibility toggles allow users to show/hide specific profile fields.

### Public Profile Exposure

Public profiles are served via a backend endpoint:

- `GET /api/public/profile/{username}`

The endpoint returns only fields that are explicitly marked as visible:

- `username` is returned only if `show_username` is true.
- `avatar_url` is returned only if `show_avatar` is true.

If a profile is not public, the endpoint returns `404` to avoid leaking account existence.

### Data Protection Guarantees

- **RLS enforced**: User-owned tables restrict access to `auth.uid()`.
- **Service role only for writes to canonical tables**: The client never uses the
  service role key.
- **No secrets in repo**: API keys and service role keys live in server env vars.
- **Public data is minimal**: Only fields explicitly flagged as visible are returned.

### Third-Party Data Usage (TMDb)

- **Cache retention limit**: TMDb payloads are retained for no more than 6 months.
- **AI/ML restriction**: TMDb content is not used to train machine learning or AI
  models unless a commercial license explicitly allows it.

### Residual Risks

No system can guarantee zero leaks. Risks include:

- Misconfigured RLS policies.
- Accidental exposure in future endpoints.
- Leaked secrets or environment variables.
- Third-party breaches (Supabase, hosting provider).

### Security Recommendations

- Keep RLS policies strict and reviewed.
- Rotate service role keys and third-party API keys regularly.
- Add automated tests for public/private access behavior.
- Log access to public endpoints and review for abuse.
