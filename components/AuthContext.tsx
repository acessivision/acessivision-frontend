// components/AuthContext.tsx
import React, { createContext, useState, useEffect, useContext, ReactNode } from 'react';
import authService, { Usuario } from '../services/authService';
import auth from '@react-native-firebase/auth';

interface AuthContextType {
  user: Usuario | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<any>;
  logout: () => Promise<void>;
  loginWithGoogle: () => Promise<any>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  isLoading: true,
  login: async () => {},
  logout: async () => {},
  loginWithGoogle: async () => {},
});

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<Usuario | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Listener do Firebase que detecta mudanças no estado de autenticação
    const unsubscribe = auth().onAuthStateChanged(async (firebaseUser) => {
      if (firebaseUser) {
        // Usuário está logado - pega os dados do AsyncStorage ou cria novo
        const userData = await authService.getCurrentUser();
        if (userData) {
          setUser(userData);
        } else {
          // Se não tiver dados salvos, cria a partir do Firebase
          const newUser: Usuario = {
            uid: firebaseUser.uid,
            email: firebaseUser.email || '',
            fotoPerfil: firebaseUser.photoURL || undefined,
          };
          setUser(newUser);
        }
      } else {
        // Usuário não está logado
        setUser(null);
      }
      setIsLoading(false);
    });

    // Cleanup: remove o listener quando o componente desmontar
    return unsubscribe;
  }, []);
  
  const login = async (email: string, password: string) => {
    const result = await authService.login(email, password);
    if (result.success && result.usuario) {
      setUser(result.usuario);
    }
    return result;
  };
  
  const loginWithGoogle = async () => {
    const result = await authService.loginWithGoogle();
    return result;
  };

  const logout = async () => {
    await authService.logout();
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