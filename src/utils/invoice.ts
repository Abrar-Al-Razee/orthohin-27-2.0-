import type { HoodieConfig, HoodieOrder } from '../types';
import { HOODIE_UNIT_PRICE } from './storage';

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

export function getOrderFinancials(order: HoodieOrder) {
  const qty = Math.max(1, Number(order.quantity || 1));
  const unitPrice = HOODIE_UNIT_PRICE;
  const totalAmount = qty * unitPrice;
  const isPaid = order.paymentStatus === 'Paid';
  const paidAmount = isPaid ? totalAmount : 0;
  const dueAmount = isPaid ? 0 : totalAmount;
  return {
    qty,
    unitPrice,
    totalAmount,
    isPaid,
    paidAmount,
    dueAmount,
    paymentLabel: isPaid ? 'PAID IN FULL' : `DUE · ${dueAmount} TAKA`,
    shortPaymentLabel: isPaid ? 'PAID' : `DUE · ${dueAmount} BDT`,
  };
}

export async function downloadOrderInvoicePng(
  order: HoodieOrder,
  config?: HoodieConfig
): Promise<void> {
  const width = 1200;
  const height = 1580;
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
  const financials = getOrderFinancials(order);
  const statusLabel =
    order.status === 'Delivered'
      ? 'DELIVERED'
      : order.status === 'Confirmed'
        ? 'CONFIRMED'
        : 'REGISTERED';

  const contactDisplay =
    order.contact?.trim() ||
    order.email?.trim() ||
    `Roll ${order.roll} (Private contact hidden)`;

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
  ctx.fillText("ORTHOHIN '27 · OFFICIAL ORDER INVOICE", 104, 130);

  ctx.fillStyle = '#ffffff';
  ctx.font = '800 48px "Plus Jakarta Sans", system-ui, sans-serif';
  ctx.fillText(hoodieTitle, 104, 192);

  ctx.fillStyle = '#a1a1aa';
  ctx.font = '500 21px "DM Sans", system-ui, sans-serif';
  ctx.fillText(kicker, 104, 234);

  // Prominent Payment Stamp (Paid vs Due 700 Taka)
  const stampBg = financials.isPaid ? '#052e16' : '#451a03';
  const stampBorder = financials.isPaid ? '#10b981' : '#f59e0b';
  const stampText = financials.isPaid ? '#34d399' : '#fbbf24';

  ctx.fillStyle = stampBg;
  ctx.strokeStyle = stampBorder;
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.roundRect(width - 376, 106, 272, 56, 12);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = stampText;
  ctx.font = 'bold 21px "JetBrains Mono", monospace';
  ctx.textAlign = 'center';
  ctx.fillText(financials.paymentLabel, width - 240, 142);

  // Secondary Fulfillment Pill
  ctx.fillStyle = '#18181b';
  ctx.strokeStyle = '#3f3f46';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.roundRect(width - 376, 174, 272, 42, 10);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = '#e4e4e7';
  ctx.font = 'bold 17px "JetBrains Mono", monospace';
  ctx.fillText(`ORDER STATUS · ${statusLabel}`, width - 240, 201);
  ctx.textAlign = 'left';

  // Divider
  ctx.strokeStyle = '#27272a';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(104, 276);
  ctx.lineTo(width - 104, 276);
  ctx.stroke();

  // Invoice Metadata Grid
  const drawMetaBox = (x: number, y: number, w: number, label: string, val: string, mono = false) => {
    ctx.fillStyle = '#0b0b0e';
    ctx.strokeStyle = '#27272a';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.roundRect(x, y, w, 102, 16);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#71717a';
    ctx.font = 'bold 16px "DM Sans", system-ui, sans-serif';
    ctx.fillText(label.toUpperCase(), x + 24, y + 36);

    ctx.fillStyle = '#ffffff';
    ctx.font = mono
      ? 'bold 27px "JetBrains Mono", monospace'
      : 'bold 24px "DM Sans", system-ui, sans-serif';
    ctx.fillText(val, x + 24, y + 74);
  };

  drawMetaBox(104, 306, 476, 'Exact Order Reference ID', order.id, true);
  drawMetaBox(620, 306, 476, 'Issued Date & Time', formattedDate, false);

  // Student Details Card
  ctx.fillStyle = '#0b0b0e';
  ctx.strokeStyle = '#27272a';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.roundRect(104, 434, width - 208, 228, 18);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = '#fb7185';
  ctx.font = 'bold 17px "DM Sans", system-ui, sans-serif';
  ctx.fillText('BILLED TO BATCHMATE', 132, 478);

  const drawRow = (label: string, value: string, y: number, mono = false) => {
    ctx.fillStyle = '#a1a1aa';
    ctx.font = '500 21px "DM Sans", system-ui, sans-serif';
    ctx.fillText(label, 132, y);

    ctx.fillStyle = '#ffffff';
    ctx.font = mono
      ? 'bold 23px "JetBrains Mono", monospace'
      : 'bold 23px "DM Sans", system-ui, sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText(value.slice(0, 48), width - 132, y);
    ctx.textAlign = 'left';
  };

  drawRow('Full Name', order.customerName, 530);
  drawRow('Roll / Batch ID', order.roll, 582, true);
  drawRow('Contact', contactDisplay, 634);

  // Order Item Table Header
  ctx.fillStyle = '#18181b';
  ctx.beginPath();
  ctx.roundRect(104, 692, width - 208, 56, 12);
  ctx.fill();

  ctx.fillStyle = '#a1a1aa';
  ctx.font = 'bold 17px "DM Sans", system-ui, sans-serif';
  ctx.fillText('ITEM DESCRIPTION', 132, 727);
  ctx.fillText('RATE', 620, 727);
  ctx.fillText('SIZE × QTY', 760, 727);
  ctx.textAlign = 'right';
  ctx.fillText('TOTAL', width - 132, 727);
  ctx.textAlign = 'left';

  // Order Item Row
  ctx.fillStyle = '#0b0b0e';
  ctx.strokeStyle = '#27272a';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.roundRect(104, 762, width - 208, 114, 14);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 25px "Plus Jakarta Sans", system-ui, sans-serif';
  ctx.fillText(hoodieTitle, 132, 812);
  ctx.fillStyle = '#a1a1aa';
  ctx.font = '500 18px "DM Sans", system-ui, sans-serif';
  ctx.fillText("Official Batch '26-'27 Heavyweight Hoodie Edition", 132, 846);

  ctx.fillStyle = '#d4d4d8';
  ctx.font = 'bold 21px "JetBrains Mono", monospace';
  ctx.fillText(`${financials.unitPrice} BDT`, 620, 826);

  // Size × Qty pill
  ctx.fillStyle = '#4c0519';
  ctx.strokeStyle = '#e11d48';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.roundRect(754, 792, 138, 50, 10);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 22px "JetBrains Mono", monospace';
  ctx.textAlign = 'center';
  ctx.fillText(`${order.size} × ${financials.qty}`, 823, 825);

  ctx.textAlign = 'right';
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 26px "JetBrains Mono", monospace';
  ctx.fillText(`${financials.totalAmount} BDT`, width - 132, 828);
  ctx.textAlign = 'left';

  // Payment Breakdown Card
  ctx.fillStyle = financials.isPaid ? '#041f14' : '#1c1205';
  ctx.strokeStyle = financials.isPaid ? '#059669' : '#d97706';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.roundRect(104, 904, width - 208, 166, 16);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = financials.isPaid ? '#34d399' : '#fbbf24';
  ctx.font = 'bold 18px "DM Sans", system-ui, sans-serif';
  ctx.fillText(
    financials.isPaid ? 'PAYMENT CONFIRMED · PAID RECEIPT' : 'PAYMENT DUE INVOICE',
    132,
    944
  );

  ctx.fillStyle = '#d4d4d8';
  ctx.font = '500 20px "DM Sans", system-ui, sans-serif';
  ctx.fillText(`Subtotal (${financials.qty} × ${financials.unitPrice} Taka)`, 132, 990);
  ctx.textAlign = 'right';
  ctx.font = 'bold 21px "JetBrains Mono", monospace';
  ctx.fillText(`${financials.totalAmount} TAKA`, width - 132, 990);
  ctx.textAlign = 'left';

  ctx.fillStyle = financials.isPaid ? '#6ee7b7' : '#fcd34d';
  ctx.font = 'bold 24px "Plus Jakarta Sans", system-ui, sans-serif';
  ctx.fillText(financials.isPaid ? 'Balance Due' : 'Total Due Payable', 132, 1040);
  ctx.textAlign = 'right';
  ctx.font = 'bold 30px "JetBrains Mono", monospace';
  ctx.fillText(
    financials.isPaid ? '0 TAKA (PAID)' : `${financials.dueAmount} TAKA DUE`,
    width - 132,
    1042
  );
  ctx.textAlign = 'left';

  // Notes & Specifications
  ctx.fillStyle = '#0b0b0e';
  ctx.strokeStyle = '#27272a';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.roundRect(104, 1098, width - 208, 258, 18);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = '#fb7185';
  ctx.font = 'bold 17px "DM Sans", system-ui, sans-serif';
  ctx.fillText('DELIVERY NOTE & SPECIFICATIONS', 132, 1142);

  ctx.fillStyle = '#e4e4e7';
  ctx.font = '500 20px "DM Sans", system-ui, sans-serif';
  const noteText = order.notes?.trim() ? `Note: ${order.notes.trim()}` : 'Note: Standard batch collection / pickup';
  const wrappedNotes = wrapText(ctx, noteText, width - 264).slice(0, 2);
  let specY = 1184;
  for (const line of wrappedNotes) {
    ctx.fillText(line, 132, specY);
    specY += 32;
  }

  specY += 10;
  ctx.fillStyle = '#a1a1aa';
  ctx.font = '500 19px "DM Sans", system-ui, sans-serif';
  const specs = (config?.specs || []).slice(0, 3);
  for (const spec of specs) {
    ctx.fillText(`• ${spec}`, 132, specY);
    specY += 32;
  }

  // Footer verification band
  ctx.strokeStyle = '#27272a';
  ctx.beginPath();
  ctx.moveTo(104, 1396);
  ctx.lineTo(width - 104, 1396);
  ctx.stroke();

  ctx.fillStyle = '#d4d4d8';
  ctx.font = 'bold 22px "Plus Jakarta Sans", system-ui, sans-serif';
  ctx.fillText("ORTHOHIN '27 — Rajshahi Collegiate School", 104, 1446);

  ctx.fillStyle = '#71717a';
  ctx.font = '500 18px "DM Sans", system-ui, sans-serif';
  ctx.fillText(
    `Order ID: ${order.id} · Present this official invoice for payment verification & hoodie collection.`,
    104,
    1482
  );

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
  const financials = getOrderFinancials(order);
  const contactDisplay =
    order.contact?.trim() ||
    order.email?.trim() ||
    `Roll ${order.roll}`;

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
      max-width: 780px;
      margin: 0 auto;
      background: #111114;
      border: 1px solid #27272a;
      border-top: 6px solid #e11d48;
      border-radius: 16px;
      padding: 36px;
    }
    .header { display: flex; justify-content: space-between; align-items: flex-start; gap: 16px; padding-bottom: 24px; border-bottom: 1px solid #27272a; flex-wrap: wrap; }
    .kicker { font-size: 12px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; color: #fb7185; }
    h1 { font-size: 28px; margin-top: 6px; color: #ffffff; }
    .sub { font-size: 13px; color: #a1a1aa; margin-top: 4px; }
    .badges { display: flex; flex-direction: column; align-items: flex-end; gap: 6px; }
    .pay-badge {
      padding: 7px 14px; border-radius: 8px; font-size: 12px; font-weight: 800; letter-spacing: 0.04em; white-space: nowrap;
      font-family: ui-monospace, monospace;
      background: ${financials.isPaid ? '#052e16' : '#451a03'};
      border: 1px solid ${financials.isPaid ? '#10b981' : '#f59e0b'};
      color: ${financials.isPaid ? '#34d399' : '#fbbf24'};
    }
    .status-badge {
      padding: 4px 10px; border-radius: 6px; font-size: 11px; font-weight: 600;
      background: #18181b; border: 1px solid #3f3f46; color: #d4d4d8; white-space: nowrap;
      font-family: ui-monospace, monospace;
    }
    .grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 16px; margin-top: 24px; }
    .box { background: #09090b; border: 1px solid #27272a; border-radius: 10px; padding: 14px 16px; }
    .label { font-size: 11px; text-transform: uppercase; letter-spacing: 0.06em; color: #71717a; font-weight: 700; }
    .value { font-size: 16px; font-weight: 700; color: #ffffff; margin-top: 4px; font-family: ui-monospace, monospace; }
    table { width: 100%; border-collapse: collapse; margin-top: 24px; }
    th, td { text-align: left; padding: 12px 14px; border-bottom: 1px solid #27272a; }
    th { font-size: 11px; text-transform: uppercase; letter-spacing: 0.06em; color: #a1a1aa; background: #18181b; }
    td { font-size: 14px; color: #f4f4f5; }
    .num { text-align: right; font-family: ui-monospace, monospace; }
    .summary {
      margin-top: 20px; border-radius: 12px; padding: 16px 18px;
      background: ${financials.isPaid ? '#041f14' : '#1c1205'};
      border: 1px solid ${financials.isPaid ? '#059669' : '#d97706'};
      display: flex; justify-content: space-between; align-items: center; gap: 12px; flex-wrap: wrap;
    }
    .summary-title { font-size: 13px; font-weight: 700; color: ${financials.isPaid ? '#34d399' : '#fbbf24'}; }
    .summary-sub { font-size: 12px; color: #d4d4d8; margin-top: 2px; }
    .summary-amt { font-size: 20px; font-weight: 800; font-family: ui-monospace, monospace; color: ${financials.isPaid ? '#6ee7b7' : '#fcd34d'}; }
    .specs { margin-top: 24px; background: #09090b; border: 1px solid #27272a; border-radius: 10px; padding: 16px; }
    .specs ul { margin-top: 8px; padding-left: 18px; color: #d4d4d8; font-size: 13px; }
    .footer { margin-top: 28px; padding-top: 18px; border-top: 1px solid #27272a; display: flex; justify-content: space-between; align-items: center; gap: 12px; font-size: 12px; color: #a1a1aa; }
    .print-btn { background: #e11d48; color: #fff; border: 0; border-radius: 8px; padding: 8px 16px; font-weight: 700; cursor: pointer; font-size: 12px; }
    @media print {
      body { background: #fff; color: #111; padding: 0; }
      .card { background: #fff; color: #111; border: 1px solid #ccc; }
      .box, .specs, .summary { background: #fafafa; border-color: #ddd; color: #111; }
      h1, .value, td, .summary-title, .summary-amt { color: #111 !important; }
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
      <div class="badges">
        <div class="pay-badge">${escapeHtml(financials.paymentLabel)}</div>
        <div class="status-badge">STATUS: ${escapeHtml(order.status.toUpperCase())}</div>
      </div>
    </div>

    <div class="grid">
      <div class="box">
        <div class="label">Exact Order Reference ID</div>
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
        <div class="value">Roll ${escapeHtml(order.roll)} · ${escapeHtml(contactDisplay)}</div>
      </div>
    </div>

    <table>
      <thead>
        <tr>
          <th>Item</th>
          <th>Size</th>
          <th>Quantity</th>
          <th class="num">Unit Price</th>
          <th class="num">Total</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td><strong>${hoodieTitle}</strong><br /><span style="font-size:12px;color:#a1a1aa">${escapeHtml(order.notes || 'Standard batch collection')}</span></td>
          <td><strong>${escapeHtml(order.size)}</strong></td>
          <td>${financials.qty} pc${financials.qty > 1 ? 's' : ''}</td>
          <td class="num">${financials.unitPrice} BDT</td>
          <td class="num"><strong>${financials.totalAmount} BDT</strong></td>
        </tr>
      </tbody>
    </table>

    <div class="summary">
      <div>
        <div class="summary-title">${financials.isPaid ? 'PAYMENT CONFIRMED · PAID IN FULL' : 'PAYMENT DUE · 700 TAKA / HOODIE'}</div>
        <div class="summary-sub">Paid: ${financials.paidAmount} BDT · Balance Due: ${financials.dueAmount} BDT</div>
      </div>
      <div class="summary-amt">${financials.isPaid ? 'PAID · ৳' + financials.totalAmount : 'DUE · ' + financials.dueAmount + ' TAKA'}</div>
    </div>

    <div class="specs">
      <div class="label">Included Specifications</div>
      <ul>${specsHtml}</ul>
    </div>

    <div class="footer">
      <span>Order ID ${escapeHtml(order.id)} · ORTHOHIN '27 Digital Portal</span>
      <button class="print-btn" onclick="window.print()">Print / Save as PDF</button>
    </div>
  </div>
</body>
</html>`;

  const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
  triggerBlobDownload(blob, `RCS-Hoodie-Invoice-${order.id}.html`);
}
