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
