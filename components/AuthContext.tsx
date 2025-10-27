// components/AuthContext.tsx
import React, { createContext, useState, useEffect, useContext, ReactNode } from 'react';
import authService, { Usuario } from '../services/authService';
import auth, { FirebaseAuthTypes } from '@react-native-firebase/auth';
import { onAuthStateChanged } from '@react-native-firebase/auth';

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
    // 2. USE THE IMPORTED FUNCTION
    const unsubscribe = onAuthStateChanged(auth(), async (firebaseUser: FirebaseAuthTypes.User | null) => { // <-- CHANGE HERE
      if (firebaseUser) {
        // Usuário está logado
        const userData = await authService.getCurrentUser();
        if (userData) {
          setUser(userData);
        } else {
          // Cria a partir do Firebase se não houver dados locais
          const newUser: Usuario = {
            uid: firebaseUser.uid,
            email: firebaseUser.email || '',
            fotoPerfil: firebaseUser.photoURL || undefined,
          };
          setUser(newUser);
          // Opcional: Salvar esses dados básicos no AsyncStorage aqui?
          // await authService.saveUser(newUser); 
        }
      } else {
        // Usuário não está logado
        setUser(null);
        // Opcional: Limpar dados do AsyncStorage aqui?
        // await authService.clearUser();
      }
      setIsLoading(false);
    });

    // Cleanup: remove o listener
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