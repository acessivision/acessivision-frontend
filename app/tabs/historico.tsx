import { useEffect, useState } from 'react';
import { FlatList, StyleSheet, Text, View, TouchableOpacity } from 'react-native';
import { useTheme } from '../../components/ThemeContext';

interface Conversation {
  id: string;
  name: string;
  imageUri: string;
  audioUri: string;
  createdAt: string;
}

const HistoryScreen: React.FC = () => {
  const [isScreenAccessible, setIsScreenAccessible] = useState(false);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const { cores, getFontSize } = useTheme();

  const handleFirstTouch = () => {
    // Só ativa na primeira vez.
    if (!isScreenAccessible) {
      console.log('Ativando acessibilidade da tela...');
      setIsScreenAccessible(true);
    }
  };

  useEffect(() => {
    const fetchConversations = () => {};
    fetchConversations();
  }, []);

  const styles = StyleSheet.create({
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

  return (
    <TouchableOpacity
          activeOpacity={1} // Para não parecer um botão
          onPress={handleFirstTouch}
          style={{ flex: 1 }}
        >
          {/* 3. Use as propriedades de acessibilidade no container do seu conteúdo. */}
          <View
            style={styles.content}
            // `accessible` esconde os filhos do leitor no iOS
            accessible={isScreenAccessible}
            // `importantForAccessibility` esconde os filhos no Android
            importantForAccessibility={isScreenAccessible ? 'auto' : 'no-hide-descendants'}
          >
            <View style={styles.container}>
              <FlatList
                data={conversations}
                keyExtractor={(item) => item.id}
                renderItem={({ item }) => (
                  <View style={styles.item}>
                    <Text style={styles.itemText}>
                      Nome: {item.name}
                    </Text>
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