import crypto from "crypto"

function key(): Buffer {
  const secret = process.env.APP_ENCRYPTION_KEY
  if (!secret) throw new Error("APP_ENCRYPTION_KEY is not configured")
  return crypto.createHash("sha256").update(secret).digest()
}

export function encryptSecret(value: string): string {
  const iv = crypto.randomBytes(12)
  const cipher = crypto.createCipheriv("aes-256-gcm", key(), iv)
  const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()])
  const tag = cipher.getAuthTag()
  return [iv, tag, encrypted].map((part) => part.toString("base64url")).join(".")
}

export function decryptSecret(value: string): string {
  const [ivRaw, tagRaw, bodyRaw] = value.split(".")
  if (!ivRaw || !tagRaw || !bodyRaw) throw new Error("Invalid encrypted secret")
  const decipher = crypto.createDecipheriv("aes-256-gcm", key(), Buffer.from(ivRaw, "base64url"))
  decipher.setAuthTag(Buffer.from(tagRaw, "base64url"))
  return Buffer.concat([
    decipher.update(Buffer.from(bodyRaw, "base64url")),
    decipher.final(),
  ]).toString("utf8")
}

export function hashSessionToken(value: string): string {
  return crypto.createHash("sha256").update(value).digest("hex")
}
