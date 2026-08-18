/** Checks that all required environment variables are set. Throws with a descriptive message if any are missing. */
export function validateEnvironment(): void {
  const requiredEnvVars = [
    'BOT_TOKEN',
    'DATABASE_URL',
    'HF_API_KEY',
    'GROQ_API_KEY',
    'COHERE_API_KEY',
  ]

  const missing = requiredEnvVars.filter((env) => !process.env[env])
  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`)
  }
}
