# Installation Instructions

This fork of OpenAuth includes NATS storage support. You can install it in your private repository using one of these methods:

## Option 1: Direct Git Dependency (Simplest)

```bash
# Using Bun
bun add git+ssh://git@github.com:chatwithvibes/openauth.git#nats-storage

# Using npm/yarn/pnpm
npm install git+ssh://git@github.com:chatwithvibes/openauth.git#nats-storage
```

**Note**: Make sure your machine has SSH access to GitHub configured.

## Option 2: GitHub Package Registry

### First-time setup for your private repo:

1. Create a `.npmrc` file in your private repository root:
```
@chatwithvibes:registry=https://npm.pkg.github.com
//npm.pkg.github.com/:_authToken=${GITHUB_TOKEN}
```

2. Set up authentication:
   - Create a GitHub Personal Access Token with `read:packages` scope
   - Add it as `GITHUB_TOKEN` environment variable or in `.npmrc`

3. Install the package:
```bash
bun add @chatwithvibes/openauth
```

## Usage

After installation, you can use it like this:

```typescript
import { createAuth } from '@chatwithvibes/openauth'
import { createPassword } from '@chatwithvibes/openauth/provider/password'
import { createNatsStorage } from '@chatwithvibes/openauth/storage/nats'

// Your auth configuration
const auth = createAuth({
  storage: createNatsStorage({
    servers: ['nats://localhost:4222'],
    bucket: 'openauth-tokens'
  }),
  // ... other config
})
```

## Troubleshooting

### Build Issues
The package includes a `prepare` script that automatically builds during installation. If you encounter issues:

1. Ensure you have Bun installed
2. Try clearing your package manager cache
3. Clone and build manually if needed

### Private Repo Access
If using Option 1, ensure:
- Your SSH keys are properly configured with GitHub
- You have read access to the chatwithvibes/openauth repository

### GitHub Packages Access
If using Option 2, ensure:
- Your Personal Access Token has `read:packages` scope
- The token is properly set in your environment or `.npmrc`
- You're using the correct scope (@chatwithvibes)