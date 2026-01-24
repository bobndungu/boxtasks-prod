import { describe, it, expect } from 'vitest'
import { decodeHtmlEntities, decodeHtmlEntitiesSafe } from './htmlEntities'

describe('decodeHtmlEntities', () => {
  it('decodes HTML entities', () => {
    expect(decodeHtmlEntities('Hello &amp; World')).toBe('Hello & World')
  })

  it('decodes apostrophes', () => {
    expect(decodeHtmlEntities('It&#039;s a test')).toBe("It's a test")
  })

  it('decodes quotes', () => {
    expect(decodeHtmlEntities('&quot;quoted&quot;')).toBe('"quoted"')
  })

  it('returns empty string for empty input', () => {
    expect(decodeHtmlEntities('')).toBe('')
  })

  it('returns plain text unchanged', () => {
    expect(decodeHtmlEntities('no entities here')).toBe('no entities here')
  })
})

describe('decodeHtmlEntitiesSafe', () => {
  it('returns null for null input', () => {
    expect(decodeHtmlEntitiesSafe(null)).toBeNull()
  })

  it('returns undefined for undefined input', () => {
    expect(decodeHtmlEntitiesSafe(undefined)).toBeUndefined()
  })

  it('decodes valid strings', () => {
    expect(decodeHtmlEntitiesSafe('&amp;')).toBe('&')
  })
})
