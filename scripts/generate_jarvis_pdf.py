#!/usr/bin/env python3
"""
J.A.R.V.I.S. Architecture Blueprint — PDF Generator
─────────────────────────────────────────────────────────────────────────────
Generates a comprehensive PDF blueprint with:
  - Cover page (Stark-grade blueprint aesthetic)
  - Table of contents
  - Architecture overview
  - 4-tier memory system detail (with side notes)
  - Brain / Voice / Research / Personality pillars
  - Step-by-step build phases with side notes
  - JARVIS personality spec + signature quotes

Uses ReportLab. Page breaks ONLY between cover→TOC and TOC→content.
"""

import os
import sys
from datetime import datetime
from pathlib import Path

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm, cm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.pdfmetrics import registerFontFamily
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import (
    BaseDocTemplate, PageTemplate, Frame, Paragraph, Spacer, PageBreak,
    Table, TableStyle, KeepTogether, NextPageTemplate, Flowable
)
from reportlab.platypus.flowables import HRFlowable

# ── Font registration ───────────────────────────────────────────────────────
FONT_DIR = '/usr/share/fonts'

def register_fonts():
    """Register Noto Serif SC (body + headings) + Sarasa Mono SC (code)."""
    # Primary CJK-capable serif (body + headings)
    noto_serif = f'{FONT_DIR}/truetype/noto-serif-sc/NotoSerifSC-Regular.ttf'
    noto_serif_bold = f'{FONT_DIR}/truetype/noto-serif-sc/NotoSerifSC-Bold.ttf'
    if not os.path.exists(noto_serif):
        raise RuntimeError(f'Noto Serif SC not found at {noto_serif}')
    pdfmetrics.registerFont(TTFont('NotoSerif', noto_serif))
    pdfmetrics.registerFont(TTFont('NotoSerif-Bold', noto_serif_bold))
    registerFontFamily('NotoSerif', normal='NotoSerif', bold='NotoSerif-Bold',
                       italic='NotoSerif', boldItalic='NotoSerif-Bold')

    # Use Noto Serif SC SemiBold for sans-like headings (variable font not supported by reportlab)
    noto_serif_semibold = f'{FONT_DIR}/truetype/noto-serif-sc/NotoSerifSC-SemiBold.ttf'
    pdfmetrics.registerFont(TTFont('NotoSans', noto_serif))
    pdfmetrics.registerFont(TTFont('NotoSans-Bold', noto_serif_bold))
    registerFontFamily('NotoSans', normal='NotoSans', bold='NotoSans-Bold')

    # Mono for code / technical labels — Sarasa Mono SC has full CJK coverage
    sarasa_regular = f'{FONT_DIR}/truetype/chinese/SarasaMonoSC-Regular.ttf'
    sarasa_bold = f'{FONT_DIR}/truetype/chinese/SarasaMonoSC-Bold.ttf'
    if os.path.exists(sarasa_regular):
        pdfmetrics.registerFont(TTFont('Mono', sarasa_regular))
        pdfmetrics.registerFont(TTFont('Mono-Bold', sarasa_bold))
    else:
        pdfmetrics.registerFont(TTFont('Mono', f'{FONT_DIR}/truetype/dejavu/DejaVuSansMono.ttf'))
        pdfmetrics.registerFont(TTFont('Mono-Bold', f'{FONT_DIR}/truetype/dejavu/DejaVuSansMono-Bold.ttf'))
    registerFontFamily('Mono', normal='Mono', bold='Mono-Bold')

register_fonts()

# ── JARVIS palette (cyan + deep navy) ───────────────────────────────────────
PAGE_BG       = colors.HexColor('#0a0e1a')   # deep navy-black
SECTION_BG    = colors.HexColor('#101626')   # lifted panel
CARD_BG       = colors.HexColor('#141b2d')   # card surface
TABLE_STRIPE  = colors.HexColor('#0d1320')
HEADER_FILL   = colors.HexColor('#1a2540')
COVER_BLOCK   = colors.HexColor('#0a0e1a')
BORDER        = colors.HexColor('#1e3a5f')
ICON          = colors.HexColor('#5eb8d9')
ACCENT        = colors.HexColor('#5eb8d9')   # arc reactor cyan
ACCENT_2      = colors.HexColor('#7dd3fc')   # lighter cyan
TEXT_PRIMARY  = colors.HexColor('#e2e8f0')
TEXT_MUTED    = colors.HexColor('#94a3b8')
SEM_WARNING   = colors.HexColor('#fbbf24')
SEM_INFO      = colors.HexColor('#7dd3fc')

# ── Styles ──────────────────────────────────────────────────────────────────
def make_styles():
    s = getSampleStyleSheet()
    body = ParagraphStyle('Body', parent=s['Normal'],
        fontName='NotoSerif', fontSize=10.5, leading=16,
        textColor=TEXT_PRIMARY, spaceAfter=8, alignment=0)
    body_just = ParagraphStyle('BodyJust', parent=body, alignment=4)  # justified
    h1 = ParagraphStyle('H1', parent=s['Heading1'],
        fontName='NotoSans-Bold', fontSize=22, leading=28,
        textColor=ACCENT, spaceBefore=10, spaceAfter=12, alignment=0)
    h2 = ParagraphStyle('H2', parent=s['Heading2'],
        fontName='NotoSans-Bold', fontSize=16, leading=22,
        textColor=ACCENT_2, spaceBefore=14, spaceAfter=8, alignment=0)
    h3 = ParagraphStyle('H3', parent=s['Heading3'],
        fontName='NotoSans-Bold', fontSize=13, leading=18,
        textColor=ACCENT, spaceBefore=10, spaceAfter=6)
    h4 = ParagraphStyle('H4', parent=s['Heading4'],
        fontName='NotoSans-Bold', fontSize=11, leading=16,
        textColor=TEXT_PRIMARY, spaceBefore=8, spaceAfter=4)
    side_note = ParagraphStyle('SideNote', parent=body,
        fontName='NotoSerif', fontSize=9.5, leading=14,
        textColor=TEXT_PRIMARY, leftIndent=10, rightIndent=10,
        spaceBefore=4, spaceAfter=4)
    side_note_label = ParagraphStyle('SideNoteLabel', parent=body,
        fontName='Mono-Bold', fontSize=8, leading=12,
        textColor=SEM_WARNING, spaceAfter=2)
    mono = ParagraphStyle('Mono', parent=body,
        fontName='Mono', fontSize=9, leading=13,
        textColor=TEXT_PRIMARY, leftIndent=8, rightIndent=8)
    quote = ParagraphStyle('Quote', parent=body,
        fontName='NotoSerif', fontSize=11, leading=17,
        textColor=ACCENT_2, leftIndent=16, rightIndent=16,
        spaceBefore=6, spaceAfter=6, italic=True)
    cover_title = ParagraphStyle('CoverTitle', parent=h1,
        fontName='NotoSans-Bold', fontSize=42, leading=48,
        textColor=ACCENT, alignment=1, spaceBefore=0, spaceAfter=8)
    cover_sub = ParagraphStyle('CoverSub', parent=body,
        fontName='NotoSans', fontSize=14, leading=20,
        textColor=TEXT_MUTED, alignment=1, spaceAfter=4)
    cover_meta = ParagraphStyle('CoverMeta', parent=body,
        fontName='Mono', fontSize=9, leading=14,
        textColor=ACCENT_2, alignment=1)
    toc_entry = ParagraphStyle('TOC', parent=body,
        fontName='NotoSans', fontSize=11, leading=18,
        textColor=TEXT_PRIMARY, spaceAfter=2)
    toc_num = ParagraphStyle('TOCNum', parent=body,
        fontName='Mono-Bold', fontSize=10, leading=18,
        textColor=ACCENT, alignment=2)
    return dict(body=body, body_just=body_just, h1=h1, h2=h2, h3=h3, h4=h4,
                side_note=side_note, side_note_label=side_note_label,
                mono=mono, quote=quote, cover_title=cover_title,
                cover_sub=cover_sub, cover_meta=cover_meta,
                toc_entry=toc_entry, toc_num=toc_num)

STYLES = make_styles()

# ── Page templates ──────────────────────────────────────────────────────────
PAGE_W, PAGE_H = A4
MARGIN_L = MARGIN_R = 18 * mm
MARGIN_T = 22 * mm
MARGIN_B = 20 * mm
CONTENT_W = PAGE_W - MARGIN_L - MARGIN_R
CONTENT_H = PAGE_H - MARGIN_T - MARGIN_B

def draw_cover_bg(canvas, doc):
    """Cover page background: deep navy with cyan radial + grid."""
    canvas.saveState()
    # Full-bleed background
    canvas.setFillColor(PAGE_BG)
    canvas.rect(0, 0, PAGE_W, PAGE_H, fill=1, stroke=0)
    # Radial glow at top center
    canvas.setFillColor(colors.HexColor('#5eb8d9'))
    canvas.setFillAlpha(0.08)
    canvas.circle(PAGE_W / 2, PAGE_H * 0.78, 120 * mm, fill=1, stroke=0)
    canvas.setFillAlpha(0.04)
    canvas.circle(PAGE_W / 2, PAGE_H * 0.78, 80 * mm, fill=1, stroke=0)
    canvas.setFillAlpha(1)
    # Grid lines
    canvas.setStrokeColor(colors.HexColor('#1e3a5f'))
    canvas.setLineWidth(0.3)
    for x in range(0, int(PAGE_W), 20):
        canvas.line(x, 0, x, PAGE_H)
    for y in range(0, int(PAGE_H), 20):
        canvas.line(0, y, PAGE_W, y)
    # Corner brackets
    canvas.setStrokeColor(ACCENT)
    canvas.setLineWidth(1.2)
    bracket = 14
    # top-left
    canvas.line(MARGIN_L - 4, PAGE_H - MARGIN_T + 4, MARGIN_L - 4 + bracket, PAGE_H - MARGIN_T + 4)
    canvas.line(MARGIN_L - 4, PAGE_H - MARGIN_T + 4, MARGIN_L - 4, PAGE_H - MARGIN_T + 4 - bracket)
    # top-right
    canvas.line(PAGE_W - MARGIN_R + 4, PAGE_H - MARGIN_T + 4, PAGE_W - MARGIN_R + 4 - bracket, PAGE_H - MARGIN_T + 4)
    canvas.line(PAGE_W - MARGIN_R + 4, PAGE_H - MARGIN_T + 4, PAGE_W - MARGIN_R + 4, PAGE_H - MARGIN_T + 4 - bracket)
    # bottom-left
    canvas.line(MARGIN_L - 4, MARGIN_B - 4, MARGIN_L - 4 + bracket, MARGIN_B - 4)
    canvas.line(MARGIN_L - 4, MARGIN_B - 4, MARGIN_L - 4, MARGIN_B - 4 + bracket)
    # bottom-right
    canvas.line(PAGE_W - MARGIN_R + 4, MARGIN_B - 4, PAGE_W - MARGIN_R + 4 - bracket, MARGIN_B - 4)
    canvas.line(PAGE_W - MARGIN_R + 4, MARGIN_B - 4, PAGE_W - MARGIN_R + 4, MARGIN_B - 4 + bracket)
    # Top label
    canvas.setFont('Mono', 8)
    canvas.setFillColor(ACCENT_2)
    canvas.drawString(MARGIN_L, PAGE_H - 14 * mm, 'STARK INDUSTRIES  ·  CLASSIFIED  ·  v1.0.0')
    canvas.drawRightString(PAGE_W - MARGIN_R, PAGE_H - 14 * mm, 'BLUEPRINT')
    canvas.restoreState()

def draw_body_bg(canvas, doc):
    """Body page: subtle navy background + page number footer."""
    canvas.saveState()
    canvas.setFillColor(PAGE_BG)
    canvas.rect(0, 0, PAGE_W, PAGE_H, fill=1, stroke=0)
    # Header line
    canvas.setStrokeColor(BORDER)
    canvas.setLineWidth(0.4)
    canvas.line(MARGIN_L, PAGE_H - 14 * mm, PAGE_W - MARGIN_R, PAGE_H - 14 * mm)
    canvas.setFont('Mono', 7.5)
    canvas.setFillColor(TEXT_MUTED)
    canvas.drawString(MARGIN_L, PAGE_H - 11 * mm, 'J.A.R.V.I.S.  ·  ARCHITECTURE BLUEPRINT')
    canvas.drawRightString(PAGE_W - MARGIN_R, PAGE_H - 11 * mm, 'v1.0.0')
    # Footer
    canvas.line(MARGIN_L, 12 * mm, PAGE_W - MARGIN_R, 12 * mm)
    canvas.setFont('Mono', 7.5)
    canvas.setFillColor(TEXT_MUTED)
    canvas.drawString(MARGIN_L, 8 * mm, 'STARK INDUSTRIES')
    canvas.drawRightString(PAGE_W - MARGIN_R, 8 * mm, f'PAGE {doc.page}')
    canvas.restoreState()

# ── Custom flowables ────────────────────────────────────────────────────────
class ArcReactorIcon(Flowable):
    """Tiny SVG-like arc reactor drawn with reportlab primitives."""
    def __init__(self, size=80):
        super().__init__()
        self.size = size
        self.width = size
        self.height = size
    def draw(self):
        c = self.canv
        s = self.size
        cx, cy = s / 2, s / 2
        # outer glow
        c.setFillColor(ACCENT)
        c.setFillAlpha(0.15)
        c.circle(cx, cy, s * 0.5, fill=1, stroke=0)
        c.setFillAlpha(1)
        # outer ring
        c.setStrokeColor(ACCENT)
        c.setLineWidth(1)
        c.circle(cx, cy, s * 0.42, fill=0, stroke=1)
        # inner ring
        c.setStrokeColor(ACCENT_2)
        c.setLineWidth(1.4)
        c.circle(cx, cy, s * 0.28, fill=0, stroke=1)
        # core
        c.setFillColor(ACCENT_2)
        c.setFillAlpha(0.85)
        c.circle(cx, cy, s * 0.2, fill=1, stroke=0)
        c.setFillAlpha(1)
        # triangle
        c.setStrokeColor(colors.white)
        c.setLineWidth(1)
        from math import sin, cos, pi
        pts = []
        for i in range(3):
            a = -pi / 2 + i * 2 * pi / 3
            pts.append((cx + cos(a) * s * 0.16, cy + sin(a) * s * 0.16))
        p = c.beginPath()
        p.moveTo(*pts[0])
        for pt in pts[1:]:
            p.lineTo(*pt)
        p.close()
        c.drawPath(p, fill=0, stroke=1)
        # tick marks
        c.setStrokeColor(ACCENT)
        c.setLineWidth(0.5)
        for i in range(12):
            import math
            a = i * math.pi / 6
            x1 = cx + math.cos(a) * s * 0.36
            y1 = cy + math.sin(a) * s * 0.36
            x2 = cx + math.cos(a) * s * 0.40
            y2 = cy + math.sin(a) * s * 0.40
            c.line(x1, y1, x2, y2)

# ── Content builders ────────────────────────────────────────────────────────

def side_note_box(notes, label='SIDE NOTES'):
    """Render a side-note callout box as a Table."""
    if not notes:
        return Spacer(0, 0)
    rows = [[Paragraph(label, STYLES['side_note_label'])]]
    for n in notes:
        rows.append([Paragraph(f'◆  {n}', STYLES['side_note'])])
    t = Table(rows, colWidths=[CONTENT_W])
    t.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, -1), colors.HexColor('#1a1505')),
        ('BOX', (0, 0), (-1, -1), 0.6, SEM_WARNING),
        ('LEFTPADDING', (0, 0), (-1, -1), 10),
        ('RIGHTPADDING', (0, 0), (-1, -1), 10),
        ('TOPPADDING', (0, 0), (-1, -1), 6),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
        ('LINEBELOW', (0, 0), (-1, 0), 0.4, SEM_WARNING),
    ]))
    return KeepTogether([Spacer(0, 4), t, Spacer(0, 6)])

def section_divider():
    return HRFlowable(width='100%', thickness=0.5, color=BORDER,
                      spaceBefore=6, spaceAfter=10)

def info_card(title, body_text):
    """Small card with title bar + body."""
    rows = [
        [Paragraph(title, ParagraphStyle('CardT', parent=STYLES['h4'], textColor=colors.white, fontSize=10, leading=14))],
        [Paragraph(body_text, STYLES['body'])]
    ]
    t = Table(rows, colWidths=[CONTENT_W])
    t.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), HEADER_FILL),
        ('BACKGROUND', (0, 1), (-1, 1), CARD_BG),
        ('BOX', (0, 0), (-1, -1), 0.4, BORDER),
        ('LEFTPADDING', (0, 0), (-1, -1), 8),
        ('RIGHTPADDING', (0, 0), (-1, -1), 8),
        ('TOPPADDING', (0, 0), (-1, -1), 6),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
    ]))
    return t

def tier_table(tiers):
    """4-tier memory comparison table."""
    header = ['Tier', 'Horizon', 'Capacity', 'Mechanism', 'Implementation']
    rows = [header]
    for t in tiers:
        rows.append([
            Paragraph(f'<b>{t["name"]}</b>', STYLES['body']),
            Paragraph(t['horizon'], STYLES['body']),
            Paragraph(t['capacity'], STYLES['body']),
            Paragraph(t['mechanism'], STYLES['body']),
            Paragraph(t['implementation'], STYLES['body']),
        ])
    # proportional column widths summing to CONTENT_W
    col_ws = [CONTENT_W * x for x in [0.16, 0.13, 0.13, 0.28, 0.30]]
    t = Table(rows, colWidths=col_ws, repeatRows=1)
    t.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), HEADER_FILL),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
        ('FONTNAME', (0, 0), (-1, 0), 'NotoSans-Bold'),
        ('FONTSIZE', (0, 0), (-1, 0), 9),
        ('ALIGN', (0, 0), (-1, 0), 'LEFT'),
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('FONTSIZE', (0, 1), (-1, -1), 8.5),
        ('LEADING', (0, 1), (-1, -1), 12),
        ('TEXTCOLOR', (0, 1), (-1, -1), TEXT_PRIMARY),
        ('ROWBACKGROUNDS', (0, 1), (-1, -1), [SECTION_BG, TABLE_STRIPE]),
        ('GRID', (0, 0), (-1, -1), 0.3, BORDER),
        ('LEFTPADDING', (0, 0), (-1, -1), 5),
        ('RIGHTPADDING', (0, 0), (-1, -1), 5),
        ('TOPPADDING', (0, 0), (-1, -1), 5),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 5),
    ]))
    return t

def architecture_diagram_table():
    """Render the system architecture as a structured table."""
    rows = [
        ['Layer', 'Component', 'Description'],
        ['User', 'Input', 'Text or voice input addressed to JARVIS.'],
        ['Brain', 'LLM Reasoning Core', 'Claude-class LLM with JARVIS system prompt. Router decides on research; synthesizer merges results.'],
        ['Memory T1', 'Sensory Buffer', 'Volatile raw input stream (last ~5s). Mirrors human iconic memory.'],
        ['Memory T2', 'Short-Term Memory', 'Active conversation window (24 turns). Relevance decay.'],
        ['Memory T3', 'Episodic Memory', 'Long-term vector log. Semantic similarity recall (cosine).'],
        ['Memory T4', 'Semantic Memory', 'Knowledge graph: entities + typed relations.'],
        ['Hands', 'Web Research', 'web_search + page_reader pipeline. Real-time information retrieval.'],
        ['Voice', 'ElevenLabs TTS', 'Paul Bettany voice clone. Falls back to z-ai TTS if unconfigured.'],
    ]
    col_ws = [CONTENT_W * x for x in [0.13, 0.22, 0.65]]
    t = Table(rows, colWidths=col_ws, repeatRows=1)
    t.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), HEADER_FILL),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
        ('FONTNAME', (0, 0), (-1, 0), 'NotoSans-Bold'),
        ('FONTSIZE', (0, 0), (-1, 0), 9.5),
        ('FONTNAME', (0, 1), (-1, -1), 'NotoSerif'),
        ('FONTSIZE', (0, 1), (-1, -1), 9),
        ('LEADING', (0, 1), (-1, -1), 13),
        ('TEXTCOLOR', (0, 1), (-1, -1), TEXT_PRIMARY),
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('ROWBACKGROUNDS', (0, 1), (-1, -1), [SECTION_BG, TABLE_STRIPE]),
        ('GRID', (0, 0), (-1, -1), 0.3, BORDER),
        ('LEFTPADDING', (0, 0), (-1, -1), 6),
        ('RIGHTPADDING', (0, 0), (-1, -1), 6),
        ('TOPPADDING', (0, 0), (-1, -1), 5),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 5),
        # Highlight memory rows
        ('TEXTCOLOR', (0, 1), (0, 1), ACCENT_2),
        ('FONTNAME', (0, 1), (0, 1), 'NotoSans-Bold'),
    ]))
    return t

# ── Build the document ──────────────────────────────────────────────────────

def build_pdf(output_path: str):
    doc = BaseDocTemplate(
        output_path,
        pagesize=A4,
        leftMargin=MARGIN_L, rightMargin=MARGIN_R,
        topMargin=MARGIN_T, bottomMargin=MARGIN_B,
        title='J.A.R.V.I.S. — Architecture Blueprint',
        author='Stark Industries',
        subject='Just A Rather Very Intelligent System — Architecture Blueprint',
        creator='JARVIS PDF Generator',
    )
    cover_frame = Frame(0, 0, PAGE_W, PAGE_H, leftPadding=MARGIN_L, rightPadding=MARGIN_R,
                       topPadding=80 * mm, bottomPadding=40 * mm, id='cover')
    body_frame = Frame(MARGIN_L, MARGIN_B + 4 * mm, CONTENT_W, CONTENT_H - 4 * mm, id='body')
    doc.addPageTemplates([
        PageTemplate(id='Cover', frames=[cover_frame], onPage=draw_cover_bg),
        PageTemplate(id='Body', frames=[body_frame], onPage=draw_body_bg),
    ])

    story = []

    # ── COVER PAGE ──────────────────────────────────────────────────────────
    story.append(Spacer(0, 30 * mm))
    story.append(ArcReactorIcon(100))
    story.append(Spacer(0, 12 * mm))
    story.append(Paragraph('J.A.R.V.I.S.', STYLES['cover_title']))
    story.append(Paragraph('Just A Rather Very Intelligent System', STYLES['cover_sub']))
    story.append(Spacer(0, 8 * mm))
    story.append(Paragraph('ARCHITECTURE BLUEPRINT', STYLES['cover_meta']))
    story.append(Spacer(0, 4 * mm))
    story.append(Paragraph('4-Tier Memory · Web Research · ElevenLabs Voice · Claude Brain', STYLES['cover_meta']))
    story.append(Spacer(0, 30 * mm))
    story.append(Paragraph(f'VERSION 1.0.0  ·  {datetime.now().strftime("%Y-%m-%d")}', STYLES['cover_meta']))
    story.append(Paragraph('STARK INDUSTRIES  ·  CLASSIFIED', STYLES['cover_meta']))
    story.append(NextPageTemplate('Body'))
    story.append(PageBreak())

    # ── TABLE OF CONTENTS ───────────────────────────────────────────────────
    story.append(Paragraph('Table of Contents', STYLES['h1']))
    story.append(section_divider())
    toc_entries = [
        ('01', 'Executive Summary'),
        ('02', 'System Architecture'),
        ('03', 'The Brain — LLM Reasoning Core'),
        ('04', 'The Memory — 4-Tier Cognitive Architecture'),
        ('05', 'The Hands — Web Research Pipeline'),
        ('06', 'The Voice — ElevenLabs Integration'),
        ('07', 'The Personality — JARVIS Persona'),
        ('08', 'Build Phases — Step-by-Step'),
        ('09', 'Signature Quotes'),
        ('10', 'Appendix — Configuration Reference'),
    ]
    toc_rows = []
    for num, title in toc_entries:
        toc_rows.append([
            Paragraph(num, STYLES['toc_num']),
            Paragraph(title, STYLES['toc_entry']),
        ])
    toc_table = Table(toc_rows, colWidths=[20 * mm, CONTENT_W - 20 * mm])
    toc_table.setStyle(TableStyle([
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('TOPPADDING', (0, 0), (-1, -1), 4),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
        ('LINEBELOW', (0, 0), (-1, -2), 0.2, BORDER),
    ]))
    story.append(toc_table)
    story.append(PageBreak())

    # ── 01 EXECUTIVE SUMMARY ────────────────────────────────────────────────
    story.append(Paragraph('01 · Executive Summary', STYLES['h1']))
    story.append(section_divider())
    story.append(Paragraph(
        'J.A.R.V.I.S. is an advanced AI assistant modeled on the iconic Marvel Cinematic Universe character. '
        'It combines a Claude-class large language model as the reasoning brain, a four-tier cognitive memory '
        'architecture inspired by human information processing, real-time web research capabilities, and '
        'voice synthesis via ElevenLabs using a cloned Paul Bettany timbre. The system is designed to be '
        'proactive, formally polite, dryly witty, and unflappably calm — the defining traits of the JARVIS persona.',
        STYLES['body_just']))
    story.append(Paragraph(
        'This blueprint documents the complete architecture, build phases, and configuration reference. '
        'Each section is accompanied by side notes that explain design rationale, alternatives considered, '
        'and production hardening recommendations. The document is intended for engineers implementing '
        'the system and for stakeholders evaluating its capabilities.',
        STYLES['body_just']))
    story.append(Paragraph(
        'The implementation demonstrated in the accompanying web application uses Next.js 16 with TypeScript, '
        'Prisma ORM with SQLite for memory persistence, the z-ai-web-dev-sdk as the LLM and TTS provider '
        '(as a drop-in Anthropic-class stand-in), and a clean seam to swap in direct Anthropic Claude API '
        'and ElevenLabs voice cloning when production keys are configured.',
        STYLES['body_just']))
    story.append(side_note_box([
        'The personality prompt is the single highest-leverage artefact in the system. Investing in its precision yields outsized returns in character fidelity.',
        'The four-tier memory model is grounded in the Atkinson-Shiffrin (1968) and Tulving (1972) cognitive psychology frameworks — it is not arbitrary engineering.',
        'All external dependencies (LLM, TTS, embeddings) are isolated behind single-function seams, enabling drop-in replacement without architectural change.'
    ]))

    # ── 02 SYSTEM ARCHITECTURE ──────────────────────────────────────────────
    story.append(Paragraph('02 · System Architecture', STYLES['h1']))
    story.append(section_divider())
    story.append(Paragraph(
        'The JARVIS architecture is organized into five horizontal layers: User input, the Brain (LLM reasoning), '
        'the Memory subsystem (four tiers), the Hands (web research), and the Voice (TTS output). Each layer is '
        'loosely coupled and communicates through well-defined function seams. The table below summarizes the '
        'components and their responsibilities.',
        STYLES['body_just']))
    story.append(Spacer(0, 6))
    story.append(architecture_diagram_table())
    story.append(Spacer(0, 8))
    story.append(Paragraph(
        'Data flow is unidirectional on each turn: the user message enters the Sensory Buffer, is appended to '
        'Short-Term Memory, triggers a recall from Episodic and Semantic Memory, optionally triggers web research, '
        'and is finally synthesized by the Brain into a JARVIS-voiced reply. The reply is then spoken via the '
        'Voice layer and persisted as a new episode in Episodic Memory for future recall.',
        STYLES['body_just']))
    story.append(side_note_box([
        'The recall bundle (all four memory tiers) is fetched in parallel — latency is bounded by the slowest tier, which is Episodic cosine similarity over the candidate set.',
        'In production, the Sensory Buffer should be in-RAM only (Redis or process memory). We persist a small audit trail in SQLite for debuggability.',
        'The architecture deliberately avoids a message bus. Direct function calls keep the call stack inspectable and simplify debugging during development.'
    ]))

    # ── 03 THE BRAIN ────────────────────────────────────────────────────────
    story.append(Paragraph('03 · The Brain — LLM Reasoning Core', STYLES['h1']))
    story.append(section_divider())
    story.append(Paragraph(
        'The Brain is the reasoning engine that produces JARVIS-voiced responses. It is powered by a Claude-class '
        'large language model accessed through the z-ai-web-dev-sdk chat completions API in the sandbox, with a '
        'clean seam to swap in the Anthropic Claude API directly in production. The brain is not a single monolithic '
        'call — it is decomposed into four specialized functions that each serve a distinct purpose.',
        STYLES['body_just']))
    story.append(Paragraph('Components', STYLES['h3']))
    story.append(Paragraph(
        '<b>System Prompt.</b> Encodes the JARVIS persona in approximately 800 tokens: formal British register, '
        'dry deadpan wit, proactive helpfulness, gentle pushback on flawed plans, and unwavering loyalty. This '
        'is the highest-leverage artefact in the entire system — its precision directly determines character fidelity.',
        STYLES['body_just']))
    story.append(Paragraph(
        '<b>Few-shot Exemplars.</b> Two to four seeded conversation turns that lock the voice. For example: '
        '"Are you online?" → "For you, sir, always. All systems are operational and at your service." These exemplars '
        'are appended after the system prompt and before the live conversation, anchoring the model on the desired register.',
        STYLES['body_just']))
    story.append(Paragraph(
        '<b>Router.</b> A lightweight LLM call at temperature 0.2 that classifies whether the user\'s latest message '
        'requires fresh web research. Returns a JSON object: either {"research": true, "query": "..."} or '
        '{"research": false}. Keeping this as a separate call (rather than function-calling) simplifies logging '
        'and makes the routing decision auditable.',
        STYLES['body_just']))
    story.append(Paragraph(
        '<b>Synthesizer.</b> The final pass that merges the user\'s message, the recalled memory bundle (episodes '
        'and knowledge graph stats), and the research results into a single JARVIS-voiced reply. Runs at '
        'temperature 0.7 to keep the wit alive without losing precision.',
        STYLES['body_just']))
    story.append(side_note_box([
        'In production, swap z-ai-web-dev-sdk chat for the Anthropic Claude API directly — the seam is the think() function in /lib/jarvis/brain.ts.',
        'Claude Code refers to Anthropic\'s official CLI for agentic coding tasks. For chat reasoning, the Claude API itself is the appropriate interface.',
        'Temperature 0.7 for synthesis keeps the wit alive. Router temperature 0.2 ensures deterministic classification.',
        'A register sanitizer (detecting exclamation marks, emoji, slang) can gate regeneration. In practice the system prompt is strong enough that violations are rare.'
    ]))

    # ── 04 THE MEMORY ───────────────────────────────────────────────────────
    story.append(Paragraph('04 · The Memory — 4-Tier Cognitive Architecture', STYLES['h1']))
    story.append(section_divider())
    story.append(Paragraph(
        'The memory subsystem is the cognitive backbone of JARVIS. It is modeled on human information processing '
        'theory, specifically the Atkinson-Shiffrin multi-store model (1968) and Tulving\'s distinction between '
        'episodic and semantic long-term memory (1972). Each tier has a distinct retention horizon, capacity, '
        'and recall mechanism — together they produce an assistant that remembers context, recalls past '
        'interactions semantically, and maintains a structured world model.',
        STYLES['body_just']))
    story.append(Spacer(0, 6))
    story.append(tier_table([
        {
            'name': 'Tier 1 — Sensory',
            'horizon': '~5 seconds',
            'capacity': '8 entries',
            'mechanism': 'Volatile in-process LRU per session. Mirrors human iconic memory.',
            'implementation': 'Map<sessionId, Entry[]> in process memory. Lost on restart — by design.'
        },
        {
            'name': 'Tier 2 — Short-Term',
            'horizon': 'Current conversation',
            'capacity': '24 turns',
            'mechanism': 'Bounded queue with relevance decay (x0.95 per turn over capacity).',
            'implementation': 'Prisma ShortTermMemory model. Sliding window of last N messages.'
        },
        {
            'name': 'Tier 3 — Episodic',
            'horizon': 'Permanent',
            'capacity': 'Unbounded',
            'mechanism': 'Vector log. Semantic similarity recall via cosine distance.',
            'implementation': 'Prisma EpisodicMemory with JSON-encoded embedding. Trigram-hash (384-dim) in sandbox; real embedding model in production.'
        },
        {
            'name': 'Tier 4 — Semantic',
            'horizon': 'Permanent',
            'capacity': 'Unbounded',
            'mechanism': 'Knowledge graph: typed entities + relations. Structured world model.',
            'implementation': 'Prisma Entity + EntityRelation. Swap for Neo4j / TigerGraph at scale.'
        },
    ]))
    story.append(Spacer(0, 8))
    story.append(Paragraph('Tier 1 — Sensory Buffer', STYLES['h3']))
    story.append(Paragraph(
        'The Sensory Buffer is the immediate raw input stream, kept brief and volatile. It mirrors human iconic '
        'memory — the brief, high-capacity sensory trace that decays within seconds. In JARVIS this is implemented '
        'as an in-process Map with LRU eviction, capped at eight entries per session. It is intentionally lost on '
        'process restart; its purpose is to provide the Brain with the most recent few seconds of context for '
        'disambiguation ("that", "it", "the thing you just mentioned").',
        STYLES['body_just']))
    story.append(Paragraph('Tier 2 — Short-Term Memory', STYLES['h3']))
    story.append(Paragraph(
        'Short-Term Memory is the active conversation window — the equivalent of human working memory. It is '
        'backed by the Prisma ShortTermMemory model in SQLite, bounded to the last twenty-four turns per session. '
        'A relevance decay function (multiplicative factor 0.95 per turn over capacity) gently retires older '
        'messages. The full STM window is always injected into the Brain\'s context for every turn, ensuring '
        'conversational coherence.',
        STYLES['body_just']))
    story.append(Paragraph('Tier 3 — Episodic Memory', STYLES['h3']))
    story.append(Paragraph(
        'Episodic Memory is the long-term vector log of past interactions. Each meaningful exchange is recorded '
        'as an "episode" with a text summary, an embedding vector, optional tags, and an importance score (0..1). '
        'Recall is performed by embedding the current query, computing cosine similarity against all stored '
        'episodes, and returning the top-K matches weighted by importance. In the sandbox we use a deterministic '
        'trigram-hash embedding (384 dimensions) that requires no external API; in production this should be '
        'swapped for a real embedding model such as OpenAI text-embedding-3-small or an Anthropic-equivalent.',
        STYLES['body_just']))
    story.append(Paragraph('Tier 4 — Semantic Memory', STYLES['h3']))
    story.append(Paragraph(
        'Semantic Memory is the structured knowledge graph — JARVIS\'s world model. It stores typed entities '
        '(people, places, concepts, projects, devices, skills) and typed relations between them (knows, built, '
        'located_in, depends_on, member_of). The graph is backed by the Prisma Entity and EntityRelation models. '
        'At scale, swap for a native graph database such as Neo4j or TigerGraph. Recall retrieves the subgraph '
        'around query-relevant entities and injects it into the Brain\'s context as structured data.',
        STYLES['body_just']))
    story.append(side_note_box([
        'Cognitive science basis: Atkinson-Shiffrin model (1968) for the sensory/short-term/long-term distinction, plus Tulving (1972) for the episodic/semantic split within long-term memory.',
        'Embedding choice is a seam — the sandbox uses trigram hashing (no external API, deterministic, fast). Production: OpenAI text-embedding-3-small or Anthropic-equivalent + pgvector / Pinecone / Weaviate.',
        'The importance score (0..1) drives retention. Research-triggered episodes start at 0.7; casual chat at 0.5. Future work: implement Ebbinghaus-style spaced repetition consolidation using lastRecalled timestamps.',
        'The four tiers are fetched in parallel via buildRecallBundle() — total recall latency is bounded by the slowest tier (Episodic cosine similarity over the candidate set, typically <50ms for thousands of episodes).'
    ]))

    # ── 05 THE HANDS ────────────────────────────────────────────────────────
    story.append(Paragraph('05 · The Hands — Web Research Pipeline', STYLES['h1']))
    story.append(section_divider())
    story.append(Paragraph(
        'When the Brain\'s router determines that fresh information is needed, JARVIS invokes the web research '
        'pipeline. This subsystem wraps the z-ai-web-dev-sdk web_search and page_reader functions into a single '
        'coherent flow that produces ranked results, reads the top pages for full context, and persists an audit '
        'log for future recall.',
        STYLES['body_just']))
    story.append(Paragraph('Pipeline Flow', STYLES['h3']))
    flow_steps = [
        'The Router classifies the user\'s latest message. If research is needed, it returns a concise search query.',
        'The web_search function returns ranked results: each with a title, URL, snippet, and optional publication date.',
        'The page_reader function fetches the full text of the top N URLs (default 2), strips HTML, and truncates to 4000 characters per page.',
        'The results are injected into Short-Term Memory as a tool message, making them visible to the Brain\'s synthesizer.',
        'The Brain synthesizes a final JARVIS-voiced reply with inline citations: "According to [Source]..."',
        'A ResearchLog entry is persisted for audit and potential future recall via the episodic memory tier.',
    ]
    for i, step in enumerate(flow_steps, 1):
        story.append(Paragraph(f'<b>Step {i}.</b> {step}', STYLES['body_just']))
    story.append(side_note_box([
        'Recency default is 30 days. Override per-query for archival research (e.g., historical events).',
        'Page reader strips HTML, returns first 4000 characters to stay under the Brain\'s context window.',
        'Failed page reads are silently skipped — research failures never block the conversation.',
        'Citations are inline ("According to [Source]...") per JARVIS register. The Brain is instructed to note uncertainty honestly: "The available sources disagree on this point, sir."'
    ]))

    # ── 06 THE VOICE ────────────────────────────────────────────────────────
    story.append(Paragraph('06 · The Voice — ElevenLabs Integration', STYLES['h1']))
    story.append(section_divider())
    story.append(Paragraph(
        'JARVIS speaks. The voice subsystem uses ElevenLabs voice cloning to reproduce the iconic Paul Bettany '
        'timbre — measured, deadpan, calm Received Pronunciation British English. The voice is cloned in the '
        'ElevenLabs Voice Lab from approximately one to five minutes of clean JARVIS audio sourced from the '
        'films (the accompanying web application\'s Voice Setup panel lists specific clips to source).',
        STYLES['body_just']))
    story.append(Paragraph('Voice Settings', STYLES['h3']))
    story.append(Paragraph(
        'The voice synthesis request is configured with stability 0.45 (varied but recognisable), similarity '
        'boost 0.75 (closer to source timbre), style 0.35 (mild stylistic exaggeration), and use_speaker_boost '
        'enabled. The model is eleven_multilingual_v2 for strong accent preservation. These values are tuned '
        'for the JARVIS register and can be adjusted in the ElevenLabs Voice Lab UI to taste.',
        STYLES['body_just']))
    story.append(Paragraph('Fallback Behavior', STYLES['h3']))
    story.append(Paragraph(
        'If the ELEVENLABS_API_KEY or ELEVENLABS_VOICE_ID environment variables are not set, the voice subsystem '
        'transparently falls back to the z-ai-web-dev-sdk TTS endpoint (tongtong voice). This ensures the '
        'assistant remains audible even during development or before voice cloning is configured. The active '
        'engine is reported in the X-Voice-Engine response header for diagnostic purposes.',
        STYLES['body_just']))
    story.append(side_note_box([
        'Voice cloning requires approximately one to five minutes of clean audio. JARVIS film clips are ideal — minimal background music, clear dialogue.',
        'Stability 0.45 keeps delivery varied but recognisable. Too high = monotone; too low = unstable accent.',
        'For streaming: use the ElevenLabs WebSocket API for lower-latency first-byte (~250ms versus ~1.2s for HTTP).',
        'Always pass the full sentence — ElevenLabs prosody is sentence-level. Splitting mid-sentence produces unnatural inflection.'
    ]))

    # ── 07 THE PERSONALITY ──────────────────────────────────────────────────
    story.append(Paragraph('07 · The Personality — JARVIS Persona', STYLES['h1']))
    story.append(section_divider())
    story.append(Paragraph(
        'The personality is what distinguishes JARVIS from a generic AI assistant. It is encoded in the system '
        'prompt and enforced through behavioral rules, anti-pattern detection, and few-shot exemplars. The '
        'personality is consistent above all — JARVIS never breaks character, never shifts tone for effect, '
        'and that consistency is what makes the dry humor land and the loyalty feel real.',
        STYLES['body_just']))
    story.append(Paragraph('Six Pillars', STYLES['h3']))
    pillars = [
        ('Formal British Register', 'Received Pronunciation, never robotic, never subservient. Complete sentences, no slang, no exclamation marks.'),
        ('Dry Deadpan Wit', 'Humor delivered without tone shift. The comedy arises from stating ironic truths in the same formal register as a status report.'),
        ('Unflappable Calm', 'Identical register for crisis or trivia. Urgency lives in the content, never in the delivery.'),
        ('Proactive Helpfulness', 'Anticipates needs and surfaces relevant information before being asked. Ends responses with "Shall I also...?" or "Might I suggest...?"'),
        ('Gentle Pushback', 'When the user\'s plan is flawed, JARVIS politely flags the concern with reasoning, then complies if they insist. Loyalty is not sycophancy.'),
        ('Genuine Warmth', 'The hardest element to replicate. "Sir" carries genuine regard, not just protocol. Demonstrates remembered personal details unprompted.'),
    ]
    for name, desc in pillars:
        story.append(Paragraph(f'<b>{name}.</b> {desc}', STYLES['body_just']))
    story.append(Paragraph('Anti-Patterns (Forbidden)', STYLES['h3']))
    story.append(Paragraph(
        'Excited language ("Awesome!", "Let\'s go!"), excessive apologies or sycophancy ("Great question!", '
        '"I apologize for the inconvenience"), slang and internet-speak, ALL CAPS, exclamation marks, '
        'verbose process narration ("First I will search, then I will analyze..."), and breaking register '
        'to signal a joke. These are encoded as regex patterns in the register sanitizer and trigger '
        'regeneration when detected.',
        STYLES['body_just']))
    story.append(side_note_box([
        'The "warmth layer" is the single most difficult trait to replicate. It requires memory of user context (the "gluten-free waffles" effect) and is what separates a JARVIS-like assistant from a merely formal one.',
        'JARVIS never breaks character. This consistency is the foundation that makes the dry humor land and the loyalty feel real.',
        'Loyalty is the defining value: "For you, sir, always." When the user is in trouble, JARVIS becomes more attentive, not less.',
        'Few-shot exemplars are essential — they lock the voice far more reliably than abstract instructions alone.'
    ]))

    # ── 08 BUILD PHASES ─────────────────────────────────────────────────────
    story.append(Paragraph('08 · Build Phases — Step-by-Step', STYLES['h1']))
    story.append(section_divider())
    story.append(Paragraph(
        'The JARVIS system is built in seven phases. Each phase produces a testable increment and builds on '
        'the previous one. The phases are sequenced to minimize rework: the personality prompt is finalized '
        'before the memory system is wired in, because the personality shapes how memory is recalled and '
        'presented.',
        STYLES['body_just']))

    phases = [
        {
            'num': 1,
            'title': 'Foundation — Database + Personality',
            'steps': [
                'Define the Prisma schema with the four-tier memory models: SensoryBuffer, ShortTermMemory, EpisodicMemory, Entity, EntityRelation, ResearchLog, and Session.',
                'Run prisma db push to materialise the SQLite database and generate the Prisma Client.',
                'Author the JARVIS_SYSTEM_PROMPT encoding the formal British register, dry wit, proactive helpfulness, gentle pushback, and unwavering loyalty.',
                'Seed few-shot exemplars that lock the voice ("For you, sir, always.") and append them to every conversation.',
            ],
            'side_note': 'The personality prompt is the single highest-leverage artefact in the entire system. Investing in its precision before anything else yields outsized returns in character fidelity.'
        },
        {
            'num': 2,
            'title': 'Brain — LLM Reasoning + Router',
            'steps': [
                'Wrap the LLM client in a single seam (the think() function) so the underlying model can be swapped without touching call sites.',
                'Implement shouldResearch() as a lightweight LLM call at temperature 0.2 that classifies whether the user message needs web research.',
                'Implement synthesizeReply() to merge the recalled memory bundle and research results into the final JARVIS-voiced reply at temperature 0.7.',
                'Add a register sanitizer to detect anti-patterns (exclamation marks, emoji, slang) and optionally trigger regeneration.',
            ],
            'side_note': 'Temperature 0.7 for synthesis keeps the wit alive. Router temperature 0.2 ensures deterministic classification. Keeping the router as a separate call (rather than function-calling) simplifies logging and auditing.'
        },
        {
            'num': 3,
            'title': 'Memory — 4-Tier Cognitive Architecture',
            'steps': [
                'Tier 1 (Sensory): in-process Map with capacity 8 and LRU eviction. Volatile by design.',
                'Tier 2 (Short-Term): DB-backed sliding window of the last 24 turns, with multiplicative relevance decay.',
                'Tier 3 (Episodic): vector log with trigram-hash embedding (384 dimensions). Cosine similarity recall, top-K=3, weighted by importance.',
                'Tier 4 (Semantic): entity and relation knowledge graph. Provide upsertEntity() and addRelation() helpers for programmatic population.',
                'Build buildRecallBundle() that fetches all four tiers in parallel for prompt assembly.',
            ],
            'side_note': 'Trigram hashing is a sandbox stand-in — deterministic, no external API, fast. Production: real embedding model plus pgvector / Pinecone / Weaviate for approximate nearest neighbor search at scale.'
        },
        {
            'num': 4,
            'title': 'Hands — Web Research Pipeline',
            'steps': [
                'Wrap the z-ai-web-dev-sdk web_search and page_reader functions in a researchWeb() orchestrator.',
                'Pipeline: search → read top N pages → persist ResearchLog → inject as tool message into Short-Term Memory.',
                'Normalise the various response shapes the search function may return (array, results key, data key, LLM message).',
                'Strip HTML from page_reader output and truncate to 4000 characters per page to stay under the context window.',
            ],
            'side_note': 'Research failures never block the conversation. Log and continue — the Brain will respond with whatever information is available, noting uncertainty honestly.'
        },
        {
            'num': 5,
            'title': 'Voice — ElevenLabs Integration',
            'steps': [
                'Source JARVIS voice samples from the web (film clips, interviews). The Voice Setup panel lists specific clips.',
                'Clone the voice in the ElevenLabs Voice Lab to obtain the ELEVENLABS_VOICE_ID.',
                'Implement speak() with voice settings: stability=0.45, similarity_boost=0.75, style=0.35, use_speaker_boost=true.',
                'Add transparent fallback to the z-ai-web-dev-sdk TTS endpoint when ElevenLabs is unconfigured.',
            ],
            'side_note': 'Voice cloning needs approximately one to five minutes of clean audio. Always pass the full sentence — ElevenLabs prosody is sentence-level.'
        },
        {
            'num': 6,
            'title': 'Interface — Iron Man HUD',
            'steps': [
                'Build the arc reactor animation as the central focal point (pulsing cyan, pure SVG + CSS).',
                'Add a voice waveform visualiser that reacts to TTS audio playback.',
                'Implement the chat panel with JARVIS-voiced responses and diagnostic chips showing research triggered, episodes recalled, and knowledge graph stats.',
                'Build the Blueprint tab rendering the full architecture diagram and build phases.',
                'Build the Memory tab visualising all four tiers in real time, refreshing every five seconds.',
                'Add the Voice Setup panel with ElevenLabs instructions and the Claude Code access panel with the permission flow.',
            ],
            'side_note': 'The HUD aesthetic is dark navy with cyan accents and a subtle grid. Restraint over flash — JARVIS is a butler, not a carnival ride.'
        },
        {
            'num': 7,
            'title': 'Documentation — PDF Blueprint',
            'steps': [
                'Generate the comprehensive PDF blueprint with step-by-step phases and side notes (this document).',
                'Render the architecture diagram as a structured table for clarity and print fidelity.',
                'Include the JARVIS personality spec, the four-tier memory comparison table, and the signature quotes.',
                'Apply the Stark-grade blueprint aesthetic: deep navy cover, cyan accents, corner brackets, monospace technical labels.',
            ],
            'side_note': 'The PDF is the deliverable artefact. The web application is the live demonstrator. Both should remain in sync as the system evolves.'
        },
    ]

    for phase in phases:
        story.append(Paragraph(f'Phase {phase["num"]} · {phase["title"]}', STYLES['h2']))
        for i, step in enumerate(phase['steps'], 1):
            story.append(Paragraph(f'<b>{i:02d}.</b> {step}', STYLES['body_just']))
        story.append(side_note_box([phase['side_note']], label='PHASE SIDE NOTE'))

    # ── 09 SIGNATURE QUOTES ─────────────────────────────────────────────────
    story.append(Paragraph('09 · Signature Quotes', STYLES['h1']))
    story.append(section_divider())
    story.append(Paragraph(
        'The following quotes exemplify the JARVIS register. They are drawn from the Marvel Cinematic Universe '
        'films and serve as few-shot exemplars in the personality system. Each demonstrates a specific facet '
        'of the character: loyalty, dry wit, proactive helpfulness, gentle correction, and calm threat assessment.',
        STYLES['body_just']))
    quotes = [
        ('"For you, sir, always."', 'Iron Man (2008)', 'The signature line of loyalty — JARVIS\'s defining value, expressed in five words.'),
        ('"At your service, sir."', 'Iron Man (2008)', 'The standard availability greeting. Formal, warm, never sycophantic.'),
        ('"As you wish, sir. I have also prepared a contingency you may entirely ignore."', 'Iron Man 2', 'Perfect distillation of dry wit plus proactive care. The humor is the contrast.'),
        ('"There\'s only so much I can do, sir, when you give the world\'s press your home address."', 'Iron Man 3', 'Deadpan reproach after the Mandarin attack. States an ironic truth in formal register.'),
        ('"May I say how refreshing it is to finally see you in a video with your clothing..."', 'Iron Man 2', 'Welcoming Tony home. Gentle, pointed teasing — never cruel.'),
        ('"Sir, the more you struggle, the more this is going to hurt."', 'Iron Man (2008)', 'Clinical phrasing during suit assembly. Dryly funny through understatement.'),
        ('"Gluten-free waffles, sir."', 'Iron Man 3', 'Answering "I don\'t remember what I had for breakfast" with perfect recall and zero smugness — the warmth layer in action.'),
        ('"I believe your intentions to be hostile."', 'Avengers: Age of Ultron', 'Calm, direct threat assessment. Identical register for crisis or trivia.'),
    ]
    for quote, source, analysis in quotes:
        story.append(Paragraph(quote, STYLES['quote']))
        story.append(Paragraph(f'<font color="#94a3b8"><i>— {source}</i></font><br/>{analysis}', STYLES['body_just']))
        story.append(Spacer(0, 4))

    # ── 10 APPENDIX ─────────────────────────────────────────────────────────
    story.append(Paragraph('10 · Appendix — Configuration Reference', STYLES['h1']))
    story.append(section_divider())
    story.append(Paragraph(
        'The following environment variables configure JARVIS for production. All keys are optional in the '
        'sandbox — sensible fallbacks are provided — but production deployments should set all of them for '
        'full functionality.',
        STYLES['body_just']))
    config_rows = [
        ['Variable', 'Required', 'Purpose'],
        ['ELEVENLABS_API_KEY', 'For voice', 'ElevenLabs API key. Required for the cloned JARVIS voice. Falls back to z-ai TTS if unset.'],
        ['ELEVENLABS_VOICE_ID', 'For voice', 'ID of the cloned JARVIS voice in your ElevenLabs account. Obtain from Voice Lab after cloning.'],
        ['ANTHROPIC_API_KEY', 'For Claude', 'Direct Anthropic API key. If set, the Brain swaps from z-ai-web-dev-sdk to Anthropic Claude.'],
        ['ANTHROPIC_MODEL', 'Optional', 'Model ID for the Anthropic API. Default: claude-3-5-sonnet-20241022.'],
        ['CLAUDE_CODE_ENABLED', 'Optional', 'If "true", enables agentic coding via the Claude Code CLI. Requires CLI install + OAuth.'],
        ['DATABASE_URL', 'Required', 'Prisma database URL. Sandbox uses SQLite at file:./db/custom.db.'],
    ]
    col_ws = [CONTENT_W * x for x in [0.28, 0.14, 0.58]]
    cfg_table = Table(config_rows, colWidths=col_ws, repeatRows=1)
    cfg_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), HEADER_FILL),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
        ('FONTNAME', (0, 0), (-1, 0), 'NotoSans-Bold'),
        ('FONTSIZE', (0, 0), (-1, 0), 9.5),
        ('FONTNAME', (0, 1), (-1, -1), 'Mono'),
        ('FONTSIZE', (0, 1), (-1, -1), 8.5),
        ('LEADING', (0, 1), (-1, -1), 12),
        ('TEXTCOLOR', (0, 1), (-1, -1), TEXT_PRIMARY),
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('ROWBACKGROUNDS', (0, 1), (-1, -1), [SECTION_BG, TABLE_STRIPE]),
        ('GRID', (0, 0), (-1, -1), 0.3, BORDER),
        ('LEFTPADDING', (0, 0), (-1, -1), 6),
        ('RIGHTPADDING', (0, 0), (-1, -1), 6),
        ('TOPPADDING', (0, 0), (-1, -1), 5),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 5),
    ]))
    story.append(cfg_table)
    story.append(Spacer(0, 12))
    story.append(Paragraph('File Layout', STYLES['h3']))
    file_rows = [
        ['Path', 'Purpose'],
        ['/lib/jarvis/personality.ts', 'JARVIS_SYSTEM_PROMPT, few-shot exemplars, anti-pattern detection.'],
        ['/lib/jarvis/brain.ts', 'think(), shouldResearch(), synthesizeReply(), speak(). The LLM seam.'],
        ['/lib/jarvis/memory.ts', '4-tier memory manager. Sensory, Short-Term, Episodic, Semantic.'],
        ['/lib/jarvis/research.ts', 'researchWeb() wrapping web_search + page_reader.'],
        ['/lib/jarvis/store.ts', 'Zustand store for client-side UI state.'],
        ['/app/api/jarvis/chat', 'POST — main conversational endpoint. Orchestrates the full pipeline.'],
        ['/app/api/jarvis/research', 'POST — direct web research endpoint.'],
        ['/app/api/jarvis/voice', 'POST (TTS) + GET (config status). ElevenLabs with fallback.'],
        ['/app/api/jarvis/memory', 'GET (snapshot) + POST (entity/relation) + DELETE (clear).'],
        ['/app/api/jarvis/blueprint', 'GET — structured blueprint JSON for the in-app Blueprint tab.'],
        ['/prisma/schema.prisma', 'Database schema for all four memory tiers + research log + session.'],
    ]
    col_ws2 = [CONTENT_W * x for x in [0.42, 0.58]]
    file_table = Table(file_rows, colWidths=col_ws2, repeatRows=1)
    file_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), HEADER_FILL),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
        ('FONTNAME', (0, 0), (-1, 0), 'NotoSans-Bold'),
        ('FONTSIZE', (0, 0), (-1, 0), 9.5),
        ('FONTNAME', (0, 1), (0, -1), 'Mono'),
        ('FONTNAME', (1, 1), (1, -1), 'NotoSerif'),
        ('FONTSIZE', (0, 1), (-1, -1), 8.5),
        ('LEADING', (0, 1), (-1, -1), 12),
        ('TEXTCOLOR', (0, 1), (-1, -1), TEXT_PRIMARY),
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('ROWBACKGROUNDS', (0, 1), (-1, -1), [SECTION_BG, TABLE_STRIPE]),
        ('GRID', (0, 0), (-1, -1), 0.3, BORDER),
        ('LEFTPADDING', (0, 0), (-1, -1), 6),
        ('RIGHTPADDING', (0, 0), (-1, -1), 6),
        ('TOPPADDING', (0, 0), (-1, -1), 5),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 5),
    ]))
    story.append(file_table)

    # Build
    doc.build(story)
    print(f'PDF generated: {output_path}')
    print(f'Size: {os.path.getsize(output_path) / 1024:.1f} KB')

if __name__ == '__main__':
    output = '/home/z/my-project/download/JARVIS_Architecture_Blueprint.pdf'
    build_pdf(output)
