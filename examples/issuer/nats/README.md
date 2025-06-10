# NATS KV Storage Example

This example shows how to use NATS KV as a storage backend for OpenAuth.

## Prerequisites

1. Install and run NATS Server with JetStream enabled:
   ```bash
   # Using Docker
   docker run -d -p 4222:4222 nats:latest -js
   
   # Or install locally
   # macOS: brew install nats-server
   # Then run: nats-server -js
   ```

2. Install dependencies:
   ```bash
   bun install
   ```

## Running the example

```bash
bun run dev
```

The auth server will be available at http://localhost:3000

## Configuration

- `NATS_URL`: NATS server URL (default: `nats://localhost:4222`)

## Features

This example demonstrates:
- Using NATS KV for storing refresh tokens and auth data
- Configuring TTL for the KV bucket (30 days)
- Setting up history retention (5 versions)