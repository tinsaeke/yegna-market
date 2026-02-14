export interface User {
  id: string;
  name: string;
  email: string;
  role: 'admin' | 'customer' | 'seller';
  created_at: string;
}

export interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isAdmin: boolean;
  isSeller: boolean;
  loading: boolean;
}