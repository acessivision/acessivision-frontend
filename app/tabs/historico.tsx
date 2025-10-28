import { useEffect, useState, useRef } from 'react';
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
import { useRouter } from 'expo-router';
import { useIsFocused } from '@react-navigation/native';
import { toTitleCase } from '../../utils/toTitleCase';
import { useSpeech } from '../../hooks/useSpeech';

// ✅ Imports modulares do Firebase v9+
import { getFirestore, collection, query, where, orderBy, onSnapshot, doc, getDocs, writeBatch, deleteDoc, updateDoc, addDoc, serverTimestamp, setDoc, arrayUnion, arrayRemove, Timestamp } from '@react-native-firebase/firestore';

interface Conversation {
  id: string;
  titulo: string;
  dataCriacao: Timestamp;
  dataAlteracao: Timestamp;
}

type StepType = 'aguardandoPalavraTitulo' | 'aguardandoTitulo' | 'idle';

const HistoryScreen: React.FC = () => {
  const router = useRouter();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const { cores, getFontSize, getIconSize } = useTheme();
  const { user, isLoading: isAuthLoading } = useAuth();
  
  const isScreenFocused = useIsFocused();

  const [modalVisible, setModalVisible] = useState(false);
  const [tituloInput, setTituloInput] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [step, setStep] = useState<StepType>('idle');

  // ✅ Ref para rastrear se já processamos o título
  const tituloProcessadoRef = useRef(false);
  const tituloTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ✅ Usa o novo hook de voz
  const { 
    speak, 
    startListening, 
    stopListening,
    stopSpeaking, // ✅ Adiciona stopSpeaking para cancelar fala
    isListening,
    recognizedText,
    setRecognizedText 
  } = useSpeech({
    enabled: isScreenFocused && modalVisible, // Só ativa quando modal está aberto
    mode: 'local',
  });

  // ===================================================================
  // BUSCAR CONVERSAS DO FIRESTORE
  // ===================================================================
  useEffect(() => {
    if (!user || isAuthLoading) return;

    // ✅ API modular
    const db = getFirestore();
    const conversasCollectionRef = collection(db, 'conversas');
    const q = query(
      conversasCollectionRef,
      where('ownerUid', '==', user.uid),
      orderBy('dataAlteracao', 'desc')
    );

    const unsubscribe = onSnapshot(q,
      (querySnapshot) => {
        const conversasArray: Conversation[] = [];
        querySnapshot.forEach((documentSnapshot) => {
          conversasArray.push({
            id: documentSnapshot.id,
            titulo: documentSnapshot.data().titulo,
            dataCriacao: documentSnapshot.data().dataCriacao,
            dataAlteracao: documentSnapshot.data().dataAlteracao,
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
  // PROCESSAR RECONHECIMENTO DE VOZ
  // ===================================================================
  useEffect(() => {
    if (!recognizedText.trim() || !modalVisible) return;

    const fala = recognizedText.toLowerCase().trim();
    console.log(`[Histórico] Step: ${step}, Fala: "${fala}", isListening: ${isListening}`);

    // ✅ Passo 1: Detectar palavra "título"
    if (step === 'aguardandoPalavraTitulo' && (fala.includes('título') || fala.includes('titulo'))) {
      console.log("✅ Palavra 'título' detectada!");
      setStep('aguardandoTitulo');
      setRecognizedText('');
      tituloProcessadoRef.current = false; // Reset flag
      
      // Limpa timeout anterior se existir
      if (tituloTimeoutRef.current) {
        clearTimeout(tituloTimeoutRef.current);
        tituloTimeoutRef.current = null;
      }
      
      speak("Escutando o título. Fale e aguarde um momento.", () => {
        startListening(true); // Start listening for the full title
      });
      return;
    }

    // ✅ Passo 2: Acumular texto falado com debounce
    if (step === 'aguardandoTitulo' && fala && !tituloProcessadoRef.current) {
      console.log(`📝 Acumulando título: "${fala}"`);
      
      // Limpa timeout anterior
      if (tituloTimeoutRef.current) {
        clearTimeout(tituloTimeoutRef.current);
      }
      
      // ✅ Aguarda 2 segundos de silêncio antes de processar
      tituloTimeoutRef.current = setTimeout(() => {
        if (!tituloProcessadoRef.current && fala) {
          console.log(`✅ Título final capturado: "${fala}"`);
          tituloProcessadoRef.current = true;
          
          stopListening();
          
          // Cria a conversa automaticamente com o título falado
          speak(`Criando conversa com título: ${fala}`, () => {
            criarConversaComTitulo(fala);
          });
        }
      }, 2000); // ✅ Espera 2 segundos de pausa
      
      return;
    }

  }, [recognizedText, step, modalVisible, isListening]);

  // ===================================================================
  // EXCLUIR CONVERSA
  // ===================================================================
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
          onPress: () => deletarDocumentosDaConversa(conversationId) 
        }
      ]
    );
  };

  const deletarDocumentosDaConversa = async (conversationId: string) => {
    if (!user) return;

    console.log(`🗑️ Excluindo conversa ${conversationId}...`);
    
    try {
      // ✅ API modular
      const db = getFirestore();
      const mensagensRef = collection(doc(collection(db, 'conversas'), conversationId), 'mensagens');
      const mensagensSnapshot = await getDocs(mensagensRef);

      if (!mensagensSnapshot.empty) {
        console.log(`   ...excluindo ${mensagensSnapshot.size} mensagens.`);
        const batch = writeBatch(db);
        mensagensSnapshot.docs.forEach((docSnapshot) => {
          batch.delete(docSnapshot.ref);
        });
        await batch.commit();
      }

      console.log('   ...excluindo documento principal da conversa.');
      const conversaDocRef = doc(collection(db, 'conversas'), conversationId);
      await deleteDoc(conversaDocRef);

      console.log('   ...removendo do histórico do usuário.');
      const userDocRef = doc(collection(db, 'usuarios'), user.uid);
      await updateDoc(userDocRef, {
        historico: arrayRemove(conversationId)
      });
      
      console.log('✅ Conversa excluída e removida do histórico.');

    } catch (error) {
      console.error("❌ Erro ao excluir conversa:", error);
      let errorMessage = "Erro desconhecido";
      if (error instanceof Error) errorMessage = error.message;
      Alert.alert('Erro', 'Não foi possível excluir a conversa: ' + errorMessage);
    }
  };

  // ===================================================================
  // CRIAR CONVERSA NO FIRESTORE
  // ===================================================================
  const criarConversaComTitulo = async (titulo: string) => {
    if (!user) return;
    
    const tituloFinal = titulo.trim();
    
    if (!tituloFinal) {
      Alert.alert('Atenção', 'Por favor, digite o título ou diga "título" para informá-lo por voz.');
      return;
    }

    console.log(`📝 Criando conversa "${tituloFinal}" para ${user.uid}`);
    setIsSaving(true);

    try {
      // ✅ API modular
      const db = getFirestore();
      const conversasCollectionRef = collection(db, 'conversas');
      
      const newConversationRef = await addDoc(conversasCollectionRef, {
        titulo: tituloFinal,
        dataCriacao: serverTimestamp(),
        dataAlteracao: serverTimestamp(),
        ownerUid: user.uid,
      });

      console.log('✅ Conversa criada com ID:', newConversationRef.id);

      const userDocRef = doc(collection(db, 'usuarios'), user.uid);
      await setDoc(
        userDocRef,
        {
          historico: arrayUnion(newConversationRef.id)
        },
        { merge: true }
      );

      speak(`Conversa ${tituloFinal} criada com sucesso!`);
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
    setRecognizedText('');
    tituloProcessadoRef.current = false; // Reset flag
    
    setTimeout(() => {
      speak("Por favor, digite o título ou diga 'título' para informá-lo por voz.", () => {
        startListening(true);
      });
    }, 300);
  };

  const fecharModal = () => {
    setModalVisible(false);
    setTituloInput('');
    setStep('idle');
    setIsSaving(false);
    setRecognizedText('');
    tituloProcessadoRef.current = false; // Reset flag
    
    // ✅ Limpa timeout se existir
    if (tituloTimeoutRef.current) {
      clearTimeout(tituloTimeoutRef.current);
      tituloTimeoutRef.current = null;
    }
    
    stopListening();
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
      backgroundColor: cores.fundo
    },
    loginMessage: {
      fontSize: 18,
      textAlign: 'center',
      color: cores.texto,
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
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    itemContent: {
      flex: 1,
      marginRight: 12,
    },
    itemText: {
      fontSize: getFontSize('medium'),
      color: cores.texto,
      fontWeight: '500',
    },
    itemDateText: {
      fontSize: getFontSize('small'),
      color: cores.texto || '#888',
      marginTop: 4,
    },
    deleteButton: {
      padding: 8,
      margin: -8,
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
      backgroundColor: '#fff',
      borderRadius: 8,
      borderWidth: 1,
      borderColor: cores.texto,
    },
    input: {
      flex: 1,
      paddingHorizontal: 16,
      paddingVertical: 12,
      fontSize: getFontSize('medium'),
      color: cores.fundo,
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
      backgroundColor: cores.fundo,
      borderRadius: 8,
      marginBottom: 16,
    },
    listeningText: {
      marginLeft: 8,
      color: cores.texto,
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
      backgroundColor: cores.texto,
      alignItems: 'center',
      justifyContent: 'center',
    },
    saveButtonText: {
      color: cores.fundo,
      fontSize: getFontSize('medium'),
      fontWeight: '600',
    },
    savingIndicator: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 16,
      backgroundColor: cores.texto,
      borderRadius: 8,
      marginTop: 12,
    },
    savingText: {
      marginLeft: 8,
      color: cores.fundo,
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

  const aguardandoPalavraTitulo = step === 'aguardandoPalavraTitulo';

  return (
    <View style={[styles.container, { flex: 1 }]}>
      <FlatList
        data={conversations}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <TouchableOpacity 
            onPress={() => router.push({
              pathname: '/tabs/conversa',
              params: { conversaId: item.id, titulo: item.titulo }
            })}
            style={styles.item}
          >
            <View style={styles.itemContent}>
              <Text style={styles.itemText}>
                {String(toTitleCase(item.titulo || 'Sem título'))}
              </Text>
              <Text style={styles.itemDateText}>
                Alterado em: {String(item.dataAlteracao?.toDate?.()?.toLocaleString?.() || 'Carregando...')}
              </Text>
            </View>
            <TouchableOpacity 
              style={styles.deleteButton} 
              onPress={(e) => {e.stopPropagation(); excluirConversa(item.id, item.titulo)}}
            >
              <Ionicons 
                name="trash-outline" 
                size={getIconSize('medium')} 
                color={cores.perigo || '#FF453A'} 
              />
            </TouchableOpacity>
          </TouchableOpacity>
        )}
      />

      <TouchableOpacity
        style={styles.createButton}
        onPress={abrirModal}
        accessibilityLabel="Criar nova conversa"
      >
        <Text style={styles.createButtonText}>
          Criar Nova Conversa
        </Text>
      </TouchableOpacity>

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

            {isListening && (
              <View style={styles.listeningIndicator}>
                <ActivityIndicator size="small" color={cores.texto} />
                <Text style={styles.listeningText}>
                  {aguardandoPalavraTitulo ? 'Aguardando "Título"...' : 'Ouvindo título...'}
                </Text>
              </View>
            )}

            {/* ✅ Mostrar texto sendo capturado */}
            {step === 'aguardandoTitulo' && recognizedText && (
              <View style={[styles.listeningIndicator, { backgroundColor: cores.barrasDeNavegacao }]}>
                <Text style={styles.listeningText}>
                  "{recognizedText}"
                </Text>
              </View>
            )}

            <View style={styles.inputContainer}>
              <Text style={styles.label}>Título da Conversa</Text>
              <View style={styles.inputWrapper}>
                <TextInput
                  style={styles.input}
                  value={tituloInput}
                  onChangeText={(text) => {
                    setTituloInput(text);
                    if (step !== 'idle') {
                      setStep('idle');
                      stopListening();
                      tituloProcessadoRef.current = false;
                    }
                  }}
                  placeholder="Digite ou fale o título"
                  placeholderTextColor='#999'
                  editable={!isSaving}
                  autoFocus={false}
                />
                <TouchableOpacity 
                  style={styles.micButton}
                  onPress={() => {
                    setStep('aguardandoPalavraTitulo');
                    setRecognizedText('');
                    tituloProcessadoRef.current = false;
                    speak("Diga 'título' para começar", () => {
                      startListening(true);
                    });
                  }}
                  disabled={isListening || isSaving}
                >
                  <Ionicons 
                    name={isListening ? "mic" : "mic-outline"} 
                    size={getIconSize('medium')} 
                    color={cores.fundo} 
                  />
                </TouchableOpacity>
              </View>
            </View>

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

            {isSaving && (
              <View style={styles.savingIndicator}>
                <ActivityIndicator size="small" color={cores.fundo} />
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