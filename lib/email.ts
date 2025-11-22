import nodemailer from "nodemailer"
import { prisma } from "./prisma"
import crypto from "crypto"

interface EmailConfig {
  host: string
  port: number
  secure: boolean
  user: string
  password: string
  from: string
}

let transporter: nodemailer.Transporter | null = null
let emailConfig: EmailConfig | null = null

// Encryption key (in production, use environment variable)
const ENCRYPTION_KEY = process.env.EMAIL_ENCRYPTION_KEY || "default-encryption-key-change-in-production-32-chars"
const ALGORITHM = "aes-256-cbc"

function encrypt(text: string): string {
  const iv = crypto.randomBytes(16)
  const key = Buffer.from(ENCRYPTION_KEY.slice(0, 32).padEnd(32, "0"))
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv)
  let encrypted = cipher.update(text, "utf8", "hex")
  encrypted += cipher.final("hex")
  return iv.toString("hex") + ":" + encrypted
}

export function decrypt(text: string): string {
  const parts = text.split(":")
  const iv = Buffer.from(parts.shift()!, "hex")
  const encryptedText = parts.join(":")
  const key = Buffer.from(ENCRYPTION_KEY.slice(0, 32).padEnd(32, "0"))
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv)
  let decrypted = decipher.update(encryptedText, "hex", "utf8")
  decrypted += decipher.final("utf8")
  return decrypted
}

export function initializeEmail(config: EmailConfig) {
  emailConfig = config
  transporter = nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.secure, // true for 465, false for other ports
    auth: {
      user: config.user,
      pass: config.password,
    },
    // Add connection options to prevent socket close errors
    connectionTimeout: 10000, // 10 seconds
    greetingTimeout: 10000, // 10 seconds
    socketTimeout: 10000, // 10 seconds
    // Retry configuration
    pool: true,
    maxConnections: 1,
    maxMessages: 3,
  })
}

export async function sendEmail(
  to: string,
  subject: string,
  html: string,
  text?: string
) {
  // Try to load from DB if not configured
  if (!transporter || !emailConfig) {
    const loaded = await loadEmailConfigFromDB()
    if (!loaded) {
      throw new Error("Email not configured. Please configure email settings first.")
    }
  }

  if (!transporter || !emailConfig) {
    throw new Error("Email not configured. Please configure email settings first.")
  }

  try {
    const info = await transporter.sendMail({
      from: emailConfig.from,
      to,
      subject,
      text: text || html.replace(/<[^>]*>/g, ""), // Strip HTML for text version
      html,
    })

    return { success: true, messageId: info.messageId }
  } catch (error: any) {
    console.error("Error sending email:", error)
    console.error("Email config:", {
      host: emailConfig?.host,
      port: emailConfig?.port,
      secure: emailConfig?.secure,
      user: emailConfig?.user,
      from: emailConfig?.from,
    })
    throw new Error(`Failed to send email: ${error.message}`)
  }
}

export async function sendPasswordResetEmail(
  to: string,
  resetLink: string,
  userName: string
) {
  const subject = "Password Reset Request"
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background-color: #4F46E5; color: white; padding: 20px; text-align: center; border-radius: 5px 5px 0 0; }
        .content { background-color: #f9fafb; padding: 30px; border-radius: 0 0 5px 5px; }
        .button { display: inline-block; padding: 12px 24px; background-color: #4F46E5; color: white; text-decoration: none; border-radius: 5px; margin: 20px 0; }
        .footer { text-align: center; margin-top: 20px; color: #666; font-size: 12px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>Password Reset Request</h1>
        </div>
        <div class="content">
          <p>Hello ${userName},</p>
          <p>We received a request to reset your password. Click the button below to reset it:</p>
          <a href="${resetLink}" class="button">Reset Password</a>
          <p>Or copy and paste this link into your browser:</p>
          <p style="word-break: break-all; color: #4F46E5;">${resetLink}</p>
          <p>This link will expire in 1 hour.</p>
          <p>If you didn't request this, please ignore this email.</p>
        </div>
        <div class="footer">
          <p>This is an automated message. Please do not reply to this email.</p>
        </div>
      </div>
    </body>
    </html>
  `

  return sendEmail(to, subject, html)
}

export function isEmailConfigured(): boolean {
  return transporter !== null && emailConfig !== null
}

/**
 * Helper function to safely decrypt password
 * Returns plain text if decryption fails (for backward compatibility)
 */
function safeDecrypt(encryptedPassword: string): string {
  try {
    // Check if password looks encrypted (has colon separator)
    if (encryptedPassword.includes(":") && encryptedPassword.length > 32) {
      return decrypt(encryptedPassword)
    }
    // If not encrypted format, return as-is (plain text)
    return encryptedPassword
  } catch (error) {
    // If decryption fails, assume it's plain text (for backward compatibility)
    console.warn("Failed to decrypt password, using as plain text:", error)
    return encryptedPassword
  }
}

/**
 * Load email configuration from database and initialize transporter
 * This should be called on server startup to restore saved configuration
 */
export async function loadEmailConfigFromDB(): Promise<boolean> {
  try {
    const dbConfig = await prisma.emailConfig.findFirst({
      where: { isActive: true },
      orderBy: { updatedAt: "desc" },
    })

    if (!dbConfig) {
      return false
    }

    // Safely decrypt password (handles both encrypted and plain text)
    const password = safeDecrypt(dbConfig.password)
    
    initializeEmail({
      host: dbConfig.host,
      port: dbConfig.port,
      secure: dbConfig.secure,
      user: dbConfig.user,
      password: password,
      from: dbConfig.from,
    })

    return true
  } catch (error) {
    console.error("Error loading email config from database:", error)
    return false
  }
}

// Export encrypt for use in API routes
export { encrypt }
