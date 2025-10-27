// Import do Firebase Admin e FileSystem
import admin from "firebase-admin";
import { readFileSync } from "fs";
import { FieldValue } from "firebase-admin/firestore"; // Importe FieldValue

// Importa credenciais da service account (mantenha seu caminho)
const serviceAccount = JSON.parse(
  readFileSync("./acessivision-firebase-adminsdk.json", "utf8")
);

// Inicializar Firebase Admin
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

export const db = admin.firestore();

console.log('🔥 CRIANDO ESTRUTURA CORRETA DO ACESSIVISION (COM SUBCOLEÇÕES)');
console.log('==========================================================\n');

// Função para gerar IDs únicos (OK)
function gerarId() {
  return db.collection('temp').doc().id;
}

// Função para obter timestamp atual (OK)
function agora() {
  return admin.firestore.Timestamp.now();
}

// Função principal para criar a estrutura
async function criarEstrutura() {
  try {
    console.log('📝 Criando dados de exemplo...\n');

    // ==========================================
    // 1. CRIAR USUÁRIOS
    // ==========================================
    console.log('👤 Criando usuários...');
    const usuario1Id = gerarId(); // Guardar ID para referência
    const usuario2Id = gerarId(); // Guardar ID para referência

    // Usuário 1 (sem 'historico' inicial)
    await db.collection('usuarios').doc(usuario1Id).set({
      nome: 'João Silva',
      email: 'joao@email.com',
      // Adicione outros campos se necessário (como data de criação)
      historico: [] // Começa com array vazio
    });

    // Usuário 2 (sem 'historico' inicial)
    await db.collection('usuarios').doc(usuario2Id).set({
      nome: 'Maria Santos',
      email: 'maria@email.com',
      historico: [] // Começa com array vazio
    });
    console.log(`✅ Usuários criados: ${usuario1Id}, ${usuario2Id}`);

    // ==========================================
    // 2. CRIAR CONVERSAS
    // ==========================================
    console.log('💬 Criando conversas...');
    const conversa1Id = gerarId(); // Guardar ID
    const conversa2Id = gerarId(); // Guardar ID
    const conversa3Id = gerarId(); // Mais uma para o João

    const dataAtual = agora(); // Usar o mesmo timestamp para criação/alteração inicial

    // Conversa 1 (do João)
    await db.collection('conversas').doc(conversa1Id).set({
      titulo: 'Compras no mercado',
      ownerUid: usuario1Id, // Link para o usuário dono
      dataCriacao: dataAtual,
      dataAlteracao: dataAtual // Inicialmente igual à criação
    });

    // Conversa 2 (da Maria)
    await db.collection('conversas').doc(conversa2Id).set({
      titulo: 'Foto do cachorro',
      ownerUid: usuario2Id,
      dataCriacao: dataAtual,
      dataAlteracao: dataAtual
    });

    // Conversa 3 (do João)
    await db.collection('conversas').doc(conversa3Id).set({
        titulo: 'Nota fiscal restaurante',
        ownerUid: usuario1Id,
        dataCriacao: dataAtual,
        dataAlteracao: dataAtual
      });

    console.log(`✅ Conversas criadas: ${conversa1Id}, ${conversa2Id}, ${conversa3Id}`);

    // ========================================================
    // 3. CRIAR MENSAGENS (DENTRO DAS SUBCOLEÇÕES)
    // ========================================================
    console.log('💌 Criando mensagens nas subcoleções...');

    // Mensagens para Conversa 1 (João)
    const mensagensConv1Ref = db.collection('conversas').doc(conversa1Id).collection('mensagens');
    await mensagensConv1Ref.add({
      sender: 'user',
      text: 'O que está escrito nesta lista de compras?',
      // Simule uma URL do Storage (substitua <SEU_BUCKET> pelo nome real do seu bucket)
      imageUri: 'https://firebasestorage.googleapis.com/v0/b/<SEU_BUCKET>.appspot.com/o/placeholder%2Flista_compras.jpg?alt=media',
      timestamp: agora()
    });
    await mensagensConv1Ref.add({
      sender: 'api', // Use 'api' ou 'bot' consistentemente
      text: 'A lista contém: Leite, Pão, Ovos e Manteiga.',
      imageUri: null,
      timestamp: agora()
    });

    // Mensagens para Conversa 2 (Maria)
    const mensagensConv2Ref = db.collection('conversas').doc(conversa2Id).collection('mensagens');
    await mensagensConv2Ref.add({
      sender: 'user',
      text: 'Que raça é esse cachorro?',
      imageUri: 'https://firebasestorage.googleapis.com/v0/b/<SEU_BUCKET>.appspot.com/o/placeholder%2Fcachorro.jpg?alt=media',
      timestamp: agora()
    });
    await mensagensConv2Ref.add({
      sender: 'api',
      text: 'Parece ser um Golden Retriever filhote.',
      imageUri: null,
      timestamp: agora()
    });
     await mensagensConv2Ref.add({ // Mais uma mensagem na conversa 2
      sender: 'user',
      text: 'Ele é fofo!',
      imageUri: null, // Mensagem só de texto
      timestamp: agora()
    });


    // Mensagens para Conversa 3 (João) - Apenas Texto
     const mensagensConv3Ref = db.collection('conversas').doc(conversa3Id).collection('mensagens');
     await mensagensConv3Ref.add({
       sender: 'user',
       text: 'Qual o valor total da nota?',
       imageUri: 'https://firebasestorage.googleapis.com/v0/b/<SEU_BUCKET>.appspot.com/o/placeholder%2Fnota_fiscal.jpg?alt=media',
       timestamp: agora()
     });
     await mensagensConv3Ref.add({
       sender: 'api',
       text: 'O valor total é R$ 55,80.',
       imageUri: null,
       timestamp: agora()
     });


    console.log('✅ Mensagens criadas nas subcoleções');

    // ========================================================
    // 4. ATUALIZAR 'historico' NOS USUÁRIOS
    // ========================================================
    console.log("🔗 Atualizando 'historico' dos usuários...");
    
    // Adiciona conversas ao histórico do João
    await db.collection('usuarios').doc(usuario1Id).update({
        historico: FieldValue.arrayUnion(conversa1Id, conversa3Id)
    });

    // Adiciona conversa ao histórico da Maria
    await db.collection('usuarios').doc(usuario2Id).update({
        historico: FieldValue.arrayUnion(conversa2Id)
    });
    console.log("✅ 'historico' dos usuários atualizado.");


    // ==========================================
    // 5. REMOVER COLEÇÕES ANTIGAS (NÃO MAIS USADAS)
    // ==========================================
    // FOTOS, AUDIOS, MENSAGENS (raiz), HISTORICO (raiz) não são mais criadas.

    // ==========================================
    // 6. VERIFICAR CRIAÇÃO
    // ==========================================
    console.log('\n🔍 Verificando estrutura criada...');
    const colecoesPrincipais = ['usuarios', 'conversas'];
    for (const colecao of colecoesPrincipais) {
      const snapshot = await db.collection(colecao).get();
      console.log(`   📂 ${colecao}: ${snapshot.size} documentos`);
    }

    // Verificar subcoleções (exemplo para a primeira conversa)
    const msgsConv1Snapshot = await db.collection('conversas').doc(conversa1Id).collection('mensagens').get();
    console.log(`      Subcoleção 'mensagens' em ${conversa1Id}: ${msgsConv1Snapshot.size} documentos`);


    console.log('\n✅ ESTRUTURA CORRETA CRIADA COM SUCESSO!');

    // ==========================================
    // 7. MOSTRAR RELACIONAMENTOS
    // ==========================================
    console.log('\n🔗 RELACIONAMENTOS CRIADOS:');
    console.log(`   👤 Usuário ${usuario1Id} possui conversas no array 'historico'`);
    console.log(`   👤 Usuário ${usuario2Id} possui conversas no array 'historico'`);
    console.log(`   💬 Conversa ${conversa1Id} (owner: ${usuario1Id})`);
    console.log(`      -> 💌 Subcoleção 'mensagens' com ${msgsConv1Snapshot.size} mensagens`);
    console.log(`   💬 Conversa ${conversa2Id} (owner: ${usuario2Id}) -> Subcoleção 'mensagens'`);
    console.log(`   💬 Conversa ${conversa3Id} (owner: ${usuario1Id}) -> Subcoleção 'mensagens'`);

  } catch (error) {
    console.error('❌ Erro ao criar estrutura:', error);
  }
}

// Função para listar tudo (MODIFICADA para incluir subcoleções)
async function listarTudo() {
  console.log('\n📋 LISTANDO TODOS OS DADOS CRIADOS:');
  console.log('='.repeat(50));

  const colecoesPrincipais = ['usuarios', 'conversas'];

  for (const nomeColecao of colecoesPrincipais) {
    console.log(`\n📂 COLEÇÃO: ${nomeColecao.toUpperCase()}`);
    console.log('-'.repeat(30));

    const snapshot = await db.collection(nomeColecao).get();

    for (const doc of snapshot.docs) { // Use 'for...of' para async/await
      console.log(`\n   📄 Documento: ${doc.id}`);
      console.log(`   📝 Dados:`, JSON.stringify(doc.data(), null, 2)); // Ajustei indentação

      // Se for uma conversa, lista as mensagens da subcoleção
      if (nomeColecao === 'conversas') {
        console.log(`      💌 Subcoleção: mensagens`);
        const mensagensSnapshot = await db.collection(nomeColecao).doc(doc.id).collection('mensagens').orderBy('timestamp').get();
        if (mensagensSnapshot.empty) {
            console.log(`         (vazia)`);
        } else {
            mensagensSnapshot.forEach((msgDoc, index) => {
                console.log(`         📄 Mensagem ${index + 1}: ${msgDoc.id}`);
                console.log(`         📝 Dados:`, JSON.stringify(msgDoc.data(), null, 4)); // Mais indentação
            });
        }
      }
    }
  }
}

// Executar criação e listagem
async function executar() {
  await criarEstrutura();
  await listarTudo();

  console.log('\n🎉 PROCESSO COMPLETO FINALIZADO!');
  console.log('Estrutura correta do AcessiVision criada/verificada no Firebase.');
}

executar().catch(console.error);

/*
ESTRUTURA IMPLEMENTADA:
- 👤 usuarios/{userId}
  - historico: [conversaId1, conversaId2, ...] (Array de Strings)
- 💬 conversas/{conversaId}
  - ownerUid: string (userId do dono)
  - titulo: string
  - dataCriacao: timestamp
  - dataAlteracao: timestamp
  - 💌 mensagens/{messageId} (Subcoleção)
    - sender: 'user' | 'api' (ou 'bot')
    - text: string | null
    - imageUri: string (URL do Storage) | null
    - timestamp: timestamp
*/