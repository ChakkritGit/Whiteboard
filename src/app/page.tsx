import type { Metadata } from 'next'
import { Logo } from '@/components/board/logo'
import { StartBoard } from '@/components/landing/start'
import { SITE } from '@/lib/site'

export const metadata: Metadata = {
  title: SITE.tagline,
  description: SITE.description,
  alternates: { canonical: '/' },
}

const FEATURES = [
  {
    title: 'Nothing to sign in to',
    body: 'No account, no email, no install. The link is the whole of the access control — whoever has it is in the room, and whoever does not, is not.',
    icon: <path d="M12 15v3M7 11V8a5 5 0 0 1 10 0v3M5 11h14v10H5z" />,
  },
  {
    title: 'Everyone at once',
    body: 'Notes, drawings and text arrive as they are made, with each person’s cursor and name on the board beside them. No refreshing, no saving, no taking turns.',
    icon: <path d="M16 19v-1a4 4 0 0 0-8 0v1M12 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM20 19v-1a4 4 0 0 0-3-3.9" />,
  },
  {
    title: 'Yours to keep',
    body: 'Export the board to a plain JSON file you can read, diff and commit, and import it back into any room. Your work is not trapped in somebody else’s database.',
    icon: <path d="M12 4v11M8 11l4 4 4-4M5 20h14" />,
  },
  {
    title: 'Works offline',
    body: 'The board is kept in your browser as well as in the room, so it opens instantly, survives a dropped connection, and catches up when you come back.',
    icon: <path d="M5 18h9a4 4 0 0 0 .6-8A6 6 0 0 0 3.5 12M17 14l3 3m0-3-3 3" />,
  },
  {
    title: 'The tools you reach for',
    body: 'Sticky notes, text, boxes, frames, a pen and a highlighter, an eraser, groups, layers, undo — with a right-click menu, and a light, dark and system theme.',
    icon: <path d="M4 20l4-1 10-10-3-3L5 16l-1 4ZM14 6l3 3" />,
  },
  {
    title: 'Free and open',
    body: 'The whole thing is on GitHub, room server included. Run it on your own machine, or deploy the rooms to a Cloudflare Worker and pay nothing.',
    icon: <path d="M9 19c-4 1-4-2-6-2m12 5v-3.5a3 3 0 0 0-.9-2.3c3-.3 6-1.5 6-6.5a5 5 0 0 0-1.4-3.5 4.6 4.6 0 0 0-.1-3.4S17.5 2 15 3.7a12 12 0 0 0-6 0C6.5 2 5.5 2.8 5.5 2.8a4.6 4.6 0 0 0-.1 3.4A5 5 0 0 0 4 9.7c0 5 3 6.2 6 6.5a3 3 0 0 0-.9 2.3V22" />,
  },
]

const STEPS = [
  ['Open a board', 'One click. It is yours the moment it exists — no setup, no naming, no project to create first.'],
  ['Send the link', 'Copy the URL out of the address bar, or press Share. Anyone who opens it is standing on the same board as you.'],
  ['Work on it together', 'Everything anyone does shows up for everyone else as it happens. Export the file when you are done, or leave it and come back.'],
]

const FAQ = [
  {
    q: 'Is it really free?',
    a: 'Yes. There is no account to make and nothing to pay for. The source is on GitHub and you can run your own copy if you would rather.',
  },
  {
    q: 'Do I need to sign up or install anything?',
    a: 'No. It runs in the browser and there is no sign-in step at all. Opening the link is joining the board.',
  },
  {
    q: 'If two people each share their own link, do the boards get mixed up?',
    a: 'No. Each link is its own room, and rooms never see each other. Two people working on two links are working on two separate boards.',
  },
  {
    q: 'Who can see my board?',
    a: 'Whoever has the link. The room id is random and unguessable, and it is the whole of the access control — so treat the link the way you would treat the board itself.',
  },
  {
    q: 'Can I get my work out?',
    a: 'Export writes a plain JSON file with everything on the board in it, and import reads it back into any room. Nothing is locked in.',
  },
]

export default function Home() {
  return (
    <>
      {/* Structured data, so the answers above can be shown as answers rather
          than as a page that happens to contain them. */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify([
            {
              '@context': 'https://schema.org',
              '@type': 'WebApplication',
              name: SITE.name,
              url: SITE.url,
              description: SITE.description,
              applicationCategory: 'BusinessApplication',
              operatingSystem: 'Any, in a web browser',
              browserRequirements: 'Requires JavaScript',
              offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
              featureList: FEATURES.map((f) => f.title),
              isAccessibleForFree: true,
              codeRepository: SITE.repo,
            },
            {
              '@context': 'https://schema.org',
              '@type': 'FAQPage',
              mainEntity: FAQ.map(({ q, a }) => ({
                '@type': 'Question',
                name: q,
                acceptedAnswer: { '@type': 'Answer', text: a },
              })),
            },
          ]),
        }}
      />

      <div className="board-paper min-h-screen">
        <header className="mx-auto flex max-w-5xl items-center justify-between px-6 py-6">
          <span className="flex items-center gap-2.5">
            <Logo size={32} />
            <span className="text-lg font-bold tracking-tight">{SITE.name}</span>
          </span>
          <a
            href={SITE.repo}
            className="rounded-lg border border-line px-3 py-1.5 text-sm font-semibold text-muted hover:bg-panel/70 hover:text-ink"
          >
            Source
          </a>
        </header>

        <main className="mx-auto max-w-5xl px-6 pb-24">
          <section className="pt-10 pb-16 sm:pt-16">
            <h1 className="max-w-3xl text-4xl leading-[1.08] font-extrabold tracking-tight text-balance sm:text-6xl">
              A shared whiteboard with nothing to sign in to
            </h1>
            <p className="mt-6 max-w-2xl text-lg leading-relaxed text-muted">
              Open a board, send the link, and whoever follows it is already in the room with you —
              drawing, writing and moving sticky notes on the same canvas, at the same time. No
              account, no install, nothing to pay for.
            </p>
            <div className="mt-9 flex flex-wrap items-center gap-4">
              <StartBoard />
              <span className="text-sm text-muted">Free · no sign-up · works in any browser</span>
            </div>
          </section>

          <section aria-labelledby="features" className="border-t border-line pt-14">
            <h2 id="features" className="text-2xl font-bold tracking-tight sm:text-3xl">
              What it does
            </h2>
            <ul className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {FEATURES.map((feature) => (
                <li key={feature.title} className="glass rounded-2xl p-5">
                  <span className="grid size-10 place-items-center rounded-xl bg-accent/12 text-accent">
                    <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                      {feature.icon}
                    </svg>
                  </span>
                  <h3 className="mt-4 text-base font-bold">{feature.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted">{feature.body}</p>
                </li>
              ))}
            </ul>
          </section>

          <section aria-labelledby="how" className="mt-16 border-t border-line pt-14">
            <h2 id="how" className="text-2xl font-bold tracking-tight sm:text-3xl">
              How it works
            </h2>
            <ol className="mt-8 grid gap-6 sm:grid-cols-3">
              {STEPS.map(([title, body], i) => (
                <li key={title}>
                  <span className="grid size-8 place-items-center rounded-full bg-ink text-sm font-bold text-canvas">
                    {i + 1}
                  </span>
                  <h3 className="mt-3 text-base font-bold">{title}</h3>
                  <p className="mt-1.5 text-sm leading-relaxed text-muted">{body}</p>
                </li>
              ))}
            </ol>
          </section>

          <section aria-labelledby="faq" className="mt-16 border-t border-line pt-14">
            <h2 id="faq" className="text-2xl font-bold tracking-tight sm:text-3xl">
              Questions
            </h2>
            <dl className="mt-8 grid gap-7 sm:grid-cols-2">
              {FAQ.map(({ q, a }) => (
                <div key={q}>
                  <dt className="text-base font-bold">{q}</dt>
                  <dd className="mt-1.5 text-sm leading-relaxed text-muted">{a}</dd>
                </div>
              ))}
            </dl>
          </section>

          <section className="mt-16 border-t border-line pt-14 text-center">
            <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">Start a board</h2>
            <p className="mx-auto mt-3 max-w-md text-muted">
              It takes one click, and the link is ready to send the moment it opens.
            </p>
            <div className="mt-7 flex justify-center">
              <StartBoard label="Open a new board" />
            </div>
          </section>
        </main>

        <footer className="border-t border-line">
          <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3 px-6 py-8 text-sm text-muted">
            <span>{SITE.name} — a shared board, and nothing to sign in to.</span>
            <a href={SITE.repo} className="font-semibold hover:text-ink">
              GitHub
            </a>
          </div>
        </footer>
      </div>
    </>
  )
}
