import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  StatusBar,
  ActivityIndicator,
} from "react-native";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useTheme } from "../../components/ThemeContext";
import { useAuth } from "../../components/AuthContext";
import { useIsFocused } from "@react-navigation/native";
import * as Speech from "expo-speech";
import {
  ExpoSpeechRecognitionModule,
  ExpoSpeechRecognitionResultEvent,
  useSpeechRecognitionEvent,
} from "expo-speech-recognition";

const API_URL = `http://${process.env.EXPO_PUBLIC_IP}:3000`;

export default function EditProfileScreen() {
  const router = useRouter();
  const { cores, temaAplicado, getIconSize, getFontSize } = useTheme();
  const { user } = useAuth();
  const isFocused = useIsFocused();

  const [nome, setNome] = useState("João da Silva");
  const [email, setEmail] = useState("joaosilva@gmail.com");
  const [senha, setSenha] = useState("*******");
  const [showPassword, setShowPassword] = useState(false);
  
  // Estado do plano
  const [currentPlan, setCurrentPlan] = useState<string>('free');
  const [loadingPlan, setLoadingPlan] = useState(true);

  const [step, setStep] = useState<
    "intro" | "esperandoCampo" | "esperandoNovoValor"
  >("intro");
  const [campoSelecionado, setCampoSelecionado] = useState<
    "nome" | "email" | "senha" | null
  >(null);

  // Carregar plano do usuário
  useEffect(() => {
    if (user) {
      loadCurrentPlan();
    }
  }, [user]);

  const loadCurrentPlan = async () => {
    if (!user) return;

    try {
      const response = await fetch(`${API_URL}/user/${user.uid}/plan`);
      const data = await response.json();
      
      if (data.success) {
        setCurrentPlan(data.plano);
      }
    } catch (error) {
      console.error('Erro ao carregar plano:', error);
    } finally {
      setLoadingPlan(false);
    }
  };

  const handleGoBack = () => {
    router.back();
  };

  const handleUpdateData = () => {
    console.log("Atualizar Dados pressed");
  };

  const togglePasswordVisibility = () => {
    setShowPassword(!showPassword);
  };

  // Navegar para tela de upgrade
  const handleUpgrade = () => {
    router.push('../upgrade');
  };

  // ---- Funções de voz ----
  const falar = (texto: string, callback?: () => void) => {
    Speech.stop();
    Speech.speak(texto, {
      language: "pt-BR",
      onDone: () => {
        if (callback) callback();
      },
      onStopped: () => {
        if (callback) callback();
      },
    });
  };

  const ouvir = async () => {
    try {
      if (!isFocused) return;
      const { granted } =
        await ExpoSpeechRecognitionModule.requestPermissionsAsync();
      if (!granted) {
        console.warn("Permissão para reconhecimento de fala negada");
        return;
      }

      ExpoSpeechRecognitionModule.start({
        lang: "pt-BR",
        interimResults: false,
        continuous: true,
      });

      console.log("[Reconhecimento] Iniciado...");
    } catch (e) {
      console.error("Erro ao iniciar reconhecimento:", e);
    }
  };

  const processarComando = (fala: string) => {
    if (fala.includes("escuta")) {
      console.log("[Editar Perfil] Ignorando palavra de ativação global");
      return;
    }

    if (step === "esperandoCampo") {
      if (fala.includes("nome")) {
        setCampoSelecionado("nome");
        falar(
          `O nome salvo é ${nome}. Para qual nome quer alterar? Diga "Cancelar" caso não quiser alterar.`,
          () => ouvir()
        );
        setStep("esperandoNovoValor");
      } else if (fala.includes("email") || fala.includes("e-mail")) {
        setCampoSelecionado("email");
        falar(
          `O e-mail salvo é ${email}. Para qual e-mail quer alterar? Diga "Cancelar" caso não quiser alterar.`,
          () => ouvir()
        );
        setStep("esperandoNovoValor");
      } else if (fala.includes("senha")) {
        setCampoSelecionado("senha");
        falar(
          `A senha atual é ${senha}. Para qual senha quer alterar? Diga "Cancelar" caso não quiser alterar.`,
          () => ouvir()
        );
        setStep("esperandoNovoValor");
      } else {
        falar("Não entendi. Diga nome, e-mail ou senha.", () => ouvir());
      }
    } else if (step === "esperandoNovoValor" && campoSelecionado) {
      if (fala.includes("cancelar")) {
        falar(
          `Alteração de ${campoSelecionado} cancelada. Diga nome, e-mail ou senha para escolher outro campo.`,
          () => ouvir()
        );
        setCampoSelecionado(null);
        setStep("esperandoCampo");
      } else {
        if (campoSelecionado === "nome") setNome(fala);
        if (campoSelecionado === "email") setEmail(fala.replace(/\s+/g, ''));
        if (campoSelecionado === "senha") setSenha(fala.replace(/\s+/g, ''));
        falar(`${campoSelecionado} atualizado para ${fala}.`, () => ouvir());
        setCampoSelecionado(null);
        setStep("esperandoCampo");
      }
    }
  };

  useSpeechRecognitionEvent(
    "result",
    (event: ExpoSpeechRecognitionResultEvent) => {
      if (!isFocused) return;
      const fala = event.results?.[0]?.transcript?.toLowerCase() || "";
      if (fala.trim()) {
        console.log("[Reconhecimento Editar Perfil] Usuário disse:", fala);
        processarComando(fala);
      }
    }
  );

  useEffect(() => {
    if (isFocused) {
      falar(
        'Diga "nome" para alterar seu nome, "e-mail" para alterar seu e-mail ou "senha" para alterar sua senha.',
        () => {
          setStep("esperandoCampo");
          ouvir();
        }
      );
    } else {
      ExpoSpeechRecognitionModule.stop();
      Speech.stop();
    }

    return () => {
      ExpoSpeechRecognitionModule.stop();
      Speech.stop();
    };
  }, [isFocused]);

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: cores.fundo,
    },
    header: {
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: 16,
      paddingVertical: 16,
      paddingTop: 60,
      backgroundColor: cores.fundo,
    },
    backButton: {
      marginRight: 16,
      flexDirection: 'row',
      alignItems: 'center',
    },
    backIcon: {
      marginRight: 16,
    },
    headerTitle: {
      marginLeft: 8,
      fontSize: getFontSize('large'),
      fontWeight: 'bold',
      color: cores.texto,
    },
    content: {
      flex: 1,
      paddingHorizontal: 16,
      paddingTop: 24,
    },
    
    // Card de Status do Plano
    planCard: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      backgroundColor: temaAplicado === 'dark' ? '#2a2a2a' : '#f0f0f0',
      borderRadius: 12,
      padding: 16,
      marginBottom: 24,
      borderWidth: 1,
      borderColor: temaAplicado === 'dark' ? '#444' : '#ddd',
    },
    planInfo: {
      flex: 1,
    },
    planLabel: {
      fontSize: 12,
      color: temaAplicado === 'dark' ? '#aaa' : '#666',
      marginBottom: 4,
    },
    planName: {
      fontSize: 18,
      fontWeight: 'bold',
      color: cores.texto,
    },
    planBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: temaAplicado === 'dark' ? '#4CAF50' : '#2196F3',
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 16,
    },
    planBadgeText: {
      color: '#fff',
      fontSize: 12,
      fontWeight: 'bold',
      marginLeft: 4,
    },
    upgradeButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: '#FFD700',
      borderRadius: 8,
      paddingVertical: 12,
      paddingHorizontal: 16,
      marginBottom: 24,
      elevation: 3,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.2,
      shadowRadius: 4,
    },
    upgradeButtonText: {
      color: '#000',
      fontSize: 16,
      fontWeight: 'bold',
      marginLeft: 8,
    },
    
    inputContainer: {
      marginBottom: 24,
    },
    label: {
      fontSize: 16,
      fontWeight: "500",
      color: cores.texto,
      marginBottom: 8,
    },
    inputWrapper: {
      position: "relative",
    },
    input: {
      backgroundColor: "#ffffff",
      borderWidth: 1,
      borderColor: temaAplicado === "dark" ? "#fff" : "#000",
      borderRadius: 8,
      paddingHorizontal: 16,
      paddingVertical: 16,
      fontSize: 16,
      color: "#000",
    },
    passwordInput: {
      paddingRight: 50,
    },
    eyeIcon: {
      position: "absolute",
      right: 16,
      top: "50%",
      marginTop: -12,
    },
    updateButton: {
      backgroundColor: temaAplicado === "dark" ? "#ffffff" : "#000000",
      borderRadius: 8,
      paddingVertical: 16,
      alignItems: "center",
      marginTop: 32,
    },
    updateButtonText: {
      fontSize: 16,
      fontWeight: "600",
      color: temaAplicado === "dark" ? "#000000" : "#ffffff",
    },
    bottomTabsSpace: {
      height: 100,
    },
  });

  return (
    <View style={styles.container}>
      <StatusBar
        backgroundColor={cores.fundo}
        barStyle={temaAplicado === "dark" ? "light-content" : "dark-content"}
      />

      <View style={styles.header}>
        <TouchableOpacity 
          style={styles.backButton} 
          onPress={handleGoBack}
        >
          <View style={styles.backIcon}>
            <Ionicons 
              name="arrow-back" 
              size={getIconSize('medium')} 
              color={cores.icone} 
            />
          </View>
          <Text style={styles.headerTitle}>Voltar</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.content}>
        {/* Card de Status do Plano */}
        {loadingPlan ? (
          <View style={styles.planCard}>
            <ActivityIndicator size="small" color={cores.tint} />
            <Text style={[styles.planLabel, { marginLeft: 12 }]}>
              Carregando plano...
            </Text>
          </View>
        ) : (
          <>
            <View style={styles.planCard}>
              <View style={styles.planInfo}>
                <Text style={styles.planLabel}>Plano Atual</Text>
                <Text style={styles.planName}>
                  {currentPlan === 'free' ? 'Gratuito' : 'Premium'}
                </Text>
              </View>
              <View style={styles.planBadge}>
                <MaterialCommunityIcons 
                  name={currentPlan === 'premium' ? "star" : "account"} 
                  size={16} 
                  color={currentPlan === 'premium' ? "#FFD700" : "#fff"} 
                />
                <Text style={styles.planBadgeText}>
                  {currentPlan === 'free' ? 'FREE' : 'PREMIUM'}
                </Text>
              </View>
            </View>

            {/* Botão de Upgrade (só aparece se for free) */}
            {currentPlan === 'free' && (
              <TouchableOpacity 
                style={styles.upgradeButton}
                onPress={handleUpgrade}
                accessibilityLabel="Fazer upgrade para plano premium"
              >
                <MaterialCommunityIcons name="star" size={20} color="#FFD700" />
                <Text style={styles.upgradeButtonText}>
                  Upgrade para Premium
                </Text>
              </TouchableOpacity>
            )}
          </>
        )}

        <View style={styles.inputContainer} accessibilityLabel="Nome">
          <Text style={styles.label}>Nome</Text>
          <TextInput
            style={styles.input}
            value={nome}
            onChangeText={setNome}
            placeholder="Digite seu nome"
            placeholderTextColor={temaAplicado === "dark" ? "#888" : "#999"}
          />
        </View>

        <View style={styles.inputContainer} accessibilityLabel="Email">
          <Text style={styles.label}>Email</Text>
          <TextInput
            style={styles.input}
            value={email}
            onChangeText={setEmail}
            placeholder="Digite seu email"
            placeholderTextColor={temaAplicado === "dark" ? "#888" : "#999"}
            keyboardType="email-address"
            autoCapitalize="none"
          />
        </View>

        <View style={styles.inputContainer} accessibilityLabel="Senha">
          <Text style={styles.label}>Senha</Text>
          <View style={styles.inputWrapper}>
            <TextInput
              style={[styles.input, styles.passwordInput]}
              value={senha}
              onChangeText={setSenha}
              placeholder="Digite sua senha"
              placeholderTextColor={temaAplicado === "dark" ? "#888" : "#999"}
              secureTextEntry={!showPassword}
            />
            <TouchableOpacity
              style={styles.eyeIcon}
              onPress={togglePasswordVisibility}
            >
              <Ionicons
                name={showPassword ? "eye-off" : "eye"}
                size={24}
                color={cores.icone}
              />
            </TouchableOpacity>
          </View>
        </View>

        <TouchableOpacity
          style={styles.updateButton}
          onPress={handleUpdateData}
        >
          <Text style={styles.updateButtonText}>Atualizar Dados</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.bottomTabsSpace} />
    </View>
  );
}