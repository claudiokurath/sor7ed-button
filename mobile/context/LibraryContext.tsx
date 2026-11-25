import AsyncStorage from '@react-native-async-storage/async-storage';
import React, {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';

const STORAGE_KEY = 'sor7ed-mobile-library-v1';

export interface SavedLink {
  id: string;
  title: string;
  url: string;
  note: string;
  createdAt: string;
  favorite: boolean;
}

export interface AppSettings {
  sortOrder: 'newest' | 'oldest';
}

interface LibraryState {
  links: SavedLink[];
  settings: AppSettings;
  lastBackupAt: string | null;
}

interface BackupPayload {
  version: 1;
  exportedAt: string;
  links: SavedLink[];
  settings: AppSettings;
}

interface LibraryContextValue extends LibraryState {
  isLoaded: boolean;
  addLink: (link: Omit<SavedLink, 'id' | 'createdAt' | 'favorite'>) => void;
  updateLink: (link: SavedLink) => void;
  removeLink: (id: string) => void;
  toggleFavorite: (id: string) => void;
  setSortOrder: (sortOrder: AppSettings['sortOrder']) => void;
  createBackup: () => string;
  restoreBackup: (backupText: string) => number;
  clearLibrary: () => void;
}

const initialState: LibraryState = {
  links: [],
  settings: { sortOrder: 'newest' },
  lastBackupAt: null,
};

const LibraryContext = createContext<LibraryContextValue | null>(null);

function persist(nextState: LibraryState) {
  void AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(nextState));
}

function isSavedLink(value: unknown): value is SavedLink {
  if (!value || typeof value !== 'object') return false;
  const item = value as Partial<SavedLink>;
  return (
    typeof item.id === 'string' &&
    typeof item.title === 'string' &&
    typeof item.url === 'string' &&
    typeof item.note === 'string' &&
    typeof item.createdAt === 'string' &&
    typeof item.favorite === 'boolean'
  );
}

export function LibraryProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<LibraryState>(initialState);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    let active = true;
    AsyncStorage.getItem(STORAGE_KEY)
      .then((stored) => {
        if (!active || !stored) return;
        const parsed: unknown = JSON.parse(stored);
        if (!parsed || typeof parsed !== 'object') return;
        const value = parsed as Partial<LibraryState>;
        const links = Array.isArray(value.links)
          ? value.links.filter(isSavedLink)
          : [];
        const sortOrder =
          value.settings?.sortOrder === 'oldest' ? 'oldest' : 'newest';
        setState({
          links,
          settings: { sortOrder },
          lastBackupAt:
            typeof value.lastBackupAt === 'string' ? value.lastBackupAt : null,
        });
      })
      .catch(() => {
        if (active) setState(initialState);
      })
      .finally(() => {
        if (active) setIsLoaded(true);
      });
    return () => {
      active = false;
    };
  }, []);

  const commit = useCallback((nextState: LibraryState) => {
    setState(nextState);
    persist(nextState);
  }, []);

  const addLink = useCallback(
    (link: Omit<SavedLink, 'id' | 'createdAt' | 'favorite'>) => {
      const item: SavedLink = {
        ...link,
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
        createdAt: new Date().toISOString(),
        favorite: false,
      };
      commit({ ...state, links: [item, ...state.links] });
    },
    [commit, state],
  );

  const updateLink = useCallback(
    (updatedLink: SavedLink) => {
      commit({
        ...state,
        links: state.links.map((link) =>
          link.id === updatedLink.id ? updatedLink : link,
        ),
      });
    },
    [commit, state],
  );

  const removeLink = useCallback(
    (id: string) => {
      commit({ ...state, links: state.links.filter((link) => link.id !== id) });
    },
    [commit, state],
  );

  const toggleFavorite = useCallback(
    (id: string) => {
      commit({
        ...state,
        links: state.links.map((link) =>
          link.id === id ? { ...link, favorite: !link.favorite } : link,
        ),
      });
    },
    [commit, state],
  );

  const setSortOrder = useCallback(
    (sortOrder: AppSettings['sortOrder']) => {
      commit({ ...state, settings: { ...state.settings, sortOrder } });
    },
    [commit, state],
  );

  const createBackup = useCallback(() => {
    const exportedAt = new Date().toISOString();
    const backup: BackupPayload = {
      version: 1,
      exportedAt,
      links: state.links,
      settings: state.settings,
    };
    commit({ ...state, lastBackupAt: exportedAt });
    return JSON.stringify(backup, null, 2);
  }, [commit, state]);

  const restoreBackup = useCallback(
    (backupText: string) => {
      let parsed: unknown;
      try {
        parsed = JSON.parse(backupText);
      } catch {
        throw new Error('That backup is not valid JSON.');
      }
      if (!parsed || typeof parsed !== 'object') {
        throw new Error('This file is not a SOR7ED backup.');
      }
      const backup = parsed as Partial<BackupPayload>;
      if (backup.version !== 1 || !Array.isArray(backup.links)) {
        throw new Error('This backup format is not supported.');
      }
      if (!backup.links.every(isSavedLink)) {
        throw new Error('One or more saved links in this backup are invalid.');
      }
      const sortOrder =
        backup.settings?.sortOrder === 'oldest' ? 'oldest' : 'newest';
      commit({
        links: backup.links,
        settings: { sortOrder },
        lastBackupAt: state.lastBackupAt,
      });
      return backup.links.length;
    },
    [commit, state.lastBackupAt],
  );

  const clearLibrary = useCallback(() => {
    commit({ ...state, links: [] });
  }, [commit, state]);

  const value = useMemo(
    () => ({
      ...state,
      isLoaded,
      addLink,
      updateLink,
      removeLink,
      toggleFavorite,
      setSortOrder,
      createBackup,
      restoreBackup,
      clearLibrary,
    }),
    [
      state,
      isLoaded,
      addLink,
      updateLink,
      removeLink,
      toggleFavorite,
      setSortOrder,
      createBackup,
      restoreBackup,
      clearLibrary,
    ],
  );

  return (
    <LibraryContext.Provider value={value}>{children}</LibraryContext.Provider>
  );
}

export function useLibrary() {
  const context = useContext(LibraryContext);
  if (!context) {
    throw new Error('useLibrary must be used inside LibraryProvider');
  }
  return context;
}
