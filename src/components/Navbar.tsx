import { useState } from 'react';
import { Lock, Menu, Moon, Sun, X } from 'lucide-react';
import type { SiteConfig, ViewMode } from '../types';
import type { ThemeMode } from '../utils/theme';
import { SITE_LOGO_SRC } from '../utils/storage';

interface NavbarProps {
  activeView: ViewMode;
  siteConfig?: SiteConfig;
  theme: ThemeMode;
  showAdminButton?: boolean;
  onToggleTheme: () => void;
  onNavigate: (view: ViewMode, sectionId?: string) => void;
  onOpenRegister: () => void;
}

export function Navbar({
  activeView,
  siteConfig,
  theme,
  showAdminButton = false,
  onToggleTheme,
  onNavigate,
  onOpenRegister,
}: NavbarProps) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const brandName = siteConfig?.brandName || 'ORTHOHIN';
  const brandAccent = siteConfig?.brandAccent ?? "'27";
  const showGallery = siteConfig?.sections?.gallery ?? true;
  const showDirectory = siteConfig?.sections?.directory ?? true;
  const showHoodieNav = siteConfig?.sections?.hoodieNav ?? true;
  const registrationOpen = siteConfig?.registrationOpen ?? true;
  const isDark = theme === 'dark';

  const handleNav = (view: ViewMode, sectionId?: string) => {
    setMobileOpen(false);
    onNavigate(view, sectionId);
  };

  const handleRegisterClick = () => {
    setMobileOpen(false);
    onOpenRegister();
  };

  return (
    <header className="fixed top-0 inset-x-0 z-40 bg-white/95 dark:bg-[#070709]/90 backdrop-blur-md border-b border-zinc-300 dark:border-zinc-800/80 transition-colors duration-150">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4 lg:gap-8">
        {/* Zone 1: Site logo & wordmark */}
        <button
          type="button"
          onClick={() => handleNav('home')}
          className="inline-flex items-center gap-2.5 text-lg font-bold tracking-tight text-zinc-950 dark:text-white whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500 rounded-lg"
        >
          <img
            src={SITE_LOGO_SRC}
            alt={`${brandName} ${brandAccent} logo`}
            className="w-9 h-9 rounded-lg object-cover border border-zinc-300 dark:border-zinc-700/80 shadow-xs shrink-0 bg-black"
          />
          <span>
            {brandName} <span className="text-rose-600 dark:text-rose-500">{brandAccent}</span>
          </span>
        </button>

        {/* Zone 2: Concise single-line nav links */}
        <nav className="hidden md:flex items-center gap-4 lg:gap-7 text-xs lg:text-sm font-medium text-zinc-700 dark:text-zinc-400">
          <button
            type="button"
            onClick={() => handleNav('home')}
            className={`whitespace-nowrap shrink-0 transition-colors duration-150 cursor-pointer hover:text-zinc-950 dark:hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500 rounded ${
              activeView === 'home' ? 'text-zinc-950 dark:text-white font-semibold' : ''
            }`}
          >
            Home
          </button>
          {showGallery && (
            <button
              type="button"
              onClick={() => handleNav('gallery')}
              className={`whitespace-nowrap shrink-0 transition-colors duration-150 cursor-pointer hover:text-zinc-950 dark:hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500 rounded ${
                activeView === 'gallery' ? 'text-zinc-950 dark:text-white font-semibold' : ''
              }`}
            >
              Gallery
            </button>
          )}
          <button
            type="button"
            onClick={() => handleNav('batchmates')}
            className={`whitespace-nowrap shrink-0 transition-colors duration-150 cursor-pointer hover:text-zinc-950 dark:hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500 rounded ${
              activeView === 'batchmates' ? 'text-zinc-950 dark:text-white font-semibold' : ''
            }`}
          >
            Batchmates
          </button>
          {showHoodieNav && (
            <button
              type="button"
              onClick={() => handleNav('hoodie')}
              className={`whitespace-nowrap shrink-0 transition-colors duration-150 cursor-pointer hover:text-zinc-950 dark:hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500 rounded ${
                activeView === 'hoodie' ? 'text-zinc-950 dark:text-white font-semibold' : ''
              }`}
            >
              Hoodie '26-'27
            </button>
          )}
          {showDirectory && (
            <button
              type="button"
              onClick={() => handleNav('directory')}
              className={`whitespace-nowrap shrink-0 transition-colors duration-150 cursor-pointer hover:text-zinc-950 dark:hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500 rounded ${
                activeView === 'directory' ? 'text-zinc-950 dark:text-white font-semibold' : ''
              }`}
            >
              Admin Panel
            </button>
          )}
          {showAdminButton && (
            <button
              type="button"
              onClick={() => handleNav('admin')}
              className={`inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 transition-colors duration-150 cursor-pointer hover:text-rose-700 dark:hover:text-rose-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500 rounded ${
                activeView === 'admin' ? 'text-rose-700 dark:text-rose-400 font-semibold' : 'text-zinc-800 dark:text-zinc-300'
              }`}
            >
              <Lock className="w-3.5 h-3.5 text-rose-600 dark:text-rose-500" />
              RCS Control
            </button>
          )}
        </nav>

        {/* Zone 3: Theme Switcher & Primary Action */}
        <div className="flex items-center gap-2.5 shrink-0">
          <button
            type="button"
            onClick={onToggleTheme}
            aria-label={isDark ? 'Switch to high-contrast light mode' : 'Switch to dark mode'}
            aria-pressed={!isDark}
            title={isDark ? 'Switch to High-Contrast Light Mode' : 'Switch to Dark Mode'}
            className="inline-flex items-center justify-center gap-1.5 h-10 px-3 rounded-lg bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-900 dark:hover:bg-zinc-800 border border-zinc-400 dark:border-zinc-700 text-zinc-950 dark:text-zinc-100 text-xs font-semibold whitespace-nowrap shrink-0 transition-colors duration-150 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500"
          >
            {isDark ? (
              <>
                <Sun className="w-4 h-4 text-amber-400" />
                <span className="hidden lg:inline">Light</span>
              </>
            ) : (
              <>
                <Moon className="w-4 h-4 text-zinc-900" />
                <span className="hidden lg:inline">Dark</span>
              </>
            )}
          </button>

          {registrationOpen && (
            <button
              type="button"
              onClick={handleRegisterClick}
              className="hidden sm:inline-flex items-center justify-center px-5 py-2.5 rounded-lg bg-rose-600 hover:bg-rose-700 dark:hover:bg-rose-500 text-white text-sm font-semibold whitespace-nowrap shrink-0 transition-colors duration-150 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-offset-[#070709]"
            >
              Register
            </button>
          )}

          <button
            type="button"
            onClick={() => setMobileOpen((prev) => !prev)}
            className="md:hidden inline-flex items-center justify-center w-11 h-11 rounded-lg text-zinc-800 dark:text-zinc-300 hover:text-zinc-950 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-900 transition-colors cursor-pointer"
            aria-label={mobileOpen ? 'Close navigation menu' : 'Open navigation menu'}
            aria-expanded={mobileOpen}
          >
            {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Mobile Drawer */}
      {mobileOpen && (
        <div className="md:hidden bg-white dark:bg-[#0b0b0e] border-b border-zinc-300 dark:border-zinc-800 px-4 py-4 space-y-1 shadow-lg dark:shadow-none">
          <button
            type="button"
            onClick={() => handleNav('home')}
            className={`w-full text-left px-3 py-3 rounded-lg text-sm font-medium hover:bg-zinc-100 dark:hover:bg-zinc-900 ${
              activeView === 'home' ? 'text-zinc-950 dark:text-white bg-zinc-100 dark:bg-zinc-900/60 font-semibold' : 'text-zinc-800 dark:text-zinc-200'
            }`}
          >
            Home
          </button>
          <button
            type="button"
            onClick={() => handleNav('notices')}
            className={`w-full text-left px-3 py-3 rounded-lg text-sm font-medium hover:bg-zinc-100 dark:hover:bg-zinc-900 ${
              activeView === 'notices' ? 'text-zinc-950 dark:text-white bg-zinc-100 dark:bg-zinc-900/60 font-semibold' : 'text-zinc-800 dark:text-zinc-200'
            }`}
          >
            Notices
          </button>
          <button
            type="button"
            onClick={() => handleNav('about')}
            className={`w-full text-left px-3 py-3 rounded-lg text-sm font-medium hover:bg-zinc-100 dark:hover:bg-zinc-900 ${
              activeView === 'about' ? 'text-zinc-950 dark:text-white bg-zinc-100 dark:bg-zinc-900/60 font-semibold' : 'text-zinc-800 dark:text-zinc-200'
            }`}
          >
            About
          </button>
          {showGallery && (
            <button
              type="button"
              onClick={() => handleNav('gallery')}
              className={`w-full text-left px-3 py-3 rounded-lg text-sm font-medium hover:bg-zinc-100 dark:hover:bg-zinc-900 ${
                activeView === 'gallery' ? 'text-zinc-950 dark:text-white bg-zinc-100 dark:bg-zinc-900/60 font-semibold' : 'text-zinc-800 dark:text-zinc-200'
              }`}
            >
              Gallery
            </button>
          )}
          <button
            type="button"
            onClick={() => handleNav('batchmates')}
            className={`w-full text-left px-3 py-3 rounded-lg text-sm font-medium hover:bg-zinc-100 dark:hover:bg-zinc-900 ${
              activeView === 'batchmates' ? 'text-zinc-950 dark:text-white bg-zinc-100 dark:bg-zinc-900/60 font-semibold' : 'text-zinc-800 dark:text-zinc-200'
            }`}
          >
            Batchmates
          </button>
          {showHoodieNav && (
            <button
              type="button"
              onClick={() => handleNav('hoodie')}
              className={`w-full text-left px-3 py-3 rounded-lg text-sm font-medium hover:bg-zinc-100 dark:hover:bg-zinc-900 ${
                activeView === 'hoodie' ? 'text-zinc-950 dark:text-white bg-zinc-100 dark:bg-zinc-900/60 font-semibold' : 'text-zinc-800 dark:text-zinc-200'
              }`}
            >
              Hoodie '26-'27
            </button>
          )}
          {showDirectory && (
            <button
              type="button"
              onClick={() => handleNav('directory')}
              className={`w-full text-left px-3 py-3 rounded-lg text-sm font-medium hover:bg-zinc-100 dark:hover:bg-zinc-900 ${
                activeView === 'directory' ? 'text-zinc-950 dark:text-white bg-zinc-100 dark:bg-zinc-900/60 font-semibold' : 'text-zinc-800 dark:text-zinc-200'
              }`}
            >
              Admin Panel
            </button>
          )}
          <button
            type="button"
            onClick={() => handleNav('timeline')}
            className={`w-full text-left px-3 py-3 rounded-lg text-sm font-medium hover:bg-zinc-100 dark:hover:bg-zinc-900 ${
              activeView === 'timeline' ? 'text-zinc-950 dark:text-white bg-zinc-100 dark:bg-zinc-900/60 font-semibold' : 'text-zinc-800 dark:text-zinc-200'
            }`}
          >
            Our Journey
          </button>
          {showAdminButton && (
            <button
              type="button"
              onClick={() => handleNav('admin')}
              className={`w-full text-left px-3 py-3 rounded-lg text-sm font-medium hover:bg-zinc-100 dark:hover:bg-zinc-900 flex items-center gap-2 ${
                activeView === 'admin' ? 'text-rose-700 dark:text-rose-400 bg-zinc-100 dark:bg-zinc-900/60 font-semibold' : 'text-zinc-800 dark:text-zinc-200'
              }`}
            >
              <Lock className="w-4 h-4 text-rose-600 dark:text-rose-500" />
              RCS Control
            </button>
          )}
          <button
            type="button"
            onClick={onToggleTheme}
            className="w-full text-left px-3 py-3 rounded-lg text-sm font-semibold text-zinc-900 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-900 flex items-center justify-between gap-2"
          >
            <span className="flex items-center gap-2">
              {isDark ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-zinc-900" />}
              {isDark ? 'Switch to High-Contrast Light' : 'Switch to Dark Mode'}
            </span>
          </button>
          {registrationOpen && (
            <div className="pt-2">
              <button
                type="button"
                onClick={handleRegisterClick}
                className="w-full py-3 px-4 rounded-lg bg-rose-600 hover:bg-rose-700 dark:hover:bg-rose-500 text-white text-sm font-semibold transition-colors"
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
