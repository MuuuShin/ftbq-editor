import { useState, useCallback, useRef } from 'react';
import { Quest } from './types';
import { readSNBTFile, exportSNBTFile, extractQuests } from './utils/snbt';
import { QuestEditorCanvasWrapper } from './components/QuestEditorCanvas';
import { QuestEditor } from './components/QuestEditor';
import { ItemAtlasProvider } from './context/ItemAtlasContext';
import ItemAtlasUploader from './components/ItemAtlasUploader';
import ItemAtlasViewer from './components/ItemAtlasViewer';

interface ChapterFile {
  name: string;
  file: File;
  data: any;
  quests: Quest[];
}

/**
 * 主应用组件
 */
function App() {
  // 当前加载的章节文件列表
  const [chapterFiles, setChapterFiles] = useState<ChapterFile[]>([]);
  // 当前有焦点的章节文件索引
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

  // 当前激活的章节数据
  const activeChapter = activeChapterIndex >= 0 ? chapterFiles[activeChapterIndex] : null;
  const fileName = activeChapter?.name || '';

  // 处理文件导入 - 支持单个文件或多文件（文件夹）
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
        });
      }

      if (newChapters.length === 0) {
        alert('未找到有效的 .snbt 文件');
        return;
      }

      // 添加到章节列表
      setChapterFiles((prev) => [...prev, ...newChapters]);

      // 如果之前没有激活的章节，激活第一个新导入的章节
      if (activeChapterIndex < 0) {
        setActiveChapterIndex(0);
        setQuests(newChapters[0].quests);
      }

      // 打开章节列表侧边栏
      setShowChapterList(true);
    } catch (error) {
      alert(`文件加载失败：${error}`);
    }

    // 重置 input 以允许重复选择同一文件
    event.target.value = '';
  }, [activeChapterIndex]);

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

    // 同步更新章节文件中的数据
    setChapterFiles((prev) => {
      const newFiles = [...prev];
      if (newFiles[activeChapterIndex]) {
        const chapter = newFiles[activeChapterIndex];
        chapter.quests = chapter.quests.map((q: Quest) =>
          q.id === updatedQuest.id ? updatedQuest : q
        );
        // 同步更新原始 SNBT 数据
        chapter.data.quests = chapter.quests;
      }
      return newFiles;
    });

    setShowEditor(false);
    setSelectedQuest(null);
  }, [activeChapterIndex]);

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
    if (index < 0 || index >= chapterFiles.length) return;

    setActiveChapterIndex(index);
    setQuests(chapterFiles[index].quests);
    setShowEditor(false);
    setSelectedQuest(null);
  }, [chapterFiles]);

  // 删除章节
  const handleChapterDelete = useCallback((index: number, event: React.MouseEvent) => {
    event.stopPropagation();

    setChapterFiles((prev) => {
      const newFiles = prev.filter((_, i) => i !== index);

      // 如果删除的是当前激活的章节
      if (index === activeChapterIndex) {
        // 激活前一个章节（如果没有则为 -1）
        const newIndex = index > 0 ? index - 1 : (newFiles.length > 0 ? 0 : -1);
        setActiveChapterIndex(newIndex);
        if (newIndex >= 0) {
          setQuests(newFiles[newIndex].quests);
        } else {
          setQuests([]);
        }
        setShowEditor(false);
        setSelectedQuest(null);
      } else if (index < activeChapterIndex) {
        // 如果删除的章节在当前激活章节之前，更新索引
        setActiveChapterIndex(activeChapterIndex - 1);
      }

      return newFiles;
    });
  }, [activeChapterIndex]);

  // 触发文件选择
  const triggerFileSelect = () => {
    fileInputRef.current?.click();
  };

  // 切换章节列表侧边栏
  const toggleChapterList = () => {
    setShowChapterList(!showChapterList);
  };

  return (
    <ItemAtlasProvider>
      <div className="w-screen h-screen flex flex-col bg-gray-100 dark:bg-gray-900">
        {/* 隐藏的 SVG 定义 - 用于箭头 marker */}
        <svg className="hidden">
          <defs>
            <marker id="edge-arrow" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="8" markerHeight="8" orient="auto-start-reverse">
              <path d="M 0 0 L 10 5 L 0 10 L 0 0" fill="#6366f1" />
            </marker>
          </defs>
        </svg>

        {/* 隐藏的文件输入 - 支持多选和文件夹 */}
        <input
          ref={fileInputRef}
          type="file"
          accept=".snbt,.txt"
          multiple
          onChange={handleFileImport}
          className="hidden"
        />

        {/* 顶部工具栏 */}
        <header className="toolbar h-auto min-h-14 flex items-center flex-wrap gap-2 px-3 py-2 shrink-0">
          <div className="flex items-center gap-2 flex-shrink-0">
            <h1 className="text-lg font-bold text-gray-800 dark:text-white whitespace-nowrap">
              FTBQ Editor
            </h1>
            <div className="flex items-center gap-1">
              <button
                onClick={triggerFileSelect}
                className="bg-blue-500 hover:bg-blue-600 text-white font-medium py-1.5 px-3 rounded text-sm whitespace-nowrap"
                title="打开 SNBT 文件或文件夹"
              >
                📂 打开
              </button>
              <button
                onClick={handleFileExport}
                disabled={!activeChapter}
                className="bg-green-500 hover:bg-green-600 disabled:bg-gray-400 disabled:cursor-not-allowed text-white font-medium py-1.5 px-3 rounded text-sm whitespace-nowrap"
                title="保存当前章节"
              >
                💾 保存
              </button>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0 ml-auto">
            {/* 章节列表切换按钮 */}
            {chapterFiles.length > 0 && (
              <button
                onClick={toggleChapterList}
                className={`px-2 py-1.5 text-sm rounded flex-shrink-0 ${showChapterList ? 'bg-indigo-600 text-white' : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600'}`}
                title="章节列表"
              >
                📑 章节 ({chapterFiles.length})
              </button>
            )}
            {fileName && (
              <span className="text-xs text-gray-600 dark:text-gray-400 truncate max-w-[150px]" title={fileName}>
                {fileName}
              </span>
            )}
            {/* 物品贴图加载器按钮 */}
            <ItemAtlasUploader />
            {/* 物品浏览器切换按钮 */}
            <button
              onClick={() => setShowAtlasViewer(!showAtlasViewer)}
              className={`px-2 py-1.5 text-sm rounded flex-shrink-0 ${showAtlasViewer ? 'bg-indigo-600 text-white' : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600'}`}
              title="查看已加载的物品贴图"
            >
              📖 物品浏览器
            </button>
          </div>
        </header>

        {/* 主内容区域 */}
        <main className="flex-1 flex overflow-hidden">
          {/* 章节列表侧边栏 */}
          {showChapterList && (
            <aside className="w-80 bg-white dark:bg-gray-800 border-r border-gray-300 dark:border-gray-600 overflow-y-auto">
              <div className="p-3 border-b border-gray-300 dark:border-gray-600 sticky top-0 bg-white dark:bg-gray-800 z-10">
                <div className="flex justify-between items-center">
                  <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                    章节列表 ({chapterFiles.length})
                  </h3>
                  <button
                    onClick={toggleChapterList}
                    className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-white"
                  >
                    ✕
                  </button>
                </div>
              </div>
              <div className="p-2 space-y-2">
                {chapterFiles.map((chapter, chapterIndex) => (
                  <div
                    key={chapterIndex}
                    className={`rounded border border-gray-200 dark:border-gray-700 overflow-hidden ${
                      chapterIndex === activeChapterIndex
                        ? 'border-blue-500 ring-1 ring-blue-500'
                        : ''
                    }`}
                  >
                    <div
                      className={`flex justify-between items-center px-3 py-2 cursor-pointer transition-colors ${
                        chapterIndex === activeChapterIndex
                          ? 'bg-blue-500 text-white'
                          : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                      }`}
                    >
                      <span
                        className="text-sm truncate flex-1"
                        title={chapter.name}
                        onClick={() => handleChapterSelect(chapterIndex)}
                      >
                        {chapter.name}
                      </span>
                      <button
                        onClick={(e) => handleChapterDelete(chapterIndex, e)}
                        className="ml-2 p-1 hover:bg-red-500 hover:text-white rounded transition-opacity"
                        title="删除章节"
                      >
                        🗑️
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </aside>
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
              />
            </div>
          ) : (
            <div className="w-full h-full flex items-center justify-center text-gray-500 dark:text-gray-400">
              <div className="text-center">
                <p className="text-2xl mb-4">📖</p>
                <p>点击"打开"加载 SNBT 任务文件</p>
                <p className="text-sm mt-2">支持 .snbt 格式的 FTB Quests 章节文件，可一次打开多个</p>
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
