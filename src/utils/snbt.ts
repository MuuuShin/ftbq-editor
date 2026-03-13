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
