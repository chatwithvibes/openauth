# Detailed Implementation Guide: Next.js + OpenAuth + NATS Storage

## Complete Project Structure

```
your-project/
├── auth-issuer/              # Separate service for OpenAuth issuer
│   ├── package.json
│   ├── issuer.ts            # Main issuer with NATS storage
│   ├── subjects.ts          # Shared subject schemas
│   └── .env                 # Environment variables
├── nextjs-app/              # Next.js client application
│   ├── app/
│   │   ├── auth.ts          # Client setup & token management
│   │   ├── actions.ts       # Server actions (login/logout/auth)
│   │   ├── api/
│   │   │   └── callback/
│   │   │       └── route.ts # OAuth callback handler
│   │   ├── layout.tsx
│   │   └── page.tsx         # Main page with auth UI
│   ├── package.json
│   └── .env.local           # Environment variables
└── shared/                  # Optional: shared types/schemas
    └── subjects.ts          # Can be imported by both services
```

## Part 1: OpenAuth Issuer with NATS Storage

### 1.1 Install Dependencies

```bash
cd auth-issuer
bun add @openauthjs/openauth @nats-io/transport-node @nats-io/jetstream @nats-io/kv
```

### 1.2 Create Subject Schema (`subjects.ts`)

```typescript
import { object, string, optional } from "valibot"
import { createSubjects } from "@openauthjs/openauth/subject"

export const subjects = createSubjects({
  user: object({
    id: string(),                    // User's unique ID
    email: string(),                 // User's email
    name: optional(string()),        // Optional display name
    role: optional(string()),        // Optional role (admin, user, etc)
  }),
  service: object({                  // For service-to-service auth
    id: string(),
    name: string(),
    scope: string(),                 // Permission scope
  })
})
```

### 1.3 NATS Storage Implementation Details

The NATS storage adapter handles several critical aspects:

1. **Key Encoding**: NATS only accepts keys matching `/^[-/=.>*\w]+$/`. The adapter uses Base32 encoding for non-compliant keys.
2. **TTL Support**: Automatically converts Date expiry to NATS TTL in milliseconds
3. **JSON Serialization**: All values are stored as JSON strings
4. **Scan Operation**: Supports prefix scanning for batch operations

### 1.4 Complete Issuer Implementation (`issuer.ts`)

```typescript
import { issuer } from "@openauthjs/openauth"
import { PasswordProvider } from "@openauthjs/openauth/provider/password"
import { GoogleProvider } from "@openauthjs/openauth/provider/google"
import { GitHubProvider } from "@openauthjs/openauth/provider/github"
import { PasswordUI } from "@openauthjs/openauth/ui/password"
import { SelectUI } from "@openauthjs/openauth/ui/select"
import { NatsStorage } from "@openauthjs/openauth/storage/nats"
import { connect } from "@nats-io/transport-node"
import { jetstream } from "@nats-io/jetstream"
import { Kvm } from "@nats-io/kv"
import { subjects } from "./subjects.js"

// Database simulation (replace with real DB)
const users = new Map<string, { id: string; email: string; password?: string; name?: string }>()

// NATS Connection with retry logic
async function connectToNats() {
  const maxRetries = 5
  let retries = 0
  
  while (retries < maxRetries) {
    try {
      const nc = await connect({ 
        servers: process.env.NATS_URL || "nats://localhost:4222",
        maxReconnectAttempts: -1,  // Infinite reconnect attempts
        reconnectTimeWait: 2000,    // 2 seconds between reconnects
      })
      
      console.log("Connected to NATS")
      return nc
    } catch (error) {
      retries++
      console.error(`NATS connection attempt ${retries} failed:`, error)
      if (retries >= maxRetries) throw error
      await new Promise(resolve => setTimeout(resolve, 2000))
    }
  }
  throw new Error("Failed to connect to NATS")
}

// Initialize NATS
const nc = await connectToNats()
const js = jetstream(nc)
const kvm = new Kvm(nc)

// Create or get KV bucket with configuration
const kv = await kvm.create("openauth", { 
  history: 5,                          // Keep 5 versions for audit
  ttl: 60 * 60 * 24 * 30 * 1000,     // 30 days default TTL (in milliseconds)
  max_bytes: 10 * 1024 * 1024,        // 10MB max storage
  storage: "file",                     // Use file storage for persistence
})

// Email service (replace with real implementation)
async function sendEmail(to: string, subject: string, body: string) {
  console.log(`📧 Email to ${to}: ${subject}\n${body}`)
  // In production: use SendGrid, SES, etc.
}

export default issuer({
  subjects,
  storage: NatsStorage({ kv }),
  
  providers: {
    // Password provider with email verification
    password: PasswordProvider(
      PasswordUI({
        sendCode: async (email, code) => {
          await sendEmail(
            email,
            "Verify your email",
            `Your verification code is: ${code}\n\nThis code expires in 10 minutes.`
          )
        },
      }),
    ),
    
    // OAuth providers
    google: GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
    
    github: GitHubProvider({
      clientId: process.env.GITHUB_CLIENT_ID!,
      clientSecret: process.env.GITHUB_CLIENT_SECRET!,
    }),
  },
  
  // Success callback - where you create/lookup users
  success: async (ctx, value) => {
    let user = null
    
    // Handle password authentication
    if (value.provider === "password") {
      // Check if user exists
      for (const [_, u] of users) {
        if (u.email === value.email) {
          user = u
          break
        }
      }
      
      // Create new user if doesn't exist
      if (!user) {
        user = {
          id: crypto.randomUUID(),
          email: value.email,
          password: value.claims.password, // Hash in production!
          name: value.email.split("@")[0],
        }
        users.set(user.id, user)
        console.log("Created new user:", user.id)
      }
    }
    
    // Handle OAuth authentication
    if (value.provider === "google" || value.provider === "github") {
      const email = value.email
      const name = value.provider === "google" 
        ? value.claims.name 
        : value.claims.login
      
      // Find or create user
      for (const [_, u] of users) {
        if (u.email === email) {
          user = u
          break
        }
      }
      
      if (!user) {
        user = {
          id: crypto.randomUUID(),
          email,
          name,
        }
        users.set(user.id, user)
        console.log("Created OAuth user:", user.id)
      }
    }
    
    if (!user) {
      throw new Error("Authentication failed")
    }
    
    // Return the subject payload that will be encoded in the JWT
    return ctx.subject("user", {
      id: user.id,
      email: user.email,
      name: user.name || user.email,
      role: "user", // You can add role-based logic here
    })
  },
  
  // Optional: Custom select UI for multiple providers
  select: SelectUI({
    providers: {
      password: {
        label: "Email & Password",
        icon: "data:image/svg+xml...", // Email icon SVG
      },
      google: {
        label: "Continue with Google",
      },
      github: {
        label: "Continue with GitHub",
      },
    },
  }),
})

// Graceful shutdown
process.on("SIGTERM", async () => {
  console.log("Shutting down...")
  await nc.drain()
  await nc.close()
  process.exit(0)
})
```

### 1.5 Environment Configuration (`.env`)

```bash
# NATS Configuration
NATS_URL=nats://localhost:4222

# OAuth Providers (optional)
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
GITHUB_CLIENT_ID=your-github-client-id
GITHUB_CLIENT_SECRET=your-github-client-secret

# Server Configuration
PORT=3000
PUBLIC_URL=http://localhost:3000
```

## Part 2: Next.js Client Implementation

### 2.1 Install Dependencies

```bash
cd nextjs-app
bun add @openauthjs/openauth next react react-dom
bun add -d @types/react @types/react-dom typescript
```

### 2.2 Authentication Client (`app/auth.ts`)

```typescript
import { createClient } from "@openauthjs/openauth/client"
import { cookies as getCookies } from "next/headers"

// Import subjects from shared location or issuer
export { subjects } from "../../../auth-issuer/subjects"

// Create OpenAuth client
export const client = createClient({
  clientID: "nextjs-app",  // Unique identifier for this app
  issuer: process.env.NEXT_PUBLIC_AUTH_ISSUER || "http://localhost:3000",
})

// Cookie configuration
const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
  maxAge: 60 * 60 * 24 * 30, // 30 days
}

// Helper to set tokens in cookies
export async function setTokens(access: string, refresh: string) {
  const cookies = await getCookies()
  
  cookies.set({
    name: "access_token",
    value: access,
    ...COOKIE_OPTIONS,
  })
  
  cookies.set({
    name: "refresh_token",
    value: refresh,
    ...COOKIE_OPTIONS,
  })
}

// Helper to clear tokens
export async function clearTokens() {
  const cookies = await getCookies()
  cookies.delete("access_token")
  cookies.delete("refresh_token")
}
```

### 2.3 Server Actions (`app/actions.ts`)

```typescript
"use server"

import { redirect } from "next/navigation"
import { headers as getHeaders, cookies as getCookies } from "next/headers"
import { client, subjects, setTokens, clearTokens } from "./auth"

// Verify current authentication status
export async function auth() {
  const cookies = await getCookies()
  const accessToken = cookies.get("access_token")
  const refreshToken = cookies.get("refresh_token")

  if (!accessToken) {
    return false
  }

  try {
    // Verify token and auto-refresh if needed
    const verified = await client.verify(subjects, accessToken.value, {
      refresh: refreshToken?.value,
    })

    if (verified.err) {
      await clearTokens()
      return false
    }

    // Update tokens if refreshed
    if (verified.tokens) {
      await setTokens(verified.tokens.access, verified.tokens.refresh)
    }

    return verified.subject
  } catch (error) {
    console.error("Auth verification failed:", error)
    await clearTokens()
    return false
  }
}

// Initiate login flow
export async function login(provider?: string) {
  // Check if already authenticated
  const currentAuth = await auth()
  if (currentAuth) {
    redirect("/dashboard") // Or wherever authenticated users go
  }

  const headers = await getHeaders()
  const host = headers.get("host")
  const protocol = host?.includes("localhost") ? "http" : "https"
  const redirectUri = `${protocol}://${host}/api/callback`
  
  // Generate authorization URL
  const { url } = await client.authorize(redirectUri, "code", {
    provider, // Optional: specific provider
  })
  
  redirect(url)
}

// Logout action
export async function logout() {
  await clearTokens()
  redirect("/")
}

// Get user profile (example of using auth data)
export async function getProfile() {
  const subject = await auth()
  if (!subject) {
    throw new Error("Not authenticated")
  }
  
  // You can fetch additional user data from your database here
  // using subject.properties.id
  
  return {
    ...subject.properties,
    // Additional data from database
  }
}
```

### 2.4 OAuth Callback Handler (`app/api/callback/route.ts`)

```typescript
import { client, setTokens } from "../../auth"
import { type NextRequest, NextResponse } from "next/server"

export async function GET(req: NextRequest) {
  const url = new URL(req.url)
  const code = url.searchParams.get("code")
  const error = url.searchParams.get("error")
  
  // Handle OAuth errors
  if (error) {
    console.error("OAuth error:", error)
    return NextResponse.redirect(`${url.origin}/login?error=${error}`)
  }
  
  if (!code) {
    return NextResponse.redirect(`${url.origin}/login?error=no_code`)
  }
  
  try {
    // Exchange authorization code for tokens
    const exchanged = await client.exchange(code, `${url.origin}/api/callback`)
    
    if (exchanged.err) {
      console.error("Token exchange failed:", exchanged.err)
      return NextResponse.redirect(`${url.origin}/login?error=exchange_failed`)
    }
    
    // Store tokens in secure cookies
    await setTokens(exchanged.tokens.access, exchanged.tokens.refresh)
    
    // Redirect to dashboard or intended destination
    const returnTo = url.searchParams.get("returnTo") || "/dashboard"
    return NextResponse.redirect(`${url.origin}${returnTo}`)
    
  } catch (error) {
    console.error("Callback error:", error)
    return NextResponse.redirect(`${url.origin}/login?error=callback_failed`)
  }
}
```

### 2.5 Main Page with Auth (`app/page.tsx`)

```typescript
import { auth, login, logout } from "./actions"
import Link from "next/link"

export default async function HomePage() {
  const subject = await auth()

  return (
    <main className="min-h-screen p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-4xl font-bold mb-8">
          Next.js + OpenAuth + NATS
        </h1>
        
        {subject ? (
          <div className="space-y-4">
            <div className="p-4 bg-green-100 rounded-lg">
              <h2 className="text-xl font-semibold mb-2">
                Welcome, {subject.properties.name}!
              </h2>
              <p className="text-gray-700">
                Email: {subject.properties.email}
              </p>
              <p className="text-gray-700">
                ID: {subject.properties.id}
              </p>
              {subject.properties.role && (
                <p className="text-gray-700">
                  Role: {subject.properties.role}
                </p>
              )}
            </div>
            
            <div className="flex gap-4">
              <Link 
                href="/dashboard"
                className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
              >
                Go to Dashboard
              </Link>
              
              <form action={logout}>
                <button 
                  type="submit"
                  className="px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600"
                >
                  Logout
                </button>
              </form>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <p className="text-gray-600">
              You are not logged in. Choose a login method:
            </p>
            
            <div className="flex flex-col gap-2 max-w-xs">
              <form action={() => login()}>
                <button 
                  type="submit"
                  className="w-full px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
                >
                  Login with Email
                </button>
              </form>
              
              <form action={() => login("google")}>
                <button 
                  type="submit"
                  className="w-full px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600"
                >
                  Login with Google
                </button>
              </form>
              
              <form action={() => login("github")}>
                <button 
                  type="submit"
                  className="w-full px-4 py-2 bg-gray-800 text-white rounded hover:bg-gray-900"
                >
                  Login with GitHub
                </button>
              </form>
            </div>
          </div>
        )}
      </div>
    </main>
  )
}
```

### 2.6 Protected Route Example (`app/dashboard/page.tsx`)

```typescript
import { auth } from "../actions"
import { redirect } from "next/navigation"

export default async function DashboardPage() {
  const subject = await auth()
  
  // Protect the route
  if (!subject) {
    redirect("/login")
  }
  
  return (
    <main className="min-h-screen p-8">
      <h1 className="text-3xl font-bold mb-4">Dashboard</h1>
      <p>Welcome to your dashboard, {subject.properties.name}!</p>
      {/* Your dashboard content */}
    </main>
  )
}
```

### 2.7 Middleware for Global Protection (`middleware.ts`)

```typescript
import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"

// Define protected routes
const protectedRoutes = ["/dashboard", "/api/protected"]

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl
  
  // Check if route needs protection
  const isProtected = protectedRoutes.some(route => 
    pathname.startsWith(route)
  )
  
  if (isProtected) {
    const accessToken = request.cookies.get("access_token")
    
    if (!accessToken) {
      // Redirect to login with return URL
      const loginUrl = new URL("/login", request.url)
      loginUrl.searchParams.set("returnTo", pathname)
      return NextResponse.redirect(loginUrl)
    }
  }
  
  return NextResponse.next()
}

export const config = {
  matcher: [
    // Skip static files and API routes
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
}
```

## Part 3: Production Considerations

### 3.1 NATS Deployment

```yaml
# docker-compose.yml for NATS
version: '3.8'
services:
  nats:
    image: nats:latest
    command: 
      - "--jetstream"
      - "--store_dir=/data"
    ports:
      - "4222:4222"
      - "8222:8222" # Monitoring port
    volumes:
      - nats-data:/data
    environment:
      - NATS_SERVER_NAME=openauth-nats

volumes:
  nats-data:
```

### 3.2 Security Checklist

1. **Password Security**:
   - Use bcrypt/argon2 for password hashing
   - Implement rate limiting on login attempts
   - Add CAPTCHA for repeated failures

2. **Token Security**:
   - Use secure, httpOnly cookies
   - Implement CSRF protection
   - Set appropriate CORS headers

3. **NATS Security**:
   - Enable TLS for NATS connections
   - Use authentication (user/password or JWT)
   - Restrict network access

4. **Environment Variables**:
   - Never commit secrets to git
   - Use proper secret management (Vault, AWS Secrets Manager)
   - Rotate credentials regularly

### 3.3 Monitoring & Debugging

```typescript
// Add to issuer.ts for better debugging
import { createLogger } from "./logger"

const logger = createLogger("auth-issuer")

// Log important events
logger.info("User created", { userId: user.id })
logger.error("Auth failed", { error, provider: value.provider })

// Monitor NATS connection
nc.on("error", (err) => {
  logger.error("NATS error", err)
})

nc.on("disconnect", () => {
  logger.warn("NATS disconnected")
})

nc.on("reconnect", () => {
  logger.info("NATS reconnected")
})
```

## Part 4: Testing

### 4.1 Test NATS Storage

```typescript
// test/nats-storage.test.ts
import { test, expect } from "bun:test"
import { NatsStorage } from "@openauthjs/openauth/storage/nats"

test("NATS storage operations", async () => {
  const storage = NatsStorage({ kv })
  
  // Test set/get
  await storage.set(["test", "key"], { value: "data" })
  const result = await storage.get(["test", "key"])
  expect(result).toEqual({ value: "data" })
  
  // Test TTL
  await storage.set(["temp"], { temp: true }, new Date(Date.now() + 1000))
  await new Promise(r => setTimeout(r, 1500))
  const expired = await storage.get(["temp"])
  expect(expired).toBeUndefined()
})
```

### 4.2 E2E Auth Flow Test

```typescript
// test/auth-flow.test.ts
test("complete auth flow", async () => {
  // 1. Get auth URL
  const { url } = await client.authorize("http://localhost:3000/callback", "code")
  
  // 2. Simulate user login (with Puppeteer/Playwright)
  // 3. Exchange code for tokens
  // 4. Verify tokens
  // 5. Refresh tokens
})
```

## Summary

This comprehensive guide provides all the details needed to implement a production-ready Next.js application with OpenAuth and NATS storage. The key aspects covered include:

1. **NATS Storage**: Handles distributed storage with proper key encoding for NATS compatibility
2. **Security**: Implements secure token storage, CSRF protection, and proper authentication flows
3. **Error Handling**: Comprehensive error handling throughout the auth flow
4. **Type Safety**: Full TypeScript support with proper subject typing
5. **Production Ready**: Includes monitoring, logging, and deployment considerations