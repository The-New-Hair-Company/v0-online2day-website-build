import Link from 'next/link'
import { Footer } from '@/components/footer'
import { Header } from '@/components/header'

type LegalLink = {
  label: string
  href: string
}

export type LegalSection = {
  title: string
  body?: string[]
  items?: string[]
  links?: LegalLink[]
  table?: {
    columns: string[]
    rows: string[][]
  }
}

type LegalPageProps = {
  title: string
  description: string
  lastUpdated: string
  sections: LegalSection[]
}

export function LegalPage({ title, description, lastUpdated, sections }: LegalPageProps) {
  return (
    <>
      <Header />
      <main className="min-h-screen pt-24">
        <section className="px-4 py-16 md:py-20">
          <div className="container mx-auto max-w-4xl">
            <div className="mb-12">
              <Link href="/" className="text-sm font-semibold text-primary hover:underline">
                Online2Day
              </Link>
              <h1 className="mt-4 text-4xl font-bold tracking-tight md:text-5xl">{title}</h1>
              <p className="mt-5 max-w-3xl text-lg leading-8 text-muted-foreground">{description}</p>
              <p className="mt-4 text-sm font-medium text-muted-foreground">Last updated: {lastUpdated}</p>
            </div>

            <div className="space-y-12">
              {sections.map((section) => (
                <section key={section.title} className="border-t border-border pt-8">
                  <h2 className="text-2xl font-bold tracking-tight">{section.title}</h2>
                  {section.body?.map((paragraph) => (
                    <p key={paragraph} className="mt-4 leading-7 text-muted-foreground">
                      {paragraph}
                    </p>
                  ))}
                  {section.items ? (
                    <ul className="mt-5 space-y-3 text-muted-foreground">
                      {section.items.map((item) => (
                        <li key={item} className="flex gap-3 leading-7">
                          <span className="mt-3 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                  ) : null}
                  {section.table ? (
                    <div className="mt-5 overflow-x-auto rounded-lg border border-border">
                      <table className="w-full min-w-170 border-collapse text-left text-sm">
                        <thead className="bg-muted/40 text-foreground">
                          <tr>
                            {section.table.columns.map((column) => (
                              <th key={column} className="border-b border-border px-4 py-3 font-semibold">
                                {column}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {section.table.rows.map((row) => (
                            <tr key={row.join('-')} className="border-b border-border last:border-0">
                              {row.map((cell) => (
                                <td key={cell} className="px-4 py-3 leading-6 text-muted-foreground">
                                  {cell}
                                </td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : null}
                  {section.links ? (
                    <div className="mt-5 flex flex-wrap gap-3">
                      {section.links.map((link) => {
                        const className = 'rounded-lg border border-border px-3 py-2 text-sm font-semibold text-primary hover:bg-primary/10'
                        return link.href.startsWith('/') ? (
                          <Link key={link.href} href={link.href} className={className}>
                            {link.label}
                          </Link>
                        ) : (
                          <a
                            key={link.href}
                            href={link.href}
                            target="_blank"
                            rel="noopener noreferrer"
                            className={className}
                          >
                            {link.label}
                          </a>
                        )
                      })}
                    </div>
                  ) : null}
                </section>
              ))}
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </>
  )
}
