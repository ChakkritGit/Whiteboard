import Link from 'next/link'
import { Logo } from '@/components/board/logo'
import { StartBoard } from '@/components/landing/start'
import { DICT, type Lang } from '@/lib/dictionary'
import { SITE } from '@/lib/site'

/** One icon per feature, in the order the dictionary lists them. */
const ICONS: React.ReactNode[] = [
  <path key="lock" d="M12 15v3M7 11V8a5 5 0 0 1 10 0v3M5 11h14v10H5z" />,
  <path key="people" d="M16 19v-1a4 4 0 0 0-8 0v1M12 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM20 19v-1a4 4 0 0 0-3-3.9" />,
  <path key="save" d="M12 4v11M8 11l4 4 4-4M5 20h14" />,
  <g key="offline">
    <path d="m2 2 20 20" />
    <path d="M5.8 5.8A7 7 0 0 0 9 19h8.5c.5 0 .9-.07 1.3-.2" />
    <path d="M21.5 16.5A4.5 4.5 0 0 0 17.5 10h-1.8A7 7 0 0 0 10 5.07" />
  </g>,
  <path key="pen" d="M4 20l4-1 10-10-3-3L5 16l-1 4ZM14 6l3 3" />,
  <path key="git" d="M9 19c-4 1-4-2-6-2m12 5v-3.5a3 3 0 0 0-.9-2.3c3-.3 6-1.5 6-6.5a5 5 0 0 0-1.4-3.5 4.6 4.6 0 0 0-.1-3.4S17.5 2 15 3.7a12 12 0 0 0-6 0C6.5 2 5.5 2.8 5.5 2.8a4.6 4.6 0 0 0-.1 3.4A5 5 0 0 0 4 9.7c0 5 3 6.2 6 6.5a3 3 0 0 0-.9 2.3V22" />,
]

export function Landing({ lang }: { lang: Lang }) {
  const t = DICT[lang]
  const other = lang === 'th' ? 'en' : 'th'
  const otherHref = lang === 'th' ? '/en' : '/'

  return (
    <>
      {/* Structured data, so the answers below can be shown as answers rather
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
              inLanguage: lang,
              description: t.metaDescription,
              applicationCategory: 'BusinessApplication',
              operatingSystem: 'Any, in a web browser',
              browserRequirements: 'Requires JavaScript',
              offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
              featureList: t.features.map((f) => f.title),
              isAccessibleForFree: true,
              codeRepository: SITE.repo,
            },
            {
              '@context': 'https://schema.org',
              '@type': 'FAQPage',
              inLanguage: lang,
              mainEntity: t.faq.map(([q, a]) => ({
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
          <span className="flex items-center gap-2">
            {/* A real link, not a toggle: the other language is another page, and
                a crawler that cannot click a button can follow this. */}
            <Link
              href={otherHref}
              hrefLang={other}
              className="inline-flex items-center rounded-lg border border-line px-3 py-1.5 text-sm/6 font-semibold text-muted hover:bg-panel/70 hover:text-ink"
            >
              {other === 'th' ? 'ไทย' : 'English'}
            </Link>
            <a
              href={SITE.repo}
              className="inline-flex items-center rounded-lg border border-line px-3 py-1.5 text-sm/6 font-semibold text-muted hover:bg-panel/70 hover:text-ink"
            >
              {t.source}
            </a>
          </span>
        </header>

        <main className="mx-auto max-w-5xl px-6 pb-24">
          <section className="pt-10 pb-16 sm:pt-16">
            <h1 className="max-w-3xl text-4xl leading-[1.15] font-extrabold tracking-tight text-balance sm:text-6xl">
              {t.tagline}
            </h1>
            <p className="mt-6 max-w-2xl text-lg leading-relaxed text-muted">{t.heroBody}</p>
            <div className="mt-9 flex flex-wrap items-center gap-4">
              <StartBoard label={t.startBoard} opening={t.opening} lang={lang} />
              <span className="text-sm text-muted">{t.freeNoSignup}</span>
            </div>
          </section>

          <section aria-labelledby="features" className="border-t border-line pt-14">
            <h2 id="features" className="text-2xl font-bold tracking-tight sm:text-3xl">
              {t.whatItDoes}
            </h2>
            <ul className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {t.features.map((feature, i) => (
                <li key={feature.title} className="glass rounded-2xl p-5">
                  <span className="grid size-10 place-items-center rounded-xl bg-accent/12 text-accent">
                    <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                      {ICONS[i]}
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
              {t.howItWorks}
            </h2>
            <ol className="mt-8 grid gap-6 sm:grid-cols-3">
              {t.steps.map(([title, body], i) => (
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
              {t.questions}
            </h2>
            <dl className="mt-8 grid gap-7 sm:grid-cols-2">
              {t.faq.map(([q, a]) => (
                <div key={q}>
                  <dt className="text-base font-bold">{q}</dt>
                  <dd className="mt-1.5 text-sm leading-relaxed text-muted">{a}</dd>
                </div>
              ))}
            </dl>
          </section>

          <section className="mt-16 border-t border-line pt-14 text-center">
            <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">{t.ctaHeading}</h2>
            <p className="mx-auto mt-3 max-w-md text-muted">{t.ctaBody}</p>
            <div className="mt-7 flex justify-center">
              <StartBoard label={t.openNewBoard} opening={t.opening} lang={lang} />
            </div>
          </section>
        </main>

        <footer className="border-t border-line">
          <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3 px-6 py-8 text-sm text-muted">
            <span>{t.footer}</span>
            <a href={SITE.repo} className="font-semibold hover:text-ink">
              GitHub
            </a>
          </div>
        </footer>
      </div>
    </>
  )
}
