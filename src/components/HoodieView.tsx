import { useMemo, useState } from 'react';
import {
  ArrowLeft,
  ArrowUpRight,
  Check,
  CheckCircle2,
  Clock,
  Download,
  FileText,
  Mail,
  Search,
  ShoppingBag,
  Users,
} from 'lucide-react';
import type { Batchmate, HoodieConfig, HoodieOrder } from '../types';
import {
  downloadOrderInvoiceHtml,
  downloadOrderInvoicePng,
  formatInvoiceDate,
  getOrderFinancials,
} from '../utils/invoice';
import { getInitials, HOODIE_UNIT_PRICE } from '../utils/storage';
import { Hoodie3DStage, Reveal3D, TiltStage3D } from './Spatial3D';

interface HoodieViewProps {
  config: HoodieConfig;
  instagramUrl: string;
  publicOrders?: HoodieOrder[];
  batchmates?: Batchmate[];
  onPlaceOrder: (order: HoodieOrder) => Promise<void> | void;
  onViewBatchmates: () => void;
  onBackHome?: () => void;
}

type HoodieSide = 'front' | 'back';
type OrderRosterFilter = 'All' | 'Due' | 'Paid';

const SIZES: HoodieOrder['size'][] = ['S', 'M', 'L', 'XL', 'XXL', 'XXXL'];

export function HoodieView({
  config,
  instagramUrl,
  publicOrders = [],
  batchmates = [],
  onPlaceOrder,
  onViewBatchmates,
  onBackHome,
}: HoodieViewProps) {
  const [activeSide, setActiveSide] = useState<HoodieSide>('front');
  const [selectedSize, setSelectedSize] = useState<HoodieOrder['size']>('L');
  const [quantity, setQuantity] = useState(1);
  const [customerName, setCustomerName] = useState('');
  const [roll, setRoll] = useState('');
  const [contact, setContact] = useState('');
  const [email, setEmail] = useState('');
  const [notes, setNotes] = useState('');
  const [formError, setFormError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [lastOrder, setLastOrder] = useState<HoodieOrder | null>(null);

  const [rosterSearch, setRosterSearch] = useState('');
  const [rosterFilter, setRosterFilter] = useState<OrderRosterFilter>('All');

  const estimatedTotal = quantity * HOODIE_UNIT_PRICE;

  const batchmateAvatarByRoll = useMemo(() => {
    const map = new Map<string, string>();
    for (const bm of batchmates) {
      if (bm.photo && bm.roll.trim()) {
        map.set(bm.roll.trim().toLowerCase(), bm.photo);
      }
    }
    return map;
  }, [batchmates]);

  const rosterStats = useMemo(() => {
    let totalPieces = 0;
    let paidCount = 0;
    let dueCount = 0;
    for (const o of publicOrders) {
      totalPieces += Math.max(1, Number(o.quantity || 1));
      if (o.paymentStatus === 'Paid') paidCount += 1;
      else dueCount += 1;
    }
    return {
      totalOrders: publicOrders.length,
      totalPieces,
      paidCount,
      dueCount,
    };
  }, [publicOrders]);

  const filteredPublicOrders = useMemo(() => {
    const q = rosterSearch.trim().toLowerCase();
    return publicOrders.filter((o) => {
      const isPaid = o.paymentStatus === 'Paid';
      const matchesFilter =
        rosterFilter === 'All' ||
        (rosterFilter === 'Paid' && isPaid) ||
        (rosterFilter === 'Due' && !isPaid);
      const matchesQuery =
        !q ||
        o.customerName.toLowerCase().includes(q) ||
        o.roll.toLowerCase().includes(q) ||
        o.id.toLowerCase().includes(q) ||
        o.size.toLowerCase().includes(q);
      return matchesFilter && matchesQuery;
    });
  }, [publicOrders, rosterSearch, rosterFilter]);

  const handleSubmitOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;

    const trimmedName = customerName.trim();
    const trimmedRoll = roll.trim();
    const trimmedContact = contact.trim();
    const trimmedEmail = email.trim();

    if (!trimmedName || !trimmedRoll || !trimmedContact || !trimmedEmail) {
      setFormError('Please fill in your name, roll number, phone/Instagram, and email address.');
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      setFormError('Please enter a valid email address so we can send your invoice.');
      return;
    }

    const order: HoodieOrder = {
      id: `RCS-${Date.now().toString().slice(-6)}`,
      customerName: trimmedName,
      roll: trimmedRoll,
      size: selectedSize,
      quantity,
      contact: trimmedContact,
      email: trimmedEmail,
      notes: notes.trim() || undefined,
      status: 'Pending',
      paymentStatus: 'Due',
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
      setEmail('');
      setNotes('');
      setQuantity(1);
    } catch {
      setFormError('Could not place your direct order right now. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <section className="pt-28 pb-24 max-w-6xl mx-auto px-4 sm:px-6 space-y-12">
      {onBackHome && (
        <button
          type="button"
          onClick={onBackHome}
          className="inline-flex items-center gap-2 text-xs font-medium text-zinc-600 hover:text-zinc-950 dark:text-zinc-400 dark:hover:text-white transition-colors cursor-pointer"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Back to Home
        </button>
      )}

      {/* Main Hoodie Showcase & Direct Order Form */}
      <div className="bg-white dark:bg-zinc-900/75 backdrop-blur-xl p-6 sm:p-10 md:p-12 rounded-3xl border border-rose-300 dark:border-rose-500/30 shadow-xl dark:shadow-2xl space-y-8">
        <div className="text-center space-y-3">
          <p className="text-xs font-bold uppercase tracking-widest text-rose-700 dark:text-rose-400">
            {config.kicker || 'Official Merchandise · Rajshahi Collegiate School'}
          </p>
          <h1 className="text-3xl sm:text-5xl font-black tracking-tight text-zinc-950 dark:text-white">{config.title}</h1>
          <p className="text-zinc-700 dark:text-zinc-400 text-sm max-w-lg mx-auto leading-relaxed">{config.subtitle}</p>
        </div>

        <div className="grid md:grid-cols-2 gap-8 items-start">
          {/* Left Column: Interactive 3D Front & Back RCS Hoodie Showcase */}
          <div className="space-y-4">
            <Hoodie3DStage
              activeSide={activeSide}
              frontImage={config.frontImage}
              backImage={config.backImage}
              frontLabel={config.frontLabel}
              backLabel={config.backLabel}
              onToggleSide={() => setActiveSide((prev) => (prev === 'front' ? 'back' : 'front'))}
            />

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

          {/* Right Column: Specs + Direct Order Registration Form */}
          <div className="space-y-6">
            <div className="space-y-2.5">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h2 className="text-lg font-black text-zinc-950 dark:text-white">Hoodie Specifications</h2>
                <span className="font-mono text-sm font-bold text-rose-700 dark:text-rose-400 tabular-nums">
                  {HOODIE_UNIT_PRICE} Taka / Hoodie
                </span>
              </div>
              <ul className="text-xs sm:text-sm text-zinc-800 dark:text-zinc-300 space-y-2">
                {config.specs.map((spec, idx) => (
                  <li key={idx} className="flex items-center gap-2.5">
                    <Check className="w-4 h-4 text-rose-600 dark:text-rose-500 shrink-0" />
                    <span>{spec}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="p-5 rounded-2xl bg-zinc-50 dark:bg-zinc-950/90 border border-zinc-300 dark:border-zinc-800 space-y-4">
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-sm font-bold text-zinc-950 dark:text-white flex items-center gap-2">
                  <ShoppingBag className="w-4 h-4 text-rose-600 dark:text-rose-500" />
                  Hoodie Registration &amp; Direct Order
                </h3>
                <span className={`text-[11px] font-semibold whitespace-nowrap shrink-0 ${config.directOrderOpen ? 'text-emerald-700 dark:text-emerald-400' : 'text-zinc-600 dark:text-zinc-400'}`}>
                  {config.directOrderOpen ? 'Instant Live Card' : 'Orders Paused'}
                </span>
              </div>

              {lastOrder ? (
                <div className="p-4 rounded-xl bg-emerald-50 dark:bg-zinc-900/90 border border-emerald-400 dark:border-emerald-500/40 space-y-3.5">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2 text-emerald-800 dark:text-emerald-300 text-sm font-bold">
                      <CheckCircle2 className="w-4 h-4 shrink-0" />
                      Order Card Live — Invoice Ready
                    </div>
                    <span className="px-2 py-0.5 rounded bg-emerald-100 dark:bg-emerald-950/80 border border-emerald-300 dark:border-emerald-500/30 font-mono text-[10px] font-bold text-emerald-800 dark:text-emerald-300">
                      {lastOrder.id}
                    </span>
                  </div>

                  {(() => {
                    const financials = getOrderFinancials(lastOrder);
                    return (
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
                        {lastOrder.email && (
                          <div className="flex items-center justify-between text-zinc-600 dark:text-zinc-400">
                            <span>Email</span>
                            <span className="font-mono text-zinc-900 dark:text-zinc-200 truncate max-w-[200px]">
                              {lastOrder.email}
                            </span>
                          </div>
                        )}
                        <div className="flex items-center justify-between text-zinc-600 dark:text-zinc-400">
                          <span>Size × Qty · Total</span>
                          <span className="font-mono font-bold text-rose-700 dark:text-rose-400 tabular-nums">
                            {lastOrder.size} × {financials.qty} · {financials.totalAmount} Taka
                          </span>
                        </div>
                        <div className="flex items-center justify-between text-zinc-600 dark:text-zinc-400">
                          <span>Payment Status</span>
                          <span className={`font-mono font-bold ${financials.isPaid ? 'text-emerald-700 dark:text-emerald-400' : 'text-amber-700 dark:text-amber-400'}`}>
                            {financials.paymentLabel}
                          </span>
                        </div>
                        <div className="flex items-center justify-between text-zinc-600 dark:text-zinc-500 pt-1.5 border-t border-zinc-200 dark:border-zinc-800/80 text-[11px]">
                          <span>Issued</span>
                          <span>{formatInvoiceDate(lastOrder.createdAt)}</span>
                        </div>
                      </div>
                    );
                  })()}

                  <div className="flex flex-col sm:flex-row gap-2">
                    <button
                      type="button"
                      onClick={() => void downloadOrderInvoicePng(lastOrder, config)}
                      className="flex-1 py-2.5 px-3 rounded-lg bg-rose-600 hover:bg-rose-700 dark:hover:bg-rose-500 text-white text-xs font-bold inline-flex items-center justify-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap shrink-0"
                    >
                      <Download className="w-3.5 h-3.5" />
                      Download Invoice (PNG)
                    </button>
                    <button
                      type="button"
                      onClick={() => downloadOrderInvoiceHtml(lastOrder, config)}
                      className="py-2.5 px-3 rounded-lg bg-white hover:bg-zinc-100 dark:bg-zinc-800 dark:hover:bg-zinc-700 border border-zinc-300 dark:border-transparent text-zinc-900 dark:text-zinc-200 text-xs font-semibold inline-flex items-center justify-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap shrink-0"
                    >
                      <FileText className="w-3.5 h-3.5" />
                      Printable Slip
                    </button>
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => setLastOrder(null)}
                      className="text-xs font-semibold text-zinc-700 hover:text-zinc-950 dark:text-zinc-400 dark:hover:text-white cursor-pointer"
                    >
                      Place another order
                    </button>
                    <a
                      href="#hoodie-orders-roster"
                      className="text-xs font-semibold text-rose-700 hover:text-rose-800 dark:text-rose-400 dark:hover:text-rose-300"
                    >
                      View your live card below
                    </a>
                  </div>
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

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <input
                      type="text"
                      required
                      value={contact}
                      onChange={(e) => setContact(e.target.value)}
                      placeholder="Phone or @instagram *"
                      className="sm:col-span-2 w-full px-3 py-2 rounded-lg bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-800 text-xs text-zinc-950 dark:text-white placeholder:text-zinc-500 focus:outline-none focus:border-rose-600 dark:focus:border-rose-500"
                    />
                    <select
                      value={quantity}
                      onChange={(e) => setQuantity(Number(e.target.value))}
                      aria-label="Quantity"
                      className="w-full px-3 py-2 rounded-lg bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-800 font-mono text-xs text-zinc-950 dark:text-white focus:outline-none focus:border-rose-600 dark:focus:border-rose-500"
                    >
                      {[1, 2, 3, 4, 5].map((q) => (
                        <option key={q} value={q}>
                          Qty: {q} ({q * HOODIE_UNIT_PRICE}৳)
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="relative">
                    <Mail className="w-3.5 h-3.5 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="Email Address (for official invoice & payment updates) *"
                      className="w-full pl-8 pr-3 py-2 rounded-lg bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-800 text-xs text-zinc-950 dark:text-white placeholder:text-zinc-500 focus:outline-none focus:border-rose-600 dark:focus:border-rose-500"
                    />
                  </div>

                  <input
                    type="text"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Section / Delivery Note (optional)"
                    className="w-full px-3 py-2 rounded-lg bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-800 text-xs text-zinc-950 dark:text-white placeholder:text-zinc-500 focus:outline-none focus:border-rose-600 dark:focus:border-rose-500"
                  />

                  <div className="flex items-center justify-between px-3 py-2 rounded-lg bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-xs">
                    <span className="text-zinc-600 dark:text-zinc-400">
                      Payable Total ({quantity} × {HOODIE_UNIT_PRICE} BDT)
                    </span>
                    <span className="font-mono font-bold text-zinc-950 dark:text-white tabular-nums">
                      {estimatedTotal} Taka · Starts as Due
                    </span>
                  </div>

                  {formError && <p className="text-xs font-medium text-rose-700 dark:text-rose-400">{formError}</p>}

                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="w-full py-3 rounded-xl bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 text-white font-bold text-xs uppercase tracking-wider transition-all cursor-pointer disabled:opacity-50"
                  >
                    {isSubmitting
                      ? 'Creating Live Order Card...'
                      : `Register Hoodie Order · Size ${selectedSize} (${estimatedTotal} Taka)`}
                  </button>
                </form>
              )}
            </div>

            <div className="flex flex-col sm:flex-row gap-3">
              <a
                href={instagramUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 py-3 px-4 rounded-xl bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-900 dark:hover:bg-zinc-800 border border-zinc-300 dark:border-zinc-800 text-zinc-950 dark:text-white text-center font-bold text-xs uppercase tracking-wider inline-flex items-center justify-center gap-2 transition-colors whitespace-nowrap"
              >
                Direct Message on Instagram
                <ArrowUpRight className="w-3.5 h-3.5" />
              </a>
              <button
                type="button"
                onClick={onViewBatchmates}
                className="px-5 py-3 rounded-xl bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-900 dark:hover:bg-zinc-800 border border-zinc-300 dark:border-zinc-800 text-xs font-semibold text-zinc-900 dark:text-zinc-200 inline-flex items-center justify-center gap-2 transition-colors cursor-pointer whitespace-nowrap"
              >
                <Users className="w-3.5 h-3.5" />
                View Batchmates
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Live Hoodie Orders Roster (Instant Public Cards — No Admin Approval Needed) */}
      <div id="hoodie-orders-roster" className="space-y-6">
        <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4 pb-5 border-b border-zinc-300 dark:border-zinc-800">
          <div className="space-y-1.5">
            <p className="text-xs font-bold uppercase tracking-widest text-rose-700 dark:text-rose-400">
              Live Order Wall · Instant Verification
            </p>
            <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-zinc-950 dark:text-white">
              Registered Hoodie Orders
            </h2>
            <p className="text-xs sm:text-sm text-zinc-600 dark:text-zinc-400">
              Every hoodie registration appears here immediately with its official Order ID, payment status, and downloadable invoice.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-4 text-xs font-mono tabular-nums">
            <div>
              <span className="text-zinc-500">Orders: </span>
              <span className="font-bold text-zinc-950 dark:text-white">{rosterStats.totalOrders}</span>
            </div>
            <div>
              <span className="text-zinc-500">Hoodies: </span>
              <span className="font-bold text-zinc-950 dark:text-white">{rosterStats.totalPieces}</span>
            </div>
            <div>
              <span className="text-zinc-500">Paid: </span>
              <span className="font-bold text-emerald-700 dark:text-emerald-400">{rosterStats.paidCount}</span>
            </div>
            <div>
              <span className="text-zinc-500">Due: </span>
              <span className="font-bold text-amber-700 dark:text-amber-400">{rosterStats.dueCount}</span>
            </div>
          </div>
        </div>

        {/* Search & Payment Filter Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-zinc-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={rosterSearch}
              onChange={(e) => setRosterSearch(e.target.value)}
              placeholder="Search by Name, Roll, or Order ID (e.g. RCS-...)..."
              className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-800 text-xs text-zinc-950 dark:text-white placeholder:text-zinc-500 focus:outline-none focus:border-rose-500"
            />
          </div>

          <div className="inline-flex items-center gap-1 p-1 rounded-xl bg-zinc-100 dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-800 w-fit">
            {([
              { id: 'All', label: `All (${rosterStats.totalOrders})` },
              { id: 'Due', label: `Due · ৳${HOODIE_UNIT_PRICE} (${rosterStats.dueCount})` },
              { id: 'Paid', label: `Paid (${rosterStats.paidCount})` },
            ] as const).map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setRosterFilter(tab.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap shrink-0 transition-colors cursor-pointer ${
                  rosterFilter === tab.id
                    ? 'bg-white dark:bg-zinc-800 text-zinc-950 dark:text-white shadow-xs'
                    : 'text-zinc-600 hover:text-zinc-950 dark:text-zinc-400 dark:hover:text-white'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Public Hoodie Order Profile Cards Grid */}
        {filteredPublicOrders.length === 0 ? (
          <div className="p-10 rounded-2xl bg-white dark:bg-[#111114] border border-zinc-300 dark:border-zinc-800 text-center space-y-2">
            <ShoppingBag className="w-8 h-8 text-zinc-400 dark:text-zinc-600 mx-auto" />
            <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-200">
              {publicOrders.length === 0
                ? 'Be the first batchmate to register a hoodie order above!'
                : 'No hoodie orders match your search or payment filter.'}
            </p>
            <p className="text-xs text-zinc-600 dark:text-zinc-400">
              Your order profile card and downloadable invoice appear right here as soon as you submit the form.
            </p>
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {filteredPublicOrders.map((order, idx) => {
              const financials = getOrderFinancials(order);
              const matchedPhoto = batchmateAvatarByRoll.get(order.roll.trim().toLowerCase());
              const isHighlighted = lastOrder?.id === order.id;

              return (
                <Reveal3D key={order.id} delay={Math.min(idx * 0.04, 0.2)}>
                  <TiltStage3D maxTilt={5.5} className="h-full">
                    <article
                      className={`h-full rounded-2xl bg-white/95 dark:bg-[#111114]/95 backdrop-blur-sm border p-5 flex flex-col justify-between gap-4 shadow-sm dark:shadow-lg transition-all ${
                        isHighlighted
                          ? 'border-rose-500 ring-2 ring-rose-500/25'
                          : 'border-zinc-300 dark:border-zinc-800/90 hover:border-zinc-400 dark:hover:border-zinc-700'
                      }`}
                    >
                  <div className="space-y-4">
                    {/* Top Row: Avatar + Name + Roll + Order ID */}
                    <div className="flex items-start gap-3.5">
                      <div className="w-12 h-12 rounded-xl overflow-hidden bg-zinc-100 dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700 flex items-center justify-center shrink-0">
                        {matchedPhoto ? (
                          <img
                            src={matchedPhoto}
                            alt={order.customerName}
                            referrerPolicy="no-referrer"
                            className="w-full h-full object-cover object-top"
                          />
                        ) : (
                          <span className="text-sm font-extrabold text-rose-700 dark:text-rose-400">
                            {getInitials(order.customerName)}
                          </span>
                        )}
                      </div>

                      <div className="min-w-0 flex-1 space-y-0.5">
                        <h3 className="text-base font-bold text-zinc-950 dark:text-white truncate">
                          {order.customerName}
                        </h3>
                        <p className="text-xs text-zinc-600 dark:text-zinc-400 font-mono tabular-nums">
                          Roll {order.roll} · <span className="select-all text-rose-700 dark:text-rose-400 font-semibold">{order.id}</span>
                        </p>
                      </div>
                    </div>

                    {/* Specs & Financials Grid */}
                    <div className="grid grid-cols-3 gap-2 pt-3 border-t border-zinc-200 dark:border-zinc-800/80 text-xs">
                      <div>
                        <p className="text-[10px] uppercase tracking-wider text-zinc-500 font-semibold">Size × Qty</p>
                        <p className="font-mono font-bold text-zinc-950 dark:text-white mt-0.5 tabular-nums">
                          {order.size} × {financials.qty}
                        </p>
                      </div>
                      <div>
                        <p className="text-[10px] uppercase tracking-wider text-zinc-500 font-semibold">Amount</p>
                        <p className="font-mono font-bold text-zinc-950 dark:text-white mt-0.5 tabular-nums">
                          ৳{financials.totalAmount}
                        </p>
                      </div>
                      <div>
                        <p className="text-[10px] uppercase tracking-wider text-zinc-500 font-semibold">Payment</p>
                        <p
                          className={`font-mono font-bold mt-0.5 inline-flex items-center gap-1 tabular-nums ${
                            financials.isPaid
                              ? 'text-emerald-700 dark:text-emerald-400'
                              : 'text-amber-700 dark:text-amber-400'
                          }`}
                        >
                          {financials.isPaid ? (
                            <>
                              <CheckCircle2 className="w-3.5 h-3.5 shrink-0" /> Paid
                            </>
                          ) : (
                            <>
                              <Clock className="w-3.5 h-3.5 shrink-0" /> Due ৳{financials.dueAmount}
                            </>
                          )}
                        </p>
                      </div>
                    </div>

                    {order.notes && (
                      <p className="text-xs text-zinc-600 dark:text-zinc-400 line-clamp-2">
                        Note: {order.notes}
                      </p>
                    )}

                    {/* Clean typographic metadata strip */}
                    <div className="flex items-center justify-between text-[11px] text-zinc-500 dark:text-zinc-500">
                      <span className="font-medium text-zinc-700 dark:text-zinc-300">
                        Order: {order.status}
                      </span>
                      <span className="font-mono">{formatInvoiceDate(order.createdAt)}</span>
                    </div>
                  </div>

                  {/* Invoice Download Actions */}
                  <div className="flex items-center gap-2 pt-3 border-t border-zinc-200 dark:border-zinc-800/80">
                    <button
                      type="button"
                      onClick={() => void downloadOrderInvoicePng(order, config)}
                      className="flex-1 py-2 px-3 rounded-xl bg-rose-600 hover:bg-rose-700 dark:hover:bg-rose-500 text-white text-xs font-semibold inline-flex items-center justify-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap shrink-0"
                    >
                      <Download className="w-3.5 h-3.5" />
                      Download Invoice
                    </button>
                    <button
                      type="button"
                      onClick={() => downloadOrderInvoiceHtml(order, config)}
                      title="Download printable invoice slip"
                      className="py-2 px-3 rounded-xl bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-900 dark:hover:bg-zinc-800 border border-zinc-300 dark:border-zinc-800 text-zinc-900 dark:text-zinc-200 text-xs font-semibold inline-flex items-center justify-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap shrink-0"
                    >
                      <FileText className="w-3.5 h-3.5" />
                      Slip
                    </button>
                  </div>
                </article>
                  </TiltStage3D>
                </Reveal3D>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}
