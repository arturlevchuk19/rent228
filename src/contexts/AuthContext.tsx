import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { getCurrentUser, AuthUser, signIn } from '../lib/auth';

interface AuthContextType {
  user: AuthUser | null;
  loading: boolean;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Auto-login credentials for testing
const TEST_EMAIL = 'admin@onpromo.by';
const TEST_PASSWORD = 'admin';

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  const loadUser = async () => {
    try {
      const currentUser = await getCurrentUser();
      setUser(currentUser);
    } catch (error) {
      console.error('Error loading user:', error);
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadUser();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(() => {
      (async () => {
        await loadUser();
      })();
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  // Auto-login for testing
  useEffect(() => {
    const autoLogin = async () => {
      if (!user && !loading) {
        try {
          console.log('[AutoLogin] Attempting auto-login with test credentials...');
          await signIn(TEST_EMAIL, TEST_PASSWORD);
          console.log('[AutoLogin] Auto-login successful');
          await loadUser();
        } catch (error) {
          console.error('[AutoLogin] Auto-login failed:', error);
        }
      }
    };

    autoLogin();
  }, [user, loading]);

  return (
    <AuthContext.Provider value={{ user, loading, refreshUser: loadUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
