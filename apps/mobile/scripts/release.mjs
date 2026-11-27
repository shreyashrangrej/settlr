// Releases the Android app. `pnpm release:android patch|minor|major` (from
// the repo root) bumps `version` in app.json, commits it, tags the commit
// vX.Y.Z and pushes both to main. The tag starts .github/workflows/android.yml,
// which builds the APK and attaches it to a GitHub release listing the
// changes since the last one. Needs Node 22.18 or later (it loads
// src/lib/version.ts directly).
import { execFileSync } from 'node:child_process'
import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import { BUMPS, nextVersion, versionCode } from '../src/lib/version.ts'

const appDir = fileURLToPath(new URL('..', import.meta.url))
const appJson = fileURLToPath(new URL('../app.json', import.meta.url))
const git = (...args) => execFileSync('git', args, { cwd: appDir, encoding: 'utf8' }).trim()

function fail(message) {
  console.error(message)
  process.exit(1)
}

const bump = process.argv[2]
if (!BUMPS.includes(bump)) fail('Usage: pnpm release:android patch|minor|major')

if (git('rev-parse', '--abbrev-ref', 'HEAD') !== 'main') fail('Release from main.')
if (git('status', '--porcelain', '--untracked-files=no')) {
  fail("Uncommitted changes wouldn't be in the release: commit or stash them first.")
}
git('fetch', '--quiet', '--tags', 'origin', 'main')
try {
  git('merge-base', '--is-ancestor', 'origin/main', 'HEAD')
} catch {
  fail('main is behind origin/main: pull first.')
}

const config = JSON.parse(readFileSync(appJson, 'utf8'))
const version = nextVersion(config.expo.version, bump)
const tag = `v${version}`
if (git('tag', '--list', tag)) fail(`${tag} already exists.`)

config.expo.version = version
writeFileSync(appJson, `${JSON.stringify(config, null, 2)}\n`)
git('commit', '--quiet', '-m', `Android app ${version}`, '--', 'app.json')
git('tag', '-a', tag, '-m', `Settlr for Android ${version}`)
try {
  git('push', '--atomic', 'origin', 'main', tag)
} catch {
  fail(`The push failed. The commit and ${tag} are made here; push them with: git push --atomic origin main ${tag}`)
}
console.log(`Released ${tag} (versionCode ${versionCode(version)}). GitHub Actions is building the APK.`)
