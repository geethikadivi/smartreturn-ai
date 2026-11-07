import React, { useState, useEffect } from 'react';
import {
  X,
  Upload,
  Calendar,
  DollarSign,
  Store,
  Tag,
  Shield,
  Clock,
  FileText,
  AlertCircle,
  Loader2,
  Trash2,
  CheckCircle2,
  ArrowRight
} from 'lucide-react';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../context/AuthContext';
import { getTodayString, addDays, addMonths, formatDate } from '../lib/dateUtils';
import { uploadInvoiceFile, getInvoiceUrl } from '../lib/storageUtils';

const CATEGORIES = [
  'Electronics',
  'Clothing & Apparel',
  'Home & Kitchen',
  'Computers & Tech',
  'Books & Media',
  'Groceries',
  'Beauty & Health',
  'Sports & Outdoors',
  'Automotive',
  'Other',
];

const CURRENCIES = [
  { code: 'USD', symbol: '$', label: 'USD ($)' },
  { code: 'INR', symbol: '₹', label: 'INR (₹)' },
  { code: 'EUR', symbol: '€', label: 'EUR (€)' },
  { code: 'GBP', symbol: '£', label: 'GBP (£)' },
];

const PurchaseFormModal = ({ isOpen, onClose, onSuccess, initialData = null }) => {
  const { user } = useAuth();
  const isEditing = Boolean(initialData?.id);

  // Form Fields
  const [productName, setProductName] = useState('');
  const [store, setStore] = useState('');
  const [category, setCategory] = useState('Electronics');
  const [price, setPrice] = useState('');
  const [currency, setCurrency] = useState('USD');
  const [purchaseDate, setPurchaseDate] = useState(getTodayString());
  const [returnDays, setReturnDays] = useState(30);
  const [warrantyMonths, setWarrantyMonths] = useState(12);

  // Derived or custom dates
  const [returnDeadline, setReturnDeadline] = useState('');
  const [warrantyExpiry, setWarrantyExpiry] = useState('');
  const [customDeadlineToggle, setCustomDeadlineToggle] = useState(false);

  // File Upload state
  const [file, setFile] = useState(null);
  const [existingInvoiceUrl, setExistingInvoiceUrl] = useState('');
  const [existingInvoicePreview, setExistingInvoicePreview] = useState(null);
  const [removeExistingInvoice, setRemoveExistingInvoice] = useState(false);

  // Submission state
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // Initialize or reset form when modal opens or initialData changes
  useEffect(() => {
    if (isOpen) {
      setErrorMsg('');
      setRemoveExistingInvoice(false);
      setFile(null);

      if (initialData) {
        setProductName(initialData.product_name || '');
        setStore(initialData.store || '');
        setCategory(initialData.category || 'Electronics');
        setPrice(initialData.price !== null && initialData.price !== undefined ? initialData.price : '');
        setCurrency(initialData.currency || 'USD');
        const pDate = initialData.purchase_date || getTodayString();
        setPurchaseDate(pDate);

        // Check if return_deadline matches default 30 days
        const rDeadline = initialData.return_deadline || addDays(pDate, 30);
        setReturnDeadline(rDeadline);

        // Calculate approximate days for input
        if (initialData.purchase_date && initialData.return_deadline) {
          const p = new Date(initialData.purchase_date);
          const r = new Date(initialData.return_deadline);
          const diffDays = Math.round((r - p) / (1000 * 60 * 60 * 24));
          setReturnDays(diffDays > 0 ? diffDays : 30);
        } else {
          setReturnDays(30);
        }

        const wExpiry = initialData.warranty_expiry || addMonths(pDate, 12);
        setWarrantyExpiry(wExpiry);

        if (initialData.purchase_date && initialData.warranty_expiry) {
          const p = new Date(initialData.purchase_date);
          const w = new Date(initialData.warranty_expiry);
          const diffMonths = Math.round((w - p) / (1000 * 60 * 60 * 24 * 30.4));
          setWarrantyMonths(diffMonths > 0 ? diffMonths : 12);
        } else {
          setWarrantyMonths(12);
        }

        setExistingInvoiceUrl(initialData.invoice_url || '');
        if (initialData.invoice_url) {
          getInvoiceUrl(initialData.invoice_url).then((url) => {
            setExistingInvoicePreview(url);
          });
        } else {
          setExistingInvoicePreview(null);
        }
      } else {
        // Defaults for new purchase
        const today = getTodayString();
        setProductName('');
        setStore('');
        setCategory('Electronics');
        setPrice('');
        setCurrency('USD');
        setPurchaseDate(today);
        setReturnDays(30);
        setWarrantyMonths(12);
        setReturnDeadline(addDays(today, 30));
        setWarrantyExpiry(addMonths(today, 12));
        setExistingInvoiceUrl('');
        setExistingInvoicePreview(null);
        setCustomDeadlineToggle(false);
      }
    }
  }, [isOpen, initialData]);

  // Recalculate auto return_deadline when purchaseDate or returnDays changes
  const handlePurchaseDateChange = (newDate) => {
    setPurchaseDate(newDate);
    if (!customDeadlineToggle) {
      setReturnDeadline(addDays(newDate, returnDays));
      setWarrantyExpiry(addMonths(newDate, warrantyMonths));
    }
  };

  const handleReturnDaysChange = (days) => {
    const numDays = Math.max(0, parseInt(days) || 0);
    setReturnDays(numDays);
    if (!customDeadlineToggle) {
      setReturnDeadline(addDays(purchaseDate, numDays));
    }
  };

  const handleWarrantyMonthsChange = (months) => {
    const numMonths = Math.max(0, parseInt(months) || 0);
    setWarrantyMonths(numMonths);
    if (!customDeadlineToggle) {
      setWarrantyExpiry(addMonths(purchaseDate, numMonths));
    }
  };

  const handleFileChange = (e) => {
    const selected = e.target.files?.[0];
    if (selected) {
      // Validate file size (< 10MB)
      if (selected.size > 10 * 1024 * 1024) {
        setErrorMsg('Receipt file must be smaller than 10MB.');
        return;
      }
      setFile(selected);
      setErrorMsg('');
      setRemoveExistingInvoice(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg('');

    if (!productName.trim()) {
      setErrorMsg('Product name is required.');
      return;
    }

    if (!purchaseDate) {
      setErrorMsg('Purchase date is required.');
      return;
    }

    setLoading(true);
    try {
      let finalInvoiceUrl = removeExistingInvoice ? null : existingInvoiceUrl;

      // 1. Upload new invoice file if chosen
      if (file && user?.id) {
        const uploadResult = await uploadInvoiceFile(file, user.id);
        finalInvoiceUrl = uploadResult.path;
      }

      // 2. Prepare payload
      const purchasePayload = {
        user_id: user.id,
        product_name: productName.trim(),
        store: store.trim() || null,
        category: category || 'Other',
        price: price !== '' && !isNaN(Number(price)) ? Number(price) : null,
        currency: currency || 'USD',
        purchase_date: purchaseDate,
        return_deadline: returnDeadline || addDays(purchaseDate, returnDays),
        warranty_expiry: warrantyExpiry || addMonths(purchaseDate, warrantyMonths),
        invoice_url: finalInvoiceUrl,
      };

      if (isEditing) {
        // Update existing record
        const { error } = await supabase
          .from('purchases')
          .update(purchasePayload)
          .eq('id', initialData.id);

        if (error) throw error;
      } else {
        // Insert new record
        const { error } = await supabase
          .from('purchases')
          .insert(purchasePayload);

        if (error) throw error;
      }

      onSuccess();
      onClose();
    } catch (err) {
      console.error('Error saving purchase:', err);
      setErrorMsg(err.message || 'Failed to save purchase. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 overflow-y-auto">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs transition-opacity"
        onClick={onClose}
      />

      {/* Modal Container */}
      <div className="relative bg-white rounded-2xl shadow-2xl border border-slate-200/80 w-full max-w-2xl my-8 overflow-hidden z-10 flex flex-col max-h-[92vh]">
        {/* Modal Header */}
        <div className="px-6 py-4.5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div>
            <h3 className="text-lg font-bold text-[#0F172A]">
              {isEditing ? 'Edit Purchase' : 'Add New Purchase'}
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              {isEditing
                ? 'Update purchase details, return window, or receipt invoice.'
                : 'Enter your receipt details to automatically track return deadlines.'}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition"
            aria-label="Close modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body / Scrollable Form */}
        <div className="px-6 py-5 overflow-y-auto flex-1">
          {errorMsg && (
            <div className="mb-4 p-3.5 rounded-xl bg-rose-50 border border-rose-200 flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <p className="text-xs text-rose-700 font-medium leading-relaxed">
                {errorMsg}
              </p>
            </div>
          )}

          <form id="purchase-form" onSubmit={handleSubmit} className="space-y-4.5">
            {/* Row 1: Product Name */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Product Name <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                value={productName}
                onChange={(e) => setProductName(e.target.value)}
                placeholder="e.g. Sony WH-1000XM5 Wireless Headphones"
                className="w-full px-3.5 py-2.5 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-[#7C3AED] focus:border-transparent transition"
              />
            </div>

            {/* Row 2: Store/Retailer & Category */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Store / Retailer
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                    <Store className="w-3.5 h-3.5" />
                  </div>
                  <input
                    type="text"
                    value={store}
                    onChange={(e) => setStore(e.target.value)}
                    placeholder="e.g. Best Buy, Amazon, Apple"
                    className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-[#7C3AED] focus:border-transparent transition"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Category
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                    <Tag className="w-3.5 h-3.5" />
                  </div>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-[#7C3AED] focus:border-transparent transition bg-white"
                  >
                    {CATEGORIES.map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {/* Row 3: Price & Currency */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Purchase Price
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                    <DollarSign className="w-3.5 h-3.5" />
                  </div>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={price}
                    onChange={(e) => setPrice(e.target.value)}
                    placeholder="299.99"
                    className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-[#7C3AED] focus:border-transparent transition"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Currency
                </label>
                <select
                  value={currency}
                  onChange={(e) => setCurrency(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-[#7C3AED] focus:border-transparent transition bg-white"
                >
                  {CURRENCIES.map((cur) => (
                    <option key={cur.code} value={cur.code}>
                      {cur.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Row 4: Purchase Date & Automatic Period Calculations */}
            <div className="p-4 bg-slate-50/80 rounded-2xl border border-slate-200/70 space-y-3.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-800 flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-[#7C3AED]" />
                  Dates & Countdown Windows
                </span>
                <button
                  type="button"
                  onClick={() => setCustomDeadlineToggle(!customDeadlineToggle)}
                  className="text-[11px] text-[#7C3AED] hover:underline font-medium"
                >
                  {customDeadlineToggle ? 'Auto-calculate from windows' : 'Set custom exact dates'}
                </button>
              </div>

              {/* Purchase Date */}
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                  Purchase Date <span className="text-rose-500">*</span>
                </label>
                <input
                  type="date"
                  required
                  value={purchaseDate}
                  onChange={(e) => handlePurchaseDateChange(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-[#7C3AED] bg-white transition"
                />
              </div>

              {/* Return Window & Warranty Periods */}
              {!customDeadlineToggle ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                      Return Window (Days)
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        min="0"
                        value={returnDays}
                        onChange={(e) => handleReturnDaysChange(e.target.value)}
                        className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-[#7C3AED] bg-white transition"
                      />
                      <span className="text-xs text-slate-400">days</span>
                    </div>
                    <div className="mt-1.5 flex items-center gap-1 text-[11px] text-purple-700 bg-purple-50 px-2 py-1 rounded-md border border-purple-100">
                      <Clock className="w-3 h-3 shrink-0" />
                      <span>Deadline: <strong>{formatDate(returnDeadline)}</strong></span>
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                      Warranty Period (Months)
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        min="0"
                        value={warrantyMonths}
                        onChange={(e) => handleWarrantyMonthsChange(e.target.value)}
                        className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-[#7C3AED] bg-white transition"
                      />
                      <span className="text-xs text-slate-400">months</span>
                    </div>
                    <div className="mt-1.5 flex items-center gap-1 text-[11px] text-emerald-700 bg-emerald-50 px-2 py-1 rounded-md border border-emerald-100">
                      <Shield className="w-3 h-3 shrink-0" />
                      <span>Expiry: <strong>{formatDate(warrantyExpiry)}</strong></span>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                      Exact Return Deadline
                    </label>
                    <input
                      type="date"
                      value={returnDeadline}
                      onChange={(e) => setReturnDeadline(e.target.value)}
                      className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-[#7C3AED] bg-white transition"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                      Exact Warranty Expiry Date
                    </label>
                    <input
                      type="date"
                      value={warrantyExpiry}
                      onChange={(e) => setWarrantyExpiry(e.target.value)}
                      className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-[#7C3AED] bg-white transition"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Row 5: Invoice File Upload to Supabase Storage 'invoices' */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Receipt / Invoice Attachment
              </label>

              {/* Existing invoice info if editing */}
              {existingInvoiceUrl && !removeExistingInvoice && !file && (
                <div className="mb-2 p-3 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2 text-slate-700 truncate max-w-xs sm:max-w-md">
                    <FileText className="w-4 h-4 text-[#7C3AED] shrink-0" />
                    <span className="truncate font-medium">
                      {existingInvoiceUrl.split('/').pop() || 'Current Invoice'}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    {existingInvoicePreview && (
                      <a
                        href={existingInvoicePreview}
                        target="_blank"
                        rel="noreferrer"
                        className="text-[11px] text-[#7C3AED] hover:underline font-medium"
                      >
                        Preview
                      </a>
                    )}
                    <button
                      type="button"
                      onClick={() => setRemoveExistingInvoice(true)}
                      className="p-1 text-rose-500 hover:text-rose-700 rounded transition"
                      title="Remove invoice"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              )}

              {/* Upload Input */}
              <div className="relative border-2 border-dashed border-slate-200 hover:border-[#7C3AED] rounded-xl p-4 text-center transition bg-slate-50/50">
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp,application/pdf"
                  onChange={handleFileChange}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                />
                <div className="flex flex-col items-center justify-center">
                  <Upload className="w-6 h-6 text-slate-400 mb-1.5" />
                  <p className="text-xs font-medium text-slate-700">
                    {file ? file.name : 'Click or drag receipt image or PDF'}
                  </p>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    {file
                      ? `${(file.size / (1024 * 1024)).toFixed(2)} MB • Ready to upload`
                      : 'JPG, PNG, WEBP, or PDF up to 10MB'}
                  </p>
                </div>
              </div>

              {file && (
                <div className="mt-2 flex items-center justify-between text-xs text-emerald-700 bg-emerald-50 px-3 py-1.5 rounded-lg border border-emerald-200">
                  <span className="flex items-center gap-1.5 truncate">
                    <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                    New receipt selected: {file.name}
                  </span>
                  <button
                    type="button"
                    onClick={() => setFile(null)}
                    className="text-slate-500 hover:text-rose-600 transition"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
            </div>
          </form>
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-4 border-t border-slate-100 flex items-center justify-end gap-2.5 bg-slate-50/50">
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="px-4 py-2 rounded-xl text-xs font-medium text-slate-600 hover:bg-slate-200/60 transition"
          >
            Cancel
          </button>
          <button
            type="submit"
            form="purchase-form"
            disabled={loading}
            className="inline-flex items-center gap-2 px-5 py-2 rounded-xl text-xs font-semibold text-white bg-[#7C3AED] hover:bg-purple-700 active:bg-purple-800 disabled:opacity-50 transition shadow-sm"
          >
            {loading ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>{isEditing ? 'Updating...' : 'Saving...'}</span>
              </>
            ) : (
              <>
                <span>{isEditing ? 'Save Changes' : 'Add Purchase'}</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default PurchaseFormModal;
