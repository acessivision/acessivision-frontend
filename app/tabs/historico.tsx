import { useEffect, useState, useCallback } from 'react'; // Adicione useCallback se ainda não tiver
import { FlatList, StyleSheet, Text, View, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useTheme } from '../../components/ThemeContext';
import { useAuth } from '../../components/AuthContext';

interface Conversation {
  id: string;
  name: string;
  // ... outras propriedades
  createdAt: string;
}

const HistoryScreen: React.FC = () => {
  // ===================================================================
  // PASSO 1: Todas as chamadas de Hooks devem estar aqui, no topo.
  // ===================================================================
  const [isScreenAccessible, setIsScreenAccessible] = useState(false);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const { cores, getFontSize } = useTheme();
  const { user, isLoading: isAuthLoading } = useAuth();

  useEffect(() => {
    // Este código será executado sempre que a variável 'user' mudar.
    if (user) {
      // Se 'user' não for nulo, significa que o usuário está logado.
      console.log("✅ Usuário autenticado:", user.email);
    } else {
      // Se 'user' for nulo, o usuário não está logado.
      console.log("❌ Nenhum usuário logado.");
    }
  }, [user]); // O array [user] diz ao useEffect para observar a variável 'user'.

  // O useEffect foi movido para cima, antes dos retornos condicionais.
  useEffect(() => {
    const fetchConversations = () => {
      // Lógica para buscar o histórico do usuário logado
      console.log("Buscando conversas para o usuário:", user?.uid);
    };

    // Só busca as conversas se o usuário estiver logado e o carregamento inicial tiver terminado
    if (user && !isAuthLoading) {
      fetchConversations();
    }
  }, [user, isAuthLoading]); // Adiciona dependências para re-buscar se necessário

  // ===================================================================
  // PASSO 2: As funções e lógicas podem vir depois dos hooks.
  // ===================================================================
  const styles = StyleSheet.create({
    // ...seus estilos continuam aqui, sem alterações
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
    content: {
        flex: 1,
    },
    container: {
        flex: 1,
        padding: 16,
        backgroundColor: cores.fundo,
    },
    title: {
        fontSize: getFontSize('xlarge'),
        fontWeight: 'bold',
        marginBottom: 16,
        color: cores.texto,
    },
    item: {
        padding: 16,
        marginBottom: 8,
        borderRadius: 8,
        backgroundColor: cores.fundo,
    },
    itemText: {
        fontSize: getFontSize('medium'),
        color: cores.texto,
    },
    empty: {
        fontSize: getFontSize('medium'),
        textAlign: 'center',
        marginTop: 20,
        color: cores.texto,
    },
  });

  const handleFirstTouch = () => {
    if (!isScreenAccessible) {
      setIsScreenAccessible(true);
    }
  };

  // ===================================================================
  // PASSO 3: Os retornos condicionais (early returns) vêm por último.
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

  // Se chegou aqui, o usuário está logado. Renderiza a tela principal.
  return (
    <TouchableOpacity
      activeOpacity={1}
      onPress={handleFirstTouch}
      style={{ flex: 1 }}
    >
      <View
        style={styles.content}
        accessible={isScreenAccessible}
        importantForAccessibility={isScreenAccessible ? 'auto' : 'no-hide-descendants'}
      >
        <View style={styles.container}>
          <FlatList
            data={conversations}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => (
              <View style={styles.item}>
                <Text style={styles.itemText}>Nome: {item.name}</Text>
                <Text style={styles.itemText}>
                  Criado em: {new Date(item.createdAt).toLocaleString()}
                </Text>
              </View>
            )}
            ListEmptyComponent={
              <Text style={styles.empty}>
                Nenhuma conversa encontrada.
              </Text>
            }
          />
        </View>
      </View>
    </TouchableOpacity>
  );
};

export default HistoryScreen;