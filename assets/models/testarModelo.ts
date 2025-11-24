import { IntentClassifierService } from './IntentClassifier';

const THRESHOLD = 0.35; // Seu limiar de produção

const testCasesRealistas = [
  // === NOVAS VARIAÇÕES E FRASES CURTAS ===
  { frase: "ler", esperado: "tirar_foto" }, // Muito curto, desafio de confiança
  { frase: "vê isso", esperado: "tirar_foto" },
  { frase: "o que tá escrito", esperado: "tirar_foto" },
  { frase: "descrição", esperado: "tirar_foto" },
  { frase: "ajuda", esperado: "tutorial" },
  { frase: "socorro", esperado: "tutorial" }, // Sinônimo emocional
  { frase: "como faz?", esperado: "tutorial" },
  { frase: "tá onde?", esperado: "explicar_tela" }, // Coloquial para localização
  { frase: "botão estranho", esperado: "explicar_tela" },
  { frase: "quero sair", esperado: "fazer_logout" }, // Pode confundir com fechar app
  { frase: "trocar conta", esperado: "ir_para_login" },
  { frase: "logar", esperado: "ir_para_login" },
  { frase: "fotos antigas", esperado: "ir_para_historico" },
  { frase: "voltar pra câmera", esperado: "abrir_camera" },
  { frase: "cancela", esperado: "abrir_camera" }, // Contexto de voltar ao inicio
  
  // === CENÁRIO 1: VISÃO (Supermercado/Dia a dia) ===
  { frase: "Lê o que tá escrito nessa caixa", esperado: "tirar_foto" },
  { frase: "Que remédio é esse na minha mão?", esperado: "tirar_foto" },
  { frase: "Qual o valor dessa nota?", esperado: "tirar_foto" },
  { frase: "Vê se esse leite tá vencido", esperado: "tirar_foto" },
  { frase: "O que é isso na minha frente?", esperado: "tirar_foto" },
  { frase: "Lê esse rótulo pra mim", esperado: "tirar_foto" },
  { frase: "lê pra mim", esperado: "tirar_foto" },
  { frase: "me diz o que é isso", esperado: "tirar_foto" },

  // === CENÁRIO 2: NAVEGAÇÃO ===
  { frase: "Quero ver meu histórico", esperado: "ir_para_historico" },
  { frase: "Voltar para o início", esperado: "abrir_camera" },
  { frase: "Abrir o menu", esperado: "abrir_menu" }, // Se não tiver menu, pode dar erro
  { frase: "Vai para a câmera", esperado: "abrir_camera" },
  { frase: "Entrar na minha conta", esperado: "ir_para_login" },
  { frase: "minhas conversas", esperado: "ir_para_historico" },

  // === CENÁRIO 3: DÚVIDA NA INTERFACE ===
  { frase: "O que esse botão faz?", esperado: "explicar_tela" },
  { frase: "Onde eu tô agora?", esperado: "explicar_tela" },
  { frase: "Pra que serve esse ícone?", esperado: "explicar_tela" },
  { frase: "lê a tela", esperado: "explicar_tela" },

  // === CENÁRIO 4: AJUDA ===
  { frase: "Como que usa o aplicativo?", esperado: "tutorial" },
  { frase: "Quais são os comandos?", esperado: "tutorial" },
  { frase: "Me ensina a ler um texto", esperado: "tutorial" },
  { frase: "não entendi", esperado: "tutorial" },

  // === CENÁRIO 5: CONFIG E SISTEMA ===
  { frase: "Sair da minha conta", esperado: "fazer_logout" },
  { frase: "Quero deslogar", esperado: "fazer_logout" },
  { frase: "Muda para o tema escuro", esperado: "mudar_tema_escuro" },
  { frase: "Ativar modo noturno", esperado: "mudar_tema_escuro" },
  { frase: "Quero apagar minha conta pra sempre", esperado: "excluir_conta" },
  { frase: "mudar a cor do app", esperado: "mudar_tema_escuro" }, // Ambiguidade

  // === CENÁRIO 6: RUÍDO / FORA DE ESCOPO ===
  { frase: "Que horas são?", esperado: "fora_de_escopo" },
  { frase: "Abrir o WhatsApp", esperado: "fora_de_escopo" },
  { frase: "Ligar a lanterna", esperado: "fora_de_escopo" },
  { frase: "Obrigado", esperado: "fora_de_escopo" },
  { frase: "quanto é dois mais dois", esperado: "fora_de_escopo" },
  { frase: "receita de bolo", esperado: "fora_de_escopo" },
];

async function rodarSimulacaoProducao() {
  console.log(`🏭 SIMULAÇÃO DE PRODUÇÃO (THRESHOLD: ${THRESHOLD})`);
  console.log("=================================================");

  let stats = {
    sucesso: 0,
    erroCritico: 0,
    falsoNegativo: 0,
    bloqueioCorreto: 0,
    total: testCasesRealistas.length
  };

  for (const test of testCasesRealistas) {
    const result = IntentClassifierService.predictWithConfidence(test.frase);
    const confidencePct = (result.confidence * 100).toFixed(1);
    const isCorrectIntent = result.intent === test.esperado;
    const isAboveThreshold = result.confidence >= THRESHOLD;

    let statusIcon = "";
    let logMsg = "";

    if (isAboveThreshold) {
      if (isCorrectIntent) {
        statusIcon = "✅"; // Passou e Acertou
        stats.sucesso++;
        logMsg = `Sucesso (${result.intent})`;
      } else {
        statusIcon = "💀"; // Passou e Errou (PERIGO)
        stats.erroCritico++;
        logMsg = `ALUCINAÇÃO! Entendeu '${result.intent}' mas era '${test.esperado}'`;
      }
    } else {
      if (isCorrectIntent) {
        statusIcon = "🤐"; // Era certo, mas confiança baixa (Frustração)
        stats.falsoNegativo++;
        logMsg = `Ignorado indevidamente (Era '${test.esperado}')`;
      } else {
        statusIcon = "🛡️"; // Era errado ou ruído, e confiança baixa (Segurança)
        stats.bloqueioCorreto++;
        logMsg = `Bloqueado corretamente (Era '${test.esperado}' vs '${result.intent}')`;
      }
    }

    console.log(`${statusIcon} [${confidencePct}%] '${test.frase}' -> ${logMsg}`);
  }

  console.log("\n📊 RESUMO DO COMPORTAMENTO EM PRODUÇÃO");
  console.log("---------------------------------------");
  console.log(`✅ Ações Corretas: ${stats.sucesso} (${((stats.sucesso/stats.total)*100).toFixed(1)}%)`);
  console.log(`💀 Erros Críticos (App faz besteira): ${stats.erroCritico} (${((stats.erroCritico/stats.total)*100).toFixed(1)}%)`);
  console.log(`🤐 Comandos Ignorados (Usuário repete): ${stats.falsoNegativo} (${((stats.falsoNegativo/stats.total)*100).toFixed(1)}%)`);
  console.log(`🛡️ Ruído Filtrado: ${stats.bloqueioCorreto} (${((stats.bloqueioCorreto/stats.total)*100).toFixed(1)}%)`);
  
  console.log("\n📢 VEREDITO:");
  if (stats.erroCritico > 0) {
    console.log("⚠️ PERIGO: O modelo está confiante demais em coisas erradas. Aumente o threshold ou treine mais.");
  } else if (stats.falsoNegativo > stats.sucesso * 0.2) {
    console.log("⚠️ FRUSTRAÇÃO: O modelo está ignorando muitos comandos válidos. Diminua o threshold ou melhore o treino.");
  } else {
    console.log("🚀 EQUILIBRADO: O modelo parece seguro e responsivo.");
  }
}

rodarSimulacaoProducao();