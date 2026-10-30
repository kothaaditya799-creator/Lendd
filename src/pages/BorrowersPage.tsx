import React from 'react';
import { Users, UserPlus, Search } from 'lucide-react';

interface BorrowersPageProps {
  language: 'en' | 'te';
}

export const BorrowersPage: React.FC<BorrowersPageProps> = ({ language }) => {
  const isTe = language === 'te';

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-slate-800">
          {isTe ? 'రుణగ్రహీతలు' : 'Borrower Directory'}
        </h2>
        <button className="flex items-center space-x-1 bg-brand-700 text-white px-3 py-2 rounded-xl text-sm font-semibold active:scale-95 shadow">
          <UserPlus className="h-4 w-4" />
          <span>{isTe ? 'కొత్త వ్యక్తి' : 'Add New'}</span>
        </button>
      </div>

      {/* Search Input Bar */}
      <div className="relative">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
        <input
          type="text"
          disabled
          placeholder={isTe ? 'పేరు లేదా ఫోన్ నంబర్ శోధించండి...' : 'Search by name or phone...'}
          className="w-full min-h-[50px] pl-11 pr-4 bg-white border border-slate-200 rounded-xl text-sm placeholder:text-slate-400 shadow-sm focus:outline-none"
        />
      </div>

      {/* Empty State Card */}
      <div className="bg-white rounded-2xl p-8 shadow-sm border border-slate-200 text-center space-y-3">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-slate-100 text-slate-500">
          <Users className="h-7 w-7" />
        </div>
        <h3 className="text-base font-bold text-slate-700">
          {isTe ? 'రుణగ్రహీతలు ఎవరూ లేరు' : 'No Borrowers Yet'}
        </h3>
        <p className="text-sm text-slate-400">
          {isTe
            ? 'రుణగ్రహీతల నిర్వహణ ఫేజ్ 2 లో అనుసంధానించబడుతుంది.'
            : 'Borrower management will be wired to the local Dexie store in Phase 2.'}
        </p>
      </div>
    </div>
  );
};

