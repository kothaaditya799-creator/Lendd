import React from 'react';
import { Calendar, CheckCircle2 } from 'lucide-react';

interface CollectionsPageProps {
  language: 'en' | 'te';
}

export const CollectionsPage: React.FC<CollectionsPageProps> = ({ language }) => {
  const isTe = language === 'te';

  return (
    <div className="p-4 space-y-4">
      {/* Date Header Card */}
      <div className="flex items-center justify-between bg-white rounded-xl p-3 shadow-sm border border-slate-200">
        <div className="flex items-center space-x-2">
          <Calendar className="h-5 w-5 text-brand-700" />
          <span className="text-base font-bold text-slate-800">
            {isTe ? 'ఈరోజు సేకరణలు' : "Today's Collections"}
          </span>
        </div>
        <span className="text-sm font-semibold text-slate-500 bg-slate-100 px-2.5 py-1 rounded-full">
          {new Date().toLocaleDateString(isTe ? 'te-IN' : 'en-IN', {
            day: 'numeric',
            month: 'short',
            year: 'numeric',
          })}
        </span>
      </div>

      {/* 3 Metric Cards: Target, Collected, Pending */}
      <div className="grid grid-cols-3 gap-2">
        <div className="bg-white rounded-xl p-3 shadow-sm border border-slate-200 text-center">
          <p className="text-xs font-semibold text-slate-500">
            {isTe ? 'లక్ష్యం' : 'Target'}
          </p>
          <p className="text-xl font-bold text-slate-900 mt-0.5">₹0</p>
        </div>
        <div className="bg-status-paidLight rounded-xl p-3 shadow-sm border border-emerald-200 text-center">
          <p className="text-xs font-semibold text-status-paid">
            {isTe ? 'వసూలు' : 'Collected'}
          </p>
          <p className="text-xl font-bold text-status-paid mt-0.5">₹0</p>
        </div>
        <div className="bg-status-overdueLight rounded-xl p-3 shadow-sm border border-red-200 text-center">
          <p className="text-xs font-semibold text-status-overdue">
            {isTe ? 'బాకీ' : 'Pending'}
          </p>
          <p className="text-xl font-bold text-status-overdue mt-0.5">₹0</p>
        </div>
      </div>

      {/* Diary Placeholder Container */}
      <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200 text-center space-y-3 mt-4">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-brand-50 text-brand-700">
          <CheckCircle2 className="h-8 w-8" />
        </div>
        <h3 className="text-lg font-bold text-slate-800">
          {isTe ? 'సేకరణ జాబితా సిద్ధంగా ఉంది' : 'Digital Diary Ready'}
        </h3>
        <p className="text-sm text-slate-500 leading-relaxed">
          {isTe
            ? 'ఫేజ్ 2 & 3 లో డేటాబేస్ మరియు రుణాల వివరాలు జోడించిన తర్వాత మీ రోజువారీ ఖాతాలు ఇక్కడ కనిపిస్తాయి.'
            : 'Your daily collection ledger will appear here once borrowers and active loans are configured.'}
        </p>
      </div>
    </div>
  );
};

