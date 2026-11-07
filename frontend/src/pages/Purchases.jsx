import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  ShoppingBag,
  Plus,
  Search,
  LayoutGrid,
  List,
  Store,
  Tag,
  Clock,
  Shield,
  FileText,
  AlertCircle,
  Eye,
  Edit3,
  Trash2,
  RefreshCw,
  X,
  Filter,
  CheckCircle2,
  Calendar,
  Download
} from 'lucide-react';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../context/AuthContext';
import {
  getTodayString,
  addDays,
  getDaysRemaining,
  getWarrantyStatus,
  formatDate,
  formatPrice,
} from '../lib/dateUtils';
import { deleteInvoiceFile } from '../lib/storageUtils';
import { exportToCSV } from '../lib/csvUtils';
import PurchaseFormModal from '../components/PurchaseFormModal';
import PurchaseDetailsModal from '../components/PurchaseDetailsModal';
import DeleteConfirmModal from '../components/DeleteConfirmModal';

const FILTER_TABS = [
  { id: 'all', label: 'All Purchases' },
  { id: 'eligible', label: 'Eligible for Return' },
  { id: 'expiring', label: 'Expiring Soon (≤ 7d)' },
  { id: 'expired', label: 'Return Expired' },
];

const Purchases = () => {
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();

  // Data state
  const [purchases, setPurchases] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState(null);

  // UI Filter & View Controls
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState('all');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [viewMode, setViewMode] = useState('grid'); // 'grid' | 'table'

  // Modals state
  const [formModalOpen, setFormModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState(null);

  const [detailsModalOpen, setDetailsModalOpen] = useState(false);
  const [viewingItem, setViewingItem] = useState(null);

  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [deletingItem, setDeletingItem] = useState(null);

  // Check URL params (e.g. ?action=new from dashboard quick action)
  useEffect(() => {
    if (searchParams.get('action') === 'new') {
      setEditingItem(null);
      setFormModalOpen(true);
      // Clean query parameter after opening
      searchParams.delete('action');
      setSearchParams(searchParams, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  // Fetch all purchases directly from Supabase (strictly scoped to auth user)
  const fetchPurchases = useCallback(async () => {
    setLoading(true);
    setErrorMsg(null);

    try {
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (!user) {
        setPurchases([]);
        setLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from('purchases')
        .select('*')
        .eq('user_id', user.id)
        .order('purchase_date', { ascending: false });

      if (error) throw error;
      setPurchases(data || []);
    } catch (err) {
      console.error('Error fetching purchases:', err);
      setErrorMsg(err.message || 'Failed to load purchases.');
      setPurchases([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPurchases();
  }, [fetchPurchases, user?.id]);

  // Unique categories for filter dropdown
  const categoryOptions = useMemo(() => {
    const set = new Set();
    purchases.forEach((p) => {
      if (p.category) set.add(p.category);
    });
    return ['All', ...Array.from(set)];
  }, [purchases]);

  // Client-side filtering logic
  const filteredPurchases = useMemo(() => {
    const today = getTodayString();
    const todayPlus7 = addDays(today, 7);

    return purchases.filter((item) => {
      // 1. Search Query filter (matches product_name or store)
      const matchesSearch =
        !searchQuery.trim() ||
        item.product_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (item.store && item.store.toLowerCase().includes(searchQuery.toLowerCase()));

      if (!matchesSearch) return false;

      // 2. Category filter
      if (selectedCategory !== 'All' && item.category !== selectedCategory) {
        return false;
      }

      // 3. Tab filter
      const rDeadline = item.return_deadline;
      if (activeTab === 'eligible') {
        // Return deadline is today or in the future
        return rDeadline && rDeadline >= today;
      } else if (activeTab === 'expiring') {
        // Return deadline is between today and today + 7 days
        return rDeadline && rDeadline >= today && rDeadline <= todayPlus7;
      } else if (activeTab === 'expired') {
        // Return deadline has passed
        return rDeadline && rDeadline < today;
      }

      return true;
    });
  }, [purchases, searchQuery, activeTab, selectedCategory]);

  // Calculate tab counts
  const tabCounts = useMemo(() => {
    const today = getTodayString();
    const todayPlus7 = addDays(today, 7);

    let eligible = 0;
    let expiring = 0;
    let expired = 0;

    purchases.forEach((item) => {
      const d = item.return_deadline;
      if (d) {
        if (d >= today) eligible++;
        if (d >= today && d <= todayPlus7) expiring++;
        if (d < today) expired++;
      }
    });

    return {
      all: purchases.length,
      eligible,
      expiring,
      expired,
    };
  }, [purchases]);

  // Handle Delete Purchase
  const handleDeleteConfirm = async () => {
    if (!deletingItem?.id) return;

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // 1. Delete purchase record strictly matching user_id
      const { error } = await supabase
        .from('purchases')
        .delete()
        .eq('id', deletingItem.id)
        .eq('user_id', user.id);

      if (error) throw error;

      // 2. Clean up invoice file in storage if present
      if (deletingItem.invoice_url) {
        await deleteInvoiceFile(deletingItem.invoice_url);
      }

      // 3. Refresh list
      setPurchases((prev) => prev.filter((p) => p.id !== deletingItem.id));
      setDeletingItem(null);
    } catch (err) {
      console.error('Error deleting purchase:', err);
      throw err;
    }
  };

  // Export Purchases to CSV
  const handleExportCSV = () => {
    const columns = [
      { header: 'Product Name', accessor: 'product_name' },
      { header: 'Store', accessor: (p) => p.store || 'Direct' },
      { header: 'Category', accessor: (p) => p.category || 'General' },
      { header: 'Price', accessor: (p) => (p.price !== null && p.price !== undefined ? p.price : '') },
      { header: 'Currency', accessor: (p) => p.currency || 'USD' },
      { header: 'Purchase Date', accessor: 'purchase_date' },
      { header: 'Return Deadline', accessor: (p) => p.return_deadline || '' },
      { header: 'Warranty Expiry', accessor: (p) => p.warranty_expiry || '' },
      { header: 'Invoice Attached', accessor: (p) => (p.invoice_url ? 'Yes' : 'No') },
    ];

    const todayStr = getTodayString();
    exportToCSV(`smartreturn-purchases-${todayStr}.csv`, filteredPurchases, columns);
  };

  return (
    <div className="space-y-6">
      {/* Page Title & Main Action */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[#0F172A]">
            My Purchases
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Track receipts, manage return deadlines, and preserve warranty information.
          </p>
        </div>

        <div className="flex items-center gap-2.5 self-start sm:self-auto">
          <button
            onClick={fetchPurchases}
            className="p-2 text-slate-500 hover:text-slate-800 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 transition"
            title="Refresh purchases"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-[#7C3AED]' : ''}`} />
          </button>

          <button
            onClick={handleExportCSV}
            disabled={filteredPurchases.length === 0}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-slate-600 hover:text-slate-900 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 transition shadow-xs text-xs font-semibold disabled:opacity-50"
            title="Export purchases to CSV"
          >
            <Download className="w-3.5 h-3.5 text-slate-500" />
            <span className="hidden sm:inline">Export CSV</span>
          </button>

          <button
            onClick={() => {
              setEditingItem(null);
              setFormModalOpen(true);
            }}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-[#7C3AED] hover:bg-purple-700 text-white text-xs font-semibold rounded-xl shadow-xs transition"
          >
            <Plus className="w-4 h-4" />
            Add Purchase
          </button>
        </div>
      </div>

      {/* Filter Tabs & Search Bar */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-xs space-y-4">
        {/* Filter Tabs */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 sm:pb-0 scrollbar-none">
          {FILTER_TABS.map((tab) => {
            const count = tabCounts[tab.id];
            const isActive = activeTab === tab.id;

            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-medium whitespace-nowrap transition ${
                  isActive
                    ? 'bg-[#7C3AED] text-white shadow-xs'
                    : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                }`}
              >
                <span>{tab.label}</span>
                <span
                  className={`px-1.5 py-0.2 rounded-md text-[10px] font-bold ${
                    isActive
                      ? 'bg-purple-800 text-purple-100'
                      : 'bg-slate-100 text-slate-600'
                  }`}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Search, Category Filter, and View Mode Toggle */}
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 pt-2 border-t border-slate-100">
          {/* Search Input */}
          <div className="relative flex-1 max-w-md">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
              <Search className="w-4 h-4" />
            </div>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by product name or store..."
              className="w-full pl-9 pr-8 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-[#7C3AED] focus:border-transparent transition bg-slate-50/50 focus:bg-white"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute inset-y-0 right-0 pr-2.5 flex items-center text-slate-400 hover:text-slate-600"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <div className="flex items-center gap-3">
            {/* Category Dropdown */}
            {categoryOptions.length > 1 && (
              <div className="flex items-center gap-1.5 text-xs">
                <Filter className="w-3.5 h-3.5 text-slate-400" />
                <select
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value)}
                  className="px-2.5 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-[#7C3AED] bg-white text-slate-700"
                >
                  {categoryOptions.map((opt) => (
                    <option key={opt} value={opt}>
                      {opt === 'All' ? 'All Categories' : opt}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* View Mode Toggle */}
            <div className="flex items-center p-1 bg-slate-100 rounded-xl border border-slate-200">
              <button
                onClick={() => setViewMode('grid')}
                className={`p-1.5 rounded-lg transition ${
                  viewMode === 'grid'
                    ? 'bg-white text-[#7C3AED] shadow-xs'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
                title="Grid card view"
              >
                <LayoutGrid className="w-4 h-4" />
              </button>
              <button
                onClick={() => setViewMode('table')}
                className={`p-1.5 rounded-lg transition ${
                  viewMode === 'table'
                    ? 'bg-white text-[#7C3AED] shadow-xs'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
                title="Table list view"
              >
                <List className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Global Error Banner */}
      {errorMsg && (
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
          <div className="text-xs text-rose-800">
            <span className="font-semibold">Error:</span> {errorMsg}
          </div>
        </div>
      )}

      {/* Loading Skeleton */}
      {loading && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div
              key={i}
              className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs space-y-4 animate-pulse"
            >
              <div className="h-4 bg-slate-200 rounded-md w-3/4" />
              <div className="h-3 bg-slate-200 rounded-md w-1/2" />
              <div className="h-8 bg-slate-100 rounded-xl" />
              <div className="h-4 bg-slate-200 rounded-md w-2/3" />
            </div>
          ))}
        </div>
      )}

      {/* Empty State: No purchases at all */}
      {!loading && purchases.length === 0 && (
        <div className="bg-white rounded-2xl border border-dashed border-slate-200 p-12 text-center shadow-xs">
          <div className="w-14 h-14 rounded-2xl bg-purple-50 text-[#7C3AED] flex items-center justify-center mx-auto mb-4 border border-purple-100">
            <ShoppingBag className="w-7 h-7" />
          </div>
          <h3 className="text-base font-bold text-slate-900">
            No purchases registered yet
          </h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1.5 leading-relaxed">
            Start keeping track of your items, receipts, and return policies so you never miss a return deadline or warranty claim.
          </p>
          <button
            onClick={() => {
              setEditingItem(null);
              setFormModalOpen(true);
            }}
            className="mt-5 inline-flex items-center gap-2 px-4 py-2.5 bg-[#7C3AED] hover:bg-purple-700 text-white text-xs font-semibold rounded-xl shadow-xs transition"
          >
            <Plus className="w-4 h-4" />
            Add First Purchase
          </button>
        </div>
      )}

      {/* Empty State: Filter or search returned 0 items */}
      {!loading && purchases.length > 0 && filteredPurchases.length === 0 && (
        <div className="bg-white rounded-2xl border border-slate-200/80 p-10 text-center shadow-xs">
          <Search className="w-8 h-8 text-slate-300 mx-auto mb-3" />
          <h3 className="text-sm font-semibold text-slate-900">
            No purchases match your criteria
          </h3>
          <p className="text-xs text-slate-500 mt-1 max-w-xs mx-auto">
            Try adjusting your search query, clearing filters, or switching tabs.
          </p>
          <button
            onClick={() => {
              setSearchQuery('');
              setActiveTab('all');
              setSelectedCategory('All');
            }}
            className="mt-4 px-3.5 py-1.5 text-xs font-medium text-[#7C3AED] bg-purple-50 hover:bg-purple-100 rounded-lg transition"
          >
            Reset Filters
          </button>
        </div>
      )}

      {/* Populated Views */}
      {!loading && filteredPurchases.length > 0 && (
        <>
          {/* GRID VIEW */}
          {viewMode === 'grid' && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {filteredPurchases.map((item) => {
                const daysLeft = getDaysRemaining(item.return_deadline);
                const warrantyInfo = getWarrantyStatus(item.warranty_expiry);

                return (
                  <div
                    key={item.id}
                    className="bg-white rounded-2xl border border-slate-200/80 hover:border-purple-300 hover:shadow-md transition-all duration-200 p-5 flex flex-col justify-between group"
                  >
                    <div>
                      {/* Top Badges */}
                      <div className="flex items-center justify-between gap-2 mb-3">
                        <span className="px-2.5 py-0.5 rounded-lg text-[11px] font-semibold bg-purple-50 text-[#7C3AED] border border-purple-100 truncate max-w-[150px]">
                          {item.category || 'General'}
                        </span>

                        {item.invoice_url && (
                          <span
                            className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md"
                            title="Invoice receipt attached"
                          >
                            <FileText className="w-3 h-3 text-[#7C3AED]" />
                            Receipt
                          </span>
                        )}
                      </div>

                      {/* Product Name & Store */}
                      <h3
                        onClick={() => {
                          setViewingItem(item);
                          setDetailsModalOpen(true);
                        }}
                        className="text-base font-bold text-[#0F172A] group-hover:text-[#7C3AED] transition cursor-pointer line-clamp-1"
                        title={item.product_name}
                      >
                        {item.product_name}
                      </h3>

                      <div className="flex items-center justify-between mt-1 text-xs text-slate-500">
                        {item.store ? (
                          <span className="flex items-center gap-1 truncate">
                            <Store className="w-3 h-3 text-slate-400" />
                            <span className="truncate">{item.store}</span>
                          </span>
                        ) : (
                          <span>Direct purchase</span>
                        )}
                        <span className="text-slate-400">
                          {formatDate(item.purchase_date)}
                        </span>
                      </div>

                      {/* Price display */}
                      <div className="mt-3.5 pt-3 border-t border-slate-100 flex items-baseline justify-between">
                        <span className="text-xs text-slate-400">Price</span>
                        <span className="text-lg font-black text-[#0F172A]">
                          {formatPrice(item.price, item.currency)}
                        </span>
                      </div>

                      {/* Countdown & Status indicators */}
                      <div className="mt-3 space-y-2 bg-slate-50/70 p-3 rounded-xl border border-slate-100">
                        {/* Return window status */}
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-slate-500 flex items-center gap-1">
                            <Clock className="w-3 h-3 text-[#7C3AED]" />
                            Return Window:
                          </span>
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                              daysLeft === null
                                ? 'bg-slate-100 text-slate-600 border-slate-200'
                                : daysLeft < 0
                                ? 'bg-slate-100 text-slate-600 border-slate-200'
                                : daysLeft === 0
                                ? 'bg-rose-50 text-rose-700 border-rose-200 animate-pulse'
                                : daysLeft <= 3
                                ? 'bg-rose-50 text-rose-700 border-rose-200'
                                : daysLeft <= 7
                                ? 'bg-amber-50 text-amber-700 border-amber-200'
                                : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                            }`}
                          >
                            {daysLeft === null
                              ? 'N/A'
                              : daysLeft < 0
                              ? 'Expired'
                              : daysLeft === 0
                              ? 'Expires Today'
                              : `${daysLeft} days left`}
                          </span>
                        </div>

                        {/* Warranty status */}
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-slate-500 flex items-center gap-1">
                            <Shield className="w-3 h-3 text-emerald-600" />
                            Warranty:
                          </span>
                          <span
                            className={`text-[11px] font-semibold ${
                              warrantyInfo.status === 'expired'
                                ? 'text-slate-400'
                                : 'text-emerald-700'
                            }`}
                          >
                            {warrantyInfo.label}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Card Footer Actions */}
                    <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
                      <button
                        onClick={() => {
                          setViewingItem(item);
                          setDetailsModalOpen(true);
                        }}
                        className="flex-1 py-1.5 px-3 rounded-xl text-xs font-semibold text-[#7C3AED] bg-purple-50 hover:bg-purple-100 transition inline-flex items-center justify-center gap-1"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        Details
                      </button>

                      <button
                        onClick={() => {
                          setEditingItem(item);
                          setFormModalOpen(true);
                        }}
                        className="p-1.5 rounded-xl text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition"
                        title="Edit purchase"
                      >
                        <Edit3 className="w-4 h-4" />
                      </button>

                      <button
                        onClick={() => {
                          setDeletingItem(item);
                          setDeleteModalOpen(true);
                        }}
                        className="p-1.5 rounded-xl text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition"
                        title="Delete purchase"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* TABLE VIEW */}
          {viewMode === 'table' && (
            <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50/70 text-slate-500 uppercase font-semibold text-[11px] tracking-wider">
                      <th className="py-3.5 px-4">Product & Category</th>
                      <th className="py-3.5 px-4">Store</th>
                      <th className="py-3.5 px-4">Price</th>
                      <th className="py-3.5 px-4">Purchase Date</th>
                      <th className="py-3.5 px-4">Return Deadline</th>
                      <th className="py-3.5 px-4">Warranty</th>
                      <th className="py-3.5 px-4">Receipt</th>
                      <th className="py-3.5 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredPurchases.map((item) => {
                      const daysLeft = getDaysRemaining(item.return_deadline);
                      const warrantyInfo = getWarrantyStatus(item.warranty_expiry);

                      return (
                        <tr
                          key={item.id}
                          className="hover:bg-purple-50/20 transition group"
                        >
                          <td className="py-3.5 px-4">
                            <span
                              onClick={() => {
                                setViewingItem(item);
                                setDetailsModalOpen(true);
                              }}
                              className="font-bold text-[#0F172A] hover:text-[#7C3AED] transition cursor-pointer block line-clamp-1"
                              title={item.product_name}
                            >
                              {item.product_name}
                            </span>
                            <span className="inline-block mt-0.5 px-2 py-0.2 rounded-md text-[10px] font-semibold bg-purple-50 text-[#7C3AED]">
                              {item.category || 'General'}
                            </span>
                          </td>

                          <td className="py-3.5 px-4 text-slate-600">
                            {item.store || '—'}
                          </td>

                          <td className="py-3.5 px-4 font-bold text-slate-900">
                            {formatPrice(item.price, item.currency)}
                          </td>

                          <td className="py-3.5 px-4 text-slate-500">
                            {formatDate(item.purchase_date)}
                          </td>

                          <td className="py-3.5 px-4">
                            <div className="flex items-center gap-1.5">
                              <span
                                className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                                  daysLeft === null
                                    ? 'bg-slate-100 text-slate-600 border-slate-200'
                                    : daysLeft < 0
                                    ? 'bg-slate-100 text-slate-600 border-slate-200'
                                    : daysLeft === 0
                                    ? 'bg-rose-50 text-rose-700 border-rose-200 animate-pulse'
                                    : daysLeft <= 3
                                    ? 'bg-rose-50 text-rose-700 border-rose-200'
                                    : daysLeft <= 7
                                    ? 'bg-amber-50 text-amber-700 border-amber-200'
                                    : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                }`}
                              >
                                {daysLeft === null
                                  ? 'N/A'
                                  : daysLeft < 0
                                  ? 'Expired'
                                  : daysLeft === 0
                                  ? 'Expires Today'
                                  : `${daysLeft}d left`}
                              </span>
                              <span className="text-[11px] text-slate-400 hidden sm:inline">
                                ({formatDate(item.return_deadline)})
                              </span>
                            </div>
                          </td>

                          <td className="py-3.5 px-4 text-slate-600">
                            <span
                              className={`text-[11px] font-medium ${
                                warrantyInfo.status === 'expired'
                                  ? 'text-slate-400'
                                  : 'text-emerald-700'
                              }`}
                            >
                              {warrantyInfo.label}
                            </span>
                          </td>

                          <td className="py-3.5 px-4">
                            {item.invoice_url ? (
                              <button
                                onClick={() => {
                                  setViewingItem(item);
                                  setDetailsModalOpen(true);
                                }}
                                className="inline-flex items-center gap-1 text-xs text-[#7C3AED] hover:underline font-medium"
                              >
                                <FileText className="w-3.5 h-3.5" />
                                View
                              </button>
                            ) : (
                              <span className="text-slate-300">—</span>
                            )}
                          </td>

                          <td className="py-3.5 px-4 text-right">
                            <div className="flex items-center justify-end gap-1">
                              <button
                                onClick={() => {
                                  setViewingItem(item);
                                  setDetailsModalOpen(true);
                                }}
                                className="p-1.5 rounded-lg text-slate-400 hover:text-[#7C3AED] hover:bg-purple-50 transition"
                                title="View details"
                              >
                                <Eye className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => {
                                  setEditingItem(item);
                                  setFormModalOpen(true);
                                }}
                                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition"
                                title="Edit purchase"
                              >
                                <Edit3 className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => {
                                  setDeletingItem(item);
                                  setDeleteModalOpen(true);
                                }}
                                className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition"
                                title="Delete purchase"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}

      {/* Add / Edit Purchase Form Modal */}
      <PurchaseFormModal
        isOpen={formModalOpen}
        onClose={() => {
          setFormModalOpen(false);
          setEditingItem(null);
        }}
        initialData={editingItem}
        onSuccess={fetchPurchases}
      />

      {/* View Details Modal */}
      <PurchaseDetailsModal
        isOpen={detailsModalOpen}
        onClose={() => {
          setDetailsModalOpen(false);
          setViewingItem(null);
        }}
        purchase={viewingItem}
        onEdit={(item) => {
          setEditingItem(item);
          setFormModalOpen(true);
        }}
        onDelete={(item) => {
          setDeletingItem(item);
          setDeleteModalOpen(true);
        }}
      />

      {/* Delete Confirmation Modal */}
      <DeleteConfirmModal
        isOpen={deleteModalOpen}
        onClose={() => {
          setDeleteModalOpen(false);
          setDeletingItem(null);
        }}
        onConfirm={handleDeleteConfirm}
        itemTitle={deletingItem?.product_name}
      />
    </div>
  );
};

export default Purchases;
