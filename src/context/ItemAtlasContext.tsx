import { createContext, useContext, useState, useCallback, ReactNode } from 'react';

export interface LoadJarFilesResult {
  successCount: number;
  duplicateCount: number;
  invalidCount: number;
  emptyCount: number;
  totalFiles: number;
  addedItems: number;
  addedNames: number;
}

interface ItemAtlasContextType {
  itemMap: Record<string, string>;
  itemNames: Record<string, string>;
  itemSources: Record<string, { sourceJar: string; sourcePath: string; jsonPath?: string; jsonKey?: string; textureJsonPath?: string }>;  // 物品来源信息
  isLoading: boolean;
  progress: { current: number; total: number; currentFile: string };
  loadJarFiles: (files: File[]) => Promise<LoadJarFilesResult>;
  clearAtlas: () => void;
}

const ItemAtlasContext = createContext<ItemAtlasContextType | undefined>(undefined);

export function ItemAtlasProvider({ children }: { children: ReactNode }) {
  const [itemMap, setItemMap] = useState<Record<string, string>>({});
  const [itemNames, setItemNames] = useState<Record<string, string>>({});
  const [itemSources, setItemSources] = useState<Record<string, { sourceJar: string; sourcePath: string; jsonPath?: string; jsonKey?: string; textureJsonPath?: string }>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0, currentFile: '' });

  const loadJarFiles = useCallback(async (files: File[]): Promise<LoadJarFilesResult> => {
    setIsLoading(true);
    setProgress({ current: 0, total: files.length, currentFile: '' });

    const { getOrCreateJarCache, parseItemId } = await import('../utils/itemAtlas');

    const combinedMap: Record<string, string> = { ...itemMap };
    const combinedNames: Record<string, string> = { ...itemNames };

    let successCount = 0;
    let duplicateCount = 0;
    let invalidCount = 0;
    let emptyCount = 0;
    let addedItems = 0;
    let addedNames = 0;

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      setProgress({ current: i + 1, total: files.length, currentFile: file.name });

      try {
        // 使用缓存机制，避免重复解析同一 JAR 文件
        // 如果文件已存在，getOrCreateJarCache 会直接返回缓存数据
        const fileId = `${file.name}_${file.size}_${file.lastModified}`;
        const existingZip = await import('../utils/itemAtlas').then(m => m.getJarCache(fileId));

        if (existingZip) {
          // 文件已存在于缓存中，视为重复导入
          duplicateCount++;
          continue;
        }

        const cacheData = await getOrCreateJarCache(file);

        // 检查是否解析出有效数据
        const hasItems = Object.keys(cacheData.itemMap).length > 0;
        const hasNames = Object.keys(cacheData.nameMap).length > 0;

        if (!hasItems && !hasNames) {
          // JAR 文件有效但没有物品贴图或名称数据
          emptyCount++;
          continue;
        }

        successCount++;

        // 合并贴图映射，统计新增数量
        Object.entries(cacheData.itemMap).forEach(([key, value]) => {
          const parsedKey = parseItemId(key);
          if (!combinedMap[parsedKey]) {
            addedItems++;
          }
          combinedMap[parsedKey] = value;
        });

        // 合并来源信息
        Object.entries(cacheData.itemEntries).forEach(([key, entry]) => {
          const parsedKey = parseItemId(key);
          if (!itemSources[parsedKey]) {
            itemSources[parsedKey] = {
              sourceJar: entry.sourceJar,
              sourcePath: entry.sourcePath,
              jsonPath: entry.jsonPath,
              jsonKey: entry.jsonKey,
              textureJsonPath: entry.textureJsonPath,
            };
          }
        });

        // 合并名称映射，统计新增数量
        Object.entries(cacheData.nameMap).forEach(([key, value]) => {
          if (!combinedNames[key]) {
            addedNames++;
          }
          combinedNames[key] = value;
        });
      } catch (error) {
        // JSZip 解析失败，视为无效 JAR 文件
        invalidCount++;
        console.error(`解析 jar 文件失败 ${file.name}:`, error);
      }
    }

    setItemMap(combinedMap);
    setItemNames(combinedNames);
    setItemSources(itemSources);
    setIsLoading(false);
    setProgress({ current: 0, total: 0, currentFile: '' });

    return {
      successCount,
      duplicateCount,
      invalidCount,
      emptyCount,
      totalFiles: files.length,
      addedItems,
      addedNames,
    };
  }, [itemMap, itemNames, itemSources]);

  const clearAtlas = useCallback(() => {
    setItemMap({});
    setItemNames({});
    setItemSources({});
  }, []);

  return (
    <ItemAtlasContext.Provider value={{ itemMap, itemNames, itemSources, isLoading, progress, loadJarFiles, clearAtlas }}>
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
