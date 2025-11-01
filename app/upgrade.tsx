// app/upgrade.tsx
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
  Image,
  Modal,
  Clipboard,
  StatusBar,
} from 'react-native';
import { useAuth } from '../components/AuthContext';
import { router } from 'expo-router';
import * as Speech from 'expo-speech';
import { useTheme } from '../components/ThemeContext';
import { MaterialCommunityIcons, Ionicons } from '@expo/vector-icons';

const API_URL = `http://${process.env.EXPO_PUBLIC_IP}:3000`;

interface Plan {
  id: string;
  nome: string;
  preco: number;
  recursos: string[];
  ativo: boolean;
}

interface BillingResponse {
  success: boolean;
  billing?: {
    id: string;
    status: string;
    url: string;
    pix: {
      qrCode: string | null;
      qrCodeText: string | null;
    };
  };
  message?: string;
}

export default function UpgradeScreen() {
  const { user, isLoading: authLoading } = useAuth();
  const { cores, temaAplicado, getIconSize, getFontSize } = useTheme();
  const [plans, setPlans] = useState<Plan[]>([]);
  const [currentPlan, setCurrentPlan] = useState<string>('free');
  const [loading, setLoading] = useState(true);
  const [processingPayment, setProcessingPayment] = useState(false);
  const [showPixModal, setShowPixModal] = useState(false);
  const [pixData, setPixData] = useState<{ qrCode: string; qrCodeText: string } | null>(null);
  const [billingId, setBillingId] = useState<string | null>(null);

  useEffect(() => {
    if (!authLoading) {
      if (!user) {
        Speech.speak('Você precisa estar logado para acessar esta página', {
          language: 'pt-BR',
          rate: 0.9
        });
        router.replace('/login');
      } else {
        loadPlans();
        loadCurrentPlan();
      }
    }
  }, [user, authLoading]);

  const loadPlans = async () => {
    try {
      const response = await fetch(`${API_URL}/plans`);
      const data = await response.json();
      
      if (data.success) {
        setPlans(data.plans);
      }
    } catch (error) {
      console.error('Erro ao carregar planos:', error);
      Alert.alert('Erro', 'Não foi possível carregar os planos');
    } finally {
      setLoading(false);
    }
  };

  const loadCurrentPlan = async () => {
    if (!user) return;

    try {
      const response = await fetch(`${API_URL}/user/${user.uid}/plan`);
      const data = await response.json();
      
      if (data.success) {
        setCurrentPlan(data.plano);
      }
    } catch (error) {
      console.error('Erro ao carregar plano atual:', error);
    }
  };

  const handleGoBack = () => {
    router.back();
  };

  const handleUpgrade = async (planId: string) => {
    if (!user) return;

    if (planId === 'free') {
      Alert.alert('Atenção', 'Você já está no plano gratuito');
      return;
    }

    if (currentPlan === 'premium') {
      Alert.alert('Atenção', 'Você já é um assinante Premium');
      return;
    }

    setProcessingPayment(true);

    try {
      const response = await fetch(`${API_URL}/billing/create`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          uid: user.uid,
          planId: planId
        })
      });

      const data: BillingResponse = await response.json();

      if (data.success && data.billing) {
        setBillingId(data.billing.id);
        
        if (data.billing.pix.qrCode && data.billing.pix.qrCodeText) {
          setPixData({
            qrCode: data.billing.pix.qrCode,
            qrCodeText: data.billing.pix.qrCodeText
          });
          setShowPixModal(true);
          
          Speech.speak('QR Code gerado com sucesso! Escaneie para pagar', {
            language: 'pt-BR',
            rate: 0.9
          });

          // Verificar status do pagamento a cada 5 segundos
          startPaymentStatusCheck(data.billing.id);
        } else {
          Alert.alert('Erro', 'Não foi possível gerar o QR Code PIX');
        }
      } else {
        Alert.alert('Erro', data.message || 'Erro ao processar upgrade');
      }
    } catch (error) {
      console.error('Erro ao processar upgrade:', error);
      Alert.alert('Erro', 'Não foi possível processar o upgrade');
    } finally {
      setProcessingPayment(false);
    }
  };

  const startPaymentStatusCheck = (billingId: string) => {
    const interval = setInterval(async () => {
      try {
        const response = await fetch(`${API_URL}/billing/${billingId}/status`);
        const data = await response.json();

        if (data.success && data.billing.status === 'paid') {
          clearInterval(interval);
          setShowPixModal(false);
          
          Speech.speak('Pagamento confirmado! Bem-vindo ao Premium!', {
            language: 'pt-BR',
            rate: 0.9
          });

          Alert.alert(
            'Sucesso! 🎉',
            'Seu pagamento foi confirmado! Agora você é Premium!',
            [
              {
                text: 'OK',
                onPress: () => {
                  loadCurrentPlan();
                  router.back();
                }
              }
            ]
          );
        }
      } catch (error) {
        console.error('Erro ao verificar status:', error);
      }
    }, 5000); // Verificar a cada 5 segundos

    // Parar após 10 minutos
    setTimeout(() => clearInterval(interval), 600000);
  };

  const copyPixCode = () => {
    if (pixData?.qrCodeText) {
      Clipboard.setString(pixData.qrCodeText);
      Alert.alert('Sucesso', 'Código PIX copiado para a área de transferência');
      Speech.speak('Código copiado', { language: 'pt-BR' });
    }
  };

  if (authLoading || loading) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: cores.fundo }]}>
        <ActivityIndicator size="large" color={cores.tint} />
        <Text style={[styles.loadingText, { color: cores.texto }]}>Carregando...</Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: cores.fundo }]}>
      <StatusBar
        backgroundColor={cores.fundo}
        barStyle={temaAplicado === 'dark' ? 'light-content' : 'dark-content'}
      />

      {/* Header com botão de voltar */}
      <View style={[styles.header, { backgroundColor: cores.fundo }]}>
        <TouchableOpacity 
          style={styles.backButton} 
          onPress={handleGoBack}
          accessibilityLabel="Voltar para tela anterior"
        >
          <Ionicons 
            name="arrow-back" 
            size={getIconSize('medium')} 
            color={cores.icone} 
          />
          <Text style={[styles.backButtonText, { color: cores.texto }]}>Voltar</Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.scrollView}>
        <View style={styles.content}>
          <Text style={[styles.title, { color: cores.texto }]}>Escolha seu Plano</Text>
          <Text style={[styles.subtitle, { color: temaAplicado === 'dark' ? '#aaa' : '#666' }]}>
            Plano atual: <Text style={[styles.currentPlanText, { color: cores.tint }]}>
              {currentPlan === 'free' ? 'Gratuito' : 'Premium'}
            </Text>
          </Text>

          <View style={styles.plansContainer}>
            {plans.map((plan) => (
              <View
                key={plan.id}
                style={[
                  styles.planCard,
                  { 
                    backgroundColor: cores.fundo,
                    borderColor: currentPlan === plan.id 
                      ? cores.tint 
                      : (temaAplicado === 'dark' ? '#444' : '#ddd')
                  },
                  currentPlan === plan.id && styles.planCardActive
                ]}
              >
                <View style={styles.planHeader}>
                  <Text style={[styles.planName, { color: cores.texto }]}>{plan.nome}</Text>
                  {currentPlan === plan.id && (
                    <View style={[styles.activeBadge, { backgroundColor: cores.tint }]}>
                      <Text style={styles.activeBadgeText}>Atual</Text>
                    </View>
                  )}
                </View>

                <View style={styles.priceContainer}>
                  <Text style={[styles.priceSymbol, { color: cores.texto }]}>R$</Text>
                  <Text style={[styles.priceValue, { color: cores.texto }]}>
                    {plan.preco.toFixed(2).replace('.', ',')}
                  </Text>
                  <Text style={[styles.pricePeriod, { color: temaAplicado === 'dark' ? '#aaa' : '#666' }]}>
                    /mês
                  </Text>
                </View>

                <View style={styles.featuresContainer}>
                  {plan.recursos.map((recurso, index) => (
                    <View key={index} style={styles.featureItem}>
                      <MaterialCommunityIcons
                        name="check-circle"
                        size={20}
                        color="#4CAF50"
                        style={styles.featureIcon}
                      />
                      <Text style={[styles.featureText, { color: cores.texto }]}>{recurso}</Text>
                    </View>
                  ))}
                </View>

                <TouchableOpacity
                  style={[
                    styles.upgradeButton,
                    { backgroundColor: plan.id === 'premium' ? '#FFD700' : cores.tint },
                    currentPlan === plan.id && styles.upgradeButtonDisabled,
                  ]}
                  onPress={() => handleUpgrade(plan.id)}
                  disabled={currentPlan === plan.id || processingPayment}
                  accessibilityLabel={`Botão para ${plan.id === 'free' ? 'selecionar plano gratuito' : 'assinar plano premium'}`}
                >
                  {processingPayment && plan.id === 'premium' ? (
                    <ActivityIndicator color="#000" />
                  ) : (
                    <Text style={[
                      styles.upgradeButtonText,
                      { color: plan.id === 'premium' ? '#000' : '#fff' }
                    ]}>
                      {currentPlan === plan.id
                        ? 'Plano Atual'
                        : plan.id === 'free'
                        ? 'Selecionar'
                        : 'Assinar Premium'}
                    </Text>
                  )}
                </TouchableOpacity>
              </View>
            ))}
          </View>
        </View>
      </ScrollView>

      {/* Modal do PIX */}
      <Modal
        visible={showPixModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowPixModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: cores.fundo }]}>
            <Text style={[styles.modalTitle, { color: cores.texto }]}>Pague com PIX</Text>
            
            {pixData?.qrCode && (
              <Image
                source={{ uri: pixData.qrCode }}
                style={styles.qrCode}
                resizeMode="contain"
              />
            )}

            <Text style={[styles.pixInstructions, { color: temaAplicado === 'dark' ? '#aaa' : '#666' }]}>
              Escaneie o QR Code acima ou copie o código abaixo:
            </Text>

            <TouchableOpacity
              style={[styles.copyButton, { backgroundColor: cores.tint }]}
              onPress={copyPixCode}
              accessibilityLabel="Copiar código PIX"
            >
              <MaterialCommunityIcons name="content-copy" size={20} color="#fff" />
              <Text style={styles.copyButtonText}>Copiar Código PIX</Text>
            </TouchableOpacity>

            <View style={[styles.pixCodeContainer, { backgroundColor: temaAplicado === 'dark' ? '#2a2a2a' : '#f5f5f5' }]}>
              <Text style={[styles.pixCode, { color: cores.texto }]} numberOfLines={2}>
                {pixData?.qrCodeText}
              </Text>
            </View>

            <TouchableOpacity
              style={styles.closeModalButton}
              onPress={() => setShowPixModal(false)}
              accessibilityLabel="Fechar modal de pagamento"
            >
              <Text style={[styles.closeModalButtonText, { color: cores.tint }]}>Fechar</Text>
            </TouchableOpacity>

            <Text style={[styles.paymentNote, { color: temaAplicado === 'dark' ? '#aaa' : '#666' }]}>
              ⏱️ Aguardando pagamento... Verificando automaticamente.
            </Text>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 16,
    paddingTop: 60,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.1)',
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  backButtonText: {
    marginLeft: 8,
    fontSize: 16,
    fontWeight: '600',
  },
  scrollView: {
    flex: 1,
  },
  content: {
    padding: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    marginBottom: 24,
  },
  currentPlanText: {
    fontWeight: 'bold',
  },
  plansContainer: {
    paddingBottom: 20,
  },
  planCard: {
    borderRadius: 12,
    padding: 20,
    marginBottom: 20,
    borderWidth: 2,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  planCardActive: {
    elevation: 4,
    shadowOpacity: 0.2,
  },
  planHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 15,
  },
  planName: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  activeBadge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  activeBadgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  priceContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 20,
  },
  priceSymbol: {
    fontSize: 20,
    fontWeight: 'bold',
    marginTop: 4,
  },
  priceValue: {
    fontSize: 48,
    fontWeight: 'bold',
  },
  pricePeriod: {
    fontSize: 16,
    marginTop: 20,
  },
  featuresContainer: {
    marginBottom: 20,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  featureIcon: {
    marginRight: 10,
  },
  featureText: {
    fontSize: 16,
    flex: 1,
  },
  upgradeButton: {
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  upgradeButtonDisabled: {
    opacity: 0.5,
  },
  upgradeButtonText: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    borderRadius: 12,
    padding: 20,
    width: '90%',
    maxWidth: 400,
    alignItems: 'center',
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 20,
  },
  qrCode: {
    width: 250,
    height: 250,
    marginBottom: 20,
  },
  pixInstructions: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 15,
  },
  copyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 8,
    marginBottom: 15,
    width: '100%',
    justifyContent: 'center',
  },
  copyButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
    marginLeft: 8,
  },
  pixCodeContainer: {
    padding: 12,
    borderRadius: 8,
    marginBottom: 20,
    width: '100%',
    borderWidth: 1,
    borderColor: '#ddd',
  },
  pixCode: {
    fontSize: 12,
    textAlign: 'center',
  },
  closeModalButton: {
    padding: 12,
    width: '100%',
  },
  closeModalButtonText: {
    fontSize: 16,
    textAlign: 'center',
    fontWeight: '600',
  },
  paymentNote: {
    fontSize: 14,
    textAlign: 'center',
    marginTop: 10,
  },
});