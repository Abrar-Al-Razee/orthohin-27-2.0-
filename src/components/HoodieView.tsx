import { useState } from 'react';
import { ArrowLeft, ArrowUpRight, Check, CheckCircle2, Download, FileText, ShoppingBag, Users } from 'lucide-react';
import type { HoodieConfig, HoodieOrder } from '../types';
import { downloadOrderInvoiceHtml, downloadOrderInvoicePng, formatInvoiceDate } from '../utils/invoice';

interface HoodieViewProps {
  config: HoodieConfig;
  instagramUrl: string;
  onPlaceOrder: (order: HoodieOrder) => Promise<void> | void;
  onViewBatchmates: () => void;
  onBackHome?: () => void;
}

type HoodieSide = 'front' | 'back';

const SIZES: HoodieOrder['size'][] = ['S', 'M', 'L', 'XL', 'XXL', 'XXXL'];

export function HoodieView({ config, instagramUrl, onPlaceOrder, onViewBatchmates, onBackHome }: HoodieViewProps) {
  const [activeSide, setActiveSide] = useState<HoodieSide>('front');
  const [selectedSize, setSelectedSize] = useState<HoodieOrder['size']>('L');
  const [quantity, setQuantity] = useState(1);
  const [customerName, setCustomerName] = useState('');
  const [roll, setRoll] = useState('');
  const [contact, setContact] = useState('');
  const [notes, setNotes] = useState('');
  const [formError, setFormError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [lastOrder, setLastOrder] = useState<HoodieOrder | null>(null);

  const handleSubmitOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;

    const trimmedName = customerName.trim();
    const trimmedRoll = roll.trim();
    const trimmedContact = contact.trim();

    if (!trimmedName || !trimmedRoll || !trimmedContact) {
      setFormError('Please fill in your name, roll number, and phone or Instagram contact.');
      return;
    }

    const order: HoodieOrder = {
      id: `RCS-${Date.now().toString().slice(-5)}`,
      customerName: trimmedName,
      roll: trimmedRoll,
      size: selectedSize,
      quantity,
      contact: trimmedContact,
      notes: notes.trim() || undefined,
      status: 'Pending',
      createdAt: new Date().toISOString(),
    };

    setIsSubmitting(true);
    setFormError('');
    try {
      await onPlaceOrder(order);
      setLastOrder(order);
      setCustomerName('');
      setRoll('');
      setContact('');
      setNotes('');
      setQuantity(1);
    } catch {
      setFormError('Could not place your direct order right now. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <section className="pt-28 pb-24 max-w-5xl mx-auto px-4 sm:px-6">
      {onBackHome && (
        <button
          type="button"
          onClick={onBackHome}
          className="inline-flex items-center gap-2 text-xs font-medium text-zinc-600 hover:text-zinc-950 dark:text-zinc-400 dark:hover:text-white mb-6 transition-colors cursor-pointer"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Back to Home
        </button>
      )}
      <div className="bg-white dark:bg-zinc-900/75 backdrop-blur-xl p-6 sm:p-10 md:p-12 rounded-3xl border border-rose-300 dark:border-rose-500/30 shadow-xl dark:shadow-2xl space-y-8">
        {/* Centered Header */}
        <div className="text-center space-y-3">
          <p className="text-xs font-bold uppercase tracking-widest text-rose-700 dark:text-rose-400">
            {config.kicker || 'Official Merchandise · Rajshahi Collegiate School'}
          </p>
          <h1 className="text-3xl sm:text-5xl font-black tracking-tight text-zinc-950 dark:text-white">{config.title}</h1>
          <p className="text-zinc-700 dark:text-zinc-400 text-sm max-w-lg mx-auto leading-relaxed">{config.subtitle}</p>
        </div>

        {/* Two-Column Mixed Showcase */}
        <div className="grid md:grid-cols-2 gap-8 items-start">
          {/* Left Column: Front & Back RCS Hoodie Pictures (Read-Only for Visitors) */}
          <div className="space-y-4">
            <div className="rounded-2xl overflow-hidden border border-zinc-300 dark:border-zinc-800 bg-zinc-100 dark:bg-zinc-950 aspect-[4/3] relative">
              <img
                src={activeSide === 'front' ? config.frontImage : config.backImage}
                alt={`RCS Hoodie — ${activeSide === 'front' ? 'Front View' : 'Back View'}`}
                referrerPolicy="no-referrer"
                className="w-full h-full object-cover"
              />
              <div className="absolute bottom-3 left-3 px-3 py-1.5 rounded-lg bg-zinc-950/85 border border-zinc-800 text-xs font-semibold text-white">
                {activeSide === 'front'
                  ? `Front View · ${config.frontLabel || 'RCS Crest'}`
                  : `Back View · ${config.backLabel || "Orthohin '27"}`}
              </div>
            </div>

            {/* Two Pic Options: Front & Back */}
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setActiveSide('front')}
                className={`p-2.5 rounded-xl border text-left flex items-center gap-3 transition-colors cursor-pointer ${
                  activeSide === 'front'
                    ? 'border-rose-600 dark:border-rose-500 bg-rose-50 dark:bg-zinc-900'
                    : 'border-zinc-300 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950/70 hover:border-zinc-500 dark:hover:border-zinc-700'
                }`}
              >
                <img
                  src={config.frontImage}
                  alt="RCS Hoodie Front Option"
                  referrerPolicy="no-referrer"
                  className="w-14 h-11 rounded-lg object-cover border border-zinc-300 dark:border-zinc-800 shrink-0"
                />
                <div className="min-w-0">
                  <p className={`text-xs font-bold ${activeSide === 'front' ? 'text-zinc-950 dark:text-white' : 'text-zinc-800 dark:text-zinc-300'}`}>
                    Front Pic
                  </p>
                  <p className="text-[11px] text-zinc-600 dark:text-zinc-500 truncate">{config.frontLabel || 'RCS chest crest'}</p>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setActiveSide('back')}
                className={`p-2.5 rounded-xl border text-left flex items-center gap-3 transition-colors cursor-pointer ${
                  activeSide === 'back'
                    ? 'border-rose-600 dark:border-rose-500 bg-rose-50 dark:bg-zinc-900'
                    : 'border-zinc-300 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950/70 hover:border-zinc-500 dark:hover:border-zinc-700'
                }`}
              >
                <img
                  src={config.backImage}
                  alt="RCS Hoodie Back Option"
                  referrerPolicy="no-referrer"
                  className="w-14 h-11 rounded-lg object-cover border border-zinc-300 dark:border-zinc-800 shrink-0"
                />
                <div className="min-w-0">
                  <p className={`text-xs font-bold ${activeSide === 'back' ? 'text-zinc-950 dark:text-white' : 'text-zinc-800 dark:text-zinc-300'}`}>
                    Back Pic
                  </p>
                  <p className="text-[11px] text-zinc-600 dark:text-zinc-500 truncate">{config.backLabel || "Orthohin '27 print"}</p>
                </div>
              </button>
            </div>
          </div>

          {/* Right Column: Specs + Direct Order Form (Amount Hidden) */}
          <div className="space-y-6">
            <div className="space-y-2.5">
              <h2 className="text-lg font-black text-zinc-950 dark:text-white">Hoodie Specifications:</h2>
              <ul className="text-xs sm:text-sm text-zinc-800 dark:text-zinc-300 space-y-2">
                {config.specs.map((spec, idx) => (
                  <li key={idx} className="flex items-center gap-2.5">
                    <Check className="w-4 h-4 text-rose-600 dark:text-rose-500 shrink-0" />
                    <span>{spec}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Direct Order Panel (No Pre-Order, No Price/Amount) */}
            <div className="p-5 rounded-2xl bg-zinc-50 dark:bg-zinc-950/90 border border-zinc-300 dark:border-zinc-800 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-zinc-950 dark:text-white flex items-center gap-2">
                  <ShoppingBag className="w-4 h-4 text-rose-600 dark:text-rose-500" />
                  Direct Order — RCS Hoodie
                </h3>
                <span className={`text-[11px] font-semibold ${config.directOrderOpen ? 'text-emerald-700 dark:text-emerald-400' : 'text-zinc-600 dark:text-zinc-400'}`}>
                  {config.directOrderOpen ? 'Orders Open' : 'Orders Paused'}
                </span>
              </div>

              {lastOrder ? (
                <div className="p-4 rounded-xl bg-emerald-50 dark:bg-zinc-900/90 border border-emerald-400 dark:border-emerald-500/40 space-y-3.5">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2 text-emerald-800 dark:text-emerald-300 text-sm font-bold">
                      <CheckCircle2 className="w-4 h-4 shrink-0" />
                      Order Confirmed — Official Invoice Ready
                    </div>
                    <span className="px-2 py-0.5 rounded bg-emerald-100 dark:bg-emerald-950/80 border border-emerald-300 dark:border-emerald-500/30 font-mono text-[10px] font-bold text-emerald-800 dark:text-emerald-300">
                      {lastOrder.id}
                    </span>
                  </div>

                  {/* Invoice Summary Slip */}
                  <div className="rounded-lg bg-white dark:bg-zinc-950/90 border border-zinc-300 dark:border-zinc-800 p-3 space-y-2 text-xs">
                    <div className="flex items-center justify-between text-zinc-600 dark:text-zinc-400">
                      <span>Batchmate</span>
                      <span className="font-semibold text-zinc-950 dark:text-white">{lastOrder.customerName}</span>
                    </div>
                    <div className="flex items-center justify-between text-zinc-600 dark:text-zinc-400">
                      <span>Roll · Contact</span>
                      <span className="font-mono text-zinc-900 dark:text-zinc-200">
                        {lastOrder.roll} · {lastOrder.contact}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-zinc-600 dark:text-zinc-400">
                      <span>Item · Size × Qty</span>
                      <span className="font-mono font-bold text-rose-700 dark:text-rose-400">
                        {lastOrder.size} × {lastOrder.quantity}
                      </span>
                    </div>
                    {lastOrder.notes && (
                      <div className="flex items-center justify-between gap-3 text-zinc-600 dark:text-zinc-400">
                        <span className="shrink-0">Note</span>
                        <span className="text-zinc-900 dark:text-zinc-200 text-right truncate">{lastOrder.notes}</span>
                      </div>
                    )}
                    <div className="flex items-center justify-between text-zinc-600 dark:text-zinc-500 pt-1.5 border-t border-zinc-200 dark:border-zinc-800/80 text-[11px]">
                      <span>Issued</span>
                      <span>{formatInvoiceDate(lastOrder.createdAt)}</span>
                    </div>
                  </div>

                  <div className="flex flex-col sm:flex-row gap-2">
                    <button
                      type="button"
                      onClick={() => void downloadOrderInvoicePng(lastOrder, config)}
                      className="flex-1 py-2.5 px-3 rounded-lg bg-rose-600 hover:bg-rose-700 dark:hover:bg-rose-500 text-white text-xs font-bold inline-flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                    >
                      <Download className="w-3.5 h-3.5" />
                      Download Invoice (PNG)
                    </button>
                    <button
                      type="button"
                      onClick={() => downloadOrderInvoiceHtml(lastOrder, config)}
                      className="py-2.5 px-3 rounded-lg bg-white hover:bg-zinc-100 dark:bg-zinc-800 dark:hover:bg-zinc-700 border border-zinc-300 dark:border-transparent text-zinc-900 dark:text-zinc-200 text-xs font-semibold inline-flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                    >
                      <FileText className="w-3.5 h-3.5" />
                      Printable Slip
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={() => setLastOrder(null)}
                    className="text-xs font-semibold text-zinc-700 hover:text-zinc-950 dark:text-zinc-400 dark:hover:text-white cursor-pointer"
                  >
                    Place another direct order
                  </button>
                </div>
              ) : !config.directOrderOpen ? (
                <p className="text-xs text-zinc-700 dark:text-zinc-400 leading-relaxed">
                  Direct ordering is currently paused by the batch admin. Reach out on Instagram for inquiries.
                </p>
              ) : (
                <form onSubmit={handleSubmitOrder} className="space-y-3">
                  <div>
                    <p className="text-[11px] font-medium text-zinc-700 dark:text-zinc-400 mb-1.5">Select Size</p>
                    <div className="flex flex-wrap gap-1.5">
                      {SIZES.map((sz) => (
                        <button
                          key={sz}
                          type="button"
                          onClick={() => setSelectedSize(sz)}
                          className={`min-w-[2.75rem] px-2.5 h-9 rounded-lg font-mono text-xs font-bold whitespace-nowrap shrink-0 transition-colors cursor-pointer ${
                            selectedSize === sz
                              ? 'bg-rose-600 text-white'
                              : 'bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-800 text-zinc-900 dark:text-zinc-300 hover:border-zinc-500 dark:hover:border-zinc-700'
                          }`}
                        >
                          {sz}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <input
                      type="text"
                      required
                      value={customerName}
                      onChange={(e) => setCustomerName(e.target.value)}
                      placeholder="Full Name *"
                      className="w-full px-3 py-2 rounded-lg bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-800 text-xs text-zinc-950 dark:text-white placeholder:text-zinc-500 focus:outline-none focus:border-rose-600 dark:focus:border-rose-500"
                    />
                    <input
                      type="text"
                      required
                      value={roll}
                      onChange={(e) => setRoll(e.target.value)}
                      placeholder="Roll / Batch ID *"
                      className="w-full px-3 py-2 rounded-lg bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-800 font-mono text-xs text-zinc-950 dark:text-white placeholder:text-zinc-500 focus:outline-none focus:border-rose-600 dark:focus:border-rose-500"
                    />
                  </div>

                  <div className="grid grid-cols-3 gap-3">
                    <input
                      type="text"
                      required
                      value={contact}
                      onChange={(e) => setContact(e.target.value)}
                      placeholder="Phone or @instagram *"
                      className="col-span-2 w-full px-3 py-2 rounded-lg bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-800 text-xs text-zinc-950 dark:text-white placeholder:text-zinc-500 focus:outline-none focus:border-rose-600 dark:focus:border-rose-500"
                    />
                    <select
                      value={quantity}
                      onChange={(e) => setQuantity(Number(e.target.value))}
                      aria-label="Quantity"
                      className="w-full px-3 py-2 rounded-lg bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-800 font-mono text-xs text-zinc-950 dark:text-white focus:outline-none focus:border-rose-600 dark:focus:border-rose-500"
                    >
                      {[1, 2, 3, 4, 5].map((q) => (
                        <option key={q} value={q}>
                          Qty: {q}
                        </option>
                      ))}
                    </select>
                  </div>

                  <input
                    type="text"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Section / Delivery Note (optional)"
                    className="w-full px-3 py-2 rounded-lg bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-800 text-xs text-zinc-950 dark:text-white placeholder:text-zinc-500 focus:outline-none focus:border-rose-600 dark:focus:border-rose-500"
                  />

                  {formError && <p className="text-xs font-medium text-rose-700 dark:text-rose-400">{formError}</p>}

                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="w-full py-3 rounded-xl bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 text-white font-bold text-xs uppercase tracking-wider transition-all cursor-pointer disabled:opacity-50"
                  >
                    {isSubmitting ? 'Placing Direct Order...' : `Place Direct Order (Size ${selectedSize})`}
                  </button>
                </form>
              )}
            </div>

            <div className="flex flex-col sm:flex-row gap-3">
              <a
                href={instagramUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 py-3 px-4 rounded-xl bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-900 dark:hover:bg-zinc-800 border border-zinc-300 dark:border-zinc-800 text-zinc-950 dark:text-white text-center font-bold text-xs uppercase tracking-wider inline-flex items-center justify-center gap-2 transition-colors"
              >
                Direct Message on Instagram
                <ArrowUpRight className="w-3.5 h-3.5" />
              </a>
              <button
                type="button"
                onClick={onViewBatchmates}
                className="px-5 py-3 rounded-xl bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-900 dark:hover:bg-zinc-800 border border-zinc-300 dark:border-zinc-800 text-xs font-semibold text-zinc-900 dark:text-zinc-200 inline-flex items-center justify-center gap-2 transition-colors cursor-pointer"
              >
                <Users className="w-3.5 h-3.5" />
                View Batchmates
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
