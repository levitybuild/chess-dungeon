/**
 * IndexedDB History Manager for Anonymous / Guest Users
 * Database: ChessDungeonDB
 * Store: match_history
 */

export interface MatchHistoryRecord {
  id: string;
  opponent: string;
  opponentAvatar?: string;
  playerAvatar?: string;
  result: 'win' | 'loss' | 'draw';
  chipsDelta: number; // e.g. +2, -2, 0
  stakeChips: number;
  currency: 'Chips' | 'Cash';
  isBot?: boolean;
  timestamp: string;
  formattedDate?: string;
}

const DB_NAME = 'ChessDungeonDB';
const DB_VERSION = 1;
const STORE_NAME = 'match_history';

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !window.indexedDB) {
      return reject(new Error('IndexedDB is not supported in this environment'));
    }

    const request = window.indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event: IDBVersionChangeEvent) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
        store.createIndex('timestamp', 'timestamp', { unique: false });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function getAnonymousMatchHistory(): Promise<MatchHistoryRecord[]> {
  try {
    const db = await openDatabase();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const request = store.getAll();

      request.onsuccess = () => {
        const records: MatchHistoryRecord[] = request.result || [];
        // Sort descending by timestamp
        records.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
        resolve(records);
      };
      request.onerror = () => reject(request.error);
    });
  } catch (err) {
    console.warn('Failed to retrieve history from IndexedDB, falling back to localStorage:', err);
    try {
      const fallback = localStorage.getItem('cd_anon_history');
      return fallback ? JSON.parse(fallback) : [];
    } catch (_) {
      return [];
    }
  }
}

export async function saveAnonymousMatchRecord(record: MatchHistoryRecord): Promise<void> {
  try {
    const db = await openDatabase();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const request = store.put(record);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  } catch (err) {
    console.warn('Failed to save to IndexedDB, saving to localStorage fallback:', err);
  }

  // Also maintain localStorage mirror for rapid synchronous recovery
  try {
    const existing = localStorage.getItem('cd_anon_history');
    const list: MatchHistoryRecord[] = existing ? JSON.parse(existing) : [];
    list.unshift(record);
    if (list.length > 50) list.pop();
    localStorage.setItem('cd_anon_history', JSON.stringify(list));
  } catch (_) {}
}

export async function clearAnonymousMatchHistory(): Promise<void> {
  try {
    const db = await openDatabase();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const request = store.clear();

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
    localStorage.removeItem('cd_anon_history');
  } catch (_) {}
}
