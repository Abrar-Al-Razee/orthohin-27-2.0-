import type { Batchmate } from '../types';
import { getInitials } from './storage';

export type CardEditionId = 'crimson' | 'heritage' | 'emerald';

export interface CardEditionMeta {
  id: CardEditionId;
  label: string;
  tagline: string;
  swatch: string;
}

export const CARD_EDITIONS: CardEditionMeta[] = [
  { id: 'crimson', label: 'Midnight Crimson', tagline: 'Signature RCS dark edition', swatch: '#e11d48' },
  { id: 'heritage', label: 'Heritage Cream', tagline: 'Archival 1828 paper edition', swatch: '#9f1239' },
  { id: 'emerald', label: 'Emerald Varsity', tagline: 'Cohort varsity collector print', swatch: '#10b981' },
];

interface Palette {
  bg: string;
  bgInner: string;
  panel: string;
  panelAlt: string;
  border: string;
  accent: string;
  accentSoft: string;
  gold: string;
  textPrimary: string;
  textMuted: string;
  textDim: string;
  gridStroke: string;
  badgeText: string;
}

const PALETTES: Record<CardEditionId, Palette> = {
  crimson: {
    bg: '#09090d',
    bgInner: '#111117',
    panel: '#16161f',
    panelAlt: '#1c161d',
    border: '#2b2b36',
    accent: '#e11d48',
    accentSoft: 'rgba(225, 29, 72, 0.14)',
    gold: '#f59e0b',
    textPrimary: '#fafafa',
    textMuted: '#a1a1aa',
    textDim: '#71717a',
    gridStroke: 'rgba(255, 255, 255, 0.035)',
    badgeText: '#ffffff',
  },
  heritage: {
    bg: '#f5efe3',
    bgInner: '#fbf8f1',
    panel: '#f0e7d6',
    panelAlt: '#ece1cd',
    border: '#d5c7af',
    accent: '#9f1239',
    accentSoft: 'rgba(159, 18, 57, 0.10)',
    gold: '#b45309',
    textPrimary: '#18130f',
    textMuted: '#574c41',
    textDim: '#7a6d5f',
    gridStroke: 'rgba(120, 90, 50, 0.055)',
    badgeText: '#ffffff',
  },
  emerald: {
    bg: '#071310',
    bgInner: '#0c1c17',
    panel: '#10251f',
    panelAlt: '#142b23',
    border: '#203f35',
    accent: '#10b981',
    accentSoft: 'rgba(16, 185, 129, 0.14)',
    gold: '#eab308',
    textPrimary: '#f4fbf8',
    textMuted: '#a7c4b8',
    textDim: '#6d9183',
    gridStroke: 'rgba(167, 243, 208, 0.035)',
    badgeText: '#052e16',
  },
};

function drawRoundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
) {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
}

function wrapTextLines(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
  maxLines: number
): string[] {
  const cleaned = String(text || '').replace(/\s+/g, ' ').trim();
  if (!cleaned) return [];
  const words = cleaned.split(' ');
  const lines: string[] = [];
  let current = '';

  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (ctx.measureText(candidate).width <= maxWidth) {
      current = candidate;
    } else {
      if (current) {
        lines.push(current);
        if (lines.length >= maxLines) {
          const last = lines[maxLines - 1];
          lines[maxLines - 1] = last.length > 3 ? `${last.slice(0, -1)}…` : `${last}…`;
          return lines;
        }
        current = word;
      } else {
        let clipped = word;
        while (clipped.length > 1 && ctx.measureText(`${clipped}…`).width > maxWidth) {
          clipped = clipped.slice(0, -1);
        }
        lines.push(`${clipped}…`);
        if (lines.length >= maxLines) return lines;
        current = '';
      }
    }
  }
  if (current && lines.length < maxLines) {
    lines.push(current);
  }
  return lines;
}

function deriveCohortVibe(bm: Batchmate): string {
  const blob = `${bm.hobbies || ''} ${bm.superpower || ''} ${bm.dreamGoal || ''} ${bm.group || ''}`.toLowerCase();
  if (/(code|dev|app|tech|cyber|robot|software)/.test(blob)) return 'DIGITAL ARCHITECT';
  if (/(football|cricket|sport|turf|athlete|cycle)/.test(blob)) return 'VARSITY MVP';
  if (/(photo|film|camera|art|sketch|design|guitar|music)/.test(blob)) return 'CREATIVE SOUL';
  if (/(debate|journal|book|write|read|humanities)/.test(blob)) return 'CAMPUS VOICE';
  if (/(physics|astro|science|math|doctor|bio)/.test(blob)) return 'SCHOLAR & EXPLORER';
  if (/(bank|business|commerce|brand|founder|organize)/.test(blob)) return 'VENTURE BUILDER';
  return 'CLASS OF 2027 ORIGINAL';
}

function loadImageSafe(src: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    if (!src) {
      resolve(null);
      return;
    }
    const img = new Image();
    if (/^https?:\/\//i.test(src)) {
      img.crossOrigin = 'anonymous';
    }
    const timer = window.setTimeout(() => resolve(null), 4000);
    img.onload = () => {
      window.clearTimeout(timer);
      resolve(img);
    };
    img.onerror = () => {
      window.clearTimeout(timer);
      resolve(null);
    };
    img.src = src;
  });
}

export async function renderBatchmateCardToDataUrl(
  bm: Batchmate,
  edition: CardEditionId = 'crimson'
): Promise<string> {
  const W = 1080;
  const H = 1520;
  const palette = PALETTES[edition] || PALETTES.crimson;

  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D context unavailable');

  // Outer canvas backdrop
  ctx.fillStyle = palette.bg;
  ctx.fillRect(0, 0, W, H);

  // Subtle architectural grid pattern
  ctx.strokeStyle = palette.gridStroke;
  ctx.lineWidth = 1;
  for (let gx = 48; gx < W; gx += 48) {
    ctx.beginPath();
    ctx.moveTo(gx, 0);
    ctx.lineTo(gx, H);
    ctx.stroke();
  }
  for (let gy = 48; gy < H; gy += 48) {
    ctx.beginPath();
    ctx.moveTo(0, gy);
    ctx.lineTo(W, gy);
    ctx.stroke();
  }

  // Main Collector Card Frame
  const pad = 46;
  const cardX = pad;
  const cardY = pad;
  const cardW = W - pad * 2;
  const cardH = H - pad * 2;

  drawRoundRect(ctx, cardX, cardY, cardW, cardH, 36);
  ctx.fillStyle = palette.bgInner;
  ctx.fill();
  ctx.lineWidth = 2.5;
  ctx.strokeStyle = palette.border;
  ctx.stroke();

  // Inner subtle hairline inset
  drawRoundRect(ctx, cardX + 16, cardY + 16, cardW - 32, cardH - 32, 24);
  ctx.lineWidth = 1;
  ctx.strokeStyle = palette.border;
  ctx.stroke();

  // Top Header Strip
  const innerX = cardX + 44;
  const innerW = cardW - 88;
  let y = cardY + 62;

  ctx.fillStyle = palette.accent;
  ctx.font = '700 20px "JetBrains Mono", monospace';
  ctx.textBaseline = 'top';
  ctx.fillText("ORTHOHIN '27  ·  OFFICIAL COHORT CARD", innerX, y);

  const serialLabel = `NO. RCS-${String(bm.roll || '2700').toUpperCase().slice(0, 10)}`;
  ctx.font = '600 20px "JetBrains Mono", monospace';
  ctx.fillStyle = palette.textMuted;
  const serialWidth = ctx.measureText(serialLabel).width;
  ctx.fillText(serialLabel, innerX + innerW - serialWidth, y);

  y += 34;
  ctx.font = '500 17px "DM Sans", sans-serif';
  ctx.fillStyle = palette.textDim;
  ctx.fillText('RAJSHAHI COLLEGIATE SCHOOL  ·  EST. 1828', innerX, y);

  y += 38;
  ctx.strokeStyle = palette.border;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(innerX, y);
  ctx.lineTo(innerX + innerW, y);
  ctx.stroke();

  // Portrait & Primary Identity Hero Block
  y += 34;
  const avatarSize = 236;
  const avatarX = innerX;
  const avatarY = y;

  // Accent frame ring around avatar
  drawRoundRect(ctx, avatarX - 5, avatarY - 5, avatarSize + 10, avatarSize + 10, 32);
  ctx.strokeStyle = palette.accent;
  ctx.lineWidth = 3;
  ctx.stroke();

  const loadedImg = bm.photo ? await loadImageSafe(bm.photo) : null;
  ctx.save();
  drawRoundRect(ctx, avatarX, avatarY, avatarSize, avatarSize, 28);
  ctx.clip();

  if (loadedImg && loadedImg.width > 0 && loadedImg.height > 0) {
    // Cover-crop focused on upper portrait region
    const scale = Math.max(avatarSize / loadedImg.width, avatarSize / loadedImg.height);
    const dw = loadedImg.width * scale;
    const dh = loadedImg.height * scale;
    const dx = avatarX + (avatarSize - dw) / 2;
    const dy = avatarY + Math.min(0, (avatarSize - dh) * 0.22);
    ctx.drawImage(loadedImg, dx, dy, dw, dh);
  } else {
    ctx.fillStyle = palette.panel;
    ctx.fillRect(avatarX, avatarY, avatarSize, avatarSize);
    ctx.fillStyle = palette.accentSoft;
    ctx.fillRect(avatarX, avatarY, avatarSize, avatarSize);
    ctx.fillStyle = palette.accent;
    ctx.font = '800 84px "Plus Jakarta Sans", sans-serif';
    const initials = getInitials(bm.name);
    const iw = ctx.measureText(initials).width;
    ctx.fillText(initials, avatarX + (avatarSize - iw) / 2, avatarY + 66);
  }
  ctx.restore();

  // Identity Text Next to Portrait
  const infoX = avatarX + avatarSize + 34;
  const infoW = innerW - avatarSize - 34;
  let infoY = avatarY + 4;

  // Collector Vibe Ribbon
  const vibe = deriveCohortVibe(bm);
  ctx.font = '700 16px "JetBrains Mono", monospace';
  const vibeW = Math.min(infoW, ctx.measureText(vibe).width + 28);
  drawRoundRect(ctx, infoX, infoY, vibeW, 34, 8);
  ctx.fillStyle = palette.accentSoft;
  ctx.fill();
  ctx.fillStyle = palette.accent;
  ctx.fillText(vibe, infoX + 14, infoY + 8);
  infoY += 50;

  // Full Name
  ctx.fillStyle = palette.textPrimary;
  ctx.font = '800 40px "Plus Jakarta Sans", sans-serif';
  const nameLines = wrapTextLines(ctx, bm.name || 'Orthohin Member', infoW, 2);
  for (const line of nameLines) {
    ctx.fillText(line, infoX, infoY);
    infoY += 46;
  }

  // Nickname
  if (bm.nickname?.trim()) {
    ctx.fillStyle = palette.gold;
    ctx.font = '600 22px "DM Sans", sans-serif';
    const nickLines = wrapTextLines(ctx, `aka "${bm.nickname.trim()}"`, infoW, 1);
    if (nickLines[0]) {
      ctx.fillText(nickLines[0], infoX, infoY);
      infoY += 32;
    }
  }

  // Roll, Group & Social
  infoY += 4;
  ctx.fillStyle = palette.textMuted;
  ctx.font = '600 20px "JetBrains Mono", monospace';
  const metaText = `Roll ${bm.roll || 'N/A'}  ·  ${bm.group || 'Batchmate'}`;
  const metaLines = wrapTextLines(ctx, metaText, infoW, 1);
  if (metaLines[0]) {
    ctx.fillText(metaLines[0], infoX, infoY);
    infoY += 30;
  }

  if (bm.social?.trim()) {
    ctx.fillStyle = palette.accent;
    ctx.font = '600 19px "JetBrains Mono", monospace';
    const socLines = wrapTextLines(ctx, bm.social.trim(), infoW, 1);
    if (socLines[0]) {
      ctx.fillText(socLines[0], infoX, infoY);
    }
  }

  y = avatarY + avatarSize + 38;

  // Editorial Signature Quote Box
  const quoteText =
    bm.quote?.trim() ||
    bm.favoriteMemory?.trim() ||
    "Forever united as Orthohin '27 — memories crafted at Rajshahi Collegiate School.";
  drawRoundRect(ctx, innerX, y, innerW, 144, 20);
  ctx.fillStyle = palette.panel;
  ctx.fill();
  ctx.lineWidth = 1.5;
  ctx.strokeStyle = palette.border;
  ctx.stroke();

  ctx.fillStyle = palette.accent;
  ctx.font = '700 42px "Plus Jakarta Sans", sans-serif';
  ctx.fillText('“', innerX + 26, y + 18);

  ctx.fillStyle = palette.textPrimary;
  ctx.font = '500 23px "DM Sans", sans-serif';
  const qLines = wrapTextLines(ctx, quoteText, innerW - 92, 3);
  qLines.forEach((line, idx) => {
    ctx.fillText(line, innerX + 64, y + 32 + idx * 32);
  });

  y += 174;

  // Dossier Grid (2 Columns x 3 Rows = 6 rich collectible tiles)
  const dossierItems: { label: string; value: string }[] = [
    {
      label: 'HOBBIES & INTERESTS',
      value: bm.hobbies?.trim() || 'Campus adda, music & batch events',
    },
    {
      label: 'DREAM & AMBITION',
      value: bm.dreamGoal?.trim() || 'Making Class of 2027 proud',
    },
    {
      label: 'KNOWN FOR / SUPERPOWER',
      value: bm.superpower?.trim() || 'Always showing up for the squad',
    },
    {
      label: 'FAVORITE HANGOUT',
      value: bm.hangoutSpot?.trim() || 'RCS Main Field & Canteen',
    },
    {
      label: 'BLOOD GROUP & BIRTHDAY',
      value: [bm.bloodGroup?.trim(), bm.birthday?.trim()].filter(Boolean).join(' · ') || "Batch '27 Member",
    },
    {
      label: 'FAVORITE RCS MEMORY',
      value: bm.favoriteMemory?.trim() || 'Every unforgettable afternoon with the batch',
    },
  ];

  const colGap = 22;
  const rowGap = 22;
  const tileW = (innerW - colGap) / 2;
  const tileH = 148;

  dossierItems.forEach((item, index) => {
    const col = index % 2;
    const row = Math.floor(index / 2);
    const tx = innerX + col * (tileW + colGap);
    const ty = y + row * (tileH + rowGap);

    drawRoundRect(ctx, tx, ty, tileW, tileH, 18);
    ctx.fillStyle = row % 2 === 0 ? palette.panel : palette.panelAlt;
    ctx.fill();
    ctx.lineWidth = 1;
    ctx.strokeStyle = palette.border;
    ctx.stroke();

    ctx.fillStyle = palette.accent;
    ctx.font = '700 14px "JetBrains Mono", monospace';
    ctx.fillText(item.label, tx + 22, ty + 20);

    ctx.fillStyle = palette.textPrimary;
    ctx.font = '600 20px "DM Sans", sans-serif';
    const valLines = wrapTextLines(ctx, item.value, tileW - 44, 3);
    valLines.forEach((line, lIdx) => {
      ctx.fillText(line, tx + 22, ty + 52 + lIdx * 28);
    });
  });

  y += tileH * 3 + rowGap * 2 + 34;

  // Footer Verification & Collectible Barcode Strip
  ctx.strokeStyle = palette.border;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(innerX, y);
  ctx.lineTo(innerX + innerW, y);
  ctx.stroke();

  y += 28;

  // Draw crisp deterministic barcode from member ID + roll
  const seedStr = `${bm.id}-${bm.roll}-${bm.name}`;
  let hash = 2166136261;
  for (let i = 0; i < seedStr.length; i++) {
    hash ^= seedStr.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  let bx = innerX;
  const barcodeHeight = 52;
  ctx.fillStyle = palette.textPrimary;
  for (let b = 0; b < 36; b++) {
    const bit = ((hash >>> (b % 24)) + b * 7) & 3;
    const bw = bit === 0 ? 6 : bit === 1 ? 3 : 4;
    if (b % 2 === 0 || bit > 1) {
      ctx.fillRect(bx, y, bw, barcodeHeight);
    }
    bx += bw + 4;
  }

  ctx.fillStyle = palette.textMuted;
  ctx.font = '600 15px "JetBrains Mono", monospace';
  ctx.fillText(
    `VERIFIED COHORT ARCHIVE  ·  JOINED ${bm.registeredAt || '2026'}`,
    innerX,
    y + barcodeHeight + 12
  );

  // Right-side Seal Badge
  const sealText = "CLASS OF '27";
  ctx.font = '800 20px "Plus Jakarta Sans", sans-serif';
  const sealW = 196;
  const sealH = 54;
  const sealX = innerX + innerW - sealW;
  drawRoundRect(ctx, sealX, y + 4, sealW, sealH, 14);
  ctx.fillStyle = palette.accent;
  ctx.fill();
  ctx.fillStyle = palette.badgeText;
  const stw = ctx.measureText(sealText).width;
  ctx.fillText(sealText, sealX + (sealW - stw) / 2, y + 20);

  return canvas.toDataURL('image/png');
}

export async function downloadBatchmateCard(bm: Batchmate, edition: CardEditionId = 'crimson'): Promise<void> {
  const dataUrl = await renderBatchmateCardToDataUrl(bm, edition);
  const safeSlug = (bm.name || 'batchmate')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '');
  const link = document.createElement('a');
  link.href = dataUrl;
  link.download = `orthohin27_${safeSlug || 'member'}_${edition}_card.png`;
  link.click();
}

export function buildCardShareCaption(bm: Batchmate): string {
  const lines = [
    `Official Orthohin '27 Cohort Card — ${bm.name} (Roll ${bm.roll}, ${bm.group})`,
    bm.hobbies ? `Hobbies: ${bm.hobbies}` : '',
    bm.dreamGoal ? `Dream: ${bm.dreamGoal}` : '',
    bm.quote ? `"${bm.quote}"` : '',
    'Rajshahi Collegiate School · Class of 2027',
  ].filter(Boolean);
  return lines.join('\n');
}
