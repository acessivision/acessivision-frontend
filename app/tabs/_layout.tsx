import { Tabs, usePathname, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { View, StyleSheet } from 'react-native';
import CustomHeader from '../../components/CustomHeader';
import { useTheme } from '../../components/ThemeContext';

export default function TabsLayout() {
  const pathname = usePathname();
  const router = useRouter();
  const { mudaTema, cores, getIconSize } = useTheme();

  const getTitle = () => {
    switch (pathname) {
      case '/tabs':
      case '/tabs/':
      case '/tabs/index':
        return 'Câmera';
      case '/tabs/historico':
        return 'Histórico';
      case '/tabs/configuracoes':
        return 'Configurações';
      case '/tabs/editarPerfil':
        return 'Editar Perfil';
      default:
        return 'App';
    }
  };

  const handleSettingsPress = () => {
    router.navigate('/tabs/configuracoes');
  };

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: cores.barrasDeNavegacao,
    },
  });

  return (
    <View style={styles.container}>
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
              <Ionicons name="camera" color={color} size={getIconSize('xlarge')} />
            ),
          }}
        />
        <Tabs.Screen
          name="historico"
          options={{
            title: 'Histórico',
            tabBarIcon: ({ color }) => (
              <Ionicons name="list" color={color} size={getIconSize('xlarge')} />
            ),
          }}
        />
        {/* Config screen is routable but hidden from tab bar */}
        <Tabs.Screen
          name="configuracoes"
          options={{
            href: null, // hides it from the tab bar
          }}
        />
        {/* Config screen is routable but hidden from tab bar */}
        <Tabs.Screen
          name="editarPerfil"
          options={{
            href: null, // hides it from the tab bar
          }}
        />
      </Tabs>
    </View>
  );
}