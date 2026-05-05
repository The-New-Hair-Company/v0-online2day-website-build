import type { Metadata } from 'next'
import { LegalPage, type LegalSection } from '@/components/legal/legal-page'

export const metadata: Metadata = {
  title: 'Privacy Policy | Online2Day',
  description: 'How Online2Day collects, uses, stores, and protects personal data.',
}

const sections: LegalSection[] = [
  {
    title: 'Who We Are',
    body: [
      'Online2Day is a UK-based web development, SaaS, CRM, automation, and video workflow provider. For this policy, "we", "us", and "our" means Online2Day.',
      'You can contact us about privacy at info@online2day.com or by calling +44 333 050 6098.',
    ],
  },
  {
    title: 'Personal Data We Collect',
    items: [
      'Contact details, including name, email address, phone number, company, role, and messages submitted through forms or email.',
      'Account and dashboard data, including authentication records, team preferences, CRM activity, leads, tasks, project records, and support requests.',
      'Video workflow data, including uploaded or recorded videos, thumbnails, transcripts, captions, lead associations, watch activity, and email handoff metadata.',
      'Technical data, including IP address, device, browser, approximate location, pages viewed, referrer, timestamps, and security logs.',
      'Marketing preferences, including consent, opt-out records, campaign engagement, and communication history.',
    ],
  },
  {
    title: 'Why We Use Personal Data',
    table: {
      columns: ['Purpose', 'Examples', 'Lawful basis'],
      rows: [
        ['Provide our services', 'Build websites, operate dashboards, host video pages, manage projects, and respond to enquiries.', 'Contract or steps before entering a contract'],
        ['Run and secure the platform', 'Authentication, audit logs, fraud prevention, backups, diagnostics, and access controls.', 'Legitimate interests and legal obligation where applicable'],
        ['Send service communications', 'Project updates, support replies, transactional emails, and important account notices.', 'Contract and legitimate interests'],
        ['Improve Online2Day', 'Analytics, performance checks, usability improvements, and product planning.', 'Legitimate interests or consent where required'],
        ['Marketing', 'News, offers, and relevant follow-up about Online2Day services.', 'Consent or legitimate interests, subject to PECR rules'],
        ['Comply with law', 'Tax, accounting, disputes, regulatory requests, and data protection rights handling.', 'Legal obligation'],
      ],
    },
  },
  {
    title: 'Video Recording And Lead Data',
    body: [
      'If you use the Online2Day video editor or CRM, video clips may be recorded or uploaded and connected to a lead, email campaign, project, or hosted video page. You are responsible for having a suitable lawful basis and any required consent before adding third-party personal data or recorded media to the platform.',
      'Hosted video pages can record that a page was viewed so the CRM can show engagement. We keep this limited to what is needed for sales, support, analytics, and audit purposes.',
    ],
  },
  {
    title: 'Cookies And Similar Technologies',
    body: [
      'We use essential storage for authentication, security, preferences, and accessibility settings. We may use analytics or marketing storage only where the law allows it and, where required, with consent.',
      'More detail is available in our Cookie Policy.',
    ],
  },
  {
    title: 'Who We Share Data With',
    items: [
      'Hosting, database, storage, analytics, and deployment providers used to operate the website and dashboard.',
      'Email delivery and CRM tooling used to send service emails, campaign emails, and lead workflow messages.',
      'Professional advisers, insurers, payment, accounting, or compliance providers where needed.',
      'Public authorities, regulators, courts, or law enforcement where we are required to do so or need to protect our rights.',
    ],
  },
  {
    title: 'International Transfers',
    body: [
      'Some suppliers may process data outside the UK. Where that happens, we use appropriate safeguards such as adequacy decisions, standard contractual clauses, the UK International Data Transfer Agreement or Addendum, or another lawful transfer mechanism.',
    ],
  },
  {
    title: 'How Long We Keep Data',
    items: [
      'Contact enquiries are usually kept for up to 24 months after the last meaningful interaction unless needed for an active project or dispute.',
      'Project, CRM, video, and account data is kept for the life of the account or contract and then for a reasonable period for audit, security, legal, and accounting purposes.',
      'Marketing records are kept until you unsubscribe or we no longer need evidence of consent, suppression, or prior relationship.',
      'Security logs and analytics are kept only as long as needed for security, diagnostics, and service improvement.',
    ],
  },
  {
    title: 'Your Rights',
    body: [
      'Under UK data protection law you may have rights to be informed, access your data, correct it, erase it, restrict or object to processing, portability, withdraw consent, and challenge certain automated decisions.',
      'To exercise a right, contact info@online2day.com. We may need to verify your identity before acting on a request.',
    ],
  },
  {
    title: 'Complaints',
    body: [
      'Please contact us first so we can try to resolve the issue. You can also complain to the Information Commissioner\'s Office if you are concerned about how your personal data is handled.',
    ],
    links: [
      { label: 'ICO: make a complaint', href: 'https://ico.org.uk/make-a-complaint/' },
      { label: 'GOV.UK data protection rights', href: 'https://www.gov.uk/data-protection/the-data-protection-act' },
    ],
  },
  {
    title: 'UK Law References',
    body: [
      'This policy is written with reference to the UK GDPR, the Data Protection Act 2018, the Privacy and Electronic Communications Regulations, and current ICO guidance. It is not legal advice.',
    ],
    links: [
      { label: 'GOV.UK: data protection and your business', href: 'https://www.gov.uk/data-protection-your-business/overview' },
      { label: 'ICO: right to be informed', href: 'https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/individual-rights/individual-rights/right-to-be-informed/' },
      { label: 'ICO: PECR guide', href: 'https://ico.org.uk/for-organisations/direct-marketing-and-privacy-and-electronic-communications/guide-to-pecr/' },
    ],
  },
]

export default function PrivacyPage() {
  return (
    <LegalPage
      title="Privacy Policy"
      description="This policy explains what personal data Online2Day collects, why we use it, who we share it with, and the rights available to people in the UK."
      lastUpdated="5 May 2026"
      sections={sections}
    />
  )
}
