import { useState, useCallback, useRef, useMemo, useEffect } from 'react';
import { Quest, ChapterGroupData, QuestBookData, ChapterFile, ChapterCollection } from './types';
import { readSNBTFile, exportSNBTFile, extractQuests, importFTBQFolder, type FolderImportResult } from './utils/snbt';
import { QuestEditorCanvasWrapper } from './components/QuestEditorCanvas';
import { QuestEditor } from './components/QuestEditor';
import { ItemAtlasProvider } from './context/ItemAtlasContext';
import ItemAtlasUploader from './components/ItemAtlasUploader';
import ItemAtlasViewer from './components/ItemAtlasViewer';
import { ChapterList } from './components/ChapterList';
import { ToastContainer, type ToastType } from './components/Toast';

interface ImportProgress {
  current: number;
  total: number;
  fileName: string;
}

// 生成唯一 ID
function generateCollectionId(prefix: string, name: string, timestamp?: number): string {
  if (timestamp) {
    return `${prefix}_${name}_${timestamp}`;
  }
  return `${prefix}_${name}_${Date.now()}`;
}

/**
 * 主应用组件
 */
function App() {
  // 章节集合列表（支持多个文件夹和单文件导入）
  const [collections, setCollections] = useState<ChapterCollection[]>([]);
  // 当前激活的章节索引（全局索引，跨越所有集合）
  const [activeChapterIndex, setActiveChapterIndex] = useState<number>(-1);
  // 任务列表（当前激活章节的任务）
  const [quests, setQuests] = useState<Quest[]>([]);
  // 当前选中的任务
  const [selectedQuest, setSelectedQuest] = useState<Quest | null>(null);
  // 是否显示编辑器面板
  const [showEditor, setShowEditor] = useState(false);
  // 是否显示物品贴图浏览器
  const [showAtlasViewer, setShowAtlasViewer] = useState(false);
  // 是否显示章节列表侧边栏
  const [showChapterList, setShowChapterList] = useState(false);
  // 文件输入 ref
  const fileInputRef = useRef<HTMLInputElement>(null);
  // 文件夹输入 ref
  const folderInputRef = useRef<HTMLInputElement>(null);
  // 导入进度状态
  const [importProgress, setImportProgress] = useState<ImportProgress | null>(null);
  // 导入结果摘要
  const [importResult, setImportResult] = useState<FolderImportResult | null>(null);
  // 是否显示导入结果弹窗
  const [showImportResult, setShowImportResult] = useState(false);
  // 是否显示文件导入下拉菜单
  const [showImportDropdown, setShowImportDropdown] = useState(false);
  // Toast 提示
  const [toasts, setToasts] = useState<Array<{ id: string; message: string; type: ToastType }>>([]);
  // 任务书全局数据（来自 data.snbt）- 已弃用，现在存储在每个 collection 中
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [_questBookData] = useState<QuestBookData | null>(null);
  // 章节分组数据（来自 chapter_groups.snbt）- 已弃用，现在存储在每个 collection 中
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [_chapterGroupsData] = useState<ChapterGroupData[]>([]);

  // 标记未使用的变量为已读取（避免 TypeScript 警告）
  void _questBookData;
  void _chapterGroupsData;

  // 显示 Toast
  const showToast = useCallback((message: string, type: ToastType) => {
    const id = Date.now().toString();
    setToasts((prev) => [...prev, { id, message, type }]);
  }, []);

  // 移除 Toast
  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  // 获取所有章节文件（扁平化列表，用于兼容现有的章节索引逻辑）
  // 注意：顺序必须与 ChapterList 中 chapterGlobalIndexMap 的计算顺序一致
  const allChapters = useMemo(() => {
    const chapters: ChapterFile[] = [];
    collections.forEach((collection) => {
      if (collection.sourceType === 'file' || !collection.chapterGroupsData || collection.chapterGroupsData.length === 0) {
        // 文件导入或没有分组数据：直接使用原始顺序
        chapters.push(...collection.chapters);
      } else {
        // 文件夹导入且有分组数据：按分组和 order_index 排序
        const chaptersByGroup: Record<string, ChapterFile[]> = {};
        const ungroupedChapters: ChapterFile[] = [];

        collection.chapterGroupsData.forEach((group) => {
          chaptersByGroup[group.id] = [];
        });

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

        // 按照 ChapterList 中相同的顺序添加章节：先未分组，再分组
        chapters.push(...ungroupedChapters);
        collection.chapterGroupsData.forEach((group) => {
          const groupChapters = chaptersByGroup[group.id] || [];
          if (groupChapters.length > 0) {
            chapters.push(...groupChapters);
          }
        });
      }
    });
    return chapters;
  }, [collections]);

  // 当前激活的章节数据
  const activeChapter = activeChapterIndex >= 0 ? allChapters[activeChapterIndex] : null;
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const _fileName = activeChapter?.name || '';
  void _fileName;

  // 获取当前激活章节所在的集合
  const activeCollection = activeChapter
    ? collections.find((c) => c.chapters.some((ch) => ch === activeChapter))
    : null;

  // 处理文件导入 - 支持单个文件或多文件导入
  // 文件导入的章节直接添加到根级别，与文件夹导入的集合平级
  const handleFileImport = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    try {
      const newChapters: ChapterFile[] = [];

      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        if (!file.name.endsWith('.snbt')) continue;

        const data = await readSNBTFile(file);
        const questList = extractQuests(data);

        newChapters.push({
          name: file.name,
          file,
          data,
          quests: questList,
          defaultQuestShape: data?.default_quest_shape,
          group: data?.group,
          order_index: data?.order_index,
        });
      }

      if (newChapters.length === 0) {
        showToast('未找到有效的 .snbt 文件', 'warning');
        return;
      }

      // 检查是否有重复的文件（通过文件名判断）
      const existingFileCollection = collections.find(
        (c): c is import('./types').SingleFileCollection =>
          c.sourceType === 'file' &&
          c.chapters.some((chapter) => newChapters.some((nc) => nc.name === chapter.name))
      );

      if (existingFileCollection) {
        // 重复导入：覆盖原文件
        setCollections((prev) =>
          prev.map((collection) => {
            if (collection.id === existingFileCollection.id) {
              // 合并章节：保留不重复的，添加新的
              const remainingChapters = collection.chapters.filter(
                (c) => !newChapters.some((nc) => nc.name === c.name)
              );
              return {
                ...collection,
                chapters: [...remainingChapters, ...newChapters],
                importedAt: Date.now(),
              } as ChapterCollection;
            }
            return collection;
          })
        );
        showToast(`已更新 ${newChapters.length} 个章节文件`, 'success');
      } else {
        // 新导入：创建新的集合
        const collectionId = generateCollectionId('file', newChapters[0].name);
        const newCollection: import('./types').SingleFileCollection = {
          id: collectionId,
          title: newChapters.length === 1 ? newChapters[0].name.replace(/\.snbt$/, '') : `导入的文件 (${newChapters.length} 个)`,
          chapters: newChapters,
          importedAt: Date.now(),
          sourceType: 'file',
        };
        setCollections((prev) => [...prev, newCollection]);
        showToast(`成功导入 ${newChapters.length} 个章节文件`, 'success');
      }

      // 如果之前没有激活的章节，激活第一个新导入的章节
      if (activeChapterIndex < 0 && newChapters.length > 0) {
        setActiveChapterIndex(0);
        setQuests(newChapters[0].quests);
      }

      // 打开章节列表侧边栏
      setShowChapterList(true);
    } catch (error) {
      showToast(`文件加载失败：${error}`, 'error');
    }

    // 重置 input 以允许重复选择同一文件
    event.target.value = '';
    setShowImportDropdown(false);
  }, [collections, activeChapterIndex, showToast]);

  // 处理文件夹导入
  // 文件夹导入的章节以集合形式管理，支持文件夹级别的重复检测和覆盖
  const handleFolderImport = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    try {
      // 文件夹导入模式
      setImportProgress({ current: 0, total: files.length, fileName: '验证文件夹结构...' });

      const result = await importFTBQFolder(files, (current, total, fileName) => {
        setImportProgress({ current, total, fileName });
      });

      setImportProgress(null);
      setImportResult(result);
      setShowImportResult(true);

      if (result.success && result.chapters.length > 0) {
        // 转换导入结果为 ChapterFile 格式
        const newChapters: ChapterFile[] = result.chapters.map((chapter) => ({
          name: chapter.name,
          file: chapter.file,
          data: chapter.data,
          quests: chapter.quests,
          defaultQuestShape: chapter.data?.default_quest_shape,
          group: chapter.data?.group,
          order_index: chapter.data?.order_index,
        }));

        // 获取文件夹名称（从文件路径推断）
        const folderName =
          newChapters.length > 0
            ? newChapters[0].file.webkitRelativePath?.split('/')[0] || '未命名文件夹'
            : '未命名文件夹';

        // 使用 questBookData.title 作为集合标题（如果有）
        const collectionTitle = result.data?.title || folderName;

        // 检查是否有重复的文件夹导入（通过标题判断）
        const existingFolderCollection = collections.find(
          (c): c is import('./types').ChapterGroupCollection =>
            c.sourceType === 'folder' && c.title === collectionTitle
        );

        if (existingFolderCollection) {
          // 重复导入：覆盖原文件夹的章节
          setCollections((prev) =>
            prev.map((collection) => {
              if (collection.id === existingFolderCollection.id) {
                // 处理重复：按文件名判断，重复的覆盖，新的追加
                const updatedChapters = [...collection.chapters];
                newChapters.forEach((newChapter) => {
                  const existingIndex = updatedChapters.findIndex((c) => c.name === newChapter.name);
                  if (existingIndex >= 0) {
                    // 覆盖已有章节
                    updatedChapters[existingIndex] = newChapter;
                  } else {
                    // 追加新章节
                    updatedChapters.push(newChapter);
                  }
                });

                return {
                  ...collection,
                  chapters: updatedChapters,
                  chapterGroupsData: result.chapterGroups?.chapter_groups || (collection.sourceType === 'folder' ? collection.chapterGroupsData : undefined),
                  questBookData: result.data || (collection.sourceType === 'folder' ? collection.questBookData : undefined),
                  importedAt: Date.now(),
                } as ChapterCollection;
              }
              return collection;
            })
          );
          showToast(`已更新文件夹 "${collectionTitle}"，共 ${newChapters.length} 个章节`, 'success');
        } else {
          // 新导入：创建新的集合
          const collectionId = generateCollectionId('folder', collectionTitle);
          const newCollection: import('./types').ChapterGroupCollection = {
            id: collectionId,
            title: collectionTitle,
            chapters: newChapters,
            chapterGroupsData: result.chapterGroups?.chapter_groups,
            questBookData: result.data,
            importedAt: Date.now(),
            sourceType: 'folder',
          };
          setCollections((prev) => [...prev, newCollection]);
          showToast(`成功导入文件夹 "${collectionTitle}"，共 ${newChapters.length} 个章节`, 'success');
        }

        // 如果之前没有激活的章节，激活第一个
        if (activeChapterIndex < 0 && newChapters.length > 0) {
          setActiveChapterIndex(0);
          setQuests(newChapters[0].quests);
        }

        // 打开章节列表侧边栏
        setShowChapterList(true);
      } else if (!result.success) {
        showToast(`导入失败：${result.error || '未知错误'}`, 'error');
      }
    } catch (error) {
      showToast(`文件夹加载失败：${error}`, 'error');
    }

    // 重置 input 以允许重复选择同一文件夹
    event.target.value = '';
    setShowImportDropdown(false);
  }, [collections, activeChapterIndex, showToast]);

  // 处理文件导出 - 保存当前激活的章节
  const handleFileExport = useCallback(() => {
    if (!activeChapter || activeChapterIndex < 0) return;

    // 更新章节数据中的 quests
    const updatedData = { ...activeChapter.data, quests };
    exportSNBTFile(updatedData, activeChapter.name);
  }, [activeChapter, activeChapterIndex, quests]);

  // 处理任务更新 - 更新当前激活章节的数据
  const handleQuestUpdate = useCallback((updatedQuest: Quest) => {
    setQuests((prev) =>
      prev.map((q) => (q.id === updatedQuest.id ? updatedQuest : q))
    );

    // 同步更新集合中的章节数据
    setCollections((prev) =>
      prev.map((collection) => {
        const globalIndex = allChapters.findIndex((c) => c === activeChapter);
        if (globalIndex === activeChapterIndex) {
          const updatedChapters = collection.chapters.map((chapter) => {
            if (chapter === activeChapter) {
              const updatedQuests = chapter.quests.map((q: Quest) =>
                q.id === updatedQuest.id ? updatedQuest : q
              );
              return {
                ...chapter,
                quests: updatedQuests,
                data: { ...chapter.data, quests: updatedQuests },
              };
            }
            return chapter;
          });
          return { ...collection, chapters: updatedChapters };
        }
        return collection;
      })
    );

    setShowEditor(false);
    setSelectedQuest(null);
  }, [activeChapter, activeChapterIndex, allChapters]);

  // 处理任务选择
  const handleQuestSelect = useCallback((quest: Quest | null) => {
    setSelectedQuest(quest);
    setShowEditor(!!quest);
  }, []);

  // 处理位置变化
  const handlePositionChange = useCallback((questId: string, x: number, y: number) => {
    setQuests((prev) =>
      prev.map((q) => (q.id === questId ? { ...q, x, y } : q))
    );
  }, []);

  // 切换激活的章节
  const handleChapterSelect = useCallback((index: number) => {
    if (index < 0 || index >= allChapters.length) return;

    setActiveChapterIndex(index);
    setQuests(allChapters[index].quests);
    setShowEditor(false);
    setSelectedQuest(null);
  }, [allChapters]);

  // 删除章节
  const handleChapterDelete = useCallback((index: number, event: React.MouseEvent) => {
    event.stopPropagation();

    setCollections((prev) => {
      let remainingIndex = 0;
      const newCollections = prev.map((collection) => {
        const chapterLocalIndex = collection.chapters.findIndex((_, i) => {
          const globalIdx = remainingIndex + i;
          return globalIdx === index;
        });

        if (chapterLocalIndex >= 0) {
          const newChapters = collection.chapters.filter((_, i) => i !== chapterLocalIndex);
          return { ...collection, chapters: newChapters };
        }

        remainingIndex += collection.chapters.length;
        return collection;
      });

      // 过滤掉没有章节的集合
      return newCollections.filter((c) => c.chapters.length > 0);
    });

    // 如果删除的是当前激活的章节
    if (index === activeChapterIndex) {
      const newIndex = index > 0 ? index - 1 : (allChapters.length > 1 ? 0 : -1);
      setActiveChapterIndex(newIndex);
      if (newIndex >= 0 && newIndex < allChapters.length) {
        setQuests(allChapters[newIndex].quests);
      } else {
        setQuests([]);
      }
      setShowEditor(false);
      setSelectedQuest(null);
    } else if (index < activeChapterIndex) {
      // 如果删除的章节在当前激活章节之前，更新索引
      setActiveChapterIndex(activeChapterIndex - 1);
    }
  }, [activeChapterIndex, allChapters]);

  // 触发文件选择（单文件/多文件）
  const triggerFileSelect = () => {
    fileInputRef.current?.click();
  };

  // 触发文件夹选择
  const triggerFolderSelect = () => {
    folderInputRef.current?.click();
  };

  // 切换文件导入下拉菜单
  const toggleImportDropdown = () => {
    setShowImportDropdown(!showImportDropdown);
  };

  // 切换章节列表侧边栏
  const toggleChapterList = () => {
    setShowChapterList(!showChapterList);
  };

  // 在客户端运行时为文件夹输入节点设置非标准的 webkitdirectory 属性
  useEffect(() => {
    const el = folderInputRef.current as HTMLInputElement | null;
    if (el && !el.hasAttribute('webkitdirectory')) {
      try {
        el.setAttribute('webkitdirectory', '');
      } catch (e) {
        // 忽略：在不支持或受限环境中可能抛出
      }
    }
  }, []);

  return (
    <ItemAtlasProvider>
      <ToastContainer toasts={toasts} onRemove={removeToast} />
      <div className="w-screen h-screen flex flex-col bg-gray-100 dark:bg-gray-900">
        {/* 隐藏的 SVG 定义 - 用于箭头 marker */}
        <svg className="hidden">
          <defs>
            <marker id="edge-arrow" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="8" markerHeight="8" orient="auto-start-reverse">
              <path d="M 0 0 L 10 5 L 0 10 L 0 0" fill="#6366f1" />
            </marker>
          </defs>
        </svg>

        {/* 隐藏的文件输入 - 单文件/多文件 */}
        <input
          ref={fileInputRef}
          type="file"
          accept=".snbt,.txt"
          multiple
          onChange={handleFileImport}
          className="hidden"
        />

        {/* 隐藏的文件夹输入 - 注意：webkitdirectory 是非标准属性，会在运行时通过 DOM setAttribute 设置以避免 TSX 类型警告 */}
        <input
          ref={folderInputRef}
          type="file"
          accept=".snbt,.txt"
          multiple
          onChange={handleFolderImport}
          className="hidden"
        />

        {/* 顶部工具栏 - 精简版 */}
        <header className="toolbar h-auto min-h-12 flex items-center flex-wrap gap-2 px-3 py-1.5 shrink-0">
          {/* 左侧：标题 + 导入按钮 + 保存按钮 */}
          <div className="flex items-center gap-2">
            <h1 className="text-lg font-bold text-gray-800 dark:text-white whitespace-nowrap">
              FTBQ Editor
            </h1>
            {activeCollection?.sourceType === 'folder' && (
              <span className="text-sm text-gray-600 dark:text-gray-400 hidden md:inline truncate max-w-[200px]">
                - {activeCollection.title}
              </span>
            )}

            {/* 导入按钮组 */}
            <div className="relative">
              <button
                onClick={toggleImportDropdown}
                className="bg-blue-500 hover:bg-blue-600 text-white font-medium py-1.5 px-3 rounded text-sm flex items-center gap-1"
                title="导入 SNBT 文件或文件夹"
              >
                📂 打开
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {/* 下拉菜单 */}
              {showImportDropdown && (
                <>
                  <div
                    className="fixed inset-0 z-10"
                    onClick={() => setShowImportDropdown(false)}
                  />
                  <div className="absolute top-full left-0 mt-1 bg-white dark:bg-gray-700 rounded shadow-lg border border-gray-200 dark:border-gray-600 z-20 min-w-[140px]">
                    <button
                      onClick={triggerFileSelect}
                      className="w-full px-3 py-2 text-sm text-left hover:bg-gray-100 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 flex items-center gap-2"
                    >
                      📄 打开文件
                    </button>
                    <button
                      onClick={triggerFolderSelect}
                      className="w-full px-3 py-2 text-sm text-left hover:bg-gray-100 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 flex items-center gap-2"
                    >
                      📁 打开文件夹
                    </button>
                  </div>
                </>
              )}
            </div>

            {/* 保存按钮 */}
            <button
              onClick={handleFileExport}
              disabled={!activeChapter}
              className="bg-green-500 hover:bg-green-600 disabled:bg-gray-400 disabled:cursor-not-allowed text-white font-medium py-1.5 px-3 rounded text-sm flex items-center gap-1"
              title="保存当前章节"
            >
              💾 保存
            </button>
          </div>

          {/* 右侧：功能按钮 */}
          <div className="flex items-center gap-1.5 ml-auto">
            {/* 章节列表切换按钮 */}
            {allChapters.length > 0 && (
              <button
                onClick={toggleChapterList}
                className={`px-3 py-1.5 text-sm rounded flex-shrink-0 ${showChapterList ? 'bg-indigo-600 text-white' : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600'}`}
                title="章节列表"
              >
                📑 章节 ({allChapters.length})
              </button>
            )}

            {/* 物品贴图加载器 */}
            <ItemAtlasUploader onShowToast={showToast} />

            {/* 物品图鉴切换按钮 - 查看已加载的物品贴图和名称 */}
            <button
              onClick={() => setShowAtlasViewer(!showAtlasViewer)}
              className={`px-3 py-1.5 text-sm rounded flex-shrink-0 ${showAtlasViewer ? 'bg-indigo-600 text-white' : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600'}`}
              title="查看已加载的物品贴图"
            >
              📖 物品图鉴
            </button>
          </div>
        </header>

        {/* 主内容区域 */}
        <main className="flex-1 flex overflow-hidden">
          {/* 导入进度弹窗 */}
          {importProgress && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
              <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-md w-full mx-4 shadow-xl">
                <h3 className="text-lg font-semibold text-gray-800 dark:text-white mb-4">
                  📁 正在导入文件夹...
                </h3>
                <div className="space-y-3">
                  <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2.5 overflow-hidden">
                    <div
                      className="bg-blue-600 h-2.5 rounded-full transition-all duration-300"
                      style={{ width: `${(importProgress.current / importProgress.total) * 100}%` }}
                    />
                  </div>
                  <p className="text-sm text-gray-600 dark:text-gray-400 truncate">
                    {importProgress.current} / {importProgress.total} - {importProgress.fileName}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* 导入结果摘要弹窗 */}
          {showImportResult && importResult && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
              <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-md w-full mx-4 shadow-xl max-h-[80vh] overflow-y-auto">
                <h3 className="text-lg font-semibold text-gray-800 dark:text-white mb-4">
                  {importResult.success ? '✅ 导入完成' : '❌ 导入失败'}
                </h3>
                {importResult.error && !importResult.success && (
                  <div className="mb-4 p-3 bg-red-100 dark:bg-red-900/30 border border-red-300 dark:border-red-700 rounded text-red-700 dark:text-red-300 text-sm">
                    {importResult.error}
                  </div>
                )}
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between text-gray-700 dark:text-gray-300">
                    <span>成功导入:</span>
                    <span className="text-green-600 dark:text-green-400">{importResult.successCount} 个章节</span>
                  </div>
                  <div className="flex justify-between text-gray-700 dark:text-gray-300">
                    <span>导入失败:</span>
                    <span className={importResult.failCount > 0 ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'}>
                      {importResult.failCount} 个文件
                    </span>
                  </div>
                  {importResult.data && (
                    <div className="flex justify-between text-gray-700 dark:text-gray-300">
                      <span>全局配置:</span>
                      <span className="text-blue-600 dark:text-blue-400">✓ data.snbt</span>
                    </div>
                  )}
                  {importResult.chapterGroups && (
                    <div className="flex justify-between text-gray-700 dark:text-gray-300">
                      <span>章节分组:</span>
                      <span className="text-blue-600 dark:text-blue-400">✓ chapter_groups.snbt</span>
                    </div>
                  )}
                  {importResult.failedFiles.length > 0 && (
                    <details className="mt-4">
                      <summary className="cursor-pointer text-red-600 dark:text-red-400 hover:underline">
                        查看失败详情 ({importResult.failedFiles.length})
                      </summary>
                      <ul className="mt-2 space-y-1 text-xs text-red-500 dark:text-red-400 max-h-32 overflow-y-auto">
                        {importResult.failedFiles.map((failed, idx) => (
                          <li key={idx} className="truncate" title={failed.error}>
                            • {failed.name}: {failed.error}
                          </li>
                        ))}
                      </ul>
                    </details>
                  )}
                </div>
                <div className="mt-6 flex justify-end">
                  <button
                    onClick={() => {
                      setShowImportResult(false);
                      setImportResult(null);
                    }}
                    className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded text-sm"
                  >
                    确定
                  </button>
                </div>
              </div>
            </div>
          )}
          {/* 章节列表侧边栏 */}
          {showChapterList && (
            <ChapterList
              collections={collections}
              activeChapterIndex={activeChapterIndex}
              onChapterSelect={handleChapterSelect}
              onChapterDelete={handleChapterDelete}
              onClose={toggleChapterList}
            />
          )}

          {/* 物品贴图浏览器或编辑器画布 */}
          {showAtlasViewer ? (
            <div className="flex-1 w-full h-full">
              <ItemAtlasViewer />
            </div>
          ) : quests.length > 0 ? (
            <div className="flex-1 w-full h-full">
              <QuestEditorCanvasWrapper
                quests={quests}
                onQuestSelect={handleQuestSelect}
                onPositionChange={handlePositionChange}
                chapterDefaultShape={activeChapter?.defaultQuestShape}
              />
            </div>
          ) : (
            <div className="w-full h-full flex items-center justify-center text-gray-500 dark:text-gray-400">
              <div className="text-center">
                <p className="text-2xl mb-4">📖</p>
                <p>点击"打开文件"加载 SNBT 任务文件</p>
                <p className="text-sm mt-2">支持单个或多个 .snbt 章节文件</p>
                <p className="text-sm mt-2">或点击"打开文件夹"加载整个 FTBQ 任务书</p>
              </div>
            </div>
          )}

          {/* 任务编辑面板 */}
          {showEditor && selectedQuest && (
            <QuestEditor
              quest={selectedQuest}
              onClose={() => {
                setShowEditor(false);
                setSelectedQuest(null);
              }}
              onSave={handleQuestUpdate}
            />
          )}
        </main>
      </div>
    </ItemAtlasProvider>
  );
}

export default App;
