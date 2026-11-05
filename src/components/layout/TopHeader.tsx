import React from 'react';
import { Cloud, Check, ShieldCheck, Settings, Lock, RefreshCw, CloudOff } from 'lucide-react';

interface TopHeaderProps {
  currentLanguage: 'en' | 'te';
  onToggleLanguage: () => void;
  onOpenSettings: () => void;
  onLock?: () => void;
  isOnline?: boolean;
  isSyncing?: boolean;
  pendingCount?: number;
  onTriggerSync?: () => void;
}

export const TopHeader: React.FC<TopHeaderProps> = ({
  currentLanguage,
  onToggleLanguage,
  onOpenSettings,
  onLock,
  isOnline = true,
  isSyncing = false,
  pendingCount = 0,
  onTriggerSync,
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
      <div className="flex items-center space-x-1.5">
        {/* Sync Status Badge (Interactive, min 44px hit target) */}
        <button
          type="button"
          onClick={onTriggerSync}
          disabled={isSyncing || (!isOnline && pendingCount === 0)}
          title={
            isSyncing
              ? currentLanguage === 'te' ? 'క్లౌడ్‌తో సింక్ అవుతోంది...' : 'Syncing with cloud...'
              : !isOnline
              ? currentLanguage === 'te' ? `ఆఫ్‌లైన్ (${pendingCount} మార్పులు నిల్వ ఉన్నాయి)` : `Offline (${pendingCount} pending)`
              : pendingCount > 0
              ? currentLanguage === 'te' ? `${pendingCount} మార్పులు సింక్ చేయడానికి సిద్ధంగా ఉన్నాయి` : `${pendingCount} pending sync`
              : currentLanguage === 'te' ? 'క్లౌడ్ సింక్ పూర్తయింది' : 'Synced with cloud'
          }
          className={`min-h-[44px] flex items-center space-x-1.5 rounded-xl px-2.5 py-1 text-xs font-bold transition-all active:scale-95 ${
            isSyncing
              ? 'bg-brand-900/90 text-teal-200'
              : !isOnline
              ? 'bg-amber-950/40 text-amber-300 border border-amber-500/40'
              : pendingCount > 0
              ? 'bg-teal-900 text-teal-200 border border-teal-500/40'
              : 'bg-brand-800/80 text-brand-100'
          }`}
        >
          {isSyncing ? (
            <>
              <RefreshCw className="h-3.5 w-3.5 animate-spin text-teal-300" />
              <span className="text-[11px] font-extrabold">{currentLanguage === 'te' ? 'సింక్...' : 'Syncing'}</span>
            </>
          ) : !isOnline ? (
            <>
              <CloudOff className="h-3.5 w-3.5 text-amber-300" />
              <span className="text-[11px] font-extrabold">
                {currentLanguage === 'te' ? 'ఆఫ్‌లైన్' : 'Offline'}
                {pendingCount > 0 ? ` (${pendingCount})` : ''}
              </span>
            </>
          ) : pendingCount > 0 ? (
            <>
              <Cloud className="h-3.5 w-3.5 text-teal-300" />
              <span className="text-[11px] font-extrabold">{pendingCount}</span>
            </>
          ) : (
            <>
              <Check className="h-3.5 w-3.5 text-emerald-400 stroke-[3]" />
              <span className="hidden sm:inline text-[11px] font-extrabold">{currentLanguage === 'te' ? 'సింక్' : 'Synced'}</span>
            </>
          )}
        </button>

        {/* Language Switcher Button (44px touch target) */}
        <button
          onClick={onToggleLanguage}
          aria-label="Toggle Language"
          className="flex min-h-[44px] min-w-[50px] items-center justify-center rounded-xl bg-brand-800 px-3 text-sm font-bold text-brand-100 shadow-sm active:scale-95 transition-transform"
        >
          {currentLanguage === 'te' ? 'EN' : 'తెలుగు'}
        </button>

        {/* Quick Lock Button (44px touch target) */}
        {onLock && (
          <button
            onClick={onLock}
            aria-label="Lock App"
            title={currentLanguage === 'te' ? 'యాప్‌ను లాక్ చేయండి' : 'Lock App'}
            className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-xl bg-brand-800 text-brand-100 shadow-sm hover:bg-brand-900 active:scale-95 transition-transform"
          >
            <Lock className="h-5 w-5" />
          </button>
        )}

        {/* Settings Gear Button (44px hit target) */}
        <button
          onClick={onOpenSettings}
          aria-label="Open Settings"
          className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-xl bg-brand-800 text-brand-100 shadow-sm hover:bg-brand-900 active:scale-95 transition-transform"
        >
          <Settings className="h-5 w-5" />
        </button>
      </div>
    </header>
  );
};
