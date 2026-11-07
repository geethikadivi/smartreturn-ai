import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  RotateCcw,
  Plus,
  Download,
  RefreshCw,
  FileText,
  CheckCircle2,
  XCircle,
  Clock,
  ExternalLink,
  X,
  Copy,
  Check,
} from 'lucide-react';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../context/AuthContext';
import { formatDate, formatPrice } from '../lib/dateUtils';
import { exportToCSV } from '../lib/csvUtils';

const STATUS_CONFIG = {
  pending: {
    label: 'Pending Review',
    bg: 'bg-amber-50',
    text: 'text-amber-700',
    border: 'border-amber-200',
  },
  approved: {
    label: 'Approved',
    bg: 'bg-emerald-50',
    text: 'text-emerald-700',
    border: 'border-emerald-200',
  },
  rejected: {
    label: 'Rejected',
    bg: 'bg-rose-50',
    text: 'text-rose-700',
    border: 'border-rose-200',
  },
  // Compatibility with historical local demo labels
  Drafted: {
    label: 'Pending Review',
    bg: 'bg-amber-50',
    text: 'text-amber-700',
    border: 'border-amber-200',
  },
  Submitted: {
    label: 'Pending Review',
    bg: 'bg-blue-50',
    text: 'text-blue-700',
    border: 'border-blue-200',
  },
  'In Transit': {
    label: 'Pending Review',
    bg: 'bg-amber-50',
    text: 'text-amber-700',
    border: 'border-amber-200',
  },
  Refunded: {
    label: 'Approved',
    bg: 'bg-emerald-50',
    text: 'text-emerald-700',
    border: 'border-emerald-200',
  },
};

export default function Returns() {
  const { user } = useAuth();
  const [returnsList, setReturnsList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState(null);
  const [filter, setFilter] = useState('All'); // 'All', 'pending', 'approved', 'rejected'
  const [activeLetterItem, setActiveLetterItem] = useState(null);
  const [copiedLetter, setCopiedLetter] = useState(false);
  const navigate = useNavigate();

  // 1. Fetch return claims strictly scoped to the authenticated user from Supabase
  const fetchReturns = useCallback(async () => {
    setLoading(true);

    try {
      const { data: { user: authUser } } = await supabase.auth.getUser();
      if (!authUser) {
        setReturnsList([]);
        setLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from('return_requests')
        .select('*, purchases(*)')
        .eq('user_id', authUser.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setReturnsList(data || []);
    } catch (err) {
      console.error('Error fetching return claims:', err);
      setReturnsList([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchReturns();
  }, [fetchReturns, user?.id]);

  // 2. Update claim status ('pending' -> 'approved' / 'rejected') strictly scoped to user_id
  const updateStatus = async (id, newStatus) => {
    setUpdatingId(id);

    try {
      const { data: { user: authUser } } = await supabase.auth.getUser();
      if (!authUser) return;

      const { error } = await supabase
        .from('return_requests')
        .update({ status: newStatus })
        .eq('id', id)
        .eq('user_id', authUser.id);

      if (error) throw error;

      // Update local state
      const updated = returnsList.map((item) =>
        item.id === id ? { ...item, status: newStatus } : item
      );
      setReturnsList(updated);
    } catch (err) {
      console.error('Failed to update dispute status:', err);
      alert('Unable to update claim status: ' + err.message);
    } finally {
      setUpdatingId(null);
    }
  };

  // Helper to extract display fields from claim (whether joined or flat)
  const getClaimDetails = (ret) => {
    const p = ret.purchases || {};
    const productName = p.product_name || ret.product_name || 'Item';
    const storeName = p.store || ret.store_name || 'Retailer';
    const amount = p.price !== undefined && p.price !== null ? p.price : (ret.amount || 0);
    const currency = p.currency || ret.currency || 'USD';
    const reason = ret.reason || 'Return claim requested';
    const trackingCode = ret.tracking_code || ret.order_id || null;
    const dateInitiated = ret.created_at
      ? formatDate(ret.created_at.slice(0, 10))
      : ret.date_initiated || 'N/A';

    return {
      productName,
      storeName,
      amount,
      currency,
      reason,
      trackingCode,
      dateInitiated,
    };
  };

  // 3. Export to CSV
  const handleExportCSV = () => {
    const columns = [
      { header: 'Claim ID', accessor: (r) => r.id },
      { header: 'Product Name', accessor: (r) => getClaimDetails(r).productName },
      { header: 'Store', accessor: (r) => getClaimDetails(r).storeName },
      { header: 'Amount', accessor: (r) => getClaimDetails(r).amount },
      { header: 'Currency', accessor: (r) => getClaimDetails(r).currency },
      { header: 'Reason', accessor: (r) => getClaimDetails(r).reason },
      { header: 'Status', accessor: (r) => r.status },
      { header: 'Tracking / Order ID', accessor: (r) => getClaimDetails(r).trackingCode || '' },
      { header: 'Date Initiated', accessor: (r) => getClaimDetails(r).dateInitiated },
    ];

    const todayStr = new Date().toISOString().slice(0, 10);
    exportToCSV(`smartreturn-claims-${todayStr}.csv`, filteredItems, columns);
  };

  // Filtered claims
  const filteredItems = useMemo(() => {
    return returnsList.filter((item) => {
      if (filter === 'All') return true;
      if (filter === 'pending') {
        return item.status === 'pending' || item.status === 'Drafted' || item.status === 'Submitted' || item.status === 'In Transit';
      }
      if (filter === 'approved') {
        return item.status === 'approved' || item.status === 'Refunded';
      }
      if (filter === 'rejected') {
        return item.status === 'rejected';
      }
      return item.status === filter;
    });
  }, [returnsList, filter]);

  // Tab count metrics
  const counts = useMemo(() => {
    let pending = 0;
    let approved = 0;
    let rejected = 0;

    returnsList.forEach((r) => {
      if (r.status === 'approved' || r.status === 'Refunded') {
        approved++;
      } else if (r.status === 'rejected') {
        rejected++;
      } else {
        pending++;
      }
    });

    return {
      all: returnsList.length,
      pending,
      approved,
      rejected,
    };
  }, [returnsList]);

  return (
    <div className="p-4 sm:p-8 max-w-6xl mx-auto space-y-6">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Returns & Exchanges Tracker</h1>
          <p className="text-slate-500 text-sm mt-1">
            Track active refund claims, dispute resolutions, and live store reimbursements.
          </p>
        </div>

        <div className="flex items-center gap-2.5 self-start md:self-auto">
          <button
            onClick={fetchReturns}
            className="p-2 text-slate-500 hover:text-slate-800 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 transition"
            title="Refresh returns"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-[#7C3AED]' : ''}`} />
          </button>

          <button
            onClick={handleExportCSV}
            disabled={filteredItems.length === 0}
            className="px-3.5 py-2 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold rounded-xl border border-slate-200 shadow-xs transition inline-flex items-center gap-1.5 disabled:opacity-50"
            title="Export return claims to CSV"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export CSV</span>
          </button>

          <button
            onClick={() => navigate('/ai-assistant')}
            className="px-4 py-2 bg-[#7C3AED] hover:bg-purple-700 text-white text-xs font-semibold rounded-xl shadow-xs transition inline-flex items-center gap-1.5"
          >
            <Plus className="w-4 h-4" />
            <span>New Return Dispute</span>
          </button>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-xl border border-slate-200 w-fit overflow-x-auto max-w-full">
        {[
          { id: 'All', label: 'All Claims', count: counts.all },
          { id: 'pending', label: 'Pending Review', count: counts.pending },
          { id: 'approved', label: 'Approved', count: counts.approved },
          { id: 'rejected', label: 'Rejected', count: counts.rejected },
        ].map((tab) => {
          const isActive = filter === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setFilter(tab.id)}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg transition whitespace-nowrap ${
                isActive
                  ? 'bg-white text-slate-800 shadow-xs'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              <span>{tab.label}</span>
              <span
                className={`px-1.5 py-0.2 rounded-md text-[10px] font-bold ${
                  isActive ? 'bg-purple-100 text-[#7C3AED]' : 'bg-slate-200/70 text-slate-600'
                }`}
              >
                {tab.count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Disputes Table */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 text-[11px] font-semibold text-slate-400 uppercase tracking-wider border-b border-slate-200">
                <th className="py-3.5 px-5">Item & Store</th>
                <th className="py-3.5 px-5">Claim Amount</th>
                <th className="py-3.5 px-5">Initiated</th>
                <th className="py-3.5 px-5">Status</th>
                <th className="py-3.5 px-5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs">
              {filteredItems.map((ret) => {
                const details = getClaimDetails(ret);
                const badge = STATUS_CONFIG[ret.status] || STATUS_CONFIG.pending;
                const isPending = ret.status === 'pending' || ret.status === 'Drafted' || ret.status === 'Submitted' || ret.status === 'In Transit';
                const isApproved = ret.status === 'approved' || ret.status === 'Refunded';
                const isRejected = ret.status === 'rejected';
                const isUpdating = updatingId === ret.id;

                return (
                  <tr key={ret.id} className="hover:bg-slate-50/70 transition">
                    <td className="py-4 px-5">
                      <p className="font-semibold text-slate-800">{details.productName}</p>
                      <p className="text-slate-500 text-[11px] mt-0.5">
                        {details.storeName} &bull; {details.reason}
                      </p>
                      {details.trackingCode && (
                        <p className="text-[10px] text-purple-700 font-mono mt-0.5">
                          Ref: {details.trackingCode}
                        </p>
                      )}
                    </td>

                    <td className="py-4 px-5 font-bold text-slate-700">
                      {formatPrice(details.amount, details.currency)}
                    </td>

                    <td className="py-4 px-5 text-slate-600">
                      {details.dateInitiated}
                    </td>

                    <td className="py-4 px-5">
                      <span
                        className={`inline-flex px-2.5 py-1 rounded-full text-xs font-semibold border ${badge.bg} ${badge.text} ${badge.border}`}
                      >
                        {badge.label}
                      </span>
                    </td>

                    <td className="py-4 px-5 text-right space-x-2 whitespace-nowrap">
                      {/* View Dispute Letter Button if present */}
                      {ret.dispute_letter && (
                        <button
                          onClick={() => setActiveLetterItem(ret)}
                          className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-lg transition inline-flex items-center gap-1"
                          title="View generated dispute letter"
                        >
                          <FileText className="w-3 h-3 text-[#7C3AED]" />
                          Letter
                        </button>
                      )}

                      {/* Status Workflow Actions */}
                      {isPending && (
                        <>
                          <button
                            onClick={() => updateStatus(ret.id, 'approved')}
                            disabled={isUpdating}
                            className="px-2.5 py-1 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 font-semibold rounded-lg transition inline-flex items-center gap-1 disabled:opacity-50"
                            title="Approve refund claim"
                          >
                            <CheckCircle2 className="w-3 h-3" />
                            Approve
                          </button>
                          <button
                            onClick={() => updateStatus(ret.id, 'rejected')}
                            disabled={isUpdating}
                            className="px-2.5 py-1 bg-rose-50 text-rose-700 hover:bg-rose-100 font-semibold rounded-lg transition inline-flex items-center gap-1 disabled:opacity-50"
                            title="Reject claim"
                          >
                            <XCircle className="w-3 h-3" />
                            Reject
                          </button>
                        </>
                      )}

                      {isApproved && (
                        <div className="inline-flex items-center gap-2">
                          <span className="text-emerald-600 font-semibold text-xs inline-flex items-center gap-1">
                            <CheckCircle2 className="w-3.5 h-3.5" /> Approved
                          </span>
                          <button
                            onClick={() => updateStatus(ret.id, 'pending')}
                            disabled={isUpdating}
                            className="text-[11px] text-slate-400 hover:text-slate-600 underline"
                          >
                            Reopen
                          </button>
                        </div>
                      )}

                      {isRejected && (
                        <div className="inline-flex items-center gap-2">
                          <span className="text-rose-600 font-semibold text-xs inline-flex items-center gap-1">
                            <XCircle className="w-3.5 h-3.5" /> Rejected
                          </span>
                          <button
                            onClick={() => updateStatus(ret.id, 'pending')}
                            disabled={isUpdating}
                            className="text-[11px] text-slate-400 hover:text-slate-600 underline"
                          >
                            Reconsider
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {filteredItems.length === 0 && !loading && (
          <div className="py-12 text-center text-slate-400 text-sm">
            <RotateCcw className="w-8 h-8 text-slate-300 mx-auto mb-2" />
            <p className="font-semibold text-slate-600">No return claims found</p>
            <p className="text-xs text-slate-400 mt-1">
              Use the AI Assistant to generate and register your first return dispute letter.
            </p>
          </div>
        )}
      </div>

      {/* Modal: View Generated Dispute Letter */}
      {activeLetterItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 max-w-xl w-full p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-[#7C3AED]" />
                <h3 className="text-base font-bold text-slate-800">
                  Dispute Letter for {getClaimDetails(activeLetterItem).productName}
                </h3>
              </div>
              <button
                onClick={() => setActiveLetterItem(null)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <pre className="text-xs text-slate-700 bg-slate-50 p-4 rounded-xl border border-slate-200 whitespace-pre-wrap font-sans leading-relaxed max-h-96 overflow-y-auto">
              {activeLetterItem.dispute_letter}
            </pre>

            <div className="pt-2 flex items-center justify-end gap-2">
              <button
                onClick={() => {
                  navigator.clipboard.writeText(activeLetterItem.dispute_letter);
                  setCopiedLetter(true);
                  setTimeout(() => setCopiedLetter(false), 2000);
                }}
                className="px-3 py-1.5 text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition inline-flex items-center gap-1.5"
              >
                {copiedLetter ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                {copiedLetter ? 'Copied' : 'Copy Text'}
              </button>

              <button
                onClick={() => {
                  const blob = new Blob([activeLetterItem.dispute_letter], { type: 'text/plain;charset=utf-8' });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = url;
                  a.download = `dispute-${activeLetterItem.id.slice(0, 8)}.txt`;
                  document.body.appendChild(a);
                  a.click();
                  document.body.removeChild(a);
                  URL.revokeObjectURL(url);
                }}
                className="px-3 py-1.5 text-xs font-semibold bg-[#7C3AED] hover:bg-purple-700 text-white rounded-lg transition inline-flex items-center gap-1.5"
              >
                <Download className="w-3.5 h-3.5" />
                Download (.txt)
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
