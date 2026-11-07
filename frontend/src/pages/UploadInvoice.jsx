import React, { useState, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  UploadCloud,
  FileText,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  X,
  Loader2,
  Calendar,
  DollarSign,
  Store,
  Tag,
  Clock,
  Shield,
  ArrowRight,
  Eye,
  RefreshCw,
  Cpu
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabaseClient';
import { getTodayString, addDays, addMonths, formatDate } from '../lib/dateUtils';
import { uploadInvoiceFile } from '../lib/storageUtils';

const CATEGORIES = [
  'Electronics',
  'Clothing',
  'Home',
  'Books',
  'Other',
];

const CURRENCIES = [
  { code: 'USD', symbol: '$' },
  { code: 'INR', symbol: '₹' },
  { code: 'EUR', symbol: '€' },
  { code: 'GBP', symbol: '£' },
];

const UploadInvoice = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const fileInputRef = useRef(null);

  const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:8000';

  // File state
  const [file, setFile] = useState(null);
  const [filePreview, setFilePreview] = useState(null);
  const [isDragOver, setIsDragOver] = useState(false);

  // AI Extraction state
  const [extracting, setExtracting] = useState(false);
  const [extractError, setExtractError] = useState('');
  const [extractedData, setExtractedData] = useState(null);

  // Form review state (editable after extraction)
  const [productName, setProductName] = useState('');
  const [storeName, setStoreName] = useState('');
  const [category, setCategory] = useState('Electronics');
  const [price, setPrice] = useState('');
  const [currency, setCurrency] = useState('USD');
  const [purchaseDate, setPurchaseDate] = useState(getTodayString());
  const [returnDays, setReturnDays] = useState(30);
  const [warrantyMonths, setWarrantyMonths] = useState(12);

  // Saving state
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [saveError, setSaveError] = useState('');

  // Handle file selection
  const handleFileSelect = (selectedFile) => {
    if (!selectedFile) return;

    // Validate type
    const validTypes = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
    if (!validTypes.includes(selectedFile.type)) {
      setExtractError('Please upload a JPEG, PNG, WEBP image or a PDF document.');
      return;
    }

    // Validate size (15MB)
    if (selectedFile.size > 15 * 1024 * 1024) {
      setExtractError('File size exceeds the 15MB limit.');
      return;
    }

    setFile(selectedFile);
    setExtractError('');
    setExtractedData(null);

    // Create preview for images
    if (selectedFile.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = (e) => setFilePreview(e.target.result);
      reader.readAsDataURL(selectedFile);
    } else {
      setFilePreview(null);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragOver(false);
    const droppedFile = e.dataTransfer.files?.[0];
    if (droppedFile) {
      handleFileSelect(droppedFile);
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = () => {
    setIsDragOver(false);
  };

  const handleRemoveFile = () => {
    setFile(null);
    setFilePreview(null);
    setExtractedData(null);
    setExtractError('');
    setSaveError('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // Trigger FastAPI AI OCR Extraction
  const handleExtract = async () => {
    if (!file) return;

    setExtracting(true);
    setExtractError('');
    setSaveError('');

    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await fetch(`${apiUrl}/api/invoices/extract`, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        let errDetail = 'Failed to extract invoice data.';
        try {
          const errData = await response.json();
          errDetail = errData.detail || errDetail;
        } catch {
          errDetail = `Server returned error (${response.status}: ${response.statusText})`;
        }
        throw new Error(errDetail);
      }

      const data = await response.json();
      setExtractedData(data);

      // Populate review form with extracted values
      setProductName(data.product_name || 'Purchased Item');
      setStoreName(data.store_name || '');
      setCategory(data.category || 'Other');
      setPrice(data.price !== undefined && data.price !== null ? data.price : '');
      setCurrency(data.currency || 'USD');
      setPurchaseDate(data.purchase_date || getTodayString());
      setReturnDays(data.return_days || 30);
      setWarrantyMonths(data.warranty_months || 12);
    } catch (err) {
      console.error('Invoice extraction error:', err);
      setExtractError(
        err.message ||
        'Unable to connect to the backend AI extraction service. Please verify that FastAPI is running and your GEMINI_API_KEY is configured in backend/.env.'
      );
    } finally {
      setExtracting(false);
    }
  };

  // Confirm and Save to Supabase Storage & Database
  const handleConfirmAndSave = async (e) => {
    e.preventDefault();
    if (!user?.id) {
      setSaveError('You must be logged in to save purchases.');
      return;
    }

    if (!productName.trim()) {
      setSaveError('Product name is required.');
      return;
    }

    setSaving(true);
    setSaveError('');

    try {
      let invoiceStoragePath = null;

      // 1. Upload original receipt file to Supabase Storage 'invoices' bucket
      if (file) {
        const uploadRes = await uploadInvoiceFile(file, user.id);
        invoiceStoragePath = uploadRes.path;
      }

      // 2. Compute return deadline & warranty expiry dates
      const calculatedReturnDeadline = addDays(purchaseDate, returnDays);
      const calculatedWarrantyExpiry = addMonths(purchaseDate, warrantyMonths);

      // 3. Insert purchase record into public.purchases
      const { error: insertError } = await supabase
        .from('purchases')
        .insert({
          user_id: user.id,
          product_name: productName.trim(),
          store: storeName.trim() || null,
          category: category || 'Other',
          price: price !== '' && !isNaN(Number(price)) ? Number(price) : null,
          currency: currency || 'USD',
          purchase_date: purchaseDate,
          return_deadline: calculatedReturnDeadline,
          warranty_expiry: calculatedWarrantyExpiry,
          invoice_url: invoiceStoragePath,
        });

      if (insertError) throw insertError;

      setSaveSuccess(true);
      // Navigate to Purchases page after short success notice
      setTimeout(() => {
        navigate('/purchases');
      }, 1200);
    } catch (err) {
      console.error('Error saving purchase:', err);
      setSaveError(err.message || 'Failed to save purchase to database.');
    } finally {
      setSaving(false);
    }
  };

  // Live calculated deadline previews
  const liveReturnDeadline = addDays(purchaseDate, returnDays);
  const liveWarrantyExpiry = addMonths(purchaseDate, warrantyMonths);

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="pb-2">
        <div className="flex items-center gap-2">
          <span className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-purple-50 text-[#7C3AED] border border-purple-100 flex items-center gap-1">
            <Sparkles className="w-3.5 h-3.5" />
            Gemini Multimodal OCR
          </span>
        </div>
        <h1 className="text-2xl font-bold tracking-tight text-[#0F172A] mt-2">
          Scan & Extract Invoice
        </h1>
        <p className="text-sm text-slate-500 mt-1">
          Upload any store receipt or invoice. Google Gemini AI will extract item details, pricing, return windows, and warranty clauses automatically.
        </p>
      </div>

      {/* Success Notification */}
      {saveSuccess && (
        <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 flex items-center gap-3">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
          <div className="text-xs text-emerald-800">
            <span className="font-bold">Purchase saved successfully!</span> Redirecting to My Purchases...
          </div>
        </div>
      )}

      {/* Global Extraction Error Banner */}
      {extractError && (
        <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
          <div className="text-xs text-rose-800 flex-1">
            <p className="font-semibold">AI Extraction Notice:</p>
            <p className="mt-0.5 leading-relaxed">{extractError}</p>
          </div>
        </div>
      )}

      {/* Main Grid: Upload Dropzone & AI Preview */}
      {!extractedData ? (
        <div className="bg-white rounded-2xl border border-slate-200/80 p-8 shadow-xs space-y-6">
          {/* Dropzone Container */}
          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => !file && fileInputRef.current?.click()}
            className={`relative rounded-2xl border-2 border-dashed p-8 md:p-12 text-center transition ${
              isDragOver
                ? 'border-[#7C3AED] bg-purple-50/40'
                : file
                ? 'border-purple-200 bg-purple-50/20'
                : 'border-slate-300 hover:border-[#7C3AED] bg-slate-50/50 cursor-pointer'
            }`}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept="image/png,image/jpeg,image/webp,application/pdf"
              onChange={(e) => handleFileSelect(e.target.files?.[0])}
              className="hidden"
            />

            {/* Empty State Prompt */}
            {!file && (
              <div className="flex flex-col items-center justify-center space-y-3">
                <div className="w-16 h-16 rounded-2xl bg-purple-50 text-[#7C3AED] flex items-center justify-center shadow-xs border border-purple-100">
                  <UploadCloud className="w-8 h-8" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-800">
                    Drop your receipt or click to browse
                  </h3>
                  <p className="text-xs text-slate-500 mt-1">
                    Supports JPG, PNG, WEBP images and PDF invoices up to 15MB
                  </p>
                </div>
                <div className="pt-2 flex items-center gap-3 text-xs text-slate-400">
                  <span>Physical Store Receipts</span>
                  <span>&bull;</span>
                  <span>E-Commerce Invoices</span>
                  <span>&bull;</span>
                  <span>Order Confirmations</span>
                </div>
              </div>
            )}

            {/* Selected File State */}
            {file && (
              <div className="space-y-4">
                <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                  {/* Thumbnail Preview */}
                  {filePreview ? (
                    <div className="relative w-28 h-36 rounded-xl overflow-hidden border border-slate-200 shadow-xs bg-white shrink-0">
                      <img
                        src={filePreview}
                        alt="Receipt preview"
                        className="w-full h-full object-cover"
                      />
                      {extracting && (
                        <div className="absolute inset-0 bg-purple-900/30 backdrop-blur-xs flex items-center justify-center">
                          <Loader2 className="w-6 h-6 text-white animate-spin" />
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="w-20 h-24 rounded-xl bg-purple-50 border border-purple-200 flex flex-col items-center justify-center text-[#7C3AED] shrink-0">
                      <FileText className="w-8 h-8" />
                      <span className="text-[10px] font-bold mt-1 uppercase">PDF</span>
                    </div>
                  )}

                  {/* File Info */}
                  <div className="text-center sm:text-left">
                    <p className="text-sm font-bold text-slate-900 truncate max-w-xs sm:max-w-md">
                      {file.name}
                    </p>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {(file.size / (1024 * 1024)).toFixed(2)} MB &bull; {file.type || 'Document'}
                    </p>
                    <div className="mt-3 flex items-center justify-center sm:justify-start gap-2">
                      <button
                        type="button"
                        onClick={handleRemoveFile}
                        disabled={extracting}
                        className="px-3 py-1.5 rounded-lg text-xs font-medium text-rose-600 hover:bg-rose-50 border border-rose-200 transition"
                      >
                        Remove file
                      </button>
                    </div>
                  </div>
                </div>

                {/* Animated Scanning Effect during Gemini Extraction */}
                {extracting && (
                  <div className="relative p-5 rounded-xl bg-slate-900 text-white overflow-hidden max-w-md mx-auto shadow-md">
                    <div className="flex items-center gap-3">
                      <Cpu className="w-5 h-5 text-[#7C3AED] animate-pulse" />
                      <div className="text-left">
                        <p className="text-xs font-semibold">Gemini AI OCR in progress...</p>
                        <p className="text-[11px] text-slate-400">
                          Reading text, parsing items, return deadlines, and warranty terms.
                        </p>
                      </div>
                    </div>
                    {/* Glowing animated scanline */}
                    <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-purple-500 via-indigo-400 to-purple-500 animate-pulse" />
                  </div>
                )}

                {/* AI Action Button */}
                {!extracting && (
                  <div className="pt-2">
                    <button
                      type="button"
                      onClick={handleExtract}
                      className="inline-flex items-center gap-2 px-6 py-3 rounded-xl text-xs font-bold text-white bg-[#7C3AED] hover:bg-purple-700 active:bg-purple-800 shadow-md shadow-purple-500/20 transition"
                    >
                      <Sparkles className="w-4 h-4" />
                      Extract with AI
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      ) : (
        /* Review & Confirmation Panel */
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left Column: Receipt Preview */}
          <div className="lg:col-span-5 space-y-4">
            <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-3">
                <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                  <Eye className="w-4 h-4 text-[#7C3AED]" />
                  Uploaded Receipt
                </span>
                <button
                  type="button"
                  onClick={handleRemoveFile}
                  className="text-xs text-slate-500 hover:text-slate-800 font-medium"
                >
                  Change file
                </button>
              </div>

              {filePreview ? (
                <div className="rounded-xl overflow-hidden border border-slate-200 bg-slate-50 max-h-96 flex items-center justify-center">
                  <img
                    src={filePreview}
                    alt="Receipt preview"
                    className="max-h-96 w-auto object-contain"
                  />
                </div>
              ) : (
                <div className="p-8 rounded-xl bg-slate-50 border border-slate-200 text-center">
                  <FileText className="w-10 h-10 text-purple-600 mx-auto mb-2" />
                  <p className="text-xs font-semibold text-slate-800 truncate">{file?.name}</p>
                  <p className="text-[11px] text-slate-500 mt-0.5">PDF Receipt Document</p>
                </div>
              )}

              <div className="mt-4 p-3 rounded-xl bg-purple-50 border border-purple-100 flex items-center gap-2 text-xs text-purple-900">
                <Sparkles className="w-4 h-4 text-[#7C3AED] shrink-0" />
                <span>
                  Extracted automatically with <strong>Gemini Multimodal AI</strong>
                </span>
              </div>
            </div>
          </div>

          {/* Right Column: Editable Review Form */}
          <div className="lg:col-span-7">
            <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-xs">
              <div className="pb-3 border-b border-slate-100 mb-4 flex items-center justify-between">
                <div>
                  <h3 className="text-base font-bold text-[#0F172A]">
                    Review Extracted Details
                  </h3>
                  <p className="text-xs text-slate-500">
                    Verify and adjust any extracted purchase or warranty information.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleExtract}
                  disabled={extracting}
                  className="text-xs font-medium text-[#7C3AED] hover:underline flex items-center gap-1"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${extracting ? 'animate-spin' : ''}`} />
                  Re-analyze
                </button>
              </div>

              {saveError && (
                <div className="mb-4 p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-700 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{saveError}</span>
                </div>
              )}

              <form onSubmit={handleConfirmAndSave} className="space-y-4">
                {/* Product Name */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Product / Item Name <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={productName}
                    onChange={(e) => setProductName(e.target.value)}
                    placeholder="Product name"
                    className="w-full px-3.5 py-2.5 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-[#7C3AED] transition"
                  />
                </div>

                {/* Store & Category */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Store / Merchant
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                        <Store className="w-3.5 h-3.5" />
                      </div>
                      <input
                        type="text"
                        value={storeName}
                        onChange={(e) => setStoreName(e.target.value)}
                        placeholder="Retailer name"
                        className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-[#7C3AED] transition"
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
                        className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-[#7C3AED] transition bg-white"
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

                {/* Price & Currency */}
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
                        placeholder="0.00"
                        className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-[#7C3AED] transition"
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
                      className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-[#7C3AED] transition bg-white"
                    >
                      {CURRENCIES.map((cur) => (
                        <option key={cur.code} value={cur.code}>
                          {cur.code} ({cur.symbol})
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Purchase Date */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Purchase Date <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                      <Calendar className="w-3.5 h-3.5" />
                    </div>
                    <input
                      type="date"
                      required
                      value={purchaseDate}
                      onChange={(e) => setPurchaseDate(e.target.value)}
                      className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-[#7C3AED] transition"
                    />
                  </div>
                </div>

                {/* Return Window & Warranty Periods with Live Previews */}
                <div className="p-4 bg-slate-50/80 rounded-2xl border border-slate-200/70 grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  {/* Return Window */}
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                      Return Window (Days)
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        min="0"
                        value={returnDays}
                        onChange={(e) => setReturnDays(parseInt(e.target.value) || 0)}
                        className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-[#7C3AED] bg-white transition"
                      />
                      <span className="text-xs text-slate-400">days</span>
                    </div>
                    <div className="mt-1.5 flex items-center gap-1 text-[11px] text-purple-700 bg-purple-50 px-2 py-1 rounded-md border border-purple-100">
                      <Clock className="w-3 h-3 shrink-0" />
                      <span>Deadline: <strong>{formatDate(liveReturnDeadline)}</strong></span>
                    </div>
                  </div>

                  {/* Warranty Duration */}
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                      Warranty Duration (Months)
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        min="0"
                        value={warrantyMonths}
                        onChange={(e) => setWarrantyMonths(parseInt(e.target.value) || 0)}
                        className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-[#7C3AED] bg-white transition"
                      />
                      <span className="text-xs text-slate-400">months</span>
                    </div>
                    <div className="mt-1.5 flex items-center gap-1 text-[11px] text-emerald-700 bg-emerald-50 px-2 py-1 rounded-md border border-emerald-100">
                      <Shield className="w-3 h-3 shrink-0" />
                      <span>Expiry: <strong>{formatDate(liveWarrantyExpiry)}</strong></span>
                    </div>
                  </div>
                </div>

                {/* Confirm and Save Action */}
                <div className="pt-2 flex items-center justify-end gap-3">
                  <button
                    type="button"
                    onClick={handleRemoveFile}
                    className="px-4 py-2.5 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 transition"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={saving}
                    className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl text-xs font-bold text-white bg-[#7C3AED] hover:bg-purple-700 active:bg-purple-800 disabled:opacity-50 transition shadow-sm"
                  >
                    {saving ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>Saving to Purchases...</span>
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="w-4 h-4" />
                        <span>Confirm & Save Purchase</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default UploadInvoice;
