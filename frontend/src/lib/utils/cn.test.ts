import { describe, it, expect } from 'vitest'
import { cn } from './cn'

describe('cn utility', () => {
  it('merges class names', () => {
    expect(cn('foo', 'bar')).toBe('foo bar')
  })

  it('handles conditional classes', () => {
    const isHidden = false
    const isVisible = true
    expect(cn('base', isHidden && 'hidden', isVisible && 'visible')).toBe('base visible')
  })

  it('merges Tailwind classes correctly', () => {
    expect(cn('px-2 py-1', 'px-4')).toBe('py-1 px-4')
  })

  it('handles undefined and null inputs', () => {
    expect(cn('base', undefined, null, 'end')).toBe('base end')
  })

  it('handles empty input', () => {
    expect(cn()).toBe('')
  })
})
