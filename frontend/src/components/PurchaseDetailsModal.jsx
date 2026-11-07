import React, { useState, useEffect } from 'react';
import {
  X,
  Calendar,
  Store,
  Tag,
  Clock,
  Shield,
  FileText,
  ExternalLink,
  Edit3,
  Trash2,
  AlertTriangle,
  CheckCircle2,
  Download,
  Eye,
  Loader2
} from 'lucide-react';
import { formatDate, formatPrice, getDaysRemaining, getWarrantyStatus } from '../lib/dateUtils';
import { getInvoiceUrl } from '../lib/storageUtils';

const PurchaseDetailsModal = ({ isOpen, onClose, purchase, onEdit, onDelete }) => {
  const [invoiceUrl, setInvoiceUrl] = useState(null);
  const [loadingInvoice, setLoadingInvoice] = useState(false);

  useEffect(() => {
    let isMounted = true;
    if (isOpen && purchase?.invoice_url) {
      setLoadingInvoice(true);
      getInvoiceUrl(purchase.invoice_url)
        .then((url) => {
          if (isMounted) {
            setInvoiceUrl(url);
            setLoadingInvoice(false);
          }
        })
        .catch(() => {
          if (isMounted) setLoadingInvoice(false);
        });
    } else {
      setInvoiceUrl(null);
      setLoadingInvoice(false);
    }
    return () => {
      isMounted = false;
    };
  }, [isOpen, purchase]);

  if (!isOpen || !purchase) return null;

  const returnDaysLeft = getDaysRemaining(purchase.return_deadline);
  const warrantyInfo = getWarrantyStatus(purchase.warranty_expiry);

  // Determine file type from extension
  const isPdf = purchase.invoice_url?.toLowerCase().endsWith('.pdf');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 overflow-y-auto">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs transition-opacity"
        onClick={onClose}
      />

      {/* Modal Container */}
      <div className="relative bg-white rounded-2xl shadow-2xl border border-slate-200/80 w-full max-w-2xl my-8 overflow-hidden z-10 flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="px-6 py-4.5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div className="flex items-center gap-2.5">
            <span className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-purple-50 text-[#7C3AED] border border-purple-100">
              {purchase.category || 'General'}
            </span>
            <span className="text-xs text-slate-400">•</span>
            <span className="text-xs text-slate-500 font-medium">
              Purchased on {formatDate(purchase.purchase_date)}
            </span>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="px-6 py-5 overflow-y-auto flex-1 space-y-6">
          {/* Main Title & Price */}
          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
            <div>
              <h2 className="text-xl font-bold text-[#0F172A] leading-snug">
                {purchase.product_name}
              </h2>
              {purchase.store && (
                <p className="flex items-center gap-1.5 text-xs text-slate-500 mt-1">
                  <Store className="w-3.5 h-3.5 text-slate-400" />
                  <span>Purchased from <strong className="text-slate-700">{purchase.store}</strong></span>
                </p>
              )}
            </div>

            <div className="sm:text-right">
              <span className="text-2xl font-black text-[#0F172A] tracking-tight">
                {formatPrice(purchase.price, purchase.currency)}
              </span>
              <p className="text-[11px] text-slate-400 uppercase tracking-wider font-semibold">
                {purchase.currency || 'USD'}
              </p>
            </div>
          </div>

          {/* Return & Warranty Status Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Return Window Box */}
            <div className="p-4 rounded-xl border border-slate-200/80 bg-slate-50/50 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-600 flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-[#7C3AED]" />
                  Return Window
                </span>
                {returnDaysLeft !== null && (
                  <span
                    className={`px-2.5 py-0.5 rounded-full text-[11px] font-semibold border ${
                      returnDaysLeft < 0
                        ? 'bg-slate-100 text-slate-600 border-slate-200'
                        : returnDaysLeft === 0
                        ? 'bg-rose-50 text-rose-700 border-rose-200 animate-pulse'
                        : returnDaysLeft <= 3
                        ? 'bg-rose-50 text-rose-700 border-rose-200'
                        : returnDaysLeft <= 7
                        ? 'bg-amber-50 text-amber-700 border-amber-200'
                        : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                    }`}
                  >
                    {returnDaysLeft < 0
                      ? 'Expired'
                      : returnDaysLeft === 0
                      ? 'Expires Today'
                      : `${returnDaysLeft} days left`}
                  </span>
                )}
              </div>
              <p className="text-sm font-bold text-slate-800">
                {formatDate(purchase.return_deadline)}
              </p>
              <p className="text-[11px] text-slate-500">
                {returnDaysLeft < 0
                  ? `Return deadline elapsed ${Math.abs(returnDaysLeft)} days ago.`
                  : returnDaysLeft === 0
                  ? 'Last day eligible for refund or store return!'
                  : `Eligible for return or exchange for ${returnDaysLeft} more days.`}
              </p>
            </div>

            {/* Warranty Status Box */}
            <div className="p-4 rounded-xl border border-slate-200/80 bg-slate-50/50 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-600 flex items-center gap-1.5">
                  <Shield className="w-3.5 h-3.5 text-emerald-600" />
                  Warranty Protection
                </span>
                <span
                  className={`px-2.5 py-0.5 rounded-full text-[11px] font-semibold border ${
                    warrantyInfo.status === 'expired'
                      ? 'bg-slate-100 text-slate-600 border-slate-200'
                      : warrantyInfo.status === 'expiring_today' || warrantyInfo.status === 'expiring_soon'
                      ? 'bg-amber-50 text-amber-700 border-amber-200'
                      : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                  }`}
                >
                  {warrantyInfo.label}
                </span>
              </div>
              <p className="text-sm font-bold text-slate-800">
                {formatDate(purchase.warranty_expiry)}
              </p>
              <p className="text-[11px] text-slate-500">
                {warrantyInfo.status === 'expired'
                  ? 'Manufacturer warranty has expired.'
                  : `Warranty coverage remains active until ${formatDate(purchase.warranty_expiry)}.`}
              </p>
            </div>
          </div>

          {/* Invoice Attachment Preview */}
          <div className="space-y-3">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
              <FileText className="w-3.5 h-3.5 text-slate-400" />
              Receipt / Invoice Document
            </h4>

            {loadingInvoice ? (
              <div className="h-40 rounded-xl border border-slate-200 flex flex-col items-center justify-center gap-2 bg-slate-50 text-slate-400">
                <Loader2 className="w-6 h-6 animate-spin text-[#7C3AED]" />
                <span className="text-xs">Loading secure invoice URL...</span>
              </div>
            ) : invoiceUrl ? (
              <div className="rounded-xl border border-slate-200 p-3 bg-slate-50 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 truncate text-xs text-slate-700">
                    <FileText className="w-4 h-4 text-[#7C3AED] shrink-0" />
                    <span className="font-medium truncate">
                      {purchase.invoice_url.split('/').pop()}
                    </span>
                  </div>
                  <a
                    href={invoiceUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-xs font-semibold text-[#7C3AED] hover:text-purple-700 transition"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    Open in new tab
                  </a>
                </div>

                {/* If image, display inline preview */}
                {!isPdf && (
                  <div className="relative rounded-lg overflow-hidden border border-slate-200 bg-white max-h-72 flex items-center justify-center">
                    <img
                      src={invoiceUrl}
                      alt="Purchase Invoice Receipt"
                      className="max-h-72 w-auto object-contain"
                    />
                  </div>
                )}
              </div>
            ) : (
              <div className="p-6 rounded-xl border border-dashed border-slate-200 text-center bg-slate-50/50">
                <FileText className="w-6 h-6 text-slate-300 mx-auto mb-1.5" />
                <p className="text-xs font-medium text-slate-600">
                  No invoice attached to this purchase
                </p>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Click 'Edit' below to upload a receipt image or PDF file.
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Footer Actions */}
        <div className="px-6 py-4 border-t border-slate-100 flex items-center justify-between bg-slate-50/50">
          <button
            onClick={() => {
              onClose();
              onDelete(purchase);
            }}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-rose-600 hover:bg-rose-50 rounded-xl transition"
          >
            <Trash2 className="w-3.5 h-3.5" />
            Delete
          </button>

          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                onClose();
                onEdit(purchase);
              }}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-[#0F172A] bg-white border border-slate-200 hover:bg-slate-50 rounded-xl shadow-xs transition"
            >
              <Edit3 className="w-3.5 h-3.5" />
              Edit
            </button>
            <button
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-white bg-[#7C3AED] hover:bg-purple-700 rounded-xl shadow-xs transition"
            >
              Done
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PurchaseDetailsModal;
