import * as SQLite from 'expo-sqlite';
import { useEffect, useState } from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';

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

  useEffect(() => {
    const fetchConversations = () => {
      const result = db.getAllSync<Conversation>(
        'SELECT * FROM conversations ORDER BY createdAt DESC'
      );
      setConversations(result);
    };
    fetchConversations();
  }, []);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Histórico de Conversas</Text>
      <FlatList
        data={conversations}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <View style={styles.item}>
            <Text style={styles.itemText}>Nome: {item.name}</Text>
            <Text style={styles.itemText}>Criado em: {new Date(item.createdAt).toLocaleString()}</Text>
          </View>
        )}
        ListEmptyComponent={<Text style={styles.empty}>Nenhuma conversa encontrada.</Text>}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
    backgroundColor: '#25292e',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 16,
  },
  item: {
    padding: 16,
    marginBottom: 8,
    backgroundColor: '#333',
    borderRadius: 8,
  },
  itemText: {
    color: '#fff',
    fontSize: 16,
  },
  empty: {
    color: '#fff',
    fontSize: 16,
    textAlign: 'center',
    marginTop: 20,
  },
});

export default HistoryScreen;