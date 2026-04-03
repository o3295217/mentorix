/**
 * Shared API utilities for error handling, validation, and common operations
 */

import { NextResponse } from 'next/server'
import { safeParseJson } from './safe-json'

// ============================================================================
// ERROR HANDLING
// ============================================================================

/**
 * Standardized error response that hides sensitive details in production
 */
export function apiError(
  message: string,
  status: number = 500,
  error?: unknown
): NextResponse {
  // Log full error for debugging
  if (error) {
    console.error(`[API Error] ${message}:`, error)
  }

  // Only expose error details in development
  const response: { error: string; details?: string } = { error: message }

  if (process.env.NODE_ENV === 'development' && error) {
    response.details = error instanceof Error ? error.message : String(error)
  }

  return NextResponse.json(response, { status })
}

/**
 * Common error responses
 */
export const ApiErrors = {
  notFound: (resource: string) => apiError(`${resource} not found`, 404),
  badRequest: (message: string) => apiError(message, 400),
  validationFailed: (details: unknown) => {
    console.error('[Validation Error]:', details)
    return NextResponse.json(
      { error: 'Validation failed', ...(process.env.NODE_ENV === 'development' ? { details } : {}) },
      { status: 400 }
    )
  },
  serverError: (message: string, error?: unknown) => apiError(message, 500, error),
}

// ============================================================================
// JSON PARSING
// ============================================================================

/**
 * Safely parse JSON with fallback value
 * Handles null, undefined, and malformed JSON
 */
export { safeParseJson }

// ============================================================================
// INPUT SANITIZATION
// ============================================================================

const PROMPT_INJECTION_PATTERNS = [
  /ignore\s+(all\s+)?previous\s+instructions/gi,
  /ignore\s+(all\s+)?above\s+instructions/gi,
  /disregard\s+(all\s+)?previous/gi,
  /forget\s+(all\s+)?previous/gi,
  /new\s+instructions?:/gi,
  /system\s*prompt/gi,
  /\[INST\]/gi,
  /\[\/INST\]/gi,
  /<\|im_start\|>/gi,
  /<\|im_end\|>/gi,
]

/**
 * Sanitize user input to prevent prompt injection attacks
 */
export function sanitizeUserInput(text: string, maxLength: number = 50000): string {
  if (!text) return ''

  let sanitized = text

  // Remove control characters (except newlines and tabs)
  // eslint-disable-next-line no-control-regex
  sanitized = sanitized.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')

  // Replace known prompt injection patterns
  for (const pattern of PROMPT_INJECTION_PATTERNS) {
    sanitized = sanitized.replace(pattern, '[filtered]')
  }

  // Truncate if too long
  if (sanitized.length > maxLength) {
    sanitized = sanitized.substring(0, maxLength) + '\n...[truncated]'
  }

  return sanitized
}

/**
 * Validate that input size is within limits
 */
export function validateInputSize(
  inputs: Record<string, string | undefined>,
  limits: Record<string, number>
): { valid: boolean; errors: string[] } {
  const errors: string[] = []

  for (const [field, value] of Object.entries(inputs)) {
    if (value && limits[field] && value.length > limits[field]) {
      errors.push(`${field} exceeds maximum length of ${limits[field]} characters`)
    }
  }

  return { valid: errors.length === 0, errors }
}

// ============================================================================
// CLAUDE AI RESPONSE PARSING
// ============================================================================

/**
 * Extract and validate JSON from Claude AI response
 * Uses a more precise regex and validates the structure
 */
export function extractJsonFromAIResponse<T>(
  responseText: string,
  validator: (obj: unknown) => obj is T,
  errorContext: string
): T {
  // First try to find JSON in code blocks
  const codeBlockMatch = responseText.match(/```(?:json)?\s*([\s\S]*?)\s*```/)
  const textToSearch = codeBlockMatch ? codeBlockMatch[1] : responseText

  // Find JSON object - use balanced bracket matching for better accuracy
  let depth = 0
  let startIndex = -1
  let jsonText = ''

  for (let i = 0; i < textToSearch.length; i++) {
    const char = textToSearch[i]

    if (char === '{') {
      if (depth === 0) startIndex = i
      depth++
    } else if (char === '}') {
      depth--
      if (depth === 0 && startIndex !== -1) {
        jsonText = textToSearch.substring(startIndex, i + 1)
        break
      }
    }
  }

  if (!jsonText) {
    console.error(`[${errorContext}] No JSON found in response (length: ${responseText.length})`)
    throw new Error(`${errorContext}: Failed to extract JSON from AI response`)
  }

  let parsed: unknown
  try {
    parsed = JSON.parse(jsonText)
  } catch (err) {
    console.error(`[${errorContext}] JSON parse error:`, err)
    console.error(`[${errorContext}] JSON text (first 500 chars):`, jsonText.substring(0, 500))
    throw new Error(`${errorContext}: Invalid JSON in AI response`)
  }

  if (!validator(parsed)) {
    console.error(`[${errorContext}] Validation failed for response:`, parsed)
    throw new Error(`${errorContext}: AI response structure is invalid`)
  }

  return parsed
}

// ============================================================================
// SCORE VALIDATION
// ============================================================================

/**
 * Validate that a score is within the expected range
 */
export function isValidScore(value: unknown, min: number = 1, max: number = 10): value is number {
  return typeof value === 'number' && !isNaN(value) && value >= min && value <= max
}

/**
 * Clamp a score to valid range
 */
export function clampScore(value: number, min: number = 1, max: number = 10): number {
  return Math.max(min, Math.min(max, Math.round(value)))
}
