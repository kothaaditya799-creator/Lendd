import React from 'react';
import { PlusCircle, Sparkles } from 'lucide-react';

interface NewLoanPageProps {
  language: 'en' | 'te';
}

export const NewLoanPage: React.FC<NewLoanPageProps> = ({ language }) => {
  const isTe = language === 'te';

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center space-x-2">
        <PlusCircle className="h-6 w-6 text-brand-700" />
        <h2 className="text-xl font-bold text-slate-800">
          {isTe ? 'కొత్త రుణం ఇవ్వండి' : 'Create New Loan'}
        </h2>
      </div>

      {/* Preset Amount Chips Preview */}
      <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-200 space-y-4">
        <div className="flex items-center space-x-2 text-brand-700">
          <Sparkles className="h-5 w-5" />
          <span className="text-sm font-bold uppercase tracking-wider">
            {isTe ? 'శీఘ్ర ఎంపిక మొత్తం' : 'Quick Amount Chips'}
          </span>
        </div>

        <div className="grid grid-cols-2 gap-3">
          {['₹10,000', '₹20,000', '₹50,000', '₹1,00,000'].map((chip) => (
            <div
              key={chip}
              className="flex min-h-[56px] items-center justify-center rounded-xl border-2 border-brand-200 bg-brand-50/50 text-xl font-bold text-brand-800 cursor-pointer shadow-sm"
            >
              {chip}
            </div>
          ))}
        </div>

        <p className="text-xs text-slate-400 text-center pt-2">
          {isTe
            ? 'DF & SP షెడ్యూల్ కాలిక్యులేటర్ ఫేజ్ 3 లో జోడించబడుతుంది.'
            : 'DF and SP schedule calculation engine will be wired in Phase 3.'}
        </p>
      </div>
    </div>
  );
};

