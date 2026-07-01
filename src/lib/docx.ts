import {
  AlignmentType,
  BorderStyle,
  Document,
  Packer,
  Paragraph,
  TabStopType,
  TextRun,
} from 'docx'
import { saveAs } from 'file-saver'
import type { TailoredResume } from '../types'
import { buildResumeFileName } from './pricing'

const ACCENT = '1E40F5'
const MUTED = '475569'

function sectionHeading(text: string): Paragraph {
  return new Paragraph({
    spacing: { before: 240, after: 80 },
    border: {
      bottom: { color: ACCENT, size: 6, style: BorderStyle.SINGLE, space: 1 },
    },
    children: [
      new TextRun({
        text: text.toUpperCase(),
        bold: true,
        size: 24,
        color: ACCENT,
      }),
    ],
  })
}

function bullet(text: string): Paragraph {
  return new Paragraph({
    bullet: { level: 0 },
    spacing: { after: 40 },
    children: [new TextRun({ text, size: 21 })],
  })
}

function dateRange(start: string, end: string): string {
  const s = start?.trim()
  const e = end?.trim()
  if (s && e) return `${s} – ${e}`
  return s || e || ''
}

export function buildResumeDocument(resume: TailoredResume): Document {
  const { contact } = resume
  const children: Paragraph[] = []

  children.push(
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 20 },
      children: [new TextRun({ text: contact.fullName || 'Your Name', bold: true, size: 40 })],
    }),
  )

  if (contact.title) {
    children.push(
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { after: 60 },
        children: [new TextRun({ text: contact.title, size: 24, color: MUTED })],
      }),
    )
  }

  const contactBits = [contact.email, contact.phone, contact.location, ...(contact.links ?? [])]
    .map((b) => b?.trim())
    .filter(Boolean)
  if (contactBits.length) {
    children.push(
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { after: 120 },
        children: [new TextRun({ text: contactBits.join('  •  '), size: 19, color: MUTED })],
      }),
    )
  }

  if (resume.summary?.trim()) {
    children.push(sectionHeading('Summary'))
    children.push(
      new Paragraph({
        spacing: { after: 60 },
        children: [new TextRun({ text: resume.summary.trim(), size: 21 })],
      }),
    )
  }

  if (resume.skills?.length) {
    children.push(sectionHeading('Skills'))
    for (const group of resume.skills) {
      if (!group.skills?.length) continue
      children.push(
        new Paragraph({
          spacing: { after: 40 },
          children: [
            new TextRun({ text: `${group.category}: `, bold: true, size: 21 }),
            new TextRun({ text: group.skills.join(', '), size: 21 }),
          ],
        }),
      )
    }
  }

  if (resume.experience?.length) {
    children.push(sectionHeading('Experience'))
    for (const job of resume.experience) {
      children.push(
        new Paragraph({
          spacing: { before: 100, after: 0 },
          tabStops: [{ type: TabStopType.RIGHT, position: 9360 }],
          children: [
            new TextRun({ text: job.role || '', bold: true, size: 22 }),
            new TextRun({ text: `\t${dateRange(job.startDate, job.endDate)}`, size: 20, color: MUTED }),
          ],
        }),
      )
      const companyLine = [job.company, job.location].map((s) => s?.trim()).filter(Boolean).join(' — ')
      if (companyLine) {
        children.push(
          new Paragraph({
            spacing: { after: 40 },
            children: [new TextRun({ text: companyLine, italics: true, size: 21, color: MUTED })],
          }),
        )
      }
      for (const b of job.bullets ?? []) {
        if (b?.trim()) children.push(bullet(b.trim()))
      }
    }
  }

  if (resume.projects?.length) {
    children.push(sectionHeading('Projects'))
    for (const proj of resume.projects) {
      if (!proj.name?.trim() && !proj.description?.trim()) continue
      children.push(
        new Paragraph({
          spacing: { before: 60, after: 40 },
          children: [
            new TextRun({ text: `${proj.name}: `, bold: true, size: 21 }),
            new TextRun({ text: proj.description, size: 21 }),
          ],
        }),
      )
    }
  }

  if (resume.education?.length) {
    children.push(sectionHeading('Education'))
    for (const edu of resume.education) {
      children.push(
        new Paragraph({
          spacing: { before: 80, after: 0 },
          tabStops: [{ type: TabStopType.RIGHT, position: 9360 }],
          children: [
            new TextRun({ text: edu.degree || '', bold: true, size: 22 }),
            new TextRun({ text: `\t${dateRange(edu.startDate, edu.endDate)}`, size: 20, color: MUTED }),
          ],
        }),
      )
      const instLine = [edu.institution, edu.location].map((s) => s?.trim()).filter(Boolean).join(' — ')
      if (instLine) {
        children.push(
          new Paragraph({
            spacing: { after: 40 },
            children: [new TextRun({ text: instLine, italics: true, size: 21, color: MUTED })],
          }),
        )
      }
      for (const d of edu.details ?? []) {
        if (d?.trim()) children.push(bullet(d.trim()))
      }
    }
  }

  if (resume.certifications?.length) {
    const certs = resume.certifications.filter((c) => c?.trim())
    if (certs.length) {
      children.push(sectionHeading('Certifications'))
      for (const c of certs) children.push(bullet(c.trim()))
    }
  }

  return new Document({
    creator: 'ResumeTailor',
    title: `${contact.fullName || 'Resume'} – Tailored Resume`,
    styles: {
      default: {
        document: { run: { font: 'Calibri', size: 21 } },
        heading1: { run: { font: 'Calibri' } },
      },
    },
    sections: [
      {
        properties: {
          page: { margin: { top: 720, bottom: 720, left: 900, right: 900 } },
        },
        children,
      },
    ],
  })
}

function safeFileName(jobTitle: string, company: string, userName: string): string {
  return buildResumeFileName(jobTitle, company, userName)
}

export async function downloadResumeDocx(
  resume: TailoredResume,
  jobTitle: string,
  company: string,
): Promise<void> {
  const doc = buildResumeDocument(resume)
  const blob = await Packer.toBlob(doc)
  saveAs(blob, safeFileName(jobTitle, company, resume.contact?.fullName ?? 'User'))
}
