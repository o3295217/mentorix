function normalizedCookieSecure() {
  return process.env.COOKIE_SECURE?.trim().toLowerCase()
}

export function assertSecureCookieConfig() {
  if (process.env.NODE_ENV === 'production' && normalizedCookieSecure() === 'false') {
    throw new Error('COOKIE_SECURE=false is not allowed when NODE_ENV=production')
  }
}

export function shouldUseSecureCookies() {
  assertSecureCookieConfig()
  return process.env.NODE_ENV === 'production' || normalizedCookieSecure() === 'true'
}
