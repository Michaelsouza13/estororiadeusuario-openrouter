
import React, { useState, useEffect } from 'react';
import { GlossaryEntry } from '../types';
import { fetchGlossary, saveGlossaryTerm, deleteGlossaryTerm } from '../utils/storage';
import { BookMarked, Search, Plus, Pencil, Trash2, X, Check, Loader2, Info } from 'lucide-react';

const GlossaryView: React.FC = () => {
  const [entries, setEntries] = useState<GlossaryEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [formTerm, setFormTerm] = useState('');
  const [formMeaning, setFormMeaning] = useState('');
  const [editingTerm, setEditingTerm] = useState<string | null>(null);
  const [editMeaning, setEditMeaning] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  useEffect(() => {
    loadGlossary();
  }, []);

  const loadGlossary = async () => {
    setIsLoading(true);
    try {
      const data = await fetchGlossary();
      setEntries(data);
    } catch (error) {
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  const filtered = entries.filter(e =>
    e.term.toLowerCase().includes(searchTerm.toLowerCase()) ||
    e.meaning.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleAdd = async () => {
    if (!formTerm.trim() || !formMeaning.trim()) return;
    const entry: GlossaryEntry = {
      term: formTerm.trim().toUpperCase(),
      meaning: formMeaning.trim(),
      source: 'manual',
      createdAt: new Date().toISOString()
    };
    try {
      await saveGlossaryTerm(entry);
      setEntries(prev => [...prev.filter(e => e.term !== entry.term), entry].sort((a, b) => a.term.localeCompare(b.term)));
      setFormTerm('');
      setFormMeaning('');
      setShowForm(false);
    } catch (e) {
      alert("Erro ao salvar termo.");
    }
  };

  const handleEdit = async (term: string) => {
    if (!editMeaning.trim()) return;
    const entry = entries.find(e => e.term === term);
    if (!entry) return;
    const updated: GlossaryEntry = { ...entry, meaning: editMeaning.trim() };
    try {
      await saveGlossaryTerm(updated);
      setEntries(prev => prev.map(e => e.term === term ? updated : e));
      setEditingTerm(null);
    } catch (e) {
      alert("Erro ao atualizar termo.");
    }
  };

  const handleDelete = async (term: string) => {
    try {
      await deleteGlossaryTerm(term);
      setEntries(prev => prev.filter(e => e.term !== term));
      setDeleteConfirm(null);
    } catch (e) {
      alert("Erro ao excluir termo.");
    }
  };

  if (isLoading) {
    return <div className="flex justify-center p-20"><Loader2 className="animate-spin text-[#ff5500]" size={40} /></div>;
  }

  return (
    <div className="animate-in fade-in duration-500">
      <div className="bg-gradient-to-r from-[#fff0eb] to-[#fff5f0] p-8 rounded-3xl border border-[#ff5500]/10 mb-8 flex items-start gap-4 shadow-sm">
        <div className="bg-[#ff5500] p-3 rounded-full text-white shadow-lg shadow-[#ff5500]/20">
            <BookMarked size={24} />
        </div>
        <div className="flex-1">
            <h3 className="text-xl font-black text-[#191919] mb-2">Glossário de Termos</h3>
            <p className="text-[#292929] text-sm leading-relaxed max-w-3xl">
                Termos e siglas do contexto jurídico explicados para a IA. 
                Sempre que um termo conhecido aparecer em uma história, a IA usará esta definição para interpretar corretamente.
            </p>
            <div className="mt-4 flex items-center gap-2 text-xs font-bold text-[#ff5500] bg-white/60 px-3 py-2 rounded-lg inline-flex border border-[#ff5500]/10">
                <Info size={14} />
                <span>Termos podem ser adicionados manualmente ou extraídos automaticamente das dúvidas da IA.</span>
            </div>
        </div>
        <div className="text-right">
          <div className="text-3xl font-black text-[#ff5500]">{entries.length}</div>
          <div className="text-[10px] font-black text-[#292929] uppercase tracking-widest">termos</div>
        </div>
      </div>

      <div className="bg-white rounded-[32px] shadow-xl border border-gray-100 overflow-hidden">
        <div className="p-4 border-b border-gray-100 flex flex-col md:flex-row gap-4 items-start md:items-center justify-between">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-[#292929]/40" size={18} />
            <input
              type="text"
              placeholder="Buscar termo ou significado..."
              className="pl-10 pr-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-[#ff5500] outline-none w-full font-bold text-[#191919] placeholder:text-[#292929]/30"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <button
            onClick={() => setShowForm(true)}
            className="flex items-center gap-2 bg-[#ff5500] hover:bg-[#e64a00] text-white px-6 py-2.5 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all active:scale-95 shadow-lg shadow-[#ff5500]/20"
          >
            <Plus size={16} /> Novo Termo
          </button>
        </div>

        {showForm && (
          <div className="p-4 bg-[#fff5f0] border-b border-[#ff5500]/10 animate-in fade-in slide-in-from-top-2">
            <div className="flex flex-col md:flex-row gap-3 items-end">
              <div className="flex-1 w-full">
                <label className="text-[10px] font-black text-[#292929] uppercase tracking-widest mb-1 block">Termo / Sigla</label>
                <input
                  autoFocus
                  className="w-full border border-gray-200 rounded-xl px-4 py-2.5 font-bold text-[#191919] outline-none focus:border-[#ff5500] transition-all uppercase"
                  placeholder="Ex: GCJ"
                  value={formTerm}
                  onChange={e => setFormTerm(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && formMeaning && handleAdd()}
                />
              </div>
              <div className="flex-[2] w-full">
                <label className="text-[10px] font-black text-[#292929] uppercase tracking-widest mb-1 block">Significado</label>
                <input
                  className="w-full border border-gray-200 rounded-xl px-4 py-2.5 font-bold text-[#191919] outline-none focus:border-[#ff5500] transition-all"
                  placeholder="Ex: Gerência de Controle Jurídico"
                  value={formMeaning}
                  onChange={e => setFormMeaning(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && formTerm && handleAdd()}
                />
              </div>
              <div className="flex gap-2">
                <button onClick={handleAdd} className="bg-[#ff5500] text-white p-2.5 rounded-xl hover:bg-[#e64a00] transition-all"><Check size={18} /></button>
                <button onClick={() => { setShowForm(false); setFormTerm(''); setFormMeaning(''); }} className="bg-gray-100 text-[#292929] p-2.5 rounded-xl hover:bg-gray-200 transition-all"><X size={18} /></button>
              </div>
            </div>
          </div>
        )}

        {filtered.length === 0 ? (
          <div className="p-16 text-center">
            <BookMarked className="mx-auto text-gray-200 mb-4" size={48} />
            <p className="text-[#292929] font-medium">
              {searchTerm ? 'Nenhum termo encontrado para esta busca.' : 'Nenhum termo no glossário ainda.'}
            </p>
            <p className="text-[#292929]/50 text-sm mt-2">
              {searchTerm ? 'Tente outro termo.' : 'Adicione o primeiro termo clicando em "Novo Termo".'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-[#f8f7f5] text-[#292929] font-black text-[10px] uppercase tracking-widest border-b border-gray-100">
                <tr>
                  <th className="px-6 py-4 w-48">Termo</th>
                  <th className="px-6 py-4">Significado</th>
                  <th className="px-6 py-4 w-28">Origem</th>
                  <th className="px-6 py-4 w-36">Criado em</th>
                  <th className="px-6 py-4 w-28 text-center">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filtered.map((entry) => (
                  <tr key={entry.term} className="hover:bg-[#fff5f0]/30 transition-colors group">
                    <td className="px-6 py-4">
                      <span className="font-black text-[#ff5500] bg-[#fff5f0] px-3 py-1 rounded-lg text-xs inline-block border border-[#ff5500]/10">
                        {entry.term}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      {editingTerm === entry.term ? (
                        <div className="flex items-center gap-2">
                          <input
                            autoFocus
                            className="flex-1 border border-[#ff5500] rounded-lg px-3 py-1.5 text-sm font-bold text-[#191919] outline-none"
                            value={editMeaning}
                            onChange={e => setEditMeaning(e.target.value)}
                            onKeyDown={e => e.key === 'Enter' && handleEdit(entry.term)}
                          />
                          <button onClick={() => handleEdit(entry.term)} className="text-[#ff5500] p-1"><Check size={16} /></button>
                          <button onClick={() => setEditingTerm(null)} className="text-[#292929] p-1"><X size={16} /></button>
                        </div>
                      ) : (
                        <span className="font-bold text-[#191919]">{entry.meaning}</span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <span className={`text-[10px] font-black uppercase tracking-widest px-2 py-1 rounded-lg ${
                        entry.source === 'auto'
                          ? 'bg-blue-50 text-blue-600'
                          : 'bg-[#fff5f0] text-[#ff5500]'
                      }`}>
                        {entry.source === 'auto' ? 'Automático' : 'Manual'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-[#292929] text-xs font-medium">
                      {new Date(entry.createdAt).toLocaleDateString('pt-BR')}
                    </td>
                    <td className="px-6 py-4 text-center">
                      <div className="flex items-center justify-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={() => { setEditingTerm(entry.term); setEditMeaning(entry.meaning); }}
                          className="p-1.5 text-[#292929]/40 hover:text-[#ff5500] hover:bg-[#fff5f0] rounded-lg transition-all"
                        >
                          <Pencil size={14} />
                        </button>
                        {deleteConfirm === entry.term ? (
                          <div className="flex items-center gap-1">
                            <button onClick={() => handleDelete(entry.term)} className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg transition-all"><Check size={14} /></button>
                            <button onClick={() => setDeleteConfirm(null)} className="p-1.5 text-[#292929]/40 hover:bg-gray-100 rounded-lg transition-all"><X size={14} /></button>
                          </div>
                        ) : (
                          <button
                            onClick={() => setDeleteConfirm(entry.term)}
                            className="p-1.5 text-[#292929]/40 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
                          >
                            <Trash2 size={14} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default GlossaryView;
