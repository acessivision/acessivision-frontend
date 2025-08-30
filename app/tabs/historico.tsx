import * as SQLite from 'expo-sqlite';
import { useEffect, useState } from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../../components/ThemeContext';

const db = SQLite.openDatabaseSync('conversations.db');

interface Conversation {
  id: string;
  name: string;
  imageUri: string;
  audioUri: string;
  createdAt: string;
}

const HistoryScreen: React.FC = () => {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const { cores, getFontSize } = useTheme();

  useEffect(() => {
    const fetchConversations = () => {
      const result = db.getAllSync<Conversation>(
        'SELECT * FROM conversations ORDER BY createdAt DESC'
      );
      setConversations(result);
    };
    fetchConversations();
  }, []);

  const styles = StyleSheet.create({
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
    <View style={styles.container}>
      <Text style={styles.title}>
        Histórico de Conversas
      </Text>
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
  );
};

export default HistoryScreen;