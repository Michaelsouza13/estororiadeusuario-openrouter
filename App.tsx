
import React, { useState, useRef, useEffect } from 'react';
import { analyzeStory } from './services/aiService';
import { parseFile } from './utils/fileParser';
import { AnalysisResult, AnalysisStatus } from './types';
import { 
  fetchHistoryFromFirebase, 
  saveToHistoryFirebase, 
  clearHistoryFirebase, 
  deleteFromHistoryFirebase,
  isStoryAnalyzed, 
  getCurrentQuarter, 
  getUniqueOwners 
} from './utils/storage';
import { signInAnonymously } from 'firebase/auth';
import { auth } from './services/firebase';
import AnalysisCard from './components/AnalysisCard';
import Dashboard from './components/Dashboard';
import HistoryView from './components/HistoryView';
import KnowledgeBase from './components/KnowledgeBase';
import { 
  BookOpen, Upload, Play, Loader2, Download, AlertCircle, 
  FileText, History, User, Shuffle, UserCheck, Search, 
  Plus, Pencil, Trash2, X, Check, ChevronDown, Edit2, Star, Settings 
} from 'lucide-react';
import * as XLSX from 'xlsx';

const INITIAL_OWNERS = [
  "LAURO SANDSON AGRA DA SILVA",
  "ANNA BEATRIZ GUIMARÃES DE ARAÚJO",
  "PRISCILA ARENE DE JESUS URQUIZA",
  "MARIA LUIZA FELICIANO DA SILVA",
  "FELIPE MARTINES MOREIRA DE LIMA",
  "HIGOR ALMEIDA DE LIRA RAMALHO",
  "ANA BARBARA NASCIMENTO DOS SANTOS",
  "RAIMUNDO LUIZ QUEIROGA DE OLIVEIRA",
  "RANDERSOM LOPES FERNANDES",
  "DIEGO DE SOUSA PAULINO",
  "MARCOS ANTONIO INACIO DA SILVA",
  "HELLEN KATHERINE CLEMENTINO DOS SANTOS",
  "THAIS BARBOSA DELFINO",
  "KADJESSICA DO NASCIMENTO SOARES",
  "WILLIAN CAVALCANTE SIQUEIRA",
  "LUDMYLLA DE MELO FERREIRA",
  "DANIEL VITOR MOREIRA PEDROZA",
  "VALESKA LEITAO GUEDES",
  "ANA DANIELLA FECHINE LEITE",
  "PATRICIA EMMANUELLE DANTAS DE MELO BELINO SANTANA",
  "ANTONIO MARCO ARRUDA DONATO",
  "REBECA DUTRA VARELA",
  "NÁRRIMAN XAVIER DA COSTA E INÁCIO",
  "HUGO ALEXANDRE ROCHA MAGALHÃES",
  "ALLANA MARIA DA SILVA LOPES",
  "ANTONIO CORREIA LIMA NETO",
  "GITANA SOARES DE MELLO E SILVA PARENTE BARBOSA",
  "JOYCE CABRAL DOS REIS BORGES",
  "GECIANE APARECIDA DA SILVA",
  "MARIA EDUARDA RIBEIRO DE SOUZA",
  "MATHEUS FELIPE BASTOS GUIMARAES",
  "RAISA FERNANDES DE MELO",
  "FELIX ANTONIO MARTINS DE ARAUJO SOUSA",
  "BRUNO DE LIMA SANTOS",
  "ZAYRA XAVIER DE LIMA",
  "ALCIDES TOTA JUNIOR"
].sort();

const STORAGE_KEY_OWNERS = 'storyanalyst_owners_list';

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'single' | 'bulk' | 'history' | 'knowledge'>('single');
  const [inputText, setInputText] = useState('');
  const [defaultOwner, setDefaultOwner] = useState('');
  const [agilistas, setAgilistas] = useState<string[]>([]);
  const [status, setStatus] = useState<AnalysisStatus>(AnalysisStatus.IDLE);
  const [results, setResults] = useState<AnalysisResult[]>([]);
  const [historyData, setHistoryData] = useState<AnalysisResult[]>([]);
  const [bulkProgress, setBulkProgress] = useState({ current: 0, total: 0, skipped: 0 });
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [searchOwner, setSearchOwner] = useState('');
  const [editingOwnerIndex, setEditingOwnerIndex] = useState<number | null>(null);
  const [editingValue, setEditingValue] = useState('');
  const [newOwnerValue, setNewOwnerValue] = useState('');
  const [samplingRate, setSamplingRate] = useState(40); // Padrão 40%
  
  const dropdownRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY_OWNERS);
    if (saved) {
      setAgilistas(JSON.parse(saved));
    } else {
      setAgilistas(INITIAL_OWNERS);
    }
  }, []);

  useEffect(() => {
    if (agilistas.length > 0) {
      localStorage.setItem(STORAGE_KEY_OWNERS, JSON.stringify(agilistas));
    }
  }, [agilistas]);

  useEffect(() => {
    const loadHistory = async () => {
      setIsLoadingHistory(true);
      try {
        try {
           await signInAnonymously(auth);
        } catch (authErr) {
           console.warn("Autenticação anônima falhou.", authErr);
        }
        const data = await fetchHistoryFromFirebase();
        setHistoryData(data);
      } catch (error) {
        console.error("Failed to load history", error);
      } finally {
        setIsLoadingHistory(false);
      }
    };
    loadHistory();
  }, []);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
        setEditingOwnerIndex(null);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleAddOwner = () => {
    if (newOwnerValue.trim() && !agilistas.includes(newOwnerValue.trim())) {
      const newList = [...agilistas, newOwnerValue.trim()].sort();
      setAgilistas(newList);
      setNewOwnerValue('');
    }
  };

  const handleDeleteOwner = (e: React.MouseEvent, name: string) => {
    e.stopPropagation();
    if (window.confirm(`Excluir "${name}" da lista de agilistas?`)) {
      setAgilistas(agilistas.filter(o => o !== name));
      if (defaultOwner === name) setDefaultOwner('');
    }
  };

  const handleStartEdit = (e: React.MouseEvent, index: number, name: string) => {
    e.stopPropagation();
    setEditingOwnerIndex(index);
    setEditingValue(name);
  };

  const handleSaveEdit = (e: React.MouseEvent, oldName: string) => {
    e.stopPropagation();
    if (editingValue.trim() && editingValue !== oldName) {
      const newList = agilistas.map(o => o === oldName ? editingValue.trim() : o).sort();
      setAgilistas(newList);
      if (defaultOwner === oldName) setDefaultOwner(editingValue.trim());
    }
    setEditingOwnerIndex(null);
  };

  const filteredAgilistas = agilistas.filter(o => 
    o.toLowerCase().includes(searchOwner.toLowerCase())
  );

  const handleSingleAnalysis = async () => {
    if (!inputText.trim()) return;
    setStatus(AnalysisStatus.LOADING);
    setResults([]); 
    try {
      const result = await analyzeStory(inputText);
      const fullResult: AnalysisResult = {
        ...result,
        date: new Date().toLocaleDateString('pt-BR'),
        quarter: getCurrentQuarter(),
        owner: defaultOwner || '', 
        id: `MANUAL-${Date.now()}`
      };
      setResults([fullResult]);
      setStatus(AnalysisStatus.SUCCESS);
    } catch (error) {
      console.error(error);
      setStatus(AnalysisStatus.ERROR);
    }
  };

  const handleManualSave = async (result: AnalysisResult) => {
     try {
       await saveToHistoryFirebase([result]);
       setHistoryData(prev => {
         const exists = prev.findIndex(p => p.id === result.id);
         if (exists !== -1) {
            const newHist = [...prev];
            newHist[exists] = result;
            return newHist;
         }
         return [...prev, result];
       });
     } catch (e) {
       console.error("Error saving manual result", e);
       alert("Erro ao salvar no banco de dados.");
     }
  };

  const handleResultUpdate = async (updatedResult: AnalysisResult) => {
    setResults(prev => prev.map(r => r.id === updatedResult.id ? updatedResult : r));
    if (activeTab === 'bulk') {
        try {
            await saveToHistoryFirebase([updatedResult]);
            setHistoryData(prev => prev.map(h => h.id === updatedResult.id ? updatedResult : h));
        } catch (e) {
            console.error("Error updating bulk result", e);
        }
    }
  };

  const handleClearHistory = async () => {
    if (window.confirm('Tem certeza que deseja apagar todo o histórico? (Isso NÃO apaga a Base de Conhecimento)')) {
      try {
          await clearHistoryFirebase();
          setHistoryData([]);
      } catch (e) {
          console.error(e);
          alert("Erro ao limpar histórico.");
      }
    }
  };

  const handleDeleteSelected = async (ids: string[]) => {
    if (window.confirm(`Tem certeza que deseja excluir ${ids.length} itens?`)) {
      try {
          await deleteFromHistoryFirebase(ids);
          setHistoryData(prev => prev.filter(item => !ids.includes(item.id || '')));
      } catch (e) {
          console.error(e);
          alert("Erro ao excluir itens.");
      }
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.name.toLowerCase().endsWith('.xlsx')) {
        alert(
            `Arquivo inserido: "${file.name}"\n` +
            `Tipo não aceito. Por favor, insira um arquivo no formato .XLSX.\n\n` +
            `NOTA: Verifique no PMI se o arquivo foi baixado e exportado corretamente. ` +
            `Há relatos de que, ao selecionar a opção de exportação em .XLS no PMI, o sistema está exportando em .XLSX, e vice-versa.`
        );
        if (fileInputRef.current) fileInputRef.current.value = "";
        return;
    }

    setStatus(AnalysisStatus.LOADING);
    setResults([]);
    setBulkProgress({ current: 0, total: 0, skipped: 0 });
    try {
      const allRows = await parseFile(file);
      if (allRows.length === 0) {
        setStatus(AnalysisStatus.IDLE);
        alert("Nenhuma estória válida encontrada nas colunas D (ID) e G (Estória).");
        if (fileInputRef.current) fileInputRef.current.value = "";
        return;
      }
      const totalInFile = allRows.length;
      // Taxa de amostragem configurável
      const sampleSize = Math.max(1, Math.ceil(totalInFile * (samplingRate / 100)));
      const shuffled = [...allRows].sort(() => 0.5 - Math.random());
      const sampledRows = shuffled.slice(0, sampleSize);
      
      const rowsToProcess = sampledRows.filter(row => !isStoryAnalyzed(historyData, row.id, row.owner || defaultOwner));
      
      const skippedCount = sampledRows.length - rowsToProcess.length;
      setBulkProgress({ current: 0, total: rowsToProcess.length, skipped: skippedCount });
      
      if (rowsToProcess.length === 0) {
        setStatus(AnalysisStatus.IDLE);
        alert(`A amostragem selecionou ${sampledRows.length} itens (${samplingRate}%), mas todos já constam no histórico e foram ignorados.`);
        if (fileInputRef.current) fileInputRef.current.value = "";
        return;
      }
      
      const newResults: AnalysisResult[] = [];
      const batchSize = 3; 
      for (let i = 0; i < rowsToProcess.length; i += batchSize) {
        const batch = rowsToProcess.slice(i, i + batchSize);
        const batchResults = await Promise.all(batch.map(row => analyzeStory(row.story).then(res => ({
            ...res,
            id: row.id,
            owner: row.owner || defaultOwner,
            date: new Date().toLocaleDateString('pt-BR'),
            quarter: getCurrentQuarter()
        }))));
        newResults.push(...batchResults);
        await saveToHistoryFirebase(batchResults);
        setHistoryData(prev => [...prev, ...batchResults]);
        setResults([...newResults]); 
        setBulkProgress(prev => ({ ...prev, current: Math.min(i + batchSize, rowsToProcess.length) }));
        if (i + batchSize < rowsToProcess.length) await new Promise(r => setTimeout(r, 2000));
      }
      setStatus(AnalysisStatus.SUCCESS);
    } catch (error) {
      console.error(error);
      setStatus(AnalysisStatus.ERROR);
    } finally {
        if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleExportCurrent = () => {
    const wsData = results.map(r => ({
      'ID': r.id,
      'Data': r.date,
      'Trimestre': r.quarter,
      'Agilista': r.owner,
      'História Original': r.originalStory,
      'Nota Total': r.totalScore,
      'Persona (Nota)': r.criteriaScores.persona,
      'Ação (Nota)': r.criteriaScores.action,
      'Estrutura (Nota)': r.criteriaScores.structure,
      'Feedback Técnico': r.feedback,
      'Versão Melhorada': r.improvedVersion
    }));

    const ws = XLSX.utils.json_to_sheet(wsData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Resultados");
    
    const dateStr = new Date().toLocaleDateString('pt-BR').replace(/\//g, '-');
    const ownerName = defaultOwner.trim() || 'Relatorio Geral';
    const fileName = `${ownerName} - ${dateStr}.xlsx`;
    
    XLSX.writeFile(wb, fileName);
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 pb-20">
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="bg-blue-600 p-2 rounded-lg text-white shadow-lg shadow-blue-100">
              <BookOpen size={20} />
            </div>
            <h1 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-700 to-blue-500">
              StoryAnalyst AI
            </h1>
          </div>
          <div className="flex bg-gray-100 p-1 rounded-lg">
            {['single', 'bulk', 'history', 'knowledge'].map((tab) => (
              <button
                key={tab}
                onClick={() => { setActiveTab(tab as any); if (tab !== 'history' && tab !== 'knowledge') setResults([]); }}
                className={`px-4 py-1.5 text-sm font-medium rounded-md transition-all flex items-center gap-2 ${activeTab === tab ? 'bg-white shadow-sm text-blue-700' : 'text-gray-500 hover:text-gray-700'}`}
              >
                {tab === 'history' && <History size={16} />}
                {tab === 'knowledge' && <Star size={16} />}
                {tab === 'single' ? 'Entrada Única' : tab === 'bulk' ? 'Upload em Lote' : tab === 'history' ? 'Histórico' : 'Base de Conhecimento'}
              </button>
            ))}
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 mt-8">
        
        {/* TOPO: Título e Seletor de Agilista (Oculto em Knowledge Base) */}
        {activeTab !== 'history' && activeTab !== 'knowledge' && (
          <section className="mb-8 flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="text-left flex-1">
              <h2 className="text-3xl font-extrabold text-slate-800 mb-2 tracking-tight">Auditoria de Requisitos</h2>
              <p className="text-slate-500 max-w-lg font-medium leading-relaxed">
                Refine seu backlog com inteligência baseada na metodologia Marcos Inácio.
              </p>
              <div className="mt-3 flex items-center gap-2">
                <span className="text-[10px] uppercase font-bold tracking-widest bg-blue-600 text-white px-2 py-0.5 rounded shadow-sm">
                  {getCurrentQuarter()}
                </span>
                <span className="text-[10px] uppercase font-bold tracking-widest bg-slate-200 text-slate-600 px-2 py-0.5 rounded">
                  MARCOS INÁCIO ADVOGADOS
                </span>
              </div>
            </div>

            <div className="w-full md:w-auto relative" ref={dropdownRef}>
              <div className="bg-white p-4 rounded-2xl border border-gray-200 shadow-xl shadow-blue-500/5 flex flex-col gap-2 min-w-[320px]">
                <div className="flex items-center justify-between mb-1">
                   <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Agilista Responsável</label>
                   {defaultOwner && <div className="flex items-center gap-1 text-[10px] font-bold text-green-600 uppercase animate-pulse"><UserCheck size={10}/> Conectado</div>}
                </div>
                
                <button 
                  onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                  className="w-full flex items-center justify-between px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl transition-all hover:border-blue-300 group"
                >
                  <div className="flex items-center gap-3">
                    <User size={18} className={defaultOwner ? "text-blue-500" : "text-slate-400"} />
                    <span className={`font-bold ${defaultOwner ? "text-slate-700" : "text-slate-400"}`}>
                      {defaultOwner || "Selecione seu nome..."}
                    </span>
                  </div>
                  <ChevronDown size={18} className={`text-slate-400 transition-transform ${isDropdownOpen ? 'rotate-180' : ''}`} />
                </button>

                {isDropdownOpen && (
                  <div className="absolute top-full left-0 right-0 mt-2 bg-white border border-slate-200 rounded-2xl shadow-2xl z-50 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
                    <div className="p-3 border-b border-slate-100 flex items-center gap-2 bg-slate-50">
                      <Search size={14} className="text-slate-400" />
                      <input 
                        type="text" 
                        placeholder="Buscar agilista..."
                        className="bg-transparent border-none outline-none text-xs font-bold text-slate-600 w-full placeholder-slate-300"
                        value={searchOwner}
                        onChange={(e) => setSearchOwner(e.target.value)}
                        autoFocus
                      />
                    </div>
                    
                    <div className="max-h-[300px] overflow-y-auto py-1">
                      {filteredAgilistas.map((name, idx) => (
                        <div 
                          key={name}
                          onClick={() => { if (editingOwnerIndex === null) { setDefaultOwner(name); setIsDropdownOpen(false); } }}
                          className={`flex items-center justify-between px-4 py-2.5 hover:bg-blue-50 cursor-pointer group/item ${defaultOwner === name ? 'bg-blue-50/50' : ''}`}
                        >
                          {editingOwnerIndex === idx ? (
                            <div className="flex items-center gap-2 flex-1" onClick={e => e.stopPropagation()}>
                               <input 
                                 className="flex-1 bg-white border border-blue-300 rounded px-2 py-1 text-xs font-bold outline-none"
                                 value={editingValue}
                                 onChange={e => setEditingValue(e.target.value)}
                                 autoFocus
                               />
                               <button onClick={e => handleSaveEdit(e, name)} className="text-green-600 p-1"><Check size={14}/></button>
                               <button onClick={e => { e.stopPropagation(); setEditingOwnerIndex(null); }} className="text-slate-400 p-1"><X size={14}/></button>
                            </div>
                          ) : (
                            <>
                              <span className={`text-xs font-bold ${defaultOwner === name ? 'text-blue-600' : 'text-slate-600'}`}>{name}</span>
                              <div className="flex items-center gap-1 opacity-0 group-hover/item:opacity-100 transition-opacity">
                                <button onClick={e => handleStartEdit(e, idx, name)} className="p-1.5 text-slate-400 hover:text-blue-500 hover:bg-blue-100 rounded-lg transition-all"><Pencil size={12}/></button>
                                <button onClick={e => handleDeleteOwner(e, name)} className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-100 rounded-lg transition-all"><Trash2 size={12}/></button>
                              </div>
                            </>
                          )}
                        </div>
                      ))}
                      {filteredAgilistas.length === 0 && (
                        <div className="px-4 py-8 text-center text-slate-400 text-xs italic">Nenhum agilista encontrado</div>
                      )}
                    </div>

                    <div className="p-3 border-t border-slate-100 bg-slate-50/50 flex items-center gap-2">
                      <input 
                        placeholder="Novo Agilista..."
                        className="flex-1 bg-white border border-slate-200 rounded-lg px-3 py-2 text-[10px] font-black uppercase outline-none focus:border-blue-400 transition-all"
                        value={newOwnerValue}
                        onChange={e => setNewOwnerValue(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && handleAddOwner()}
                      />
                      <button 
                        onClick={handleAddOwner}
                        className="bg-blue-600 text-white p-2 rounded-lg hover:bg-blue-700 transition-all shadow-lg shadow-blue-200 active:scale-90"
                      >
                        <Plus size={14} />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </section>
        )}

        {/* ÁREA DE CONTEÚDO PRINCIPAL (INPUTS) */}
        {activeTab === 'single' && (
          <section className="animate-in fade-in duration-500 max-w-3xl mx-auto">
             <div className="bg-white p-6 rounded-3xl shadow-xl border border-blue-100 mb-8 relative overflow-hidden group">
               <div className="absolute top-0 left-0 w-2 h-full bg-blue-600"></div>
               <h3 className="text-lg font-black text-slate-800 mb-4 flex items-center gap-2 uppercase tracking-wide">
                 <Edit2 size={20} className="text-blue-500" /> Analisador de Estória
               </h3>
               <textarea 
                 className="w-full h-40 p-5 rounded-2xl bg-slate-50 border-2 border-slate-100 focus:border-blue-400 focus:bg-white outline-none transition-all resize-none text-slate-700 font-medium text-lg placeholder-slate-400 leading-relaxed shadow-inner"
                 placeholder="Cole aqui sua estória de usuário (ex: Como usuário, quero...)"
                 value={inputText}
                 onChange={(e) => setInputText(e.target.value)}
               />
               <div className="mt-4 flex justify-end">
                 <button 
                   onClick={handleSingleAnalysis} 
                   disabled={status === AnalysisStatus.LOADING || !inputText.trim()}
                   className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-4 rounded-2xl font-black text-xs uppercase tracking-[0.15em] flex items-center gap-3 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-blue-200 active:scale-95 group-hover:shadow-blue-300"
                 >
                   {status === AnalysisStatus.LOADING ? <Loader2 className="animate-spin" size={20} /> : <Play size={20} fill="currentColor" />}
                   {status === AnalysisStatus.LOADING ? 'Analisando...' : 'Executar Auditoria'}
                 </button>
               </div>
             </div>
          </section>
        )}

        {activeTab === 'bulk' && (
          <section className="animate-in fade-in duration-500 max-w-4xl mx-auto">
            <div className="bg-white p-20 rounded-[40px] shadow-2xl border-4 border-dashed border-slate-100 text-center hover:border-blue-300 hover:bg-slate-50 transition-all group cursor-pointer relative mb-12" onClick={() => fileInputRef.current?.click()}>
              <input 
                type="file" 
                ref={fileInputRef} 
                onChange={handleFileUpload} 
                accept=".xlsx" 
                className="hidden" 
              />
              <div className="bg-white w-24 h-24 rounded-3xl flex items-center justify-center mx-auto mb-6 group-hover:scale-110 transition-transform shadow-xl shadow-blue-500/10 border border-slate-100">
                <Upload size={40} className="text-blue-600" />
              </div>
              <h3 className="text-3xl font-black text-slate-800 mb-4 tracking-tight">Importação em Lote</h3>
              <p className="text-slate-400 font-medium max-w-md mx-auto leading-relaxed mb-6 text-sm">
                Auditoria automática de {samplingRate}% das estórias da sua planilha <br/> (Colunas D e G).
              </p>
              
              <button className="bg-white border-2 border-slate-200 text-slate-600 px-10 py-4 rounded-2xl font-black text-xs uppercase tracking-[0.2em] hover:border-blue-500 hover:text-blue-600 transition-all shadow-sm group-hover:shadow-lg mb-8">
                  Selecionar Planilha
              </button>

               <div className="absolute top-8 right-8 inline-flex items-center gap-2 text-[10px] font-black uppercase text-amber-700 bg-amber-50 px-4 py-2 rounded-2xl border border-amber-100 tracking-widest shadow-sm">
                <Shuffle size={14} /> Amostragem: {samplingRate}%
              </div>
              
               {/* Slider de Configuração da Amostragem */}
               <div className="flex flex-col items-center justify-center mt-4 p-4 bg-slate-50 rounded-2xl border border-slate-100 max-w-md mx-auto" onClick={(e) => e.stopPropagation()}>
                  <div className="flex items-center justify-between w-full mb-2 px-2">
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1"><Settings size={12}/> Configurar Taxa</span>
                    <span className="text-sm font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-md border border-blue-100">{samplingRate}%</span>
                  </div>
                  <input 
                    type="range" 
                    min="10" 
                    max="100" 
                    step="10" 
                    value={samplingRate} 
                    onChange={(e) => setSamplingRate(Number(e.target.value))}
                    className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
                  />
                  <div className="flex justify-between w-full text-[9px] text-slate-300 font-bold mt-1 px-1">
                    <span>10%</span>
                    <span>100%</span>
                  </div>
               </div>
            </div>

            {status === AnalysisStatus.LOADING && (
               <div className="max-w-xl mx-auto mb-12">
                 <div className="flex justify-between text-xs font-black uppercase text-slate-500 mb-2 tracking-widest">
                    <span>Processando Lote...</span>
                    <span>{Math.round((bulkProgress.current / bulkProgress.total) * 100)}%</span>
                 </div>
                 <div className="h-4 bg-slate-100 rounded-full overflow-hidden border border-slate-200">
                   <div 
                     className="h-full bg-gradient-to-r from-blue-500 to-indigo-600 transition-all duration-500 ease-out shadow-[0_0_15px_rgba(59,130,246,0.5)]" 
                     style={{ width: `${(bulkProgress.current / bulkProgress.total) * 100}%` }}
                   ></div>
                 </div>
                 <p className="text-center text-xs text-slate-400 mt-3 font-medium">
                   Analisando item {bulkProgress.current} de {bulkProgress.total} 
                   {bulkProgress.skipped > 0 && <span className="text-amber-500 ml-2">({bulkProgress.skipped} ignorados/já existem)</span>}
                 </p>
               </div>
            )}
          </section>
        )}

        {activeTab === 'history' && (
           <HistoryView 
             history={historyData} 
             onClearHistory={handleClearHistory} 
             onDeleteItems={handleDeleteSelected}
           />
        )}

        {activeTab === 'knowledge' && (
           <KnowledgeBase />
        )}

        {results.length > 0 && activeTab !== 'history' && activeTab !== 'knowledge' && (
          <section className="animate-in fade-in slide-in-from-bottom-8 duration-700">
             <div className="flex items-center justify-between mb-8 flex-wrap gap-4">
               <h3 className="text-3xl font-black text-slate-800 flex items-center gap-4 tracking-tighter">
                 <FileText className="text-blue-600" size={32} /> Relatório de Auditoria
               </h3>
               <button onClick={handleExportCurrent} className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-8 py-4 rounded-2xl text-xs font-black uppercase tracking-widest transition-all shadow-xl shadow-emerald-100 active:scale-95">
                 <Download size={20} /> Exportar XLSX
               </button>
             </div>
             {activeTab === 'bulk' && <Dashboard results={results} />}
             <div className="space-y-8">
               {results.map((result, index) => (
                 <AnalysisCard key={index} result={result} onSave={activeTab === 'single' ? handleManualSave : undefined} onUpdate={handleResultUpdate} isSaved={activeTab === 'bulk'} availableOwners={agilistas} />
               ))}
             </div>
          </section>
        )}
        
        {status === AnalysisStatus.ERROR && (
           <div className="max-w-4xl mx-auto p-8 bg-red-50 text-red-700 border-2 border-red-100 rounded-3xl flex items-center gap-6 animate-bounce">
             <div className="bg-red-100 p-4 rounded-2xl text-red-600"><AlertCircle size={32} /></div>
             <div>
                <h4 className="font-black uppercase text-sm mb-1">Erro no Processamento</h4>
                <p className="font-bold text-lg">Houve uma falha na análise. Verifique sua conexão ou tente novamente.</p>
             </div>
           </div>
        )}
      </main>
    </div>
  );
};

export default App;
