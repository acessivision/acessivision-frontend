import { Tabs } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Text } from 'react-native';

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: '#ffd33d',
        headerShown: false, // Desativa o cabeçalho padrão do Tabs
        tabBarStyle: {
          backgroundColor: '#25292e',
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'AcessiVision',
          header: () => (
            <Text style={{ color: '#fff', fontSize: 18, fontWeight: 'bold', textAlign: 'center', paddingTop: 10 }}>
              AcessiVision
            </Text>
          ),
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? 'home-sharp' : 'home-outline'} color={color} size={24} />
          ),
        }}
      />
      <Tabs.Screen
        name="about"
        options={{
          title: 'About',
          header: () => (
            <Text style={{ color: '#fff', fontSize: 18, fontWeight: 'bold', textAlign: 'center', paddingTop: 10 }}>
              About
            </Text>
          ),
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? 'information-circle' : 'information-circle-outline'} color={color} size={24} />
          ),
        }}
      />
    </Tabs>
  );
}