import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';

const AuthContext = createContext({
  user: null,
  session: null,
  loading: true,
  signIn: async () => {},
  signUp: async () => {},
  signOut: async () => {},
  purgeLocalCache: () => {},
});

// Helper to purge all cached local/session data across user accounts
export const purgeLocalCache = () => {
  try {
    // Purge legacy and temporary cached keys
    localStorage.removeItem('smartreturn_purchases');
    localStorage.removeItem('smartreturn_disputes');
    localStorage.removeItem('smartreturn_reminders');

    const keysToRemove = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && (key.startsWith('smartreturn') || key.startsWith('smart_return'))) {
        keysToRemove.push(key);
      }
    }
    keysToRemove.forEach((k) => localStorage.removeItem(k));
    sessionStorage.clear();
  } catch (e) {
    console.warn('Error purging local cache:', e);
  }
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // 1. Fetch current active session on mount
    supabase.auth.getSession().then(({ data: { session }, error }) => {
      if (error) {
        console.error('Error fetching initial auth session:', error.message);
      }
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    }).catch((err) => {
      console.error('Unexpected error during session initialization:', err);
      setLoading(false);
    });

    // 2. Listen to authentication state changes (SIGN_IN, SIGN_OUT, TOKEN_REFRESHED)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT' || !session) {
        purgeLocalCache();
        setUser(null);
        setSession(null);
      } else {
        // If switching to a different user, purge any leftover cache from previous user
        setSession((prevSession) => {
          if (prevSession?.user?.id && prevSession.user.id !== session?.user?.id) {
            purgeLocalCache();
          }
          return session;
        });
        setUser(session.user);
      }
      setLoading(false);
    });

    return () => {
      subscription?.unsubscribe();
    };
  }, []);

  // Sign In with email & password
  const signIn = async ({ email, password }) => {
    try {
      purgeLocalCache();
      const response = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      return response;
    } catch (err) {
      return { data: null, error: err };
    }
  };

  // Sign Up with email, password, and optional full name
  const signUp = async ({ email, password, fullName }) => {
    try {
      purgeLocalCache();
      const response = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: fullName,
          },
        },
      });
      return response;
    } catch (err) {
      return { data: null, error: err };
    }
  };

  // Sign Out with full cache and storage purge
  const signOut = async () => {
    try {
      purgeLocalCache();
      setUser(null);
      setSession(null);
      const response = await supabase.auth.signOut();
      return response;
    } catch (err) {
      purgeLocalCache();
      setUser(null);
      setSession(null);
      return { error: err };
    }
  };

  const value = {
    user,
    session,
    loading,
    signIn,
    signUp,
    signOut,
    purgeLocalCache,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
