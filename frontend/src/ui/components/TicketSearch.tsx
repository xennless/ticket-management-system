import { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '../../lib/api';
import { Search, Ticket, X, Loader2 } from 'lucide-react';
import clsx from 'clsx';

type TicketResult = {
  id: string;
  key: string;
  title: string;
  status: string;
  priority: string;
  createdAt: string;
};

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  OPEN: { label: 'Açık', color: 'bg-blue-100 text-blue-700' },
  IN_PROGRESS: { label: 'İşlemde', color: 'bg-yellow-100 text-yellow-700' },
  RESOLVED: { label: 'Çözüldü', color: 'bg-green-100 text-green-700' },
  CLOSED: { label: 'Kapalı', color: 'bg-slate-100 text-slate-600' }
};

export function TicketSearch() {
  const nav = useNavigate();
  const [query, setQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Debounced search query
  const [debouncedQuery, setDebouncedQuery] = useState('');

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(query);
    }, 300);
    return () => clearTimeout(timer);
  }, [query]);

  // Search tickets
  const searchQuery = useQuery<{ tickets: TicketResult[]; total: number }>({
    queryKey: ['ticket-search', debouncedQuery],
    enabled: debouncedQuery.length >= 2,
    queryFn: () => apiFetch(`/api/tickets?q=${encodeURIComponent(debouncedQuery)}&pageSize=8`),
    staleTime: 30_000
  });

  const tickets = searchQuery.data?.tickets || [];

  // Keyboard navigation
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (!isOpen || tickets.length === 0) return;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex(prev => (prev + 1) % tickets.length);
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex(prev => (prev - 1 + tickets.length) % tickets.length);
        break;
      case 'Enter':
        e.preventDefault();
        if (tickets[selectedIndex]) {
          nav(`/tickets/${tickets[selectedIndex].id}`);
          setIsOpen(false);
          setQuery('');
        }
        break;
      case 'Escape':
        e.preventDefault();
        setIsOpen(false);
        inputRef.current?.blur();
        break;
    }
  }, [isOpen, tickets, selectedIndex, nav]);

  // Click outside to close
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen]);

  // Reset selected index when results change
  useEffect(() => {
    setSelectedIndex(0);
  }, [tickets]);

  // Ctrl+K shortcut to focus search
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        inputRef.current?.focus();
        setIsOpen(true);
      }
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Search Input */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setIsOpen(true);
          }}
          onFocus={() => setIsOpen(true)}
          onKeyDown={handleKeyDown}
          placeholder="Ticket ara..."
          className="w-full sm:w-64 pl-9 pr-16 py-2 text-sm rounded-lg border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-300 transition-all"
        />
        {query ? (
          <button
            onClick={() => {
              setQuery('');
              inputRef.current?.focus();
            }}
            className="absolute right-10 top-1/2 -translate-y-1/2 p-1 hover:bg-slate-100 rounded"
          >
            <X className="w-3 h-3 text-slate-400" />
          </button>
        ) : null}
        <span className="absolute right-2 top-1/2 -translate-y-1/2 hidden sm:inline rounded-md border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-[10px] text-slate-400">
          Ctrl+K
        </span>
      </div>

      {/* Dropdown Results */}
      {isOpen && query.length >= 2 && (
        <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-lg border border-slate-200 shadow-lg z-50 overflow-hidden">
          {searchQuery.isLoading ? (
            <div className="p-4 text-center">
              <Loader2 className="w-5 h-5 mx-auto text-slate-400 animate-spin" />
              <div className="text-sm text-slate-500 mt-2">Aranıyor...</div>
            </div>
          ) : tickets.length === 0 ? (
            <div className="p-4 text-center">
              <Ticket className="w-8 h-8 mx-auto text-slate-300 mb-2" />
              <div className="text-sm text-slate-500">Ticket bulunamadı</div>
              <div className="text-xs text-slate-400 mt-1">"{query}" için sonuç yok</div>
            </div>
          ) : (
            <div className="max-h-80 overflow-y-auto">
              {tickets.map((ticket, index) => {
                const status = STATUS_LABELS[ticket.status] || STATUS_LABELS.OPEN;
                return (
                  <button
                    key={ticket.id}
                    onClick={() => {
                      nav(`/tickets/${ticket.id}`);
                      setIsOpen(false);
                      setQuery('');
                    }}
                    onMouseEnter={() => setSelectedIndex(index)}
                    className={clsx(
                      'w-full px-4 py-3 text-left flex items-start gap-3 transition-colors',
                      index === selectedIndex ? 'bg-slate-50' : 'hover:bg-slate-50'
                    )}
                  >
                    <Ticket className="w-4 h-4 text-slate-400 mt-0.5 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-mono text-slate-500">{ticket.key}</span>
                        <span className={clsx('text-[10px] px-1.5 py-0.5 rounded-full font-medium', status.color)}>
                          {status.label}
                        </span>
                      </div>
                      <div className="text-sm font-medium text-slate-900 truncate mt-0.5">
                        {ticket.title}
                      </div>
                    </div>
                  </button>
                );
              })}
              {searchQuery.data && searchQuery.data.total > 8 && (
                <div className="px-4 py-2 text-xs text-slate-500 bg-slate-50 border-t border-slate-100">
                  {searchQuery.data.total} sonuçtan ilk 8'i gösteriliyor
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

