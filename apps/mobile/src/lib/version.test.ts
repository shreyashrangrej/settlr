import { describe, expect, it } from 'vitest'

import { nextVersion, parseVersion, versionCode } from './version'

describe('versionCode', () => {
  it('packs the version into one number', () => {
    expect(versionCode('1.0.2')).toBe(10002)
    expect(versionCode('1.2.3')).toBe(10203)
    expect(versionCode('2.0.0')).toBe(20000)
  })

  it('grows with every release, so each APK installs over the last', () => {
    const releases = ['1.0.2', '1.0.10', '1.0.99', '1.1.0', '1.10.0', '1.99.99', '2.0.0', '10.0.0']
    const codes = releases.map(versionCode)
    expect(codes).toEqual([...codes].sort((a, b) => a - b))
    expect(new Set(codes).size).toBe(codes.length)
    // 1.0.1 shipped with versionCode 2; everything after must beat it.
    expect(codes[0]).toBeGreaterThan(2)
  })
})

describe('parseVersion', () => {
  it('refuses anything but major.minor.patch', () => {
    for (const bad of ['1.0', 'v1.0.0', '1.0.0-beta', '1.0.0.0', ' 1.0.0', '']) {
      expect(() => parseVersion(bad)).toThrow("isn't a version")
    }
  })

  it('refuses a minor or patch over 99, which would collide in the versionCode', () => {
    expect(() => parseVersion('1.100.0')).toThrow('up to 99')
    expect(() => parseVersion('1.0.100')).toThrow('up to 99')
    expect(parseVersion('1.99.99')).toEqual([1, 99, 99])
  })
})

describe('nextVersion', () => {
  it('bumps one part and resets the smaller ones', () => {
    expect(nextVersion('1.0.1', 'patch')).toBe('1.0.2')
    expect(nextVersion('1.0.1', 'minor')).toBe('1.1.0')
    expect(nextVersion('1.2.3', 'major')).toBe('2.0.0')
  })

  it('stops at 99 rather than making a version whose versionCode collides', () => {
    expect(() => nextVersion('1.0.99', 'patch')).toThrow('up to 99')
    expect(nextVersion('1.0.99', 'minor')).toBe('1.1.0')
  })
})
