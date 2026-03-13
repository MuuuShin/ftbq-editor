import JSZip from 'jszip';

/**
 * 物品贴图映射
 * key: 物品 ID (如 "gtceu:epoxy_bucket")
 * value: base64 编码的贴图图片
 */
export interface ItemAtlasMap {
  [itemId: string]: string;
}

/**
 * 缓存的 JAR 文件数据
 * 包含解析后的 JSZip 对象、贴图和名称映射
 */
interface CachedJarData {
  zip: JSZip;
  itemMap: ItemAtlasMap;
  nameMap: Record<string, string>;
  extractedAt: number;
}

/**
 * JAR 文件缓存
 * key: JAR 文件的唯一标识 (name + size + lastModified)
 */
const jarCache = new Map<string, CachedJarData>();

/**
 * 生成 JAR 文件的唯一标识
 */
function generateJarFileId(file: File): string {
  return `${file.name}_${file.size}_${file.lastModified}`;
}

/**
 * 从缓存或 JAR 文件中提取贴图和名称
 * 如果缓存中存在则直接返回，避免重复解析
 */
export async function getOrCreateJarCache(file: File): Promise<CachedJarData> {
  const fileId = generateJarFileId(file);

  // 检查缓存
  const cached = jarCache.get(fileId);
  if (cached) {
    return cached;
  }

  // 解析 JAR 文件
  const zip = await JSZip.loadAsync(file);
  const itemMap: ItemAtlasMap = {};
  const nameMap: Record<string, string> = {};

  // 并行提取贴图和名称
  const extractPromises: Promise<void>[] = [];

  zip.forEach((relativePath, fileEntry) => {
    // 匹配物品贴图路径
    const itemMatch = relativePath.match(/^assets\/([^/]+)\/textures\/item\/(.+\.png)$/i);
    const blockMatch = relativePath.match(/^assets\/([^/]+)\/textures\/block\/(.+\.png)$/i);

    if (itemMatch || blockMatch) {
      const match = itemMatch || blockMatch;
      if (!match) return;
      const namespace = match[1];
      const itemName = match[2].replace(/\.png$/i, '');
      const itemId = `${namespace}:${itemName}`;

      extractPromises.push(
        fileEntry.async('base64').then((base64) => {
          itemMap[itemId] = `data:image/png;base64,${base64}`;
        })
      );
    }

    // 匹配语言文件
    const langMatch = relativePath.match(/^assets\/([^/]+)\/lang\/([^.]+)\.json$/i);
    if (langMatch) {
      const fileLocale = langMatch[2].toLowerCase();

      // 只处理 zh_cn 或 en_us
      if (fileLocale === 'zh_cn' || fileLocale === 'en_us') {
        extractPromises.push(
          fileEntry.async('string').then((content) => {
            try {
              const langData = JSON.parse(content);
              Object.entries(langData).forEach(([key, value]) => {
                const itemMatch = key.match(/^item\.([^.]+)\.(.+)$/);
                const tileMatch = key.match(/^tile\.([^.]+)\.(.+)$/);
                const blockMatch = key.match(/^block\.([^.]+)\.(.+)$/);

                if (itemMatch || tileMatch || blockMatch) {
                  const match = itemMatch || tileMatch || blockMatch;
                  if (match) {
                    const itemId = `${match[1]}:${match[2]}`;
                    nameMap[itemId] = value as string;
                  }
                }
              });
            } catch (e) {
              console.warn(`解析语言文件失败 ${relativePath}:`, e);
            }
          })
        );
      }
    }
  });

  await Promise.all(extractPromises);

  // 存入缓存
  const cacheData: CachedJarData = {
    zip,
    itemMap,
    nameMap,
    extractedAt: Date.now(),
  };
  jarCache.set(fileId, cacheData);

  return cacheData;
}

/**
 * 从缓存中获取物品贴图
 */
export function getItemTextureFromCache(fileId: string, itemId: string): string | undefined {
  const cached = jarCache.get(fileId);
  return cached?.itemMap[itemId];
}

/**
 * 从缓存中获取物品名称
 */
export function getItemNameFromCache(fileId: string, itemId: string): string | undefined {
  const cached = jarCache.get(fileId);
  return cached?.nameMap[itemId];
}

/**
 * 清空 JAR 缓存
 */
export function clearJarCache(): void {
  jarCache.clear();
}

/**
 * 获取缓存统计信息
 */
export function getCacheStats(): { jarCount: number; totalItems: number; totalNames: number } {
  let totalItems = 0;
  let totalNames = 0;

  jarCache.forEach((cached) => {
    totalItems += Object.keys(cached.itemMap).length;
    totalNames += Object.keys(cached.nameMap).length;
  });

  return {
    jarCount: jarCache.size,
    totalItems,
    totalNames,
  };
}

/**
 * 解析物品 ID（去除数量后缀）
 * 例如："gtceu:epoxy_bucket:1" -> "gtceu:epoxy_bucket"
 */
export function parseItemId(itemId: string): string {
  // 物品 ID 格式：namespace:path 或 namespace:path:count
  const parts = itemId.split(':');
  if (parts.length >= 3) {
    // 有数量后缀，去掉
    return `${parts[0]}:${parts[1]}`;
  }
  return itemId;
}
