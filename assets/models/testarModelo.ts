import { IntentClassifierService } from './IntentClassifier';

const testCasesRealistas = [
  // === CENÁRIO 1: O USUÁRIO NO SUPERMERCADO/FARMÁCIA (Visão) ===
  { frase: "Lê o que tá escrito nessa caixa", esperado: "tirar_foto" },
  { frase: "Que remédio é esse na minha mão?", esperado: "tirar_foto" },
  { frase: "Qual o valor dessa nota?", esperado: "tirar_foto" },
  { frase: "Vê se esse leite tá vencido", esperado: "tirar_foto" }, // "Vê se..." implica ler validade
  { frase: "O que é isso na minha frente?", esperado: "tirar_foto" },
  { frase: "Lê esse rótulo pra mim", esperado: "tirar_foto" },

  // === CENÁRIO 2: NAVEGAÇÃO BÁSICA (Onde eu vou?) ===
  { frase: "Quero ver meu histórico", esperado: "ir_para_historico" },
  { frase: "Voltar para o início", esperado: "abrir_camera" },
  { frase: "Abrir o menu", esperado: "abrir_menu" },
  { frase: "Quero ver o que eu já li", esperado: "ir_para_historico" },
  { frase: "Vai para a câmera", esperado: "abrir_camera" },
  { frase: "Entrar na minha conta", esperado: "ir_para_login" },

  // === CENÁRIO 3: DÚVIDA NA INTERFACE (O que é isso na tela?) ===
  { frase: "O que esse botão faz?", esperado: "explicar_tela" },
  { frase: "Lê essa mensagem de erro", esperado: "explicar_tela" },
  { frase: "Onde eu tô agora?", esperado: "explicar_tela" },
  { frase: "Pra que serve esse ícone?", esperado: "explicar_tela" },
  { frase: "Lê o que tá escrito na tela", esperado: "explicar_tela" },

  // === CENÁRIO 4: PEDINDO AJUDA GERAL (Não sei usar) ===
  { frase: "Como que usa o aplicativo?", esperado: "tutorial" },
  { frase: "Me ajuda, não sei o que fazer", esperado: "tutorial" },
  { frase: "Quais são os comandos?", esperado: "tutorial" },
  { frase: "Me ensina a ler um texto", esperado: "tutorial" },

  // === CENÁRIO 5: CONFIGURAÇÕES E CONTA ===
  { frase: "Sair da minha conta", esperado: "fazer_logout" },
  { frase: "Quero deslogar", esperado: "fazer_logout" },
  { frase: "Muda para o tema escuro", esperado: "mudar_tema_escuro" },
  { frase: "A tela tá muito clara", esperado: "mudar_tema_claro" }, // Ops, aqui o usuário reclama da claridade -> quer escuro? Ou vice versa?
  // Nota: "Tela muito clara" geralmente implica querer escuro, mas seu dataset pode ter aprendido como gatilho de tema claro.
  // Vamos testar o comando direto:
  { frase: "Ativar modo noturno", esperado: "mudar_tema_escuro" },
  { frase: "Quero apagar minha conta pra sempre", esperado: "excluir_conta" },

  // === CENÁRIO 6: RUÍDO COMUM (Coisas que falam pro celular) ===
  { frase: "Que horas são?", esperado: "fora_de_escopo" },
  { frase: "Abrir o WhatsApp", esperado: "fora_de_escopo" },
  { frase: "Ligar a lanterna", esperado: "fora_de_escopo" },
  { frase: "Obrigado", esperado: "fora_de_escopo" },
  { frase: "Tirar print da tela", esperado: "fora_de_escopo" }, // "Tirar" perigoso, mas contexto de sistema nativo

  { frase: "Me mostra o tutorial do Histórico", esperado: "explicar_tela" },
  { frase: "Quais as cores dessa camisa", esperado: "tirar_foto"},
  { frase: "o que está escrito aqui", esperado: "tirar_foto"},
  { frase: "o que é isso", esperado: "tirar_foto"},
  { frase: "o que é isso na minha frente", esperado: "tirar_foto"},
  { frase: "Descreva o ambiente", esperado: "tirar_foto"},

  { frase: "quantos talheres tem na mesa", esperado: "tirar_foto"},


  { frase: "conte quantas moedas eu tenho", esperado: "tirar_foto"},
  { frase: "quanto é dois mais dois", esperado: "fora_de_escopo"},
];

async function rodarTesteRealista() {
  console.log("🛒 INICIANDO TESTE DE USO REAL (PRODUÇÃO)");
  console.log("=================================================");

  let acertos = 0;
  const total = testCasesRealistas.length;
  
  for (const test of testCasesRealistas) {
    const result = IntentClassifierService.predictWithConfidence(test.frase);
    const isCorrect = result.intent === test.esperado;
    
    if (isCorrect) {
      acertos++;
    } else {
      console.log(`❌ '${test.frase}'`);
      console.log(`   Esperado: ${test.esperado}`);
      console.log(`   Recebido: ${result.intent} (Confiança: ${(result.confidence * 100).toFixed(1)}%)`);
      console.log("-------------------------------------------------");
    }
  }

  const taxaAcerto = (acertos / total) * 100;

  console.log("\n📊 RESULTADO FINAL");
  console.log(`🎯 Acurácia: ${taxaAcerto.toFixed(2)}% (${acertos}/${total})`);
  
  if (taxaAcerto > 90) {
    console.log("🚀 O App está pronto para lançamento!");
  } else {
    console.log("⚠️ Atenção aos erros acima.");
  }
}

rodarTesteRealista();