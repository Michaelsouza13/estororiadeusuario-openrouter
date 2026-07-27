
import { AnalysisResult } from "../types";
import { getRandomReferences } from "../utils/storage";

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
  const jsonMatch = text.match(/```(?:json)?\s*(\{[\s\S]*?\})\s*```/);
  if (jsonMatch) try { return JSON.parse(jsonMatch[1]); } catch {}
  const first = text.indexOf('{');
  const last = text.lastIndexOf('}');
  if (first !== -1 && last > first) {
    try { return JSON.parse(text.slice(first, last + 1)); } catch {}
  }
  throw new Error(`Resposta da IA invalida: ${text.slice(0, 200)}`);
};

const buildSystemPrompt = (referenceExamples: AnalysisResult[]): string => {
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

  const referenceExamples = await getRandomReferences(3);
  const systemPrompt = buildSystemPrompt(referenceExamples);

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
