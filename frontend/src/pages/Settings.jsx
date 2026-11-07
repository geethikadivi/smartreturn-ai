import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';

export default function Settings() {
  const { user } = useAuth();
  const [profile, setProfile] = useState({
    name: '',
    email: '',
    currency: 'USD',
    alertDays: '7',
    emailAlerts: true,
    browserAlerts: false,
  });

  const [savedNotice, setSavedNotice] = useState(false);
  const [apiStatus, setApiStatus] = useState('Checking...');
  const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:8000';

  useEffect(() => {
    if (!user) return;

    const userEmail = user.email || '';
    const userName = user.user_metadata?.full_name || user.email?.split('@')[0] || '';

    // Load preferences strictly scoped to authenticated user ID
    try {
      const userSettingsKey = `smartreturn_settings_${user.id}`;
      const stored = localStorage.getItem(userSettingsKey);
      if (stored) {
        setProfile({ name: userName, email: userEmail, ...JSON.parse(stored) });
      } else {
        setProfile((prev) => ({ ...prev, name: userName, email: userEmail }));
      }
    } catch (e) {
      console.warn('Settings load error:', e);
      setProfile((prev) => ({ ...prev, name: userName, email: userEmail }));
    }
  }, [user]);

  useEffect(() => {
    // Check backend health
    fetch(`${apiUrl}/health`)
      .then((res) => res.json())
      .then((data) => {
        if (data.status === 'ok') {
          setApiStatus('Online & Connected');
        } else {
          setApiStatus('Degraded');
        }
      })
      .catch(() => setApiStatus('Offline'));
  }, [apiUrl]);

  const handleChange = (field, value) => {
    setProfile((prev) => ({ ...prev, [field]: value }));
  };

  const handleSave = (e) => {
    e.preventDefault();
    if (!user?.id) return;

    try {
      const userSettingsKey = `smartreturn_settings_${user.id}`;
      localStorage.setItem(userSettingsKey, JSON.stringify(profile));
      setSavedNotice(true);
      setTimeout(() => setSavedNotice(false), 3000);
    } catch (e) {
      console.error('Failed to save settings:', e);
    }
  };

  return (
    <div className="p-8 max-w-4xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">Account & Platform Settings</h1>
        <p className="text-slate-500 text-sm mt-1">
          Manage your personal details, tracking alert thresholds, and system connections.
        </p>
      </div>

      {savedNotice && (
        <div className="p-3.5 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-xl text-sm font-medium transition flex items-center justify-between">
          <span>✓ Settings saved successfully!</span>
        </div>
      )}

      <form onSubmit={handleSave} className="space-y-6">
        {/* Profile Card */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 space-y-4">
          <h2 className="text-base font-semibold text-slate-800 border-b border-slate-100 pb-3">
            Profile Information
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
                Full Name
              </label>
              <input
                type="text"
                value={profile.name}
                onChange={(e) => handleChange('name', e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
                Contact Email
              </label>
              <input
                type="email"
                value={profile.email}
                onChange={(e) => handleChange('email', e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>
        </div>

        {/* Tracking & Alert Preferences */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 space-y-4">
          <h2 className="text-base font-semibold text-slate-800 border-b border-slate-100 pb-3">
            Tracking & Regional Preferences
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
                Default Currency
              </label>
              <select
                value={profile.currency}
                onChange={(e) => handleChange('currency', e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="USD">USD ($)</option>
                <option value="INR">INR (₹)</option>
                <option value="EUR">EUR (€)</option>
                <option value="GBP">GBP (£)</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">
                Alert Threshold (Days before deadline)
              </label>
              <select
                value={profile.alertDays}
                onChange={(e) => handleChange('alertDays', e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="3">3 Days Before</option>
                <option value="7">7 Days Before (Recommended)</option>
                <option value="14">14 Days Before</option>
              </select>
            </div>
          </div>

          <div className="pt-2 space-y-3">
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={profile.emailAlerts}
                onChange={(e) => handleChange('emailAlerts', e.target.checked)}
                className="w-4 h-4 text-indigo-600 rounded focus:ring-indigo-500 border-slate-300"
              />
              <span className="text-sm text-slate-700">Receive email alerts for expiring returns</span>
            </label>
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={profile.browserAlerts}
                onChange={(e) => handleChange('browserAlerts', e.target.checked)}
                className="w-4 h-4 text-indigo-600 rounded focus:ring-indigo-500 border-slate-300"
              />
              <span className="text-sm text-slate-700">Enable in-browser desktop notifications</span>
            </label>
          </div>
        </div>

        {/* System & API Status */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 space-y-4">
          <h2 className="text-base font-semibold text-slate-800 border-b border-slate-100 pb-3">
            System & Engine Status
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 flex items-center justify-between">
              <span className="text-slate-600 font-medium">Backend API</span>
              <span className={`font-semibold ${apiStatus.includes('Online') ? 'text-emerald-600' : 'text-amber-600'}`}>
                {apiStatus}
              </span>
            </div>
            <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 flex items-center justify-between">
              <span className="text-slate-600 font-medium">Gemini AI Model</span>
              <span className="font-semibold text-indigo-600">Flash-Lite Active</span>
            </div>
          </div>
        </div>

        {/* Save Button */}
        <div className="flex justify-end">
          <button
            type="submit"
            className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-medium text-sm rounded-xl shadow-sm transition"
          >
            Save Preferences
          </button>
        </div>
      </form>
    </div>
  );
}