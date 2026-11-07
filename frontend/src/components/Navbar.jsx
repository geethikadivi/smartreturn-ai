import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Menu,
  Bell,
  LogOut,
  User as UserIcon,
  CheckCircle2,
  AlertCircle,
  Clock,
  ExternalLink,
  ChevronRight,
  ShieldAlert,
  Check,
  Sparkles,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabaseClient';
import {
  getTodayString,
  addDays,
  getDaysRemaining,
  formatDate,
  formatPrice,
} from '../lib/dateUtils';

const Navbar = ({ onMenuClick }) => {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();

  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [backendStatus, setBackendStatus] = useState('checking'); // 'online' | 'offline' | 'checking'
  const [notifications, setNotifications] = useState([]);
  const [loadingNotifications, setLoadingNotifications] = useState(false);
  const [updatingId, setUpdatingId] = useState(null);
  const [clearingAll, setClearingAll] = useState(false);

  const dropdownRef = useRef(null);
  const notifRef = useRef(null);

  const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:8000';

  // 1. Fetch live unread records from Supabase 'reminders' table (user_id = auth.uid() & is_read = false)
  const fetchNotifications = useCallback(async () => {
    const { data: { user: authUser } } = await supabase.auth.getUser();
    if (!authUser || !user?.id || authUser.id !== user.id) {
      setNotifications([]);
      setLoadingNotifications(false);
      return;
    }

    setLoadingNotifications(true);

    const today = getTodayString();
    const todayPlus7 = addDays(today, 7);

    try {
      // Fetch existing reminders for current authenticated user
      const { data: dbReminders, error: remErr } = await supabase
        .from('reminders')
        .select('*')
        .eq('user_id', authUser.id)
        .order('due_date', { ascending: true });

      const existing = Array.isArray(dbReminders) ? dbReminders : [];

      // Fetch active purchases expiring in the next 7 days scoped strictly to authenticated user
      const { data: purchases } = await supabase
        .from('purchases')
        .select('id, product_name, store, price, currency, return_deadline, purchase_date')
        .eq('user_id', authUser.id)
        .gte('return_deadline', today)
        .lte('return_deadline', todayPlus7)
        .order('return_deadline', { ascending: true });

      const expiringList = Array.isArray(purchases) ? purchases : [];

      // Auto-sync any newly expiring purchases into reminders table (with is_read = false)
      const toInsert = expiringList.filter((p) => {
        return !existing.some(
          (r) =>
            (r.purchase_id && r.purchase_id === p.id) ||
            (r.due_date === p.return_deadline && r.title.includes(p.product_name))
        );
      });

      if (toInsert.length > 0) {
        const newRows = toInsert.map((p) => ({
          user_id: authUser.id,
          title: `Return Window Closing: ${p.product_name}`,
          due_date: p.return_deadline,
          type: 'return',
          is_read: false,
        }));

        try {
          const { data: inserted } = await supabase
            .from('reminders')
            .insert(newRows)
            .select();

          if (Array.isArray(inserted)) {
            existing.push(...inserted);
          }
        } catch {
          // Ignored if bulk insert notice
        }
      }

      // Filter unread notifications (is_read === false)
      const unreadItems = existing
        .filter((r) => !r.is_read)
        .map((r) => {
          const matchedPurchase = expiringList.find(
            (p) =>
              (r.purchase_id && r.purchase_id === p.id) ||
              (r.due_date === p.return_deadline && r.title.includes(p.product_name))
          );
          return {
            id: r.id,
            purchase_id: matchedPurchase?.id || r.purchase_id,
            title: r.title || (matchedPurchase ? `Return Window Closing: ${matchedPurchase.product_name}` : 'Expiring Return Deadline'),
            product_name: matchedPurchase?.product_name || r.title.replace(/^Return Window Closing:\s*/, ''),
            store: matchedPurchase?.store || 'Retailer',
            price: matchedPurchase?.price,
            currency: matchedPurchase?.currency || 'USD',
            due_date: r.due_date,
            is_read: false,
          };
        });

      setNotifications(unreadItems);
    } catch (err) {
      console.warn('Error fetching notification reminders:', err);
    } finally {
      setLoadingNotifications(false);
    }
  }, [user?.id]);

  useEffect(() => {
    setNotifications([]);
    if (user?.id) {
      fetchNotifications();
    }
    const interval = setInterval(fetchNotifications, 45000);
    return () => clearInterval(interval);
  }, [fetchNotifications, user?.id]);

  // 2. "Mark as Read" action per item: updates is_read = true in Supabase
  const handleMarkAsRead = async (reminderId) => {
    if (!reminderId || !user?.id) return;
    setUpdatingId(reminderId);

    try {
      const { error } = await supabase
        .from('reminders')
        .update({ is_read: true })
        .eq('id', reminderId)
        .eq('user_id', user.id);

      if (error) throw error;

      // Remove from unread notifications in local state
      setNotifications((prev) => prev.filter((n) => n.id !== reminderId));
    } catch (err) {
      console.error('Error marking reminder as read:', err);
    } finally {
      setUpdatingId(null);
    }
  };

  // 3. "Clear All" action: updates is_read = true for all unread reminders in Supabase
  const handleClearAll = async () => {
    if (!user?.id || notifications.length === 0) return;
    setClearingAll(true);

    try {
      const { error } = await supabase
        .from('reminders')
        .update({ is_read: true })
        .eq('user_id', user.id)
        .eq('is_read', false);

      if (error) throw error;

      setNotifications([]);
    } catch (err) {
      console.error('Error clearing all notifications:', err);
    } finally {
      setClearingAll(false);
    }
  };

  // 4. Check FastAPI backend health status
  useEffect(() => {
    let isMounted = true;

    const checkBackendHealth = async () => {
      try {
        const response = await fetch(`${apiUrl}/health`, {
          method: 'GET',
          headers: { 'Content-Type': 'application/json' },
        });

        if (response.ok) {
          const data = await response.json();
          if (data.status === 'ok' && isMounted) {
            setBackendStatus('online');
          } else if (isMounted) {
            setBackendStatus('offline');
          }
        } else if (isMounted) {
          setBackendStatus('offline');
        }
      } catch (err) {
        if (isMounted) {
          setBackendStatus('offline');
        }
      }
    };

    checkBackendHealth();
    const interval = setInterval(checkBackendHealth, 30000);

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [apiUrl]);

  // 5. Close popovers on click outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setDropdownOpen(false);
      }
      if (notifRef.current && !notifRef.current.contains(event.target)) {
        setNotificationsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSignOut = async () => {
    setDropdownOpen(false);
    await signOut();
  };

  const userInitial = user?.user_metadata?.full_name
    ? user.user_metadata.full_name.charAt(0).toUpperCase()
    : user?.email
    ? user.email.charAt(0).toUpperCase()
    : 'U';

  const userDisplayName = user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'User';

  // Helper to format countdown chips
  const getCountdownChip = (daysLeft) => {
    if (daysLeft === null || daysLeft === undefined) return null;
    if (daysLeft === 0) {
      return (
        <span className="shrink-0 px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200 animate-pulse">
          Expires today
        </span>
      );
    }
    if (daysLeft === 1) {
      return (
        <span className="shrink-0 px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
          Expires in 1 day
        </span>
      );
    }
    if (daysLeft > 1) {
      return (
        <span className="shrink-0 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
          Expires in {daysLeft} days
        </span>
      );
    }
    return (
      <span className="shrink-0 px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-500 border border-slate-200">
        Expired
      </span>
    );
  };

  return (
    <header className="h-16 bg-white border-b border-slate-200 sticky top-0 z-30 flex items-center justify-between px-4 lg:px-8">
      {/* Left: Mobile hamburger menu toggle */}
      <div className="flex items-center gap-3">
        <button
          onClick={onMenuClick}
          className="lg:hidden p-2 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition"
          aria-label="Open sidebar"
        >
          <Menu className="w-5 h-5" />
        </button>
        <span className="hidden sm:inline-block text-xs font-semibold uppercase tracking-wider text-slate-500">
          Smart Return SaaS
        </span>
      </div>

      {/* Right: Backend health indicator, notification center & user profile */}
      <div className="flex items-center gap-3 md:gap-4">
        {/* Backend Status Indicator Badge */}
        <div
          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium transition ${
            backendStatus === 'online'
              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
              : backendStatus === 'offline'
              ? 'bg-rose-50 text-rose-700 border border-rose-200'
              : 'bg-slate-100 text-slate-600 border border-slate-200'
          }`}
          title={`Backend status (${apiUrl})`}
        >
          {backendStatus === 'online' ? (
            <>
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              <span>Backend Online</span>
            </>
          ) : backendStatus === 'offline' ? (
            <>
              <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
              <span>Backend Offline</span>
            </>
          ) : (
            <>
              <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
              <span>Checking...</span>
            </>
          )}
        </div>

        {/* Notifications Icon Button & Interactive Dropdown Center */}
        <div className="relative" ref={notifRef}>
          <button
            onClick={() => {
              setNotificationsOpen(!notificationsOpen);
              setDropdownOpen(false);
            }}
            className="p-2 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition relative"
            aria-label="Notifications"
            title="Notification Center"
          >
            <Bell className="w-4 h-4" />

            {/* Red alert badge showing live count of unread notifications */}
            {notifications.length > 0 && (
              <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 bg-rose-600 text-white text-[10px] font-bold rounded-full flex items-center justify-center border-2 border-white animate-pulse shadow-xs">
                {notifications.length > 9 ? '9+' : notifications.length}
              </span>
            )}
          </button>

          {/* Popover Menu Dropdown */}
          {notificationsOpen && (
            <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-white rounded-2xl shadow-xl border border-slate-200 py-3 z-50">
              {/* Header with Title and "Clear All" Action */}
              <div className="px-4 pb-2.5 border-b border-slate-100 flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <ShieldAlert className="w-4 h-4 text-rose-600" />
                  <span className="text-xs font-bold text-slate-900">
                    Expiring Return Deadlines
                  </span>
                  {notifications.length > 0 && (
                    <span className="ml-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-50 text-rose-700 border border-rose-200">
                      {notifications.length} unread
                    </span>
                  )}
                </div>

                {notifications.length > 0 && (
                  <button
                    onClick={handleClearAll}
                    disabled={clearingAll}
                    className="text-xs font-semibold text-[#7C3AED] hover:text-purple-800 hover:bg-purple-50 px-2 py-1 rounded-lg transition disabled:opacity-50"
                    title="Mark all notifications as read"
                  >
                    {clearingAll ? 'Clearing...' : 'Clear All'}
                  </button>
                )}
              </div>

              {/* Items List */}
              <div className="max-h-80 overflow-y-auto divide-y divide-slate-100 text-xs">
                {notifications.length === 0 ? (
                  <div className="p-6 text-center text-slate-400">
                    <CheckCircle2 className="w-7 h-7 text-emerald-500 mx-auto mb-2" />
                    <p className="font-semibold text-slate-700">All caught up!</p>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      No unread return alerts right now.
                    </p>
                  </div>
                ) : (
                  notifications.map((item) => {
                    const daysLeft = getDaysRemaining(item.due_date);

                    return (
                      <div
                        key={item.id}
                        className="p-3.5 hover:bg-slate-50/80 transition flex flex-col gap-2 group"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0 flex-1">
                            <p className="font-bold text-slate-900 truncate">
                              {item.product_name}
                            </p>
                            <p className="text-[11px] text-slate-500 mt-0.5 truncate">
                              {item.store} {item.price ? `• ${formatPrice(item.price, item.currency)}` : ''}
                            </p>
                            <p className="text-[11px] text-slate-500 mt-0.5 flex items-center gap-1">
                              <Clock className="w-3 h-3 text-[#7C3AED]" />
                              <span>Deadline: <strong>{formatDate(item.due_date)}</strong></span>
                            </p>
                          </div>

                          {/* Countdown chip */}
                          {getCountdownChip(daysLeft)}
                        </div>

                        {/* Direct Action Link to /ai-assistant & Mark Read Button */}
                        <div className="flex items-center justify-end gap-2 pt-1 border-t border-slate-100/60">
                          {/* Direct action link to /ai-assistant with item pre-selected */}
                          <button
                            onClick={() => {
                              handleMarkAsRead(item.id);
                              setNotificationsOpen(false);
                              navigate(`/ai-assistant?purchaseId=${item.purchase_id || item.id}`);
                            }}
                            className="px-2.5 py-1 text-[11px] font-semibold text-[#7C3AED] bg-purple-50 hover:bg-purple-100 rounded-lg transition border border-purple-100 inline-flex items-center gap-1"
                            title="Generate return draft with Gemini"
                          >
                            <Sparkles className="w-3 h-3 text-[#7C3AED]" />
                            <span>Draft Claim</span>
                          </button>

                          {/* "Mark as Read" action per item */}
                          <button
                            onClick={() => handleMarkAsRead(item.id)}
                            disabled={updatingId === item.id}
                            className="px-2.5 py-1 text-[11px] font-medium text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition border border-slate-200 inline-flex items-center gap-1"
                            title="Mark as read"
                          >
                            <Check className="w-3 h-3 text-slate-400" />
                            <span>Mark Read</span>
                          </button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              {/* Popover Footer with direct link to /warranties */}
              <div className="pt-2.5 px-4 border-t border-slate-100 flex items-center justify-between">
                <button
                  onClick={() => {
                    setNotificationsOpen(false);
                    navigate('/warranties');
                  }}
                  className="w-full text-center text-xs font-semibold text-[#7C3AED] hover:text-purple-700 py-1 transition flex items-center justify-center gap-1"
                >
                  <span>View all warranty & deadline alerts</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )}
        </div>

        {/* User Avatar Menu Dropdown */}
        <div className="relative" ref={dropdownRef}>
          <button
            onClick={() => {
              setDropdownOpen(!dropdownOpen);
              setNotificationsOpen(false);
            }}
            className="flex items-center gap-2 p-1 pl-2 pr-1 rounded-full border border-slate-200 hover:border-slate-300 transition bg-white"
            aria-label="User menu"
          >
            <span className="text-xs font-medium text-slate-700 hidden md:block max-w-[120px] truncate">
              {userDisplayName}
            </span>
            <div className="w-8 h-8 rounded-full bg-[#7C3AED] text-white flex items-center justify-center font-bold text-xs shadow-xs">
              {userInitial}
            </div>
          </button>

          {dropdownOpen && (
            <div className="absolute right-0 mt-2 w-56 bg-white rounded-xl shadow-lg border border-slate-100 py-1.5 z-50">
              <div className="px-4 py-2 border-b border-slate-100">
                <p className="text-xs font-semibold text-slate-900 truncate">
                  {user?.user_metadata?.full_name || 'Signed In'}
                </p>
                <p className="text-[11px] text-slate-500 truncate mt-0.5">
                  {user?.email}
                </p>
              </div>

              <div className="py-1">
                <button
                  onClick={handleSignOut}
                  className="w-full flex items-center gap-2.5 px-4 py-2 text-xs font-medium text-rose-600 hover:bg-rose-50 transition text-left"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  Sign Out
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};

export default Navbar;
