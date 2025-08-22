import { Tabs, usePathname } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { View, StyleSheet } from 'react-native';
import CustomHeader from '../../components/CustomHeader';
import { useTheme } from '../../components/ThemeContext';

export default function TabsLayout() {
  const pathname = usePathname();
  const { mudaTema, cores } = useTheme();
  
  const getTitle = () => {
    switch (pathname) {
      case '/tabs':
      case '/tabs/':
        return 'Câmera';
      case '/tabs/historico':
        return 'Histórico';
      default:
        return 'App';
    }
  };

  const handleSettingsPress = () => {
    console.log('Botão configurações pressionado');
  };

  return (
    <View style={[styles.container, { backgroundColor: cores.barrasDeNavegacao }]}>
      <CustomHeader 
        title={getTitle()}
        mudaTema={mudaTema}
        abreConfiguracoes={handleSettingsPress}
      />
      
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarActiveTintColor: cores.icone,
          tabBarShowLabel: false,
          tabBarStyle: {
            backgroundColor: cores.barrasDeNavegacao,
            height: 80,
            paddingBottom: 10,
            borderTopWidth: 1,
            borderColor: cores.icone,
            elevation: 0,
            shadowOpacity: 0,
            shadowColor: 'transparent',
          },
          tabBarIconStyle: {
            height: 60,
            width: 60,
          },
        }}
      >
        <Tabs.Screen
          name="index"
          options={{
            title: 'Câmera',
            tabBarIcon: ({ color }) => (
              <Ionicons name="camera" color={color} size={50} />
            ),
          }}
        />
        <Tabs.Screen
          name="historico"
          options={{
            title: 'Histórico',
            tabBarIcon: ({ color }) => (
              <Ionicons name="list" color={color} size={50} />
            ),
          }}
        />
      </Tabs>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});
