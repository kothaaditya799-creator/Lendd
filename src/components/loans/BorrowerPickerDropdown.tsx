import React, { useState, useMemo, useRef, useEffect } from 'react';
import { Search, ChevronDown, Check, X, User } from 'lucide-react';
import { Borrower } from '../../types/domain';

interface BorrowerPickerDropdownProps {
  borrowers: Borrower[];
  selectedBorrowerId: string;
  onSelectBorrower: (borrowerId: string) => void;
  isTe: boolean;
}

export const BorrowerPickerDropdown: React.FC<BorrowerPickerDropdownProps> = ({
  borrowers,
  selectedBorrowerId,
  onSelectBorrower,
  isTe,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const dropdownRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Close on outside click
  useEffect(() => {
    const handleOutsideClick = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleOutsideClick);
      // Auto-focus search input when opened
      setTimeout(() => {
        searchInputRef.current?.focus();
      }, 50);
    }
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
    };
  }, [isOpen]);

  // Sort borrowers in alphabetical order by name
  const sortedBorrowers = useMemo(() => {
    return [...borrowers].sort((a, b) =>
      a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })
    );
  }, [borrowers]);

  // Filter borrowers by search query (name or phone)
  const filteredBorrowers = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return sortedBorrowers;
    return sortedBorrowers.filter(
      (b) =>
        b.name.toLowerCase().includes(query) ||
        b.phone.includes(query)
    );
  }, [sortedBorrowers, searchQuery]);

  // Find currently selected borrower
  const selectedBorrower = useMemo(() => {
    return borrowers.find((b) => b.id === selectedBorrowerId);
  }, [borrowers, selectedBorrowerId]);

  const handleSelect = (borrowerId: string) => {
    onSelectBorrower(borrowerId);
    setIsOpen(false);
    setSearchQuery('');
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onSelectBorrower('');
    setSearchQuery('');
  };

  return (
    <div className="relative w-full" ref={dropdownRef}>
      {/* Closed State / Trigger Button */}
      {selectedBorrower ? (
        <div className="flex items-center justify-between p-3.5 bg-teal-50/70 border-2 border-teal-600 rounded-2xl shadow-sm">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-full bg-teal-800 text-white font-black text-lg flex items-center justify-center shrink-0 shadow">
              {selectedBorrower.name.charAt(0).toUpperCase()}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-extrabold text-base text-gray-900 leading-tight">
                  {selectedBorrower.name}
                </span>
                <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-teal-100 text-teal-800 border border-teal-200">
                  ★ {selectedBorrower.trustScore.toFixed(1)}
                </span>
              </div>
              <span className="text-xs font-semibold text-gray-600 block mt-0.5">
                +91 {selectedBorrower.phone}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setIsOpen(!isOpen)}
              className="py-1.5 px-3 rounded-xl bg-white hover:bg-teal-100/70 border border-teal-300 text-teal-900 font-bold text-xs transition-colors shadow-sm"
            >
              {isTe ? 'మార్చు' : 'Change'}
            </button>
            <button
              type="button"
              onClick={handleClear}
              className="p-1.5 rounded-xl hover:bg-teal-200/50 text-gray-400 hover:text-gray-700 transition-colors"
              title={isTe ? 'ఎంపిక తొలగించు' : 'Clear selection'}
            >
              <X size={18} />
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className={`w-full min-h-[56px] px-4 rounded-2xl border-2 text-left flex items-center justify-between transition-all ${
            isOpen
              ? 'border-teal-600 bg-white ring-2 ring-teal-500/20 shadow-md'
              : 'border-slate-300 bg-slate-50 hover:bg-slate-100 text-slate-700'
          }`}
        >
          <div className="flex items-center gap-2.5">
            <User className="h-5 w-5 text-slate-400" />
            <span className="text-base font-bold text-slate-600">
              {isTe ? 'రుణగ్రహీతను ఎంచుకోండి (Select Borrower)...' : 'Select a Borrower...'}
            </span>
          </div>
          <ChevronDown
            size={20}
            className={`text-slate-400 transition-transform ${isOpen ? 'rotate-180 text-teal-700' : ''}`}
          />
        </button>
      )}

      {/* Dropdown Menu */}
      {isOpen && (
        <div className="absolute left-0 right-0 top-full mt-2 z-40 bg-white rounded-2xl shadow-2xl border-2 border-teal-600 overflow-hidden animate-fade-in">
          {/* Search Box Header */}
          <div className="p-3 bg-teal-50/80 border-b border-teal-100">
            <div className="relative">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-teal-700" />
              <input
                ref={searchInputRef}
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={
                  isTe
                    ? 'పేరు లేదా మొబైల్ నంబర్‌తో వెతకండి...'
                    : 'Search by name or mobile number...'
                }
                className="w-full min-h-[46px] pl-10 pr-9 bg-white border border-teal-200 rounded-xl text-sm font-semibold text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-teal-600"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-gray-600"
                >
                  <X size={16} />
                </button>
              )}
            </div>
            <p className="text-[11px] font-semibold text-teal-800 mt-1.5 px-1">
              {isTe
                ? `అక్షర క్రమంలో (${filteredBorrowers.length} మంది రుణగ్రహీతలు)`
                : `Alphabetical Order (${filteredBorrowers.length} borrowers)`}
            </p>
          </div>

          {/* Smooth Scrollable List of Borrowers (~6 in foreground view) */}
          <div className="max-h-[330px] overflow-y-auto divide-y divide-gray-100">
            {filteredBorrowers.length === 0 ? (
              <div className="p-6 text-center text-gray-400">
                <p className="text-sm font-semibold">
                  {isTe
                    ? searchQuery
                      ? 'ఏ రుణగ్రహీత కనుగొనబడలేదు'
                      : 'రుణగ్రహీతలు ఎవరూ లేరు'
                    : searchQuery
                    ? `No borrowers found matching "${searchQuery}"`
                    : 'No active borrowers available.'}
                </p>
              </div>
            ) : (
              filteredBorrowers.map((borrower) => {
                const isSelected = borrower.id === selectedBorrowerId;
                return (
                  <button
                    key={borrower.id}
                    type="button"
                    onClick={() => handleSelect(borrower.id)}
                    className={`w-full min-h-[54px] p-3 px-4 flex items-center justify-between text-left transition-colors ${
                      isSelected
                        ? 'bg-teal-50 hover:bg-teal-100/80 font-bold'
                        : 'hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={`w-9 h-9 rounded-full flex items-center justify-center font-bold text-sm shrink-0 ${
                          isSelected
                            ? 'bg-teal-700 text-white'
                            : 'bg-slate-200 text-slate-700'
                        }`}
                      >
                        {borrower.name.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-bold text-gray-900 leading-tight">
                            {borrower.name}
                          </span>
                          <span className="text-[10px] font-semibold text-teal-800 bg-teal-100/70 px-1.5 py-0.5 rounded">
                            ★ {borrower.trustScore.toFixed(1)}
                          </span>
                        </div>
                        <span className="text-xs text-gray-500 font-medium">
                          +91 {borrower.phone}
                        </span>
                      </div>
                    </div>

                    {isSelected && (
                      <div className="w-6 h-6 rounded-full bg-teal-700 text-white flex items-center justify-center shrink-0">
                        <Check size={14} />
                      </div>
                    )}
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
};

