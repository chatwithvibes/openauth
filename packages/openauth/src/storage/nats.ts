/**
 * Configure OpenAuth to use [NATS KV](https://github.com/nats-io/nats.js/blob/main/kv/README.md) as a
 * storage adapter.
 *
 * ```ts
 * import { NatsStorage } from "@openauthjs/openauth/storage/nats"
 * import { connect } from "@nats-io/nats-node"
 *
 * const nc = await connect({ servers: "nats://localhost:4222" })
 * const js = nc.jetstream()
 * const kv = await js.views.kv("openauth")
 *
 * const storage = NatsStorage({
 *   kv
 * })
 *
 * export default issuer({
 *   storage,
 *   // ...
 * })
 * ```
 *
 * @packageDocumentation
 */
import { joinKey, splitKey, StorageAdapter } from "./storage.js"

/**
 * Configure the NATS KV store.
 */
export interface NatsStorageOptions {
  /**
   * The NATS KV bucket instance to use for storage.
   */
  kv: any // NATS KV instance from @nats-io/kv
}

/**
 * Creates a NATS KV store.
 * @param options - The config for the adapter.
 */
export function NatsStorage(options: NatsStorageOptions): StorageAdapter {
  const { kv } = options

  // Base32 encoding/decoding functions
  function base32Encode(input: string): string {
    const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'
    const bytes = new TextEncoder().encode(input)
    let bits = 0
    let value = 0
    let output = ''

    for (let i = 0; i < bytes.length; i++) {
      value = (value << 8) | bytes[i]
      bits += 8

      while (bits >= 5) {
        output += alphabet[(value >>> (bits - 5)) & 31]
        bits -= 5
      }
    }

    if (bits > 0) {
      output += alphabet[(value << (5 - bits)) & 31]
    }

    return output
  }

  function base32Decode(input: string): string {
    const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'
    const bytes: number[] = []
    let bits = 0
    let value = 0

    for (let i = 0; i < input.length; i++) {
      const idx = alphabet.indexOf(input[i])
      if (idx === -1) continue

      value = (value << 5) | idx
      bits += 5

      if (bits >= 8) {
        bytes.push((value >>> (bits - 8)) & 255)
        bits -= 8
      }
    }

    return new TextDecoder().decode(new Uint8Array(bytes))
  }

  // Helper function to encode keys for NATS compatibility
  // NATS only accepts keys matching /^[-/=.>*\w]+$/
  function encodeKeyForNats(key: string[]): string {
    return key.map(k => {
      // If the key segment contains only allowed characters, use it as-is
      if (/^[-/=.>*\w]+$/.test(k)) {
        return k
      }
      // Otherwise, encode it with base32
      return base32Encode(k)
    }).join('.')
  }

  // Helper function to decode NATS keys back to array
  function decodeKeyFromNats(natsKey: string): string[] {
    return natsKey.split('.').map(k => {
      // Try to decode as base32 first, if it fails, use as-is
      try {
        const decoded = base32Decode(k)
        // Check if decoded value makes sense (has non-ASCII or special chars)
        if (/[^\x20-\x7E]|[@:+]/.test(decoded)) {
          return decoded
        }
      } catch (e) {
        // Not base32 encoded
      }
      return k
    })
  }

  return {
    async get(key: string[]) {
      const natsKey = encodeKeyForNats(key)
      try {
        const entry = await kv.get(natsKey)
        if (!entry || !entry.value) return undefined
        
        // Parse the JSON value
        const textDecoder = new TextDecoder()
        const jsonStr = textDecoder.decode(entry.value)
        return JSON.parse(jsonStr) as Record<string, any>
      } catch (error) {
        // Key not found or other error
        return undefined
      }
    },

    async set(key: string[], value: any, expiry?: Date) {
      const natsKey = encodeKeyForNats(key)
      const jsonValue = JSON.stringify(value)
      
      if (expiry) {
        // Calculate TTL in seconds
        const ttl = Math.max(Math.floor((expiry.getTime() - Date.now()) / 1000), 1)
        await kv.put(natsKey, jsonValue, { ttl: ttl * 1000 }) // NATS expects TTL in milliseconds
      } else {
        await kv.put(natsKey, jsonValue)
      }
    },

    async remove(key: string[]) {
      const natsKey = encodeKeyForNats(key)
      await kv.delete(natsKey)
    },

    async *scan(prefix: string[]) {
      const prefixStr = prefix.length > 0 ? encodeKeyForNats(prefix) + '.' : ''
      
      // Use keys() which returns an async iterator in nats package
      try {
        for await (const key of kv.keys()) {
          if (prefixStr === '' || key.startsWith(prefixStr)) {
            try {
              const entry = await kv.get(key)
              if (entry && entry.value) {
                const textDecoder = new TextDecoder()
                const jsonStr = textDecoder.decode(entry.value)
                const value = JSON.parse(jsonStr)
                yield [decodeKeyFromNats(key), value]
              }
            } catch (error) {
              // Skip entries that can't be parsed
              continue
            }
          }
        }
      } catch (error) {
        // If keys() is not available, try using history
        const history = await kv.history()
        const seenKeys = new Set<string>()
        
        for await (const entry of history) {
          if (entry.key && !seenKeys.has(entry.key)) {
            seenKeys.add(entry.key)
            if (prefixStr === '' || entry.key.startsWith(prefixStr)) {
              try {
                const currentEntry = await kv.get(entry.key)
                if (currentEntry && currentEntry.value) {
                  const textDecoder = new TextDecoder()
                  const jsonStr = textDecoder.decode(currentEntry.value)
                  const value = JSON.parse(jsonStr)
                  yield [decodeKeyFromNats(entry.key), value]
                }
              } catch (error) {
                // Skip entries that can't be parsed
                continue
              }
            }
          }
        }
      }
    },
  }
}