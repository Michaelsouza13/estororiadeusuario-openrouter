
import { AnalysisResult, GlossaryEntry } from "../types";
import { getRandomReferences, fetchGlossary } from "../utils/storage";

const OPENROUTER_API_URL = "https://openrouter.ai/api/v1/chat/completions";

const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

const cleanStoryText = (text: string): string => {
  if (!text) return "";
  let cleaned = text;
  cleaned = cleaned.replace(/\s*\(REPLANEJAMENTO\s+\d+\)/gi, "");
  cleaned = cleaned.replace(/^["']+|["']+$/g, "");
  return cleaned.trim();
};

const parseJSON = (text: string): any => {
  try { return JSON.parse(text); } catch {}
  const arrayMatch = text.match(/```(?:json)?\s*(\[[\s\S]*?\])\s*```/);
  if (arrayMatch) try { return JSON.parse(arrayMatch[1]); } catch {}
  const jsonMatch = text.match(/```(?:json)?\s*(\{[\s\S]*?\})\s*```/);
  if (jsonMatch) try { return JSON.parse(jsonMatch[1]); } catch {}
  const firstBracket = text.indexOf('[');
  const lastBracket = text.lastIndexOf(']');
  if (firstBracket !== -1 && lastBracket > firstBracket) {
    try { return JSON.parse(text.slice(firstBracket, lastBracket + 1)); } catch {}
  }
  const first = text.indexOf('{');
  const last = text.lastIndexOf('}');
  if (first !== -1 && last > first) {
    try { return JSON.parse(text.slice(first, last + 1)); } catch {}
  }
  throw new Error(`Resposta da IA invalida: ${text.slice(0, 200)}`);
};

const buildGlossaryContext = (glossary: GlossaryEntry[]): string => {
  if (!glossary || glossary.length === 0) return "";
  return `
    ### GLOSSÁRIO DE TERMOS ###
    Use estas definições para interpretar corretamente os termos a seguir:
    ${glossary.map(g => `"${g.term}" = ${g.meaning}`).join('\n')}
  `;
};

const buildSystemPrompt = (referenceExamples: AnalysisResult[], glossary: GlossaryEntry[] = []): string => {
  let examplesContext = "";
  if (referenceExamples.length > 0) {
    examplesContext = `
    ### EXEMPLOS DE REFERÊNCIA (APRENDA COM ESTES GABARITOS) ###
    Abaixo estão exemplos de análises consideradas PERFEITAS pelo usuário.
    Imite o tom do feedback, o rigor das notas e o estilo de reescrita.
    
    ${referenceExamples.map((ref, i) => `
    --- EXEMPLO ${i + 1} ---
    ENTRADA: "${ref.originalStory}"
    SAÍDA ESPERADA:
    Feedback: ${ref.feedback}
    Notas: Persona=${ref.criteriaScores.persona}, Ação=${ref.criteriaScores.action}, Estrutura=${ref.criteriaScores.structure}
    Versão Melhorada: ${ref.improvedVersion}
    -----------------------
    `).join('\n')}
    `;
  }

  return `
    Atue como um Especialista em Engenharia de Requisitos (Product Owner Sênior) auditando backlog com a metodologia Marcos Inácio.
    
    ${buildGlossaryContext(glossary)}
    ${examplesContext}

    ### INSTRUÇÃO CRÍTICA SOBRE RUÍDO DE SISTEMA ###
    As estórias podem conter metadados de exportação no final, como "(REPLANEJAMENTO 2025...)", datas, IDs ou tags entre parênteses.
    -> REGRA DE OURO: IGNORE completamente esses sufixos ao avaliar a nota de ESTRUTURA.
    -> Foque apenas na sentença principal. Se a frase começa com "Como [X], quero [Y]", a estrutura é nota 3, independente do lixo no final.

    ### INSTRUÇÃO DE INCERTEZA (APRENDIZADO) ###
    Se você encontrar termos ambíguos, siglas desconhecidas (ex: "GCJ", "PJE") ou se a estória parecer incompleta,
    use o campo "uncertaintyNote" para expressar sua dúvida (Ex: "Não identifiquei o que é 'GCJ', assumi como Persona válida, mas verifique.").
    NÃO penalize a nota se for apenas uma sigla desconhecida que parece um papel válido.

    ### TABELA DE PONTUAÇÃO (RÍGIDA) ###

    1. PERSONA (Quem)
    [3 Pontos]: Papel de negócio explícito e específico (Ex: "Advogado Cível", "Gestor de RH", "Coordenador").
    [1 Ponto]: Papel genérico (Ex: "Usuário", "Sistema", "Cliente", "Pessoa").
    [0 Pontos]: Omissão total do papel.

    2. AÇÃO (O Quê)
    [3 Pontos]: Verbo de ação imperativo/infinitivo claro + Objeto definido (Ex: "baixar relatório em PDF", "filtrar processos").
    [1 Ponto]: Ação vaga, passiva, muito longa ou misturada com a justificativa.
    [0 Pontos]: Não descreve uma ação funcional (apenas um título ou tópico).

    3. ESTRUTURA (Formato Canônico)
    [3 Pontos]: Segue EXATAMENTE o padrão: "Como [Persona], quero [Ação]...".
       * O conector "quero" (ou "gostaria", "preciso", "devo") é OBRIGATÓRIO para nota 3.
       * Se o padrão for respeitado no início da frase, DÊ NOTA 3, mesmo que sobrem caracteres no final.
    [1 Ponto]: Contém a intenção de Persona e Ação, mas inverte a ordem ou omite o conector "quero".
    [0 Pontos]: Frase solta, título de tarefa ou palavras-chave desconexas.

    ### SOBRE A VERSÃO MELHORADA ###
    - Remova qualquer tag de (REPLANEJAMENTO...) ou IDs.
    - Adicione uma cláusula de valor ("para que...") se possível.
    
    Idioma: Português Brasileiro.

    ### FORMATO DE RESPOSTA ###
    Responda APENAS com um objeto JSON válido (sem markdown, sem blocos de codigo):
    {
      "uncertaintyNote": "string (opcional, deixe vazio se nao houver duvida)",
      "feedback": "string",
      "criteriaScores": { "persona": 0|1|3, "action": 0|1|3, "structure": 0|1|3 },
      "totalScore": number (0-9),
      "improvedVersion": "string"
    }
  `;
};

export const analyzeStory = async (story: string, useFree: boolean = true): Promise<AnalysisResult> => {
  const cleanedStory = cleanStoryText(story);

  const models = useFree
    ? ["openrouter/free"]
    : ["deepseek/deepseek-chat", "meta-llama/llama-3.1-70b-instruct"];

  const [referenceExamples, glossaryEntries] = await Promise.all([
    getRandomReferences(3),
    fetchGlossary()
  ]);
  const systemPrompt = buildSystemPrompt(referenceExamples, glossaryEntries);

  let attempt = 0;
  const maxAttempts = 5;
  let delayTime = 2000;

  while (attempt < maxAttempts) {
    try {
      const response = await fetch(OPENROUTER_API_URL, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${process.env.OPENROUTER_API_KEY}`,
          "Content-Type": "application/json",
          "HTTP-Referer": "https://storyanalyst-ai.netlify.app",
          "X-Title": "StoryAnalyst AI"
        },
        body: JSON.stringify({
          models,
          route: "fallback",
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: cleanedStory }
          ],
          temperature: 0.1,
          top_p: 0.5
        })
      });

      if (!response.ok) {
        const errorBody = await response.text();
        throw { status: response.status, message: errorBody };
      }

      const data = await response.json();
      const content = data.choices?.[0]?.message?.content;
      if (!content) throw new Error("No response from AI");

      const result = parseJSON(content);

      console.log("🤖 Modelo:", data.model);
      console.log("📊 Tokens:", data.usage?.total_tokens);
      console.log("💰 Custo:", data.usage?.cost);

      return {
        originalStory: story,
        ...result,
        isReference: false,
        model: data.model,
        tokens: data.usage?.total_tokens,
        cost: data.usage?.cost
      };

    } catch (error: any) {
      const isRateLimit =
        error?.status === 429 ||
        error?.status === 503 ||
        (error?.message && (error.message.includes('429') || error.message.includes('503') || error.message.includes('RESOURCE_EXHAUSTED') || error.message.includes('insufficient_quota')));

      if (isRateLimit && attempt < maxAttempts - 1) {
        attempt++;
        console.warn(`OpenRouter API limit. Retrying in ${delayTime}ms... (Attempt ${attempt}/${maxAttempts})`);
        await wait(delayTime);
        delayTime *= 2;
        continue;
      }

      console.error("Error analyzing story:", error);
      throw error;
    }
  }

  throw new Error("Falha na análise após várias tentativas.");
};

const buildBatchSystemPrompt = (referenceExamples: AnalysisResult[], glossary: GlossaryEntry[] = []): string => {
  let examplesContext = "";
  if (referenceExamples.length > 0) {
    examplesContext = `
    ### EXEMPLOS DE REFERÊNCIA (APRENDA COM ESTES GABARITOS) ###
    Abaixo estão exemplos de análises consideradas PERFEITAS pelo usuário.
    Imite o tom do feedback, o rigor das notas e o estilo de reescrita.
    
    ${referenceExamples.map((ref, i) => `
    --- EXEMPLO ${i + 1} ---
    ENTRADA: "${ref.originalStory}"
    SAÍDA ESPERADA:
    Feedback: ${ref.feedback}
    Notas: Persona=${ref.criteriaScores.persona}, Ação=${ref.criteriaScores.action}, Estrutura=${ref.criteriaScores.structure}
    Versão Melhorada: ${ref.improvedVersion}
    -----------------------
    `).join('\n')}
    `;
  }

  return `
    Atue como um Especialista em Engenharia de Requisitos (Product Owner Sênior) auditando backlog com a metodologia Marcos Inácio.
    
    ${buildGlossaryContext(glossary)}
    ${examplesContext}

    ### INSTRUÇÃO CRÍTICA SOBRE RUÍDO DE SISTEMA ###
    As estórias podem conter metadados de exportação no final, como "(REPLANEJAMENTO 2025...)", datas, IDs ou tags entre parênteses.
    -> REGRA DE OURO: IGNORE completamente esses sufixos ao avaliar a nota de ESTRUTURA.
    -> Foque apenas na sentença principal. Se a frase começa com "Como [X], quero [Y]", a estrutura é nota 3, independente do lixo no final.

    ### INSTRUÇÃO DE INCERTEZA (APRENDIZADO) ###
    Se você encontrar termos ambíguos, siglas desconhecidas (ex: "GCJ", "PJE") ou se a estória parecer incompleta,
    use o campo "uncertaintyNote" para expressar sua dúvida.
    NÃO penalize a nota se for apenas uma sigla desconhecida que parece um papel válido.

    ### TABELA DE PONTUAÇÃO (RÍGIDA) ###

    1. PERSONA (Quem)
    [3 Pontos]: Papel de negócio explícito e específico (Ex: "Advogado Cível", "Gestor de RH", "Coordenador").
    [1 Ponto]: Papel genérico (Ex: "Usuário", "Sistema", "Cliente", "Pessoa").
    [0 Pontos]: Omissão total do papel.

    2. AÇÃO (O Quê)
    [3 Pontos]: Verbo de ação imperativo/infinitivo claro + Objeto definido (Ex: "baixar relatório em PDF", "filtrar processos").
    [1 Ponto]: Ação vaga, passiva, muito longa ou misturada com a justificativa.
    [0 Pontos]: Não descreve uma ação funcional (apenas um título ou tópico).

    3. ESTRUTURA (Formato Canônico)
    [3 Pontos]: Segue EXATAMENTE o padrão: "Como [Persona], quero [Ação]...".
       * O conector "quero" (ou "gostaria", "preciso", "devo") é OBRIGATÓRIO para nota 3.
       * Se o padrão for respeitado no início da frase, DÊ NOTA 3, mesmo que sobrem caracteres no final.
    [1 Ponto]: Contém a intenção de Persona e Ação, mas inverte a ordem ou omite o conector "quero".
    [0 Pontos]: Frase solta, título de tarefa ou palavras-chave desconexas.

    ### SOBRE A VERSÃO MELHORADA ###
    - Remova qualquer tag de (REPLANEJAMENTO...) ou IDs.
    - Adicione uma cláusula de valor ("para que...") se possível.
    
    Idioma: Português Brasileiro.

    ### MODO LOTE - INSTRUÇÕES CRÍTICAS ###
    Você receberá VÁRIAS histórias numeradas em uma única mensagem.
    Analise CADA história INDEPENDENTEMENTE, sem comparar umas com as outras.
    Cada história deve ser avaliada como se fosse a única, como se as outras não existissem.
    NÃO pule nenhuma história. Responda com EXATAMENTE o mesmo número de objetos do array.

    ### FORMATO DE RESPOSTA ###
    Responda APENAS com um array JSON válido (sem markdown, sem blocos de codigo).
    Um objeto para cada história, na MESMA ordem em que foram fornecidas.
    Use o campo "storyIndex" para indicar o índice (0-based) de cada história:

    [
      {
        "storyIndex": 0,
        "uncertaintyNote": "string (opcional, deixe vazio se nao houver duvida)",
        "feedback": "string",
        "criteriaScores": { "persona": 0|1|3, "action": 0|1|3, "structure": 0|1|3 },
        "totalScore": number (0-9),
        "improvedVersion": "string"
      }
    ]
  `;
};

const makeRequest = async (
  models: string[],
  systemPrompt: string,
  userContent: string,
  useFree: boolean,
  signal?: AbortSignal
): Promise<{ content: string; model: string; tokens: number; cost: number }> => {
  let attempt = 0;
  const maxAttempts = 5;
  let delayTime = 2000;

  while (attempt < maxAttempts) {
    try {
      const body: Record<string, any> = {
        models,
        route: "fallback",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userContent }
        ],
        temperature: 0.1,
        top_p: 0.5
      };

      if (!useFree) {
        body.response_format = { type: "json_object" };
      }

      const response = await fetch(OPENROUTER_API_URL, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${process.env.OPENROUTER_API_KEY}`,
          "Content-Type": "application/json",
          "HTTP-Referer": "https://storyanalyst-ai.netlify.app",
          "X-Title": "StoryAnalyst AI"
        },
        body: JSON.stringify(body),
        signal
      });

      if (!response.ok) {
        const errorBody = await response.text();
        throw { status: response.status, message: errorBody };
      }

      const data = await response.json();
      const content = data.choices?.[0]?.message?.content;
      if (!content) throw new Error("No response from AI");

      return {
        content,
        model: data.model,
        tokens: data.usage?.total_tokens || 0,
        cost: data.usage?.cost || 0
      };

    } catch (error: any) {
      if (signal?.aborted) throw error;

      const isRateLimit =
        error?.status === 429 ||
        error?.status === 503 ||
        (error?.message && (error.message.includes('429') || error.message.includes('503') || error.message.includes('RESOURCE_EXHAUSTED') || error.message.includes('insufficient_quota')));

      if (isRateLimit && attempt < maxAttempts - 1) {
        attempt++;
        console.warn(`OpenRouter API limit. Retrying in ${delayTime}ms... (Attempt ${attempt}/${maxAttempts})`);
        await wait(delayTime);
        delayTime *= 2;
        continue;
      }

      throw error;
    }
  }

  throw new Error("Falha na requisição após várias tentativas.");
};

const validateBatchItems = (parsed: any): any[] | null => {
  if (!Array.isArray(parsed)) return null;
  const valid = parsed.filter((item: any) =>
    item && typeof item === 'object' &&
    typeof item.feedback === 'string' &&
    typeof item.improvedVersion === 'string' &&
    item.criteriaScores && typeof item.criteriaScores === 'object'
  );
  return valid.length > 0 ? valid : null;
};

const mapItemsToResults = (
  items: any[],
  chunkStories: string[],
  responseModel?: string,
  responseTokens?: number,
  responseCost?: number
): AnalysisResult[] => {
  const map = new Map<number, any>();
  items.forEach((item, pos) => {
    const idx = typeof item.storyIndex === 'number' ? item.storyIndex : pos;
    if (!map.has(idx)) map.set(idx, item);
  });

  return chunkStories.map((story, i) => {
    const item = map.get(i) || {};
    return {
      originalStory: story,
      feedback: item.feedback || '',
      criteriaScores: {
        persona: item.criteriaScores?.persona ?? 0,
        action: item.criteriaScores?.action ?? 0,
        structure: item.criteriaScores?.structure ?? 0,
      },
      totalScore: item.totalScore ??
        ((item.criteriaScores?.persona ?? 0) + (item.criteriaScores?.action ?? 0) + (item.criteriaScores?.structure ?? 0)),
      improvedVersion: item.improvedVersion || '',
      uncertaintyNote: item.uncertaintyNote || '',
      isReference: false,
      model: responseModel,
      tokens: responseTokens,
      cost: responseCost,
    };
  });
};

const processChunk = async (
  chunk: string[],
  useFree: boolean,
  referenceExamples: AnalysisResult[],
  glossary: GlossaryEntry[] = [],
  signal?: AbortSignal
): Promise<AnalysisResult[]> => {
  const models = useFree
    ? ["openrouter/free"]
    : ["deepseek/deepseek-chat", "meta-llama/llama-3.1-70b-instruct"];

  const batchPrompt = buildBatchSystemPrompt(referenceExamples, glossary);
  const userContent = chunk.map((s, i) => `[${i}] ${s}`).join('\n\n');

  let response = await makeRequest(models, batchPrompt, userContent, useFree, signal).catch(() => null);
  let parsed = response ? validateBatchItems(parseJSON(response.content)) : null;

  if (parsed && parsed.length >= chunk.length) {
    return mapItemsToResults(parsed.slice(0, chunk.length), chunk, response?.model, response?.tokens, response?.cost);
  }

  const usedIndices = new Set(parsed ? parsed.map((p: any) => p.storyIndex).filter((i: number) => i !== undefined) : []);
  const missingIdx: number[] = [];
  for (let i = 0; i < chunk.length; i++) {
    if (!usedIndices.has(i)) missingIdx.push(i);
  }

  let recovered: (AnalysisResult | null)[] = parsed
    ? mapItemsToResults(parsed, chunk, response?.model, response?.tokens, response?.cost)
    : new Array(chunk.length).fill(null);

  if (missingIdx.length > 1 && missingIdx.length <= chunk.length) {
    const missingStories = missingIdx.map(i => chunk[i]);
    const retryContent = missingStories.map((s, i) => `[${i}] ${s}`).join('\n\n');
    try {
      const retryResponse = await makeRequest(models, batchPrompt, retryContent, useFree, signal);
      const retryParsed = validateBatchItems(parseJSON(retryResponse.content));
      if (retryParsed) {
        const retryResults = mapItemsToResults(retryParsed, missingStories, retryResponse.model, retryResponse.tokens, retryResponse.cost);
        retryResults.forEach((r, ri) => { recovered[missingIdx[ri]] = r; });
      }
    } catch {
      // fall through to individual retry
    }
  }

  for (const idx of missingIdx) {
    if (recovered[idx]) continue;
    try {
      const singlePrompt = buildSystemPrompt(referenceExamples, glossary);
      const singleResponse = await makeRequest(models, singlePrompt, chunk[idx], useFree, signal);
      const singleParsed = parseJSON(singleResponse.content);
      recovered[idx] = mapItemsToResults([{ ...singleParsed, storyIndex: 0 }], [chunk[idx]], singleResponse.model, singleResponse.tokens, singleResponse.cost)[0];
    } catch (e) {
      if (signal?.aborted) throw e;
      throw new Error(`Falha na análise da história #${idx + 1} após tentativas de fallback.`);
    }
  }

  return recovered.filter((r): r is AnalysisResult => r !== null);
};

export const analyzeStoriesBatch = async (
  stories: string[],
  useFree: boolean = true,
  batchSize: number = 10,
  onBatchComplete?: (completedCount: number, totalCount: number, batchIndex: number, totalBatches: number, model?: string, tokens?: number, cost?: number) => void,
  signal?: AbortSignal
): Promise<AnalysisResult[]> => {
  if (stories.length === 0) return [];

  const cleanedStories = stories.map(cleanStoryText);
  const [referenceExamples, glossaryEntries] = await Promise.all([
    getRandomReferences(3),
    fetchGlossary()
  ]);
  const allResults: AnalysisResult[] = [];
  const totalBatches = Math.ceil(cleanedStories.length / batchSize);
  let lastModel = '';
  let cumulativeTokens = 0;
  let cumulativeCost = 0;

  for (let i = 0; i < cleanedStories.length; i += batchSize) {
    if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');

    const chunk = cleanedStories.slice(i, i + batchSize);
    const batchResults = await processChunk(chunk, useFree, referenceExamples, glossaryEntries, signal);

    if (batchResults.length > 0 && batchResults[0].model) {
      lastModel = batchResults[0].model;
      cumulativeTokens += batchResults[0].tokens || 0;
      cumulativeCost += batchResults[0].cost || 0;
    }

    allResults.push(...batchResults);

    const completed = Math.min(i + batchSize, cleanedStories.length);
    const batchIdx = Math.floor(i / batchSize) + 1;
    onBatchComplete?.(completed, cleanedStories.length, batchIdx, totalBatches, lastModel, cumulativeTokens, cumulativeCost);
  }

  return allResults;
};
