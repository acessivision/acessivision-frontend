import React, { createContext, useState, useEffect, useContext, ReactNode } from 'react';
import authService, { Usuario } from '../services/authService';
import auth, { FirebaseAuthTypes } from '@react-native-firebase/auth';
import { onAuthStateChanged } from '@react-native-firebase/auth';

interface AuthContextType {
  user: Usuario | null;
  isLoading: boolean;
  logout: () => Promise<void>;
  loginWithGoogle: () => Promise<any>;
  deleteAccount: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  isLoading: true,
  logout: async () => {},
  loginWithGoogle: async () => {},
  deleteAccount: async () => {},
});

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<Usuario | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth(), async (firebaseUser: FirebaseAuthTypes.User | null) => {
      if (firebaseUser) {
        const userData = await authService.getCurrentUser();
        if (userData) {
          setUser(userData);
        } else {
          const newUser: Usuario = {
            uid: firebaseUser.uid,
            email: firebaseUser.email || '',
            fotoPerfil: firebaseUser.photoURL || undefined,
          };
          setUser(newUser);
        }
      } else {
        setUser(null);
      }
      setIsLoading(false);
    });

    return unsubscribe;
  }, []);
  
  const loginWithGoogle = async () => {
    const result = await authService.loginWithGoogle();
    return result;
  };

  const logout = async () => {
    await authService.logout();
  };

  const deleteAccount = async () => {
    try {
      const result = await authService.deleteAccount();
      if (!result.success) {
        throw new Error(result.message);
      }
    } catch (error) {
      console.error('[AuthContext] Erro ao excluir conta:', error);
      throw error;
    }
  };

  return (
    <AuthContext.Provider value={{ user, isLoading, logout, loginWithGoogle, deleteAccount }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  return useContext(AuthContext);
};