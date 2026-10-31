import React, { useState, useEffect } from 'react';
import {
  Users,
  UserPlus,
  Search,
  Phone,
  ShieldCheck,
  X,
  MapPin,
  PlusCircle,
  UserCheck,
  Edit3,
  Trash2,
  AlertTriangle,
  Calendar,
} from 'lucide-react';
import { borrowerRepo } from '../db/repositories/borrowerRepo';
import { loanRepo } from '../db/repositories/loanRepo';
import { paymentRepo } from '../db/repositories/paymentRepo';
import { Borrower, Loan, PaymentSchedule } from '../types/domain';
import { generateUUID } from '../utils/uuid';
import { ScheduleInspectorModal } from '../components/loans/ScheduleInspectorModal';

interface BorrowersPageProps {
  language: 'en' | 'te';
  onNavigateToNewLoan?: (borrowerId?: string) => void;
}

export const BorrowersPage: React.FC<BorrowersPageProps> = ({
  language,
  onNavigateToNewLoan,
}) => {
  const isTe = language === 'te';
  const [borrowers, setBorrowers] = useState<Borrower[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  // Add Borrower Modal State
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [guarantorName, setGuarantorName] = useState('');
  const [guarantorPhone, setGuarantorPhone] = useState('');
  const [address, setAddress] = useState('');
  const [formError, setFormError] = useState<string | null>(null);

  // Selected Borrower Details Sheet State
  const [selectedBorrower, setSelectedBorrower] = useState<Borrower | null>(null);
  const [borrowerLoans, setBorrowerLoans] = useState<Loan[]>([]);
  const [isLoadingLoans, setIsLoadingLoans] = useState(false);

  // Edit Borrower Modal State
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editName, setEditName] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editGuarantorName, setEditGuarantorName] = useState('');
  const [editGuarantorPhone, setEditGuarantorPhone] = useState('');
  const [editAddress, setEditAddress] = useState('');
  const [editFormError, setEditFormError] = useState<string | null>(null);
  const [isConfirmingEdit, setIsConfirmingEdit] = useState(false);

  // Delete Borrower Modal State (2-Step Safety Gate)
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deleteCountdown, setDeleteCountdown] = useState<number>(5);
  const [isDeleting, setIsDeleting] = useState(false);

  // Reset form and close add modal
  const handleCloseAddModal = () => {
    setName('');
    setPhone('');
    setGuarantorName('');
    setGuarantorPhone('');
    setAddress('');
    setFormError(null);
    setIsSubmitting(false);
    setIsAddModalOpen(false);
  };

  // Open Borrower Details
  const handleOpenBorrowerDetails = async (borrower: Borrower) => {
    setSelectedBorrower(borrower);
    setIsLoadingLoans(true);
    try {
      const loans = await loanRepo.getLoansByBorrower(borrower.id);
      setBorrowerLoans(loans);
    } catch (err) {
      console.error('Error fetching borrower loans:', err);
      setBorrowerLoans([]);
    } finally {
      setIsLoadingLoans(false);
    }
  };

  // Schedule Inspector State for Existing Loans
  const [selectedLoanForInspector, setSelectedLoanForInspector] = useState<Loan | null>(null);
  const [inspectorSchedules, setInspectorSchedules] = useState<PaymentSchedule[]>([]);
  const [isInspectorOpen, setIsInspectorOpen] = useState(false);
  const [isLoadingInspector, setIsLoadingInspector] = useState(false);

  const handleInspectLoan = async (loan: Loan) => {
    setIsLoadingInspector(true);
    try {
      const schedules = await paymentRepo.getSchedulesByLoan(loan.id);
      setSelectedLoanForInspector(loan);
      setInspectorSchedules(schedules);
      setIsInspectorOpen(true);
    } catch (err) {
      console.error('Failed to load loan schedules:', err);
    } finally {
      setIsLoadingInspector(false);
    }
  };

  // Start Edit Mode
  const handleStartEdit = () => {
    if (!selectedBorrower) return;
    setEditName(selectedBorrower.name);
    setEditPhone(selectedBorrower.phone);
    setEditGuarantorName(selectedBorrower.guarantorName || '');
    setEditGuarantorPhone(selectedBorrower.guarantorPhone || '');
    setEditAddress(selectedBorrower.address || '');
    setEditFormError(null);
    setIsConfirmingEdit(false);
    setIsEditModalOpen(true);
  };

  // Start Delete Flow
  const handleStartDelete = () => {
    if (!selectedBorrower) return;

    // Active Debt Shield Check
    const activeDebt = borrowerLoans
      .filter((l) => l.status === 'active' && l.outstandingBalance > 0)
      .reduce((sum, l) => sum + l.outstandingBalance, 0);

    if (activeDebt > 0) {
      setDeleteError(
        isTe
          ? `ఈ వ్యక్తికి ఇంకా ₹${activeDebt.toLocaleString('en-IN')} బాకీ ఉంది. బాకీ ఉన్నప్పుడు తొలగించలేరు. ముందుగా రుణాన్ని క్లోజ్ చేయండి.`
          : `Cannot delete borrower with active debt. ${selectedBorrower.name} still owes ₹${activeDebt.toLocaleString('en-IN')}. Please close the loan first.`
      );
    } else {
      setDeleteError(null);
    }

    setDeleteCountdown(5);
    setIsDeleteModalOpen(true);
  };

  // 5-Second Countdown Timer for Nuclear Delete Gate
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    if (isDeleteModalOpen && !deleteError && deleteCountdown > 0) {
      timer = setTimeout(() => {
        setDeleteCountdown((prev) => prev - 1);
      }, 1000);
    }
    return () => clearTimeout(timer);
  }, [isDeleteModalOpen, deleteError, deleteCountdown]);

  // Execute Deletion
  const handleConfirmDelete = async () => {
    if (!selectedBorrower || isDeleting) return;
    setIsDeleting(true);

    try {
      await borrowerRepo.deleteBorrower(selectedBorrower.id);
      setIsDeleteModalOpen(false);
      setSelectedBorrower(null);
      await loadBorrowers();
    } catch (err: unknown) {
      setDeleteError(err instanceof Error ? err.message : 'Deletion failed');
    } finally {
      setIsDeleting(false);
    }
  };

  // Save Edit Changes
  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedBorrower) return;

    setEditFormError(null);

    const trimmedName = editName.trim();
    const cleanPhone = editPhone.replace(/\D/g, '');
    const cleanGuarantorPhone = editGuarantorPhone.replace(/\D/g, '') || undefined;

    if (!trimmedName || trimmedName.length < 2) {
      setEditFormError(
        isTe
          ? 'దయచేసి సరైన పేరు నమోదు చేయండి (కనీసం 2 అక్షరాలు).'
          : 'Please enter a valid name (at least 2 letters).'
      );
      return;
    }

    if (!cleanPhone || cleanPhone.length !== 10 || !/^[6-9]/.test(cleanPhone)) {
      setEditFormError(
        isTe
          ? 'చెల్లని మొబైల్ నంబర్. 10 అంకెలు ఉండాలి మరియు 6-9 తో ప్రారంభం కావాలి.'
          : 'Invalid mobile number. Must be 10 digits starting with 6-9.'
      );
      return;
    }

    if (!isConfirmingEdit) {
      // Step 1: Prompt for confirmation
      setIsConfirmingEdit(true);
      return;
    }

    // Step 2: Execute Update
    setIsSubmitting(true);
    try {
      const updated = await borrowerRepo.updateBorrower(selectedBorrower.id, {
        name: trimmedName,
        phone: cleanPhone,
        guarantorName: editGuarantorName.trim() || undefined,
        guarantorPhone: cleanGuarantorPhone,
        address: editAddress.trim() || undefined,
      });

      setSelectedBorrower(updated);
      setIsEditModalOpen(false);
      setIsConfirmingEdit(false);
      await loadBorrowers();
    } catch (err: unknown) {
      setEditFormError(err instanceof Error ? err.message : 'Update failed');
      setIsConfirmingEdit(false);
    } finally {
      setIsSubmitting(false);
    }
  };

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

  // Handle Form Submit for New Borrower
  const handleAddBorrower = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;

    setFormError(null);

    const trimmedName = name.trim();
    const cleanPhone = phone.replace(/\D/g, '');
    const cleanGuarantorPhone = guarantorPhone.replace(/\D/g, '') || undefined;

    if (!trimmedName || trimmedName.length < 2) {
      setFormError(
        isTe
          ? 'దయచేసి సరైన పేరు నమోదు చేయండి (కనీసం 2 అక్షరాలు ఉండాలి).'
          : 'Please enter a valid name (at least 2 letters).'
      );
      return;
    }

    if (!cleanPhone || cleanPhone.length !== 10 || !/^[6-9]/.test(cleanPhone)) {
      setFormError(
        isTe
          ? 'చెల్లని మొబైల్ నంబర్. నంబర్ ఖచ్చితంగా 10 అంకెలు ఉండాలి మరియు 6, 7, 8, లేదా 9 తో ప్రారంభం కావాలి.'
          : 'Invalid mobile number. It must be exactly 10 digits and start with 6, 7, 8, or 9.'
      );
      return;
    }

    setIsSubmitting(true);

    try {
      await borrowerRepo.addBorrower({
        id: generateUUID(),
        lenderId: 'local-lender',
        name: trimmedName,
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

      handleCloseAddModal();
      await loadBorrowers();
    } catch (err: unknown) {
      if (err instanceof Error) {
        if (err.message.includes('already exists')) {
          setFormError(
            isTe
              ? `ఈ మొబైల్ నంబర్ (+91 ${cleanPhone}) ఇప్పటికే నమోదు చేయబడింది.`
              : `A borrower with phone +91 ${cleanPhone} already exists.`
          );
        } else {
          setFormError(err.message);
        }
      } else {
        setFormError(isTe ? 'భద్రపరచడం విఫలమైంది.' : 'Failed to save borrower.');
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
          onClick={() => {
            setFormError(null);
            setIsAddModalOpen(true);
          }}
          className="flex min-h-[56px] items-center space-x-2 bg-brand-700 hover:bg-brand-800 text-white px-4 py-2 rounded-2xl text-base font-bold shadow-md active:scale-95 transition-all"
        >
          <UserPlus className="h-5 w-5" />
          <span>{isTe ? 'కొత్త వ్యక్తి' : 'Add Borrower'}</span>
        </button>
      </div>

      {/* Search Input Bar (56px) */}
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
              onClick={() => handleOpenBorrowerDetails(borrower)}
              className="bg-white rounded-2xl p-4 shadow-sm border border-slate-200 flex items-center justify-between cursor-pointer hover:border-brand-400 active:scale-[0.99] transition-all"
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

      {/* =========================================================================
          BORROWER DETAILS BOTTOM SHEET (WITH EDIT & DELETE ACTIONS)
          ========================================================================= */}
      {selectedBorrower && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 p-0 sm:p-4 backdrop-blur-sm">
          <div className="w-full max-w-md bg-white rounded-t-3xl sm:rounded-2xl p-6 shadow-2xl space-y-5 max-h-[92vh] overflow-y-auto">
            {/* Sheet Header */}
            <div className="flex items-start justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center space-x-3">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-100 text-brand-800 font-bold text-2xl">
                  {selectedBorrower.name.charAt(0).toUpperCase()}
                </div>
                <div>
                  <h3 className="text-2xl font-bold text-slate-900">
                    {selectedBorrower.name}
                  </h3>
                  <div className="flex items-center space-x-2 mt-0.5">
                    <span className="text-xs font-bold px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800">
                      {isTe ? 'క్రియాశీల ఖాతా' : 'Active Account'}
                    </span>
                    <span className="text-xs font-semibold text-slate-400">
                      ★ {selectedBorrower.trustScore.toFixed(1)}
                    </span>
                  </div>
                </div>
              </div>

              <button
                onClick={() => setSelectedBorrower(null)}
                className="flex h-10 w-10 items-center justify-center rounded-full text-slate-400 hover:text-slate-600 active:scale-95"
              >
                <X className="h-6 w-6" />
              </button>
            </div>

            {/* Quick Actions Row: Edit & Delete Buttons */}
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={handleStartEdit}
                className="flex min-h-[48px] items-center justify-center space-x-1.5 rounded-xl border border-slate-300 bg-slate-50 hover:bg-slate-100 text-slate-800 font-bold text-sm active:scale-95 transition-all"
              >
                <Edit3 className="h-4 w-4 text-brand-700" />
                <span>{isTe ? 'సవరించు (Edit)' : 'Edit Details'}</span>
              </button>

              <button
                onClick={handleStartDelete}
                className="flex min-h-[48px] items-center justify-center space-x-1.5 rounded-xl border border-red-200 bg-red-50 hover:bg-red-100 text-red-700 font-bold text-sm active:scale-95 transition-all"
              >
                <Trash2 className="h-4 w-4 text-red-600" />
                <span>{isTe ? 'తొలగించు (Delete)' : 'Delete Borrower'}</span>
              </button>
            </div>

            {/* Direct Call Button (56px) */}
            <a
              href={`tel:${selectedBorrower.phone}`}
              className="flex min-h-[56px] w-full items-center justify-center space-x-2 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-lg shadow-md active:scale-95 transition-all"
            >
              <Phone className="h-5 w-5" />
              <span>{isTe ? 'కాల్ చేయండి: ' : 'Call: '}+91 {selectedBorrower.phone}</span>
            </a>

            {/* Details Grid */}
            <div className="bg-slate-50 rounded-2xl p-4 border border-slate-200 space-y-3">
              {/* Guarantor Details */}
              <div className="flex items-start space-x-2.5">
                <UserCheck className="h-5 w-5 text-brand-700 shrink-0 mt-0.5" />
                <div>
                  <p className="text-xs font-bold uppercase tracking-wider text-slate-500">
                    {isTe ? 'హామీదారు / రిఫరెన్స్' : 'Guarantor / Reference'}
                  </p>
                  <p className="text-base font-bold text-slate-800">
                    {selectedBorrower.guarantorName || (isTe ? 'ఎవరూ లేరు' : 'None provided')}
                  </p>
                  {selectedBorrower.guarantorPhone && (
                    <a
                      href={`tel:${selectedBorrower.guarantorPhone}`}
                      className="text-sm font-semibold text-brand-700 hover:underline inline-block mt-0.5"
                    >
                      +91 {selectedBorrower.guarantorPhone}
                    </a>
                  )}
                </div>
              </div>

              {/* Address */}
              <div className="flex items-start space-x-2.5 pt-2 border-t border-slate-200/60">
                <MapPin className="h-5 w-5 text-brand-700 shrink-0 mt-0.5" />
                <div>
                  <p className="text-xs font-bold uppercase tracking-wider text-slate-500">
                    {isTe ? 'చిరునామా / ప్రాంతం' : 'Address / Area'}
                  </p>
                  <p className="text-sm font-semibold text-slate-800">
                    {selectedBorrower.address || (isTe ? 'నమోదు చేయలేదు' : 'Not specified')}
                  </p>
                </div>
              </div>
            </div>

            {/* Active Loans Section */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <h4 className="text-base font-bold text-slate-800">
                  {isTe ? 'రుణాల వివరాలు' : 'Loan History'}
                </h4>
                <span className="text-xs font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">
                  {borrowerLoans.length} {isTe ? 'రుణాలు' : 'loans'}
                </span>
              </div>

              {isLoadingLoans ? (
                <p className="text-sm text-slate-400 py-3 text-center">
                  {isTe ? 'రుణాలు లోడ్ అవుతున్నాయి...' : 'Loading loans...'}
                </p>
              ) : borrowerLoans.length === 0 ? (
                <div className="rounded-xl border border-dashed border-slate-200 p-4 text-center">
                  <p className="text-sm text-slate-400">
                    {isTe
                      ? 'ఈ వ్యక్తికి ప్రస్తుతానికి ఎటువంటి రుణాలు లేవు.'
                      : 'No active or historical loans for this borrower.'}
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  {borrowerLoans.map((loan) => (
                    <div
                      key={loan.id}
                      className="rounded-xl bg-slate-50 p-3 border border-slate-200 flex flex-col gap-2"
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <span className="text-xs font-bold px-2 py-0.5 rounded bg-brand-100 text-brand-800">
                            {loan.loanType === 'DF' ? 'Daily Finance' : 'Special (SP)'}
                          </span>
                          <p className="text-sm font-semibold text-slate-700 mt-1">
                            {isTe ? 'అసలు: ' : 'Principal: '}₹{loan.principalAmount.toLocaleString('en-IN')}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-xs font-bold text-slate-500 uppercase">
                            {isTe ? 'బాకీ బ్యాలెన్స్' : 'Outstanding'}
                          </p>
                          <p className="text-base font-bold text-slate-900">
                            ₹{loan.outstandingBalance.toLocaleString('en-IN')}
                          </p>
                        </div>
                      </div>

                      {/* View Milestones & Payoff Trigger */}
                      <button
                        type="button"
                        onClick={() => handleInspectLoan(loan)}
                        disabled={isLoadingInspector}
                        className="w-full min-h-[44px] py-2 px-3 rounded-xl bg-teal-50 hover:bg-teal-100 active:bg-teal-200 border border-teal-200 text-teal-900 text-xs font-bold flex items-center justify-center gap-1.5 transition-colors"
                      >
                        <Calendar size={15} className="text-teal-700" />
                        <span>{isTe ? 'వాయిదాల షెడ్యూల్ / క్లోజర్ లెక్క చూడండి' : 'View Milestones & Early Payoff'}</span>
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Action: Give New Loan to this borrower (56px) */}
            <button
              onClick={() => {
                const bId = selectedBorrower.id;
                setSelectedBorrower(null);
                if (onNavigateToNewLoan) {
                  onNavigateToNewLoan(bId);
                }
              }}
              className="flex min-h-[56px] w-full items-center justify-center space-x-2 rounded-2xl bg-brand-700 hover:bg-brand-800 text-white font-bold text-lg shadow-lg active:scale-95 transition-all"
            >
              <PlusCircle className="h-5 w-5" />
              <span>{isTe ? 'ఈ వ్యక్తికి కొత్త రుణం ఇవ్వండి' : 'Give New Loan to This Borrower'}</span>
            </button>
          </div>
        </div>
      )}

      {/* =========================================================================
          EDIT BORROWER MODAL (WITH CONFIRMATION BARRIER)
          ========================================================================= */}
      {isEditModalOpen && selectedBorrower && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 p-0 sm:p-4 backdrop-blur-sm">
          <div className="w-full max-w-md bg-white rounded-t-3xl sm:rounded-2xl p-6 shadow-2xl space-y-4 max-h-[92vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-xl font-bold text-slate-900 flex items-center space-x-2">
                <Edit3 className="h-5 w-5 text-brand-700" />
                <span>{isTe ? 'వివరాలను సవరించండి' : 'Edit Borrower Details'}</span>
              </h3>
              <button
                onClick={() => {
                  setIsEditModalOpen(false);
                  setIsConfirmingEdit(false);
                }}
                className="flex h-10 w-10 items-center justify-center rounded-full text-slate-400 hover:text-slate-600 active:scale-95"
              >
                <X className="h-6 w-6" />
              </button>
            </div>

            {/* Error Banner */}
            {editFormError && (
              <div className="rounded-2xl bg-red-50 p-4 text-sm font-bold text-red-700 border border-red-200">
                ⚠️ {editFormError}
              </div>
            )}

            {/* Confirmation Banner if in confirm step */}
            {isConfirmingEdit && (
              <div className="rounded-2xl bg-amber-50 p-4 text-sm font-bold text-amber-900 border border-amber-200 flex items-start space-x-2">
                <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <p>{isTe ? 'మార్పులను నిర్ధారించండి:' : 'Confirm Updates:'}</p>
                  <p className="text-xs font-normal text-amber-800 mt-1">
                    {isTe
                      ? `మీరు ${selectedBorrower.name} వివరాలను అప్‌డేట్ చేయాలనుకుంటున్నారా?`
                      : `Are you sure you want to save changes for ${selectedBorrower.name}?`}
                  </p>
                </div>
              </div>
            )}

            <form onSubmit={handleSaveEdit} className="space-y-4">
              {/* Name Field (56px) */}
              <div>
                <label className="block text-sm font-bold uppercase tracking-wider text-slate-700 mb-1.5">
                  {isTe ? 'పూర్తి పేరు *' : 'Full Name *'}
                </label>
                <input
                  type="text"
                  required
                  value={editName}
                  onChange={(e) => {
                    setEditName(e.target.value);
                    setIsConfirmingEdit(false);
                  }}
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
                    value={editPhone}
                    onChange={(e) => {
                      setEditPhone(e.target.value.replace(/\D/g, ''));
                      setIsConfirmingEdit(false);
                    }}
                    className="w-full min-h-[56px] pl-16 pr-4 bg-slate-50 border border-slate-200 rounded-2xl text-lg font-bold tracking-wider focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-500"
                  />
                </div>
              </div>

              {/* Guarantor Details */}
              <div className="pt-2 border-t border-slate-100 space-y-2">
                <p className="text-sm font-bold text-slate-800 mb-1">
                  {isTe ? 'హామీదారు / రిఫరెన్స్ (ఐచ్ఛికం)' : 'Guarantor / Reference (Optional)'}
                </p>
                <input
                  type="text"
                  value={editGuarantorName}
                  onChange={(e) => {
                    setEditGuarantorName(e.target.value);
                    setIsConfirmingEdit(false);
                  }}
                  placeholder={isTe ? 'హామీదారు పేరు' : 'Guarantor Name'}
                  className="w-full min-h-[56px] px-4 bg-slate-50 border border-slate-200 rounded-2xl text-base focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
                <input
                  type="tel"
                  inputMode="numeric"
                  maxLength={10}
                  value={editGuarantorPhone}
                  onChange={(e) => {
                    setEditGuarantorPhone(e.target.value.replace(/\D/g, ''));
                    setIsConfirmingEdit(false);
                  }}
                  placeholder={isTe ? 'హామీదారు 10-అంకెల ఫోన్ నంబర్' : 'Guarantor 10-digit Phone'}
                  className="w-full min-h-[56px] px-4 bg-slate-50 border border-slate-200 rounded-2xl text-base font-semibold focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
              </div>

              {/* Address */}
              <div>
                <label className="block text-sm font-bold uppercase tracking-wider text-slate-700 mb-1.5">
                  {isTe ? 'చిరునామా / ల్యాండ్‌మార్క్ (ఐచ్ఛికం)' : 'Address / Landmark (Optional)'}
                </label>
                <textarea
                  rows={2}
                  value={editAddress}
                  onChange={(e) => {
                    setEditAddress(e.target.value);
                    setIsConfirmingEdit(false);
                  }}
                  className="w-full p-3.5 bg-slate-50 border border-slate-200 rounded-2xl text-base focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
              </div>

              {/* Submit / Confirm Button */}
              <div className="flex space-x-2">
                {isConfirmingEdit && (
                  <button
                    type="button"
                    onClick={() => setIsConfirmingEdit(false)}
                    className="flex-1 min-h-[56px] rounded-2xl border border-slate-300 bg-slate-100 font-bold text-slate-700"
                  >
                    {isTe ? 'రద్దు' : 'Cancel'}
                  </button>
                )}

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className={`flex-1 min-h-[56px] rounded-2xl font-bold text-lg shadow-lg active:scale-95 transition-all text-white ${
                    isConfirmingEdit ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-brand-700 hover:bg-brand-800'
                  }`}
                >
                  {isSubmitting
                    ? isTe ? 'సేవ్ చేస్తోంది...' : 'Saving...'
                    : isConfirmingEdit
                    ? isTe ? '✓ అవును, నిర్ధారించు' : '✓ Confirm Update'
                    : isTe ? 'మార్పులను సేవ్ చేయి' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* =========================================================================
          DELETE BORROWER MODAL (2-STEP GATE + ACTIVE DEBT SHIELD)
          ========================================================================= */}
      {isDeleteModalOpen && selectedBorrower && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 p-0 sm:p-4 backdrop-blur-sm">
          <div className="w-full max-w-md bg-white rounded-t-3xl sm:rounded-2xl p-6 shadow-2xl space-y-4 max-h-[92vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-red-100 pb-3">
              <h3 className="text-xl font-bold text-red-700 flex items-center space-x-2">
                <Trash2 className="h-6 w-6 text-red-600" />
                <span>{isTe ? 'రుణగ్రహీతను తొలగించండి' : 'Delete Borrower'}</span>
              </h3>
              <button
                onClick={() => setIsDeleteModalOpen(false)}
                className="flex h-10 w-10 items-center justify-center rounded-full text-slate-400 hover:text-slate-600 active:scale-95"
              >
                <X className="h-6 w-6" />
              </button>
            </div>

            {/* CASE 1: ACTIVE DEBT SHIELD TRIGGERED (HARD BLOCK) */}
            {deleteError ? (
              <div className="space-y-4">
                <div className="rounded-2xl bg-red-50 p-4 border border-red-200 space-y-2">
                  <div className="flex items-center space-x-2 text-red-800 font-bold">
                    <AlertTriangle className="h-5 w-5 text-red-600 shrink-0" />
                    <span>{isTe ? 'తొలగించడం సాధ్యం కాదు (బాకీ ఉంది)' : 'Deletion Blocked (Active Debt)'}</span>
                  </div>
                  <p className="text-sm text-red-700 leading-relaxed">
                    {deleteError}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => setIsDeleteModalOpen(false)}
                  className="w-full min-h-[56px] rounded-2xl bg-slate-800 text-white font-bold text-base shadow-md active:scale-95"
                >
                  {isTe ? 'సరే, అర్థమైంది' : 'Understood'}
                </button>
              </div>
            ) : (
              /* CASE 2: NO DEBT -> 2-STEP NUCLEAR GATE WITH 5-SECOND COUNTDOWN */
              <div className="space-y-4">
                <div className="rounded-2xl bg-red-50 p-4 border border-red-200 space-y-2">
                  <div className="flex items-center space-x-2 text-red-800 font-bold">
                    <AlertTriangle className="h-5 w-5 text-red-600 shrink-0" />
                    <span>{isTe ? 'హెచ్చరిక: డేటా తొలగించబడుతుంది' : 'Warning: Irreversible Action'}</span>
                  </div>
                  <p className="text-sm text-red-800 leading-relaxed">
                    {isTe
                      ? `మీరు నిజంగా "${selectedBorrower.name}" ను తొలగించాలనుకుంటున్నారా? ఈ వ్యక్తి రికార్డులు ఇకపై డైరెక్టరీలో కనిపించవు.`
                      : `Are you sure you want to permanently delete "${selectedBorrower.name}"? This record will be deactivated and removed from your active directory.`}
                  </p>
                </div>

                <div className="flex space-x-2">
                  <button
                    type="button"
                    onClick={() => setIsDeleteModalOpen(false)}
                    className="flex-1 min-h-[56px] rounded-2xl border border-slate-300 bg-slate-100 font-bold text-slate-700 active:scale-95"
                  >
                    {isTe ? 'రద్దు' : 'Cancel'}
                  </button>

                  <button
                    type="button"
                    disabled={deleteCountdown > 0 || isDeleting}
                    onClick={handleConfirmDelete}
                    className={`flex-1 min-h-[56px] rounded-2xl font-bold text-base shadow-lg transition-all text-white ${
                      deleteCountdown > 0
                        ? 'bg-red-300 cursor-not-allowed'
                        : 'bg-red-600 hover:bg-red-700 active:scale-95'
                    }`}
                  >
                    {isDeleting
                      ? isTe ? 'తొలగిస్తోంది...' : 'Deleting...'
                      : deleteCountdown > 0
                      ? isTe ? `వేచి ఉండండి (${deleteCountdown}s)...` : `Wait (${deleteCountdown}s)...`
                      : isTe ? '🗑️ అవును, తొలగించు' : '🗑️ Confirm Delete'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* =========================================================================
          ADD BORROWER MODAL (WITH FRESH RESET ON EXIT)
          ========================================================================= */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 p-0 sm:p-4 backdrop-blur-sm">
          <div className="w-full max-w-md bg-white rounded-t-3xl sm:rounded-2xl p-6 shadow-2xl space-y-4 max-h-[92vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-xl font-bold text-slate-900">
                {isTe ? 'కొత్త రుణగ్రహీత వివరాలు' : 'Add New Borrower'}
              </h3>
              <button
                onClick={handleCloseAddModal}
                className="flex h-10 w-10 items-center justify-center rounded-full text-slate-400 hover:text-slate-600 active:scale-95"
              >
                <X className="h-6 w-6" />
              </button>
            </div>

            {/* Human-Friendly Error Banner */}
            {formError && (
              <div className="rounded-2xl bg-red-50 p-4 text-sm font-bold text-red-700 border border-red-200">
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
              <div className="pt-2 border-t border-slate-100 space-y-2">
                <p className="text-sm font-bold text-slate-800 mb-1">
                  {isTe ? 'హామీదారు / రిఫరెన్స్ (ఐచ్ఛికం)' : 'Guarantor / Reference (Optional)'}
                </p>
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
                  placeholder={isTe ? 'హామీదారు 10-అంకెల ఫోన్ నంబర్' : 'Guarantor 10-digit Phone'}
                  className="w-full min-h-[56px] px-4 bg-slate-50 border border-slate-200 rounded-2xl text-base font-semibold focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
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

              {/* Submit Button (56px with isSubmitting double-tap shield) */}
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
      {/* Schedule Inspector Modal for Existing Loans */}
      {selectedLoanForInspector && (
        <ScheduleInspectorModal
          isOpen={isInspectorOpen}
          onClose={() => {
            setIsInspectorOpen(false);
            setSelectedLoanForInspector(null);
          }}
          isTe={isTe}
          loanType={selectedLoanForInspector.loanType}
          schedules={inspectorSchedules}
          principalAmount={selectedLoanForInspector.principalAmount}
          totalAmount={selectedLoanForInspector.totalRepaymentAmount || selectedLoanForInspector.principalAmount}
          startDate={selectedLoanForInspector.startDate}
          endDate={selectedLoanForInspector.endDate || selectedLoanForInspector.startDate}
          skipSundays={selectedLoanForInspector.skipSundays}
          existingLoan={selectedLoanForInspector}
        />
      )}
    </div>
  );
};
