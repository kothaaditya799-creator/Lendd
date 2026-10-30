import React, { useState } from 'react';
import { AppShell } from './components/layout/AppShell';
import { TabType } from './types/navigation';
import { CollectionsPage } from './pages/CollectionsPage';
import { BorrowersPage } from './pages/BorrowersPage';
import { NewLoanPage } from './pages/NewLoanPage';
import { InsightsPage } from './pages/InsightsPage';

export const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<TabType>('collections');
  const [language, setLanguage] = useState<'en' | 'te'>('en');

  const handleToggleLanguage = () => {
    setLanguage((prev) => (prev === 'en' ? 'te' : 'en'));
  };

  const renderCurrentView = () => {
    switch (activeTab) {
      case 'collections':
        return <CollectionsPage language={language} />;
      case 'borrowers':
        return <BorrowersPage language={language} />;
      case 'new-loan':
        return <NewLoanPage language={language} />;
      case 'insights':
        return <InsightsPage language={language} />;
      default:
        return <CollectionsPage language={language} />;
    }
  };

  return (
    <AppShell
      activeTab={activeTab}
      onSelectTab={setActiveTab}
      language={language}
      onToggleLanguage={handleToggleLanguage}
      isOnline={true}
    >
      {renderCurrentView()}
    </AppShell>
  );
};

export default App;

