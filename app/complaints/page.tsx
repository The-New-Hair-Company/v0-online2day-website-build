import type { Metadata } from 'next'
import { LegalPage, type LegalSection } from '@/components/legal/legal-page'

export const metadata: Metadata = {
  title: 'Complaints Charter | Online2Day',
  description: 'How Online2Day handles complaints, escalation, consumer rights, and UK dispute resolution references.',
}

const sections: LegalSection[] = [
  {
    title: 'Our Promise',
    body: [
      'We want complaints to be easy to raise, carefully reviewed, and resolved without defensiveness. This charter applies to complaints about Online2Day projects, support, billing, dashboard access, CRM workflows, video tools, hosted video pages, privacy handling, or website content.',
      'We will treat a complaint as an opportunity to fix the issue, explain our decision clearly, and improve the service.',
    ],
  },
  {
    title: 'How To Complain',
    items: [
      'Email info@online2day.com with the subject line "Complaint".',
      'Call +44 333 050 6098 and ask for the complaint to be logged.',
      'Include your name, company if relevant, contact details, project or account reference, what happened, what outcome you want, and any useful evidence.',
    ],
  },
  {
    title: 'What Happens Next',
    table: {
      columns: ['Stage', 'Target timing', 'What we do'],
      rows: [
        ['Acknowledgement', 'Within 2 working days', 'Confirm receipt, log the complaint, and identify who owns the response.'],
        ['Initial review', 'Within 10 working days', 'Review the facts, speak to the relevant team, and propose a fix, explanation, or next step.'],
        ['Escalation', 'Within 20 working days', 'If you disagree, a senior reviewer will reconsider the complaint and issue a final response where possible.'],
        ['Deadlock or external route', 'After final response or unresolved delay', 'Where applicable, we will explain external options such as ICO complaints, Citizens Advice, ADR signposting, or court routes.'],
      ],
    },
  },
  {
    title: 'Remedies We May Offer',
    items: [
      'A clear explanation, apology, correction, rework, replacement, support intervention, service credit, refund, or cancellation route where appropriate.',
      'A privacy response, data correction, access support, deletion review, or restriction review where the complaint concerns personal data.',
      'A process change, security action, audit note, or staff guidance where the complaint shows something operational needs to improve.',
    ],
  },
  {
    title: 'UK Consumer Law Reference',
    body: [
      'If you are a UK consumer, we handle service complaints with reference to the Consumer Rights Act 2015, including the requirement that services are performed with reasonable care and skill. Digital content and unfair terms rules may also be relevant depending on what was bought.',
      'Where distance selling rules apply, the Consumer Contracts Regulations 2013 may require specific pre-contract and cancellation information. Bespoke or fully performed services may have different cancellation treatment.',
    ],
    links: [
      { label: 'GOV.UK: Consumer Rights Act 2015', href: 'https://www.gov.uk/government/publications/consumer-rights-act-2015/consumer-rights-act-2015' },
      { label: 'Consumer Contracts Regulations 2013', href: 'https://www.legislation.gov.uk/uksi/2013/3134/contents/made' },
    ],
  },
  {
    title: 'Alternative Dispute Resolution',
    body: [
      'Alternative dispute resolution, or ADR, is a way to resolve disputes without going to court. As at 5 May 2026, GOV.UK states that 2026 ADR instruments under the Digital Markets, Competition and Consumers Act 2024 implement Chapter 4 of Part 4 and replace the older voluntary ADR accreditation framework with a mandatory accreditation framework for ADR providers for consumer contract disputes.',
      'If we cannot resolve a consumer complaint in-house, we will identify a relevant accredited ADR provider or advice route where one is available and tell you whether we agree to use that process.',
    ],
    links: [
      { label: 'GOV.UK: ADR reforms 2026', href: 'https://www.gov.uk/government/publications/the-digital-markets-competition-and-consumers-act-2024-alternative-dispute-regulations-2026' },
      { label: 'Citizens Advice consumer service', href: 'https://www.citizensadvice.org.uk/consumer/' },
      { label: 'CTSI ADR providers', href: 'https://www.tradingstandards.uk/consumer-help/adr-approved-bodies/' },
    ],
  },
  {
    title: 'Data Protection Complaints',
    body: [
      'If your complaint is about personal data, privacy, cookies, tracking, marketing emails, recording consent, or data rights, we will handle it under our Privacy Policy and applicable UK data protection law.',
      'You can complain to the Information Commissioner\'s Office if you are unhappy with our response or how we handle personal data.',
    ],
    links: [
      { label: 'Online2Day Privacy Policy', href: '/privacy' },
      { label: 'ICO: make a complaint', href: 'https://ico.org.uk/make-a-complaint/' },
      { label: 'GOV.UK: UK data protection law', href: 'https://www.gov.uk/data-protection/the-data-protection-act' },
    ],
  },
  {
    title: 'What We Need From You',
    items: [
      'Raise the complaint as soon as reasonably possible so evidence is easier to review.',
      'Keep communications factual and provide screenshots, emails, recordings, invoices, or account details where relevant.',
      'Tell us what outcome you want, even if we cannot always provide that exact remedy.',
    ],
  },
  {
    title: 'No Retaliation',
    body: [
      'We will not treat you unfairly for raising a complaint. We may still need to pause work or restrict access for security, non-payment, unlawful content, or misuse, but we will separate those issues from the complaint review.',
    ],
  },
]

export default function ComplaintsPage() {
  return (
    <LegalPage
      title="Complaints Charter"
      description="A clear route for raising concerns and getting a fair, documented response from Online2Day."
      lastUpdated="5 May 2026"
      sections={sections}
    />
  )
}
