import React, { useState } from 'react';
import { AppShell } from './components/layout/AppShell';
import { TabType } from './types/navigation';
import { CollectionsPage } from './pages/CollectionsPage';
import { BorrowersPage } from './pages/BorrowersPage';
import { NewLoanPage } from './pages/NewLoanPage';
import { InsightsPage } from './pages/InsightsPage';
import { SettingsModal } from './components/layout/SettingsModal';

export const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<TabType>('collections');
  const [language, setLanguage] = useState<'en' | 'te'>('en');
  const [preSelectedBorrowerId, setPreSelectedBorrowerId] = useState<string | undefined>(undefined);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

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
      />
    </>
  );
};

export default App;
