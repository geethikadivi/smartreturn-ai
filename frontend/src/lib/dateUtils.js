/**
 * Date and currency helper utilities for SMARTRETURN AI
 * Standardized across the application to prevent timezone shift issues.
 */

/**
 * Returns today's date formatted as YYYY-MM-DD
 */
export const getTodayString = () => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

/**
 * Adds a specific number of days to a YYYY-MM-DD date string
 */
export const addDays = (dateStr, days) => {
  if (!dateStr) return '';
  const [y, m, d] = dateStr.split('-').map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  date.setUTCDate(date.getUTCDate() + Number(days));
  return date.toISOString().slice(0, 10);
};

/**
 * Adds a specific number of months to a YYYY-MM-DD date string
 */
export const addMonths = (dateStr, months) => {
  if (!dateStr) return '';
  const [y, m, d] = dateStr.split('-').map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  date.setUTCMonth(date.getUTCMonth() + Number(months));
  return date.toISOString().slice(0, 10);
};

/**
 * Calculates days remaining from today to the given target date (YYYY-MM-DD).
 * Returns:
 *  > 0 : days left in future
 *  = 0 : expires today
 *  < 0 : expired (days overdue)
 */
export const getDaysRemaining = (targetDateStr) => {
  if (!targetDateStr) return null;
  const now = new Date();
  const todayUtc = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  const [y, m, d] = targetDateStr.split('-').map(Number);
  const targetUtc = Date.UTC(y, m - 1, d);
  const diffMs = targetUtc - todayUtc;
  return Math.ceil(diffMs / (1000 * 60 * 60 * 24));
};

/**
 * Calculates months remaining from today to the warranty expiration date.
 */
export const getWarrantyStatus = (expiryDateStr) => {
  if (!expiryDateStr) return { status: 'none', label: 'No warranty record', monthsLeft: 0 };
  const days = getDaysRemaining(expiryDateStr);
  if (days === null) return { status: 'none', label: 'No warranty record', monthsLeft: 0 };

  if (days < 0) {
    return { status: 'expired', label: 'Warranty Expired', daysLeft: days };
  }
  if (days === 0) {
    return { status: 'expiring_today', label: 'Expires Today', daysLeft: 0 };
  }
  if (days <= 30) {
    return { status: 'expiring_soon', label: `${days} days left`, daysLeft: days };
  }
  const months = Math.round(days / 30.4);
  return {
    status: 'active',
    label: `${months} ${months === 1 ? 'month' : 'months'} left`,
    monthsLeft: months,
    daysLeft: days,
  };
};

/**
 * Formats a YYYY-MM-DD string into a human-readable format, e.g. "Nov 6, 2026"
 */
export const formatDate = (dateStr) => {
  if (!dateStr) return 'N/A';
  try {
    const [y, m, d] = dateStr.split('-').map(Number);
    if (!y || !m || !d) return dateStr;
    const date = new Date(Date.UTC(y, m - 1, d));
    return date.toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      timeZone: 'UTC',
    });
  } catch {
    return dateStr;
  }
};

/**
 * Formats a numeric price with its corresponding currency symbol
 */
export const formatPrice = (price, currency = 'USD') => {
  if (price === null || price === undefined || price === '' || isNaN(Number(price))) {
    return '—';
  }
  const num = Number(price);
  const currencySymbols = {
    USD: '$',
    INR: '₹',
    EUR: '€',
    GBP: '£',
  };
  const symbol = currencySymbols[currency] || '$';
  return `${symbol}${num.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
};
