import React from 'react';
import { Loader2 } from 'lucide-react';

const StatCard = ({
  title,
  value,
  icon: Icon,
  description,
  loading = false,
  badgeText,
  badgeType = 'neutral', // 'neutral' | 'warning' | 'purple' | 'success'
}) => {
  const getBadgeClasses = () => {
    switch (badgeType) {
      case 'warning':
        return 'bg-amber-50 text-amber-700 border-amber-200';
      case 'purple':
        return 'bg-purple-50 text-[#7C3AED] border-purple-200';
      case 'success':
        return 'bg-emerald-50 text-emerald-700 border-emerald-200';
      default:
        return 'bg-slate-100 text-slate-600 border-slate-200';
    }
  };

  return (
    <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-xs hover:shadow-md transition-shadow duration-200">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
            {title}
          </p>
          <div className="mt-2.5 flex items-baseline gap-2">
            {loading ? (
              <div className="h-9 flex items-center">
                <Loader2 className="w-5 h-5 text-[#7C3AED] animate-spin" />
              </div>
            ) : (
              <span className="text-3xl font-bold tracking-tight text-[#0F172A]">
                {value ?? 0}
              </span>
            )}
          </div>
        </div>

        {Icon && (
          <div className="w-11 h-11 rounded-xl bg-purple-50 text-[#7C3AED] flex items-center justify-center shrink-0 border border-purple-100">
            <Icon className="w-5 h-5" />
          </div>
        )}
      </div>

      <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
        <span className="text-slate-500 font-normal">
          {description}
        </span>
        {badgeText && (
          <span className={`px-2 py-0.5 rounded-md border text-[11px] font-medium ${getBadgeClasses()}`}>
            {badgeText}
          </span>
        )}
      </div>
    </div>
  );
};

export default StatCard;
