import AsyncStorage from '@react-native-async-storage/async-storage';

const API_URL = `http://${process.env.EXPO_PUBLIC_IP}:3000`;

export interface Usuario {
  uid: string;
  nome: string;
  email: string;
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

  // Login
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

  async loginWithGoogle(idToken: string): Promise<AuthResponse> {
    try {
      // Faz a requisição para o endpoint do backend que valida o token do Google
      const response = await fetch(`${API_URL}/auth/google`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ idToken }), // Envia o idToken para o backend
      });

      const data = await response.json();

      // Se o backend validar e retornar sucesso com um token do NOSSO sistema...
      if (data.success && data.token) {
        // ...salvamos o token e os dados do usuário, exatamente como no login normal
        await this.saveToken(data.token);
        await this.saveUser(data.usuario);
      }

      return data;
    } catch (error) {
      console.error('Erro no login com Google via backend:', error);
      return {
        success: false,
        message: 'Erro de conexão com o servidor ao tentar login com Google',
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
      await AsyncStorage.multiRemove(['@auth_token', '@user_data']);
    } catch (error) {
      console.error('Erro no logout:', error);
    }
  }

  // Verificar se está logado
  async isLoggedIn(): Promise<boolean> {
    try {
      const token = await this.getToken();
      return !!token;
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