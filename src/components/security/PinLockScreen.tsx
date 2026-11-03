import React, { useState, useEffect, useCallback } from 'react';
import {
  Shield,
  ShieldCheck,
  Fingerprint,
  Delete,
  AlertTriangle,
  RotateCcw,
  Phone,
  Trash2,
  X,
} from 'lucide-react';
import {
  getSecurityConfig,
  setupInitialPin,
  verifyEnteredPin,
  emergencyWipeAllData,
  SecurityConfig,
} from '../../utils/security';
import { isBiometricsSupported, authenticateWithBiometrics } from '../../utils/biometrics';

interface PinLockScreenProps {
  language: 'en' | 'te';
  onUnlocked: () => void;
  mode?: 'unlock' | 'setup';
  onClose?: () => void; // for settings modal invocation
}

export const PinLockScreen: React.FC<PinLockScreenProps> = ({
  language,
  onUnlocked,
  mode: initialMode,
  onClose,
}) => {
  const isTe = language === 'te';
  const [config, setConfig] = useState<SecurityConfig>(() => getSecurityConfig());

  // Screen View Mode: 'unlock' | 'setup_first' | 'setup_confirm' | 'forgot_flow' | 'emergency_wipe'
  const [viewMode, setViewMode] = useState<
    'unlock' | 'setup_first' | 'setup_confirm' | 'forgot_flow' | 'emergency_wipe'
  >(() => {
    if (initialMode === 'setup' || !config.isConfigured) {
      return 'setup_first';
    }
    return 'unlock';
  });

  const [enteredPin, setEnteredPin] = useState<string>('');
  const [firstStepPin, setFirstStepPin] = useState<string>(''); // For setup confirmation
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isShaking, setIsShaking] = useState<boolean>(false);
  const [lockoutSeconds, setLockoutSeconds] = useState<number>(0);
  const [isBiometricsAvailable, setIsBiometricsAvailable] = useState<boolean>(false);

  // Recovery flow states
  const [recoveryPhoneInput, setRecoveryPhoneInput] = useState<string>('');
  const [recoveryOtpInput, setRecoveryOtpInput] = useState<string>('');
  const [isOtpSent, setIsOtpSent] = useState<boolean>(false);
  const [simulatedOtpCode, setSimulatedOtpCode] = useState<string>('');
  const [isWiping, setIsWiping] = useState<boolean>(false);

  // Check biometrics availability on mount
  useEffect(() => {
    isBiometricsSupported().then((supported) => {
      setIsBiometricsAvailable(supported && config.biometricsEnabled);
    });
  }, [config.biometricsEnabled]);

  // Handle countdown interval if locked out
  useEffect(() => {
    let interval: number | undefined;
    if (lockoutSeconds > 0) {
      interval = window.setInterval(() => {
        setLockoutSeconds((prev) => {
          if (prev <= 1) {
            setErrorMsg(null);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [lockoutSeconds]);

  // Trigger shake and clear entered PIN
  const triggerErrorShake = (msg: string) => {
    setErrorMsg(msg);
    setIsShaking(true);
    setTimeout(() => {
      setIsShaking(false);
      setEnteredPin('');
    }, 450);
  };

  // Process completed 4-digit PIN
  const handlePinComplete = useCallback(
    async (pin: string) => {
      if (viewMode === 'unlock') {
        const result = await verifyEnteredPin(pin);
        if (result.success) {
          setErrorMsg(null);
          onUnlocked();
        } else if (result.isLockedOut) {
          setLockoutSeconds(result.lockoutSeconds);
          triggerErrorShake(
            isTe
              ? `⚠️ 5 తప్పుడు ప్రయత్నాలు. దయచేసి ${result.lockoutSeconds} సెకన్లు వేచి ఉండండి.`
              : `⚠️ 5 failed attempts. Locked out for ${result.lockoutSeconds}s.`
          );
        } else {
          triggerErrorShake(
            isTe
              ? `తప్పుడు పిన్. ${result.remainingAttempts} ప్రయత్నాలు మాత్రమే మిగిలి ఉన్నాయి.`
              : `Incorrect PIN. ${result.remainingAttempts} attempts remaining.`
          );
        }
      } else if (viewMode === 'setup_first') {
        setFirstStepPin(pin);
        setEnteredPin('');
        setErrorMsg(null);
        setViewMode('setup_confirm');
      } else if (viewMode === 'setup_confirm') {
        if (pin === firstStepPin) {
          await setupInitialPin(pin, recoveryPhoneInput);
          setConfig(getSecurityConfig());
          setErrorMsg(null);
          onUnlocked();
        } else {
          triggerErrorShake(
            isTe
              ? 'పిన్‌లు సరిపోలడం లేదు. దయచేసి మళ్లీ మొదటి నుండి నమోదు చేయండి.'
              : 'PINs do not match. Please start over.'
          );
          setTimeout(() => {
            setViewMode('setup_first');
            setFirstStepPin('');
          }, 600);
        }
      }
    },
    [viewMode, firstStepPin, isTe, onUnlocked, recoveryPhoneInput]
  );

  // Keypad button press handler
  const handleDigitPress = (digit: string) => {
    if (lockoutSeconds > 0) return;
    if (enteredPin.length >= 4) return;

    const next = enteredPin + digit;
    setEnteredPin(next);

    if (next.length === 4) {
      setTimeout(() => handlePinComplete(next), 100);
    }
  };

  // Backspace handler
  const handleBackspace = () => {
    if (lockoutSeconds > 0) return;
    setEnteredPin((prev) => prev.slice(0, -1));
    setErrorMsg(null);
  };

  // Biometric unlock handler
  const handleBiometricUnlock = async () => {
    const success = await authenticateWithBiometrics(
      isTe ? 'లేండ్‌ట్రాక్ అన్‌లాక్ చేయండి' : 'Unlock LendTrack'
    );
    if (success) {
      onUnlocked();
    }
  };

  // Recovery: Send OTP handler
  const handleSendRecoveryOtp = () => {
    const cleanPhone = recoveryPhoneInput.replace(/\D/g, '');
    if (cleanPhone.length !== 10) {
      setErrorMsg(
        isTe ? 'దయచేసి సరైన 10 అంకెల మొబైల్ నంబర్ నమోదు చేయండి' : 'Please enter a valid 10-digit phone number'
      );
      return;
    }

    // Generate 6-digit verification code
    const generatedCode = Math.floor(100000 + Math.random() * 900000).toString();
    setSimulatedOtpCode(generatedCode);
    setIsOtpSent(true);
    setErrorMsg(null);
  };

  // Recovery: Verify OTP handler
  const handleVerifyOtp = () => {
    if (recoveryOtpInput.trim() === simulatedOtpCode || recoveryOtpInput.trim() === '123456') {
      // Authorized: Reset to setup new PIN
      setErrorMsg(null);
      setIsOtpSent(false);
      setEnteredPin('');
      setFirstStepPin('');
      setViewMode('setup_first');
    } else {
      setErrorMsg(isTe ? '⚠️ తప్పుడు ఓటీపీ కోడ్' : '⚠️ Incorrect OTP code');
    }
  };

  // Emergency Wipe Handler
  const handleEmergencyWipe = async () => {
    setIsWiping(true);
    try {
      await emergencyWipeAllData();
      setConfig(getSecurityConfig());
      setViewMode('setup_first');
      setEnteredPin('');
      setFirstStepPin('');
      setErrorMsg(
        isTe ? '✓ మొత్తం స్థానిక డేటా తొలగించబడింది.' : '✓ Local data wiped successfully.'
      );
    } catch {
      setErrorMsg(isTe ? 'వైప్ విఫలమైంది.' : 'Wipe failed.');
    } finally {
      setIsWiping(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-between bg-gradient-to-b from-teal-950 via-teal-900 to-slate-950 text-white p-6 select-none animate-fade-in overflow-y-auto">
      {/* Top Header & Branding */}
      <div className="flex items-center justify-between pt-2">
        <div className="flex items-center space-x-2">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-teal-800/80 border border-teal-600/50 shadow-inner">
            <ShieldCheck className="h-6 w-6 text-teal-300" />
          </div>
          <div>
            <h1 className="text-xl font-black tracking-tight leading-tight">LendTrack</h1>
            <p className="text-xs font-semibold text-teal-300">
              {isTe ? 'సూర్య ఫైనాన్స్ • లెక్కల భద్రత' : 'Surya Finance • Secure Ledger'}
            </p>
          </div>
        </div>

        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="w-10 h-10 rounded-full bg-teal-900/60 hover:bg-teal-800 text-teal-200 flex items-center justify-center transition-all"
          >
            <X size={20} />
          </button>
        )}
      </div>

      {/* Main Lock Content Area */}
      <div className="flex flex-col items-center justify-center my-auto py-4 space-y-5">
        {/* Shield Avatar with Ambient Glow */}
        <div className="relative">
          <div className="w-20 h-20 rounded-3xl bg-teal-800/60 border-2 border-teal-500/40 flex items-center justify-center text-teal-200 shadow-2xl">
            {viewMode === 'emergency_wipe' ? (
              <Trash2 size={36} className="text-rose-400" />
            ) : viewMode === 'forgot_flow' ? (
              <RotateCcw size={36} className="text-amber-400" />
            ) : (
              <Shield size={36} className="text-teal-300" />
            )}
          </div>
        </div>

        {/* Title & Instructions */}
        <div className="text-center space-y-1">
          <h2 className="text-lg sm:text-xl font-extrabold text-white tracking-tight">
            {viewMode === 'unlock'
              ? isTe
                ? 'మీ 4-అంకెల సెక్యూరిటీ పిన్ నమోదు చేయండి'
                : 'Enter 4-Digit Security PIN'
              : viewMode === 'setup_first'
              ? isTe
                ? 'కొత్త 4-అంకెల పిన్ సృష్టించండి'
                : 'Create 4-Digit Security PIN'
              : viewMode === 'setup_confirm'
              ? isTe
                ? 'పిన్‌ను నిర్ధారించండి (మళ్లీ టైప్ చేయండి)'
                : 'Confirm 4-Digit PIN'
              : viewMode === 'forgot_flow'
              ? isTe
                ? 'పిన్ రికవరీ (PIN Reset)'
                : 'Reset Forgotten PIN'
              : isTe
              ? 'ఎమర్జెన్సీ స్థానిక డేటా రీసెట్'
              : 'Emergency Data Reset'}
          </h2>
          <p className="text-xs text-teal-200/80 font-medium">
            {viewMode === 'unlock'
              ? isTe
                ? 'ఖాతాదారుల వివరాలు తెరవడానికి పిన్ టైప్ చేయండి'
                : 'Enter PIN to unlock daily ledger & cash records'
              : viewMode === 'setup_first'
              ? isTe
                ? 'ప్రతిరోజూ యాప్ తెరవడానికి ఈ పిన్ అవసరం'
                : 'You will use this PIN every time you open the app'
              : viewMode === 'setup_confirm'
              ? isTe
                ? 'ధృవీకరణ కోసం అదే పిన్ మళ్లీ నమోదు చేయండి'
                : 'Re-enter the exact same PIN to confirm'
              : viewMode === 'forgot_flow'
              ? isTe
                ? 'మొబైల్ ఓటీపీ లేదా వేలిముద్ర ద్వారా ధృవీకరించండి'
                : 'Verify via Mobile OTP or Fingerprint'
              : isTe
              ? 'మొత్తం స్థానిక డేటాను తొలగించి కొత్తగా ప్రారంభించండి'
              : 'Wipe all local data and start fresh'}
          </p>
        </div>

        {/* =========================================================================
            PIN INDICATOR DOTS (FOR UNLOCK & SETUP MODES)
            ========================================================================= */}
        {(viewMode === 'unlock' || viewMode === 'setup_first' || viewMode === 'setup_confirm') && (
          <div className="space-y-3">
            {/* 4 Animated Indicator Circles */}
            <div className={`flex items-center justify-center gap-4 py-2 ${isShaking ? 'animate-shake' : ''}`}>
              {[0, 1, 2, 3].map((index) => {
                const isFilled = enteredPin.length > index;
                return (
                  <div
                    key={index}
                    className={`w-4 h-4 rounded-full transition-all duration-200 ${
                      isFilled
                        ? 'bg-emerald-400 scale-125 shadow-lg shadow-emerald-400/50'
                        : 'border-2 border-teal-500/60 bg-teal-950/40'
                    }`}
                  />
                );
              })}
            </div>

            {/* Error or Cooldown Warning Banner */}
            {errorMsg && (
              <div className="bg-rose-500/20 border border-rose-500/40 text-rose-200 text-xs font-bold px-4 py-2 rounded-xl text-center flex items-center justify-center gap-1.5 animate-fade-in">
                <AlertTriangle size={14} className="flex-shrink-0 text-rose-400" />
                <span>{errorMsg}</span>
              </div>
            )}

            {/* Lockout Countdown Timer Banner */}
            {lockoutSeconds > 0 && (
              <div className="bg-amber-500/20 border border-amber-500/40 text-amber-200 text-xs font-black px-4 py-2 rounded-xl text-center">
                ⏱ {isTe ? 'దయచేసి వేచి ఉండండి:' : 'Please wait:'} 00:{lockoutSeconds.toString().padStart(2, '0')}s
              </div>
            )}

            {/* Subtle "Forgot PIN?" Link (Only in Unlock Mode) */}
            {viewMode === 'unlock' && (
              <div className="text-center pt-1">
                <button
                  type="button"
                  onClick={() => {
                    setErrorMsg(null);
                    setViewMode('forgot_flow');
                  }}
                  className="text-xs font-semibold text-teal-300 hover:text-white underline decoration-teal-500/50 underline-offset-4 transition-all"
                >
                  {isTe ? 'పిన్ మర్చిపోయారా? (Forgot PIN?)' : 'Forgot PIN?'}
                </button>
              </div>
            )}
          </div>
        )}

        {/* =========================================================================
            FORGOT PIN RECOVERY FLOW VIEW
            ========================================================================= */}
        {viewMode === 'forgot_flow' && (
          <div className="w-full max-w-xs space-y-4 bg-teal-900/40 p-5 rounded-3xl border border-teal-700/50 text-xs">
            {/* 1. Fast Biometric Check (if enabled) */}
            {isBiometricsAvailable && (
              <button
                type="button"
                onClick={async () => {
                  const verified = await authenticateWithBiometrics();
                  if (verified) {
                    setViewMode('setup_first');
                    setErrorMsg(null);
                  }
                }}
                className="w-full min-h-[50px] rounded-2xl bg-emerald-700 hover:bg-emerald-800 text-white font-extrabold flex items-center justify-center gap-2 active:scale-95 transition-all shadow-md"
              >
                <Fingerprint size={20} />
                <span>{isTe ? 'వేలిముద్రతో పిన్ రీసెట్ చేయండి' : 'Reset with Fingerprint'}</span>
              </button>
            )}

            {/* 2. Mobile OTP Flow */}
            <div className="space-y-3 pt-2">
              <span className="text-[11px] font-bold text-teal-300 uppercase tracking-wider block">
                {isTe ? 'మొబైల్ ఓటీపీ ద్వారా రీసెట్:' : 'Reset via Mobile OTP:'}
              </span>

              {!isOtpSent ? (
                <div className="space-y-2">
                  <div className="relative">
                    <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-teal-400 font-bold">
                      +91
                    </span>
                    <input
                      type="tel"
                      value={recoveryPhoneInput}
                      onChange={(e) => setRecoveryPhoneInput(e.target.value.replace(/\D/g, '').slice(0, 10))}
                      placeholder={isTe ? '10 అంకెల మొబైల్ నంబర్' : '10-digit mobile number'}
                      className="w-full min-h-[48px] pl-12 pr-3 bg-teal-950 border border-teal-700/60 rounded-xl text-sm font-bold text-white placeholder:text-teal-400/60 focus:outline-none focus:ring-2 focus:ring-teal-500"
                    />
                  </div>

                  <button
                    type="button"
                    onClick={handleSendRecoveryOtp}
                    className="w-full min-h-[48px] rounded-xl bg-teal-700 hover:bg-teal-600 text-white font-bold transition-all active:scale-95 flex items-center justify-center gap-1.5"
                  >
                    <Phone size={16} />
                    <span>{isTe ? 'ఓటీపీ పంపండి' : 'Send OTP'}</span>
                  </button>
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="bg-emerald-950/60 border border-emerald-500/40 p-2.5 rounded-xl text-[11px] text-emerald-200">
                    <p className="font-bold">
                      {isTe ? 'ఓటీపీ పంపబడింది!' : 'OTP Sent!'}
                    </p>
                    <p className="text-[10px] text-emerald-300 mt-0.5">
                      {isTe ? `డెమో కోడ్: ${simulatedOtpCode} (లేదా 123456)` : `Demo OTP: ${simulatedOtpCode} (or 123456)`}
                    </p>
                  </div>

                  <input
                    type="tel"
                    value={recoveryOtpInput}
                    onChange={(e) => setRecoveryOtpInput(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    placeholder={isTe ? '6-అంకెల ఓటీపీ నమోదు చేయండి' : 'Enter 6-digit OTP'}
                    className="w-full min-h-[48px] px-3 text-center tracking-widest text-lg font-black bg-teal-950 border border-teal-700/60 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-teal-500"
                  />

                  <button
                    type="button"
                    onClick={handleVerifyOtp}
                    className="w-full min-h-[48px] rounded-xl bg-emerald-700 hover:bg-emerald-600 text-white font-bold transition-all active:scale-95"
                  >
                    {isTe ? 'ధృవీకరించి పిన్ మార్చండి' : 'Verify & Set New PIN'}
                  </button>
                </div>
              )}
            </div>

            {/* Back to unlock button */}
            <div className="pt-2 flex justify-between items-center text-[11px]">
              <button
                type="button"
                onClick={() => {
                  setErrorMsg(null);
                  setViewMode('unlock');
                }}
                className="text-teal-300 hover:text-white underline"
              >
                {isTe ? '← వెనుకకు' : '← Back'}
              </button>

              <button
                type="button"
                onClick={() => {
                  setErrorMsg(null);
                  setViewMode('emergency_wipe');
                }}
                className="text-rose-400 hover:text-rose-300 font-semibold"
              >
                {isTe ? 'ఎమర్జెన్సీ రీసెట్' : 'Emergency Reset'}
              </button>
            </div>
          </div>
        )}

        {/* =========================================================================
            EMERGENCY LOCAL DATA WIPE VIEW
            ========================================================================= */}
        {viewMode === 'emergency_wipe' && (
          <div className="w-full max-w-xs space-y-4 bg-rose-950/40 p-5 rounded-3xl border border-rose-800/60 text-xs">
            <div className="text-center space-y-1">
              <h3 className="font-extrabold text-sm text-rose-300">
                {isTe ? 'హెచ్చరిక: మొత్తం డేటా తొలగించబడుతుంది' : 'Caution: Wipe All Local Data'}
              </h3>
              <p className="text-[11px] text-rose-200/80 leading-relaxed">
                {isTe
                  ? 'మీ పిన్ మరియు రికవరీ వివరాలు అన్నీ పోయినట్లయితే, యాప్‌ను కొత్తగా రీసెట్ చేయడానికి ఇది ఉపయోగపడుతుంది. ఈ చర్యను వెనక్కి తీసుకోలేరు.'
                  : 'If you have lost all access, this completely wipes local records so you can start fresh. This cannot be undone.'}
              </p>
            </div>

            <button
              type="button"
              disabled={isWiping}
              onClick={handleEmergencyWipe}
              className="w-full min-h-[50px] rounded-2xl bg-rose-700 hover:bg-rose-800 text-white font-extrabold flex items-center justify-center gap-2 active:scale-95 shadow-lg"
            >
              <Trash2 size={18} />
              <span>{isWiping ? (isTe ? 'వైప్ చేస్తోంది...' : 'Wiping...') : isTe ? 'స్థానిక డేటాను రీసెట్ చేయి' : 'Wipe & Reset App'}</span>
            </button>

            <div className="text-center pt-1">
              <button
                type="button"
                onClick={() => setViewMode('unlock')}
                className="text-teal-300 hover:text-white underline text-xs"
              >
                {isTe ? 'రద్దు చేయండి (Cancel)' : 'Cancel & Return'}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* =========================================================================
          CUSTOM 3x4 FIXED NUMERIC KEYPAD (ONLY FOR PIN ENTRY MODES)
          ========================================================================= */}
      {(viewMode === 'unlock' || viewMode === 'setup_first' || viewMode === 'setup_confirm') && (
        <div className="w-full max-w-xs mx-auto pb-4">
          <div className="grid grid-cols-3 gap-3">
            {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((digit) => (
              <button
                key={digit}
                type="button"
                disabled={lockoutSeconds > 0}
                onClick={() => handleDigitPress(digit.toString())}
                className="min-h-[64px] rounded-2xl bg-teal-900/60 hover:bg-teal-800/80 active:scale-95 active:bg-teal-700 border border-teal-700/50 text-2xl font-black text-white shadow-md flex items-center justify-center transition-all disabled:opacity-30 disabled:pointer-events-none"
              >
                {digit}
              </button>
            ))}

            {/* Bottom Row: [Biometrics / Empty] [0] [Backspace] */}
            {isBiometricsAvailable && viewMode === 'unlock' ? (
              <button
                type="button"
                onClick={handleBiometricUnlock}
                className="min-h-[64px] rounded-2xl bg-teal-800/80 hover:bg-teal-700 active:scale-95 border border-teal-600/60 text-emerald-300 shadow-md flex flex-col items-center justify-center gap-0.5 transition-all"
                title={isTe ? 'వేలిముద్రతో అన్‌లాక్' : 'Biometric Unlock'}
              >
                <Fingerprint size={24} />
                <span className="text-[10px] font-bold uppercase">{isTe ? 'వేలిముద్ర' : 'Touch'}</span>
              </button>
            ) : (
              <div className="min-h-[64px]" />
            )}

            <button
              type="button"
              disabled={lockoutSeconds > 0}
              onClick={() => handleDigitPress('0')}
              className="min-h-[64px] rounded-2xl bg-teal-900/60 hover:bg-teal-800/80 active:scale-95 active:bg-teal-700 border border-teal-700/50 text-2xl font-black text-white shadow-md flex items-center justify-center transition-all disabled:opacity-30 disabled:pointer-events-none"
            >
              0
            </button>

            <button
              type="button"
              disabled={lockoutSeconds > 0 || enteredPin.length === 0}
              onClick={handleBackspace}
              className="min-h-[64px] rounded-2xl bg-teal-900/60 hover:bg-teal-800/80 active:scale-95 active:bg-teal-700 border border-teal-700/50 text-teal-300 shadow-md flex items-center justify-center transition-all disabled:opacity-20 disabled:pointer-events-none"
              title="Backspace"
            >
              <Delete size={26} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
