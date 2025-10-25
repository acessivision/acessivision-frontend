import * as Speech from 'expo-speech';
import { usePathname, useGlobalSearchParams } from 'expo-router';
import { useEffect } from 'react';

export function VoicePageAnnouncer() {
  const pathname = usePathname();

  const params = useGlobalSearchParams<{ titulo?: string }>();

  useEffect(() => {
    let pageName = '';

    // 3. Adicione a mesma verificação ANTES do switch
    if (pathname === '/tabs/conversa' && params.titulo) {
      pageName = 'Conversa: '+String(params.titulo);
    } else {
      // Fallback para a lógica antiga
      switch (pathname) {
        case '/tabs':
          pageName = 'Câmera';
          break;
        case '/tabs/historico':
          pageName = 'Histórico';
          break;
        case '/tabs/menu':
          pageName = 'Mehnu'; // Você tem um "h" a mais aqui
          break;
        case '/tabs/editarPerfil':
          pageName = 'Editar perfil';
          break;
        case '/tabs/conversa': // Fallback
          pageName = 'Conversa';
          break;
        case '/login':
          pageName = 'Login';
          break;
        case '/cadastro':
          pageName = 'Cadastro';
          break;
        default:
          pageName = 'AcessiVision';
      }
    }

    if (pageName) {
      Speech.speak(pageName, {
        language: 'pt-BR',
      });
    }
    
  // 4. Adicione 'params.titulo' ao array de dependências
  }, [pathname, params.titulo]);
  return null;
}