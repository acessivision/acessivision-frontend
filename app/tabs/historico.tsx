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
  const { cores } = useTheme();

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
    <View style={[styles.container, { backgroundColor: cores.fundo }]}>
      <Text style={[styles.title, { color: cores.texto }]}>
        Histórico de Conversas
      </Text>
      <FlatList
        data={conversations}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <View
            style={[styles.item, { backgroundColor: cores.fundo }]}
          >
            <Text style={[styles.itemText, { color: cores.texto }]}>
              Nome: {item.name}
            </Text>
            <Text style={[styles.itemText, { color: cores.texto }]}>
              Criado em: {new Date(item.createdAt).toLocaleString()}
            </Text>
          </View>
        )}
        ListEmptyComponent={
          <Text style={[styles.empty, { color: cores.texto }]}>
            Nenhuma conversa encontrada.
          </Text>
        }
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 16,
  },
  item: {
    padding: 16,
    marginBottom: 8,
    borderRadius: 8,
  },
  itemText: {
    fontSize: 16,
  },
  empty: {
    fontSize: 16,
    textAlign: 'center',
    marginTop: 20,
  },
});

export default HistoryScreen;
