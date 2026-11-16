import { useState } from 'react';
import { ArrowUpRight, Check, CheckCircle2, ShoppingBag, Users } from 'lucide-react';
import type { HoodieConfig, HoodieOrder } from '../types';

interface HoodieViewProps {
  config: HoodieConfig;
  instagramUrl: string;
  onPlaceOrder: (order: HoodieOrder) => Promise<void> | void;
  onViewBatchmates: () => void;
}

type HoodieSide = 'front' | 'back';

const SIZES: HoodieOrder['size'][] = ['S', 'M', 'L', 'XL', 'XXL', 'XXXL'];

export function HoodieView({ config, instagramUrl, onPlaceOrder, onViewBatchmates }: HoodieViewProps) {
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
      <div className="bg-zinc-900/75 backdrop-blur-xl p-6 sm:p-10 md:p-12 rounded-3xl border border-rose-500/30 shadow-2xl space-y-8">
        {/* Centered Header (User Design) */}
        <div className="text-center space-y-3">
          <p className="text-xs font-bold uppercase tracking-widest text-rose-400">
            {config.kicker || 'Official Merchandise · Rajshahi Collegiate School'}
          </p>
          <h1 className="text-3xl sm:text-5xl font-black tracking-tight text-white">{config.title}</h1>
          <p className="text-zinc-400 text-sm max-w-lg mx-auto leading-relaxed">{config.subtitle}</p>
        </div>

        {/* Two-Column Mixed Showcase */}
        <div className="grid md:grid-cols-2 gap-8 items-start">
          {/* Left Column: Front & Back RCS Hoodie Pictures (Read-Only for Visitors) */}
          <div className="space-y-4">
            <div className="rounded-2xl overflow-hidden border border-zinc-800 bg-zinc-950 aspect-[4/3] relative">
              <img
                src={activeSide === 'front' ? config.frontImage : config.backImage}
                alt={`RCS Hoodie — ${activeSide === 'front' ? 'Front View' : 'Back View'}`}
                referrerPolicy="no-referrer"
                className="w-full h-full object-cover"
              />
              <div className="absolute bottom-3 left-3 px-3 py-1.5 rounded-lg bg-black/80 border border-zinc-800 text-xs font-semibold text-white">
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
                    ? 'border-rose-500 bg-zinc-900'
                    : 'border-zinc-800 bg-zinc-950/70 hover:border-zinc-700'
                }`}
              >
                <img
                  src={config.frontImage}
                  alt="RCS Hoodie Front Option"
                  referrerPolicy="no-referrer"
                  className="w-14 h-11 rounded-lg object-cover border border-zinc-800 shrink-0"
                />
                <div className="min-w-0">
                  <p className={`text-xs font-bold ${activeSide === 'front' ? 'text-white' : 'text-zinc-300'}`}>
                    Front Pic
                  </p>
                  <p className="text-[11px] text-zinc-500 truncate">{config.frontLabel || 'RCS chest crest'}</p>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setActiveSide('back')}
                className={`p-2.5 rounded-xl border text-left flex items-center gap-3 transition-colors cursor-pointer ${
                  activeSide === 'back'
                    ? 'border-rose-500 bg-zinc-900'
                    : 'border-zinc-800 bg-zinc-950/70 hover:border-zinc-700'
                }`}
              >
                <img
                  src={config.backImage}
                  alt="RCS Hoodie Back Option"
                  referrerPolicy="no-referrer"
                  className="w-14 h-11 rounded-lg object-cover border border-zinc-800 shrink-0"
                />
                <div className="min-w-0">
                  <p className={`text-xs font-bold ${activeSide === 'back' ? 'text-white' : 'text-zinc-300'}`}>
                    Back Pic
                  </p>
                  <p className="text-[11px] text-zinc-500 truncate">{config.backLabel || "Orthohin '27 print"}</p>
                </div>
              </button>
            </div>
          </div>

          {/* Right Column: Specs + Direct Order Form (Amount Hidden) */}
          <div className="space-y-6">
            <div className="space-y-2.5">
              <h2 className="text-lg font-black text-white">Hoodie Specifications:</h2>
              <ul className="text-xs sm:text-sm text-zinc-300 space-y-2">
                {config.specs.map((spec, idx) => (
                  <li key={idx} className="flex items-center gap-2.5">
                    <Check className="w-4 h-4 text-rose-500 shrink-0" />
                    <span>{spec}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Direct Order Panel (No Pre-Order, No Price/Amount) */}
            <div className="p-5 rounded-2xl bg-zinc-950/90 border border-zinc-800 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <ShoppingBag className="w-4 h-4 text-rose-500" />
                  Direct Order — RCS Hoodie
                </h3>
                <span className="text-[11px] font-medium text-emerald-400">
                  {config.directOrderOpen ? 'Orders Open' : 'Orders Paused'}
                </span>
              </div>

              {lastOrder ? (
                <div className="p-4 rounded-xl bg-emerald-950/40 border border-emerald-500/30 space-y-2">
                  <div className="flex items-center gap-2 text-emerald-300 text-sm font-bold">
                    <CheckCircle2 className="w-4 h-4 shrink-0" />
                    Direct Order Placed ({lastOrder.id})
                  </div>
                  <p className="text-xs text-zinc-300 leading-relaxed">
                    Order recorded for <strong className="text-white">{lastOrder.customerName}</strong> (Roll{' '}
                    <span className="font-mono">{lastOrder.roll}</span>) · Size{' '}
                    <span className="font-mono text-white">{lastOrder.size}</span> × {lastOrder.quantity}.
                  </p>
                  <button
                    type="button"
                    onClick={() => setLastOrder(null)}
                    className="text-xs font-semibold text-rose-400 hover:text-rose-300 cursor-pointer pt-1"
                  >
                    Place another direct order
                  </button>
                </div>
              ) : !config.directOrderOpen ? (
                <p className="text-xs text-zinc-400 leading-relaxed">
                  Direct ordering is currently paused by the batch admin. Reach out on Instagram for inquiries.
                </p>
              ) : (
                <form onSubmit={handleSubmitOrder} className="space-y-3">
                  <div>
                    <p className="text-[11px] font-medium text-zinc-400 mb-1.5">Select Size</p>
                    <div className="flex flex-wrap gap-1.5">
                      {SIZES.map((sz) => (
                        <button
                          key={sz}
                          type="button"
                          onClick={() => setSelectedSize(sz)}
                          className={`min-w-[2.75rem] px-2.5 h-9 rounded-lg font-mono text-xs font-bold whitespace-nowrap shrink-0 transition-colors cursor-pointer ${
                            selectedSize === sz
                              ? 'bg-rose-600 text-white'
                              : 'bg-zinc-900 border border-zinc-800 text-zinc-300 hover:border-zinc-700'
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
                      className="w-full px-3 py-2 rounded-lg bg-zinc-900 border border-zinc-800 text-xs text-white placeholder:text-zinc-500 focus:outline-none focus:border-rose-500"
                    />
                    <input
                      type="text"
                      required
                      value={roll}
                      onChange={(e) => setRoll(e.target.value)}
                      placeholder="Roll / Batch ID *"
                      className="w-full px-3 py-2 rounded-lg bg-zinc-900 border border-zinc-800 font-mono text-xs text-white placeholder:text-zinc-500 focus:outline-none focus:border-rose-500"
                    />
                  </div>

                  <div className="grid grid-cols-3 gap-3">
                    <input
                      type="text"
                      required
                      value={contact}
                      onChange={(e) => setContact(e.target.value)}
                      placeholder="Phone or @instagram *"
                      className="col-span-2 w-full px-3 py-2 rounded-lg bg-zinc-900 border border-zinc-800 text-xs text-white placeholder:text-zinc-500 focus:outline-none focus:border-rose-500"
                    />
                    <select
                      value={quantity}
                      onChange={(e) => setQuantity(Number(e.target.value))}
                      aria-label="Quantity"
                      className="w-full px-3 py-2 rounded-lg bg-zinc-900 border border-zinc-800 font-mono text-xs text-white focus:outline-none focus:border-rose-500"
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
                    className="w-full px-3 py-2 rounded-lg bg-zinc-900 border border-zinc-800 text-xs text-white placeholder:text-zinc-500 focus:outline-none focus:border-rose-500"
                  />

                  {formError && <p className="text-xs text-rose-400">{formError}</p>}

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
                className="flex-1 py-3 px-4 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-white text-center font-bold text-xs uppercase tracking-wider inline-flex items-center justify-center gap-2 transition-colors"
              >
                Direct Message on Instagram
                <ArrowUpRight className="w-3.5 h-3.5" />
              </a>
              <button
                type="button"
                onClick={onViewBatchmates}
                className="px-5 py-3 rounded-xl bg-zinc-900 border border-zinc-800 text-xs font-semibold text-zinc-200 hover:bg-zinc-800 inline-flex items-center justify-center gap-2 transition-colors cursor-pointer"
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
