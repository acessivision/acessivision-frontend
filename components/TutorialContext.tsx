import React, { createContext, useState, useContext, useEffect } from 'react';
import { Modal, View, Text, StyleSheet, TouchableOpacity, AccessibilityInfo } from 'react-native';
import * as Speech from 'expo-speech';

// Definição do tipo do Contexto
interface TutorialContextData {
  reproduzirTutorial: (texto: string) => void;
  pararTutorial: () => void;
  isTutorialAtivo: boolean;
}

const TutorialContext = createContext<TutorialContextData>({} as TutorialContextData);

export const TutorialProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [visivel, setVisivel] = useState(false);
  const [textoAtual, setTextoAtual] = useState('');

  // Função que inicia o tutorial
  const reproduzirTutorial = (texto: string) => {
    // Para qualquer fala anterior
    Speech.stop();
    
    setTextoAtual(texto);
    setVisivel(true);

    // Inicia a fala
    Speech.speak(texto, {
      language: 'pt-BR',
      rate: 0.9, // Ajuste a velocidade conforme sua preferência
      // Quando terminar de falar tudo, fecha o modal automaticamente?
      // Se quiser que feche sozinho ao fim, descomente a linha abaixo:
      onDone: () => setVisivel(false), 
      onStopped: () => setVisivel(false), // Garante estado limpo se for parado externamente
    });
  };

  // Função que interrompe e fecha
  const pararTutorial = () => {
    Speech.stop();
    setVisivel(false);
    
    // Feedback sonoro de encerramento
    // O setTimeout é um "truque" para garantir que o stop() processou antes de falar o novo texto
    setTimeout(() => {
        Speech.speak("Tutorial fechado", { language: 'pt-BR' });
    }, 100);
  };

  return (
    <TutorialContext.Provider value={{ reproduzirTutorial, pararTutorial, isTutorialAtivo: visivel }}>
      {children}

      {/* O MODAL QUE COBRE A TELA INTEIRA */}
      <Modal
        animationType="fade"
        transparent={true} // Fundo transparente (ou semi-transparente)
        visible={visivel}
        // Acessibilidade Android: Botão físico de voltar
        onRequestClose={pararTutorial} 
      >
        {/* View que captura o toque na tela inteira */}
        <TouchableOpacity 
          style={styles.overlay} 
          activeOpacity={0.9} 
          onPress={pararTutorial}
          // Acessibilidade iOS: Gesto "Z" (Scrub)
          accessibilityViewIsModal={true}
          onAccessibilityEscape={pararTutorial}
          accessibilityLabel="O tutorial está sendo reproduzido. Toque duas vezes para fechar."
          accessibilityRole="button"
        >
          <View style={styles.containerTexto}>
            <Text style={styles.titulo}>Reproduzindo Tutorial...</Text>
            <Text style={styles.instrucao}>Toque na tela para fechar</Text>
            
            {/* Opcional: Mostrar o texto que está sendo lido para quem tem baixa visão */}
            <View style={styles.cardTexto}>
                <Text style={styles.textoTutorial} numberOfLines={10}>
                    {textoAtual}
                </Text>
            </View>
          </View>
        </TouchableOpacity>
      </Modal>
    </TutorialContext.Provider>
  );
};

// Hook personalizado para facilitar o uso
export const useTutorial = () => {
  const context = useContext(TutorialContext);
  if (!context) throw new Error('useTutorial deve ser usado dentro de um TutorialProvider');
  return context;
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.85)', // Fundo escuro para foco
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  containerTexto: {
    alignItems: 'center',
    width: '100%',
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
    backgroundColor: '#333',
    padding: 20,
    borderRadius: 10,
    width: '100%',
  },
  textoTutorial: {
    color: '#fff',
    fontSize: 18,
    lineHeight: 26,
    textAlign: 'center'
  }
});