import type { HoodieConfig, HoodieOrder } from '../types';

function escapeHtml(raw: string): string {
  return raw
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function wrapText(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number
): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = '';

  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (ctx.measureText(next).width <= maxWidth) {
      current = next;
    } else {
      if (current) lines.push(current);
      current = word;
    }
  }
  if (current) lines.push(current);
  return lines.length > 0 ? lines : ['—'];
}

function triggerBlobDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function formatInvoiceDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return new Date().toLocaleString();
  return d.toLocaleString('en-US', {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export async function downloadOrderInvoicePng(
  order: HoodieOrder,
  config?: HoodieConfig
): Promise<void> {
  const width = 1200;
  const height = 1480;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    downloadOrderInvoiceHtml(order, config);
    return;
  }

  const hoodieTitle = config?.title || "RCS HOODIE '26-'27";
  const kicker = config?.kicker || 'Official Merchandise · Rajshahi Collegiate School';
  const formattedDate = formatInvoiceDate(order.createdAt);
  const statusLabel =
    order.status === 'Delivered'
      ? 'DELIVERED'
      : order.status === 'Confirmed'
        ? 'CONFIRMED'
        : 'ORDER CONFIRMED';

  // Background
  ctx.fillStyle = '#070709';
  ctx.fillRect(0, 0, width, height);

  // Top crimson accent bar
  const grad = ctx.createLinearGradient(0, 0, width, 0);
  grad.addColorStop(0, '#dc2626');
  grad.addColorStop(1, '#f43f5e');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, width, 14);

  // Outer card frame
  ctx.fillStyle = '#111114';
  ctx.strokeStyle = '#27272a';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.roundRect(56, 56, width - 112, height - 112, 28);
  ctx.fill();
  ctx.stroke();

  // Header Section
  ctx.fillStyle = '#fb7185';
  ctx.font = 'bold 20px "DM Sans", system-ui, sans-serif';
  ctx.fillText("ORTHOHIN '27 · OFFICIAL ORDER INVOICE", 104, 134);

  ctx.fillStyle = '#ffffff';
  ctx.font = '800 50px "Plus Jakarta Sans", system-ui, sans-serif';
  ctx.fillText(hoodieTitle, 104, 198);

  ctx.fillStyle = '#a1a1aa';
  ctx.font = '500 22px "DM Sans", system-ui, sans-serif';
  ctx.fillText(kicker, 104, 238);

  // Status Pill
  ctx.fillStyle = order.status === 'Delivered' ? '#064e3b' : '#052e16';
  ctx.strokeStyle = '#10b981';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.roundRect(width - 350, 114, 246, 52, 12);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = '#34d399';
  ctx.font = 'bold 20px "JetBrains Mono", monospace';
  ctx.textAlign = 'center';
  ctx.fillText(statusLabel, width - 227, 147);
  ctx.textAlign = 'left';

  // Divider
  ctx.strokeStyle = '#27272a';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(104, 282);
  ctx.lineTo(width - 104, 282);
  ctx.stroke();

  // Invoice Metadata Grid
  const drawMetaBox = (x: number, y: number, w: number, label: string, val: string, mono = false) => {
    ctx.fillStyle = '#0b0b0e';
    ctx.strokeStyle = '#27272a';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.roundRect(x, y, w, 104, 16);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#71717a';
    ctx.font = 'bold 17px "DM Sans", system-ui, sans-serif';
    ctx.fillText(label.toUpperCase(), x + 24, y + 38);

    ctx.fillStyle = '#ffffff';
    ctx.font = mono
      ? 'bold 26px "JetBrains Mono", monospace'
      : 'bold 26px "DM Sans", system-ui, sans-serif';
    ctx.fillText(val, x + 24, y + 76);
  };

  drawMetaBox(104, 314, 476, 'Invoice / Order Reference', order.id, true);
  drawMetaBox(620, 314, 476, 'Issued Date & Time', formattedDate, false);

  // Student Details Card
  ctx.fillStyle = '#0b0b0e';
  ctx.strokeStyle = '#27272a';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.roundRect(104, 446, width - 208, 250, 18);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = '#fb7185';
  ctx.font = 'bold 18px "DM Sans", system-ui, sans-serif';
  ctx.fillText('BILLED TO BATCHMATE', 132, 492);

  const drawRow = (label: string, value: string, y: number, mono = false) => {
    ctx.fillStyle = '#a1a1aa';
    ctx.font = '500 22px "DM Sans", system-ui, sans-serif';
    ctx.fillText(label, 132, y);

    ctx.fillStyle = '#ffffff';
    ctx.font = mono
      ? 'bold 24px "JetBrains Mono", monospace'
      : 'bold 24px "DM Sans", system-ui, sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText(value, width - 132, y);
    ctx.textAlign = 'left';
  };

  drawRow('Full Name', order.customerName, 548);
  drawRow('Roll / Batch ID', order.roll, 602, true);
  drawRow('Contact (Phone / Social)', order.contact, 656);

  // Order Item Table (No Price/Amount shown)
  ctx.fillStyle = '#18181b';
  ctx.beginPath();
  ctx.roundRect(104, 728, width - 208, 58, 12);
  ctx.fill();

  ctx.fillStyle = '#a1a1aa';
  ctx.font = 'bold 18px "DM Sans", system-ui, sans-serif';
  ctx.fillText('ITEM DESCRIPTION', 132, 764);
  ctx.fillText('SIZE', 760, 764);
  ctx.textAlign = 'right';
  ctx.fillText('QUANTITY', width - 132, 764);
  ctx.textAlign = 'left';

  ctx.fillStyle = '#0b0b0e';
  ctx.strokeStyle = '#27272a';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.roundRect(104, 800, width - 208, 120, 14);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 26px "Plus Jakarta Sans", system-ui, sans-serif';
  ctx.fillText(hoodieTitle, 132, 852);
  ctx.fillStyle = '#a1a1aa';
  ctx.font = '500 19px "DM Sans", system-ui, sans-serif';
  ctx.fillText("Official Batch '26-'27 Heavyweight Hoodie Edition", 132, 888);

  // Size badge
  ctx.fillStyle = '#4c0519';
  ctx.strokeStyle = '#e11d48';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.roundRect(748, 832, 108, 52, 10);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 24px "JetBrains Mono", monospace';
  ctx.textAlign = 'center';
  ctx.fillText(order.size, 802, 866);
  ctx.textAlign = 'right';
  ctx.font = 'bold 28px "JetBrains Mono", monospace';
  ctx.fillText(`${order.quantity} pc${order.quantity > 1 ? 's' : ''}`, width - 132, 868);
  ctx.textAlign = 'left';

  // Notes & Specifications
  ctx.fillStyle = '#0b0b0e';
  ctx.strokeStyle = '#27272a';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.roundRect(104, 952, width - 208, 280, 18);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = '#fb7185';
  ctx.font = 'bold 18px "DM Sans", system-ui, sans-serif';
  ctx.fillText('DELIVERY NOTE & SPECIFICATIONS', 132, 998);

  ctx.fillStyle = '#e4e4e7';
  ctx.font = '500 21px "DM Sans", system-ui, sans-serif';
  const noteText = order.notes?.trim() ? `Note: ${order.notes.trim()}` : 'Note: Standard batch collection / pickup';
  const wrappedNotes = wrapText(ctx, noteText, width - 264).slice(0, 2);
  let specY = 1044;
  for (const line of wrappedNotes) {
    ctx.fillText(line, 132, specY);
    specY += 34;
  }

  specY += 12;
  ctx.fillStyle = '#a1a1aa';
  ctx.font = '500 20px "DM Sans", system-ui, sans-serif';
  const specs = (config?.specs || []).slice(0, 3);
  for (const spec of specs) {
    ctx.fillText(`• ${spec}`, 132, specY);
    specY += 34;
  }

  // Footer verification band
  ctx.strokeStyle = '#27272a';
  ctx.beginPath();
  ctx.moveTo(104, 1280);
  ctx.lineTo(width - 104, 1280);
  ctx.stroke();

  ctx.fillStyle = '#d4d4d8';
  ctx.font = 'bold 22px "Plus Jakarta Sans", system-ui, sans-serif';
  ctx.fillText("ORTHOHIN '27 — Rajshahi Collegiate School", 104, 1334);

  ctx.fillStyle = '#71717a';
  ctx.font = '500 19px "DM Sans", system-ui, sans-serif';
  ctx.fillText('Keep this invoice slip for size verification and batch hoodie distribution.', 104, 1370);

  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'));
  if (!blob) {
    downloadOrderInvoiceHtml(order, config);
    return;
  }
  triggerBlobDownload(blob, `RCS-Hoodie-Invoice-${order.id}.png`);
}

export function downloadOrderInvoiceHtml(
  order: HoodieOrder,
  config?: HoodieConfig
): void {
  const hoodieTitle = escapeHtml(config?.title || "RCS HOODIE '26-'27");
  const kicker = escapeHtml(config?.kicker || 'Official Merchandise · Rajshahi Collegiate School');
  const issued = escapeHtml(formatInvoiceDate(order.createdAt));
  const specsHtml = (config?.specs || [])
    .slice(0, 6)
    .map((s) => `<li>${escapeHtml(s)}</li>`)
    .join('');

  const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Invoice ${escapeHtml(order.id)} — ${hoodieTitle}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      background: #070709;
      color: #f4f4f5;
      padding: 32px 16px;
      line-height: 1.5;
    }
    .card {
      max-width: 760px;
      margin: 0 auto;
      background: #111114;
      border: 1px solid #27272a;
      border-top: 6px solid #e11d48;
      border-radius: 16px;
      padding: 36px;
    }
    .header { display: flex; justify-content: space-between; align-items: flex-start; gap: 16px; padding-bottom: 24px; border-bottom: 1px solid #27272a; }
    .kicker { font-size: 12px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; color: #fb7185; }
    h1 { font-size: 28px; margin-top: 6px; color: #ffffff; }
    .sub { font-size: 13px; color: #a1a1aa; margin-top: 4px; }
    .badge {
      padding: 6px 14px; border-radius: 8px; font-size: 12px; font-weight: 700;
      background: #052e16; border: 1px solid #10b981; color: #34d399; white-space: nowrap;
    }
    .grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 16px; margin-top: 24px; }
    .box { background: #09090b; border: 1px solid #27272a; border-radius: 10px; padding: 14px 16px; }
    .label { font-size: 11px; text-transform: uppercase; letter-spacing: 0.06em; color: #71717a; font-weight: 700; }
    .value { font-size: 16px; font-weight: 700; color: #ffffff; margin-top: 4px; font-family: ui-monospace, monospace; }
    table { width: 100%; border-collapse: collapse; margin-top: 24px; }
    th, td { text-align: left; padding: 12px 14px; border-bottom: 1px solid #27272a; }
    th { font-size: 11px; text-transform: uppercase; letter-spacing: 0.06em; color: #a1a1aa; background: #18181b; }
    td { font-size: 14px; color: #f4f4f5; }
    .specs { margin-top: 24px; background: #09090b; border: 1px solid #27272a; border-radius: 10px; padding: 16px; }
    .specs ul { margin-top: 8px; padding-left: 18px; color: #d4d4d8; font-size: 13px; }
    .footer { margin-top: 28px; padding-top: 18px; border-top: 1px solid #27272a; display: flex; justify-content: space-between; align-items: center; gap: 12px; font-size: 12px; color: #a1a1aa; }
    .print-btn { background: #e11d48; color: #fff; border: 0; border-radius: 8px; padding: 8px 16px; font-weight: 700; cursor: pointer; font-size: 12px; }
    @media print {
      body { background: #fff; color: #111; padding: 0; }
      .card { background: #fff; color: #111; border: 1px solid #ccc; }
      .box, .specs { background: #fafafa; border-color: #ddd; }
      h1, .value, td { color: #111; }
      .print-btn { display: none; }
    }
  </style>
</head>
<body>
  <div class="card">
    <div class="header">
      <div>
        <div class="kicker">ORTHOHIN '27 · Official Hoodie Order Invoice</div>
        <h1>${hoodieTitle}</h1>
        <p class="sub">${kicker}</p>
      </div>
      <div class="badge">${escapeHtml(order.status.toUpperCase())}</div>
    </div>

    <div class="grid">
      <div class="box">
        <div class="label">Invoice / Order ID</div>
        <div class="value">${escapeHtml(order.id)}</div>
      </div>
      <div class="box">
        <div class="label">Order Timestamp</div>
        <div class="value" style="font-family: inherit;">${issued}</div>
      </div>
      <div class="box">
        <div class="label">Batchmate Name</div>
        <div class="value" style="font-family: inherit;">${escapeHtml(order.customerName)}</div>
      </div>
      <div class="box">
        <div class="label">Roll / Contact</div>
        <div class="value">Roll ${escapeHtml(order.roll)} · ${escapeHtml(order.contact)}</div>
      </div>
    </div>

    <table>
      <thead>
        <tr>
          <th>Item</th>
          <th>Size</th>
          <th>Quantity</th>
          <th>Notes</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td><strong>${hoodieTitle}</strong></td>
          <td><strong>${escapeHtml(order.size)}</strong></td>
          <td>${order.quantity} pc${order.quantity > 1 ? 's' : ''}</td>
          <td>${escapeHtml(order.notes || 'Standard batch collection')}</td>
        </tr>
      </tbody>
    </table>

    <div class="specs">
      <div class="label">Included Specifications</div>
      <ul>${specsHtml}</ul>
    </div>

    <div class="footer">
      <span>Verified Order Slip · ORTHOHIN '27 Digital Portal</span>
      <button class="print-btn" onclick="window.print()">Print / Save as PDF</button>
    </div>
  </div>
</body>
</html>`;

  const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
  triggerBlobDownload(blob, `RCS-Hoodie-Invoice-${order.id}.html`);
}
