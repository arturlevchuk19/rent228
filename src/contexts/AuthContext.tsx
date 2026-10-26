import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { getCurrentUser, AuthUser } from '../lib/auth';
import { AuthContext } from './authContext';

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
      // Do not call Supabase while its auth-state callback holds the auth lock.
      setTimeout(() => { void loadUser(); }, 0);
    });

    const refreshOnFocus = () => { void loadUser(); };
    window.addEventListener('focus', refreshOnFocus);
    return () => {
      window.removeEventListener('focus', refreshOnFocus);
      subscription.unsubscribe();
    };
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, refreshUser: loadUser }}>
      {children}
    </AuthContext.Provider>
  );
}
