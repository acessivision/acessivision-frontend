import { Tabs, usePathname, useRouter } from 'expo-router';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import CustomHeader from '../../components/CustomHeader';
import { useTheme } from '../../components/ThemeContext';
import { VoiceCommandProvider, useVoiceCommands } from '../../components/VoiceCommandContext';

function LayoutWithVoiceUI() {
  const pathname = usePathname();
  const router = useRouter();
  const { mudaTema, cores, getIconSize } = useTheme();
  const { statusMessage, isListening, recognizedText, voiceState } = useVoiceCommands();

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

  return (
    <View style={{ flex: 1, backgroundColor: cores.barrasDeNavegacao }}>
      <CustomHeader
        title={getTitle()}
        mudaTema={mudaTema}
        abreConfiguracoes={handleSettingsPress}
      />
      
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarActiveTintColor: cores.icone,
          tabBarInactiveTintColor: cores.icone, // Ajuste se houver uma cor específica para inativo
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

      {/* --- UI GLOBAL DE VOZ --- */}
      <View style={styles.voiceStatusContainer}>
        <View style={[ styles.voiceStatusBox, { backgroundColor: isListening ? '#4CAF50' : 'rgba(0, 0, 0, 0.7)' } ]}>
          <Text style={styles.statusText}>{statusMessage}</Text>
        </View>
      </View>
      
      {recognizedText && voiceState === "listening_command" && (
        <View style={styles.recognizedTextContainer}>
          <View style={styles.recognizedTextBox}>
            <Text style={styles.recognizedTextLabel}>Você disse:</Text>
            <Text style={styles.recognizedText}>"{recognizedText}"</Text>
          </View>
        </View>
      )}
    </View>
  );
}

export default function TabsLayout() {
  return (
    <VoiceCommandProvider>
      <LayoutWithVoiceUI />
    </VoiceCommandProvider>
  );
}

const styles = StyleSheet.create({
  voiceStatusContainer: {
    position: 'absolute',
    top: 120, // Posição abaixo do Header
    alignSelf: 'center',
    zIndex: 10,
  },
  voiceStatusBox: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 30,
  },
  statusText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  recognizedTextContainer: {
    position: 'absolute',
    top: 180, // Abaixo do status
    left: 20,
    right: 20,
    alignItems: 'center',
  },
  recognizedTextBox: {
    backgroundColor: "rgba(255, 255, 255, 0.95)",
    paddingHorizontal: 20,
    paddingVertical: 15,
    borderRadius: 15,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  recognizedTextLabel: {
    fontSize: 12,
    color: "#666",
    marginBottom: 5,
    fontWeight: "500",
  },
  recognizedText: {
    fontSize: 16,
    color: "#000",
    fontWeight: "600",
  },
});