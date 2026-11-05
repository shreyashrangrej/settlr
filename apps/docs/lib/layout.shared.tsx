import type { BaseLayoutProps } from 'fumadocs-ui/layouts/shared';
import { appName, gitConfig } from './shared';

// The Settlr mark (the same one as apps/web/src/components/brand.tsx).
function Logo() {
  return (
    <svg viewBox="0 0 32 32" aria-hidden="true" className="size-6 shrink-0">
      <rect width="32" height="32" rx="10" fill="#B18CFF" />
      <path d="M10 22 22 10" stroke="#0C0D10" strokeWidth="2.6" strokeLinecap="round" />
      <circle cx="11.5" cy="11.5" r="2.6" fill="#0C0D10" />
      <circle cx="20.5" cy="20.5" r="2.6" fill="#0C0D10" />
    </svg>
  );
}

export function baseOptions(): BaseLayoutProps {
  return {
    nav: {
      title: (
        <>
          <Logo />
          <span className="font-semibold">{appName}</span>
        </>
      ),
    },
    links: [
      { text: 'Documentation', url: '/docs', active: 'nested-url' },
    ],
    githubUrl: `https://github.com/${gitConfig.user}/${gitConfig.repo}`,
  };
}
