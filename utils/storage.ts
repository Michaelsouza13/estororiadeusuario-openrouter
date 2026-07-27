
import { AnalysisResult } from "../types";
import { db } from "../services/firebase";
import { collection, getDocs, setDoc, doc, deleteDoc, query, orderBy, writeBatch, limit, where } from "firebase/firestore";

const COLLECTION_HISTORY = "analysis_history";
const COLLECTION_REFERENCES = "reference_stories";

export const getCurrentQuarter = (): string => {
  const date = new Date();
  const month = date.getMonth() + 1;
  const year = date.getFullYear();
  const quarter = Math.ceil(month / 3);
  return `${year}-Q${quarter}`;
};

export const generateHash = (str: string): string => {
  let hash = 0;
  if (str.length === 0) return hash.toString();
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(16);
};

export const sanitizeId = (id: string): string => {
  return id.replace(/\//g, '_');
};

/**
 * Remove campos com valor 'undefined' do objeto, pois o Firestore não aceita undefined.
 */
const sanitizeForFirestore = (data: any) => {
  const cleanData = { ...data };
  Object.keys(cleanData).forEach(key => {
    if (cleanData[key] === undefined) {
      delete cleanData[key];
    }
  });
  return cleanData;
};

// --- Firebase History Functions ---

export const fetchHistoryFromFirebase = async (): Promise<AnalysisResult[]> => {
  try {
    const q = query(collection(db, COLLECTION_HISTORY));
    const querySnapshot = await getDocs(q);
    const history: AnalysisResult[] = [];
    querySnapshot.forEach((doc) => {
      history.push(doc.data() as AnalysisResult);
    });
    return history;
  } catch (error) {
    console.error("Erro ao buscar histórico:", error);
    return [];
  }
};

export const saveToHistoryFirebase = async (results: AnalysisResult[]) => {
  try {
    const batch = writeBatch(db);
    
    results.forEach(item => {
      if (item.id) {
        const safeId = sanitizeId(item.id);
        const docRef = doc(db, COLLECTION_HISTORY, safeId);
        // Sanitiza o objeto antes de salvar
        const cleanItem = sanitizeForFirestore({ ...item, id: safeId });
        batch.set(docRef, cleanItem);
      }
    });

    await batch.commit();
  } catch (error) {
    console.error("Erro ao salvar no Firebase:", error);
    throw error;
  }
};

export const deleteFromHistoryFirebase = async (ids: string[]) => {
  try {
    const batch = writeBatch(db);
    ids.forEach(id => {
      const safeId = sanitizeId(id);
      const docRef = doc(db, COLLECTION_HISTORY, safeId);
      batch.delete(docRef);
    });
    await batch.commit();
  } catch (error) {
    console.error("Erro ao deletar do Firebase:", error);
    throw error;
  }
};

export const clearHistoryFirebase = async () => {
  try {
    const q = query(collection(db, COLLECTION_HISTORY));
    const querySnapshot = await getDocs(q);
    const batch = writeBatch(db);
    
    querySnapshot.forEach((doc) => {
      batch.delete(doc.ref);
    });

    await batch.commit();
  } catch (error) {
    console.error("Erro ao limpar histórico:", error);
    throw error;
  }
};

// --- Reference / Knowledge Base Functions ---

export const fetchReferencesFromFirebase = async (): Promise<AnalysisResult[]> => {
  try {
    const q = query(collection(db, COLLECTION_REFERENCES));
    const querySnapshot = await getDocs(q);
    const refs: AnalysisResult[] = [];
    querySnapshot.forEach((doc) => {
      refs.push({ ...doc.data(), isReference: true } as AnalysisResult);
    });
    return refs;
  } catch (error) {
    console.error("Erro ao buscar referências:", error);
    return [];
  }
};

export const saveReferenceStory = async (result: AnalysisResult) => {
  try {
    if (!result.id) return;
    const safeId = sanitizeId(result.id);
    const docRef = doc(db, COLLECTION_REFERENCES, safeId);
    
    // Salva como referência garantindo a flag true e removendo undefined
    const cleanData = sanitizeForFirestore({ ...result, id: safeId, isReference: true });
    
    await setDoc(docRef, cleanData);
  } catch (error) {
    console.error("Erro ao salvar referência:", error);
    throw error;
  }
};

export const removeReferenceStory = async (id: string) => {
  try {
    const safeId = sanitizeId(id);
    await deleteDoc(doc(db, COLLECTION_REFERENCES, safeId));
  } catch (error) {
    console.error("Erro ao remover referência:", error);
    throw error;
  }
};

/**
 * Obtém exemplos aleatórios da base de conhecimento para ensinar a IA (Few-Shot Learning).
 * Retorna até 3 exemplos.
 */
export const getRandomReferences = async (limitCount: number = 3): Promise<AnalysisResult[]> => {
  try {
    // Como Firestore não tem suporte nativo a "random", e a base de referencias não deve ser gigante,
    // buscamos tudo (ou um subset maior) e filtramos no cliente.
    // Se a base crescer muito, precisaria de uma estratégia de índices aleatórios.
    const allRefs = await fetchReferencesFromFirebase();
    
    if (allRefs.length === 0) return [];

    // Shuffle array (Fisher-Yates)
    for (let i = allRefs.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [allRefs[i], allRefs[j]] = [allRefs[j], allRefs[i]];
    }

    return allRefs.slice(0, limitCount);
  } catch (error) {
    console.error("Erro ao buscar exemplos aleatórios:", error);
    return [];
  }
};


// --- Helper Functions ---

export const isStoryAnalyzed = (historyList: AnalysisResult[], id: string, owner: string): boolean => {
  const safeInputId = sanitizeId(id);
  const targetOwner = (owner || '').toLowerCase();
  
  return historyList.some(item => {
    const safeItemId = sanitizeId(item.id || '');
    return safeItemId === safeInputId && (item.owner || '').toLowerCase() === targetOwner;
  });
};

export const getUniqueOwners = (historyList: AnalysisResult[]): string[] => {
  const owners = new Set(historyList.map(h => h.owner).filter(o => o && o.trim() !== ''));
  return Array.from(owners).sort();
};
