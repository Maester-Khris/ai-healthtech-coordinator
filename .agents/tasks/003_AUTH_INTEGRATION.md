# Task: Auth Integration — UI Shell + Full Integration

**ID:** 003
**Scope:** `frontend`, `backend`, `shared`
**Tests required:** no

---

## Context

Authentication is split into two sequential parts in this task.
Part 1 is frontend-only: static UI shell with empty handlers, no real auth calls.
Part 2 wires both ends: real Supabase auth on the client, JWT middleware on the backend.

Commit after each part separately — logical commits, not one per file.

Auth architecture decisions (already reviewed):
- Supabase Auth is called directly from the React client for both email and Google
- FastAPI never sees credentials — only JWTs
- supabase-js manages token storage and silent refresh automatically
- FastAPI verifies the JWT per-request via a reusable dependency — no server-side session
- Both email/password and Google OAuth produce the same session shape after login

---

## Part 1 — Frontend UI Shell (commit 1)

### Scope
Frontend only. No real Supabase calls. No backend changes.
Goal: auth UI is visible and structurally correct, handlers are stubbed.

### Files to create

**`webapp/src/auth/AuthContext.tsx`**
```typescript
// Minimal context — will be fully implemented in Part 2
import { createContext, useContext, useState, ReactNode } from "react"

interface AuthUser {
  id: string
  email: string | undefined
}

interface AuthContextValue {
  user: AuthUser | null
  loading: boolean
  signInWithEmail: (email: string, password: string) => Promise<void>
  signUpWithEmail: (email: string, password: string) => Promise<void>
  signInWithGoogle: () => Promise<void>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [loading, setLoading] = useState(false)

  // Stubbed — implemented in Part 2
  const signInWithEmail = async (_email: string, _password: string) => {}
  const signUpWithEmail = async (_email: string, _password: string) => {}
  const signInWithGoogle = async () => {}
  const signOut = async () => {}

  return (
    <AuthContext.Provider value={{
      user, loading,
      signInWithEmail, signUpWithEmail, signInWithGoogle, signOut
    }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error("useAuth must be used within AuthProvider")
  return ctx
}
```

**`webapp/src/auth/authService.ts`**
```typescript
// Stub — real implementation in Part 2
// All methods are no-ops until Supabase client is wired

export const authService = {
  signInWithEmail: async (_email: string, _password: string): Promise<void> => {},
  signUpWithEmail: async (_email: string, _password: string): Promise<void> => {},
  signInWithGoogle: async (): Promise<void> => {},
  signOut: async (): Promise<void> => {},
  getAccessToken: async (): Promise<string | null> => null,
}
```

**`webapp/src/components/auth/LoginModal.tsx`**
Centered modal overlay. Appears when user clicks "Sign in" or "Get started" in the header.
Contains tab switcher between Sign in / Sign up.

Requirements:
- Rendered as a modal overlay with backdrop (same pattern as the get-started design mockup)
- Tab: Sign in — email + password fields + "Sign in" button + "Continue with Google" button
- Tab: Sign up — email + password fields + "Create account" button + "Continue with Google" button
- All button onClick handlers call the corresponding `useAuth()` method (stubbed in Part 1)
- Show a disabled loading state on buttons when `loading` is true
- "×" close button calls `onClose` prop
- No form submission — use button onClick only (per CLAUDE.md: never use HTML form tags)

Props:
```typescript
interface LoginModalProps {
  isOpen: boolean
  onClose: () => void
  defaultTab?: "signin" | "signup"
}
```

**`webapp/src/components/auth/UserMenu.tsx`**
Shown in the header when user is authenticated (replaces "Sign in" / "Get started" buttons).

Requirements:
- Display user email (truncated if long)
- A "Sign out" button that calls `useAuth().signOut()`
- Keep it minimal — avatar initial circle + email + sign out

### Files to modify

**`webapp/src/App.tsx`**
- Wrap the app tree with `<AuthProvider>` imported from `webapp/src/auth/AuthContext.tsx`

**`webapp/src/components/Header.tsx`** (or wherever the header lives)
- Import `useAuth()`
- If `user` is null: show "Sign in" button (opens LoginModal with `defaultTab="signin"`)
  and "Get started" button (opens LoginModal with `defaultTab="signup"`)
- If `user` is not null: show `<UserMenu />`
- Manage `isModalOpen` and `modalTab` state locally in the header

### Packages to add
```bash
# No new packages in Part 1 — supabase-js added in Part 2
```

### Commit 1 — after Part 1 complete
```bash
git add webapp/src/auth/AuthContext.tsx \
        webapp/src/auth/authService.ts \
        webapp/src/components/auth/LoginModal.tsx \
        webapp/src/components/auth/UserMenu.tsx \
        webapp/src/App.tsx \
        webapp/src/components/Header.tsx   # or actual header file path

git commit -m "feat(frontend): auth UI shell — modal, context stub, useAuth hook"
```

Verify before committing:
- `npx tsc --noEmit` passes
- Modal opens and closes from header buttons
- Tabs switch between Sign in and Sign up
- Console shows no errors

---

## Part 2 — Full Auth Integration (commit 2)

### Scope
Frontend: wire real Supabase calls, persistent session, token attachment.
Backend: JWT middleware, auth dependency, auth service.

### Frontend changes

**New package:**
```bash
npm install @supabase/supabase-js
```
Add to `webapp/package.json`. Note in outcome summary.

**`webapp/src/lib/supabaseClient.ts`** (create)
```typescript
import { createClient } from "@supabase/supabase-js"

const url  = import.meta.env.VITE_SUPABASE_URL
const key  = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!url || !key) {
  throw new Error("VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY must be set")
}

export const supabase = createClient(url, key)
```

**`webapp/src/auth/authService.ts`** (replace stub with real implementation)
```typescript
import { supabase } from "../lib/supabaseClient"

export const authService = {
  signInWithEmail: (email: string, password: string) =>
    supabase.auth.signInWithPassword({ email, password }),

  signUpWithEmail: (email: string, password: string) =>
    supabase.auth.signUp({ email, password }),

  signInWithGoogle: () =>
    supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: window.location.origin },
    }),

  signOut: () => supabase.auth.signOut(),

  getAccessToken: async (): Promise<string | null> => {
    const { data } = await supabase.auth.getSession()
    return data.session?.access_token ?? null
  },
}
```

**`webapp/src/auth/AuthContext.tsx`** (replace stub with real implementation)
- On mount: call `supabase.auth.getSession()` to restore existing session
- Subscribe to `supabase.auth.onAuthStateChange` to keep `user` in sync
- Unsubscribe on unmount
- `signInWithEmail`: call `authService.signInWithEmail`, set error state on failure
- `signUpWithEmail`: call `authService.signUpWithEmail`, set error state on failure
- `signInWithGoogle`: call `authService.signInWithGoogle` (redirects — no return value)
- `signOut`: call `authService.signOut`, clear user state
- Expose `error: string | null` in context for LoginModal to display

**`webapp/src/lib/apiClient.ts`** (create)
Thin fetch wrapper that attaches the Bearer token to every request:
```typescript
import { authService } from "../auth/authService"

const BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8000"

export async function apiFetch(path: string, options: RequestInit = {}) {
  const token = await authService.getAccessToken()

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string> ?? {}),
  }

  if (token) {
    headers["Authorization"] = `Bearer ${token}`
  }

  const res = await fetch(`${BASE_URL}${path}`, { ...options, headers })

  if (res.status === 401) {
    // Token may have expired between refresh cycles — surface to caller
    throw new Error("Unauthorized")
  }

  return res
}
```

**Frontend env vars to add to `.env.example`:**
```bash
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
VITE_API_BASE_URL=http://localhost:8000
```

Note: Vite requires the `VITE_` prefix for env vars exposed to the browser.
These are added to Doppler as frontend env vars (not secret — anon key is public-safe).

---

### Backend changes

**`backend/services/auth.py`** (create)
```python
from backend.db import get_supabase_client
from fastapi import HTTPException

def verify_token(token: str) -> dict:
    """
    Verify a Supabase JWT and return the user object.
    Raises HTTPException 401 if the token is invalid or expired.
    """
    try:
        client = get_supabase_client()
        response = client.auth.get_user(token)
        if not response.user:
            raise HTTPException(status_code=401, detail="Invalid or expired token")
        return response.user
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=401, detail="Token verification failed") from exc
```

**`backend/middleware/auth.py`** (create)

Two components:

1. `get_current_user` — FastAPI dependency for protected routes:
```python
from fastapi import Header, HTTPException, Depends
from backend.services.auth import verify_token

async def get_current_user(authorization: str = Header(...)):
    if not authorization.startswith("Bearer "):
        raise HTTPException(401, "Missing or malformed Authorization header")
    token = authorization.removeprefix("Bearer ").strip()
    return verify_token(token)
```

2. `AuthMiddleware` — Starlette middleware that extracts user_id from the JWT
and injects it into `request.state` for any route that wants it without
making it a hard requirement:
```python
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request

class AuthMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        request.state.user_id = None
        auth_header = request.headers.get("Authorization", "")
        if auth_header.startswith("Bearer "):
            token = auth_header.removeprefix("Bearer ").strip()
            try:
                from backend.services.auth import verify_token
                user = verify_token(token)
                request.state.user_id = user.id
            except Exception:
                pass  # unauthenticated request — state.user_id stays None
        return await call_next(request)
```

**`backend/main.py`** (modify)
- Register `AuthMiddleware` via `app.add_middleware(AuthMiddleware)`
- Add a protected test endpoint to verify the middleware works:
```python
@app.get("/me")
async def me(current_user=Depends(get_current_user)):
    return { "user_id": current_user.id, "email": current_user.email }
```
This endpoint is the smoke test for Part 2. It stays in the codebase as a
lightweight auth verification route.

**Backend env vars** — already defined in task 001. No new ones for auth.
The backend uses `SUPABASE_SERVICE_ROLE_KEY` which can call `auth.get_user()`.

---

### File structure produced by Part 2

```
webapp/src/
├── lib/
│   ├── supabaseClient.ts    # Supabase browser client
│   └── apiClient.ts         # fetch wrapper with Bearer token
├── auth/
│   ├── AuthContext.tsx      # Real session management + onAuthStateChange
│   └── authService.ts       # Real Supabase auth calls

backend/
├── middleware/
│   └── auth.py              # get_current_user dependency + AuthMiddleware
└── services/
    └── auth.py              # verify_token(token) -> user
```

### Commit 2 — after Part 2 complete
```bash
git add webapp/src/lib/supabaseClient.ts \
        webapp/src/lib/apiClient.ts \
        webapp/src/auth/AuthContext.tsx \
        webapp/src/auth/authService.ts \
        webapp/package.json \
        webapp/package-lock.json \
        backend/middleware/auth.py \
        backend/services/auth.py \
        backend/main.py \
        .env.example

git commit -m "feat(auth): Supabase auth integration — client session, JWT middleware, verify service"
```

Verify before committing:
- `npx tsc --noEmit` passes
- `doppler run -- uvicorn backend.main:app --reload` starts without errors
- `GET /me` with no token returns `401`
- Email sign-up creates a user in Supabase Auth dashboard
- After sign-in, header shows UserMenu with email
- Page refresh restores session (supabase-js rehydrates from storage)
- Sign out clears session and returns header to Sign in / Get started

---

## Out of Scope

- Password reset / forgot password flow — Phase 2
- Email verification enforcement — Phase 2
- Protected frontend routes (React Router guards) — Phase 2
- Role-based access control — Phase 2
- `/facilities` auth-gating — remains public read in this task

---

## Notes

- Never use HTML `<form>` tags — all submit actions use button onClick (per CLAUDE.md)
- `VITE_SUPABASE_ANON_KEY` is the public-facing key — safe to expose in browser bundles.
  `SUPABASE_SERVICE_ROLE_KEY` is backend-only and never sent to the client
- Google OAuth requires the redirect URL to be registered in the Supabase dashboard:
  Authentication → URL Configuration → Redirect URLs → add `http://localhost:5173`
  and the Vercel preview URL. Flag this in the outcome summary if not yet configured.
- Two commits exactly — one per part. Do not collapse into one or split further.