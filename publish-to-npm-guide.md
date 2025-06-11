# Publishing OpenAuth to npm Registry

## Important Note about NATS Dependencies

The OpenAuth package now includes NATS v3 dependencies for the NATS storage adapter:
- `@nats-io/nats-core`: ^3.0.0
- `@nats-io/transport-node`: ^3.0.0  
- `@nats-io/jetstream`: ^3.0.0
- `@nats-io/kv`: ^3.0.0

These are included as regular dependencies (not peer dependencies) to ensure the NATS storage adapter works out of the box.

## Option 1: Publish to npm (Recommended for Public Use)

### 1. Update package.json

First, remove or modify the GitHub Package Registry configuration:

```json
{
  "name": "@yourusername/openauth",  // or just "openauth" if available
  "version": "0.4.3",
  // Remove or comment out:
  // "publishConfig": {
  //   "registry": "https://npm.pkg.github.com"
  // }
}
```

### 2. Create npm account
```bash
# If you don't have an npm account
npm adduser
# Or login if you already have one
npm login
```

### 3. Build and Publish
```bash
cd packages/openauth
bun run build
npm publish --access public
```

### 4. Usage
```bash
# Install in any project
npm install @yourusername/openauth
# or
bun add @yourusername/openauth
```

```typescript
import { issuer } from "@yourusername/openauth"
import { NatsStorage } from "@yourusername/openauth/storage/nats"
```

## Option 2: Keep GitHub Package Registry (Public)

### 1. Make Repository Public
- Go to GitHub repository settings
- Make the repository public

### 2. Update package.json
```json
{
  "name": "@yourgithubusername/openauth",
  "publishConfig": {
    "registry": "https://npm.pkg.github.com",
    "access": "public"
  }
}
```

### 3. Setup GitHub Token
```bash
# Create a personal access token with `write:packages` scope
# https://github.com/settings/tokens

# Login to GitHub Package Registry
npm login --registry=https://npm.pkg.github.com
# Username: YOUR_GITHUB_USERNAME
# Password: YOUR_GITHUB_TOKEN
# Email: YOUR_EMAIL
```

### 4. Publish
```bash
cd packages/openauth
bun run build
npm publish
```

### 5. Usage (requires .npmrc)
```bash
# Users need to create .npmrc in their project:
echo "@yourgithubusername:registry=https://npm.pkg.github.com" > .npmrc

# Then install
npm install @yourgithubusername/openauth
```

## Option 3: Use Git URL Directly (No Registry)

### 1. Ensure dist is committed
```bash
cd packages/openauth
bun run build
git add dist
git commit -m "build: add dist for git imports"
git push
```

### 2. Usage
```json
// In package.json
{
  "dependencies": {
    "openauth": "github:yourusername/openauth#packages/openauth"
  }
}
```

Or with Bun:
```bash
bun add github:yourusername/openauth#packages/openauth
```

## Option 4: Create a Standalone Package

### 1. Create new repository
Create a new repo just for the openauth package:
```bash
# Create new repo: openauth-package
mkdir openauth-package
cd openauth-package
git init

# Copy the package
cp -r ../openauth/packages/openauth/* .
```

### 2. Update package.json
```json
{
  "name": "openauth",  // or @yourusername/openauth
  "version": "0.4.3",
  "repository": {
    "type": "git",
    "url": "https://github.com/yourusername/openauth-package.git"
  }
  // Remove publishConfig
}
```

### 3. Publish to npm
```bash
npm login
bun run build
npm publish --access public
```

## Recommended Approach

For maximum ease of use, I recommend **Option 1** (npm registry) with these steps:

1. **Fork or create your own package**:
```bash
cd packages/openauth
```

2. **Update package.json**:
```json
{
  "name": "openauth-nats",  // Choose unique name
  "version": "0.4.3",
  "description": "OpenAuth with NATS storage support",
  "keywords": ["oauth", "authentication", "nats", "openauth"],
  "homepage": "https://github.com/yourusername/openauth",
  "repository": {
    "type": "git",
    "url": "https://github.com/yourusername/openauth.git"
  },
  "author": "Your Name",
  "license": "MIT"
  // Remove publishConfig section
}
```

3. **Publish**:
```bash
npm login
bun run build
npm publish --access public
```

4. **Use in projects**:
```bash
npm install openauth-nats
```

```typescript
import { issuer } from "openauth-nats"
import { NatsStorage } from "openauth-nats/storage/nats"
```

## Version Management

After publishing, to release updates:

```bash
# Update version
npm version patch  # or minor/major

# Build and publish
bun run build
npm publish
```

## Alternative: JSR (JavaScript Registry)

JSR is a new TypeScript-first registry:

1. **Create jsr.json**:
```json
{
  "name": "@yourusername/openauth",
  "version": "0.4.3",
  "exports": "./dist/esm/index.js"
}
```

2. **Publish**:
```bash
deno publish
# or
npx jsr publish
```

3. **Usage**:
```typescript
import { issuer } from "jsr:@yourusername/openauth"
```