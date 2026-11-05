import React, { useState, useEffect, useMemo } from 'react';
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
  History,
} from 'lucide-react';
import { borrowerRepo } from '../db/repositories/borrowerRepo';
import { loanRepo } from '../db/repositories/loanRepo';
import { paymentRepo } from '../db/repositories/paymentRepo';
import { Borrower, Loan, PaymentSchedule } from '../types/domain';
import { generateUUID } from '../utils/uuid';
import { getOrCreateLenderId } from '../utils/lenderId';
import { formatShortDate } from '../utils/dateUtils';
import { ScheduleInspectorModal } from '../components/loans/ScheduleInspectorModal';
import { Toast } from '../components/common/Toast';

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
  const [successToast, setSuccessToast] = useState<string | null>(null);

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
  const [isEditConfirmationOpen, setIsEditConfirmationOpen] = useState(false);

  // Delete Borrower Modal State (2-Step Safety Gate)
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deleteCountdown, setDeleteCountdown] = useState<number>(5);
  const [isDeleting, setIsDeleting] = useState(false);

  // Active View Mode: 'borrowers' (Directory) vs 'loans' (Loan History)
  const [activeTab, setActiveTab] = useState<'borrowers' | 'loans'>('borrowers');
  const [allLoans, setAllLoans] = useState<Loan[]>([]);
  const [isLoadingAllLoans, setIsLoadingAllLoans] = useState(false);
  const [loanSearchQuery, setLoanSearchQuery] = useState('');
  const [loanStatusFilter, setLoanStatusFilter] = useState<'all' | 'active' | 'completed'>('all');
  const [borrowerMap, setBorrowerMap] = useState<Record<string, Borrower>>({});

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
    setIsEditConfirmationOpen(false);
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
      setSuccessToast(
        isTe
          ? '✓ ఖాతాదారుడు విజయవంతంగా తొలగించబడ్డారు.'
          : '✓ Borrower deleted successfully.'
      );
      await loadBorrowers();
    } catch (err: unknown) {
      setDeleteError(err instanceof Error ? err.message : 'Deletion failed');
    } finally {
      setIsDeleting(false);
    }
  };

  // Validate and open edit confirmation pop-up card
  const handleSaveEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedBorrower) return;

    setEditFormError(null);

    const trimmedName = editName.trim();
    const cleanPhone = editPhone.replace(/\D/g, '');
    const cleanGuarantorPhone = editGuarantorPhone.replace(/\D/g, '');

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
          ? 'చెల్లని మొబైల్ నంబర్. 10 అంకెలు ఉండాలి మరియు 6, 7, 8, లేదా 9 తో ప్రారంభం కావాలి.'
          : 'Invalid mobile number. Must be exactly 10 digits starting with 6, 7, 8, or 9.'
      );
      return;
    }

    // Validate guarantor phone if entered
    if (cleanGuarantorPhone && (cleanGuarantorPhone.length !== 10 || !/^[6-9]/.test(cleanGuarantorPhone))) {
      setEditFormError(
        isTe
          ? 'హామీదారు మొబైల్ నంబర్ చెల్లదు. ఖచ్చితంగా 10 అంకెలు ఉండాలి మరియు 6, 7, 8, లేదా 9 తో ప్రారంభం కావాలి (లేదా ఖాళీగా ఉంచండి).'
          : 'Invalid guarantor phone number. Must be exactly 10 digits starting with 6-9, or leave blank.'
      );
      return;
    }

    if (cleanGuarantorPhone && cleanGuarantorPhone === cleanPhone) {
      setEditFormError(
        isTe
          ? 'హామీదారు ఫోన్ నంబర్ రుణగ్రహీత ఫోన్ నంబర్‌తో సమానంగా ఉండకూడదు.'
          : 'Guarantor phone number cannot be the same as the borrower phone number.'
      );
      return;
    }

    // Open confirmation pop-up card
    setIsEditConfirmationOpen(true);
  };

  // Execute Edit on User Confirmation
  const handleExecuteEdit = async () => {
    if (!selectedBorrower || isSubmitting) return;

    const trimmedName = editName.trim();
    const cleanPhone = editPhone.replace(/\D/g, '');
    const cleanGuarantorPhone = editGuarantorPhone.replace(/\D/g, '') || undefined;

    setIsSubmitting(true);
    try {
      await borrowerRepo.updateBorrower(selectedBorrower.id, {
        name: trimmedName,
        phone: cleanPhone,
        guarantorName: editGuarantorName.trim() || undefined,
        guarantorPhone: cleanGuarantorPhone,
        address: editAddress.trim() || undefined,
      });

      // Close all modals and return directly to the Borrower Directory
      setSelectedBorrower(null);
      setIsEditConfirmationOpen(false);
      setIsEditModalOpen(false);
      setEditName('');
      setEditPhone('');
      setEditGuarantorName('');
      setEditGuarantorPhone('');
      setEditAddress('');
      setEditFormError(null);

      // Trigger success confirmation toast
      setSuccessToast(
        isTe
          ? '✓ రుణగ్రహీత వివరాలు విజయవంతంగా మార్చబడ్డాయి!'
          : '✓ Borrower details are edited successfully!'
      );
      await loadBorrowers();
    } catch (err: unknown) {
      setIsEditConfirmationOpen(false);
      let userFriendlyMsg = isTe ? 'వివరాలు నవీకరించడం విఫలమైంది.' : 'Failed to update borrower details.';
      if (err instanceof Error) {
        if (err.message.includes('guarantorPhone') || err.message.includes('leave blank')) {
          userFriendlyMsg = isTe
            ? 'హామీదారు మొబైల్ నంబర్ చెల్లదు. ఖచ్చితంగా 10 అంకెలు ఉండాలి మరియు 6, 7, 8, లేదా 9 తో ప్రారంభం కావాలి (లేదా ఖాళీగా ఉంచండి).'
            : 'Invalid guarantor phone number. Must be 10 digits starting with 6-9, or leave blank.';
        } else if (err.message.includes('already registered') || err.message.includes('already exists')) {
          userFriendlyMsg = isTe
            ? 'ఈ మొబైల్ నంబర్ ఇప్పటికే మరొక ఖాతాదారుడికి నమోదు చేయబడింది.'
            : 'This mobile number is already registered to another borrower.';
        } else {
          try {
            const parsed = JSON.parse(err.message);
            if (Array.isArray(parsed) && parsed[0]?.message) {
              userFriendlyMsg = parsed[0].message;
            } else {
              userFriendlyMsg = err.message;
            }
          } catch {
            userFriendlyMsg = err.message;
          }
        }
      }
      setEditFormError(userFriendlyMsg);
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
      setBorrowerMap((prev) => {
        const next = { ...prev };
        for (const b of list) {
          next[b.id] = b;
        }
        return next;
      });
    } catch (err) {
      console.error('Error loading borrowers:', err);
    } finally {
      setIsLoading(false);
    }
  };

  // Load all loans and map borrowers for Global Loan History
  const loadAllLoans = async () => {
    setIsLoadingAllLoans(true);
    try {
      const [loansList, borrowersList] = await Promise.all([
        loanRepo.getAllLoansSortedByRecent(),
        borrowerRepo.getAllBorrowers(),
      ]);
      setAllLoans(loansList);
      const bMap: Record<string, Borrower> = {};
      for (const b of borrowersList) {
        bMap[b.id] = b;
      }
      setBorrowerMap(bMap);
    } catch (err) {
      console.error('Failed to load all loans history:', err);
    } finally {
      setIsLoadingAllLoans(false);
    }
  };

  useEffect(() => {
    loadBorrowers();
    loadAllLoans();
  }, [searchQuery]);

  // Filtered loans for Loan History view
  const filteredLoans = useMemo(() => {
    let list = allLoans;
    if (loanStatusFilter !== 'all') {
      list = list.filter((l) => l.status === loanStatusFilter);
    }
    const q = loanSearchQuery.trim().toLowerCase();
    if (q) {
      list = list.filter((l) => {
        const borrower = borrowerMap[l.borrowerId];
        const nameMatch = borrower?.name.toLowerCase().includes(q) || false;
        const phoneMatch = borrower?.phone.includes(q) || false;
        const typeMatch = l.loanType.toLowerCase().includes(q);
        return nameMatch || phoneMatch || typeMatch;
      });
    }
    return list;
  }, [allLoans, loanStatusFilter, loanSearchQuery, borrowerMap]);

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

    if (cleanGuarantorPhone && (cleanGuarantorPhone.length !== 10 || !/^[6-9]/.test(cleanGuarantorPhone))) {
      setFormError(
        isTe
          ? 'హామీదారు మొబైల్ నంబర్ చెల్లదు. ఖచ్చితంగా 10 అంకెలు ఉండాలి మరియు 6, 7, 8, లేదా 9 తో ప్రారంభం కావాలి (లేదా ఖాళీగా ఉంచండి).'
          : 'Invalid guarantor mobile number. It must be exactly 10 digits starting with 6, 7, 8, or 9 (or leave blank).'
      );
      return;
    }

    if (cleanGuarantorPhone && cleanGuarantorPhone === cleanPhone) {
      setFormError(
        isTe
          ? 'హామీదారు ఫోన్ నంబర్ రుణగ్రహీత ఫోన్ నంబర్‌తో సమానంగా ఉండకూడదు.'
          : 'Guarantor phone number cannot be the same as borrower phone number.'
      );
      return;
    }

    setIsSubmitting(true);

    try {
      await borrowerRepo.addBorrower({
        id: generateUUID(),
        lenderId: getOrCreateLenderId(),
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
      setSuccessToast(
        isTe
          ? '✓ ఖాతాదారుడు విజయవంతంగా జోడించబడ్డారు!'
          : '✓ Borrower added successfully!'
      );
      await loadBorrowers();
    } catch (err: unknown) {
      if (err instanceof Error) {
        if (err.message.includes('already exists') || err.message.includes('already registered')) {
          setFormError(
            isTe
              ? `ఈ మొబైల్ నంబర్ (+91 ${cleanPhone}) ఇప్పటికే నమోదు చేయబడింది.`
              : `A borrower with phone +91 ${cleanPhone} already exists.`
          );
        } else if (err.message.includes('guarantorPhone') || err.message.includes('leave blank')) {
          setFormError(
            isTe
              ? 'హామీదారు మొబైల్ నంబర్ చెల్లదు. ఖచ్చితంగా 10 అంకెలు ఉండాలి మరియు 6-9 తో ప్రారంభం కావాలి.'
              : 'Invalid guarantor phone number. Must be 10 digits starting with 6-9, or leave blank.'
          );
        } else {
          try {
            const parsed = JSON.parse(err.message);
            if (Array.isArray(parsed) && parsed[0]?.message) {
              setFormError(parsed[0].message);
            } else {
              setFormError(err.message);
            }
          } catch {
            setFormError(err.message);
          }
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
      {/* Success Notification Toast */}
      <Toast message={successToast} onClose={() => setSuccessToast(null)} />

      {/* Top Header & 56px Add Button */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-black text-slate-900 leading-tight">
            {activeTab === 'borrowers'
              ? (isTe ? 'రుణగ్రహీతల జాబితా' : 'Borrower Directory')
              : (isTe ? 'రుణాల చరిత్ర' : 'Loan History')}
          </h2>
          <p className="text-xs text-slate-500 font-medium mt-0.5">
            {activeTab === 'borrowers'
              ? (isTe ? 'ఖాతాదారుల వివరాలు' : 'Manage client profiles')
              : (isTe ? 'ఇటీవలి రుణాలు (క్రమబద్ధీకరించబడ్డాయి)' : 'All issued loans (most recent first)')}
          </p>
        </div>

        {activeTab === 'borrowers' && (
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
        )}
      </div>

      {/* Segmented Tab Switcher: Borrowers Directory vs All Loans History */}
      <div className="flex bg-slate-100 p-1.5 rounded-2xl border border-slate-200 gap-1">
        <button
          type="button"
          onClick={() => setActiveTab('borrowers')}
          className={`flex-1 min-h-[46px] rounded-xl font-bold text-sm transition-all flex items-center justify-center gap-2 ${
            activeTab === 'borrowers'
              ? 'bg-white text-teal-900 shadow-sm border border-slate-200/60'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <Users size={18} />
          <span>{isTe ? 'ఖాతాదారులు' : 'Borrowers'}</span>
          <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 font-extrabold">
            {borrowers.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => {
            setActiveTab('loans');
            loadAllLoans();
          }}
          className={`flex-1 min-h-[46px] rounded-xl font-bold text-sm transition-all flex items-center justify-center gap-2 ${
            activeTab === 'loans'
              ? 'bg-white text-teal-900 shadow-sm border border-slate-200/60'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <History size={18} />
          <span>{isTe ? 'రుణాల చరిత్ర' : 'Loan History'}</span>
          <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 font-extrabold">
            {allLoans.length}
          </span>
        </button>
      </div>

      {/* TAB 1: BORROWERS DIRECTORY */}
      {activeTab === 'borrowers' ? (
        <>
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
        </>
      ) : (
        /* TAB 2: GLOBAL LOAN HISTORY (Sorted by Most Recent) */
        <div className="space-y-3">
          {/* Search Bar & Status Filters */}
          <div className="space-y-2">
            <div className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
              <input
                type="text"
                value={loanSearchQuery}
                onChange={(e) => setLoanSearchQuery(e.target.value)}
                placeholder={isTe ? 'రుణగ్రహీత పేరు లేదా ఫోన్ నంబర్‌తో వెతకండి...' : 'Search by borrower name or phone...'}
                className="w-full min-h-[56px] pl-12 pr-4 bg-white border border-slate-200 rounded-2xl text-base placeholder:text-slate-400 shadow-sm focus:outline-none focus:ring-2 focus:ring-teal-600"
              />
            </div>

            {/* Filter Pills */}
            <div className="flex gap-2">
              {(['all', 'active', 'completed'] as const).map((filter) => (
                <button
                  key={filter}
                  type="button"
                  onClick={() => setLoanStatusFilter(filter)}
                  className={`py-1.5 px-3.5 rounded-xl text-xs font-bold capitalize transition-all ${
                    loanStatusFilter === filter
                      ? 'bg-teal-800 text-white shadow-sm'
                      : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  {isTe
                    ? filter === 'all'
                      ? `అన్నీ (${allLoans.length})`
                      : filter === 'active'
                      ? `బాకీ (${allLoans.filter((l) => l.status === 'active').length})`
                      : `పూర్తయినవి (${allLoans.filter((l) => l.status === 'completed').length})`
                    : `${filter} (${filter === 'all' ? allLoans.length : allLoans.filter((l) => l.status === filter).length})`}
                </button>
              ))}
            </div>
          </div>

          {/* Loans History List */}
          {isLoadingAllLoans ? (
            <div className="text-center py-8 text-base font-semibold text-slate-400">
              {isTe ? 'రుణాల చరిత్ర లోడ్ అవుతోంది...' : 'Loading loan history...'}
            </div>
          ) : filteredLoans.length === 0 ? (
            <div className="bg-white rounded-2xl p-8 shadow-sm border border-slate-200 text-center space-y-3">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-teal-50 text-teal-800">
                <History className="h-8 w-8" />
              </div>
              <h3 className="text-lg font-bold text-slate-700">
                {isTe ? 'ఎటువంటి రుణాలు కనుగొనబడలేదు' : 'No Loans Found'}
              </h3>
              <p className="text-sm text-slate-500">
                {isTe
                  ? 'ఇప్పటివరకు ఎటువంటి రుణాలు మంజూరు చేయబడలేదు లేదా శోధనకు సరిపోలలేదు.'
                  : 'No loans have been recorded yet or matched your query.'}
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredLoans.map((loan) => {
                const borrower = borrowerMap[loan.borrowerId];
                const isCompleted = loan.status === 'completed';

                return (
                  <div
                    key={loan.id}
                    className="bg-white rounded-2xl p-4 shadow-sm border border-slate-200 space-y-3 hover:border-teal-400 transition-all"
                  >
                    {/* Header: Borrower Name & Loan Type Badges */}
                    <div className="flex items-start justify-between">
                      <div>
                        <button
                          type="button"
                          onClick={() => borrower && handleOpenBorrowerDetails(borrower)}
                          className="text-left font-black text-lg text-slate-900 hover:text-teal-800 hover:underline block leading-tight"
                        >
                          {borrower ? borrower.name : 'Unknown Borrower'}
                        </button>
                        <span className="text-xs font-semibold text-slate-500 block mt-0.5">
                          {borrower ? `+91 ${borrower.phone}` : ''}
                        </span>
                      </div>

                      <div className="flex items-center gap-1.5">
                        <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-teal-100 text-teal-900 border border-teal-200">
                          {loan.loanType === 'DF' ? 'Daily Finance' : 'Special (SP)'}
                        </span>
                        <span
                          className={`text-[11px] font-bold px-2 py-0.5 rounded-full border ${
                            isCompleted
                              ? 'bg-blue-50 text-blue-800 border-blue-200'
                              : 'bg-emerald-50 text-emerald-800 border-emerald-200'
                          }`}
                        >
                          {isCompleted
                            ? (isTe ? 'పూర్తయింది' : 'Completed')
                            : (isTe ? 'బాకీ' : 'Active')}
                        </span>
                      </div>
                    </div>

                    {/* Financial Amounts Row */}
                    <div className="grid grid-cols-2 gap-2 bg-slate-50 p-2.5 rounded-xl border border-slate-200/80">
                      <div>
                        <span className="text-[11px] font-semibold text-slate-500 uppercase block">
                          {isTe ? 'అసలు మొత్తం' : 'Principal Amount'}
                        </span>
                        <span className="text-base font-bold text-slate-900 block mt-0.5">
                          ₹{loan.principalAmount.toLocaleString('en-IN')}
                        </span>
                      </div>
                      <div className="text-right">
                        <span className="text-[11px] font-semibold text-slate-500 uppercase block">
                          {isTe ? 'బకాయి మొత్తం' : 'Outstanding'}
                        </span>
                        <span className={`text-base font-extrabold block mt-0.5 ${isCompleted ? 'text-blue-800' : 'text-teal-900'}`}>
                          ₹{loan.outstandingBalance.toLocaleString('en-IN')}
                        </span>
                      </div>
                    </div>

                    {/* Dates Row: Date Issued & Expected End Date */}
                    <div className="grid grid-cols-2 gap-2 text-xs bg-teal-50/70 p-2.5 rounded-xl border border-teal-200/80">
                      <div>
                        <span className="text-teal-900 font-semibold block">{isTe ? 'ఇచ్చిన తేదీ (Issued):' : 'Date Issued:'}</span>
                        <span className="font-bold text-gray-900 block mt-0.5">
                          {formatShortDate(loan.startDate, isTe)}
                        </span>
                      </div>
                      <div>
                        <span className="text-teal-900 font-semibold block">{isTe ? 'ముగింపు తేదీ (Expected End):' : 'Expected End Date:'}</span>
                        <span className="font-extrabold text-teal-950 block mt-0.5">
                          {loan.endDate ? formatShortDate(loan.endDate, isTe) : '—'}
                        </span>
                      </div>
                    </div>

                    {/* Milestone Inspector Trigger */}
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
                );
              })}
            </div>
          )}
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

                      {/* Dates Row: Start Date & Expected End Date */}
                      <div className="grid grid-cols-2 gap-2 text-xs bg-white p-2.5 rounded-xl border border-slate-200">
                        <div>
                          <span className="text-slate-500 font-semibold block">{isTe ? 'ప్రారంభ తేదీ:' : 'Start Date:'}</span>
                          <span className="font-bold text-slate-900 block mt-0.5">{formatShortDate(loan.startDate, isTe)}</span>
                        </div>
                        <div>
                          <span className="text-slate-500 font-semibold block">{isTe ? 'ముగింపు తేదీ:' : 'Expected End:'}</span>
                          <span className="font-bold text-teal-900 block mt-0.5">
                            {loan.endDate ? formatShortDate(loan.endDate, isTe) : '—'}
                          </span>
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
                  setIsEditConfirmationOpen(false);
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
                  onChange={(e) => setEditName(e.target.value)}
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
                    onChange={(e) => setEditPhone(e.target.value.replace(/\D/g, ''))}
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
                  onChange={(e) => setEditGuarantorName(e.target.value)}
                  placeholder={isTe ? 'హామీదారు పేరు' : 'Guarantor Name'}
                  className="w-full min-h-[56px] px-4 bg-slate-50 border border-slate-200 rounded-2xl text-base focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
                <input
                  type="tel"
                  inputMode="numeric"
                  maxLength={10}
                  value={editGuarantorPhone}
                  onChange={(e) => setEditGuarantorPhone(e.target.value.replace(/\D/g, ''))}
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
                  onChange={(e) => setEditAddress(e.target.value)}
                  className="w-full p-3.5 bg-slate-50 border border-slate-200 rounded-2xl text-base focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
              </div>

              {/* Submit Button (56px) */}
              <button
                type="submit"
                className="w-full min-h-[56px] rounded-2xl bg-teal-800 hover:bg-teal-700 active:bg-teal-900 font-bold text-lg text-white shadow-lg active:scale-95 transition-all flex items-center justify-center space-x-2"
              >
                <span>{isTe ? 'మార్పులను సేవ్ చేయి' : 'Save Changes'}</span>
              </button>
            </form>
          </div>
        </div>
      )}

      {/* =========================================================================
          EDIT BORROWER CONFIRMATION POP-UP CARD
          ========================================================================= */}
      {isEditConfirmationOpen && selectedBorrower && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in">
          <div className="w-full max-w-sm bg-white rounded-3xl p-6 shadow-2xl border border-gray-100 space-y-4 animate-scale-up text-center">
            <div className="w-16 h-16 rounded-full bg-teal-50 text-teal-800 border-2 border-teal-200 flex items-center justify-center mx-auto shadow-sm">
              <Edit3 size={28} />
            </div>

            <div>
              <h3 className="text-lg font-extrabold text-gray-900 leading-snug">
                {isTe ? 'వివరాలను మార్చాలనుకుంటున్నారా?' : 'Are you sure you want to edit details?'}
              </h3>
              <p className="text-xs font-semibold text-gray-500 mt-2 leading-relaxed">
                {isTe
                  ? `మీరు "${selectedBorrower.name}" ఖాతా వివరాలను అప్‌డేట్ చేయబోతున్నారు.`
                  : `You are about to update details for "${selectedBorrower.name}".`}
              </p>
            </div>

            <div className="flex gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setIsEditConfirmationOpen(false)}
                className="flex-1 min-h-[56px] rounded-2xl border-2 border-slate-200 bg-slate-50 hover:bg-slate-100 font-bold text-slate-700 text-base transition-colors"
              >
                {isTe ? 'రద్దు' : 'Cancel'}
              </button>

              <button
                type="button"
                onClick={handleExecuteEdit}
                disabled={isSubmitting}
                className="flex-1 min-h-[56px] rounded-2xl bg-teal-800 hover:bg-teal-700 active:bg-teal-900 font-bold text-white text-base shadow-lg transition-colors flex items-center justify-center gap-1.5"
              >
                {isSubmitting
                  ? isTe ? 'సేవ్ చేస్తోంది...' : 'Saving...'
                  : isTe ? '✓ అవును, మార్చు' : '✓ Yes, Edit'}
              </button>
            </div>
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
          frequency={selectedLoanForInspector.collectionFrequency || 'daily'}
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
