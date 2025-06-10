#!/usr/bin/env bun

// Test base32 encoding for NATS keys
const testKeys = [
  ["email", "test@example.com", "password"],
  ["oauth", "codes", "auth_123456"],
  ["encryption", "key:2d39ee31-9f44-4b93-b62f-8a61de73b7e2"],
  ["users", "user@test.com", "data"],
]

console.log("Testing Base32 encoding for NATS keys:")
console.log("=" .repeat(50))

testKeys.forEach(key => {
  const encoded = key.map(k => {
    if (/^[-/=.>*\w]+$/.test(k)) {
      return k
    }
    // Simulate base32 encoding
    const base32 = Buffer.from(k).toString('base64')
      .replace(/\+/g, '')
      .replace(/\//g, '')
      .replace(/=/g, '')
      .toUpperCase()
    return 'B32_' + base32
  }).join('.')
  
  console.log("\nOriginal:", key)
  console.log("Encoded: ", encoded)
  console.log("Length:  ", `${key.join('.').length} → ${encoded.length}`)
})