import React, { useState, useEffect, useCallback } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import {
  Sparkles,
  Copy,
  Check,
  Download,
  Mail,
  RotateCcw,
  Loader2,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
  FileText,
} from 'lucide-react';
import { supabase } from '../lib/supabaseClient';
import { useAuth } from '../context/AuthContext';
import { formatPrice } from '../lib/dateUtils';

export default function AiAssistant() {
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const [purchases, setPurchases] = useState([]);
  const [selectedPurchaseId, setSelectedPurchaseId] = useState('');
  const [reason, setReason] = useState('');
  const [orderId, setOrderId] = useState('');
  const [loading, setLoading] = useState(false);
  const [draft, setDraft] = useState('');
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState('');

  // Save to Returns Tracker states
  const [savingClaim, setSavingClaim] = useState(false);
  const [claimSavedSuccess, setClaimSavedSuccess] = useState(false);
  const [claimError, setClaimError] = useState('');

  // 1. Fetch live purchases strictly scoped to the authenticated user from Supabase
  const loadPurchases = useCallback(async () => {
    try {
      const { data: { user: authUser } } = await supabase.auth.getUser();
      if (!authUser) {
        setPurchases([]);
        setSelectedPurchaseId('');
        return;
      }

      const { data, error: dbError } = await supabase
        .from('purchases')
        .select('*')
        .eq('user_id', authUser.id)
        .order('purchase_date', { ascending: false });

      if (dbError) throw dbError;

      const userPurchases = data || [];
      setPurchases(userPurchases);

      const paramId = searchParams.get('purchaseId');
      if (paramId && userPurchases.some((p) => String(p.id) === String(paramId))) {
        setSelectedPurchaseId(paramId);
      } else if (userPurchases.length > 0) {
        setSelectedPurchaseId(userPurchases[0].id);
      } else {
        setSelectedPurchaseId('');
      }
    } catch (e) {
      console.error('Could not load user purchases from Supabase:', e);
      setPurchases([]);
      setSelectedPurchaseId('');
    }
  }, [searchParams]);

  useEffect(() => {
    loadPurchases();
  }, [loadPurchases, user?.id]);

  // Find currently selected purchase
  const selectedItem = purchases.find(
    (p) => String(p.id) === String(selectedPurchaseId)
  ) || null;

  // 2. Generate email draft using Gemini backend
  const handleGenerate = async (e) => {
    e.preventDefault();
    if (!selectedItem) {
      setError('Please add or select a purchase from your account before generating a return email.');
      return;
    }

    if (!reason.trim()) {
      setError('Please provide a reason for the return request.');
      return;
    }

    setError('');
    setClaimError('');
    setClaimSavedSuccess(false);
    setLoading(true);
    setDraft('');

    const payload = {
      product_name: selectedItem.product_name || 'Purchased Item',
      store_name: selectedItem.store || selectedItem.store_name || 'Retailer',
      purchase_date: selectedItem.purchase_date || new Date().toISOString().split('T')[0],
      price: parseFloat(selectedItem.price || 0),
      currency: selectedItem.currency || 'USD',
      reason: reason.trim(),
      order_id: orderId.trim() || 'N/A',
    };

    const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:8000';

    try {
      const res = await fetch(`${apiUrl}/api/assistant/draft-return-email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        throw new Error(`Server status ${res.status}`);
      }

      const data = await res.json();
      setDraft(data.draft || 'No draft generated.');
    } catch (err) {
      setError(`Failed to draft email: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  // 3. Copy to clipboard
  const handleCopy = () => {
    if (!draft) return;
    navigator.clipboard.writeText(draft);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // 4. Download Letter (.txt)
  const handleDownloadTxt = () => {
    if (!draft) return;
    const blob = new Blob([draft], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const element = document.createElement('a');
    const safeName = (selectedItem?.product_name || 'return-dispute')
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '-');
    element.href = url;
    element.download = `dispute-letter-${safeName}.txt`;
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
    URL.revokeObjectURL(url);
  };

  // 5. Open in Email (mailto:) with subject and body
  const handleOpenInEmail = () => {
    if (!draft) return;
    let subject = `Return Request: ${selectedItem?.product_name || 'Order'}`;
    const subjectMatch = draft.match(/^Subject:\s*(.+)$/im);
    if (subjectMatch && subjectMatch[1]) {
      subject = subjectMatch[1].trim();
    }
    const mailtoUrl = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(draft)}`;
    window.open(mailtoUrl, '_blank');
  };

  // 6. Save directly to Supabase return_requests table (strictly scoped to authUser.id)
  const handleSaveToReturnsTracker = async () => {
    if (!draft) return;

    const { data: { user: authUser } } = await supabase.auth.getUser();
    if (!authUser) {
      setClaimError('You must be signed in to save claims to your Returns Tracker.');
      return;
    }

    if (!selectedItem?.id) {
      setClaimError('Please select a valid purchase from your account.');
      return;
    }

    setSavingClaim(true);
    setClaimError('');

    try {
      // Prepare claim record strictly scoped to current authenticated user
      const claimPayload = {
        user_id: authUser.id,
        purchase_id: selectedItem.id,
        status: 'pending',
        reason: reason.trim() || 'Return requested via AI Assistant',
        dispute_letter: draft,
        tracking_code: orderId.trim() || null,
      };

      const { error: insertError } = await supabase
        .from('return_requests')
        .insert(claimPayload);

      if (insertError) {
        // Fallback if dispute_letter column hasn't been added to table yet
        if (insertError.message && insertError.message.includes('dispute_letter')) {
          const { dispute_letter, ...fallbackPayload } = claimPayload;
          const { error: fallbackErr } = await supabase
            .from('return_requests')
            .insert(fallbackPayload);
          if (fallbackErr) throw fallbackErr;
        } else {
          throw insertError;
        }
      }

      setClaimSavedSuccess(true);
    } catch (err) {
      console.error('Error saving claim to Supabase:', err);
      setClaimError(err.message || 'Failed to save return claim.');
    } finally {
      setSavingClaim(false);
    }
  };

  return (
    <div className="p-4 sm:p-8 max-w-6xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">AI Return Assistant</h1>
        <p className="text-slate-500 text-sm mt-1">
          Generate formal refund claim letters, merchant disputes, and store return requests powered by Gemini AI.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Form Column */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 space-y-5">
          <h2 className="text-base font-semibold text-slate-800 flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-[#7C3AED]" />
            Claim Parameters
          </h2>

          {error && (
            <div className="p-3 text-xs text-rose-700 bg-rose-50 rounded-xl border border-rose-200 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
              Select Item
            </label>
            {purchases.length === 0 ? (
              <div className="p-3.5 bg-amber-50 rounded-xl border border-amber-200 text-xs text-amber-800 flex items-center justify-between">
                <span>No purchases recorded yet in this account.</span>
                <Link to="/purchases?action=new" className="font-bold underline text-[#7C3AED]">
                  + Add Purchase
                </Link>
              </div>
            ) : (
              <select
                value={selectedPurchaseId}
                onChange={(e) => setSelectedPurchaseId(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-[#7C3AED] transition"
              >
                {purchases.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.product_name} — {p.store || p.store_name || 'Retailer'} ({formatPrice(p.price, p.currency)})
                  </option>
                ))}
              </select>
            )}
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
              Order ID / Invoice # (Optional)
            </label>
            <input
              type="text"
              placeholder="e.g. BIS-49102 or AMZ-89104"
              value={orderId}
              onChange={(e) => setOrderId(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-[#7C3AED] transition"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
              Reason for Return *
            </label>
            <textarea
              rows="4"
              placeholder="Describe the issue (e.g. Defective right speaker, wrong order delivered, damaged packaging)..."
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-[#7C3AED] resize-none transition"
            />
          </div>

          <button
            onClick={handleGenerate}
            disabled={loading || purchases.length === 0}
            className="w-full py-3 px-4 bg-[#7C3AED] hover:bg-purple-700 disabled:bg-purple-300 disabled:cursor-not-allowed text-white font-semibold rounded-xl text-xs sm:text-sm shadow-sm transition flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Generating Draft with Gemini...</span>
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4" />
                <span>Generate Return Email</span>
              </>
            )}
          </button>
        </div>

        {/* Output Column */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 flex flex-col justify-between">
          <div>
            <div className="flex flex-wrap items-center justify-between gap-2 mb-4 pb-2 border-b border-slate-100">
              <h2 className="text-base font-semibold text-slate-800">Generated Email Draft</h2>
              {draft && (
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleCopy}
                    className="text-xs font-semibold px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition inline-flex items-center gap-1.5"
                    title="Copy text to clipboard"
                  >
                    {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                    {copied ? 'Copied' : 'Copy'}
                  </button>

                  <button
                    onClick={handleDownloadTxt}
                    className="text-xs font-semibold px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition inline-flex items-center gap-1.5"
                    title="Download draft as plain text (.txt)"
                  >
                    <Download className="w-3.5 h-3.5" />
                    Download (.txt)
                  </button>
                </div>
              )}
            </div>

            {claimError && (
              <div className="mb-3 p-3 text-xs text-rose-700 bg-rose-50 rounded-xl border border-rose-200 flex items-start gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{claimError}</span>
              </div>
            )}

            {claimSavedSuccess && (
              <div className="mb-3 p-3 text-xs text-emerald-800 bg-emerald-50 rounded-xl border border-emerald-200 flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span className="font-semibold">Claim successfully saved to your Returns Tracker!</span>
                </div>
                <button
                  onClick={() => navigate('/returns')}
                  className="font-bold underline hover:text-emerald-900 text-xs inline-flex items-center gap-0.5"
                >
                  View <ArrowRight className="w-3 h-3" />
                </button>
              </div>
            )}

            {loading ? (
              <div className="h-72 flex flex-col items-center justify-center text-slate-400 space-y-3">
                <div className="w-8 h-8 border-3 border-[#7C3AED] border-t-transparent rounded-full animate-spin" />
                <span className="text-xs sm:text-sm font-medium">Synthesizing formal dispute with Gemini AI...</span>
              </div>
            ) : draft ? (
              <pre className="text-xs text-slate-700 bg-slate-50 p-4 rounded-xl border border-slate-200 whitespace-pre-wrap font-sans leading-relaxed max -h-[380px] overflow-y-auto">
                {draft}
              </pre>
            ) : (
              <div className="h-72 flex flex-col items-center justify-center text-slate-400 text-xs sm:text-sm italic border-2 border-dashed border-slate-200 rounded-xl p-6 text-center">
                {purchases.length === 0
                  ? 'No purchases registered in this account. Please add a purchase in My Purchases or scan an invoice.'
                  : 'Select an item on the left, explain the reason for return, and click generate to create an email.'}
              </div>
            )}
          </div>

          {/* Action Footer when draft is available */}
          {draft && (
            <div className="mt-4 pt-4 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={handleOpenInEmail}
                className="w-full sm:w-auto px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 font-semibold text-xs rounded-xl transition inline-flex items-center justify-center gap-1.5"
              >
                <Mail className="w-3.5 h-3.5 text-slate-600" />
                Open in Email
              </button>

              <button
                type="button"
                onClick={handleSaveToReturnsTracker}
                disabled={savingClaim || claimSavedSuccess}
                className={`w-full sm:w-auto px-4 py-2 font-semibold text-xs rounded-xl shadow-xs transition inline-flex items-center justify-center gap-1.5 ${
                  claimSavedSuccess
                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 cursor-default'
                    : 'bg-[#7C3AED] hover:bg-purple-700 text-white disabled:opacity-50'
                }`}
              >
                {savingClaim ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    Saving Claim...
                  </>
                ) : claimSavedSuccess ? (
                  <>
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                    Saved to Returns
                  </>
                ) : (
                  <>
                    <RotateCcw className="w-3.5 h-3.5" />
                    Save to Returns Tracker
                  </>
                )}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
