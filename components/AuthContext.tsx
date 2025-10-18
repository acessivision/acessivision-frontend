import React, { createContext, useState, useEffect, useContext, ReactNode } from 'react';
import authService, { Usuario } from '../services/authService';

// 1. Defina a "forma" (interface) do valor que nosso contexto irá fornecer.
interface AuthContextType {
  user: Usuario | null;
  isLoading: boolean;
  // Adicionados os tipos 'string' aqui
  login: (email: string, password: string) => Promise<any>;
  logout: () => Promise<void>;
  // Adicionado o tipo 'string' aqui
  loginWithGoogle: (idToken: string) => Promise<any>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  isLoading: true,
  login: async (email, password) => {},
  logout: async () => {},
  loginWithGoogle: async (idToken) => {},
});

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<Usuario | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const checkLoginStatus = async () => {
      try {
        const currentUser = await authService.getCurrentUser();
        setUser(currentUser);
      } catch (e) {
        console.error("Falha ao checar status de login", e);
        setUser(null);
      } finally {
        setIsLoading(false);
      }
    };
    checkLoginStatus();
  }, []);
  
  // Adicionados os tipos 'string' aqui
  const login = async (email: string, password: string) => {
    const result = await authService.login(email, password);
    if (result.success && result.usuario) {
      setUser(result.usuario);
    }
    return result;
  };
  
  // Adicionado o tipo 'string' aqui
  const loginWithGoogle = async (idToken: string) => {
    const result = await authService.loginWithGoogle(idToken);
    if (result.success && result.usuario) {
      setUser(result.usuario);
    }
    return result;
  };

  const logout = async () => {
    await authService.logout();
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, isLoading, login, logout, loginWithGoogle }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  return useContext(AuthContext);
};