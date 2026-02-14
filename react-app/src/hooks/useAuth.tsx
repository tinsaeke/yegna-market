import { useState, useEffect, createContext, useContext, ReactNode } from 'react';
import { AuthState } from '../types/user';
import { supabase } from '../services/supabase';
import { rateLimit, getRateLimitKey } from '../utils/rateLimit';

const AuthContext = createContext<{
  auth: AuthState;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  register: (email: string, password: string, name: string) => Promise<void>;
} | null>(null);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [auth, setAuth] = useState<AuthState>({
    user: null,
    isAuthenticated: false,
    isAdmin: false,
    isSeller: false,
    loading: true
  });

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (session?.user) {
        const { data: seller } = await supabase
          .from('sellers')
          .select('status')
          .eq('user_id', session.user.id)
          .single();
        
        const isSeller = seller?.status === 'active';
        
        setAuth({
          user: {
            id: session.user.id,
            email: session.user.email!,
            name: session.user.user_metadata.name || session.user.email!,
            role: session.user.user_metadata.role || 'customer',
            created_at: session.user.created_at
          },
          isAuthenticated: true,
          isAdmin: session.user.user_metadata.role === 'admin',
          isSeller,
          loading: false
        });
      } else {
        setAuth(prev => ({ ...prev, loading: false }));
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        if (session?.user) {
          const { data: seller } = await supabase
            .from('sellers')
            .select('status')
            .eq('user_id', session.user.id)
            .single();
          
          const isSeller = seller?.status === 'active';
          
          setAuth({
            user: {
              id: session.user.id,
              email: session.user.email!,
              name: session.user.user_metadata.name || session.user.email!,
              role: session.user.user_metadata.role || 'customer',
              created_at: session.user.created_at
            },
            isAuthenticated: true,
            isAdmin: session.user.user_metadata.role === 'admin',
            isSeller,
            loading: false
          });
        } else {
          setAuth({
            user: null,
            isAuthenticated: false,
            isAdmin: false,
            isSeller: false,
            loading: false
          });
        }
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  const login = async (email: string, password: string) => {
    const rateLimitKey = getRateLimitKey('login', email);
    if (!rateLimit(rateLimitKey, 5, 15 * 60 * 1000)) {
      throw new Error('Too many login attempts. Please try again in 15 minutes.');
    }

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password
    });
    if (error) throw error;
  };

  const logout = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  };

  const register = async (email: string, password: string, name: string) => {
    const rateLimitKey = getRateLimitKey('register', email);
    if (!rateLimit(rateLimitKey, 3, 60 * 60 * 1000)) {
      throw new Error('Too many registration attempts. Please try again later.');
    }

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          name,
          role: 'customer'
        },
        emailRedirectTo: window.location.origin
      }
    });
    if (error) {
      throw error;
    }
    if (!data.user) {
      throw new Error('Registration failed - no user returned');
    }
  };

  return (
    <AuthContext.Provider value={{ auth, login, logout, register }}>
      {children}
    </AuthContext.Provider>
  );
};