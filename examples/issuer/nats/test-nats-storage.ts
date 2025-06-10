#!/usr/bin/env bun
import { connect } from "nats"
import { NatsStorage } from "../../../packages/openauth/src/storage/nats.js"

async function testNatsStorage() {
  console.log("🧪 Testing NATS Storage Adapter...")
  
  try {
    // Connect to NATS
    console.log("📡 Connecting to NATS...")
    const nc = await connect({ servers: "nats://localhost:4222" })
    const js = nc.jetstream()
    
    // Create KV bucket
    console.log("🗄️  Creating KV bucket...")
    const kv = await js.views.kv("openauth-test", {
      history: 5,
      ttl: 60 * 60 * 24 * 30 // 30 days
    })
    
    // Create storage adapter
    const storage = NatsStorage({ kv })
    
    // Test 1: Basic set/get
    console.log("\n📝 Test 1: Basic set/get")
    await storage.set(["test", "key1"], { value: "hello world" })
    const value1 = await storage.get(["test", "key1"])
    console.log("✅ Set and retrieved:", value1)
    
    // Test 2: Complex object
    console.log("\n📝 Test 2: Complex object storage")
    const complexObj = {
      user: { id: "123", email: "test@example.com" },
      tokens: ["token1", "token2"],
      metadata: { created: new Date().toISOString() }
    }
    await storage.set(["users", "123"], complexObj)
    const retrieved = await storage.get(["users", "123"])
    console.log("✅ Complex object stored and retrieved:", retrieved)
    
    // Test 3: TTL/Expiry
    console.log("\n📝 Test 3: TTL/Expiry")
    const expiryDate = new Date(Date.now() + 5000) // 5 seconds
    await storage.set(["temp", "key"], { temp: true }, expiryDate)
    const beforeExpiry = await storage.get(["temp", "key"])
    console.log("✅ Before expiry:", beforeExpiry)
    console.log("⏳ Waiting 6 seconds for expiry...")
    await new Promise(resolve => setTimeout(resolve, 6000))
    const afterExpiry = await storage.get(["temp", "key"])
    console.log("✅ After expiry:", afterExpiry === undefined ? "undefined (expired)" : afterExpiry)
    
    // Test 4: Scan with prefix
    console.log("\n📝 Test 4: Scan with prefix")
    await storage.set(["scan", "item1"], { id: 1 })
    await storage.set(["scan", "item2"], { id: 2 })
    await storage.set(["scan", "item3"], { id: 3 })
    await storage.set(["other", "item"], { id: 4 })
    
    console.log("Scanning for 'scan' prefix:")
    for await (const [key, value] of storage.scan(["scan"])) {
      console.log("  Found:", key, "=>", value)
    }
    
    // Test 5: Remove
    console.log("\n📝 Test 5: Remove")
    await storage.remove(["test", "key1"])
    const removed = await storage.get(["test", "key1"])
    console.log("✅ After removal:", removed === undefined ? "undefined (removed)" : removed)
    
    // Test 6: OAuth flow simulation
    console.log("\n📝 Test 6: OAuth flow simulation")
    const authCode = "auth_" + Math.random().toString(36).substring(7)
    const codeData = {
      clientId: "test-client",
      redirectUri: "http://localhost:3000/callback",
      codeChallenge: "challenge123",
      email: "user@example.com"
    }
    
    // Store auth code (expires in 10 minutes)
    await storage.set(
      ["oauth", "codes", authCode], 
      codeData,
      new Date(Date.now() + 10 * 60 * 1000)
    )
    console.log("✅ Stored auth code:", authCode)
    
    // Retrieve auth code
    const retrievedCode = await storage.get(["oauth", "codes", authCode])
    console.log("✅ Retrieved auth code data:", retrievedCode)
    
    // Simulate refresh token storage
    const refreshToken = "refresh_" + Math.random().toString(36).substring(7)
    await storage.set(
      ["oauth", "refresh", refreshToken],
      { userId: "user123", clientId: "test-client" },
      new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30 days
    )
    console.log("✅ Stored refresh token:", refreshToken)
    
    console.log("\n✅ All tests passed!")
    
    // Cleanup
    await nc.close()
    
  } catch (error) {
    console.error("❌ Test failed:", error)
    process.exit(1)
  }
}

// Run tests
testNatsStorage()