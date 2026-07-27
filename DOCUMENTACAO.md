# StoryAnalyst AI

App de auditoria de histórias de usuário usando IA, baseado na metodologia Marcos Inácio.

## Arquitetura

- **Frontend**: React + TypeScript + Vite + Tailwind (CDN Play)
- **Banco**: Firebase Firestore (histórico + base de conhecimento + glossário)
- **IA**: OpenRouter (DeepSeek V3 / Llama 3.1 70B / Free)
- **Hospedagem**: Netlify
- **Paleta**: `#ff5500` (primária), `#191919`/`#292929` (textos), `#e29494` (detalhes), CSS variables com suporte a dark mode

## Funcionalidades

- Análise individual de histórias de usuário
- Importação em lote via planilha XLSX com batching inteligente (lotes de 10, tiered retry)
- Pontuação por critérios (Persona, Ação, Estrutura)
- Dashboard com gráficos e médias (Recharts)
- Histórico de análises com filtros por agilista e trimestre
- Base de Conhecimento (Few-Shot Learning para a IA)
- Glossário de Termos (persistente no Firebase, injetado no prompt da IA)
- Extração automática de termos das dúvidas da IA para o glossário
- Dark Mode com toggle, persistência em localStorage e detecção de preferência do sistema
- Exportação para XLSX
- Seletor de modelo Free / DeepSeek V3
- Notificação toast + chime sonoro + Notification API + webhook Google Chat
- Log de última consulta (modelo, tokens, custo) com persistência em localStorage
- Cancelamento de análise em lote via AbortController
- Amostragem configurável (10-100%) na importação em lote

## Glossário de Termos

### Funcionamento
- Os termos são armazenados na coleção `context_glossary` do Firestore
- Na análise, o glossário é injetado no system prompt antes dos exemplos
- Se o glossário estiver vazio, nenhum overhead é adicionado ao prompt

### Alimentação
- **Manual**: aba Glossário → "Novo Termo" → termo + significado
- **Automático**: ao clicar 👍/👎 no alerta de dúvida da IA, o termo é extraído e um mini-modal pergunta o significado

### Interface
- Tabela com termo, significado, fonte (auto/manual), data
- Busca por termo ou significado
- Edição inline e exclusão com confirmação
- Badge contador de termos no topo

## Dark Mode

### Funcionamento
- CSS custom properties definidas em `:root` (light) e `.dark` (dark) no `index.html`
- Tailwind configurado com `darkMode: 'class'` (CDN)
- Botão `Sun`/`Moon` no cabeçalho alterna a classe `dark` no `<html>`

### Persistência
- `localStorage('storyanalyst_dark')` — salva a preferência
- Na primeira visita, detecta `prefers-color-scheme: dark` do sistema
- Transição suave de 300ms entre os modos

### Variáveis CSS

| Variável | Light | Dark |
|----------|-------|------|
| `--bg-body` | `#f8f7f5` | `#0a0a0a` |
| `--bg-surface` | `#ffffff` | `#1a1a1a` |
| `--bg-muted` | `#f8f7f5` | `#222222` |
| `--bg-accent` | `#fff5f0` | `#1a0a04` |
| `--text-primary` | `#191919` | `#f5f5f5` |
| `--text-secondary` | `#292929` | `#a3a3a3` |
| `--border-light` | `#e5e7eb` | `#333333` |

## Otimização de Batching

### Problema
OpenRouter limita por número de requisições (20 RPM free, 50-1000 RPD), não por tokens. Analisar 100 histórias individualmente consumiria 100 requisições.

### Solução
`analyzeStoriesBatch()` envia lotes de 10 histórias por requisição, reduzindo ~90% das chamadas.

### Tiered Retry
1. **Batch completo**: 10 histórias em 1 requisição
2. **Mini-batch**: se faltaram índices, reenvia apenas os ausentes
3. **Individual fallback**: se ainda faltar, cada história é reenviada sozinha

### UI de Progresso
- Badge "Lote 3/5"
- Porcentagem e barra de progresso
- Tempo estimado restante
- Botão Cancelar (AbortController)
- Notificação toast + chame + webhook ao final

## Modelos de IA

### Modo Free (padrão)
- Modelo: `openrouter/free` (auto-router)
- Custo: $0
- Limite: 50 requisições/dia
- Ideal para: testes e uso esporádico

### Modo DeepSeek V3
- Modelos: `deepseek/deepseek-chat` → `meta-llama/llama-3.1-70b-instruct` (fallback automático)
- Custo: ~$0.25/M tokens
- Ideal para: auditorias em lote (100-1000 requisições)
- Requer créditos no OpenRouter

### Como alternar
Clique no ícone de engrenagem (⚙️) no cabeçalho e selecione o modelo desejado.

## Pré-requisitos

- Node.js 18+
- Conta no [OpenRouter](https://openrouter.ai) com chave de API
- (Opcional) Conta no Firebase para histórico, base de conhecimento e glossário

## Instalação e uso local

```bash
# Instalar dependências
npm install

# Criar arquivo de ambiente
# Crie um arquivo .env na raiz com:
# OPENROUTER_API_KEY=sk-or-v1-sua-chave-aqui

# Iniciar servidor de desenvolvimento
npm run dev
```

Acesse `http://localhost:3000`.

## Produção (Netlify)

1. Conecte o repositório ao Netlify
2. Adicione a variável de ambiente:
   ```
   OPENROUTER_API_KEY = sk-or-v1-sua-chave-aqui
   ```
3. Configurações de build (automáticas):
   - Build command: `npm run build`
   - Publish directory: `dist`

## Comandos

| Comando | Descrição |
|---------|-----------|
| `npm run dev` | Servidor local na porta 3000 |
| `npm run build` | Build de produção |
| `npm run preview` | Preview do build |

## Variáveis de ambiente

| Variável | Obrigatório | Descrição |
|----------|-------------|-----------|
| `OPENROUTER_API_KEY` | Sim | Chave da API OpenRouter |
| `GEMINI_API_KEY` | Não | (Legado) Substituído por OpenRouter |

## Estrutura do projeto

```
├── components/           # Componentes React
│   ├── AnalysisCard.tsx  # Card de resultado da análise (score, dúvidas, glossário)
│   ├── Dashboard.tsx     # Gráficos de desempenho (Recharts)
│   ├── HistoryView.tsx   # Visualização do histórico com filtros e seleção
│   ├── KnowledgeBase.tsx # Base de conhecimento (exemplos de ouro)
│   └── GlossaryView.tsx  # Glossário de termos com CRUD e busca
├── services/
│   ├── aiService.ts      # Integração com OpenRouter (batching, retry, glossário)
│   └── firebase.ts       # Configuração do Firebase
├── utils/
│   ├── fileParser.ts     # Parse de arquivos XLSX
│   └── storage.ts        # CRUD no Firebase (history, references, glossary)
├── App.tsx               # Componente principal (5 abas + dark mode toggle)
├── types.ts              # Tipos TypeScript
├── index.html            # CSS variables + Tailwind CDN + dark mode config
└── vite.config.ts        # Configuração do Vite
```

## Como funciona a análise

1. O usuário insere uma história de usuário (ou faz upload de planilha)
2. A IA recebe um prompt com:
   - Instruções do sistema (metodologia Marcos Inácio)
   - **Glossário de Termos** (se houver entradas)
   - Exemplos da Base de Conhecimento (Few-Shot Learning)
   - A história a ser analisada
3. A IA retorna um JSON com:
   - Notas para Persona (0/1/3), Ação (0/1/3), Estrutura (0/1/3)
   - Total (0-9)
   - Feedback técnico
   - Versão melhorada da história
   - Nota de incerteza (`uncertaintyNote`, se aplicável)
4. O `parseJSON()` limpa markdown/ruído antes do `JSON.parse`:
   - Tenta `JSON.parse` direto
   - Extrai de ` ```json [...] ``` ` ou ` ```json {...} ``` `
   - Encontra `[...]` ou `{...}` no texto como fallback
5. A resposta inclui `model`, `tokens` e `cost` — salvos no Firebase e exibidos no painel ⚙️
6. O usuário pode ajustar as notas, salvar no histórico e marcar como "exemplo de ouro"
7. Se a IA emitiu `uncertaintyNote`, o usuário pode 👍 confirmar ou 👎 corrigir — e o termo é extraído automaticamente para o Glossário

## Notificações e Webhook

### Toast + Chime
- **Toast**: Mensagem verde no canto inferior direito por 5 segundos ao concluir lote
- **Chime**: Tom duplo (660Hz → 880Hz) via `AudioContext` (função `playNotification`)

### Notification API
- Solicita permissão ao carregar o app (`Notification.requestPermission()`)
- Se concedida, envia notificação nativa do sistema ao concluir auditoria em lote

### Google Chat Webhook
- URL: `GOOGLE_CHAT_WEBHOOK_URL` em `App.tsx`
- Envia mensagem no formato:
  ```
  ✅ *Auditoria concluída!*
  📊 N histórias processadas.
  🔗 https://storyanalyst-ai.netlify.app
  ```
- Executado via `sendWebhook(count)` ao final de cada lote bem-sucedido

## Persistência local (localStorage)

| Chave | Conteúdo |
|-------|----------|
| `storyanalyst_use_free` | Booleano — modelo Free (true) ou DeepSeek V3 (false) |
| `storyanalyst_last_usage` | JSON `{ model, tokens, cost }` da última consulta |
| `storyanalyst_owners_list` | Array de nomes de agilistas (com CRUD no dropdown) |
| `storyanalyst_dark` | Booleano — dark mode ativo (true) ou light mode (false) |

## CI/CD (Netlify)

- **Build command**: `npm run build` (gera `dist/`)
- **Publish directory**: `dist`
- **SPA redirect**: `/*` → `/index.html` (status 200)
- **Variável obrigatória**: `OPENROUTER_API_KEY`
- **Deploy automático**: conectado ao repositório GitHub, deploya a cada push na `main`

## Pontos de retorno

| Tag | Descrição |
|-----|-----------|
| `v1.0-stable` | Versão anterior ao batching. Commits: 73ed538 (docs), 55b302f (chime), 2174fa0 (notificações). |

### Commits principais após `v1.0-stable`

| Commit | Descrição |
|--------|-----------|
| `9c83d8c` | Batching de múltiplas histórias com tiered retry |
| `3242902` | Glossário de termos + redesign com paleta `#ff5500` |
| `06cacdd` | Dark mode com CSS variables e toggle |

Para reverter: `git checkout <tag>` ou `git reset --hard <hash>`

## Créditos e dependências

- **OpenRouter**: API de modelos de IA
- **Firebase**: Google Firestore (banco de dados)
- **Lucide React**: Ícones
- **Recharts**: Gráficos
- **XLSX (SheetJS)**: Manipulação de planilhas
- **Tailwind CSS** (CDN Play): Estilização com dark mode via class
- **Vite**: Build tool
