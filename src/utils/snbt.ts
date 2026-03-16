/**
 * SNBT 解析工具
 * 使用 ftbq-nbt 库解析和编码 FTB Quests 的 SNBT 文件
 */

import { parse, stringify } from 'ftbq-nbt';

/**
 * 解析 SNBT 字符串为 JavaScript 对象
 * FTB Quests 的 SNBT 格式使用换行分隔而不是逗号分隔
 */
export function parseSNBT(snbt: string): any {
  try {
    // FTBQ 的 SNBT 格式特点:
    // - 字段之间用换行分隔，不用逗号
    // - 键名通常不用引号
    // - 使用 CRLF 换行符
    // - 数值类型后缀如 1.5d (double), 1b (byte) 等
    return parse(snbt, { skipComma: true });
  } catch (error) {
    console.error('Failed to parse SNBT:', error);
    throw new Error(`SNBT 解析失败：${error}`);
  }
}

/**
 * 将 JavaScript 对象编码为 SNBT 字符串
 */
export function encodeSNBT(data: any): string {
  try {
    return stringify(data);
  } catch (error) {
    console.error('Failed to encode SNBT:', error);
    throw new Error(`SNBT 编码失败：${error}`);
  }
}

/**
 * 从文件读取 SNBT 数据
 */
export async function readSNBTFile(file: File): Promise<any> {
  const text = await file.text();
  return parseSNBT(text);
}

/**
 * 将数据导出为 SNBT 文件
 */
export function exportSNBTFile(data: any, filename: string): void {
  const snbt = encodeSNBT(data);
  const blob = new Blob([snbt], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * 从原始 SNBT 数据提取任务列表
 */
export function extractQuests(chapterData: any): any[] {
  if (!chapterData || !chapterData.quests) {
    return [];
  }
  return chapterData.quests;
}

/**
 * 将修改后的任务数据同步回原始 SNBT 结构
 */
export function updateQuestInData(chapterData: any, questId: string, updatedQuest: any): void {
  if (!chapterData.quests) {
    chapterData.quests = [];
  }

  const index = chapterData.quests.findIndex((q: any) => q.id === questId);
  if (index >= 0) {
    chapterData.quests[index] = updatedQuest;
  } else {
    chapterData.quests.push(updatedQuest);
  }
}

/**
 * 批量更新任务位置
 */
export function updateQuestPositions(chapterData: any, positions: Map<string, { x: number; y: number }>): void {
  if (!chapterData.quests) return;

  chapterData.quests.forEach((quest: any) => {
    const pos = positions.get(quest.id);
    if (pos) {
      quest.x = pos.x;
      quest.y = pos.y;
    }
  });
}

/**
 * 验证 FTBQ 文件夹结构
 */
export interface FolderValidationResult {
  valid: boolean;
  error?: string;
  dataFile?: File;
  chapterGroupsFile?: File;
  chapterFiles: File[];
}

export async function validateFTBQFolder(files: FileList): Promise<FolderValidationResult> {
  const chapterFiles: File[] = [];
  let dataFile: File | undefined;
  let chapterGroupsFile: File | undefined;
  let hasChaptersFolder = false;

  // 遍历所有文件，模拟文件夹结构
  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    const webkitRelativePath = (file as any).webkitRelativePath || file.name;
    // 同时支持 Windows 和 Unix 路径分隔符
    const normalizedPath = webkitRelativePath.replace(/\\/g, '/');
    const pathParts = normalizedPath.split('/');

    // 检查根目录文件（路径只有两部分：文件夹名/文件）
    // 例如：quests/data.snbt -> pathParts = ['quests', 'data.snbt']
    if (pathParts.length === 2) {
      if (file.name === 'data.snbt') {
        dataFile = file;
      } else if (file.name === 'chapter_groups.snbt') {
        chapterGroupsFile = file;
      }
    }

    // 检查 chapters 文件夹（第二级目录是 chapters）
    // 例如：quests/chapters/chapter1.snbt -> pathParts = ['quests', 'chapters', 'chapter1.snbt']
    if (pathParts.length >= 3 && pathParts[1] === 'chapters' && file.name.endsWith('.snbt')) {
      hasChaptersFolder = true;
      chapterFiles.push(file);
    }
  }

  // 验证必要文件和文件夹
  if (!hasChaptersFolder && chapterFiles.length === 0) {
    return {
      valid: false,
      error: '缺少 chapters 文件夹或该文件夹下没有 .snbt 文件。请确保选择的文件夹中包含 chapters/ 目录。',
      chapterFiles: [],
    };
  }

  if (!dataFile) {
    return {
      valid: false,
      error: '缺少根目录下的 data.snbt 文件（任务书全局配置）。请确保 data.snbt 位于文件夹根目录。',
      chapterFiles: [],
    };
  }

  if (!chapterGroupsFile) {
    return {
      valid: false,
      error: '缺少根目录下的 chapter_groups.snbt 文件（章节分组配置）。请确保 chapter_groups.snbt 位于文件夹根目录。',
      chapterFiles: [],
    };
  }

  return {
    valid: true,
    dataFile,
    chapterGroupsFile,
    chapterFiles,
  };
}

/**
 * 从文件夹导入 FTBQ 任务书数据
 */
export interface FolderImportResult {
  success: boolean;
  error?: string;
  data?: any;
  chapterGroups?: any;
  chapters: { name: string; file: File; data: any; quests: any[] }[];
  successCount: number;
  failCount: number;
  failedFiles: { name: string; error: string }[];
}

export async function importFTBQFolder(
  files: FileList,
  onProgress?: (current: number, total: number, fileName: string) => void
): Promise<FolderImportResult> {
  // 验证文件夹结构
  const validation = await validateFTBQFolder(files);
  if (!validation.valid) {
    return {
      success: false,
      error: validation.error ?? 'Unknown error',
      chapters: [],
      successCount: 0,
      failCount: 0,
      failedFiles: [],
    };
  }

  const result: FolderImportResult = {
    success: true,
    data: null,
    chapterGroups: null,
    chapters: [],
    successCount: 0,
    failCount: 0,
    failedFiles: [],
  };

  try {
    // 解析 data.snbt
    if (validation.dataFile) {
      result.data = await readSNBTFile(validation.dataFile);
    }

    // 解析 chapter_groups.snbt
    if (validation.chapterGroupsFile) {
      result.chapterGroups = await readSNBTFile(validation.chapterGroupsFile);
    }

    // 解析所有章节文件
    const totalChapters = validation.chapterFiles.length;
    for (let i = 0; i < totalChapters; i++) {
      const file = validation.chapterFiles[i];
      const relativePath = (file as any).webkitRelativePath || file.name;

      if (onProgress) {
        onProgress(i + 1, totalChapters, relativePath);
      }

      try {
        const data = await readSNBTFile(file);
        const quests = extractQuests(data);

        result.chapters.push({
          name: relativePath,
          file,
          data,
          quests,
        });
        result.successCount++;
      } catch (error) {
        result.failCount++;
        result.failedFiles.push({
          name: relativePath,
          error: String(error),
        });
      }
    }
  } catch (error) {
    result.success = false;
    result.error = String(error);
  }

  return result;
}
