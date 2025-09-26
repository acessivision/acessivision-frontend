// src/services/ml/IntentClassifierService.ts

import modelData from './single_model.json';

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

// Interface simples para resultado com confiança
interface PredictionResult {
  intent: string;
  confidence: number;
  needsConfirmation: boolean;
}

// Carrega os dados do modelo
const model: ModelData = modelData as ModelData;
const vocabSize = Object.keys(model.vectorizer.vocabulary).length;
const CONFIDENCE_THRESHOLD = 0.7; // 70%

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
 * Nova função com verificação de confiança
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

  return {
    intent: model.classes[predictedIndex],
    confidence: maxProb,
    needsConfirmation: maxProb <= CONFIDENCE_THRESHOLD
  };
}

export const IntentClassifierService = {
  predict,
  predictWithConfidence,
};

export type { PredictionResult };