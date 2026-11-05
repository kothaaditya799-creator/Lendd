import React from 'react';
import { TopHeader } from './TopHeader';
import { BottomNav } from './BottomNav';
import { TabType } from '../../types/navigation';

interface AppShellProps {
  children: React.ReactNode;
  activeTab: TabType;
  onSelectTab: (tab: TabType) => void;
  language: 'en' | 'te';
  onToggleLanguage: () => void;
  onOpenSettings: () => void;
  onLock?: () => void;
  isOnline?: boolean;
  isSyncing?: boolean;
  pendingCount?: number;
  onTriggerSync?: () => void;
}

export const AppShell: React.FC<AppShellProps> = ({
  children,
  activeTab,
  onSelectTab,
  language,
  onToggleLanguage,
  onOpenSettings,
  onLock,
  isOnline = true,
  isSyncing = false,
  pendingCount = 0,
  onTriggerSync,
}) => {
  return (
    <div className="flex min-h-screen justify-center bg-slate-200">
      {/* Mobile Frame Container: constrained to max 480px on desktop, 100% on phone */}
      <div className="relative flex w-full max-w-md flex-col bg-slate-50 shadow-2xl min-h-screen">
        <TopHeader
          currentLanguage={language}
          onToggleLanguage={onToggleLanguage}
          onOpenSettings={onOpenSettings}
          onLock={onLock}
          isOnline={isOnline}
          isSyncing={isSyncing}
          pendingCount={pendingCount}
          onTriggerSync={onTriggerSync}
        />

        {/* Scrollable Content View with bottom padding so Nav doesn't overlap */}
        <main className="flex-1 overflow-y-auto pb-24">
          {children}
        </main>

        <BottomNav
          activeTab={activeTab}
          onSelectTab={onSelectTab}
          language={language}
        />
      </div>
    </div>
  );
};
