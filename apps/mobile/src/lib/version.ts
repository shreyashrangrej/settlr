// The Android app's version. `version` in app.json ("1.2.3") is the only
// number to change, and `pnpm release:android` changes it; app.config.ts
// works Android's versionCode out from it. Plain TypeScript with no imports,
// so app.config.ts and scripts/release.mjs (run by Node) can load it too.

export const BUMPS = ['major', 'minor', 'patch'] as const
export type Bump = (typeof BUMPS)[number]

export function parseVersion(version: string): [number, number, number] {
  const match = /^(\d+)\.(\d+)\.(\d+)$/.exec(version)
  if (!match) throw new Error(`"${version}" isn't a version like 1.2.3`)
  const [major, minor, patch] = match.slice(1).map(Number) as [number, number, number]
  // Two digits each for minor and patch in the versionCode.
  if (minor > 99 || patch > 99) throw new Error(`${version}: minor and patch go up to 99`)
  return [major, minor, patch]
}

// Android won't install an APK over one with a higher versionCode, so it has
// to grow with every release: 1.2.3 is 10203.
export function versionCode(version: string): number {
  const [major, minor, patch] = parseVersion(version)
  return major * 10000 + minor * 100 + patch
}

export function nextVersion(version: string, bump: Bump): string {
  const [major, minor, patch] = parseVersion(version)
  const next =
    bump === 'major' ? `${major + 1}.0.0`
    : bump === 'minor' ? `${major}.${minor + 1}.0`
    : `${major}.${minor}.${patch + 1}`
  parseVersion(next) // past 99 it throws
  return next
}
