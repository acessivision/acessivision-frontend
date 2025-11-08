import modelAltaRaw from './model_alta_acuracia.json';

const model = modelAltaRaw as unknown as ModelData;

// MUDANÇA (1/4): Criar um Set com as *exatas* stopwords do Python
// Um Set (conjunto) é muito mais rápido para lookups do que um Array.
const CUSTOM_STOPWORDS = new Set([
    // Artigos e preposições
    "a", "o", "as", "os", "um", "uma", "uns", "umas", 
    "de", "do", "da", "dos", "das", "em", "no", "na", "nos", "nas",
    "por", "para", "pra", "pro", "com", "sem", "sob", "sobre",
    
    // Pronomes
    "eu", "tu", "ele", "ela", "nos", "vos", "eles", "elas",
    "me", "te", "se", "lhe", "nos", "vos", "lhes",
    "meu", "minha", "meus", "minhas", "teu", "tua", "teus", "tuas", 
    "seu", "sua", "seus", "suas", "nosso", "nossa", "nossos", "nossas",
    
    // Conjunções e advérbios comuns
    "que", "qual", "quando", "como", "onde", "porque", "pois",
    "ate", "mas", "ou", "e", "ja", "nem", "mais", "muito", "so",
    
    // Demonstrativos
    "esse", "essa", "isso", "este", "isto", "aquele", "aquilo",
    "nessa", "nesse", "nisto", "desse", "dessa", "disso",
    
    // Verbos de estado (geralmente ruído)
    "ser", "foi", "estou", "esta", "estao",
    
    // Palavras de "lixo" que sobraram
    "favor", "por"
]);


// === Interfaces (sem alteração) ===
interface VectorizerData {
  vocabulary: { [key: string]: number };
  idf: number[];
  lowercase: boolean;
  strip_accents: 'ascii' | 'unicode' | null;
  sublinear_tf?: boolean;
  ngram_range: [number, number];
}

interface ClassifierData {
  coefficients?: number[][];
  intercept?: number[];
}

interface ModelData {
  model_type: string;
  classes: string[];
  vectorizer: VectorizerData;
  classifier: ClassifierData;
}

interface PredictionResult {
  intent: string;
  confidence: number;
  notUnderstood: boolean;
}

// === Constantes (sem alteração) ===
const classes = model.classes;
const vocabSize = Object.keys(model.vectorizer.vocabulary).length;
const LOW_CONFIDENCE_THRESHOLD = 0.18;

// === Pré-processamento (sem alteração) ===
function preprocessText(text: string): string {
  let processed = text;
  
  if (model.vectorizer.lowercase) {
    processed = processed.toLowerCase();
  }
  if (model.vectorizer.strip_accents === 'unicode') {
    processed = processed.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  } else if (model.vectorizer.strip_accents === 'ascii') {
    processed = processed.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  }
  
  return processed;
}

// === TF-IDF (sem alteração) ===
// (A 'calculateTfidf' não muda, pois ela recebe os tokens JÁ filtrados)
function calculateTfidf(tokens: string[], vectorizer: VectorizerData): number[] {
  const [minN, maxN] = vectorizer.ngram_range;
  const tf: Record<string, number> = {};

  for (let n = minN; n <= maxN; n++) {
    for (let i = 0; i <= tokens.length - n; i++) {
      const ngram = tokens.slice(i, i + n).join(' ');
      tf[ngram] = (tf[ngram] || 0) + 1;
    }
  }

  const vocabSize = Object.keys(vectorizer.vocabulary).length;
  const vector = new Array(vocabSize).fill(0);
  for (const term of Object.keys(tf)) {
    const termIndex = vectorizer.vocabulary[term];
    if (termIndex !== undefined) {
      let termFreq = tf[term];
      if (vectorizer.sublinear_tf) {
        termFreq = termFreq > 0 ? 1 + Math.log(termFreq) : 0;
      }
      const idf = vectorizer.idf[termIndex];
      vector[termIndex] = termFreq * idf;
    }
  }

  // Normalização L2
  const norm = Math.sqrt(vector.reduce((sum, val) => sum + val * val, 0));
  if (norm > 0) {
    for (let i = 0; i < vector.length; i++) {
      vector[i] /= norm;
    }
  }

  return vector;
}

// === Softmax (sem alteração) ===
function softmax(scores: number[]): number[] {
  const maxScore = Math.max(...scores);
  const expScores = scores.map(s => Math.exp(s - maxScore));
  const sumExp = expScores.reduce((sum, val) => sum + val, 0);
  return expScores.map(val => val / sumExp);
}

// === Predição (MUDANÇA: Adicionando filtro de stopword) ===
function predictWithConfidence(text: string): PredictionResult {
  const processed = preprocessText(text);
  const tokens = processed.match(/\b\w+\b/g) || [];

  // MUDANÇA (2/4): Filtrar os tokens ANTES de passar para o TF-IDF
  const filteredTokens = tokens.filter(token => !CUSTOM_STOPWORDS.has(token));

  let scores: number[];
  let probs: number[];

  try {
    // MUDANÇA (3/4): Usar os 'filteredTokens'
    const tfidfVector = calculateTfidf(filteredTokens, model.vectorizer);

    // 2. Calcular Scores
    if (model.classifier.coefficients && model.classifier.intercept) {
      scores = model.classifier.coefficients.map((weights, i) => {
        const intercept = model.classifier.intercept![i];
        return tfidfVector.reduce((acc, val, j) => acc + val * (weights[j] ?? 0), intercept);
      });
    } else {
      console.error('❌ Erro: Modelo não é LogisticRegression ou está mal formatado.');
      throw new Error('Modelo mal formatado.');
    }

    // 3. Calcular Probabilidades
    if (scores.some(isNaN)) {
      console.warn(`⚠️ NaN detectado nos scores. Tratando como "não entendido".`);
      throw new Error('Cálculo de score resultou em NaN.');
    }
    
    probs = softmax(scores);

  } catch (err) {
    console.error(`❌ Erro ao processar o modelo:`, err);
    return { intent: 'unknown', confidence: 0, notUnderstood: true };
  }

  // 4. Encontrar a melhor predição
  const predictedIndex = probs.indexOf(Math.max(...probs));
  const maxProb = probs[predictedIndex];
  const intent = classes[predictedIndex];

  const notUnderstood = maxProb < LOW_CONFIDENCE_THRESHOLD;

  console.log(`🎯 Texto: "${text}"`);
  console.log(`🧩 (Processado para: [${filteredTokens.join(', ')}])`); // MUDANÇA (4/4): Log para debug
  console.log(`🧩 Intenção: ${intent}`);
  console.log(`📊 Confiança: ${(maxProb * 100).toFixed(2)}% (Modelo: ALTA ACURÁCIA)`);
  console.log(`🔎 Status: ${notUnderstood ? '❌ não entendeu' : '✅ alta confiança'}`);

  return { intent, confidence: maxProb, notUnderstood };
}

// === Export ===
export const IntentClassifierService = { predictWithConfidence };
export type { PredictionResult };