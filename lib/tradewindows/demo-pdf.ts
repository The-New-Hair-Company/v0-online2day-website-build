import { calculateQuote, createDemoState, flagshipContract, formatCurrency, type QuoteLine } from './demo-data.ts'

export const demoDocumentTypes = ['quotation', 'invoice', 'receipt', 'steel', 'scaffolding', 'third-party', 'framefast', 'contract'] as const
export type DemoDocumentType = (typeof demoDocumentTypes)[number]

function clean(value: string) {
  return value
    .replaceAll('£', '__TW_POUND__')
    .normalize('NFKD')
    .replace(/[^\x20-\x7E]/g, '-')
    .replaceAll('\\', '\\\\')
    .replaceAll('(', '\\(')
    .replaceAll(')', '\\)')
    .replaceAll('__TW_POUND__', '\\243')
}

export type DemoQuotationInput = { lines: QuoteLine[]; discountPercent: number }

function documentCopy(type: DemoDocumentType, quotation?: DemoQuotationInput) {
  const state = createDemoState()
  const quoteInput = quotation || state.quote
  const quote = calculateQuote(quoteInput.lines, quoteInput.discountPercent)
  const common = [
    `Contract: ${flagshipContract.number}`,
    `Customer: ${flagshipContract.customer}`,
    `Property: ${flagshipContract.address}`,
  ]

  if (type === 'quotation') return {
    title: 'Quotation Q-240184',
    subtitle: 'Customer quotation - demonstration copy',
    sections: [
      { heading: 'Project', lines: common },
      { heading: 'Quoted work', lines: quoteInput.lines.map((line) => `${line.quantity} x ${line.description} - ${formatCurrency(line.quantity * line.unitPricePence)}`) },
      { heading: 'Summary', lines: [`Subtotal: ${formatCurrency(quote.subtotalPence)}`, `Discount (${quoteInput.discountPercent}%): -${formatCurrency(quote.discountPence)}`, `VAT (20%): ${formatCurrency(quote.vatPence)}`, `Total: ${formatCurrency(quote.totalPence)}`] },
    ],
  }
  if (type === 'invoice' || type === 'receipt') return {
    title: type === 'receipt' ? 'Receipt RCPT-240184' : 'Invoice INV-240184-2',
    subtitle: `${type === 'receipt' ? 'Payment receipt' : 'Balance invoice'} - demonstration copy`,
    sections: [
      { heading: 'Account', lines: common },
      { heading: 'Payment summary', lines: [`Contract value: ${formatCurrency(state.invoice.totalPence)}`, `Paid to date: ${formatCurrency(state.invoice.paidPence)}`, `Outstanding: ${formatCurrency(state.invoice.totalPence - state.invoice.paidPence)}`, `Status: ${state.invoice.status}`] },
      { heading: 'Payment security', lines: ['Production payments use Stripe-hosted checkout.', 'Trade Windows does not collect raw card details in this application.'] },
    ],
  }
  if (type === 'framefast') return {
    title: 'FrameFast Order FF-240184',
    subtitle: 'Manufacturing order preview - not submitted',
    sections: [
      { heading: 'Contract', lines: common },
      { heading: 'Measured units', lines: state.survey.units.map((unit, index) => `${index + 1}. ${unit.room} - ${unit.type} - ${unit.width} mm x ${unit.height} mm`) },
      { heading: 'Release checks', lines: ['Survey sign-off required before release.', 'Colour, glass and hardware mappings require administrator approval.', 'External status: NOT SUBMITTED'] },
    ],
  }
  if (type === 'steel') return {
    title: 'Steel Requirement ST-240184',
    subtitle: 'Approved-supplier request preview - not sent',
    sections: [
      { heading: 'Contract', lines: common },
      { heading: 'Requirement', lines: ['Provide support above the living-room opening.', 'Final dimensions remain subject to structural review.', 'Quantity: 1 structural opening'] },
      { heading: 'Approved recipient', lines: ['Derby Steel Services - configured demonstration supplier', 'External status: NOT SENT'] },
    ],
  }
  if (type === 'scaffolding') return {
    title: 'Scaffolding Order SC-240184',
    subtitle: 'Access order preview - not sent',
    sections: [
      { heading: 'Contract', lines: common },
      { heading: 'Access requirement', lines: ['Front elevation access for window installation.', 'Keep the customer driveway clear.', 'Proposed fitting date: 28 September 2026'] },
      { heading: 'Approved recipient', lines: ['Midlands Access Ltd - configured demonstration supplier', 'External status: NOT SENT'] },
    ],
  }
  return {
    title: type === 'third-party' ? 'Third-party Contract Document' : 'Contract Summary 240184',
    subtitle: 'Trade Windows operations platform - demonstration copy',
    sections: [
      { heading: 'Contract', lines: common },
      { heading: 'Current position', lines: [`Stage: ${state.survey.complete ? 'Survey complete' : 'Survey scheduled'}`, `Products: ${flagshipContract.products.reduce((total, product) => total + product.quantity, 0)} units`, `Customer files: ${state.customerFiles.length}`, `Amendment status: ${state.amendment.status}`] },
      { heading: 'Important', lines: ['This document contains fictional demonstration information.', 'No external email, order or payment has been created.'] },
    ],
  }
}

function contentStream(type: DemoDocumentType, quotation?: DemoQuotationInput) {
  const copy = documentCopy(type, quotation)
  const commands: string[] = [
    '0.79 0.18 0.14 rg 0 794 595 48 re f',
    '0.17 0.18 0.20 rg 0 0 595 42 re f',
    'BT /F1 10 Tf 0.17 0.18 0.20 rg 48 760 Td (TRADE WINDOWS - DERBY) Tj ET',
    'BT /F1 8 Tf 0.40 0.43 0.45 rg 48 746 Td (01332 755551  |  tradewindows.com) Tj ET',
    `BT /F1 23 Tf 0.12 0.14 0.15 rg 48 718 Td (${clean(copy.title)}) Tj ET`,
    `BT /F1 10 Tf 0.40 0.43 0.45 rg 48 698 Td (${clean(copy.subtitle)}) Tj ET`,
    '0.85 0.85 0.83 RG 48 680 m 547 680 l S',
  ]
  let y = 646
  for (const section of copy.sections) {
    commands.push(`BT /F1 9 Tf 0.79 0.18 0.14 rg 48 ${y} Td (${clean(section.heading.toUpperCase())}) Tj ET`)
    y -= 24
    for (const line of section.lines) {
      commands.push(`BT /F1 11 Tf 0.14 0.16 0.17 rg 48 ${y} Td (${clean(line)}) Tj ET`)
      y -= 19
    }
    y -= 18
  }
  commands.push('BT /F1 8 Tf 1 1 1 rg 48 16 Td (Fictional demonstration - generated 09 September 2026 - Page 1 of 1) Tj ET')
  return commands.join('\n')
}

export function createDemoPdf(type: DemoDocumentType, quotation?: DemoQuotationInput) {
  const stream = contentStream(type, quotation)
  const objects = [
    '',
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [4 0 R] /Count 1 >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 3 0 R >> >> /Contents 5 0 R >>',
    `<< /Length ${Buffer.byteLength(stream, 'ascii')} >>\nstream\n${stream}\nendstream`,
  ]
  let output = '%PDF-1.4\n%TWOP\n'
  const offsets = [0]
  for (let index = 1; index < objects.length; index += 1) {
    offsets[index] = Buffer.byteLength(output, 'ascii')
    output += `${index} 0 obj\n${objects[index]}\nendobj\n`
  }
  const xref = Buffer.byteLength(output, 'ascii')
  output += `xref\n0 ${objects.length}\n0000000000 65535 f \n`
  for (let index = 1; index < objects.length; index += 1) output += `${String(offsets[index]).padStart(10, '0')} 00000 n \n`
  output += `trailer\n<< /Size ${objects.length} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`
  return Buffer.from(output, 'ascii')
}
