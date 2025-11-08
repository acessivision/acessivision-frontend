// Importa o seu serviço
import { IntentClassifierService } from './IntentClassifier';

// Define os mesmos casos de teste do seu Colab
const testCases = [
  { frase: "pode me mostrar como funciona o histórico?", esperado: "tutorial" },
  { frase: "sai da minha conta", esperado: "fazer_logout" },
  { frase: "me leve para o login", esperado: "ir_para_login" },
  { frase: "me explica como usar o aplicativo", esperado: "tutorial" },
  { frase: "qual o valor nessa nota", esperado: "tirar_foto" },
  { frase: "abre a página de menu", esperado: "abrir_menu" },
  { frase: "o que está escrito nessa bula", esperado: "tirar_foto" },
  { frase: "o que está escrito nessa caixa", esperado: "tirar_foto" },
  { frase: "abre minhas conversas", esperado: "ir_para_historico" },
  { frase: "quero ver as conversas salvas", esperado: "ir_para_historico" },
  { frase: "vai na camera", esperado: "abrir_camera" },
  { frase: "como uso as coisas nessa tela", esperado: "explicar_tela" },
  { frase: "entra na minha conta", esperado: "ir_para_login" },
  { frase: "me mostre o menu do aplicativo", esperado: "abrir_menu" },
  { frase: "me explica como funciona o aplicativo", esperado: "tutorial" },
  { frase: "coloca o tema noturno", esperado: "mudar_tema_escuro" },
  { frase: "quero remover minha conta", esperado: "excluir_conta" },
  { frase: "põe o tema claro", esperado: "mudar_tema_claro" },
  { frase: "qual o historico de conversas", esperado: "ir_para_historico" },
  { frase: "como posso ver o historico?", esperado: "ir_para_historico" },
  { frase: "o meu tralalá trala lelo tralalá", esperado: "fora_de_escopo" },
  { frase: "o meu tralalá tralalá leva o tralalá", esperado: "fora_de_escopo" },
  { frase: "o meu tralalá tralalá leva a outra lá", esperado: "fora_de_escopo" },
  { frase: "lanterna", esperado: "fora_de_escopo" },
  { frase: "o meu tralala", esperado: "fora_de_escopo" },
  { frase: "skibidi", esperado: "fora_de_escopo" },
  { frase: "tá doido", esperado: "fora_de_escopo" },
  { frase: "escuta", esperado: "fora_de_escopo" },
  { frase: "abre o spotify", esperado: "fora_de_escopo" },
  { frase: "qual é a cor dos seus olhos?", esperado: "tirar_foto" },
  { frase: "me leva até o histórico", esperado: "ir_para_historico" },
  { frase: "Qual é o Valor nessa moeda", esperado: "tirar_foto" },
  { frase: "quais as cores nesse mouse", esperado: "tirar_foto" },
  { frase: "qual o valor dessa moeda", esperado: "tirar_foto" },
  // Adicionando os casos de generalização que falharam/mudaram
  { frase: "me dá uma dica", esperado: "tutorial" },
  { frase: "como eu deleto o histórico?", esperado: "tutorial" },
  { frase: "qual o meu login?", esperado: "ir_para_login" },
  { frase: "me explica o tema escuro", esperado: "mudar_tema_escuro" },
  { frase: "ler o que está na tela", esperado: "tirar_foto" },
];

// <-- CORREÇÃO AQUI (1/2): Definir uma interface para o objeto de erro
interface ErrorReport {
  frase: string;
  esperado: string;
  previsto: string;
  certeza: number;
}

console.log("🧪 INICIANDO TESTE DE PREVISÃO EM JAVASCRIPT...");
console.log("=================================================");

let correct = 0;
const total = testCases.length;

// <-- CORREÇÃO AQUI (2/2): Aplicar a interface ao array
const errors: ErrorReport[] = [];

// Função principal de teste
async function runTests() {
  for (const test of testCases) {
    const { frase, esperado } = test;
    
    // Chama a sua função de predição
    const resultado = IntentClassifierService.predictWithConfidence(frase);
    
    const previsto = resultado.intent;
    const certeza = resultado.confidence;
    const isCorrect = previsto === esperado;
    
    const status = isCorrect ? "✅" : "❌";
    
    console.log(`${status} '${frase}'`);
    console.log(`   Esperado: ${esperado} | Previsto: ${previsto} (Certeza: ${(certeza * 100).toFixed(0)}%)`);
    console.log("---------------------------------");

    if (isCorrect) {
      correct++;
    } else {
      // Agora 'test', 'previsto', e 'certeza' batem com a interface ErrorReport
      errors.push({ ...test, previsto, certeza });
    }
  }

  // --- Relatório Final ---
  console.log("\n=================================================");
  console.log("🎯 RELATÓRIO FINAL DO TESTE EM JAVASCRIPT");
  console.log("=================================================");
  const acuracia = (correct / total) * 100;
  console.log(`🎯 Acurácia: ${acuracia.toFixed(2)}% (${correct}/${total})`);

  if (errors.length > 0) {
    console.log("\nRESUMO DOS ERROS:");
    for (const err of errors) { // O TypeScript agora sabe que 'err' é do tipo 'ErrorReport'
      console.log(`❌ '${err.frase}'`);
      console.log(`   Esperado: ${err.esperado} | Previsto: ${err.previsto} (Certeza: ${(err.certeza * 100).toFixed(0)}%)`);
    }
  } else {
    console.log("\n🎉 Fantástico! Todos os testes passaram!");
  }
}

// Executa os testes
runTests();