import * as Speech from 'expo-speech';
import { usePathname } from 'expo-router';
import { useEffect } from 'react';

export function VoicePageAnnouncer() {
  const pathname = usePathname();

  useEffect(() => {
    let pageName = '';
    switch (pathname) {
      case '/tabs':
        pageName = 'Câmera';
        break;
      case '/tabs/historico':
        pageName = 'Histórico';
        break;
      case '/tabs/configuracoes':
        pageName = 'Configurações';
        break;
      case '/tabs/editarPerfil':
        pageName = 'Editar perfil';
        break;
      case '/login':
        pageName = 'Login';
        break;
      default:
        pageName = 'Aplicativo';
    }

    if (pageName) {
      Speech.speak(pageName, {
        language: 'pt-BR',
      });
    }
  }, [pathname]);

  return null;
}