import { createContext, useContext, useState, useCallback, ReactNode } from 'react';

interface ItemAtlasContextType {
  itemMap: Record<string, string>;
  itemNames: Record<string, string>;
  isLoading: boolean;
  progress: { current: number; total: number; currentFile: string };
  loadJarFiles: (files: File[]) => Promise<void>;
  clearAtlas: () => void;
}

const ItemAtlasContext = createContext<ItemAtlasContextType | undefined>(undefined);

export function ItemAtlasProvider({ children }: { children: ReactNode }) {
  const [itemMap, setItemMap] = useState<Record<string, string>>({});
  const [itemNames, setItemNames] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0, currentFile: '' });

  const loadJarFiles = useCallback(async (files: File[]) => {
    setIsLoading(true);
    setProgress({ current: 0, total: files.length, currentFile: '' });

    const { getOrCreateJarCache, parseItemId } = await import('../utils/itemAtlas');

    const combinedMap: Record<string, string> = { ...itemMap };
    const combinedNames: Record<string, string> = { ...itemNames };

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      setProgress({ current: i + 1, total: files.length, currentFile: file.name });

      try {
        // 使用缓存机制，避免重复解析同一 JAR 文件
        const cacheData = await getOrCreateJarCache(file);

        // 合并贴图映射
        Object.entries(cacheData.itemMap).forEach(([key, value]) => {
          const parsedKey = parseItemId(key);
          combinedMap[parsedKey] = value;
        });

        // 合并名称映射
        Object.entries(cacheData.nameMap).forEach(([key, value]) => {
          combinedNames[key] = value;
        });
      } catch (error) {
        console.error(`解析 jar 文件失败 ${file.name}:`, error);
      }
    }

    setItemMap(combinedMap);
    setItemNames(combinedNames);
    setIsLoading(false);
    setProgress({ current: 0, total: 0, currentFile: '' });
  }, [itemMap, itemNames]);

  const clearAtlas = useCallback(() => {
    setItemMap({});
    setItemNames({});
  }, []);

  return (
    <ItemAtlasContext.Provider value={{ itemMap, itemNames, isLoading, progress, loadJarFiles, clearAtlas }}>
      {children}
    </ItemAtlasContext.Provider>
  );
}

export function useItemAtlas() {
  const context = useContext(ItemAtlasContext);
  if (context === undefined) {
    throw new Error('useItemAtlas must be used within an ItemAtlasProvider');
  }
  return context;
}
