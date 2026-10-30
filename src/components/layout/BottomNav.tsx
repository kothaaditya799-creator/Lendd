import React from 'react';
import { CalendarCheck, Users, PlusCircle, BarChart3 } from 'lucide-react';
import { TabType } from '../../types/navigation';

interface BottomNavProps {
  activeTab: TabType;
  onSelectTab: (tab: TabType) => void;
  language: 'en' | 'te';
}

export const BottomNav: React.FC<BottomNavProps> = ({
  activeTab,
  onSelectTab,
  language,
}) => {
  const tabs = [
    {
      id: 'collections' as TabType,
      labelEn: 'Collections',
      labelTe: 'సేకరణలు',
      icon: CalendarCheck,
    },
    {
      id: 'borrowers' as TabType,
      labelEn: 'Borrowers',
      labelTe: 'రుణగ్రహీతలు',
      icon: Users,
    },
    {
      id: 'new-loan' as TabType,
      labelEn: 'New Loan',
      labelTe: 'కొత్త రుణం',
      icon: PlusCircle,
      isPrimaryAction: true,
    },
    {
      id: 'insights' as TabType,
      labelEn: 'Insights',
      labelTe: 'విశ్లేషణ',
      icon: BarChart3,
    },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-30 flex justify-center bg-white border-t border-slate-200 shadow-lg">
      <div className="flex w-full max-w-md items-center justify-around px-2 py-1">
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id;
          const Icon = tab.icon;
          const label = language === 'te' ? tab.labelTe : tab.labelEn;

          if (tab.isPrimaryAction) {
            return (
              <button
                key={tab.id}
                onClick={() => onSelectTab(tab.id)}
                className="group -mt-4 flex flex-col items-center focus:outline-none"
              >
                <div
                  className={`flex h-14 w-14 items-center justify-center rounded-full shadow-lg transition-transform active:scale-95 ${
                    isActive
                      ? 'bg-brand-800 text-white ring-4 ring-brand-100'
                      : 'bg-brand-600 text-white group-hover:bg-brand-700'
                  }`}
                >
                  <Icon className="h-7 w-7" />
                </div>
                <span
                  className={`mt-1 text-xs font-semibold ${
                    isActive ? 'text-brand-700' : 'text-slate-600'
                  }`}
                >
                  {label}
                </span>
              </button>
            );
          }

          return (
            <button
              key={tab.id}
              onClick={() => onSelectTab(tab.id)}
              className={`flex min-h-[56px] min-w-[64px] flex-1 flex-col items-center justify-center py-1 transition-colors active:scale-95 ${
                isActive
                  ? 'text-brand-700'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <div className="relative">
                <Icon
                  className={`h-6 w-6 transition-transform ${
                    isActive ? 'scale-110 stroke-[2.5]' : 'stroke-2'
                  }`}
                />
                {isActive && (
                  <span className="absolute -bottom-1 left-1/2 h-1 w-4 -translate-x-1/2 rounded-full bg-brand-600" />
                )}
              </div>
              <span
                className={`mt-1 text-xs ${
                  isActive ? 'font-bold text-brand-800' : 'font-medium'
                }`}
              >
                {label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
};

