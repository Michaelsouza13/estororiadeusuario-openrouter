
import React, { useState, useEffect } from 'react';
import { AnalysisResult } from '../types';
import { fetchReferencesFromFirebase, removeReferenceStory } from '../utils/storage';
import AnalysisCard from './AnalysisCard';
import { Star, Loader2, Info } from 'lucide-react';

const KnowledgeBase: React.FC = () => {
  const [references, setReferences] = useState<AnalysisResult[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadReferences();
  }, []);

  const loadReferences = async () => {
    setIsLoading(true);
    try {
      const data = await fetchReferencesFromFirebase();
      setReferences(data);
    } catch (error) {
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleUpdate = (updatedResult: AnalysisResult) => {
    // Se o usuário desmarcar a estrela dentro do card
    if (!updatedResult.isReference) {
      setReferences(prev => prev.filter(r => r.id !== updatedResult.id));
    } else {
        // Se houver outra atualização
        setReferences(prev => prev.map(r => r.id === updatedResult.id ? updatedResult : r));
    }
  };

  if (isLoading) {
    return <div className="flex justify-center p-20"><Loader2 className="animate-spin text-blue-600" size={40} /></div>;
  }

  return (
    <div className="animate-in fade-in duration-500">
      <div className="bg-gradient-to-r from-yellow-50 to-amber-50 p-8 rounded-3xl border border-yellow-100 mb-8 flex items-start gap-4 shadow-sm">
        <div className="bg-yellow-100 p-3 rounded-full text-yellow-600">
            <Star fill="currentColor" size={24} />
        </div>
        <div>
            <h3 className="text-xl font-black text-yellow-900 mb-2">Base de Conhecimento (Exemplos de Ouro)</h3>
            <p className="text-yellow-800 text-sm leading-relaxed max-w-3xl">
                As histórias listadas abaixo são usadas como <strong>gabarito de aprendizado</strong> para a IA. 
                Sempre que você for realizar uma nova auditoria, o sistema escolherá aleatoriamente alguns destes exemplos 
                para ensinar ao Gemini como você gosta que a análise seja feita (tom de voz, rigor das notas e estilo).
            </p>
            <div className="mt-4 flex items-center gap-2 text-xs font-bold text-yellow-700 bg-yellow-100/50 px-3 py-2 rounded-lg inline-flex">
                <Info size={14} />
                <span>Dica: Mantenha aqui apenas análises com Nota 9 e feedback perfeito para melhores resultados.</span>
            </div>
        </div>
      </div>

      {references.length === 0 ? (
        <div className="text-center py-20 bg-white rounded-[40px] border-2 border-dashed border-slate-200">
           <Star className="mx-auto text-slate-200 mb-4" size={48} />
           <p className="text-slate-400 font-medium">Nenhum exemplo de referência salvo.</p>
           <p className="text-slate-300 text-sm mt-2">Clique na estrela nos cards de análise para adicionar aqui.</p>
        </div>
      ) : (
        <div className="space-y-8">
            {references.map((ref, idx) => (
                <div key={ref.id || idx} className="relative">
                    <div className="absolute -left-4 top-10 w-8 h-8 bg-yellow-400 rounded-full flex items-center justify-center text-white font-bold shadow-lg z-10 border-4 border-slate-50 text-xs">
                        {idx + 1}
                    </div>
                    <AnalysisCard 
                        result={ref} 
                        isSaved={true} 
                        onUpdate={handleUpdate}
                        // Não passamos availableOwners aqui pois é apenas visualização/gestão
                    />
                </div>
            ))}
        </div>
      )}
    </div>
  );
};

export default KnowledgeBase;
