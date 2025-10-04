// src/services/ml/IntentClassifierService.ts

import modelData from './modelo96.json';

// Interfaces existentes
interface VectorizerData {
  vocabulary: { [key: string]: number };
  idf: number[];
  lowercase: boolean;
  strip_accents: 'ascii' | null;
}

interface ClassifierData {
  coefficients: number[][];
  intercept: number[];
}

interface ModelData {
  model_type: string;
  classes: string[];
  vectorizer: VectorizerData;
  classifier: ClassifierData;
}

// Interface com novo campo para indicar se não entendeu
interface PredictionResult {
  intent: string;
  confidence: number;
  needsConfirmation: boolean;
  notUnderstood: boolean; // Novo campo
}

// Carrega os dados do modelo
const model: ModelData = modelData as ModelData;
const vocabSize = Object.keys(model.vectorizer.vocabulary).length;

// Limites de confiança ajustados
const LOW_CONFIDENCE_THRESHOLD = 0.55;  // 55% - abaixo disso, não entendeu
const HIGH_CONFIDENCE_THRESHOLD = 0.70; // 70% - acima disso, executa direto

/**
 * Pré-processa o texto (mantém implementação original)
 */
function preprocessText(text: string): string {
  let processedText = text;
  if (model.vectorizer.lowercase) {
    processedText = processedText.toLowerCase();
  }
  if (model.vectorizer.strip_accents === 'ascii') {
    processedText = processedText.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  }
  return processedText;
}

/**
 * Calcula o vetor TF-IDF (mantém implementação original)
 */
function calculateTfidf(tokens: string[]): number[] {
  const tf: { [key: string]: number } = {};
  tokens.forEach(token => {
    tf[token] = (tf[token] || 0) + 1;
  });

  const vector = new Array(vocabSize).fill(0);
  Object.keys(tf).forEach(token => {
    const termIndex = model.vectorizer.vocabulary[token];
    if (termIndex !== undefined) {
      const idf = model.vectorizer.idf[termIndex];
      vector[termIndex] = tf[token] * idf;
    }
  });

  return vector;
}

/**
 * Converte scores em probabilidades usando softmax
 */
function softmax(scores: number[]): number[] {
  const maxScore = Math.max(...scores);
  const expScores = scores.map(score => Math.exp(score - maxScore));
  const sumExp = expScores.reduce((sum, exp) => sum + exp, 0);
  return expScores.map(exp => exp / sumExp);
}

/**
 * Função original mantida para compatibilidade
 */
function predict(text: string): string {
  const processedText = preprocessText(text);
  const tokens = processedText.match(/\b\w+\b/g) || [];
  const tfidfVector = calculateTfidf(tokens);

  const scores = model.classifier.coefficients.map((coef, index) => {
    let score = tfidfVector.reduce((acc, val, i) => acc + val * coef[i], 0);
    score += model.classifier.intercept[index];
    return score;
  });

  let maxScore = -Infinity;
  let predictedIndex = -1;
  scores.forEach((score, index) => {
    if (score > maxScore) {
      maxScore = score;
      predictedIndex = index;
    }
  });

  return model.classes[predictedIndex];
}

/**
 * Nova função com verificação de confiança em três níveis
 */
function predictWithConfidence(text: string): PredictionResult {
  const processedText = preprocessText(text);
  const tokens = processedText.match(/\b\w+\b/g) || [];
  const tfidfVector = calculateTfidf(tokens);

  // Calcular scores
  const scores = model.classifier.coefficients.map((coef, index) => {
    let score = tfidfVector.reduce((acc, val, i) => acc + val * coef[i], 0);
    score += model.classifier.intercept[index];
    return score;
  });

  // Converter para probabilidades
  const probabilities = softmax(scores);

  // Encontrar a melhor predição
  let maxProb = -1;
  let predictedIndex = -1;
  probabilities.forEach((prob, index) => {
    if (prob > maxProb) {
      maxProb = prob;
      predictedIndex = index;
    }
  });

  // Determinar o comportamento baseado na confiança
  let needsConfirmation = false;
  let notUnderstood = false;

  if (maxProb < LOW_CONFIDENCE_THRESHOLD) {
    // Confiança muito baixa (< 55%) - não entendeu
    notUnderstood = true;
    needsConfirmation = false;
  } else if (maxProb < HIGH_CONFIDENCE_THRESHOLD) {
    // Confiança média (55% - 70%) - pede confirmação
    notUnderstood = false;
    needsConfirmation = true;
  } else {
    // Alta confiança (> 70%) - executa direto
    notUnderstood = false;
    needsConfirmation = false;
  }

  return {
    intent: model.classes[predictedIndex],
    confidence: maxProb,
    needsConfirmation,
    notUnderstood
  };
}

export const IntentClassifierService = {
  predict,
  predictWithConfidence,
};

export type { PredictionResult };