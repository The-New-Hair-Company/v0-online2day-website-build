import type { Metadata } from 'next'
import { LegalPage, type LegalSection } from '@/components/legal/legal-page'

export const metadata: Metadata = {
  title: 'Terms and Conditions | Online2Day',
  description: 'Terms for using Online2Day websites, dashboards, CRM tools, video editor, and related services.',
}

const sections: LegalSection[] = [
  {
    title: 'About These Terms',
    body: [
      'These terms apply to online2day.com, the Online2Day dashboard, CRM tools, video editor, hosted video pages, contact forms, and any related services we provide unless a separate written agreement says otherwise.',
      'By using the website or asking us to provide services, you agree to these terms. If you are entering into these terms for a business, you confirm you have authority to bind that business.',
    ],
  },
  {
    title: 'Contact Details',
    body: [
      'Online2Day is a UK-based web development and SaaS services provider. You can contact us at info@online2day.com or +44 333 050 6098.',
      'If a signed statement of work, invoice, or proposal gives different legal notice details, those project documents take priority for that project.',
    ],
  },
  {
    title: 'Our Services',
    items: [
      'Website, SaaS, CRM, automation, design, consulting, hosting, maintenance, and support services.',
      'Dashboard and lead workflow tools for managing sales activity, email handoff, project requests, and videos.',
      'Video recording, upload, editing, hosting, and tracking workflows for personalised outreach and client communication.',
      'Any beta, draft, or preview feature is provided for evaluation until we mark it as production-ready in writing.',
    ],
  },
  {
    title: 'Accounts And Security',
    items: [
      'You must keep account credentials secure and only give access to authorised users.',
      'You are responsible for activity that takes place under your account unless caused by our breach of these terms.',
      'We may suspend access where we reasonably believe there is a security risk, unlawful use, unpaid fees, or misuse of the service.',
    ],
  },
  {
    title: 'Client Content And Permissions',
    body: [
      'You retain ownership of content you provide to us, including copy, brand assets, project material, lead data, uploaded media, and recorded videos. You give us the permissions needed to host, process, display, edit, and transmit that content to provide the services.',
      'You must make sure you have the rights, notices, consents, and lawful basis needed for any personal data, third-party material, video, audio, or brand assets you upload or ask us to use.',
    ],
  },
  {
    title: 'Fees, Projects, And Subscriptions',
    items: [
      'Project scope, fees, payment timing, deliverables, and acceptance criteria should be set out in a proposal, statement of work, invoice, or dashboard order flow.',
      'Unless agreed otherwise, invoices are payable on receipt and overdue amounts may pause delivery or access.',
      'Where a subscription applies, it renews for the period shown at checkout, on the invoice, or in the applicable plan terms until cancelled in line with those terms.',
      'Third-party fees such as domains, hosting, email delivery, APIs, stock assets, or app marketplace charges may be billed separately where they are needed for your project.',
    ],
  },
  {
    title: 'Consumer Rights',
    body: [
      'Nothing in these terms limits rights that cannot legally be limited. If you are a UK consumer, services must be performed with reasonable care and skill and digital content rights may apply under the Consumer Rights Act 2015.',
      'If the Consumer Contracts Regulations 2013 apply to your purchase, we will provide required pre-contract information and cancellation information where applicable. Custom, urgent, or business-to-business work may be treated differently under the law.',
    ],
    links: [
      { label: 'GOV.UK: Consumer Rights Act 2015', href: 'https://www.gov.uk/government/publications/consumer-rights-act-2015/consumer-rights-act-2015' },
      { label: 'Consumer Contracts Regulations 2013', href: 'https://www.legislation.gov.uk/uksi/2013/3134/contents/made' },
    ],
  },
  {
    title: 'Acceptable Use',
    items: [
      'Do not use Online2Day to break the law, infringe rights, send unlawful spam, upload malware, attempt unauthorised access, or interfere with the platform.',
      'Do not upload content that is defamatory, discriminatory, abusive, exploitative, deceptive, or otherwise unlawful.',
      'Do not use video, email, lead, or tracking tools without appropriate consent, notices, and lawful basis.',
    ],
  },
  {
    title: 'Intellectual Property',
    body: [
      'Online2Day and our suppliers own the platform, templates, reusable components, tooling, design systems, documentation, and know-how we had before the project or developed for general reuse.',
      'Unless project documents say otherwise, ownership of bespoke paid deliverables transfers to you when all related fees are paid, excluding our pre-existing materials and third-party materials.',
    ],
  },
  {
    title: 'Availability And Changes',
    body: [
      'We work to keep the website and dashboard available, secure, and useful, but we do not guarantee uninterrupted access. Maintenance, supplier outages, security work, or upgrades may affect availability.',
      'We may improve, replace, or remove features over time. Where a change materially affects a paid service, we will try to give reasonable notice.',
    ],
  },
  {
    title: 'Liability',
    body: [
      'We do not exclude or limit liability for death or personal injury caused by negligence, fraud, fraudulent misrepresentation, or anything else that cannot be excluded by law.',
      'Subject to that, we are not liable for indirect or consequential loss, loss of profit, loss of revenue, loss of goodwill, or loss caused by your content, instructions, third-party services, or unauthorised account use.',
      'For paid services, our aggregate liability is limited to the fees paid for the affected service in the 12 months before the claim unless project documents state a different cap.',
    ],
  },
  {
    title: 'Complaints And Disputes',
    body: [
      'Please use our Complaints Charter if something has gone wrong. We will try to resolve complaints fairly, promptly, and with a named owner.',
      'These terms are governed by the laws of England and Wales. The courts of England and Wales have jurisdiction unless mandatory consumer law gives you a different right.',
    ],
    links: [
      { label: 'Online2Day Complaints Charter', href: '/complaints' },
      { label: 'GOV.UK: ADR reforms 2026', href: 'https://www.gov.uk/government/publications/the-digital-markets-competition-and-consumers-act-2024-alternative-dispute-regulations-2026' },
    ],
  },
]

export default function TermsPage() {
  return (
    <LegalPage
      title="Terms and Conditions"
      description="These terms set out how Online2Day services, dashboards, video tools, and project work may be used."
      lastUpdated="5 May 2026"
      sections={sections}
    />
  )
}
