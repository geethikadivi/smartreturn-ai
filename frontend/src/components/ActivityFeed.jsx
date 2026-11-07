import React from 'react';
import { Calendar, Clock, AlertTriangle, ArrowRight, ShoppingBag, Store } from 'lucide-react';
import { Link } from 'react-router-dom';
import { formatDate, formatPrice, getDaysRemaining } from '../lib/dateUtils';

const ActivityFeed = ({ items, loading, error, onRetry }) => {

  return (
    <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-xs">
      <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-5">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-lg bg-purple-50 text-[#7C3AED]">
            <Clock className="w-4 h-4" />
          </div>
          <div>
            <h3 className="font-semibold text-slate-900 text-sm">
              Upcoming Return Deadlines
            </h3>
            <p className="text-xs text-slate-500">
              Purchases with return windows ending in the next 14 days
            </p>
          </div>
        </div>
        <Link
          to="/purchases"
          className="text-xs font-medium text-[#7C3AED] hover:text-purple-700 inline-flex items-center gap-1 transition"
        >
          View all purchases
          <ArrowRight className="w-3.5 h-3.5" />
        </Link>
      </div>

      {/* 1. Loading State */}
      {loading && (
        <div className="space-y-3 py-2">
          {[1, 2, 3].map((skeletonId) => (
            <div
              key={skeletonId}
              className="p-4 rounded-xl border border-slate-100 bg-slate-50/50 animate-pulse flex items-center justify-between"
            >
              <div className="space-y-2 flex-1">
                <div className="h-4 bg-slate-200 rounded-md w-1/3" />
                <div className="h-3 bg-slate-200 rounded-md w-1/4" />
              </div>
              <div className="h-6 bg-slate-200 rounded-md w-24" />
            </div>
          ))}
        </div>
      )}

      {/* 2. Error State */}
      {!loading && error && (
        <div className="p-5 rounded-xl bg-rose-50 border border-rose-200 text-center my-2">
          <div className="inline-flex p-2.5 rounded-full bg-rose-100 text-rose-600 mb-2">
            <AlertTriangle className="w-5 h-5" />
          </div>
          <p className="text-sm font-semibold text-rose-800">
            Failed to load upcoming deadlines
          </p>
          <p className="text-xs text-rose-600 mt-1 max-w-sm mx-auto">
            {error}
          </p>
          {onRetry && (
            <button
              onClick={onRetry}
              className="mt-3 px-3.5 py-1.5 bg-rose-600 text-white rounded-lg text-xs font-medium hover:bg-rose-700 transition"
            >
              Try Again
            </button>
          )}
        </div>
      )}

      {/* 3. Empty State */}
      {!loading && !error && items.length === 0 && (
        <div className="text-center py-12 px-4 rounded-xl border border-dashed border-slate-200 bg-slate-50/50">
          <div className="inline-flex p-3 rounded-full bg-purple-50 text-[#7C3AED] mb-3">
            <Calendar className="w-6 h-6" />
          </div>
          <p className="text-sm font-semibold text-slate-800">
            No active return deadlines
          </p>
          <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
            None of your registered purchases have return deadlines within the next 14 days.
          </p>
          <Link
            to="/purchases?action=new"
            className="mt-4 inline-flex items-center gap-1.5 px-4 py-2 bg-[#7C3AED] text-white text-xs font-semibold rounded-xl hover:bg-purple-700 transition shadow-xs"
          >
            <ShoppingBag className="w-3.5 h-3.5" />
            Add a Purchase
          </Link>
        </div>
      )}

      {/* 4. Populated List */}
      {!loading && !error && items.length > 0 && (
        <div className="space-y-3">
          {items.map((purchase) => {
            const daysLeft = getDaysRemaining(purchase.return_deadline);
            const isUrgent = daysLeft !== null && daysLeft <= 3;

            return (
              <div
                key={purchase.id}
                className="p-4 rounded-xl border border-slate-200/80 hover:border-purple-200 hover:bg-purple-50/20 transition flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white"
              >
                <div className="flex items-start gap-3">
                  <div className="p-2.5 rounded-lg bg-slate-100 text-slate-700 mt-0.5 shrink-0">
                    <ShoppingBag className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="text-sm font-semibold text-slate-900 leading-tight">
                      {purchase.product_name}
                    </h4>
                    <div className="flex items-center gap-3 mt-1.5 text-xs text-slate-500">
                      {purchase.store && (
                        <span className="flex items-center gap-1">
                          <Store className="w-3 h-3 text-slate-400" />
                          {purchase.store}
                        </span>
                      )}
                      {purchase.price && (
                        <span className="font-medium text-slate-700">
                          {formatPrice(purchase.price, purchase.currency)}
                        </span>
                      )}
                      <span>
                        Deadline: <strong className="text-slate-700">{formatDate(purchase.return_deadline)}</strong>
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center sm:self-center gap-2">
                  <span
                    className={`px-3 py-1 rounded-full text-xs font-medium border shrink-0 ${
                      isUrgent
                        ? 'bg-rose-50 text-rose-700 border-rose-200 animate-pulse'
                        : 'bg-amber-50 text-amber-700 border-amber-200'
                    }`}
                  >
                    {daysLeft === 0
                      ? 'Expires Today'
                      : daysLeft === 1
                      ? '1 day remaining'
                      : `${daysLeft} days remaining`}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default ActivityFeed;
