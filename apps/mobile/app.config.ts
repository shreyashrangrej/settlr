import type { ConfigContext, ExpoConfig } from 'expo/config'

import { versionCode } from './src/lib/version.ts'

// app.json holds the config; this only adds Android's versionCode, worked out
// from `version` so there's one number to bump (`pnpm release:android`).
export default ({ config }: ConfigContext): ExpoConfig => ({
  ...(config as ExpoConfig),
  android: { ...config.android, versionCode: versionCode(config.version!) },
})
