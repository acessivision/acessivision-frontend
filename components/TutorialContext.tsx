import React, { createContext, useState, useContext } from 'react';
import { 
  Modal, 
  View, 
  Text, 
  StyleSheet, 
  ScrollView, 
  TouchableWithoutFeedback 
} from 'react-native';
import * as Speech from 'expo-speech';
import SpeechManager from '../utils/speechManager'; 

interface TutorialContextData {
  reproduzirTutorial: (texto: string) => void;
  pararTutorial: () => void;
  isTutorialAtivo: boolean;
}

const TutorialContext = createContext<TutorialContextData | null>(null);

export const TutorialProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [visivel, setVisivel] = useState(false);
  const [textoAtual, setTextoAtual] = useState('');

  const retomarReconhecimento = () => {
    console.log('[Tutorial] 🏁 Finalizando tutorial e reativando microfone');
    
    // ✅ Primeiro fecha o modal
    setVisivel(false);
    setTextoAtual('');
    
    // ✅ Aguarda 1 segundo antes de reativar
    setTimeout(() => {
      try {
        console.log('[Tutorial] 🎤 REABILITANDO microfone');
        SpeechManager.enable();
        
        setTimeout(() => {
          console.log('[Tutorial] 🎤 Iniciando reconhecimento global');
          SpeechManager.startRecognition('global');
        }, 500);
      } catch (e) {
        console.warn('[Tutorial] ⚠️ Erro ao retomar reconhecimento:', e);
      }
    }, 1000);
  };

  const reproduzirTutorial = (texto: string) => {
    console.log('[Tutorial] 🎓 Iniciando tutorial');
    
    // ✅ Para qualquer áudio atual
    Speech.stop();
    
    // ✅ DESABILITA o microfone COMPLETAMENTE
    try {
      console.log('[Tutorial] 🔇 DESABILITANDO microfone para tutorial');
      SpeechManager.disable();
      
      // ✅ ADICIONAL: Para qualquer reconhecimento em andamento
      SpeechManager.stopRecognition();
    } catch (e) {
      console.warn('[Tutorial] ⚠️ Erro ao pausar reconhecimento:', e);
    }
    
    // ✅ Aguarda um pouco antes de abrir o modal e falar
    setTimeout(() => {
      setTextoAtual(texto);
      setVisivel(true);

      // ✅ Inicia o TTS depois que o modal já está visível
      setTimeout(() => {
        Speech.speak(texto, {
          language: 'pt-BR',
          rate: 1.2, 
          onDone: () => {
            console.log('[Tutorial] ✅ Tutorial concluído (onDone)');
            retomarReconhecimento();
          }, 
          onStopped: () => {
            console.log('[Tutorial] 🛑 Tutorial interrompido (onStopped)');
            if (visivel) {
              retomarReconhecimento();
            }
          },
          onError: (error) => {
            console.error('[Tutorial] ❌ Erro no TTS:', error);
            retomarReconhecimento();
          }
        });
      }, 300);
    }, 200);
  };

  const pararTutorial = () => {
    console.log('[Tutorial] ⏹️ Parando tutorial manualmente');
    
    Speech.stop();
    setVisivel(false); 
    setTextoAtual('');
    
    setTimeout(() => {
      Speech.speak("Tutorial fechado", { 
        language: 'pt-BR',
        rate: 1.2,
        onDone: () => {
          console.log('[Tutorial] ✅ Feedback de fechamento concluído');
          setTimeout(() => {
            try {
              console.log('[Tutorial] 🎤 REABILITANDO microfone (parada manual)');
              SpeechManager.enable();
              
              setTimeout(() => {
                SpeechManager.startRecognition('global');
              }, 300);
            } catch (e) {
              console.warn('[Tutorial] ⚠️ Erro ao retomar:', e);
            }
          }, 500);
        },
        onStopped: () => {
          setTimeout(() => {
            try {
              SpeechManager.enable();
              setTimeout(() => {
                SpeechManager.startRecognition('global');
              }, 300);
            } catch (e) {
              console.warn('[Tutorial] ⚠️ Erro ao retomar:', e);
            }
          }, 500);
        }
      });
    }, 100);
  };

  return (
    <TutorialContext.Provider value={{ reproduzirTutorial, pararTutorial, isTutorialAtivo: visivel }}>
      {children}

      <Modal
        animationType="fade"
        transparent={true}
        visible={visivel}
        onRequestClose={pararTutorial}
      >
        <View style={styles.overlay}>
          <TouchableWithoutFeedback onPress={pararTutorial}>
            <View style={styles.backgroundTouchable} />
          </TouchableWithoutFeedback>
          
          <View style={styles.containerTexto}>
            <Text style={styles.titulo}>Reproduzindo Tutorial...</Text>
            <Text style={styles.instrucao}>Toque fora do cartão para fechar</Text>
            
            <View style={styles.cardTexto}>
              <ScrollView 
                contentContainerStyle={styles.scrollContent}
                indicatorStyle="white"
                showsVerticalScrollIndicator={true}
                scrollEventThrottle={16}
                nestedScrollEnabled={true}
                bounces={true}
              >
                <Text style={styles.textoTutorial}>
                  {textoAtual}
                </Text>
              </ScrollView>
            </View>
          </View>
        </View>
      </Modal>
    </TutorialContext.Provider>
  );
};

export const useTutorial = () => {
  const context = useContext(TutorialContext);
  if (!context) {
    throw new Error('useTutorial deve ser usado dentro de um TutorialProvider');
  }
  return context;
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.9)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  backgroundTouchable: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  containerTexto: {
    alignItems: 'center',
    width: '100%',
    maxHeight: '90%',
    zIndex: 1,
  },
  titulo: {
    color: '#fff',
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 10,
    textAlign: 'center'
  },
  instrucao: {
    color: '#ccc',
    fontSize: 16,
    marginBottom: 30,
    textAlign: 'center'
  },
  cardTexto: {
    backgroundColor: '#222',
    borderRadius: 16,
    width: '100%',
    borderWidth: 1,
    borderColor: '#444',
    maxHeight: '70%',
    overflow: 'hidden',
  },
  scrollContent: {
    padding: 24,
    flexGrow: 1,
  },
  textoTutorial: {
    color: '#fff',
    fontSize: 20,
    lineHeight: 28,
    textAlign: 'center'
  }
});