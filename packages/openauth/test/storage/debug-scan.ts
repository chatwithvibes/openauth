import { connect } from "nats"
import { NatsStorage } from "../../src/storage/nats.js"

async function debugScan() {
  const nc = await connect({ servers: "nats://localhost:4222" })
  const js = nc.jetstream()
  
  const kv = await js.views.kv("debug_test", {
    history: 5,
    ttl: 60 * 60 * 24 * 30
  })
  
  const storage = NatsStorage({ kv })
  
  console.log("Setting test data...")
  await storage.set(["users", "1"], { id: 1 })
  await storage.set(["users", "2"], { id: 2 })
  await storage.set(["other", "3"], { id: 3 })
  
  console.log("\nAll keys in KV:")
  let keyCount = 0
  for await (const key of kv.keys()) {
    console.log(" -", key)
    keyCount++
  }
  console.log("Total keys:", keyCount)
  
  console.log("\nScanning with prefix ['users']:")
  const scanResults = []
  for await (const [key, value] of storage.scan(["users"])) {
    console.log(" -", key, "=>", value)
    scanResults.push([key, value])
  }
  console.log("Scan results count:", scanResults.length)
  
  // Try scanning again
  console.log("\nScanning again:")
  const scanResults2 = []
  for await (const result of storage.scan(["users"])) {
    scanResults2.push(result)
  }
  console.log("Second scan count:", scanResults2.length)
  
  await nc.close()
}

debugScan().catch(console.error)