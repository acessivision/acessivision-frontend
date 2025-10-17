// src/services/ml/IntentClassifierService.ts

import modelAltaRaw from './model_alta_acuracia.json';
import modelSVMRaw from './model_svm.json';
import modelCustomRaw from './model_custom.json';

const modelAlta = modelAltaRaw as ModelData;
const modelSVM = modelSVMRaw as ModelData;
const modelCustom = modelCustomRaw as ModelData;

// === Interfaces ===
interface VectorizerData {
  vocabulary: { [key: string]: number };
  idf: number[];
  lowercase: boolean;
  strip_accents: 'ascii' | null;
  sublinear_tf?: boolean;
}

interface ClassifierData {
  coefficients?: number[][]; // Logistic Regression
  intercept?: number[];
  // SVM
  support_vectors_?: number[][] | null;
  dual_coef_?: number[][] | null;
  n_support_?: number[] | null;
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

// === Constantes ===
const models: ModelData[] = [modelAlta, modelSVM, modelCustom];
const classes = modelAlta.classes;
const vocabSize = Object.keys(modelAlta.vectorizer.vocabulary).length;

const LOW_CONFIDENCE_THRESHOLD = 0.25;

// === Pré-processamento ===
function preprocessText(text: string): string {
  let processed = text.toLowerCase();  // Always lowercase
  processed = processed.normalize('NFD').replace(/[\u0300-\u036f]/g, '');  // Always remove accents (like unidecode)
  return processed;
}

// === TF-IDF com suporte a sublinear_tf e normalização L2 ===
function calculateTfidf(tokens: string[], vectorizer: VectorizerData): number[] {
  // Infer ngram_range from vocabulary (terms like "o que" have length 2)
  let minN = Infinity;
  let maxN = -Infinity;
  Object.keys(vectorizer.vocabulary).forEach(term => {
    const parts = term.trim().split(/\s+/);
    const len = parts.length;
    if (len < minN) minN = len;
    if (len > maxN) maxN = len;
  });
  minN = Number.isFinite(minN) ? minN : 1;
  maxN = Number.isFinite(maxN) ? maxN : 1;

  const tf: Record<string, number> = {};

  // Generate and count all n-grams in the inferred range
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

  // Normalização L2 (igual scikit-learn)
  const norm = Math.sqrt(vector.reduce((sum, val) => sum + val * val, 0));
  if (norm > 0) {
    for (let i = 0; i < vector.length; i++) {
      vector[i] /= norm;
    }
  }

  return vector;
}

// === Softmax ===
function softmax(scores: number[]): number[] {
  const maxScore = Math.max(...scores);
  const expScores = scores.map(s => Math.exp(s - maxScore));
  const sumExp = expScores.reduce((sum, val) => sum + val, 0);
  return expScores.map(val => val / sumExp);
}

// === Predição com ensemble ===
// === Predição com ensemble ===
function predictWithConfidence(text: string): PredictionResult {
  const processed = preprocessText(text);
  const tokens = processed.match(/\b\w+\b/g) || [];

  const sumProbs = new Array(classes.length).fill(0);
  let validModels = 0;

  models.forEach((model, idx) => {
    try {
      // Compute TF-IDF using THIS model's vectorizer (key fix)
      const modelVocabSize = Object.keys(model.vectorizer.vocabulary).length;
      const tfidfVector = calculateTfidf(tokens, model.vectorizer);  // Use model.vectorizer here

      let scores: number[];

      // === Logistic Regression ===
      if (model.classifier.coefficients && model.classifier.intercept) {
        scores = model.classifier.coefficients.map((weights, i) => {
          const intercept = model.classifier.intercept![i];
          return tfidfVector.reduce((acc, val, j) => acc + val * (weights[j] ?? 0), intercept);
        });

      // === SVM (usando vetores de suporte) ===
      } else if (model.classifier.support_vectors_ && model.classifier.dual_coef_ && model.classifier.intercept) {
        const supportVectors = model.classifier.support_vectors_;
        const dualCoef = model.classifier.dual_coef_;
        const intercepts = model.classifier.intercept!;

        // produto dual_coef @ (svm_dot(tfidf, support_vectors)) + intercept
        const dot = supportVectors.map(sv =>
          tfidfVector.reduce((acc, val, j) => acc + val * (sv[j] ?? 0), 0)
        );

        scores = dualCoef.map((coefRow, i) =>
          coefRow.reduce((acc, c, j) => acc + c * (dot[j] ?? 0), intercepts[i])  // Added ?? 0 to prevent NaN if lengths mismatch
        );

      } else {
        console.warn(`⚠️ Modelo ${idx + 1} (${model.model_type}) inválido — ignorado.`);
        return;
      }

      // Check for NaN in scores (debug safeguard)
      if (scores.some(isNaN)) {
        console.warn(`⚠️ NaN detected in scores for model ${idx + 1}. Skipping.`);
        return;
      }

      const probs = softmax(scores);
      probs.forEach((p, i) => (sumProbs[i] += p));
      validModels++;
    } catch (err) {
      console.error(`❌ Erro ao processar modelo ${idx + 1}:`, err);
    }
  });

  if (validModels === 0) throw new Error('Nenhum modelo válido disponível.');

  const avgProbs = sumProbs.map(p => p / validModels);

  // Handle NaN in avgProbs (fallback to low confidence if all NaN)
  if (avgProbs.every(isNaN)) {
    console.warn('⚠️ All probabilities are NaN. Treating as not understood.');
    return { intent: 'unknown', confidence: 0, notUnderstood: true };
  }

  // Remove NaN from consideration (set to 0)
  const cleanAvgProbs = avgProbs.map(p => isNaN(p) ? 0 : p);

  const predictedIndex = cleanAvgProbs.indexOf(Math.max(...cleanAvgProbs));
  const maxProb = cleanAvgProbs[predictedIndex];
  const intent = classes[predictedIndex];

  const notUnderstood = maxProb < LOW_CONFIDENCE_THRESHOLD;

  console.log(`🎯 Texto: "${text}"`);
  console.log(`🧩 Intenção: ${intent}`);
  console.log(`📊 Confiança: ${(maxProb * 100).toFixed(2)}% (modelos válidos: ${validModels})`);
  console.log(`🔎 Status: ${notUnderstood ? '❌ não entendeu' : '✅ alta confiança'}`);

  return { intent, confidence: maxProb, notUnderstood };
}

// === Export ===
export const IntentClassifierService = { predictWithConfidence };
export type { PredictionResult };
