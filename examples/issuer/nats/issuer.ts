import { issuer } from "@openauthjs/openauth"
import { PasswordProvider } from "@openauthjs/openauth/provider/password"
import { PasswordUI } from "@openauthjs/openauth/ui/password"
import { NatsStorage } from "@openauthjs/openauth/storage/nats"
import { connect } from "@nats-io/transport-node"
import { jetstream } from "@nats-io/jetstream"
import { Kvm } from "@nats-io/kv"
import { subjects } from "../../subjects.js"

// Connect to NATS
const nc = await connect({ 
  servers: process.env.NATS_URL || "nats://localhost:4222" 
})

// Create JetStream client
const js = jetstream(nc)

// Create KV manager and bucket
const kvm = new Kvm(nc)
const kv = await kvm.create("openauth", { 
  history: 5,
  ttl: 60 * 60 * 24 * 30 * 1000 // 30 days in milliseconds
})

export default issuer({
  subjects,
  providers: {
    password: PasswordProvider(
      PasswordUI({
        sendCode: async (email, code) => {
          console.log("Email verification code", email, code)
        },
      }),
    ),
  },
  storage: NatsStorage({ kv }),
  success: async (ctx, value) => {
    if (value.provider === "password") {
      return ctx.subject("user", {
        id: crypto.randomUUID(),
      })
    }
    throw new Error("Invalid provider")
  },
})