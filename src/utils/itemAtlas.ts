import JSZip from 'jszip';

// 支持的动图帧尺寸（像素），便于维护和扩展
export const SUPPORTED_FRAME_SIZES = [16, 32, 64, 128];

/**
 * 物品贴图映射
 * key: 物品 ID (如 "gtceu:epoxy_bucket")
 * value: base64 编码的贴图图片
 */
export interface ItemAtlasMap {
  [itemId: string]: string;
}

/**
 * 带来源信息的物品贴图数据
 */
export interface ItemAtlasEntry {
  url: string;                    // 浏览器可加载的 URL（通常为 blob:object URL）
  sourceJar: string;              // 来源 JAR 文件名
  sourcePath: string;             // JAR 文件内的路径 (如 "assets/gtceu/textures/item/epoxy_bucket.png")
  jsonPath?: string;              // 物品名称来源的 JSON 文件路径 (如 "assets/gtceu/lang/zh_cn.json")
  jsonKey?: string;               // JSON 文件中的键 (如 "item.gtceu.epoxy_bucket")
  textureJsonPath?: string;       // 贴图模型/纹理定义的 JSON 文件路径 (如 "assets/minecraft/models/item/diamond.json")
  // 如果生成了 Blob，则保留以便后续 revokeObjectURL
  blob?: Blob;
}

/**
 * 缓存的 JAR 文件数据
 * 包含解析后的 JSZip 对象、贴图和名称映射
 */
interface CachedJarData {
  zip: JSZip;
  itemMap: ItemAtlasMap;
  itemEntries: Record<string, ItemAtlasEntry>;  // 带来源信息的贴图数据
  nameMap: Record<string, string>;
  nameSources: Record<string, { jsonPath: string; jsonKey: string }>;  // 名称来源信息
  textureJsonSources: Record<string, string>;  // 贴图纹理定义的 JSON 文件路径
  extractedAt: number;
  jarFileName: string;  // JAR 文件名
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
  // 物品 ID → base64 贴图
  const itemMap: ItemAtlasMap = {};
  // 物品 ID → 完整来源信息
  const itemEntries: Record<string, ItemAtlasEntry> = {};
  // 物品 ID → 显示名称
  const nameMap: Record<string, string> = {};
  // 物品 ID → 名称 JSON 来源
  const nameSources: Record<string, { jsonPath: string; jsonKey: string }> = {};
  // 物品 ID → 模型 JSON 路径
  const textureJsonSources: Record<string, string> = {};

  // 并行提取贴图和名称
  const extractPromises: Promise<void>[] = [];

  // 遍历 JAR 文件中的所有条目
  zip.forEach((relativePath, fileEntry) => {
    // 匹配物品贴图路径
    const itemMatch = relativePath.match(/^assets\/([^/]+)\/textures\/item\/(.+\.png)$/i);
    const blockMatch = relativePath.match(/^assets\/([^/]+)\/textures\/block\/(.+\.png)$/i);

    const match = itemMatch || blockMatch;
    if (!match) return;

    const namespace = match[1];
    const itemName = match[2].replace(/\.png$/i, '');
    const itemId = `${namespace}:${itemName}`;

    extractPromises.push(
      // 读取为二进制 ArrayBuffer，然后创建 Blob 和 object URL（避免把大量 base64 字符串留在 JS heap）
      fileEntry.async('arraybuffer').then((arrayBuffer) => {
        try {
          const blob = new Blob([arrayBuffer], { type: 'image/png' });
          const url = URL.createObjectURL(blob);
          itemMap[itemId] = url;
          // 记录来源信息（并保留 blob 以便撤销）
          itemEntries[itemId] = {
            url,
            sourceJar: file.name,
            sourcePath: relativePath,
            blob,
          };
        } catch (e) {
          // 回退：如果任何情况失败，忽略该贴图
          console.warn('创建图片 Blob 失败', relativePath, e);
        }
      })
    );

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
                    // 记录名称来源信息
                    nameSources[itemId] = {
                      jsonPath: relativePath,
                      jsonKey: key,
                    };
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

    // 匹配物品模型 JSON 文件（记录贴图纹理定义的 JSON 路径）
    const modelMatch = relativePath.match(/^assets\/([^/]+)\/models\/item\/(.+\.json)$/i);
    if (modelMatch) {
      const namespace = modelMatch[1];
      // 提取文件名（不包括子目录），例如 "fluid/epoxy_bucket" → "epoxy_bucket"
      const fullModelName = modelMatch[2].replace(/\.json$/i, '');
      // 只取最后一层文件名作为 itemId
      const modelName = fullModelName.split('/').pop() || fullModelName;
      const itemId = `${namespace}:${modelName}`;

      extractPromises.push(
        fileEntry.async('string').then((content) => {
          try {
            const modelData = JSON.parse(content);
            // 检查是否包含纹理引用
            if (modelData.textures) {
              // 记录该物品的模型 JSON 路径
              textureJsonSources[itemId] = relativePath;
              // 如果 itemEntries 中已有该物品，关联 textureJsonPath
              if (itemEntries[itemId]) {
                itemEntries[itemId].textureJsonPath = relativePath;
              }
            }
          } catch (e) {
            // JSON 解析失败，忽略
          }
        })
      );
    }
  });

  await Promise.all(extractPromises);

  // 将名称来源关联到 itemEntries
  Object.keys(itemEntries).forEach((itemId) => {
    const source = nameSources[itemId];
    if (source) {
      itemEntries[itemId].jsonPath = source.jsonPath;
      itemEntries[itemId].jsonKey = source.jsonKey;
    }
    // 关联贴图纹理定义的 JSON 路径
    const textureSource = textureJsonSources[itemId];
    if (textureSource) {
      itemEntries[itemId].textureJsonPath = textureSource;
    }
  });

  // 存入缓存
  const cacheData: CachedJarData = {
    zip,
    itemMap,
    itemEntries,
    nameMap,
    nameSources,
    textureJsonSources,
    extractedAt: Date.now(),
    jarFileName: file.name,
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
 * 检查 JAR 文件是否已在缓存中
 */
export function getJarCache(fileId: string): CachedJarData | undefined {
  return jarCache.get(fileId);
}

/**
 * 获取物品的来源信息（JAR 文件名和内部路径）
 */
export function getItemSourceInfo(itemId: string): { sourceJar: string; sourcePath: string } | undefined {
  const parsedId = parseItemId(itemId);
  for (const cached of jarCache.values()) {
    if (cached.itemEntries[parsedId]) {
      return {
        sourceJar: cached.jarFileName,
        sourcePath: cached.itemEntries[parsedId].sourcePath,
      };
    }
  }
  return undefined;
}

/**
 * 获取所有物品的来源信息映射
 */
export function getAllItemSources(): Record<string, { sourceJar: string; sourcePath: string }> {
  const result: Record<string, { sourceJar: string; sourcePath: string }> = {};
  for (const cached of jarCache.values()) {
    Object.entries(cached.itemEntries).forEach(([itemId, entry]) => {
      const parsedId = parseItemId(itemId);
      if (!result[parsedId]) {
        result[parsedId] = {
          sourceJar: cached.jarFileName,
          sourcePath: entry.sourcePath,
        };
      }
    });
  }
  return result;
}

/**
 * 清空 JAR 缓存
 */
export function clearJarCache(): void {
  // 在清空缓存前撤销所有由 createObjectURL 创建的 URL，避免资源泄露
  for (const cached of jarCache.values()) {
    Object.values(cached.itemEntries).forEach((entry) => {
      if (entry && entry.url && entry.url.startsWith('blob:')) {
        try {
          URL.revokeObjectURL(entry.url);
        } catch (e) {
          // ignore
        }
      }
      // 如果额外保留了 blob 引用，可丢弃（GC 可回收）
      if (entry && entry.blob) {
        // help GC by removing reference
        // @ts-ignore
        entry.blob = undefined;
      }
    });
  }
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

/**
 * 动图检测结果
 */
export interface AnimationInfo {
  isAnimation: boolean;
  frameCount: number;
  frameSize: number;
  frameWidth: number;
  frameHeight: number;
}

/**
 * 检测图片是否为 Minecraft 风格的动图（垂直堆叠的 sprite sheet）
 *
 * Minecraft 动图特征：
 * - 宽度为 16 或 32（标准帧尺寸）
 * - 高度是宽度的整数倍（多帧垂直堆叠）
 * - 例如：16x48 表示 3 帧 16x16 的动图
 *
 * @param width 图片宽度（像素）
 * @param height 图片高度（像素）
 * @param frameSize 可选的帧尺寸（默认根据宽度推断）
 * @returns 动图信息
 */
export function detectAnimationFrameCount(
  width: number,
  height: number,
  frameSize?: number
): AnimationInfo {
  // 推断帧尺寸
  if (!frameSize) {
    if (SUPPORTED_FRAME_SIZES.includes(width)) {
      frameSize = width;
    } else {
      // 非标准尺寸，不视为动图
      return {
        isAnimation: false,
        frameCount: 1,
        frameSize: width,
        frameWidth: width,
        frameHeight: height,
      };
    }
  }

  // 检查宽度是否匹配帧尺寸
  if (width !== frameSize) {
    return {
      isAnimation: false,
      frameCount: 1,
      frameSize: width,
      frameWidth: width,
      frameHeight: height,
    };
  }

  // 检查高度是否为帧尺寸的整数倍
  if (height % frameSize !== 0) {
    return {
      isAnimation: false,
      frameCount: 1,
      frameSize: width,
      frameWidth: width,
      frameHeight: height,
    };
  }

  const frameCount = height / frameSize;

  // 只有多帧才视为动图
  if (frameCount <= 1) {
    return {
      isAnimation: false,
      frameCount: 1,
      frameSize: width,
      frameWidth: width,
      frameHeight: height,
    };
  }

  return {
    isAnimation: true,
    frameCount,
    frameSize,
    frameWidth: frameSize,
    frameHeight: frameSize,
  };
}

/**
 * 从 HTMLImageElement 检测动图信息
 *
 * @param img 已加载的图片元素
 * @returns 动图信息
 */
export function detectAnimationFromImage(img: HTMLImageElement): AnimationInfo {
  return detectAnimationFrameCount(img.naturalWidth, img.naturalHeight);
}

/**
 * 从图片 URL 检测动图信息
 *
 * @param imageUrl 图片 URL（base64 或普通 URL）
 * @returns Promise<AnimationInfo>
 */
export function detectAnimationFromUrl(imageUrl: string): Promise<AnimationInfo> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const info = detectAnimationFromImage(img);
      resolve(info);
    };
    img.onerror = () => {
      // 加载失败，返回静态图信息
      resolve({
        isAnimation: false,
        frameCount: 1,
        frameSize: 0,
        frameWidth: 0,
        frameHeight: 0,
      });
    };
    img.src = imageUrl;
  });
}
