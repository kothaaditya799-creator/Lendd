import React from 'react';
import { Cloud, Check, ShieldCheck, Settings, Lock } from 'lucide-react';

interface TopHeaderProps {
  currentLanguage: 'en' | 'te';
  onToggleLanguage: () => void;
  onOpenSettings: () => void;
  onLock?: () => void;
  isOnline?: boolean;
}

export const TopHeader: React.FC<TopHeaderProps> = ({
  currentLanguage,
  onToggleLanguage,
  onOpenSettings,
  onLock,
  isOnline = true,
}) => {
  return (
    <header className="sticky top-0 z-30 flex items-center justify-between bg-brand-700 px-4 py-3 text-white shadow-md">
      {/* Brand Identity */}
      <div className="flex items-center space-x-2">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-800 text-brand-100 shadow-inner">
          <ShieldCheck className="h-6 w-6" />
        </div>
        <div>
          <h1 className="text-xl font-bold leading-tight tracking-tight">
            LendTrack
          </h1>
          <p className="text-xs font-medium text-brand-200">
            లేండ్‌ట్రాక్ • {currentLanguage === 'te' ? 'ఆఫ్‌లైన్ భద్రత' : 'Offline Secure'}
          </p>
        </div>
      </div>

      {/* Right Controls: Sync status + Language Pill + Settings Button */}
      <div className="flex items-center space-x-2">
        {/* Sync Indicator */}
        <div
          title={isOnline ? 'Online - Auto-syncing' : 'Offline - Saved locally'}
          className="flex items-center space-x-1 rounded-full bg-brand-800/80 px-2.5 py-1 text-xs text-brand-100"
        >
          {isOnline ? (
            <>
              <Check className="h-3.5 w-3.5 text-emerald-400 stroke-[3]" />
              <span className="hidden sm:inline">Synced</span>
            </>
          ) : (
            <>
              <Cloud className="h-3.5 w-3.5 text-amber-300" />
              <span>Offline</span>
            </>
          )}
        </div>

        {/* Language Switcher Button */}
        <button
          onClick={onToggleLanguage}
          aria-label="Toggle Language"
          className="flex h-10 min-w-[50px] items-center justify-center rounded-xl bg-brand-800 px-3 text-sm font-bold text-brand-100 shadow-sm active:scale-95 transition-transform"
        >
          {currentLanguage === 'te' ? 'EN' : 'తెలుగు'}
        </button>

        {/* Quick Lock Button */}
        {onLock && (
          <button
            onClick={onLock}
            aria-label="Lock App"
            title={currentLanguage === 'te' ? 'యాప్‌ను లాక్ చేయండి' : 'Lock App'}
            className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-800 text-brand-100 shadow-sm hover:bg-brand-900 active:scale-95 transition-transform"
          >
            <Lock className="h-4 w-4" />
          </button>
        )}

        {/* Settings Gear Button (44-56px hit target) */}
        <button
          onClick={onOpenSettings}
          aria-label="Open Settings"
          className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-800 text-brand-100 shadow-sm hover:bg-brand-900 active:scale-95 transition-transform"
        >
          <Settings className="h-5 w-5" />
        </button>
      </div>
    </header>
  );
};
