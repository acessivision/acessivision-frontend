import { useEffect, useState } from 'react';
import { 
  FlatList, 
  StyleSheet, 
  Text, 
  View, 
  TouchableOpacity, 
  ActivityIndicator,
  Alert,
  Modal,
  TextInput,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../components/ThemeContext';
import { useAuth } from '../../components/AuthContext';
import {
  useSpeechRecognitionEvent,
  ExpoSpeechRecognitionResultEvent,
} from "expo-speech-recognition";
import firestore from '@react-native-firebase/firestore';

// Importa as funções auxiliares de voz
import { 
  falar, 
  ouvir, 
  pararTudo, 
  contemPalavra,
  ehEco,
  pararReconhecimento,
  RECONHECIMENTO_CONTINUO 
} from '../../utils/voiceHelpers';

interface Conversation {
  id: string;
  titulo: string;
  data: any;
}

type StepType = 'aguardandoPalavraTitulo' | 'aguardandoTitulo' | 'idle';

const HistoryScreen: React.FC = () => {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const { cores, temaAplicado, getFontSize, getIconSize } = useTheme();
  const { user, isLoading: isAuthLoading } = useAuth();

  // Estados do Modal
  const [modalVisible, setModalVisible] = useState(false);
  const [tituloInput, setTituloInput] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [step, setStep] = useState<StepType>('idle');

  // ===================================================================
  // BUSCAR CONVERSAS DO FIRESTORE
  // ===================================================================
  useEffect(() => {
    if (!user || isAuthLoading) return;

    const unsubscribe = firestore()
      .collection('conversas')
      .where('ownerUid', '==', user.uid)
      .orderBy('data', 'desc')
      .onSnapshot(
        (querySnapshot) => {
          const conversasArray: Conversation[] = [];
          
          querySnapshot.forEach((documentSnapshot) => {
            conversasArray.push({
              id: documentSnapshot.id,
              titulo: documentSnapshot.data().titulo,
              data: documentSnapshot.data().data,
            });
          });

          console.log(`✅ ${conversasArray.length} conversas encontradas`);
          setConversations(conversasArray);
        },
        (error) => {
          console.error('❌ Erro ao buscar conversas:', error);
          Alert.alert('Erro', 'Não foi possível carregar as conversas.');
        }
      );

    return () => unsubscribe();
  }, [user, isAuthLoading]);

  // ===================================================================
  // PROCESSAR COMANDOS DE VOZ
  // ===================================================================
  const processarComando = (fala: string) => {
    console.log(`[História] Step: ${step}, Fala: "${fala}"`);

    // Ignora eco do próprio app
    if (ehEco(fala, ["digite", "por favor", "conversa"])) {
      console.log("[História] Ignorando eco do app");
      return;
    }

    // Estágio 1: Aguardando a palavra "título"
    if (step === 'aguardandoPalavraTitulo') {
      if (contemPalavra(fala, ["título", "titulo"])) {
        console.log("✅ Palavra 'título' detectada!");
        setStep('aguardandoTitulo');
        falar("Escutando", () => ouvir(true, RECONHECIMENTO_CONTINUO));
      }
    }
    
    // Estágio 2: Capturando o título completo
    else if (step === 'aguardandoTitulo') {
        console.log("[História] Título capturado:", fala);
        setTituloInput(fala);
        setStep('idle');
        pararReconhecimento();
        
        // Salva automaticamente
        setTimeout(() => {
          criarConversaComTitulo(fala);
        }, 100);
      }
    };

  const excluirConversa = (conversationId: string, titulo: string) => {
    if (!user) return;

    Alert.alert(
      "Confirmar Exclusão",
      `Tem certeza de que deseja excluir a conversa "${titulo}"? Esta ação não pode ser desfeita.`,
      [
        { 
          text: "Cancelar", 
          style: "cancel" 
        },
        { 
          text: "Excluir", 
          style: "destructive", 
          // Chama a função que realmente deleta
          onPress: () => deletarDocumentosDaConversa(conversationId) 
        }
      ]
    );
  };

const deletarDocumentosDaConversa = async (conversationId: string) => {
    if (!user) return;

    console.log(`🗑️ Excluindo conversa ${conversationId}`);
    try {
      // 1. Deletar o documento principal da conversa
      await firestore()
        .collection('conversas')
        .doc(conversationId)
        .delete();

      // 2. Remover a referência do histórico do usuário
      await firestore()
        .collection('usuarios')
        .doc(user.uid)
        .update({
          historico: firestore.FieldValue.arrayRemove(conversationId)
        });
      
      console.log('✅ Conversa excluída e removida do histórico.');
      // O onSnapshot cuidará de atualizar a UI automaticamente.
      // Opcional: falar("Conversa excluída.");

    } catch (error) {
      console.error("❌ Erro ao excluir conversa:", error);
      Alert.alert('Erro', 'Não foi possível excluir a conversa. Tente novamente.');
    }
  };

  // ===================================================================
  // CAPTURA DA FALA
  // ===================================================================
  useSpeechRecognitionEvent(
    "result",
    (event: ExpoSpeechRecognitionResultEvent) => {
      if (!modalVisible) return; // não processa se modal não está aberto
      const fala = event.results?.[0]?.transcript?.toLowerCase() || "";
      if (fala.trim()) {
        console.log("[História] Usuário disse:", fala);
        processarComando(fala);
      }
    }
  );

  useSpeechRecognitionEvent("error", (event) => {
    if (modalVisible) {
      const errorCode = event.error;
      console.error("[Speech] Erro:", errorCode);

      if (errorCode !== 'no-speech' && step !== 'idle') {
        falar('Ocorreu um erro. Você pode digitar o título.', () => {});
      }
      
      // Se estava aguardando "título", continua ouvindo
      if (step === 'aguardandoPalavraTitulo') {
        setTimeout(() => ouvir(modalVisible, RECONHECIMENTO_CONTINUO), 500);
      }
    }
  });

  useSpeechRecognitionEvent("end", () => {
    if (modalVisible && step === 'aguardandoPalavraTitulo') {
      console.log("⏰ Reconhecimento terminou, reiniciando...");
      setTimeout(() => ouvir(modalVisible, RECONHECIMENTO_CONTINUO), 500);
    }
  });

  useEffect(() => {
    return () => {
      pararTudo();
    };
  }, []);

  // ===================================================================
  // CRIAR CONVERSA NO FIRESTORE
  // ===================================================================
  const criarConversaComTitulo = async (titulo: string) => {
    if (!user) return;
    
    const tituloFinal = titulo.trim();
    
    if (!tituloFinal) {
      Alert.alert('Atenção', 'Por favor, digite o título ou fale. Título. Caso queira informa-lo por voz.');
      return;
    }

    console.log(`📝 Criando conversa "${tituloFinal}" para ${user.uid}`);
    setIsSaving(true);

    try {
      const newConversationRef = await firestore()
        .collection('conversas')
        .add({
          titulo: tituloFinal,
          data: firestore.FieldValue.serverTimestamp(),
          ownerUid: user.uid,
          status: 'ativa'
        });

      console.log('✅ Conversa criada com ID:', newConversationRef.id);

      await firestore()
        .collection('usuarios')
        .doc(user.uid)
        .set(
          {
            historico: firestore.FieldValue.arrayUnion(newConversationRef.id)
          },
          { merge: true }
        );

      falar(`Conversa ${tituloFinal} criada com sucesso!`, () => {});

      // Fecha o modal
      fecharModal();

    } catch (error) {
      console.error("❌ Erro ao criar conversa:", error);
      Alert.alert('Erro', 'Não foi possível criar a conversa. Tente novamente.');
    } finally {
      setIsSaving(false);
    }
  };

  const criarConversaManual = () => {
    criarConversaComTitulo(tituloInput);
  };

  // ===================================================================
  // ABRIR/FECHAR MODAL
  // ===================================================================
  const abrirModal = () => {
    setTituloInput('');
    setStep('aguardandoPalavraTitulo');
    setModalVisible(true);
    setIsSaving(false);
    
    // Inicia o fluxo de voz
    setTimeout(() => {
      falar("Por favor, digite o título ou fale. Título. Caso queira informa-lo por voz.", () => ouvir(true, RECONHECIMENTO_CONTINUO));
    }, 300);
  };

  const fecharModal = () => {
    setModalVisible(false);
    setTituloInput('');
    setStep('idle');
    setIsSaving(false);
    
    pararTudo();
  };

  // ===================================================================
  // ESTILOS
  // ===================================================================
  const styles = StyleSheet.create({
    centered: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      padding: 20,
    },
    loginMessage: {
      fontSize: 18,
      textAlign: 'center',
      color: '#666',
    },
    container: {
      flex: 1,
      padding: 16,
      backgroundColor: cores.fundo,
    },
    item: {
      padding: 16,
      marginBottom: 8,
      borderRadius: 8,
      backgroundColor: cores.barrasDeNavegacao,
      flexDirection: 'row', // MODIFICADO
      justifyContent: 'space-between', // MODIFICADO
      alignItems: 'center', // MODIFICADO
    },
    itemContent: { // NOVO
      flex: 1, // Faz o texto ocupar o espaço e empurrar o botão
      marginRight: 12, // Espaço entre o texto e o botão
    },
    itemText: {
      fontSize: getFontSize('medium'),
      color: cores.texto,
      fontWeight: '500', // NOVO: Dando um leve destaque ao título
    },
    itemDateText: { // NOVO
      fontSize: getFontSize('small'),
      color: cores.texto || '#888', // Usa cor secundária ou cinza
      marginTop: 4,
    },
    deleteButton: { // NOVO
      padding: 8, // Aumenta a área de toque
      margin: -8, // Compensa o padding para alinhar visualmente
    },
    empty: {
      fontSize: getFontSize('medium'),
      textAlign: 'center',
      marginTop: 20,
      color: cores.texto,
    },
    createButton: {
      backgroundColor: cores.barrasDeNavegacao,
      paddingVertical: 14,
      paddingHorizontal: 20,
      borderRadius: 25,
      margin: 16,
      alignItems: 'center',
      justifyContent: 'center',
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.25,
      shadowRadius: 3.84,
      elevation: 5,
    },
    createButtonText: {
      color: cores.texto,
      fontSize: getFontSize('medium'),
      fontWeight: 'bold',
    },
    // Estilos do Modal
    modalOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.7)',
      justifyContent: 'center',
      alignItems: 'center',
      padding: 20,
    },
    modalContent: {
      backgroundColor: cores.fundo,
      borderRadius: 20,
      padding: 28,
      width: '100%',
      maxWidth: 500,
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.3,
      shadowRadius: 5,
      elevation: 8,
    },
    modalHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 20,
    },
    modalTitle: {
      fontSize: getFontSize('large'),
      fontWeight: 'bold',
      color: cores.texto,
    },
    closeButton: {
      padding: 4,
    },
    inputContainer: {
      marginBottom: 20,
    },
    label: {
      fontSize: getFontSize('medium'),
      color: cores.texto,
      marginBottom: 8,
      fontWeight: '500',
    },
    inputWrapper: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: temaAplicado === 'dark' ? '#2C2C2C' : '#F5F5F5',
      borderRadius: 8,
      borderWidth: 1,
      borderColor: temaAplicado === 'dark' ? '#444' : '#DDD',
    },
    input: {
      flex: 1,
      paddingHorizontal: 16,
      paddingVertical: 12,
      fontSize: getFontSize('medium'),
      color: cores.texto,
    },
    micButton: {
      padding: 12,
      marginRight: 4,
    },
    listeningIndicator: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 12,
      backgroundColor: temaAplicado === 'dark' ? '#1E4D2B' : '#E8F5E9',
      borderRadius: 8,
      marginBottom: 16,
    },
    listeningText: {
      marginLeft: 8,
      color: temaAplicado === 'dark' ? '#4CAF50' : '#2E7D32',
      fontSize: getFontSize('medium'),
      fontWeight: '500',
    },
    modalActions: {
      flexDirection: 'row',
      gap: 12,
    },
    cancelButton: {
      flex: 1,
      paddingVertical: 12,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: cores.texto,
      alignItems: 'center',
    },
    cancelButtonText: {
      color: cores.texto,
      fontSize: getFontSize('medium'),
      fontWeight: '600',
    },
    saveButton: {
      flex: 1,
      paddingVertical: 12,
      borderRadius: 8,
      backgroundColor: temaAplicado === 'dark' ? '#ffffff' : '#000000',
      alignItems: 'center',
      justifyContent: 'center',
    },
    saveButtonDisabled: {
      opacity: 0.5,
    },
    saveButtonText: {
      color: temaAplicado === 'dark' ? '#000000' : '#ffffff',
      fontSize: getFontSize('medium'),
      fontWeight: '600',
    },
    savingIndicator: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 16,
      backgroundColor: temaAplicado === 'dark' ? '#2C2C2C' : '#F5F5F5',
      borderRadius: 8,
      marginTop: 12,
    },
    savingText: {
      marginLeft: 8,
      color: cores.texto,
      fontSize: getFontSize('medium'),
      fontWeight: '500',
    },
  });

  // ===================================================================
  // RENDERIZAÇÃO
  // ===================================================================
  if (isAuthLoading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  if (!user) {
    return (
      <View style={styles.centered}>
        <Text style={styles.loginMessage}>
          Faça login para acessar o histórico
        </Text>
      </View>
    );
  }

  function toTitleCase(str: string) {
    return str.replace(
      /\w\S*/g,
      text => text.charAt(0).toUpperCase() + text.substring(1).toLowerCase()
    );
  }

  const isListening = step !== 'idle';
  const aguardandoPalavraTitulo = step === 'aguardandoPalavraTitulo';
  const tituloCapturadoPorVoz = step === 'aguardandoTitulo' || (step === 'idle' && tituloInput && !isSaving);

  return (
    <View style={[styles.container, { flex: 1 }]}>
      {/* Lista de Conversas */}
      <FlatList
        style={{ flex: 1 }}
        data={conversations}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <View style={styles.item}>
            {/* NOVO: Wrapper para o conteúdo de texto */}
            <View style={styles.itemContent}>
              <Text style={styles.itemText}>
              {String(toTitleCase(item.titulo || 'Sem título'))}
            </Text>

            <Text style={styles.itemDateText}>
              Criado em: {String(item.data?.toDate?.()?.toLocaleString?.() || 'Carregando...')}
            </Text>
            </View>
            
            {/* NOVO: Botão de excluir */}
            <TouchableOpacity 
              style={styles.deleteButton} 
              onPress={() => excluirConversa(item.id, item.titulo)}
              accessibilityLabel="Excluir conversa"
              accessibilityHint={`Excluir a conversa ${item.titulo}`}
            >
              <Ionicons 
                name="trash-outline" 
                size={getIconSize('medium')} 
                // Usa uma cor de perigo do seu tema, ou um vermelho padrão
                color={cores.perigo || '#FF453A'} 
              />
            </TouchableOpacity>
          </View>
        )}
        ListEmptyComponent={
          <Text style={styles.empty}>
            Nenhuma conversa encontrada. Crie uma nova!
          </Text>
        }
      />

      {/* Botão de Criação */}
      <TouchableOpacity
        style={styles.createButton}
        onPress={abrirModal}
        accessibilityLabel="Criar nova conversa"
        accessibilityHint="Toque para abrir o modal e criar uma nova conversa"
      >
        <Text style={styles.createButtonText}>
          Criar Nova Conversa
        </Text>
      </TouchableOpacity>

      {/* Modal de Criação */}
      <Modal
        visible={modalVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={fecharModal}
        statusBarTranslucent={true}
      >
        <View style={styles.modalOverlay}>
          <TouchableOpacity 
            style={[StyleSheet.absoluteFill, { backgroundColor: 'transparent' }]}
            activeOpacity={1} 
            onPress={fecharModal}
          />
          
          <View style={styles.modalContent}>
            {/* Header */}
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Nova Conversa</Text>
              <TouchableOpacity 
                style={styles.closeButton} 
                onPress={fecharModal}
                disabled={isSaving}
              >
                <Ionicons 
                  name="close" 
                  size={getIconSize('medium')} 
                  color={cores.texto} 
                />
              </TouchableOpacity>
            </View>

            {/* Indicador de escuta */}
            {isListening && (
              <View style={styles.listeningIndicator}>
                <ActivityIndicator size="small" color={temaAplicado === 'dark' ? '#4CAF50' : '#2E7D32'} />
                <Text style={styles.listeningText}>
                  {aguardandoPalavraTitulo ? 'Aguardando "Título"...' : 'Ouvindo...'}
                </Text>
              </View>
            )}

            {/* Input */}
            <View style={styles.inputContainer}>
              <Text style={styles.label}>Título da Conversa</Text>
              <View style={styles.inputWrapper}>
                <TextInput
                  style={styles.input}
                  value={tituloInput}
                  onChangeText={(text) => {
                    setTituloInput(text);
                    
                    // Para a escuta se o usuário começar a digitar
                    if (step === 'aguardandoPalavraTitulo') {
                      console.log("✋ Usuário começou a digitar, parando escuta");
                      setStep('idle');
                      pararReconhecimento();
                    }
                  }}
                  placeholder="Digite ou fale o título"
                  placeholderTextColor={temaAplicado === 'dark' ? '#888' : '#999'}
                  editable={!isSaving}
                  autoFocus={false}
                />
                <TouchableOpacity 
                  style={styles.micButton}
                  onPress={() => {
                    setStep('aguardandoPalavraTitulo');
                    falar("Por favor, digite o título ou fale. Título. Caso queira informa-lo por voz.", () => ouvir());
                  }}
                  disabled={isListening || isSaving}
                >
                  <Ionicons 
                    name={isListening ? "mic" : "mic-outline"} 
                    size={getIconSize('medium')} 
                    color={isListening ? '#4CAF50' : cores.icone} 
                  />
                </TouchableOpacity>
              </View>
            </View>

            {/* Botões - Aparecem quando não está aguardando título por voz */}
            {step === 'idle' && !isSaving && (
              <View style={styles.modalActions}>
                <TouchableOpacity 
                  style={styles.cancelButton}
                  onPress={fecharModal}
                >
                  <Text style={styles.cancelButtonText}>Cancelar</Text>
                </TouchableOpacity>

                <TouchableOpacity 
                  style={styles.saveButton}
                  onPress={criarConversaManual}
                >
                  <Text style={styles.saveButtonText}>Salvar</Text>
                </TouchableOpacity>
              </View>
            )}

            {/* Indicador de salvamento */}
            {isSaving && (
              <View style={styles.savingIndicator}>
                <ActivityIndicator size="small" color={cores.texto} />
                <Text style={styles.savingText}>Salvando conversa...</Text>
              </View>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
};

export default HistoryScreen;