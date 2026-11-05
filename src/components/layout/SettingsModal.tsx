import React, { useState, useEffect } from 'react';
import {
  X,
  Settings,
  Shield,
  Globe,
  Calendar,
  CheckCircle2,
  HardDrive,
  User,
  Lock,
  Fingerprint,
  Cloud,
  RefreshCw,
  Download,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { db } from '../../db/dexie';
import {
  getSecurityConfig,
  toggleBiometricsConfig,
  setAutoLockMinutesConfig,
  SecurityConfig,
} from '../../utils/security';
import { isBiometricsSupported, registerBiometricCredential } from '../../utils/biometrics';
import {
  getSupabaseConfig,
  saveSupabaseConfig,
} from '../../db/supabaseClient';
import { pushAllLocalDataToCloud } from '../../db/syncEngine';
import {
  canPromptPwaInstall,
  promptPwaInstall,
  subscribePwaInstall,
  isStandalonePwa,
} from '../../utils/pwaRegistration';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  language: 'en' | 'te';
  onToggleLanguage: () => void;
  onChangePin?: () => void;
  onLockNow?: () => void;
  isOnline?: boolean;
  isSyncing?: boolean;
  pendingCount?: number;
  lastSyncTimestamp?: number | null;
  onTriggerSync?: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  language,
  onToggleLanguage,
  onChangePin,
  onLockNow,
  isOnline = true,
  isSyncing = false,
  pendingCount = 0,
  lastSyncTimestamp = null,
  onTriggerSync,
}) => {
  const isTe = language === 'te';

  // Stats for local data inspection
  const [borrowerCount, setBorrowerCount] = useState(0);
  const [loanCount, setLoanCount] = useState(0);
  const [scheduleCount, setScheduleCount] = useState(0);

  // Settings preferences state
  const [lenderName, setLenderName] = useState('My Lending Business');
  const [defaultSkipSundays, setDefaultSkipSundays] = useState(true);
  const [isSaved, setIsSaved] = useState(false);
  const [securityConfig, setSecurityConfig] = useState<SecurityConfig>(() => getSecurityConfig());
  const [isBioSupported, setIsBioSupported] = useState(false);

  // PWA & Cloud Sync configuration state
  const [canInstallPwa, setCanInstallPwa] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);
  const [showCloudConfig, setShowCloudConfig] = useState(false);
  const [cloudUrl, setCloudUrl] = useState('');
  const [cloudAnonKey, setCloudAnonKey] = useState('');
  const [cloudSaved, setCloudSaved] = useState(false);
  const [isPushingAll, setIsPushingAll] = useState(false);
  const [pushResult, setPushResult] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setSecurityConfig(getSecurityConfig());
      isBiometricsSupported().then(setIsBioSupported);
      const cfg = getSupabaseConfig();
      if (cfg) {
        setCloudUrl(cfg.url);
        setCloudAnonKey(cfg.anonKey);
      }
      setIsStandalone(isStandalonePwa());
      setCanInstallPwa(canPromptPwaInstall());
      const unsub = subscribePwaInstall((can) => setCanInstallPwa(can));

      Promise.all([
        db.borrowers.count(),
        db.loans.count(),
        db.schedules.count(),
      ]).then(([bCount, lCount, sCount]) => {
        setBorrowerCount(bCount);
        setLoanCount(lCount);
        setScheduleCount(sCount);
      });

      return () => {
        unsub();
      };
    }
  }, [isOpen]);

  const handleSaveCloudConfig = () => {
    if (cloudUrl.trim() && cloudAnonKey.trim()) {
      saveSupabaseConfig({ url: cloudUrl.trim(), anonKey: cloudAnonKey.trim() });
      setCloudSaved(true);
      setTimeout(() => setCloudSaved(false), 2000);
      if (onTriggerSync) onTriggerSync();
    }
  };

  const handlePushAll = async () => {
    setIsPushingAll(true);
    setPushResult(null);
    try {
      const res = await pushAllLocalDataToCloud();
      if (res.success) {
        setPushResult(
          isTe
            ? `✓ మొత్తం డేటా క్లౌడ్‌లో భద్రపరచబడింది (${res.borrowersCount} ఖాతాదారులు, ${res.loansCount} రుణాలు)`
            : `✓ Pushed ${res.borrowersCount} borrowers, ${res.loansCount} loans, ${res.schedulesCount} milestones!`
        );
      } else {
        setPushResult(res.error || 'Failed to push records');
      }
    } finally {
      setIsPushingAll(false);
    }
  };

  const handleInstallClick = async () => {
    const accepted = await promptPwaInstall();
    if (accepted) {
      setCanInstallPwa(false);
    }
  };

  if (!isOpen) return null;

  const handleSavePreferences = () => {
    setIsSaved(true);
    setTimeout(() => {
      setIsSaved(false);
      onClose();
    }, 800);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 p-0 sm:p-4 backdrop-blur-sm">
      <div className="w-full max-w-md bg-white rounded-t-3xl sm:rounded-2xl p-6 shadow-2xl space-y-5 max-h-[92vh] overflow-y-auto">
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center space-x-2.5">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-50 text-brand-700">
              <Settings className="h-6 w-6" />
            </div>
            <div>
              <h3 className="text-xl font-bold text-slate-900">
                {isTe ? 'సెట్టింగ్‌లు' : 'Settings'}
              </h3>
              <p className="text-xs text-slate-500">
                {isTe ? 'ఖాతా మరియు ప్రాధాన్యతలు' : 'Preferences & Security'}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="flex h-10 w-10 items-center justify-center rounded-full text-slate-400 hover:text-slate-600 active:scale-95"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        {/* Success toast banner */}
        {isSaved && (
          <div className="rounded-xl bg-emerald-50 p-3 text-sm font-bold text-emerald-800 border border-emerald-200 flex items-center space-x-2">
            <CheckCircle2 className="h-4 w-4 text-emerald-600" />
            <span>{isTe ? 'సెట్టింగ్‌లు సేవ్ చేయబడ్డాయి!' : 'Settings saved!'}</span>
          </div>
        )}

        {/* 1. Lender Profile Section */}
        <div className="space-y-3">
          <div className="flex items-center space-x-2 text-slate-700">
            <User className="h-4 w-4 text-brand-700" />
            <h4 className="text-xs font-bold uppercase tracking-wider">
              {isTe ? 'లెండర్ వివరాలు' : 'Lender Profile'}
            </h4>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1">
              {isTe ? 'వ్యాపారం / లెండర్ పేరు' : 'Business / Lender Name'}
            </label>
            <input
              type="text"
              value={lenderName}
              onChange={(e) => setLenderName(e.target.value)}
              className="w-full min-h-[50px] px-3.5 bg-slate-50 border border-slate-200 rounded-xl text-base font-semibold text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
          </div>
        </div>

        {/* 2. Language & Display */}
        <div className="space-y-3 pt-3 border-t border-slate-100">
          <div className="flex items-center space-x-2 text-slate-700">
            <Globe className="h-4 w-4 text-brand-700" />
            <h4 className="text-xs font-bold uppercase tracking-wider">
              {isTe ? 'భాష' : 'Language'}
            </h4>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => {
                if (language !== 'te') onToggleLanguage();
              }}
              className={`min-h-[50px] rounded-xl text-sm font-bold border-2 transition-all ${
                isTe
                  ? 'border-brand-700 bg-brand-50 text-brand-800 shadow-sm'
                  : 'border-slate-200 bg-slate-50 text-slate-600'
              }`}
            >
              తెలుగు (Telugu)
            </button>

            <button
              type="button"
              onClick={() => {
                if (language !== 'en') onToggleLanguage();
              }}
              className={`min-h-[50px] rounded-xl text-sm font-bold border-2 transition-all ${
                !isTe
                  ? 'border-brand-700 bg-brand-50 text-brand-800 shadow-sm'
                  : 'border-slate-200 bg-slate-50 text-slate-600'
              }`}
            >
              English
            </button>
          </div>
        </div>

        {/* 3. Collection Rules */}
        <div className="space-y-3 pt-3 border-t border-slate-100">
          <div className="flex items-center space-x-2 text-slate-700">
            <Calendar className="h-4 w-4 text-brand-700" />
            <h4 className="text-xs font-bold uppercase tracking-wider">
              {isTe ? 'వసూలు నియమాలు' : 'Collection Rules'}
            </h4>
          </div>

          <div className="flex items-center justify-between p-3.5 bg-slate-50 rounded-xl border border-slate-200">
            <div>
              <p className="text-sm font-bold text-slate-800">
                {isTe ? 'ఆదివారం సేకరణను ఆపండి' : 'Skip Sundays by Default'}
              </p>
              <p className="text-xs text-slate-500 mt-0.5">
                {isTe
                  ? 'కొత్త రుణం ఇచ్చినప్పుడు ఆదివారాలను ఆటోమేటిక్‌గా మినహాయిస్తుంది'
                  : 'Exclude Sundays automatically when generating daily schedules'}
              </p>
            </div>
            <input
              type="checkbox"
              checked={defaultSkipSundays}
              onChange={(e) => setDefaultSkipSundays(e.target.checked)}
              className="h-6 w-6 rounded text-brand-700 focus:ring-brand-500 cursor-pointer"
            />
          </div>
        </div>

        {/* 4. Security & PIN Lock Section */}
        <div className="space-y-3 pt-3 border-t border-slate-100">
          <div className="flex items-center space-x-2 text-slate-700">
            <Lock className="h-4 w-4 text-brand-700" />
            <h4 className="text-xs font-bold uppercase tracking-wider">
              {isTe ? 'భద్రత & పిన్ లాక్' : 'Security & App Lock'}
            </h4>
          </div>

          <div className="rounded-xl bg-slate-50 p-3.5 border border-slate-200 space-y-3">
            {/* PIN Status & Change/Set Button */}
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-bold text-slate-800">
                  {isTe ? '4-అంకెల సెక్యూరిటీ పిన్' : '4-Digit Security PIN'}
                </p>
                <p className="text-xs font-semibold text-slate-500">
                  {securityConfig.isConfigured
                    ? isTe ? '✓ సక్రియంగా ఉంది (Protected)' : '✓ Active & Protected'
                    : isTe ? '⚠️ సెట్ చేయలేదు (Not Set)' : '⚠️ Not Set'}
                </p>
              </div>

              <button
                type="button"
                onClick={() => {
                  onClose();
                  onChangePin?.();
                }}
                className="px-3 min-h-[44px] rounded-xl bg-teal-50 border border-teal-200 text-teal-800 font-bold text-xs hover:bg-teal-100 active:scale-95 transition-all flex items-center justify-center"
              >
                {securityConfig.isConfigured
                  ? isTe ? 'పిన్ మార్చండి' : 'Change PIN'
                  : isTe ? 'పిన్ సెట్ చేయండి' : 'Set PIN'}
              </button>
            </div>

            {/* Biometric Toggle (if supported on hardware) */}
            {isBioSupported && (
              <div className="flex items-center justify-between pt-2 border-t border-slate-200/60">
                <div className="flex items-center gap-2">
                  <Fingerprint className="h-5 w-5 text-teal-700 flex-shrink-0" />
                  <div>
                    <p className="text-sm font-bold text-slate-800">
                      {isTe ? 'వేలిముద్ర లాక్ (Biometric)' : 'Fingerprint / Touch'}
                    </p>
                    <p className="text-xs text-slate-500">
                      {isTe ? 'టచ్ సెన్సార్‌తో వేగంగా తెరవండి' : 'Unlock quickly with fingerprint'}
                    </p>
                  </div>
                </div>

                <input
                  type="checkbox"
                  checked={securityConfig.biometricsEnabled}
                  onChange={async (e) => {
                    const willEnable = e.target.checked;
                    if (willEnable) {
                      const credId = await registerBiometricCredential();
                      if (credId) {
                        toggleBiometricsConfig(true, credId);
                      } else {
                        toggleBiometricsConfig(false);
                      }
                    } else {
                      toggleBiometricsConfig(false);
                    }
                    setSecurityConfig(getSecurityConfig());
                  }}
                  className="h-6 w-6 rounded text-brand-700 focus:ring-brand-500 cursor-pointer"
                />
              </div>
            )}

            {/* Inactivity Auto-Lock Selector */}
            <div className="pt-2 border-t border-slate-200/60 flex items-center justify-between">
              <div>
                <p className="text-sm font-bold text-slate-800">
                  {isTe ? 'ఆటో-లాక్ సమయం' : 'Auto-Lock Time'}
                </p>
                <p className="text-xs text-slate-500">
                  {isTe ? 'స్క్రీన్ తాకకపోతే లాక్ చేయండి' : 'Lock screen after inactivity'}
                </p>
              </div>

              <select
                value={securityConfig.autoLockMinutes}
                onChange={(e) => {
                  const val = parseInt(e.target.value, 10);
                  setAutoLockMinutesConfig(val);
                  setSecurityConfig(getSecurityConfig());
                }}
                className="px-2.5 min-h-[40px] rounded-xl bg-white border border-slate-200 text-xs font-bold text-slate-800 focus:ring-2 focus:ring-teal-600 focus:outline-none"
              >
                <option value={1}>1 {isTe ? 'నిమిషం' : 'min'}</option>
                <option value={2}>2 {isTe ? 'నిమిషాలు' : 'mins'}</option>
                <option value={5}>5 {isTe ? 'నిమిషాలు' : 'mins'}</option>
              </select>
            </div>

            {/* Lock Now Quick Action */}
            {securityConfig.isConfigured && onLockNow && (
              <div className="pt-2 border-t border-slate-200/60">
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onLockNow();
                  }}
                  className="w-full min-h-[46px] rounded-xl bg-slate-200 hover:bg-slate-300 active:scale-95 text-slate-800 font-bold text-xs flex items-center justify-center gap-1.5 transition-all"
                >
                  <Lock size={15} />
                  <span>{isTe ? 'ఇప్పుడే యాప్‌ను లాక్ చేయి' : 'Lock App Now'}</span>
                </button>
              </div>
            )}
          </div>
        </div>

        {/* 5. Cloud Sync & PWA Mobile App */}
        <div className="space-y-3 pt-3 border-t border-slate-100">
          <div className="flex items-center space-x-2 text-slate-700">
            <Cloud className="h-4 w-4 text-brand-700" />
            <h4 className="text-xs font-bold uppercase tracking-wider">
              {isTe ? 'క్లౌడ్ సింక్ & మొబైల్ యాప్' : 'Cloud Sync & Mobile App'}
            </h4>
          </div>

          <div className="rounded-xl bg-slate-50 p-4 border border-slate-200 space-y-3">
            {/* Live Connection & Queue State */}
            <div className="flex items-center justify-between text-xs font-semibold">
              <span className="text-slate-600">{isTe ? 'కనెక్టివిటీ స్థితి:' : 'Network Status:'}</span>
              <span className={`flex items-center gap-1 font-bold ${isOnline ? 'text-emerald-700' : 'text-amber-700'}`}>
                {isOnline ? (
                  <>
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                    <span>{isTe ? 'ఆన్‌లైన్ (కనెక్ట్ అయింది)' : 'Online (Connected)'}</span>
                  </>
                ) : (
                  <>
                    <span className="w-2 h-2 rounded-full bg-amber-500" />
                    <span>{isTe ? 'ఆఫ్‌లైన్ (లోకల్ మోడ్)' : 'Offline (Local-First)'}</span>
                  </>
                )}
              </span>
            </div>

            <div className="flex items-center justify-between text-xs font-semibold">
              <span className="text-slate-600">{isTe ? 'సింక్ బాకీ ఉన్న మార్పులు:' : 'Pending Sync Queue:'}</span>
              <span className={`font-bold ${pendingCount > 0 ? 'text-amber-700' : 'text-slate-900'}`}>
                {pendingCount} {isTe ? 'రికార్డులు' : 'items'}
              </span>
            </div>

            <div className="flex items-center justify-between text-xs font-semibold">
              <span className="text-slate-600">{isTe ? 'చివరిసారి సింక్:' : 'Last Synced:'}</span>
              <span className="font-bold text-slate-700">
                {lastSyncTimestamp
                  ? new Date(lastSyncTimestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                  : isTe ? 'ఇంకా లేదు' : 'Never'}
              </span>
            </div>

            {/* Manual Sync Trigger Button (50px min touch target) */}
            <button
              type="button"
              disabled={isSyncing || (!isOnline && pendingCount === 0)}
              onClick={onTriggerSync}
              className="w-full min-h-[50px] rounded-xl bg-teal-700 hover:bg-teal-800 disabled:opacity-50 active:scale-95 text-white font-extrabold text-xs flex items-center justify-center gap-2 shadow-sm transition-all"
            >
              <RefreshCw size={16} className={isSyncing ? 'animate-spin' : ''} />
              <span>
                {isSyncing
                  ? isTe ? 'క్లౌడ్‌తో సింక్ అవుతోంది...' : 'Syncing with cloud...'
                  : isTe ? 'ఇప్పుడే క్లౌడ్‌తో సింక్ చేయి' : 'Sync Now with Cloud'}
              </span>
            </button>

            {/* PWA Install Button (If browser supports beforeinstallprompt and not standalone) */}
            {canInstallPwa && !isStandalone && (
              <button
                type="button"
                onClick={handleInstallClick}
                className="w-full min-h-[48px] rounded-xl bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white font-extrabold text-xs flex items-center justify-center gap-2 shadow-sm transition-all"
              >
                <Download size={16} />
                <span>{isTe ? 'యాప్‌ను ఫోన్‌లో ఇన్‌స్టాల్ చేయండి' : 'Install LendTrack on Phone'}</span>
              </button>
            )}

            {/* Collapsible Supabase Cloud Configuration */}
            <div className="pt-2 border-t border-slate-200">
              <button
                type="button"
                onClick={() => setShowCloudConfig((prev) => !prev)}
                className="w-full flex items-center justify-between text-xs font-bold text-slate-600 hover:text-slate-900 py-1"
              >
                <span>{isTe ? 'క్లౌడ్ డేటాబేస్ సెట్టింగ్‌లు (Supabase)' : 'Cloud Database Settings (Supabase)'}</span>
                {showCloudConfig ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
              </button>

              {showCloudConfig && (
                <div className="pt-2 space-y-2 text-xs animate-fade-in">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 mb-1">
                      Supabase Project URL
                    </label>
                    <input
                      type="url"
                      placeholder="https://xyz.supabase.co"
                      value={cloudUrl}
                      onChange={(e) => setCloudUrl(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs text-slate-900 focus:ring-2 focus:ring-teal-500 font-mono"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 mb-1">
                      Supabase Anon / Public Key
                    </label>
                    <input
                      type="password"
                      placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
                      value={cloudAnonKey}
                      onChange={(e) => setCloudAnonKey(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs text-slate-900 focus:ring-2 focus:ring-teal-500 font-mono"
                    />
                  </div>

                  <button
                    type="button"
                    onClick={handleSaveCloudConfig}
                    className="w-full min-h-[42px] rounded-lg bg-slate-800 hover:bg-slate-900 text-white font-bold text-xs active:scale-95 transition-all mt-1"
                  >
                    {cloudSaved
                      ? isTe ? '✓ క్లౌడ్ కీలు భద్రపరచబడ్డాయి!' : '✓ Cloud Keys Saved!'
                      : isTe ? 'క్లౌడ్ కనెక్షన్‌ను భద్రపరచు' : 'Save Cloud Connection'}
                  </button>

                  {/* Initial Full Push to Cloud */}
                  <div className="pt-2 border-t border-slate-200/80">
                    <button
                      type="button"
                      disabled={isPushingAll || !cloudUrl.trim() || !cloudAnonKey.trim()}
                      onClick={handlePushAll}
                      className="w-full min-h-[42px] rounded-lg bg-teal-50 border border-teal-300 text-teal-800 hover:bg-teal-100 disabled:opacity-50 text-xs font-bold active:scale-95 transition-all flex items-center justify-center gap-1.5"
                    >
                      <Cloud size={14} className={isPushingAll ? 'animate-bounce' : ''} />
                      <span>
                        {isPushingAll
                          ? isTe ? 'అప్‌లోడ్ అవుతోంది...' : 'Pushing all records...'
                          : isTe ? 'మొత్తం స్థానిక డేటాను క్లౌడ్‌కి అప్‌లోడ్ చేయి' : 'Push All Local Records to Cloud'}
                      </span>
                    </button>
                    {pushResult && (
                      <p className="mt-1 text-[11px] font-semibold text-teal-700 text-center">
                        {pushResult}
                      </p>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* 6. Local Storage Vault Status */}
        <div className="space-y-3 pt-3 border-t border-slate-100">
          <div className="flex items-center space-x-2 text-slate-700">
            <HardDrive className="h-4 w-4 text-brand-700" />
            <h4 className="text-xs font-bold uppercase tracking-wider">
              {isTe ? 'స్థానిక డేటా నిల్వ' : 'Local Storage Vault'}
            </h4>
          </div>

          <div className="rounded-xl bg-slate-50 p-4 border border-slate-200 space-y-2">
            <div className="flex items-center justify-between text-xs font-semibold text-slate-600">
              <span>{isTe ? 'రుణగ్రహీతలు (Borrowers):' : 'Borrowers:'}</span>
              <span className="font-bold text-slate-900">{borrowerCount}</span>
            </div>
            <div className="flex items-center justify-between text-xs font-semibold text-slate-600">
              <span>{isTe ? 'క్రియాశీల రుణాలు (Loans):' : 'Loans:'}</span>
              <span className="font-bold text-slate-900">{loanCount}</span>
            </div>
            <div className="flex items-center justify-between text-xs font-semibold text-slate-600">
              <span>{isTe ? 'వాయిదాల షెడ్యూల్ (Milestones):' : 'Installment Milestones:'}</span>
              <span className="font-bold text-slate-900">{scheduleCount}</span>
            </div>
            <div className="pt-2 border-t border-slate-200/60 flex items-center justify-between text-xs text-emerald-700 font-bold">
              <span>{isTe ? 'ఆఫ్‌లైన్ భద్రత:' : 'Offline Protection:'}</span>
              <span>✓ {isTe ? 'సురక్షితం' : 'Active (IndexedDB)'}</span>
            </div>
          </div>
        </div>

        {/* 5. Security & App Version */}
        <div className="space-y-2 pt-3 border-t border-slate-100 text-center">
          <p className="text-xs font-bold text-slate-700 flex items-center justify-center space-x-1">
            <Shield className="h-3.5 w-3.5 text-brand-700" />
            <span>LendTrack v0.2.0 • లేండ్‌ట్రాక్</span>
          </p>
          <p className="text-[11px] text-slate-400">
            {isTe ? 'ఆఫ్‌లైన్-మొదటి లెండింగ్ మేనేజ్‌మెంట్' : 'Offline-First Lending Management Platform'}
          </p>
        </div>

        {/* Save Button (56px) */}
        <button
          type="button"
          onClick={handleSavePreferences}
          className="w-full min-h-[56px] rounded-2xl bg-brand-700 hover:bg-brand-800 text-white font-bold text-base shadow-lg active:scale-95 transition-all"
        >
          {isTe ? '✓ సెట్టింగ్‌లను భద్రపరచు' : '✓ Save Preferences'}
        </button>
      </div>
    </div>
  );
};
