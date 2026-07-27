
import React, { useState, useEffect, useRef } from 'react';
import { AnalysisResult } from '../types';
import { Save, Check, User, Edit2, Sparkles, Hash, ChevronDown, Search, Star, HelpCircle, ThumbsUp, ThumbsDown } from 'lucide-react';
import { saveReferenceStory, removeReferenceStory } from '../utils/storage';

interface AnalysisCardProps {
  result: AnalysisResult;
  onSave?: (result: AnalysisResult) => void;
  onUpdate?: (result: AnalysisResult) => void;
  isSaved?: boolean;
  availableOwners?: string[];
  showReferenceToggle?: boolean; // Novo prop para habilitar o toggle de referência
}

const ScoreSelector = ({ currentScore, onChange, label }: { currentScore: number; onChange: (val: number) => void; label: string; }) => {
  return (
    <div className="flex flex-col items-center p-4 rounded-3xl bg-slate-50 border border-slate-100 min-w-[120px] transition-all hover:bg-white hover:shadow-xl hover:shadow-slate-200/50">
      <span className="text-[10px] font-black uppercase text-slate-400 mb-4 tracking-widest">{label}</span>
      <div className="flex gap-2">
        {[0, 1, 3].map((val) => {
          const isActive = currentScore === val;
          let activeColor = 'bg-slate-200 text-slate-500';
          if (isActive) {
             if (val === 3) activeColor = 'bg-blue-600 text-white shadow-lg shadow-blue-200';
             else if (val === 1) activeColor = 'bg-amber-500 text-white shadow-lg shadow-amber-200';
             else activeColor = 'bg-rose-500 text-white shadow-lg shadow-rose-200';
          }
          return (
            <button
              key={val}
              onClick={() => onChange(val)}
              className={`w-10 h-10 rounded-2xl text-xs font-black transition-all transform hover:scale-110 active:scale-90 ${activeColor} ${!isActive ? 'hover:bg-slate-300' : ''}`}
            >
              {val}
            </button>
          );
        })}
      </div>
    </div>
  );
};

const AnalysisCard: React.FC<AnalysisCardProps> = ({ result, onSave, onUpdate, isSaved = false, availableOwners = [], showReferenceToggle = true }) => {
  const [currentOwner, setCurrentOwner] = useState(result.owner || '');
  const [hasSavedLocally, setHasSavedLocally] = useState(false);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [search, setSearch] = useState('');
  
  // Estado local para referência
  const [isReference, setIsReference] = useState(result.isReference || false);

  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setCurrentOwner(result.owner || '');
  }, [result.owner]);

  useEffect(() => {
    setIsReference(result.isReference || false);
  }, [result.isReference]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const isPerfect = result.totalScore === 9;
  const isGood = result.totalScore >= 6;
  let borderColor = isPerfect ? 'border-blue-200' : isGood ? 'border-amber-100' : 'border-rose-100';
  let shadowColor = isPerfect ? 'shadow-blue-500/10' : isGood ? 'shadow-amber-500/5' : 'shadow-rose-500/5';

  const handleSaveClick = () => {
    if (onSave) {
      onSave({ ...result, owner: currentOwner });
      setHasSavedLocally(true);
    }
  };

  const handleScoreChange = (criteria: 'persona' | 'action' | 'structure', newVal: number) => {
    if (!onUpdate) return;
    const newCriteriaScores = { ...result.criteriaScores, [criteria]: newVal };
    const newTotal = newCriteriaScores.persona + newCriteriaScores.action + newCriteriaScores.structure;
    onUpdate({ ...result, criteriaScores: newCriteriaScores, totalScore: newTotal, owner: currentOwner });
  };

  const handleSelectOwner = (name: string) => {
    setCurrentOwner(name);
    setIsDropdownOpen(false);
    if (onUpdate && name !== result.owner) {
        onUpdate({ ...result, owner: name });
    }
  };

  const toggleReference = async () => {
    const newState = !isReference;
    setIsReference(newState);
    
    // Atualiza o objeto result localmente e propaga update
    const updatedResult = { ...result, isReference: newState, owner: currentOwner };
    
    try {
      if (newState) {
        await saveReferenceStory(updatedResult);
      } else {
        if (updatedResult.id) await removeReferenceStory(updatedResult.id);
      }
      if (onUpdate) onUpdate(updatedResult);
    } catch (error) {
      console.error("Failed to toggle reference", error);
      setIsReference(!newState); // Rollback
      alert("Erro ao atualizar base de conhecimento.");
    }
  };

  const handleDoubtResolution = (isPositive: boolean) => {
    if (!onUpdate) return;

    // LÓGICA DE APRENDIZADO:
    // Movemos a resolução da dúvida para dentro do texto de FEEDBACK.
    // Assim, se essa estória for salva como REFERÊNCIA (Star), a IA lerá este feedback no futuro
    // e "aprenderá" que aquela suposição estava correta ou incorreta.
    
    const contextPrefix = isPositive ? "✅ APRENDIZADO CONFIRMADO:" : "❌ CORREÇÃO DE CONTEXTO:";
    const resolutionText = `${contextPrefix} Sobre a dúvida "${result.uncertaintyNote}", o usuário indicou que a interpretação da IA estava ${isPositive ? 'CORRETA' : 'INCORRETA'}.`;

    const newFeedback = `${result.feedback}\n\n${resolutionText}`;

    onUpdate({
        ...result,
        feedback: newFeedback,
        uncertaintyNote: undefined // Remove o alerta visual, pois foi resolvido e incorporado ao conhecimento
    });
  };

  const showSaveSuccess = isSaved || hasSavedLocally;
  const filteredOwners = availableOwners.filter(o => o.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className={`bg-white rounded-[40px] shadow-2xl border-2 ${borderColor} ${shadowColor} p-10 mb-8 transition-all duration-500 hover:shadow-blue-500/5 relative group overflow-hidden`}>
      {isPerfect && <div className="absolute top-0 right-0 p-4 bg-blue-600 text-white rounded-bl-[40px] shadow-lg animate-pulse"><Sparkles size={24} /></div>}
      
      {/* Doubt/Uncertainty Alert with Learning Buttons */}
      {result.uncertaintyNote && (
        <div className="mb-6 p-5 bg-amber-50 border border-amber-200 rounded-2xl flex flex-col md:flex-row items-start gap-4 animate-in fade-in slide-in-from-top-2 shadow-sm">
            <HelpCircle className="text-amber-500 mt-1 flex-shrink-0" size={24} />
            <div className="flex-1">
                <p className="text-xs font-black uppercase text-amber-600 mb-1 tracking-widest">A IA tem uma dúvida</p>
                <p className="text-base text-amber-900 font-medium leading-relaxed">"{result.uncertaintyNote}"</p>
                <p className="text-[10px] text-amber-600 mt-2 italic">Ajude a IA a aprender confirmando ou corrigindo esta suposição.</p>
                
                <div className="flex items-center gap-3 mt-4">
                    <button 
                        onClick={() => handleDoubtResolution(true)}
                        className="flex items-center gap-2 px-4 py-2 bg-emerald-100 text-emerald-700 rounded-xl text-xs font-bold hover:bg-emerald-200 transition-colors border border-emerald-200 active:scale-95"
                    >
                        <ThumbsUp size={14} /> Sim, está correto
                    </button>
                    <button 
                        onClick={() => handleDoubtResolution(false)}
                        className="flex items-center gap-2 px-4 py-2 bg-rose-100 text-rose-700 rounded-xl text-xs font-bold hover:bg-rose-200 transition-colors border border-rose-200 active:scale-95"
                    >
                        <ThumbsDown size={14} /> Não, incorreto
                    </button>
                </div>
            </div>
        </div>
      )}

      <div className="flex flex-col lg:flex-row justify-between gap-12">
        <div className="flex-1 space-y-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="relative" ref={dropdownRef}>
                <button 
                  onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                  className="flex items-center gap-3 text-slate-500 bg-slate-50 px-5 py-2.5 rounded-full border border-slate-100 hover:border-blue-400 transition-all group/btn"
                >
                  <User size={16} className={currentOwner ? "text-blue-500" : "text-slate-400"} />
                  <span className="font-bold text-slate-700 text-[11px] uppercase tracking-wider">
                    {currentOwner || "Agilista"}
                  </span>
                  <ChevronDown size={14} className={`text-slate-400 transition-transform ${isDropdownOpen ? 'rotate-180' : ''}`} />
                </button>

                {isDropdownOpen && (
                  <div className="absolute top-full left-0 mt-2 w-64 bg-white border border-slate-200 rounded-2xl shadow-2xl z-50 overflow-hidden animate-in fade-in slide-in-from-top-2">
                    <div className="p-2 border-b border-slate-100 bg-slate-50 flex items-center gap-2">
                      <Search size={12} className="text-slate-400" />
                      <input 
                        autoFocus
                        className="bg-transparent border-none outline-none text-[10px] font-bold text-slate-600 w-full"
                        placeholder="Filtrar..."
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                      />
                    </div>
                    <div className="max-h-48 overflow-y-auto">
                      {filteredOwners.map(o => (
                        <div 
                          key={o}
                          onClick={() => handleSelectOwner(o)}
                          className={`px-4 py-2 text-[10px] font-bold text-slate-600 hover:bg-blue-50 cursor-pointer ${currentOwner === o ? 'text-blue-600 bg-blue-50/30' : ''}`}
                        >
                          {o}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
              
              {/* Reference Toggle */}
              {showReferenceToggle && (
                <button 
                    onClick={toggleReference}
                    title={isReference ? "Remover da Base de Conhecimento" : "Salvar como Exemplo de Ouro"}
                    className={`flex items-center gap-2 px-3 py-2 rounded-full border transition-all ${
                        isReference 
                        ? "bg-yellow-50 border-yellow-200 text-yellow-600" 
                        : "bg-slate-50 border-slate-100 text-slate-400 hover:text-yellow-500"
                    }`}
                >
                    <Star size={16} fill={isReference ? "currentColor" : "none"} />
                    {isReference && <span className="text-[10px] font-black uppercase tracking-widest">Referência</span>}
                </button>
              )}
            </div>
            
            {result.id && <div className="flex items-center gap-1.5 text-[10px] font-black text-slate-300 tracking-widest uppercase bg-slate-50 px-3 py-1.5 rounded-full border border-slate-100"><Hash size={10} /> {result.id}</div>}
          </div>

          <div className="space-y-3">
            <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-slate-300"></div> Entrada Original</h4>
            <div className="text-slate-800 font-bold italic bg-slate-50 p-6 rounded-[30px] border border-slate-100 text-xl leading-relaxed shadow-inner group-hover:bg-white transition-colors duration-500">"{result.originalStory}"</div>
          </div>

          <div className="space-y-3">
            <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-indigo-400"></div> Diagnóstico Técnico</h4>
            <p className="text-slate-600 text-base leading-relaxed font-semibold pl-4 border-l-2 border-slate-100 whitespace-pre-line">{result.feedback}</p>
          </div>

          {(!isPerfect || result.improvedVersion) && (
            <div className="space-y-4 pt-2">
              <h4 className="text-[10px] font-black text-blue-600 uppercase tracking-[0.2em] flex items-center gap-2"><Sparkles size={16} /> Refino Sugerido</h4>
              <div className="text-blue-900 bg-blue-50/50 p-7 rounded-[30px] border-2 border-blue-100 text-xl font-black leading-relaxed shadow-sm">"{result.improvedVersion}"</div>
            </div>
          )}
        </div>

        <div className="flex flex-col justify-between min-w-[280px] border-l-2 border-slate-50 pl-0 lg:pl-12 pt-8 lg:pt-0 gap-8">
          <div className="space-y-8">
            <div className="text-center p-8 rounded-[40px] bg-slate-50/80 border border-slate-100 shadow-inner group-hover:bg-white transition-colors duration-500">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 block">Score de Auditoria</span>
              <div className={`text-8xl font-black italic transition-all transform group-hover:scale-110 ${isPerfect ? 'text-blue-600' : isGood ? 'text-amber-500' : 'text-rose-500'}`}>{result.totalScore}<span className="text-3xl text-slate-300 not-italic ml-1">/9</span></div>
            </div>
            <div className="grid grid-cols-1 gap-4">
              <ScoreSelector label="Persona" currentScore={result.criteriaScores.persona} onChange={(val) => handleScoreChange('persona', val)} />
              <ScoreSelector label="Ação" currentScore={result.criteriaScores.action} onChange={(val) => handleScoreChange('action', val)} />
              <ScoreSelector label="Estrutura" currentScore={result.criteriaScores.structure} onChange={(val) => handleScoreChange('structure', val)} />
            </div>
          </div>
          {onSave && (
            <button onClick={handleSaveClick} disabled={showSaveSuccess} className={`w-full py-5 px-8 rounded-3xl font-black text-[11px] uppercase tracking-[0.2em] flex items-center justify-center gap-4 transition-all transform active:scale-95 ${showSaveSuccess ? 'bg-emerald-50 text-emerald-600 border-2 border-emerald-100' : 'bg-slate-900 hover:bg-black text-white shadow-2xl'}`}>
              {showSaveSuccess ? <><Check size={20} /> Protocolado</> : <><Save size={20} /> Salvar Auditoria</>}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default AnalysisCard;
