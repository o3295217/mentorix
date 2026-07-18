#!/usr/bin/env node

const ERROR_MESSAGE = 'NEXT_PUBLIC_APP_URL must be a valid https URL with hostname and without credentials'

export function validatePublicAppUrl(raw) {
  if (typeof raw !== 'string' || raw.length === 0 || raw !== raw.trim()) {
    return { ok: false, error: ERROR_MESSAGE }
  }

  let url
  try {
    url = new URL(raw)
  } catch {
    return { ok: false, error: ERROR_MESSAGE }
  }

  if (url.protocol !== 'https:' || !url.hostname || url.username || url.password) {
    return { ok: false, error: ERROR_MESSAGE }
  }

  return { ok: true }
}

function fail(message) {
  console.error(message)
  process.exit(1)
}

function assertValid(name, value) {
  const result = validatePublicAppUrl(value)
  if (!result.ok) fail(`${name}: ${result.error}`)
}

if (import.meta.url === new URL(process.argv[1], 'file:').href) {
  const [runtimeUrl, flag, expectedBuildUrl] = process.argv.slice(2)

  assertValid('NEXT_PUBLIC_APP_URL', runtimeUrl)

  if (flag === '--equals') {
    assertValid('BUILT_NEXT_PUBLIC_APP_URL', expectedBuildUrl)
    if (runtimeUrl !== expectedBuildUrl) {
      fail('NEXT_PUBLIC_APP_URL must match build-time BUILT_NEXT_PUBLIC_APP_URL')
    }
  } else if (flag) {
    fail(`Unknown option: ${flag}`)
  }
}
