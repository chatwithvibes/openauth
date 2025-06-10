import { Hono } from "hono"
import { cors } from "hono/cors"
import issuer from "./issuer.js"

const app = new Hono()

// Enable CORS for testing
app.use("/*", cors({
  origin: ["http://localhost:3000", "http://localhost:5173"],
  credentials: true,
}))

// Mount the issuer
app.route("/", issuer)

// Test endpoints
app.get("/test", (c) => c.text("OpenAuth NATS test server running"))

const port = 3002
console.log(`🚀 OpenAuth NATS issuer running at http://localhost:${port}`)
console.log(`📧 Password provider enabled - verification codes will be logged to console`)

export default {
  port,
  fetch: app.fetch,
}