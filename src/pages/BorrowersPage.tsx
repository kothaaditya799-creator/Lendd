import React, { useState, useEffect } from 'react';
import { Users, UserPlus, Search, Phone, ShieldCheck, X } from 'lucide-react';
import { borrowerRepo } from '../db/repositories/borrowerRepo';
import { Borrower } from '../types/domain';

interface BorrowersPageProps {
  language: 'en' | 'te';
}

export const BorrowersPage: React.FC<BorrowersPageProps> = ({ language }) => {
  const isTe = language === 'te';
  const [borrowers, setBorrowers] = useState<Borrower[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form State
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [guarantorName, setGuarantorName] = useState('');
  const [guarantorPhone, setGuarantorPhone] = useState('');
  const [address, setAddress] = useState('');
  const [formError, setFormError] = useState<string | null>(null);

  // Load borrowers from Dexie.js
  const loadBorrowers = async () => {
    setIsLoading(true);
    try {
      const list = await borrowerRepo.searchBorrowers(searchQuery);
      setBorrowers(list);
    } catch (err) {
      console.error('Error loading borrowers:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadBorrowers();
  }, [searchQuery]);

  // Handle Form Submit with Zod Guard Rails & Double-Tap Prevention
  const handleAddBorrower = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return; // Prevent double-tap race

    setFormError(null);
    setIsSubmitting(true);

    try {
      // Physical sanitization: strip non-digits from phone
      const cleanPhone = phone.replace(/\D/g, '');
      const cleanGuarantorPhone = guarantorPhone.replace(/\D/g, '') || undefined;

      await borrowerRepo.addBorrower({
        id: crypto.randomUUID(),
        lenderId: 'local-lender',
        name: name.trim(),
        phone: cleanPhone,
        guarantorName: guarantorName.trim() || undefined,
        guarantorPhone: cleanGuarantorPhone,
        address: address.trim() || undefined,
        trustScore: 5.0,
        advanceBalance: 0,
        isActive: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      // Reset Form & Close Modal
      setName('');
      setPhone('');
      setGuarantorName('');
      setGuarantorPhone('');
      setAddress('');
      setIsModalOpen(false);
      await loadBorrowers();
    } catch (err: unknown) {
      if (err && typeof err === 'object' && 'errors' in err) {
        const zodErr = err as { errors: Array<{ message: string }> };
        setFormError(zodErr.errors[0]?.message || 'Invalid input');
      } else {
        setFormError(err instanceof Error ? err.message : 'Failed to save borrower');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="p-4 space-y-4">
      {/* Top Header & 56px Add Button */}
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-slate-800">
          {isTe ? 'రుణగ్రహీతల జాబితా' : 'Borrower Directory'}
        </h2>
        <button
          onClick={() => setIsModalOpen(true)}
          className="flex min-h-[56px] items-center space-x-2 bg-brand-700 hover:bg-brand-800 text-white px-4 py-2 rounded-2xl text-base font-bold shadow-md active:scale-95 transition-all"
        >
          <UserPlus className="h-5 w-5" />
          <span>{isTe ? 'కొత్త వ్యక్తి' : 'Add Borrower'}</span>
        </button>
      </div>

      {/* 56px Search Input Bar */}
      <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder={isTe ? 'పేరు లేదా ఫోన్ నంబర్ శోధించండి...' : 'Search by name or phone...'}
          className="w-full min-h-[56px] pl-12 pr-4 bg-white border border-slate-200 rounded-2xl text-base placeholder:text-slate-400 shadow-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
        />
      </div>

      {/* Borrowers List */}
      {isLoading ? (
        <div className="text-center py-8 text-base font-semibold text-slate-400">
          {isTe ? 'లోడ్ అవుతోంది...' : 'Loading...'}
        </div>
      ) : borrowers.length === 0 ? (
        <div className="bg-white rounded-2xl p-8 shadow-sm border border-slate-200 text-center space-y-3">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-brand-50 text-brand-700">
            <Users className="h-8 w-8" />
          </div>
          <h3 className="text-lg font-bold text-slate-700">
            {isTe ? 'రుణగ్రహీతలు ఎవరూ లేరు' : 'No Borrowers Found'}
          </h3>
          <p className="text-base text-slate-500">
            {isTe
              ? 'మొదటి రుణగ్రహీతను జోడించడానికి పైన ఉన్న బటన్‌ను నొక్కండి.'
              : 'Tap "Add Borrower" above to create your first borrower in the local vault.'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {borrowers.map((borrower) => (
            <div
              key={borrower.id}
              className="bg-white rounded-2xl p-4 shadow-sm border border-slate-200 flex items-center justify-between"
            >
              <div className="flex items-center space-x-3.5">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-100 text-brand-800 font-bold text-xl shadow-inner">
                  {borrower.name.charAt(0).toUpperCase()}
                </div>
                <div>
                  <h4 className="text-xl font-bold text-slate-900 leading-tight">
                    {borrower.name}
                  </h4>
                  <p className="text-base font-semibold text-slate-600 mt-1 flex items-center space-x-1">
                    <Phone className="h-4 w-4 text-brand-600 inline" />
                    <span>+91 {borrower.phone}</span>
                  </p>
                  {borrower.guarantorName && (
                    <p className="text-sm font-medium text-slate-500 mt-0.5">
                      {isTe ? 'హామీదారు: ' : 'Ref: '}
                      {borrower.guarantorName}
                    </p>
                  )}
                </div>
              </div>

              {/* Trust Score Badge */}
              <div className="flex flex-col items-end">
                <span className="flex items-center space-x-1.5 rounded-full bg-emerald-50 px-3 py-1.5 text-sm font-bold text-emerald-700 border border-emerald-200 shadow-sm">
                  <ShieldCheck className="h-4 w-4" />
                  <span>{borrower.trustScore.toFixed(1)}</span>
                </span>
                <span className="text-xs font-semibold text-slate-500 mt-1">
                  {isTe ? 'నమ్మకం స్కోర్' : 'Trust Score'}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add Borrower Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 p-0 sm:p-4 backdrop-blur-sm">
          <div className="w-full max-w-md bg-white rounded-t-3xl sm:rounded-2xl p-6 shadow-2xl space-y-4 max-h-[92vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-xl font-bold text-slate-900">
                {isTe ? 'కొత్త రుణగ్రహీత వివరాలు' : 'Add New Borrower'}
              </h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="flex h-11 w-11 items-center justify-center rounded-full text-slate-400 hover:text-slate-600 active:scale-95"
              >
                <X className="h-6 w-6" />
              </button>
            </div>

            {/* Error Banner */}
            {formError && (
              <div className="rounded-xl bg-red-50 p-3.5 text-sm font-bold text-red-700 border border-red-200">
                ⚠️ {formError}
              </div>
            )}

            <form onSubmit={handleAddBorrower} className="space-y-4">
              {/* Name Field (56px) */}
              <div>
                <label className="block text-sm font-bold uppercase tracking-wider text-slate-700 mb-1.5">
                  {isTe ? 'పూర్తి పేరు *' : 'Full Name *'}
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Ravi Kumar"
                  className="w-full min-h-[56px] px-4 bg-slate-50 border border-slate-200 rounded-2xl text-base focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
              </div>

              {/* Phone Field (56px) */}
              <div>
                <label className="block text-sm font-bold uppercase tracking-wider text-slate-700 mb-1.5">
                  {isTe ? 'మొబైల్ నంబర్ (10 అంకెలు) *' : 'Mobile Number (10 Digits) *'}
                </label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-base font-bold text-slate-400">
                    +91
                  </span>
                  <input
                    type="tel"
                    inputMode="numeric"
                    required
                    maxLength={10}
                    value={phone}
                    onChange={(e) => setPhone(e.target.value.replace(/\D/g, ''))}
                    placeholder="9876543210"
                    className="w-full min-h-[56px] pl-16 pr-4 bg-slate-50 border border-slate-200 rounded-2xl text-lg font-bold tracking-wider focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-500"
                  />
                </div>
                <p className="text-xs font-medium text-slate-500 mt-1">
                  {isTe ? '6, 7, 8 లేదా 9 తో ప్రారంభం కావాలి' : 'Must start with 6, 7, 8, or 9'}
                </p>
              </div>

              {/* Guarantor Details (56px each) */}
              <div className="pt-2 border-t border-slate-100">
                <p className="text-sm font-bold text-slate-800 mb-2">
                  {isTe ? 'హామీదారు / రిఫరెన్స్ (ఐచ్ఛికం)' : 'Guarantor / Reference (Optional)'}
                </p>
                <div className="space-y-2">
                  <input
                    type="text"
                    value={guarantorName}
                    onChange={(e) => setGuarantorName(e.target.value)}
                    placeholder={isTe ? 'హామీదారు పేరు' : 'Guarantor Name'}
                    className="w-full min-h-[56px] px-4 bg-slate-50 border border-slate-200 rounded-2xl text-base focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-500"
                  />
                  <input
                    type="tel"
                    inputMode="numeric"
                    maxLength={10}
                    value={guarantorPhone}
                    onChange={(e) => setGuarantorPhone(e.target.value.replace(/\D/g, ''))}
                    placeholder={isTe ? 'హామీదారు ఫోన్ నంబర్' : 'Guarantor 10-digit Phone'}
                    className="w-full min-h-[56px] px-4 bg-slate-50 border border-slate-200 rounded-2xl text-base font-semibold focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-500"
                  />
                </div>
              </div>

              {/* Address (Optional) */}
              <div>
                <label className="block text-sm font-bold uppercase tracking-wider text-slate-700 mb-1.5">
                  {isTe ? 'చిరునామా / ల్యాండ్‌మార్క్ (ఐచ్ఛికం)' : 'Address / Landmark (Optional)'}
                </label>
                <textarea
                  rows={2}
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder={isTe ? 'ఉదా. గాంధీ సెంటర్, దుకాణం #4' : 'e.g. Gandhi Center, Shop #4'}
                  className="w-full p-3.5 bg-slate-50 border border-slate-200 rounded-2xl text-base focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
              </div>

              {/* Submit Button (56px with isSubmitting state) */}
              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full min-h-[56px] rounded-2xl bg-brand-700 hover:bg-brand-800 disabled:bg-slate-300 text-white font-bold text-lg shadow-lg active:scale-95 transition-all"
              >
                {isSubmitting
                  ? (isTe ? 'భద్రపరుస్తోంది...' : 'Saving...')
                  : (isTe ? '✓ భద్రపరచు (Save Borrower)' : '✓ Save Borrower')}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
