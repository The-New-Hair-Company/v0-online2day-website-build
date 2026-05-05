import type { Metadata } from 'next'
import { LegalPage, type LegalSection } from '@/components/legal/legal-page'

export const metadata: Metadata = {
  title: 'Cookie Policy | Online2Day',
  description: 'How Online2Day uses cookies, local storage, analytics, and similar technologies.',
}

const sections: LegalSection[] = [
  {
    title: 'What This Policy Covers',
    body: [
      'This policy explains how Online2Day uses cookies, local storage, tracking pixels, and similar storage or access technologies on online2day.com, the dashboard, CRM tools, video editor, and hosted video pages.',
      'Cookies and similar technologies can remember preferences, keep accounts secure, measure usage, and help us understand whether a video or email workflow is working.',
    ],
  },
  {
    title: 'Technologies We Use',
    table: {
      columns: ['Category', 'Examples', 'Purpose'],
      rows: [
        ['Essential', 'Authentication, session security, CSRF protection, routing, load balancing, and fraud prevention.', 'Needed for the website, dashboard, and secure account areas to work.'],
        ['Preference', 'Theme, text size, contrast, motion, font, line-height, and dashboard display choices.', 'Remember your chosen experience and accessibility settings.'],
        ['Analytics', 'Page views, device and browser information, referral data, feature usage, and performance events.', 'Understand and improve the site and product.'],
        ['Video and CRM engagement', 'Hosted video page views, campaign links, timestamps, and lead workflow activity.', 'Show engagement in the CRM and help users follow up appropriately.'],
        ['Marketing', 'Campaign attribution or retargeting where enabled.', 'Measure or improve marketing, only where legally allowed and consented to if required.'],
      ],
    },
  },
  {
    title: 'Essential Storage',
    body: [
      'Essential cookies and local storage are used because the site cannot work properly without them. For example, secure dashboards need authentication and the accessibility settings tool needs to remember your preference during your visit.',
    ],
  },
  {
    title: 'Consent',
    body: [
      'Where consent is required, we will ask before setting non-essential cookies or similar technologies. You can withdraw consent by changing your browser settings, clearing site data, or using any cookie controls we make available.',
      'Some browsers provide global privacy controls or block third-party storage. If you block essential storage, parts of the dashboard, login flow, or video editor may not work correctly.',
    ],
  },
  {
    title: 'Third Parties',
    body: [
      'We may use trusted suppliers for hosting, analytics, email delivery, video storage, customer communication, and security. Those suppliers may set or read storage technologies when they provide services to us.',
    ],
  },
  {
    title: 'Managing Cookies',
    items: [
      'Use your browser settings to delete or block cookies and local storage.',
      'Use privacy controls offered by analytics or marketing providers where available.',
      'Contact info@online2day.com if you need help understanding a specific cookie or storage item.',
    ],
  },
  {
    title: 'UK Law References',
    body: [
      'This policy is written with reference to the Privacy and Electronic Communications Regulations, UK GDPR, Data Protection Act 2018, and ICO guidance on storage and access technologies. It is not legal advice.',
    ],
    links: [
      { label: 'ICO: PECR guide', href: 'https://ico.org.uk/for-organisations/direct-marketing-and-privacy-and-electronic-communications/guide-to-pecr/' },
      { label: 'ICO: storage and access technologies guidance update', href: 'https://ico.org.uk/about-the-ico/media-centre/news-and-blogs/2026/04/ico-publishes-final-storage-and-access-technologies-guidance/' },
      { label: 'Online2Day Privacy Policy', href: '/privacy' },
    ],
  },
]

export default function CookiesPage() {
  return (
    <LegalPage
      title="Cookie Policy"
      description="How Online2Day uses cookies, local storage, analytics, and similar technologies."
      lastUpdated="5 May 2026"
      sections={sections}
    />
  )
}
