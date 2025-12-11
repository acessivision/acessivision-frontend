import modelAltaRaw from './model_alta_acuracia.json';

const model = modelAltaRaw as unknown as ModelData;

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
export interface PredictionResult {
  intent: string;
  confidence: number;
  notUnderstood: boolean;
}

const classes = model.classes;

const LOW_CONFIDENCE_THRESHOLD = 0.35; 

function preprocessText(text: string): string {
  let processed = text;
  if (model.vectorizer.lowercase) {
    processed = processed.toLowerCase();
  }

  processed = processed.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  return processed;
}

function calculateTfidf(tokens: string[], vectorizer: VectorizerData): number[] {
  const [minN, maxN] = vectorizer.ngram_range;
  const tf: Record<string, number> = {};

  for (let n = minN; n <= maxN; n++) {
    for (let i = 0; i <= tokens.length - n; i++) {
      const ngram = tokens.slice(i, i + n).join(' ');
      if (vectorizer.vocabulary[ngram] !== undefined) {
        tf[ngram] = (tf[ngram] || 0) + 1;
      }
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

  const norm = Math.sqrt(vector.reduce((sum, val) => sum + val * val, 0));
  if (norm > 0) {
    for (let i = 0; i < vector.length; i++) {
      vector[i] /= norm;
    }
  }
  return vector;
}

function softmax(scores: number[]): number[] {
  const maxScore = Math.max(...scores);
  const expScores = scores.map(s => Math.exp(s - maxScore));
  const sumExp = expScores.reduce((sum, val) => sum + val, 0);
  return expScores.map(val => val / sumExp);
}

function predictWithConfidence(text: string): PredictionResult {
  const processed = preprocessText(text);
  
  const cleanText = processed.replace(/[^\w\s]/g, ''); 
  const tokens = cleanText.match(/\b\w+\b/g) || [];

  let scores: number[];
  let probs: number[];

  try {
    const tfidfVector = calculateTfidf(tokens, model.vectorizer);

    if (model.classifier.coefficients && model.classifier.intercept) {
      scores = model.classifier.coefficients.map((weights, i) => {
        const intercept = model.classifier.intercept![i];
        return tfidfVector.reduce((acc, val, j) => acc + val * (weights[j] ?? 0), intercept);
      });
    } else {
      throw new Error('Modelo mal formatado.');
    }

    probs = softmax(scores);

  } catch (err) {
    console.error(`❌ Erro:`, err);
    return { intent: 'fora_de_escopo', confidence: 0, notUnderstood: true };
  }

  const predictedIndex = probs.indexOf(Math.max(...probs));
  const maxProb = probs[predictedIndex];
  let intent = classes[predictedIndex];

  const notUnderstood = maxProb < LOW_CONFIDENCE_THRESHOLD;

  if (notUnderstood) {
      intent = 'fora_de_escopo';
  }

  return { intent, confidence: maxProb, notUnderstood };
}

export const IntentClassifierService = { predictWithConfidence };