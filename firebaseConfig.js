// Import do Firebase Admin
import admin from "firebase-admin";
import { readFileSync } from "fs";

// Importa credenciais da service account
const serviceAccount = JSON.parse(
  readFileSync("./acessivision-firebase-adminsdk.json", "utf8")
);

// Inicializar Firebase Admin
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

export const db = admin.firestore();

console.log('🔥 CRIANDO ESTRUTURA COMPLETA DO ACESSIVISION');
console.log('=============================================\n');

// Função para gerar IDs únicos
function gerarId() {
  return admin.firestore().collection('temp').doc().id;
}

// Função para obter timestamp atual
function agora() {
  return admin.firestore.Timestamp.now();
}

async function criarEstrutura() {
  try {
    console.log('📝 Criando dados de exemplo...\n');

    // 1. CRIAR USUÁRIOS
    console.log('👤 Criando usuários...');
    
    const usuario1Id = gerarId();
    const usuario2Id = gerarId();
    
    await db.collection('usuarios').doc(usuario1Id).set({
      nome: 'João Silva',
      email: 'joao@email.com',
      dataEnvio: agora(),
      autenticarEmail: true,
      criarContaManual: false,
      atualizarPerfilDados: agora()
    });

    await db.collection('usuarios').doc(usuario2Id).set({
      nome: 'Maria Santos',
      email: 'maria@email.com', 
      dataEnvio: agora(),
      autenticarEmail: true,
      criarContaManual: true,
      atualizarPerfilDados: agora()
    });

    console.log('✅ Usuários criados');

    // 2. CRIAR CONVERSAS
    console.log('💬 Criando conversas...');
    
    const conversa1Id = gerarId();
    const conversa2Id = gerarId();
    
    await db.collection('conversas').doc(conversa1Id).set({
      titulo: 'Primeira conversa',
      dataCriacao: agora(),
      usuarioId: usuario1Id,
      status: 'ativa',
      iniciarConversa: agora(),
      encerrarConversa: null,
      registrarImagem: true
    });

    await db.collection('conversas').doc(conversa2Id).set({
      titulo: 'Segunda conversa',
      dataCriacao: agora(), 
      usuarioId: usuario2Id,
      status: 'finalizada',
      iniciarConversa: agora(),
      encerrarConversa: agora(),
      registrarImagem: false
    });

    console.log('✅ Conversas criadas');

    // 3. CRIAR FOTOS
    console.log('📸 Criando fotos...');
    
    const foto1Id = gerarId();
    const foto2Id = gerarId();
    
    await db.collection('fotos').doc(foto1Id).set({
      uri: 'https://storage.firebase.com/foto1.jpg',
      dataEnvio: agora(),
      conversaId: conversa1Id,
      largura: 1920,
      altura: 1080,
      tamanho: 2048000, // bytes
      salvarImagem: true,
      exibirImagem: true
    });

    await db.collection('fotos').doc(foto2Id).set({
      uri: 'https://storage.firebase.com/foto2.jpg',
      dataEnvio: agora(),
      conversaId: conversa2Id,
      largura: 1280,
      altura: 720,
      tamanho: 1024000,
      salvarImagem: false,
      exibirImagem: true
    });

    console.log('✅ Fotos criadas');

    // 4. CRIAR ÁUDIOS
    console.log('🔊 Criando áudios...');
    
    const audio1Id = gerarId();
    const audio2Id = gerarId();
    
    await db.collection('audios').doc(audio1Id).set({
      uri: 'https://storage.firebase.com/audio1.mp3',
      descricaoId: 'Descrição da primeira imagem processada',
      duracao: 15.5, // segundos
      tamanho: 512000, // bytes
      formato: 'mp3',
      gerarAudio: agora(),
      reproduzirAudio: null
    });

    await db.collection('audios').doc(audio2Id).set({
      uri: 'https://storage.firebase.com/audio2.mp3', 
      descricaoId: 'Descrição da segunda imagem processada',
      duracao: 22.3,
      tamanho: 768000,
      formato: 'mp3',
      gerarAudio: agora(),
      reproduzirAudio: agora()
    });

    console.log('✅ Áudios criados');

    // 5. CRIAR MENSAGENS
    console.log('💌 Criando mensagens...');
    
    const mensagem1Id = gerarId();
    const mensagem2Id = gerarId();
    const mensagem3Id = gerarId();
    
    await db.collection('mensagens').doc(mensagem1Id).set({
      audioId: audio1Id,
      imagemId: foto1Id,
      tipo: 'image_to_audio',
      conversaId: conversa1Id,
      enviarMensagem: agora()
    });

    await db.collection('mensagens').doc(mensagem2Id).set({
      audioId: audio2Id,
      imagemId: foto2Id,
      tipo: 'image_to_audio',
      conversaId: conversa2Id,
      enviarMensagem: agora()
    });

    await db.collection('mensagens').doc(mensagem3Id).set({
      audioId: null,
      imagemId: null,
      tipo: 'text',
      conversaId: conversa1Id,
      texto: 'Mensagem de texto simples',
      enviarMensagem: agora()
    });

    console.log('✅ Mensagens criadas');

    // 6. CRIAR HISTÓRICO
    console.log('📚 Criando histórico...');
    
    const historico1Id = gerarId();
    const historico2Id = gerarId();
    
    await db.collection('historico').doc(historico1Id).set({
      usuarioId: usuario1Id,
      dataConsulta: agora(),
      evolucaoHistorico: agora(),
      listarHistorico: ['conversa1', 'conversa3', 'conversa5']
    });

    await db.collection('historico').doc(historico2Id).set({
      usuarioId: usuario2Id,
      dataConsulta: agora(),
      evolucaoHistorico: agora(), 
      listarHistorico: ['conversa2', 'conversa4']
    });

    console.log('✅ Histórico criado');

    // 7. VERIFICAR CRIAÇÃO
    console.log('\n🔍 Verificando estrutura criada...');
    
    const colecoes = ['usuarios', 'conversas', 'fotos', 'audios', 'mensagens', 'historico'];
    
    for (const colecao of colecoes) {
      const snapshot = await db.collection(colecao).get();
      console.log(`   📂 ${colecao}: ${snapshot.size} documentos`);
    }

    console.log('\n✅ ESTRUTURA COMPLETA CRIADA COM SUCESSO!');
    
    // 8. MOSTRAR RELACIONAMENTOS
    console.log('\n🔗 RELACIONAMENTOS CRIADOS:');
    console.log(`   👤 Usuário 1 (${usuario1Id}) → Conversa 1 (${conversa1Id})`);
    console.log(`   👤 Usuário 2 (${usuario2Id}) → Conversa 2 (${conversa2Id})`);
    console.log(`   📸 Foto 1 → Conversa 1 → Áudio 1 → Mensagem 1`);
    console.log(`   📸 Foto 2 → Conversa 2 → Áudio 2 → Mensagem 2`);
    console.log(`   📚 Histórico vinculado aos usuários`);

  } catch (error) {
    console.error('❌ Erro ao criar estrutura:', error);
  }
}

// Função para listar tudo após criar
async function listarTudo() {
  console.log('\n📋 LISTANDO TODOS OS DADOS CRIADOS:');
  console.log('='.repeat(50));
  
  const colecoes = ['usuarios', 'conversas', 'fotos', 'audios', 'mensagens', 'historico'];
  
  for (const nomeColecao of colecoes) {
    console.log(`\n📂 COLEÇÃO: ${nomeColecao.toUpperCase()}`);
    console.log('-'.repeat(30));
    
    const snapshot = await db.collection(nomeColecao).get();
    
    snapshot.forEach((doc, index) => {
      console.log(`\n   📄 Documento ${index + 1}: ${doc.id}`);
      console.log(`   📝 Dados:`, JSON.stringify(doc.data(), null, 6));
    });
  }
}

// Executar criação e listagem
async function executar() {
  await criarEstrutura();
  await listarTudo();
  
  console.log('\n🎉 PROCESSO COMPLETO FINALIZADO!');
  console.log('Agora você tem uma estrutura completa do AcessiVision no Firebase.');
}

executar().catch(console.error);

/*
MELHORIAS IMPLEMENTADAS NO MODELO:

1. ✅ Adicionei timestamps em todas as entidades
2. ✅ Campos de tamanho e dimensões para mídia
3. ✅ Status para conversas (ativa/finalizada)
4. ✅ Tipos de mensagem (image_to_audio, text)
5. ✅ Duração para áudios
6. ✅ Relacionamentos bem definidos
7. ✅ Dados de exemplo realistas
8. ✅ IDs únicos gerados automaticamente

ESTRUTURA FINAL:
- 👤 usuarios (dados pessoais e autenticação)
- 💬 conversas (sessões de interação)
- 📸 fotos (imagens enviadas)
- 🔊 audios (descrições geradas)
- 💌 mensagens (relaciona foto+audio+conversa)
- 📚 historico (registro de atividades)

*/