import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Shield, Clock, RefreshCw, ArrowRight } from 'lucide-react';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../context/AuthContext';
import {
  getTodayString,
  addDays,
  addMonths,
  getDaysRemaining,
  formatDate,
  formatPrice,
} from '../lib/dateUtils';

export default function WarrantyAlerts() {
  const { user } = useAuth();
  const [purchases, setPurchases] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all'); // 'all', 'expiring', 'active', 'expired'
  const navigate = useNavigate();

  // Helper to dynamically calculate deadlines if missing from the record
  // return_deadline = purchase_date + (return_days || 30 days)
  // warranty_expiry = purchase_date + (warranty_months || 12 months)
  const resolveItemDeadlines = useCallback((item) => {
    const purchaseDate = item.purchase_date || getTodayString();
    const returnDays = item.return_days ? Number(item.return_days) : 30;
    const warrantyMonths = item.warranty_months ? Number(item.warranty_months) : 12;

    const resolvedReturnDeadline = item.return_deadline || addDays(purchaseDate, returnDays);
    const resolvedWarrantyExpiry = item.warranty_expiry || addMonths(purchaseDate, warrantyMonths);

    return {
      ...item,
      store_name: item.store || item.store_name || 'Retailer',
      resolved_return_deadline: resolvedReturnDeadline,
      resolved_warranty_expiry: resolvedWarrantyExpiry,
    };
  }, []);

  const loadData = useCallback(async () => {
    setLoading(true);

    try {
      const { data: { user: authUser } } = await supabase.auth.getUser();
      if (!authUser) {
        setPurchases([]);
        setLoading(false);
        return;
      }

      // Fetch live purchases strictly scoped to the authenticated user
      const { data, error } = await supabase
        .from('purchases')
        .select('*')
        .eq('user_id', authUser.id)
        .order('purchase_date', { ascending: false });

      if (error) throw error;
      setPurchases((data || []).map(resolveItemDeadlines));
    } catch (err) {
      console.error('Error fetching warranty alerts:', err);
      setPurchases([]);
    } finally {
      setLoading(false);
    }
  }, [resolveItemDeadlines]);

  useEffect(() => {
    loadData();
  }, [loadData, user?.id]);

  const getStatusBadge = (daysLeft) => {
    if (daysLeft === null || daysLeft === undefined) {
      return (
        <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-slate-100 text-slate-500 border border-slate-200">
          No deadline
        </span>
      );
    }
    if (daysLeft < 0) {
      return (
        <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-slate-100 text-slate-500 border border-slate-200">
          Expired ({Math.abs(daysLeft)}d ago)
        </span>
      );
    }
    if (daysLeft === 0) {
      return (
        <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-rose-50 text-rose-700 border border-rose-200 animate-pulse">
          Expires Today
        </span>
      );
    }
    if (daysLeft <= 14) {
      return (
        <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-amber-50 text-amber-700 border border-amber-200 animate-pulse">
          Expiring Soon ({daysLeft} days left)
        </span>
      );
    }
    return (
      <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
        Active ({daysLeft} days left)
      </span>
    );
  };

  const filteredPurchases = useMemo(() => {
    return purchases.filter((item) => {
      const returnDays = getDaysRemaining(item.resolved_return_deadline);
      const warrantyDays = getDaysRemaining(item.resolved_warranty_expiry);

      if (filter === 'expiring') {
        return (
          (returnDays !== null && returnDays >= 0 && returnDays <= 14) ||
          (warrantyDays !== null && warrantyDays >= 0 && warrantyDays <= 30)
        );
      }
      if (filter === 'active') {
        return (
          (returnDays !== null && returnDays >= 0) ||
          (warrantyDays !== null && warrantyDays >= 0)
        );
      }
      if (filter === 'expired') {
        return (
          returnDays !== null &&
          returnDays < 0 &&
          warrantyDays !== null &&
          warrantyDays < 0
        );
      }
      return true;
    });
  }, [purchases, filter]);

  return (
    <div className="p-4 sm:p-8 max-w-6xl mx-auto space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Warranty & Deadline Alerts</h1>
          <p className="text-slate-500 text-sm mt-1">
            Track urgent return expirations and manufacturer warranty windows across your purchases.
          </p>
        </div>

        <div className="flex items-center gap-3 self-start md:self-auto">
          <button
            onClick={loadData}
            className="p-2 text-slate-500 hover:text-slate-800 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 transition"
            title="Refresh alerts"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-[#7C3AED]' : ''}`} />
          </button>

          {/* Filter Pills */}
          <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200">
            {['all', 'expiring', 'active', 'expired'].map((tab) => (
              <button
                key={tab}
                onClick={() => setFilter(tab)}
                className={`px-3 py-1.5 text-xs font-medium rounded-lg capitalize transition ${
                  filter === tab
                    ? 'bg-white text-slate-800 shadow-sm'
                    : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                {tab === 'expiring' ? 'Expiring Soon' : tab}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Grid of Alerts */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {filteredPurchases.map((item) => {
          const returnDays = getDaysRemaining(item.resolved_return_deadline);
          const warrantyDays = getDaysRemaining(item.resolved_warranty_expiry);

          return (
            <div
              key={item.id}
              className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200 flex flex-col justify-between hover:shadow-md transition"
            >
              <div className="space-y-4">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h3 className="text-base font-semibold text-slate-800">{item.product_name}</h3>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {item.store_name} • Purchased on {formatDate(item.purchase_date)}
                    </p>
                  </div>
                  <span className="text-sm font-bold text-slate-700">
                    {formatPrice(item.price, item.currency)}
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                  {/* Return Window Column */}
                  <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-100 space-y-1.5">
                    <span className="text-[11px] font-semibold uppercase text-slate-400 flex items-center gap-1">
                      <Clock className="w-3 h-3 text-[#7C3AED]" />
                      Return Deadline
                    </span>
                    <div className="text-xs font-medium text-slate-700">
                      {formatDate(item.resolved_return_deadline)}
                    </div>
                    <div>{getStatusBadge(returnDays)}</div>
                  </div>

                  {/* Warranty Expiry Column */}
                  <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-100 space-y-1.5">
                    <span className="text-[11px] font-semibold uppercase text-slate-400 flex items-center gap-1">
                      <Shield className="w-3 h-3 text-emerald-600" />
                      Warranty Expiry
                    </span>
                    <div className="text-xs font-medium text-slate-700">
                      {formatDate(item.resolved_warranty_expiry)}
                    </div>
                    <div>{getStatusBadge(warrantyDays)}</div>
                  </div>
                </div>
              </div>

              {/* Action Footer */}
              <div className="mt-5 pt-4 border-t border-slate-100 flex items-center justify-between">
                <span className="text-xs text-slate-400">
                  {returnDays !== null && returnDays > 0
                    ? `${returnDays} days remaining to return`
                    : returnDays === 0
                    ? 'Return window expires today!'
                    : returnDays !== null
                    ? `Return window closed (${Math.abs(returnDays)}d ago)`
                    : 'No return policy recorded'}
                </span>
                <button
                  onClick={() => navigate(`/ai-assistant?purchaseId=${item.id}`)}
                  className="px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-medium text-xs rounded-lg transition inline-flex items-center gap-1"
                >
                  Draft Claim <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          );
        })}

        {filteredPurchases.length === 0 && !loading && (
          <div className="col-span-full py-12 text-center text-slate-400 border-2 border-dashed border-slate-200 rounded-2xl text-sm">
            No purchases match the selected filter.
          </div>
        )}
      </div>
    </div>
  );
}
