# StoryAnalyst AI

App de auditoria de histórias de usuário usando IA, baseado na metodologia Marcos Inácio.

## Arquitetura

- **Frontend**: React + TypeScript + Vite + Tailwind
- **Banco**: Firebase Firestore (histórico + base de conhecimento)
- **IA**: OpenRouter (DeepSeek V3 / Llama 3.1 70B / Free)
- **Hospedagem**: Netlify

## Funcionalidades

- Análise individual de histórias de usuário
- Importação em lote via planilha XLSX
- Pontuação por critérios (Persona, Ação, Estrutura)
- Dashboard com gráficos e médias
- Histórico de análises com filtros
- Base de Conhecimento (Few-Shot Learning para a IA)
- Exportação para XLSX
- Seletor de modelo Free / DeepSeek V3

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
- (Opcional) Conta no Firebase para histórico e base de conhecimento

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
│   ├── AnalysisCard.tsx  # Card de resultado da análise
│   ├── Dashboard.tsx     # Gráficos de desempenho
│   ├── HistoryView.tsx   # Visualização do histórico
│   └── KnowledgeBase.tsx # Base de conhecimento (exemplos de ouro)
├── services/
│   ├── aiService.ts      # Integração com OpenRouter
│   └── firebase.ts       # Configuração do Firebase
├── utils/
│   ├── fileParser.ts     # Parse de arquivos XLSX
│   └── storage.ts        # CRUD no Firebase Firestore
├── App.tsx               # Componente principal
├── types.ts              # Tipos TypeScript
└── vite.config.ts        # Configuração do Vite
```

## Como funciona a análise

1. O usuário insere uma história de usuário (ou faz upload de planilha)
2. A IA recebe um prompt com:
   - Instruções do sistema (metodologia Marcos Inácio)
   - Exemplos da Base de Conhecimento (Few-Shot Learning)
   - A história a ser analisada
3. A IA retorna um JSON com:
   - Notas para Persona (0/1/3), Ação (0/1/3), Estrutura (0/1/3)
   - Total (0-9)
   - Feedback técnico
   - Versão melhorada da história
   - Nota de incerteza (se aplicável)
4. O usuário pode ajustar as notas, salvar no histórico e marcar como "exemplo de ouro"

## Créditos e dependências

- **OpenRouter**: API de modelos de IA
- **Firebase**: Google Firestore (banco de dados)
- **Lucide React**: Ícones
- **Recharts**: Gráficos
- **XLSX (SheetJS)**: Manipulação de planilhas
- **Tailwind CSS**: Estilização
- **Vite**: Build tool
