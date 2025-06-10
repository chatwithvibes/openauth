# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Common Development Commands

```bash
# Install dependencies (using Bun, not npm)
bun install

# Build the main OpenAuth package
cd packages/openauth && bun run build

# Run tests
cd packages/openauth && bun test

# Format all code (auto-commits changes)
./scripts/format

# Start documentation dev server
cd www && bun run dev

# Release new version
bun run release
```

## High-Level Architecture

OpenAuth is a standards-based OAuth 2.0 provider that can be self-hosted on various platforms. The codebase is organized as:

### Core Package (`packages/openauth/`)
- **`src/issuer.ts`**: Main OAuth server implementation built on Hono
- **`src/client.ts`**: OAuth client for consuming OpenAuth tokens
- **`src/subject.ts`**: Subject/user management and JWT token structure
- **`src/provider/`**: 20+ OAuth provider implementations (GitHub, Google, etc.)
- **`src/storage/`**: Storage adapters (Memory, DynamoDB, Cloudflare KV)
- **`src/ui/`**: Prebuilt themeable React components for auth flows

### Key Concepts
1. **Issuer**: The auth server that handles OAuth flows and issues tokens
2. **Providers**: Identity providers (GitHub, Google, Password, etc.) that authenticate users
3. **Subjects**: The data structure encoded in JWT tokens (user ID, workspace ID, etc.)
4. **Storage**: Where refresh tokens and auth data are persisted
5. **Success Callback**: Where you implement user lookup/creation after successful auth

### Testing Strategy
- Tests are in `packages/openauth/test/` directory
- Run with `bun test` in the package directory
- Tests cover providers, storage adapters, and core flows

### Deployment Patterns
The issuer can be deployed to:
- Bun/Node.js servers (direct export)
- AWS Lambda (via `hono/aws-lambda` handler)
- Cloudflare Workers (direct export)
- Each deployment example is in `examples/issuer/`

### Client Integration Examples
Client applications in `examples/client/` show integration with:
- Next.js (App Router with server actions)
- React (SPA with PKCE flow)
- Astro (SSR with middleware)
- SvelteKit (SSR with hooks)

## Important Notes

- Always use Bun commands, not npm
- The project uses exact dependency versions (`bunfig.toml`)
- Formatting uses Prettier with no semicolons
- All code is TypeScript with strict typing
- OAuth flows follow RFC 6749 specifications
- UI components are optional and customizable