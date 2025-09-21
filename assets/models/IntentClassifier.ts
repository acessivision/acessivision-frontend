// src/services/ml/IntentClassifierService.ts

import modelData from './single_model.json';

// Interfaces para garantir que nosso código e o JSON estão alinhados
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

// Carrega os dados do modelo com a tipagem correta
const model: ModelData = modelData as ModelData;
const vocabSize = Object.keys(model.vectorizer.vocabulary).length;

/**
 * Pré-processa o texto de entrada da mesma forma que o TfidfVectorizer do Python.
 * @param text O texto a ser processado.
 * @returns O texto pré-processado.
 */
function preprocessText(text: string): string {
  let processedText = text;
  if (model.vectorizer.lowercase) {
    processedText = processedText.toLowerCase();
  }
  if (model.vectorizer.strip_accents === 'ascii') {
    // Remove acentos (ex: "histórico" -> "historico")
    processedText = processedText.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  }
  return processedText;
}

/**
 * Calcula o vetor TF-IDF para um texto de entrada.
 * @param text O texto pré-processado e tokenizado.
 * @returns Um array de números representando o vetor TF-IDF.
 */
function calculateTfidf(tokens: string[]): number[] {
  // 1. Calcular a Frequência do Termo (TF)
  const tf: { [key: string]: number } = {};
  tokens.forEach(token => {
    tf[token] = (tf[token] || 0) + 1;
  });

  // 2. Criar o vetor de características (inicialmente com zeros)
  const vector = new Array(vocabSize).fill(0);

  // 3. Preencher o vetor com os valores TF-IDF
  Object.keys(tf).forEach(token => {
    const termIndex = model.vectorizer.vocabulary[token];
    if (termIndex !== undefined) {
      const idf = model.vectorizer.idf[termIndex];
      // A fórmula TF-IDF é TF * IDF
      vector[termIndex] = tf[token] * idf;
    }
  });

  return vector;
}

/**
 * Função principal para prever a intenção de um texto.
 * @param text O texto falado pelo usuário.
 * @returns A string da intenção prevista (ex: 'tirar_foto').
 */
function predict(text: string): string {
  // 1. Pré-processar o texto
  const processedText = preprocessText(text);

  // 2. Tokenizar (dividir em palavras)
  const tokens = processedText.match(/\b\w+\b/g) || [];

  // 3. Calcular o vetor TF-IDF
  const tfidfVector = calculateTfidf(tokens);

  // 4. Calcular os scores para cada classe
  const scores = model.classifier.coefficients.map((coef, index) => {
    // Produto escalar entre o vetor TF-IDF e os coeficientes da classe
    let score = tfidfVector.reduce((acc, val, i) => acc + val * coef[i], 0);
    // Adicionar o intercepto
    score += model.classifier.intercept[index];
    return score;
  });

  // 5. Encontrar a classe com o maior score
  let maxScore = -Infinity;
  let predictedIndex = -1;
  scores.forEach((score, index) => {
    if (score > maxScore) {
      maxScore = score;
      predictedIndex = index;
    }
  });

  // 6. Retornar o nome da classe prevista
  return model.classes[predictedIndex];
}

// Exportamos apenas a função `predict` para ser usada no app
export const IntentClassifierService = {
  predict,
};