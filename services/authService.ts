// services/authService.ts
import AsyncStorage from '@react-native-async-storage/async-storage';
import auth from '@react-native-firebase/auth';
import { GoogleSignin } from '@react-native-google-signin/google-signin';

GoogleSignin.configure({
  webClientId: "818889640769-d70qafs67r59fc9o0pekmcl2an2o62r6.apps.googleusercontent.com",
  offlineAccess: true,
});

const API_URL = `http://${process.env.EXPO_PUBLIC_IP}:3000`;

export interface Usuario {
  uid: string;
  nome: string;
  email: string;
  fotoPerfil?: string;
}

export interface AuthResponse {
  success: boolean;
  message: string;
  usuario?: Usuario;
  token?: string;
}

class AuthService {
  // Registrar novo usuário
  async register(nome: string, email: string, password: string): Promise<AuthResponse> {
    try {
      const response = await fetch(`${API_URL}/auth/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ nome, email, password }),
      });

      const data = await response.json();

      if (data.success && data.token) {
        await this.saveToken(data.token);
        await this.saveUser(data.usuario);
      }

      return data;
    } catch (error) {
      console.error('Erro no registro:', error);
      return {
        success: false,
        message: 'Erro de conexão com o servidor',
      };
    }
  }

  // Login tradicional (email e senha)
  async login(email: string, password: string): Promise<AuthResponse> {
    try {
      const response = await fetch(`${API_URL}/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();

      if (data.success && data.token) {
        await this.saveToken(data.token);
        await this.saveUser(data.usuario);
      }

      return data;
    } catch (error) {
      console.error('Erro no login:', error);
      return {
        success: false,
        message: 'Erro de conexão com o servidor',
      };
    }
  }

  // Login com Google usando Firebase
  async loginWithGoogle(): Promise<AuthResponse> {
    try {
      // 1️⃣ Garante que o Google Play Services está disponível
      await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });

      // 2️⃣ Faz login com a conta Google
      const userInfo = await GoogleSignin.signIn();
      const idToken = (userInfo as any)?.data?.idToken || (userInfo as any)?.idToken;

      if (!idToken) {
        return {
          success: false,
          message: 'Não foi possível obter o token do Google',
        };
      }

      // 3️⃣ Cria a credencial do Google e autentica com Firebase
      const googleCredential = auth.GoogleAuthProvider.credential(idToken);
      const userCredential = await auth().signInWithCredential(googleCredential);

      const firebaseUser = userCredential.user;

      // 4️⃣ Monta o objeto do usuário autenticado
      const usuario: Usuario = {
        uid: firebaseUser.uid,
        nome: firebaseUser.displayName || 'Usuário',
        email: firebaseUser.email || '',
        fotoPerfil: firebaseUser.photoURL || undefined,
      };

      // 5️⃣ Pega o ID Token do Firebase (usado nas requisições para o backend)
      const firebaseToken = await firebaseUser.getIdToken();

      // 6️⃣ Salva localmente o token e os dados do usuário
      await this.saveToken(firebaseToken);
      await this.saveUser(usuario);

      return {
        success: true,
        message: 'Login realizado com sucesso!',
        usuario,
        token: firebaseToken,
      };
    } catch (error: any) {
      console.error('Erro no login com Google:', error);

      if (error.code === 'auth/account-exists-with-different-credential') {
        return {
          success: false,
          message: 'Já existe uma conta com este email usando outro método de login.',
        };
      }

      if (error.code === 'auth/invalid-credential') {
        return {
          success: false,
          message: 'Credenciais inválidas.',
        };
      }

      return {
        success: false,
        message: 'Erro ao fazer login com Google.',
      };
    }
  }


  // Atualizar perfil
  async updateProfile(uid: string, dados: {
    nome?: string;
    telefone?: string;
    fotoPerfil?: string;
  }): Promise<AuthResponse> {
    try {
      const token = await this.getToken();
      
      const response = await fetch(`${API_URL}/auth/profile/${uid}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify(dados),
      });

      return await response.json();
    } catch (error) {
      console.error('Erro ao atualizar perfil:', error);
      return {
        success: false,
        message: 'Erro ao atualizar perfil',
      };
    }
  }

  // Deletar conta
  async deleteAccount(uid: string): Promise<AuthResponse> {
    try {
      const token = await this.getToken();
      
      const response = await fetch(`${API_URL}/auth/delete/${uid}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      const data = await response.json();

      if (data.success) {
        await this.logout();
      }

      return data;
    } catch (error) {
      console.error('Erro ao deletar conta:', error);
      return {
        success: false,
        message: 'Erro ao deletar conta',
      };
    }
  }

  // Logout
  async logout(): Promise<void> {
    try {
      // Faz logout do Google
      await GoogleSignin.signOut();
      
      // Faz logout do Firebase
      await auth().signOut();
      
      // Remove dados locais
      await AsyncStorage.multiRemove(['@auth_token', '@user_data']);
    } catch (error) {
      console.error('Erro no logout:', error);
    }
  }

  // Verificar se está logado
  async isLoggedIn(): Promise<boolean> {
    try {
      const token = await this.getToken();
      const firebaseUser = auth().currentUser;
      return !!(token && firebaseUser);
    } catch {
      return false;
    }
  }

  // Obter usuário atual
  async getCurrentUser(): Promise<Usuario | null> {
    try {
      const userData = await AsyncStorage.getItem('@user_data');
      return userData ? JSON.parse(userData) : null;
    } catch {
      return null;
    }
  }

  // Métodos privados
  private async saveToken(token: string): Promise<void> {
    await AsyncStorage.setItem('@auth_token', token);
  }

  private async getToken(): Promise<string | null> {
    return await AsyncStorage.getItem('@auth_token');
  }

  private async saveUser(usuario: Usuario): Promise<void> {
    await AsyncStorage.setItem('@user_data', JSON.stringify(usuario));
  }
}

export default new AuthService();