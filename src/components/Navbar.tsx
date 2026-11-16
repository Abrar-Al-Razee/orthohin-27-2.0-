import { useState } from 'react';
import { Menu, X } from 'lucide-react';
import type { SiteConfig, ViewMode } from '../types';

interface NavbarProps {
  activeView: ViewMode;
  siteConfig?: SiteConfig;
  onNavigate: (view: ViewMode, sectionId?: string) => void;
  onOpenRegister: () => void;
}

export function Navbar({ activeView, siteConfig, onNavigate, onOpenRegister }: NavbarProps) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const brandName = siteConfig?.brandName || 'ORTHOHIN';
  const brandAccent = siteConfig?.brandAccent ?? "'27";
  const showGallery = siteConfig?.sections?.gallery ?? true;
  const showDirectory = siteConfig?.sections?.directory ?? true;
  const showHoodieNav = siteConfig?.sections?.hoodieNav ?? true;
  const registrationOpen = siteConfig?.registrationOpen ?? true;

  const handleNav = (view: ViewMode, sectionId?: string) => {
    setMobileOpen(false);
    onNavigate(view, sectionId);
  };

  const handleRegisterClick = () => {
    setMobileOpen(false);
    onOpenRegister();
  };

  return (
    <header className="fixed top-0 inset-x-0 z-40 bg-[#070709]/90 backdrop-blur-md border-b border-zinc-800/80">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-8">
        {/* Zone 1: Single text element wordmark */}
        <button
          type="button"
          onClick={() => handleNav('home')}
          className="text-lg font-bold tracking-tight text-white whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500 rounded"
        >
          {brandName} <span className="text-rose-500">{brandAccent}</span>
        </button>

        {/* Zone 2: Concise single-line nav links */}
        <nav className="hidden md:flex items-center gap-7 text-sm font-medium text-zinc-400">
          <button
            type="button"
            onClick={() => handleNav('home')}
            className={`whitespace-nowrap shrink-0 transition-colors duration-150 cursor-pointer hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500 rounded ${
              activeView === 'home' ? 'text-white' : ''
            }`}
          >
            Home
          </button>
          {showGallery && (
            <button
              type="button"
              onClick={() => handleNav('home', 'gallery')}
              className="whitespace-nowrap shrink-0 transition-colors duration-150 cursor-pointer hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500 rounded"
            >
              Gallery
            </button>
          )}
          <button
            type="button"
            onClick={() => handleNav('batchmates')}
            className={`whitespace-nowrap shrink-0 transition-colors duration-150 cursor-pointer hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500 rounded ${
              activeView === 'batchmates' ? 'text-white' : ''
            }`}
          >
            Batchmates
          </button>
          {showHoodieNav && (
            <button
              type="button"
              onClick={() => handleNav('hoodie')}
              className={`whitespace-nowrap shrink-0 transition-colors duration-150 cursor-pointer hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500 rounded ${
                activeView === 'hoodie' ? 'text-white' : ''
              }`}
            >
              Hoodie '26-'27
            </button>
          )}
          {showDirectory && (
            <button
              type="button"
              onClick={() => handleNav('home', 'directory')}
              className="whitespace-nowrap shrink-0 transition-colors duration-150 cursor-pointer hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500 rounded"
            >
              Directory
            </button>
          )}
        </nav>

        {/* Zone 3: Primary action */}
        <div className="flex items-center gap-3 shrink-0">
          {registrationOpen && (
            <button
              type="button"
              onClick={handleRegisterClick}
              className="hidden sm:inline-flex items-center justify-center px-5 py-2.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-sm font-semibold whitespace-nowrap shrink-0 transition-colors duration-150 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-400 focus-visible:ring-offset-2 focus-visible:ring-offset-[#070709]"
            >
              Register
            </button>
          )}

          <button
            type="button"
            onClick={() => setMobileOpen((prev) => !prev)}
            className="md:hidden inline-flex items-center justify-center w-11 h-11 rounded-lg text-zinc-300 hover:text-white hover:bg-zinc-900 transition-colors cursor-pointer"
            aria-label={mobileOpen ? 'Close navigation menu' : 'Open navigation menu'}
            aria-expanded={mobileOpen}
          >
            {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Mobile Drawer */}
      {mobileOpen && (
        <div className="md:hidden bg-[#0b0b0e] border-b border-zinc-800 px-4 py-4 space-y-1">
          <button
            type="button"
            onClick={() => handleNav('home')}
            className="w-full text-left px-3 py-3 rounded-lg text-sm font-medium text-zinc-200 hover:bg-zinc-900"
          >
            Home
          </button>
          {showGallery && (
            <button
              type="button"
              onClick={() => handleNav('home', 'gallery')}
              className="w-full text-left px-3 py-3 rounded-lg text-sm font-medium text-zinc-200 hover:bg-zinc-900"
            >
              Gallery
            </button>
          )}
          <button
            type="button"
            onClick={() => handleNav('batchmates')}
            className="w-full text-left px-3 py-3 rounded-lg text-sm font-medium text-zinc-200 hover:bg-zinc-900"
          >
            Batchmates Directory
          </button>
          {showHoodieNav && (
            <button
              type="button"
              onClick={() => handleNav('hoodie')}
              className="w-full text-left px-3 py-3 rounded-lg text-sm font-medium text-zinc-200 hover:bg-zinc-900"
            >
              Hoodie '26-'27
            </button>
          )}
          {showDirectory && (
            <button
              type="button"
              onClick={() => handleNav('home', 'directory')}
              className="w-full text-left px-3 py-3 rounded-lg text-sm font-medium text-zinc-200 hover:bg-zinc-900"
            >
              Leadership Directory
            </button>
          )}
          {registrationOpen && (
            <div className="pt-2">
              <button
                type="button"
                onClick={handleRegisterClick}
                className="w-full py-3 px-4 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-sm font-semibold transition-colors"
              >
                Register Now
              </button>
            </div>
          )}
        </div>
      )}
    </header>
  );
}
