// FTB Quests 数据类型定义

export interface Quest {
  id: string;
  title: string;
  subtitle?: string;
  description?: string | string[];
  icon?: string;
  x?: number;
  y?: number;
  size?: number;
  tasks?: QuestTask[];
  rewards?: QuestReward[];
  dependencies?: string[];
  [key: string]: any;
}

export interface QuestTask {
  type: string;
  description?: string;
  item?: string;
  count?: number;
  [key: string]: any;
}

export interface QuestReward {
  type: string;
  description?: string;
  item?: string;
  count?: number;
  [key: string]: any;
}

export interface Chapter {
  id: string;
  title: string;
  icon?: string;
  description?: string;
  quests: Quest[];
  groups?: ChapterGroup[];
  [key: string]: any;
}

export interface ChapterGroup {
  id: string;
  title: string;
  description?: string;
  chapters?: string[];
  [key: string]: any;
}

export interface QuestBook {
  chapters: Chapter[];
  groups: ChapterGroup[];
  [key: string]: any;
}

// React Flow 节点类型
export interface QuestNodeData {
  quest: Quest;
  label: string;
  icon?: string;
  completed?: boolean;
  [key: string]: any;
}

export interface QuestEdgeData {
  dependency: boolean;
  [key: string]: any;
}

// 章节列表分组显示相关类型
export interface ChapterGroupItem {
  id: string;
  title: string;
  chapters: GroupedChapter[];
}

export interface GroupedChapter {
  name: string;
  file: File;
  data: any;
  quests: Quest[];
  group?: string;
  order_index?: number;
  _originalIndex?: number; // 内部使用：原始章节索引
}

// 章节文件类型（用于 App.tsx 中存储加载的章节文件）
export interface ChapterFile {
  name: string;
  file: File;
  data: any;
  quests: Quest[];
  group?: string;
  order_index?: number;
}

// 章节组（来自文件夹导入）
export interface ChapterGroupCollection {
  id: string; // 文件夹的唯一标识（使用路径或名称 + 时间戳）
  title: string; // 文件夹名称或 questBookData.title
  chapters: ChapterFile[];
  chapterGroupsData?: ChapterGroupData[]; // chapter_groups.snbt 中的分组定义
  questBookData?: QuestBookData | null; // data.snbt 中的全局数据
  importedAt: number; // 导入时间戳，用于检测重复
  sourceType: 'folder'; // 来源类型：文件夹
}

// 单文件导入的章节集合
export interface SingleFileCollection {
  id: string; // 文件的唯一标识（使用文件名 + 最后修改时间）
  title: string; // 文件名
  chapters: ChapterFile[];
  importedAt: number; // 导入时间戳
  sourceType: 'file'; // 来源类型：单文件
}

// 统一的章节集合类型
export type ChapterCollection = ChapterGroupCollection | SingleFileCollection;

export interface QuestBookData {
  title: string;
  version?: number;
  [key: string]: any;
}

export interface ChapterGroupData {
  id: string;
  title: string;
  [key: string]: any;
}
