// The documentation site (apps/docs). Override with NEXT_PUBLIC_DOCS_URL
// when it's hosted somewhere else.
export const DOCS_URL = process.env.NEXT_PUBLIC_DOCS_URL || 'https://settlr-docs.vercel.app/docs'

// The source code. Settlr is open source under the MIT licence.
export const REPO_URL = 'https://github.com/shreyashrangrej/settlr'

// The commit this build is from (next.config.ts), or '' when it isn't known.
export const COMMIT_SHA = process.env.NEXT_PUBLIC_COMMIT_SHA ?? ''
