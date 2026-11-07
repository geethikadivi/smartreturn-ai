import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  ShoppingBag,
  RotateCcw,
  CalendarClock,
  ShieldCheck,
  PlusCircle,
  FileText,
  ArrowUpRight,
  RefreshCw,
  AlertCircle,
  DollarSign,
  TrendingUp,
  AlertTriangle,
  Store,
  CheckCircle2,
  PieChart,
} from 'lucide-react';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../context/AuthContext';
import { formatPrice, formatDate, getTodayString, addDays } from '../lib/dateUtils';
import StatCard from '../components/StatCard';
import ActivityFeed from '../components/ActivityFeed';

const Dashboard = () => {
  const { user } = useAuth();

  // Loading & error states
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState(null);

  // Financial & analytics state
  const [purchases, setPurchases] = useState([]);
  const [returnClaims, setReturnClaims] = useState([]);

  // Activity feed state (return deadlines next 14 days)
  const [feedItems, setFeedItems] = useState([]);
  const [feedLoading, setFeedLoading] = useState(true);

  // Helper date ranges
  const getDateRangeStrings = () => {
    const today = getTodayString();
    const todayPlus7 = addDays(today, 7);
    const todayPlus14 = addDays(today, 14);
    return { today, todayPlus7, todayPlus14 };
  };

  // Fetch executive financial data & claims directly from Supabase with RLS
  const fetchDashboardData = useCallback(async () => {
    setLoading(true);
    setErrorMsg(null);

    try {
      const { data: { user: authUser } } = await supabase.auth.getUser();
      if (!authUser) {
        setPurchases([]);
        setReturnClaims([]);
        setLoading(false);
        return;
      }

      // 1. Fetch all purchases strictly scoped to authenticated user
      const purchasesPromise = supabase
        .from('purchases')
        .select('*')
        .eq('user_id', authUser.id)
        .order('purchase_date', { ascending: false });

      // 2. Fetch all return claims strictly scoped to authenticated user
      const returnClaimsPromise = supabase
        .from('return_requests')
        .select('*, purchases(*)')
        .eq('user_id', authUser.id);

      const [purchasesRes, claimsRes] = await Promise.all([
        purchasesPromise,
        returnClaimsPromise,
      ]);

      if (purchasesRes.error) throw purchasesRes.error;
      // return_requests error might happen if table was empty or newly created
      const fetchedPurchases = purchasesRes.data || [];
      const fetchedClaims = claimsRes.data || [];

      setPurchases(fetchedPurchases);
      setReturnClaims(fetchedClaims);
    } catch (err) {
      console.error('Error fetching dashboard analytics:', err);
      setErrorMsg(err.message || 'Failed to load executive financial metrics.');
      setPurchases([]);
      setReturnClaims([]);
    } finally {
      setLoading(false);
    }
  }, []);

  // Fetch upcoming deadlines for Activity Feed
  const fetchActivityFeed = useCallback(async () => {
    setFeedLoading(true);
    const { today, todayPlus14 } = getDateRangeStrings();

    try {
      const { data: { user: authUser } } = await supabase.auth.getUser();
      if (!authUser) {
        setFeedItems([]);
        setFeedLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from('purchases')
        .select('id, product_name, store, price, currency, return_deadline, warranty_expiry')
        .eq('user_id', authUser.id)
        .gte('return_deadline', today)
        .lte('return_deadline', todayPlus14)
        .order('return_deadline', { ascending: true });

      if (error) throw error;
      setFeedItems(data || []);
    } catch (err) {
      console.warn('Activity feed notice:', err);
      setFeedItems([]);
    } finally {
      setFeedLoading(false);
    }
  }, []);

  const refreshAll = () => {
    fetchDashboardData();
    fetchActivityFeed();
  };

  useEffect(() => {
    refreshAll();
  }, [fetchDashboardData, fetchActivityFeed, user?.id]);

  // ============================================================================
  // EXECUTIVE FINANCIAL METRIC CALCULATIONS
  // ============================================================================
  const metrics = useMemo(() => {
    const { today, todayPlus7 } = getDateRangeStrings();

    // 1. Total Value Tracked: Sum of price across all purchases
    let totalValueTracked = 0;
    purchases.forEach((p) => {
      const val = parseFloat(p.price || 0);
      if (!isNaN(val)) totalValueTracked += val;
    });

    // 2. Recovered Funds: Sum of price linked to return_requests where status = 'approved' (or 'Refunded')
    let recoveredFunds = 0;
    let approvedClaimsCount = 0;

    returnClaims.forEach((claim) => {
      const isApproved = claim.status === 'approved' || claim.status === 'Refunded';
      if (isApproved) {
        approvedClaimsCount++;
        // Get price from joined purchase or fallback
        const claimPrice =
          claim.purchases?.price ??
          purchases.find((p) => p.id === claim.purchase_id)?.price ??
          claim.amount ??
          0;
        const val = parseFloat(claimPrice || 0);
        if (!isNaN(val)) recoveredFunds += val;
      }
    });

    // 3. At-Risk Capital: Sum of price for purchases expiring within 7 days with no active return claim
    let atRiskCapital = 0;
    let expiringItemsCount = 0;

    purchases.forEach((p) => {
      const deadline = p.return_deadline;
      if (deadline && deadline >= today && deadline <= todayPlus7) {
        expiringItemsCount++;
        // Check if there is an active return claim for this purchase
        const hasClaim = returnClaims.some(
          (c) => c.purchase_id === p.id && c.status !== 'rejected'
        );
        if (!hasClaim) {
          const val = parseFloat(p.price || 0);
          if (!isNaN(val)) atRiskCapital += val;
        }
      }
    });

    // 4. Return Success Rate: Percentage of initiated return claims that reached approved / Refunded
    const totalInitiatedClaims = returnClaims.length;
    const returnSuccessRate =
      totalInitiatedClaims > 0
        ? Math.round((approvedClaimsCount / totalInitiatedClaims) * 100)
        : 100;

    // 5. Recovery Ratio: Percentage of total capital saved
    const recoveryRatio =
      totalValueTracked > 0
        ? ((recoveredFunds / totalValueTracked) * 100).toFixed(1)
        : '0.0';

    return {
      totalValueTracked,
      recoveredFunds,
      atRiskCapital,
      returnSuccessRate,
      recoveryRatio,
      totalInitiatedClaims,
      approvedClaimsCount,
      expiringItemsCount,
    };
  }, [purchases, returnClaims]);

  // ============================================================================
  // STORE RETURN BREAKDOWN RANKING
  // ============================================================================
  const storeBreakdown = useMemo(() => {
    const storeMap = {};

    purchases.forEach((p) => {
      const storeName = p.store || 'Direct / Online';
      if (!storeMap[storeName]) {
        storeMap[storeName] = {
          name: storeName,
          purchaseCount: 0,
          totalSpent: 0,
          currency: p.currency || 'USD',
          claimCount: 0,
          approvedClaimCount: 0,
        };
      }
      storeMap[storeName].purchaseCount += 1;
      const priceVal = parseFloat(p.price || 0);
      if (!isNaN(priceVal)) {
        storeMap[storeName].totalSpent += priceVal;
      }
    });

    // Match return claims
    returnClaims.forEach((claim) => {
      const purchase =
        claim.purchases || purchases.find((p) => p.id === claim.purchase_id);
      const storeName = purchase?.store || 'Direct / Online';
      if (storeMap[storeName]) {
        storeMap[storeName].claimCount += 1;
        if (claim.status === 'approved' || claim.status === 'Refunded') {
          storeMap[storeName].approvedClaimCount += 1;
        }
      }
    });

    // Convert to sorted array
    return Object.values(storeMap)
      .map((s) => ({
        ...s,
        claimRate:
          s.purchaseCount > 0
            ? Math.round((s.claimCount / s.purchaseCount) * 100)
            : 0,
      }))
      .sort((a, b) => b.totalSpent - a.totalSpent)
      .slice(0, 5); // Top 5 stores
  }, [purchases, returnClaims]);

  const userDisplayName =
    user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'User';

  return (
    <div className="space-y-8">
      {/* Welcome Banner & Actions */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 pb-2">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-[#0F172A]">
              Executive Financial Overview
            </h1>
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
              Live Recovery Sync
            </span>
          </div>
          <p className="text-sm text-slate-500 mt-1">
            Welcome back, {userDisplayName}. Monitor reimbursed capital, at-risk funds, and merchant return performance.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={refreshAll}
            className="p-2 text-slate-500 hover:text-slate-800 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 transition shadow-xs"
            title="Refresh financial data"
          >
            <RefreshCw className={`w-4 h-4 ${loading || feedLoading ? 'animate-spin text-[#7C3AED]' : ''}`} />
          </button>

          <Link
            to="/upload-invoice"
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#7C3AED] hover:bg-purple-700 text-white text-xs font-semibold rounded-xl shadow-xs transition"
          >
            <PlusCircle className="w-4 h-4" />
            Scan Invoice
          </Link>
        </div>
      </div>

      {/* Global Error Notice */}
      {errorMsg && (
        <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
          <div className="text-xs text-amber-800">
            <span className="font-semibold">Notice:</span> Some financial metrics could not be loaded ({errorMsg}).
          </div>
        </div>
      )}

      {/* 4 Executive Financial KPI Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        <StatCard
          title="Total Value Tracked"
          value={formatPrice(metrics.totalValueTracked)}
          icon={ShoppingBag}
          description="Across all recorded purchases"
          badgeText="All Capital"
          badgeType="neutral"
          loading={loading}
        />

        <StatCard
          title="Recovered Funds"
          value={formatPrice(metrics.recoveredFunds)}
          icon={ShieldCheck}
          description="Reimbursed & settled claims"
          badgeText={metrics.recoveredFunds > 0 ? "Funds Recovered" : "No Claims"}
          badgeType="success"
          loading={loading}
        />

        <StatCard
          title="At-Risk Capital"
          value={formatPrice(metrics.atRiskCapital)}
          icon={CalendarClock}
          description="Expires in ≤ 7d without claim"
          badgeText={metrics.atRiskCapital > 0 ? "Urgent Action" : "Protected"}
          badgeType={metrics.atRiskCapital > 0 ? "warning" : "purple"}
          loading={loading}
        />

        <StatCard
          title="Return Success Rate"
          value={`${metrics.returnSuccessRate}%`}
          icon={TrendingUp}
          description="Of filed return claims settled"
          badgeText="Claim Win Rate"
          badgeType="purple"
          loading={loading}
        />
      </div>

      {/* Executive Visual Breakdown Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Card 1: Financial Recovery Summary with Progress Bar */}
        <div className="lg:col-span-7 bg-white rounded-2xl border border-slate-200/80 p-6 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                  <CheckCircle2 className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">
                    Financial Recovery Summary
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    Capital successfully reclaimed through disputes and store returns
                  </p>
                </div>
              </div>
              <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200">
                {metrics.recoveryRatio}% Reclaimed
              </span>
            </div>

            {/* Main Progress Indicator */}
            <div className="mt-5 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-500 font-medium">Reimbursed vs Total Tracked</span>
                <span className="font-bold text-slate-900">
                  {formatPrice(metrics.recoveredFunds)} / {formatPrice(metrics.totalValueTracked)}
                </span>
              </div>
              {/* Styled Gradient Progress Bar */}
              <div className="w-full h-3.5 bg-slate-100 rounded-full overflow-hidden p-0.5 border border-slate-200/70">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-emerald-500 via-teal-400 to-[#7C3AED] transition-all duration-500"
                  style={{
                    width: `${Math.max(4, Math.min(100, parseFloat(metrics.recoveryRatio) || 0))}%`,
                  }}
                />
              </div>
            </div>

            {/* Secondary Metric Grid */}
            <div className="grid grid-cols-3 gap-3 mt-6 pt-5 border-t border-slate-100 text-center">
              <div className="p-3 bg-slate-50/70 rounded-xl border border-slate-100">
                <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                  Settled Claims
                </p>
                <p className="text-base font-bold text-emerald-700 mt-0.5">
                  {metrics.approvedClaimsCount} / {metrics.totalInitiatedClaims}
                </p>
              </div>

              <div className="p-3 bg-slate-50/70 rounded-xl border border-slate-100">
                <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                  Expiring Items
                </p>
                <p className="text-base font-bold text-amber-700 mt-0.5">
                  {metrics.expiringItemsCount} item{metrics.expiringItemsCount === 1 ? '' : 's'}
                </p>
              </div>

              <div className="p-3 bg-slate-50/70 rounded-xl border border-slate-100">
                <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                  Unclaimed Value
                </p>
                <p className="text-base font-bold text-rose-600 mt-0.5">
                  {formatPrice(metrics.atRiskCapital)}
                </p>
              </div>
            </div>
          </div>

          <div className="mt-5 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
            <span>Automated calculation across live Supabase purchases</span>
            <Link to="/returns" className="text-[#7C3AED] hover:underline font-semibold inline-flex items-center gap-1">
              View Returns Tracker →
            </Link>
          </div>
        </div>

        {/* Card 2: Store Return Breakdown */}
        <div className="lg:col-span-5 bg-white rounded-2xl border border-slate-200/80 p-6 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-purple-50 text-[#7C3AED] flex items-center justify-center">
                  <Store className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">
                    Store Return Breakdown
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    Merchant volume, total spend, and dispute rate
                  </p>
                </div>
              </div>
            </div>

            {storeBreakdown.length === 0 ? (
              <div className="py-10 text-center text-slate-400 text-xs">
                No store purchase data available yet.
              </div>
            ) : (
              <div className="space-y-3.5">
                {storeBreakdown.map((store) => (
                  <div key={store.name} className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-slate-800 truncate max-w-[150px]">
                        {store.name}
                      </span>
                      <div className="flex items-center gap-2 text-[11px]">
                        <span className="text-slate-400">
                          {store.purchaseCount} item{store.purchaseCount === 1 ? '' : 's'} &bull; {formatPrice(store.totalSpent, store.currency)}
                        </span>
                        <span
                          className={`px-1.5 py-0.2 rounded-md font-bold text-[10px] ${
                            store.claimRate > 50
                              ? 'bg-rose-50 text-rose-700 border border-rose-200'
                              : store.claimRate > 0
                              ? 'bg-amber-50 text-amber-700 border border-amber-200'
                              : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          }`}
                        >
                          {store.claimRate}% returns
                        </span>
                      </div>
                    </div>

                    {/* Progress Bar showing store dispute activity */}
                    <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-300 ${
                          store.claimRate > 50
                            ? 'bg-rose-500'
                            : store.claimRate > 0
                            ? 'bg-amber-500'
                            : 'bg-emerald-400'
                        }`}
                        style={{
                          width: `${Math.max(6, Math.min(100, store.claimRate || 8))}%`,
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="mt-5 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
            <span>Visual merchant ranking</span>
            <Link to="/purchases" className="text-[#7C3AED] hover:underline font-semibold inline-flex items-center gap-1">
              All Purchases →
            </Link>
          </div>
        </div>
      </div>

      {/* Quick Action Navigation Buttons */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Link
          to="/purchases?action=new"
          className="group p-5 bg-white rounded-2xl border border-slate-200/80 shadow-xs hover:border-purple-300 hover:shadow-md transition flex items-center justify-between"
        >
          <div className="flex items-center gap-3.5">
            <div className="w-10 h-10 rounded-xl bg-purple-50 text-[#7C3AED] group-hover:bg-[#7C3AED] group-hover:text-white transition flex items-center justify-center">
              <ShoppingBag className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-sm font-semibold text-[#0F172A] group-hover:text-[#7C3AED] transition">
                Add Purchase
              </h4>
              <p className="text-xs text-slate-500">Record a store receipt or invoice</p>
            </div>
          </div>
          <ArrowUpRight className="w-4 h-4 text-slate-400 group-hover:text-[#7C3AED] transition" />
        </Link>

        <Link
          to="/upload-invoice"
          className="group p-5 bg-white rounded-2xl border border-slate-200/80 shadow-xs hover:border-purple-300 hover:shadow-md transition flex items-center justify-between"
        >
          <div className="flex items-center gap-3.5">
            <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 group-hover:bg-indigo-600 group-hover:text-white transition flex items-center justify-center">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-sm font-semibold text-[#0F172A] group-hover:text-[#7C3AED] transition">
                Scan Invoice
              </h4>
              <p className="text-xs text-slate-500">Upload receipt image or PDF with AI OCR</p>
            </div>
          </div>
          <ArrowUpRight className="w-4 h-4 text-slate-400 group-hover:text-[#7C3AED] transition" />
        </Link>

        <Link
          to="/returns"
          className="group p-5 bg-white rounded-2xl border border-slate-200/80 shadow-xs hover:border-purple-300 hover:shadow-md transition flex items-center justify-between"
        >
          <div className="flex items-center gap-3.5">
            <div className="w-10 h-10 rounded-xl bg-violet-50 text-violet-600 group-hover:bg-violet-600 group-hover:text-white transition flex items-center justify-center">
              <RotateCcw className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-sm font-semibold text-[#0F172A] group-hover:text-[#7C3AED] transition">
                View Returns
              </h4>
              <p className="text-xs text-slate-500">Track pending refund requests & disputes</p>
            </div>
          </div>
          <ArrowUpRight className="w-4 h-4 text-slate-400 group-hover:text-[#7C3AED] transition" />
        </Link>
      </div>

      {/* Activity Feed: Return Deadlines (Next 14 Days) */}
      <ActivityFeed
        items={feedItems}
        loading={feedLoading}
        error={null}
        onRetry={fetchActivityFeed}
      />
    </div>
  );
};

export default Dashboard;
