// import { usePathname, useGlobalSearchParams } from 'expo-router';
// import { useEffect } from 'react';
// import SpeechManager from '../utils/speechManager';

// export function VoicePageAnnouncer() {
//   const pathname = usePathname();
//   const params = useGlobalSearchParams<{ titulo?: string }>();

//   useEffect(() => {
//     let pageName = '';

//     // Check for conversation with title first
//     if (pathname === '/conversa' && params.titulo) {
//       pageName = 'Conversa: ' + String(params.titulo);
//     } else {
//       // Fallback to regular page names
//       switch (pathname) {
//         case '/tabs':
//           pageName = 'Câmera';
//           break;
//         case '/tabs/historico':
//           pageName = 'Histórico';
//           break;
//         case '/tabs/menu':
//           pageName = 'Mehnu'; // Due to pronunciation
//           break;
//         case '/tabs/editarPerfil':
//           pageName = 'Editar perfil';
//           break;
//         case '/conversa': // Fallback
//           pageName = 'Conversa';
//           break;
//         case '/login':
//           pageName = 'Login';
//           break;
//         default:
//           pageName = 'AcessiVision';
//       }
//     }

//     if (pageName) {
//       // ✅ Use keepListening=true to NOT stop recognition during page announcements
//       // The echo prevention in SpeechManager will ignore if the system hears itself
//       console.log('[VoicePageAnnouncer] Announcing page:', pageName);
//       SpeechManager.speak(pageName, undefined, true); // keepListening = true
//     }
    
//   }, [pathname, params.titulo]);
  
//   return null;
// }