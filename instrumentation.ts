import { assertSecureCookieConfig } from './lib/cookie-security'
import { assertEncryptionConfig } from './lib/encryption-config'

export function register() {
  assertSecureCookieConfig()
  assertEncryptionConfig()
}
