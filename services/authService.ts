// services/authService.ts
import AsyncStorage from '@react-native-async-storage/async-storage';
import auth from "@react-native-firebase/auth";
import type { FirebaseAuthTypes } from '@react-native-firebase/auth';
import { GoogleSignin } from '@react-native-google-signin/google-signin';
import * as Speech from 'expo-speech';

GoogleSignin.configure({
  webClientId: "818889640769-d70qafs67r59fc9o0pekmcl2an2o62r6.apps.googleusercontent.com",
  offlineAccess: true,
});

const API_URL = `http://${process.env.EXPO_PUBLIC_IP}:3000`;

export interface Usuario {
  uid: string;
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
  async register(email: string, password: string): Promise<AuthResponse> {
    try {
      // 1. Cria o usuário no Firebase Authentication
      const userCredential = await auth().createUserWithEmailAndPassword(email, password);
      const user = userCredential.user;

      // Feedback de sucesso com voz
      Speech.speak('Registro realizado com sucesso! Bem-vindo!', {
        language: 'pt-BR',
        pitch: 1.0,
        rate: 1.0
      });
      
      return { 
        success: true, 
        message: 'Registrado com sucesso!', 
        usuario: { 
          uid: user.uid,
          email: user.email || '' 
        } 
      };

    } catch (error: any) {
      // Extrair código de erro da mensagem se necessário
      let errorCode = error?.code;
      
      // Se não tem code, tentar extrair da mensagem
      if (!errorCode && error?.message) {
        if (error.message.includes('email-already-in-use')) {
          errorCode = 'auth/email-already-in-use';
        } else if (error.message.includes('invalid-email')) {
          errorCode = 'auth/invalid-email';
        } else if (error.message.includes('weak-password')) {
          errorCode = 'auth/weak-password';
        }
      }
      
      console.log('Error code detectado:', errorCode);
      
      if (errorCode === 'auth/email-already-in-use') {
        const mensagem = 'Este e-mail já está sendo usado por outro usuário. Por favor, tente fazer login ou use outro e-mail.';
        
        Speech.speak(mensagem, {
          language: 'pt-BR',
          pitch: 1.0,
          rate: 1.0,
        });
        
        return { 
          success: false, 
          message: ''
        };
      }

      if (errorCode === 'auth/invalid-email') {
        const mensagem = 'O e-mail informado é inválido. Por favor, verifique e tente novamente.';
        Speech.speak(mensagem, { language: 'pt-BR', rate: 0.85 });
        return { success: false, message: '' };
      }

      if (errorCode === 'auth/weak-password') {
        const mensagem = 'A senha é muito fraca. Por favor, use uma senha mais forte.';
        Speech.speak(mensagem, { language: 'pt-BR', rate: 0.85 });
        return { success: false, message: '' };
      }
      
      // Outros erros do Firebase
      const mensagemGenerica = 'Ocorreu um erro ao registrar. Por favor, tente novamente.';
      Speech.speak(mensagemGenerica, { language: 'pt-BR', rate: 0.85 });
      
      return { 
        success: false, 
        message: ''
      };
    }
  }

  // Login tradicional (email e senha)
  async login(email: string, password: string): Promise<AuthResponse> {
    try {
      // 1. Faz login com o Firebase Authentication
      // Corrigi: use auth() para invocar a instância do módulo
      const userCredential = await auth().signInWithEmailAndPassword(email, password);
      const user = userCredential.user;

      return { 
        success: true, 
        message: 'Login bem-sucedido!', 
        usuario: { 
          uid: user.uid, 
          email: user.email || ''
        } 
      };

    } catch (error) {
      console.error('Erro no login do Firebase:', error);
      
      // Corrigi: faz type narrowing do erro
      if (error && typeof error === 'object' && 'code' in error) {
        const firebaseError = error as FirebaseAuthTypes.NativeFirebaseAuthError;
        
        if (firebaseError.code === 'auth/user-not-found' || firebaseError.code === 'auth/wrong-password') {
          return { 
            success: false, 
            message: 'Email ou senha inválidos.' 
          };
        }
        
        return { 
          success: false, 
          message: firebaseError.message || 'Erro ao fazer login.' 
        };
      }
      
      return { 
        success: false, 
        message: 'Erro desconhecido ao fazer login.' 
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
  async deleteAccount(): Promise<AuthResponse> {
    try {
      const currentUser = auth().currentUser;
      
      if (!currentUser) {
        Speech.speak('Nenhum usuário está logado.', {
          language: 'pt-BR',
          rate: 0.85
        });
        return {
          success: false,
          message: 'Nenhum usuário está logado',
        };
      }

      console.log('[AuthService] Excluindo conta do usuário:', currentUser.uid);
      
      try {
        // Tenta excluir diretamente
        await currentUser.delete();
        
        console.log('[AuthService] Conta excluída com sucesso');
        
        // Limpa dados locais
        await AsyncStorage.multiRemove(['@auth_token', '@user_data']);
        
        // Faz logout do Google também
        try {
          await GoogleSignin.signOut();
        } catch (error) {
          console.log('[AuthService] Usuário não estava logado com Google');
        }
        
        Speech.speak('Conta excluída com sucesso.', {
          language: 'pt-BR',
          pitch: 1.0,
          rate: 1.0
        });
        
        return {
          success: true,
          message: 'Conta excluída com sucesso',
        };
        
      } catch (deleteError: any) {
        // Se o erro for que precisa re-autenticar
        if (deleteError.code === 'auth/requires-recent-login') {
          console.log('[AuthService] Requer re-autenticação. Tentando re-autenticar com Google...');
          
          try {
            // Re-autentica com Google
            await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
            const userInfo = await GoogleSignin.signIn();
            const idToken = (userInfo as any)?.data?.idToken || (userInfo as any)?.idToken;

            if (!idToken) {
              throw new Error('Não foi possível obter o token do Google');
            }

            const googleCredential = auth.GoogleAuthProvider.credential(idToken);
            await currentUser.reauthenticateWithCredential(googleCredential);
            
            console.log('[AuthService] Re-autenticação bem-sucedida. Tentando excluir novamente...');
            
            // Tenta excluir novamente após re-autenticação
            await currentUser.delete();
            
            console.log('[AuthService] Conta excluída com sucesso após re-autenticação');
            
            // Limpa dados locais
            await AsyncStorage.multiRemove(['@auth_token', '@user_data']);
            
            // Faz logout do Google
            try {
              await GoogleSignin.signOut();
            } catch (error) {
              console.log('[AuthService] Erro ao fazer logout do Google');
            }
            
            // Speech.speak('Conta excluída com sucesso.', {
            //   language: 'pt-BR',
            //   pitch: 1.0,
            //   rate: 1.0
            // });
            
            return {
              success: true,
              message: 'Conta excluída com sucesso',
            };
            
          } catch (reauthError: any) {
            console.error('[AuthService] Erro ao re-autenticar:', reauthError);
            
            const mensagem = 'Não foi possível confirmar sua identidade. Tente fazer login novamente e depois excluir a conta.';
            Speech.speak(mensagem, {
              language: 'pt-BR',
              rate: 0.85
            });
            
            return {
              success: false,
              message: mensagem,
            };
          }
        }
        
        // Outros erros
        throw deleteError;
      }
      
    } catch (error: any) {
      console.error('[AuthService] Erro ao excluir conta:', error);
      
      const mensagem = 'Erro ao excluir conta. Tente novamente.';
      Speech.speak(mensagem, {
        language: 'pt-BR',
        rate: 0.85
      });
      
      return {
        success: false,
        message: error.message || 'Erro ao excluir conta',
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