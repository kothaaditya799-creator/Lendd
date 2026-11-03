import React, { useState } from 'react';
import { AppShell } from './components/layout/AppShell';
import { TabType } from './types/navigation';
import { CollectionsPage } from './pages/CollectionsPage';
import { BorrowersPage } from './pages/BorrowersPage';
import { NewLoanPage } from './pages/NewLoanPage';
import { InsightsPage } from './pages/InsightsPage';
import { SettingsModal } from './components/layout/SettingsModal';
import { PinLockScreen } from './components/security/PinLockScreen';
import { useAutoLock } from './hooks/useAutoLock';
import { Shield } from 'lucide-react';

export const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<TabType>('collections');
  const [language, setLanguage] = useState<'en' | 'te'>('en');
  const [preSelectedBorrowerId, setPreSelectedBorrowerId] = useState<string | undefined>(undefined);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isChangingPin, setIsChangingPin] = useState(false);

  // Phase 6: Auto-Lock, Inactivity and Background Grace Protection
  const { isLocked, lock, unlock, isPrivacyCurtainVisible } = useAutoLock();

  const handleToggleLanguage = () => {
    setLanguage((prev) => (prev === 'en' ? 'te' : 'en'));
  };

  const handleNavigateToNewLoan = (borrowerId?: string) => {
    setPreSelectedBorrowerId(borrowerId);
    setActiveTab('new-loan');
  };

  const handleLoanCreatedSuccess = () => {
    setPreSelectedBorrowerId(undefined);
    setActiveTab('collections');
  };

  const renderCurrentView = () => {
    switch (activeTab) {
      case 'collections':
        return <CollectionsPage language={language} />;
      case 'borrowers':
        return (
          <BorrowersPage
            language={language}
            onNavigateToNewLoan={handleNavigateToNewLoan}
          />
        );
      case 'new-loan':
        return (
          <NewLoanPage
            language={language}
            preSelectedBorrowerId={preSelectedBorrowerId}
            onSuccess={handleLoanCreatedSuccess}
          />
        );
      case 'insights':
        return <InsightsPage language={language} />;
      default:
        return <CollectionsPage language={language} />;
    }
  };

  return (
    <>
      <AppShell
        activeTab={activeTab}
        onSelectTab={(tab) => {
          setPreSelectedBorrowerId(undefined);
          setActiveTab(tab);
        }}
        language={language}
        onToggleLanguage={handleToggleLanguage}
        onOpenSettings={() => setIsSettingsOpen(true)}
        onLock={lock}
        isOnline={true}
      >
        {renderCurrentView()}
      </AppShell>

      {/* Global Settings Sheet */}
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        language={language}
        onToggleLanguage={handleToggleLanguage}
        onChangePin={() => setIsChangingPin(true)}
        onLockNow={lock}
      />

      {/* Full-Screen PIN Lock Gate (App Launch & Inactivity Gate) */}
      {isLocked && (
        <PinLockScreen
          language={language}
          onUnlocked={unlock}
          mode="unlock"
        />
      )}

      {/* Change PIN Modal / Screen (Invoked from Settings) */}
      {isChangingPin && (
        <PinLockScreen
          language={language}
          onUnlocked={() => setIsChangingPin(false)}
          mode="setup"
          onClose={() => setIsChangingPin(false)}
        />
      )}

      {/* Multitasking Privacy Curtain (Protects from OS thumbnail snapshots) */}
      {isPrivacyCurtainVisible && (
        <div className="fixed inset-0 z-[100] bg-teal-950 flex flex-col items-center justify-center text-teal-200">
          <Shield className="w-16 h-16 text-teal-400 animate-pulse" />
          <p className="mt-3 font-extrabold text-sm tracking-widest uppercase">LendTrack</p>
        </div>
      )}
    </>
  );
};

export default App;
