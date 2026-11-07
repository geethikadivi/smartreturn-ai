import React, { useState } from 'react';
import { AlertTriangle, Loader2, Trash2 } from 'lucide-react';

const DeleteConfirmModal = ({ isOpen, onClose, onConfirm, itemTitle }) => {
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  if (!isOpen) return null;

  const handleConfirm = async () => {
    setErrorMsg('');
    setLoading(true);
    try {
      await onConfirm();
      onClose();
    } catch (err) {
      console.error('Failed to delete item:', err);
      setErrorMsg(err.message || 'Failed to delete purchase.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 overflow-y-auto">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs transition-opacity"
        onClick={() => !loading && onClose()}
      />

      {/* Modal */}
      <div className="relative bg-white rounded-2xl shadow-2xl border border-slate-200/80 w-full max-w-md p-6 overflow-hidden z-10 space-y-4">
        <div className="flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center shrink-0 border border-rose-100">
            <Trash2 className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-[#0F172A]">
              Delete Purchase
            </h3>
            <p className="text-xs text-slate-500">
              This action cannot be undone.
            </p>
          </div>
        </div>

        <p className="text-xs text-slate-600 leading-relaxed">
          Are you sure you want to delete <strong className="text-slate-900 font-semibold">{itemTitle || 'this purchase'}</strong>? Any associated return requests or warranty reminders will also be deleted via database cascade.
        </p>

        {errorMsg && (
          <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-700">
            {errorMsg}
          </div>
        )}

        <div className="pt-2 flex items-center justify-end gap-2.5">
          <button
            type="button"
            disabled={loading}
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-medium text-slate-600 hover:bg-slate-100 transition"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={loading}
            onClick={handleConfirm}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold text-white bg-rose-600 hover:bg-rose-700 active:bg-rose-800 disabled:opacity-50 transition shadow-xs"
          >
            {loading ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>Deleting...</span>
              </>
            ) : (
              <>
                <Trash2 className="w-3.5 h-3.5" />
                <span>Delete Purchase</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default DeleteConfirmModal;
