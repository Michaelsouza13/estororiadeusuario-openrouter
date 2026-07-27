
import * as XLSX from 'xlsx';
import { FileRow } from '../types';
import { generateHash } from './storage';

export const parseFile = async (file: File): Promise<FileRow[]> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        const workbook = XLSX.read(data, { type: 'binary' });
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        
        // header: 1 gera um array de arrays (matriz), onde cada linha é um array de células
        const jsonData = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as any[][];

        // Precisa ter pelo menos cabeçalho + 1 linha de dados
        if (jsonData.length <= 1) {
          resolve([]);
          return;
        }

        // Tenta achar o Dono dinamicamente ainda, para manter a feature de Agilista se existir no arquivo
        const headers = jsonData[0].map(h => String(h).toLowerCase().trim());
        let ownerIndex = headers.findIndex(h => 
          h.includes('owner') || h.includes('dono') || h.includes('agilista') || h.includes('responsavel') || h.includes('autor')
        );

        // Processa da linha 1 em diante (Ignora cabeçalho - Linha 0)
        const parsedRows: FileRow[] = jsonData.slice(1)
          .map(row => {
            // REGRA DE NEGÓCIO: Mapeamento Estrito de Colunas (Base 0)
            // A=0, B=1, C=2, D=3, E=4, F=5, G=6
            
            // Coluna D (Índice 3) -> PROTOCOLO / ID
            // IMPORTANTE: Substituir barras por underline para evitar erro de caminho no Firestore (TP-123/45 -> TP-123_45)
            let id = row[3] ? String(row[3]).trim().replace(/\//g, '_') : '';
            
            // Coluna G (Índice 6) -> ESTÓRIA DE USUÁRIO
            const story = row[6] ? String(row[6]).trim() : '';

            // Se a Coluna D estiver vazia, gera um hash baseado na estória para não quebrar a chave única
            if (!id && story) {
                id = generateHash(story);
            }

            // Coluna Dinâmica ou Vazia -> DONO/AGILISTA
            const owner = ownerIndex !== -1 && row[ownerIndex] ? String(row[ownerIndex]).trim() : '';

            return {
              id,
              story,
              owner
            };
          })
          // Filtra linhas onde a estória está vazia (linha em branco no meio do excel)
          .filter(row => row.story.length > 0);

        resolve(parsedRows);
      } catch (err) {
        reject(err);
      }
    };

    reader.onerror = (err) => reject(err);
    reader.readAsBinaryString(file);
  });
};
