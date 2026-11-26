import { describe, expect, it } from 'vitest'

import { amountCents, centsToAmount, displayAmount, pressKey, type Key } from './keypad'

function type(keys: Array<Key>, start = '') {
  return keys.reduce(pressKey, start)
}

describe('the amount keypad', () => {
  it('builds whole amounts and turns them into cents', () => {
    const amount = type(['1', '2', '4', '0'])
    expect(amount).toBe('1240')
    expect(amountCents(amount)).toBe(124000)
  })

  it('takes at most two decimals', () => {
    expect(type(['1', '2', '.', '5', '0', '9'])).toBe('12.50')
    expect(amountCents('12.50')).toBe(1250)
    expect(amountCents('12.5')).toBe(1250)
  })

  it('ignores a second decimal point and starts "." as "0."', () => {
    expect(type(['.', '5', '.'])).toBe('0.5')
    expect(amountCents('0.5')).toBe(50)
  })

  it('replaces a leading zero instead of padding it', () => {
    expect(type(['0', '0', '7'])).toBe('7')
  })

  it('deletes the last key, and empty is zero', () => {
    expect(type(['9', '9', 'del'])).toBe('9')
    expect(type(['9', 'del', 'del'])).toBe('')
    expect(amountCents('')).toBe(0)
    expect(amountCents('4.')).toBe(400)
  })

  it('stops at 8 whole digits (the backend caps amounts)', () => {
    expect(type(['1', '2', '3', '4', '5', '6', '7', '8', '9'])).toBe('12345678')
  })

  it('groups digits for display, the Indian way for rupees', () => {
    expect(displayAmount('1234567', true)).toBe('12,34,567')
    expect(displayAmount('1234567', false)).toBe('1,234,567')
    expect(displayAmount('1200.5', false)).toBe('1,200.5')
    expect(displayAmount('', true)).toBe('0')
  })

  it('turns stored cents back into what the keypad shows', () => {
    expect(centsToAmount(620000)).toBe('6200')
    expect(centsToAmount(124050)).toBe('1240.5')
    expect(centsToAmount(1205)).toBe('12.05')
    expect(amountCents(centsToAmount(1205))).toBe(1205)
  })
})
