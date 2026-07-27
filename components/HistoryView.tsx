
import React, { useState, useMemo, useEffect } from 'react';
import { AnalysisResult } from '../types';
import { Search, Filter, Download, Trash2, CheckSquare, Square } from 'lucide-react';
import * as XLSX from 'xlsx';

interface HistoryViewProps {
  history: AnalysisResult[];
  onClearHistory?: () => void;
  onDeleteItems?: (ids: string[]) => void;
}

const HistoryView: React.FC<HistoryViewProps> = ({ history, onClearHistory, onDeleteItems }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [ownerFilter, setOwnerFilter] = useState('all');
  const [quarterFilter, setQuarterFilter] = useState('all');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  useEffect(() => {
    setSelectedIds([]);
  }, [history]);

  const owners = useMemo(() => Array.from(new Set(history.map(h => h.owner || 'Desconhecido'))), [history]);
  const quarters = useMemo(() => Array.from(new Set(history.map(h => h.quarter || 'N/A'))), [history]);

  const filteredData = history.filter(item => {
    const matchesSearch = item.originalStory.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          (item.id && item.id.toLowerCase().includes(searchTerm.toLowerCase()));
    const matchesOwner = ownerFilter === 'all' || (item.owner || 'Desconhecido') === ownerFilter;
    const matchesQuarter = quarterFilter === 'all' || (item.quarter || 'N/A') === quarterFilter;
    
    return matchesSearch && matchesOwner && matchesQuarter;
  });

  const handleExportHistory = () => {
    // PADRONIZAÇÃO ABSOLUTA CONFORME SOLICITADO
    const wsData = filteredData.map(r => ({
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
    XLSX.utils.book_append_sheet(wb, ws, "Histórico");
    
    // NOME DO ARQUIVO: [Filtro Agilista] - [Data].xlsx
    const dateStr = new Date().toLocaleDateString('pt-BR').replace(/\//g, '-');
    const filterName = ownerFilter === 'all' ? 'Historico Geral' : ownerFilter;
    const fileName = `${filterName} - ${dateStr}.xlsx`;

    XLSX.writeFile(wb, fileName);
  };

  const toggleSelectAll = () => {
    if (selectedIds.length === filteredData.length && filteredData.length > 0) {
      setSelectedIds([]);
    } else {
      setSelectedIds(filteredData.map(item => item.id || ''));
    }
  };

  const toggleSelectRow = (id: string) => {
    if (selectedIds.includes(id)) {
      setSelectedIds(prev => prev.filter(item => item !== id));
    } else {
      setSelectedIds(prev => [...prev, id]);
    }
  };

  const handleDeleteSelected = () => {
    if (onDeleteItems && selectedIds.length > 0) {
      onDeleteItems(selectedIds);
    }
  };

  if (history.length === 0) {
    return (
       <div className="text-center py-20 bg-white rounded-[32px] shadow-xl border border-gray-100">
        <p className="text-[#292929]">Nenhum histórico de análise encontrado.</p>
      </div>
    );
  }

  const allSelected = filteredData.length > 0 && selectedIds.length === filteredData.length;

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row justify-between items-end gap-4 bg-white p-4 rounded-[32px] border border-gray-100 shadow-xl">
        <div className="w-full md:w-auto flex-1 gap-4 flex flex-col md:flex-row">
           <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-[#292929]/40" size={18} />
              <input 
                type="text" 
                placeholder="Buscar por texto ou ID..." 
                className="pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#ff5500] outline-none w-full md:w-64 font-bold text-[#191919] placeholder:font-normal"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
           </div>
           
           <div className="flex items-center gap-2">
              <Filter size={18} className="text-[#292929]/40" />
              <select 
                className="border border-gray-200 rounded-lg py-2 px-3 bg-white outline-none focus:ring-2 focus:ring-[#ff5500] text-sm font-bold text-[#191919]"
                value={ownerFilter}
                onChange={(e) => setOwnerFilter(e.target.value)}
              >
                <option value="all">Todos Agilistas</option>
                {owners.map(o => <option key={o} value={o}>{o}</option>)}
              </select>

              <select 
                className="border border-gray-200 rounded-lg py-2 px-3 bg-white outline-none focus:ring-2 focus:ring-[#ff5500] text-sm font-bold text-[#191919]"
                value={quarterFilter}
                onChange={(e) => setQuarterFilter(e.target.value)}
              >
                <option value="all">Todos Trimestres</option>
                {quarters.map(q => <option key={q} value={q}>{q}</option>)}
              </select>
           </div>
        </div>

        <div className="flex gap-2">
            {selectedIds.length > 0 ? (
                <button 
                type="button"
                onClick={handleDeleteSelected}
                className="flex items-center gap-2 text-red-700 bg-red-100 hover:bg-red-200 px-4 py-2 rounded-lg font-black text-[10px] uppercase tracking-widest transition-all border border-red-200 shadow-sm"
                >
                <Trash2 size={18} />
                <span>Excluir Selecionados ({selectedIds.length})</span>
                </button>
            ) : (
                onClearHistory && (
                    <button 
                    type="button"
                    onClick={onClearHistory}
                    className="flex items-center gap-2 text-red-700 bg-red-50 hover:bg-red-100 px-4 py-2 rounded-lg font-black text-[10px] uppercase tracking-widest transition-all border border-red-200 shadow-sm"
                    title="Apagar todo o histórico"
                    >
                    <Trash2 size={18} />
                    <span>Limpar Histórico</span>
                    </button>
                )
            )}
            
            <button 
            type="button"
            onClick={handleExportHistory}
            className="flex items-center gap-2 text-green-700 bg-green-50 hover:bg-green-100 px-6 py-2 rounded-lg font-black text-[10px] uppercase tracking-widest transition-all border border-green-200 shadow-sm active:scale-95"
            >
            <Download size={18} /> <span>Exportar XLSX</span>
            </button>
        </div>
      </div>

      <div className="bg-white rounded-[32px] shadow-xl border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-[#f8f7f5] text-[#292929] font-black text-[10px] uppercase tracking-widest border-b border-gray-100">
              <tr>
                <th className="px-4 py-4 w-10">
                    <button onClick={toggleSelectAll} className="flex items-center justify-center hover:text-[#ff5500] transition-colors">
                        {allSelected ? <CheckSquare size={20} className="text-[#ff5500]" /> : <Square size={20} />}
                    </button>
                </th>
                <th className="px-6 py-4 w-24">Data/Q</th>
                <th className="px-6 py-4 w-40">Agilista</th>
                <th className="px-6 py-4">História Original</th>
                <th className="px-6 py-4 text-center">Auditoria</th>
                <th className="px-6 py-4 w-24">ID Protocolo</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filteredData.map((item, idx) => (
                <tr key={idx} className={`hover:bg-[#fff5f0]/30 transition-colors group ${selectedIds.includes(item.id || '') ? 'bg-[#fff5f0]/50' : ''}`}>
                  <td className="px-4 py-4">
                      <button onClick={() => toggleSelectRow(item.id || '')} className={`flex items-center justify-center transition-colors ${selectedIds.includes(item.id || '') ? 'text-[#ff5500]' : 'text-[#292929]/20 group-hover:text-[#292929]/30'}`}>
                         {selectedIds.includes(item.id || '') ? <CheckSquare size={20} /> : <Square size={20} />}
                      </button>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="font-bold text-[#191919]">{item.date}</div>
                    <div className="text-[10px] font-black text-[#ff5500] uppercase">{item.quarter}</div>
                  </td>
                  <td className="px-6 py-4 font-black text-[11px] text-[#292929] uppercase">{item.owner || '-'}</td>
                  <td className="px-6 py-4">
                    <div className="text-slate-600 font-medium line-clamp-2 max-w-md text-xs italic" title={item.originalStory}>
                      "{item.originalStory}"
                    </div>
                  </td>
                  <td className="px-6 py-4 text-center">
                    <div className={`inline-flex items-center justify-center w-12 h-12 rounded-2xl font-black italic text-lg ${
                      item.totalScore === 9 ? 'bg-[#fff5f0] text-[#ff5500] border border-[#ff5500]/20' : 
                      item.totalScore >= 6 ? 'bg-amber-50 text-amber-600 border border-amber-100' : 'bg-rose-50 text-rose-600 border border-rose-100'
                    }`}>
                      {item.totalScore}
                    </div>
                  </td>
                  <td className="px-6 py-4 text-[#292929]/30 font-mono text-[10px] uppercase tracking-tighter">{item.id}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {filteredData.length === 0 && (
            <div className="p-16 text-center text-[#292929]/30 italic">Nenhum registro encontrado para estes filtros.</div>
        )}
      </div>
    </div>
  );
};

export default HistoryView;
