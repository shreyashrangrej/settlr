import Link from 'next/link';

const sections = [
  {
    title: 'Using Settlr',
    description: 'Friends, groups, personal spending, budgets, receipts and the assistant.',
    href: '/docs/guide/getting-started',
  },
  {
    title: 'Connect an AI app',
    description: 'Use Settlr from Claude, ChatGPT and other MCP clients.',
    href: '/docs/guide/mcp',
  },
  {
    title: 'Development',
    description: 'The monorepo, the Convex backend, auth, and how to deploy it.',
    href: '/docs/development',
  },
];

export default function HomePage() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center px-6 py-20 text-center">
      <p className="mb-3 text-sm font-medium text-fd-primary">Settlr documentation</p>
      <h1 className="mb-4 max-w-2xl text-4xl font-bold tracking-tight sm:text-5xl">
        Split shared expenses and settle up with the fewest payments
      </h1>
      <p className="mb-8 max-w-xl text-fd-muted-foreground">
        Guides for people using Settlr, and a tour of the code for people working on it.
      </p>
      <Link
        href="/docs"
        className="rounded-xl bg-fd-primary px-5 py-2.5 text-sm font-medium text-fd-primary-foreground"
      >
        Read the docs
      </Link>
      <div className="mt-14 grid w-full max-w-4xl gap-4 text-left sm:grid-cols-3">
        {sections.map((section) => (
          <Link
            key={section.href}
            href={section.href}
            className="rounded-2xl border bg-fd-card p-5 transition-colors hover:bg-fd-accent"
          >
            <h2 className="mb-1 font-semibold">{section.title}</h2>
            <p className="text-sm text-fd-muted-foreground">{section.description}</p>
          </Link>
        ))}
      </div>
    </main>
  );
}
