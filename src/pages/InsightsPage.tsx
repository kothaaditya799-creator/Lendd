import React from 'react';
import { BarChart3, AlertTriangle } from 'lucide-react';

interface InsightsPageProps {
  language: 'en' | 'te';
}

export const InsightsPage: React.FC<InsightsPageProps> = ({ language }) => {
  const isTe = language === 'te';

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center space-x-2">
        <BarChart3 className="h-6 w-6 text-brand-700" />
        <h2 className="text-xl font-bold text-slate-800">
          {isTe ? 'తెలివైన విశ్లేషణ' : 'Decision Intelligence'}
        </h2>
      </div>

      {/* Capital Deployed Card */}
      <div className="bg-brand-800 text-white rounded-2xl p-5 shadow-md">
        <p className="text-xs uppercase font-semibold tracking-wider text-brand-200">
          {isTe ? 'మొత్తం పెట్టుబడి' : 'Total Capital Deployed'}
        </p>
        <p className="text-3xl font-extrabold mt-1">₹0</p>
        <p className="text-xs text-brand-200 mt-2">
          {isTe ? '0 క్రియాశీల రుణాలు' : '0 active loans'}
        </p>
      </div>

      {/* Leaking Buckets Warning Placeholder */}
      <div className="bg-amber-50 rounded-2xl p-4 border border-amber-200 shadow-sm space-y-2">
        <div className="flex items-center space-x-2 text-amber-800">
          <AlertTriangle className="h-5 w-5" />
          <h4 className="font-bold text-sm">
            {isTe ? 'లీకేజీల గుర్తింపు' : 'Leaking Buckets Detector'}
          </h4>
        </div>
        <p className="text-xs text-amber-700 leading-relaxed">
          {isTe
            ? 'దీర్ఘకాలికంగా పాక్షిక వసూళ్లు మాత్రమే చెల్లించే రుణగ్రహీతలను ఫేజ్ 6 లో ఆటోమేటిక్‌గా హైలైట్ చేస్తుంది.'
            : 'Automatically detects chronic under-payers masking default risk. Wired in Phase 6.'}
        </p>
      </div>
    </div>
  );
};

