import React, { useState, useMemo } from 'react';
import { ChapterCollection, ChapterGroupData, ChapterFile } from '../types';

interface ChapterListProps {
  collections: ChapterCollection[];
  activeChapterIndex: number;
  onChapterSelect: (index: number) => void;
  onChapterDelete: (index: number, event: React.MouseEvent) => void;
  onClose: () => void;
}

/**
 * 章节列表组件 - 支持多集合（文件夹/文件）分组显示
 *
 * 三级结构：
 * - 集合（文件夹导入或文件导入）
 *   - 章节组（仅文件夹导入有，来自 chapter_groups.snbt）
 *     - 章节
 *   - 未分组章节（与章节组平级）
 */
export const ChapterList: React.FC<ChapterListProps> = ({
  collections,
  activeChapterIndex,
  onChapterSelect,
  onChapterDelete,
  onClose,
}) => {
  // 展开/折叠状态 - key 为集合 ID 或分组 ID
  const [expandedItems, setExpandedItems] = useState<Record<string, boolean>>({});

  // 初始化展开状态（仅在 collections 长度变化时）
  useMemo(() => {
    const initialExpanded: Record<string, boolean> = {};
    collections.forEach((collection) => {
      if (initialExpanded[collection.id] === undefined) {
        initialExpanded[collection.id] = true; // 默认展开
      }
      if (collection.sourceType === 'folder' && collection.chapterGroupsData) {
        collection.chapterGroupsData.forEach((group) => {
          if (initialExpanded[group.id] === undefined) {
            initialExpanded[group.id] = true;
          }
        });
      }
    });
    setExpandedItems((prev) => {
      // 保留用户之前的选择，只添加新的
      return { ...initialExpanded, ...prev };
    });
  }, [collections.length]);

  // 切换展开状态
  const toggleItem = (id: string) => {
    setExpandedItems((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  // 构建分组显示数据，并计算每个章节的全局索引
  const { groupedData, chapterGlobalIndexMap } = useMemo(() => {
    const result: Array<{
      type: 'collection' | 'group';
      collection?: ChapterCollection;
      group?: ChapterGroupData & { chapters?: ChapterFile[] };
      chapters: ChapterFile[];
      id: string;
      title: string;
      parentId?: string;
      startGlobalIndex: number;
    }> = [];

    const chapterIndexMap = new Map<string, number>(); // chapter.name -> globalIndex
    let globalChapterIndex = 0;

    collections.forEach((collection) => {
      if (collection.sourceType === 'file' || !collection.chapterGroupsData || collection.chapterGroupsData.length === 0) {
        // 文件导入或没有分组数据的文件夹：直接显示章节列表
        collection.chapters.forEach((chapter) => {
          chapterIndexMap.set(`${collection.id}-${chapter.name}`, globalChapterIndex++);
        });

        result.push({
          type: 'collection',
          collection,
          chapters: collection.chapters,
          id: collection.id,
          title: collection.title,
          startGlobalIndex: globalChapterIndex - collection.chapters.length,
        });
      } else {
        // 文件夹导入且有分组数据：按分组显示
        const chaptersByGroup: Record<string, ChapterFile[]> = {};
        const ungroupedChapters: ChapterFile[] = [];

        // 初始化分组
        collection.chapterGroupsData.forEach((group) => {
          chaptersByGroup[group.id] = [];
        });

        // 将章节分配到对应的分组
        collection.chapters.forEach((chapter) => {
          const groupId = chapter.group;
          if (groupId && chaptersByGroup[groupId]) {
            chaptersByGroup[groupId].push(chapter);
          } else {
            ungroupedChapters.push(chapter);
          }
        });

        // 对每个分组内的章节按 order_index 排序
        Object.keys(chaptersByGroup).forEach((groupId) => {
          chaptersByGroup[groupId].sort((a, b) => {
            const orderA = a.order_index ?? Number.MAX_SAFE_INTEGER;
            const orderB = b.order_index ?? Number.MAX_SAFE_INTEGER;
            return orderA - orderB;
          });
        });

        ungroupedChapters.sort((a, b) => {
          const orderA = a.order_index ?? Number.MAX_SAFE_INTEGER;
          const orderB = b.order_index ?? Number.MAX_SAFE_INTEGER;
          return orderA - orderB;
        });

        // 记录章节索引 - 按照渲染顺序：先未分组，再按 chapterGroupsData 顺序的分组
        const chaptersInOrder: ChapterFile[] = [...ungroupedChapters];
        collection.chapterGroupsData.forEach((group) => {
          const groupChapters = chaptersByGroup[group.id] || [];
          if (groupChapters.length > 0) {
            chaptersInOrder.push(...groupChapters);
          }
        });

        chaptersInOrder.forEach((chapter) => {
          chapterIndexMap.set(`${collection.id}-${chapter.name}`, globalChapterIndex++);
        });

        // 添加集合标题
        result.push({
          type: 'collection',
          collection,
          chapters: [],
          id: collection.id,
          title: collection.title,
          startGlobalIndex: globalChapterIndex - collection.chapters.length,
        });

        // 添加未分组章节（显示在最前面）
        if (ungroupedChapters.length > 0) {
          result.push({
            type: 'group',
            group: { id: '__ungrouped__', title: '未分组', chapters: ungroupedChapters },
            collection,
            chapters: ungroupedChapters,
            id: `${collection.id}__ungrouped__`,
            title: '未分组',
            parentId: collection.id,
            startGlobalIndex: 0,
          });
        }

        // 添加分组
        collection.chapterGroupsData.forEach((group) => {
          const groupChapters = chaptersByGroup[group.id] || [];
          if (groupChapters.length > 0) {
            result.push({
              type: 'group',
              group: { ...group, chapters: groupChapters },
              collection,
              chapters: groupChapters,
              id: group.id,
              title: group.title,
              parentId: collection.id,
              startGlobalIndex: 0, // 分组内章节的索引在渲染时计算
            });
          }
        });
      }
    });

    return { groupedData: result, chapterGlobalIndexMap: chapterIndexMap };
  }, [collections]);

  // 渲染章节项
  const renderChapter = (chapter: ChapterFile, collectionId: string) => {
    const globalIndex = chapterGlobalIndexMap.get(`${collectionId}-${chapter.name}`) ?? -1;
    const isActive = globalIndex === activeChapterIndex;

    return (
      <div
        key={`${collectionId}-${chapter.name}`}
        className={`flex justify-between items-center px-3 py-2 cursor-pointer border-t border-gray-100 dark:border-gray-700 transition-colors ${
          isActive
            ? 'bg-blue-500 text-white'
            : 'hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300'
        }`}
        onClick={() => onChapterSelect(globalIndex)}
      >
        <span className="text-sm truncate flex-1" title={chapter.name}>
          {chapter.name.replace(/\.snbt$/, '')}
        </span>
        <button
          onClick={(e) => onChapterDelete(globalIndex, e)}
          className={`ml-2 p-1 rounded transition-opacity ${
            isActive
              ? 'hover:bg-red-600 hover:text-white'
              : 'hover:bg-red-500 hover:text-white'
          }`}
          title="删除章节"
        >
          🗑️
        </button>
      </div>
    );
  };

  return (
    <aside className="w-80 bg-white dark:bg-gray-800 border-r border-gray-300 dark:border-gray-600 overflow-y-auto flex flex-col">
      {/* 头部 */}
      <div className="p-3 border-b border-gray-300 dark:border-gray-600 sticky top-0 bg-white dark:bg-gray-800 z-10">
        <div className="flex justify-between items-center">
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-semibold text-gray-800 dark:text-white">
              章节列表 ({collections.reduce((sum, c) => sum + c.chapters.length, 0)})
            </h3>
          </div>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-white ml-2"
          >
            ✕
          </button>
        </div>
      </div>

      {/* 分组列表 */}
      <div className="p-2 space-y-2 flex-1 overflow-y-auto">
        {groupedData.map((item) => {
          const isExpanded = expandedItems[item.id] !== false;

          // 文件导入或没有分组的集合：直接显示章节
          if (item.type === 'collection') {
            const hasSubGroups = groupedData.some((child) => child.parentId === item.id);

            if (!hasSubGroups) {
              // 没有分组的集合：直接显示章节
              return (
                <div
                  key={item.id}
                  className="rounded border border-gray-200 dark:border-gray-700 overflow-hidden"
                >
                  <div
                    className="flex justify-between items-center px-3 py-2 cursor-pointer bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                    onClick={() => toggleItem(item.id)}
                  >
                    <div className="flex items-center flex-1 min-w-0">
                      <span className="text-xs mr-1 text-gray-500 dark:text-gray-400">
                        {isExpanded ? '▼' : '▶'}
                      </span>
                      <span className="text-sm font-medium text-gray-700 dark:text-gray-300 truncate">
                        {item.collection?.sourceType === 'file' ? '📄' : '📁'} {item.title}
                      </span>
                      <span className="text-xs text-gray-500 dark:text-gray-400 ml-2">
                        ({item.chapters.length})
                      </span>
                    </div>
                  </div>

                  {isExpanded && (
                    <div className="bg-white dark:bg-gray-800">
                      {item.chapters.map((chapter) => renderChapter(chapter, item.id))}
                    </div>
                  )}
                </div>
              );
            }

            // 有分组的集合：只渲染集合标题，子分组会在后续迭代中渲染
            return (
              <div
                key={item.id}
                className="rounded border border-gray-200 dark:border-gray-700 overflow-hidden"
              >
                <div
                  className="flex justify-between items-center px-3 py-2 cursor-pointer bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                  onClick={() => toggleItem(item.id)}
                >
                  <div className="flex items-center flex-1 min-w-0">
                    <span className="text-xs mr-1 text-gray-500 dark:text-gray-400">
                      {isExpanded ? '▼' : '▶'}
                    </span>
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300 truncate">
                      📁 {item.title}
                    </span>
                  </div>
                </div>
              </div>
            );
          } else {
            // 分组（文件夹导入的子分组）
            // 如果是第一个分组或父集合刚展开，显示分组
            const parentExpanded = item.parentId ? expandedItems[item.parentId] !== false : true;
            if (!parentExpanded) return null;

            return (
              <div
                key={item.id}
                className="rounded border border-gray-200 dark:border-gray-700 overflow-hidden ml-4"
              >
                <div
                  className="flex justify-between items-center px-3 py-2 cursor-pointer bg-gray-50 dark:bg-gray-750 hover:bg-gray-100 dark:hover:bg-gray-650 transition-colors"
                  onClick={() => toggleItem(item.id)}
                >
                  <div className="flex items-center flex-1 min-w-0">
                    <span className="text-xs mr-1 text-gray-500 dark:text-gray-400">
                      {isExpanded ? '▼' : '▶'}
                    </span>
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300 truncate">
                      {item.title}
                    </span>
                    <span className="text-xs text-gray-500 dark:text-gray-400 ml-2">
                      ({item.chapters.length})
                    </span>
                  </div>
                </div>

                {isExpanded && (
                  <div className="bg-white dark:bg-gray-800">
                    {item.chapters.map((chapter) => renderChapter(chapter, item.parentId || item.id))}
                  </div>
                )}
              </div>
            );
          }
        })}

        {groupedData.length === 0 && (
          <div className="text-center py-8 text-gray-500 dark:text-gray-400 text-sm">
            暂无章节
          </div>
        )}
      </div>
    </aside>
  );
};
