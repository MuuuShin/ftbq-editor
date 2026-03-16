import { useRef, useState } from 'react';
import { useItemAtlas } from '../context/ItemAtlasContext';

export interface ItemAtlasUploaderProps {
  onShowToast?: (message: string, type: 'success' | 'error' | 'info' | 'warning') => void;
}

export default function ItemAtlasUploader({ onShowToast }: ItemAtlasUploaderProps) {
  const { loadJarFiles, isLoading, itemMap, itemNames, clearAtlas } = useItemAtlas();
  const [showDropdown, setShowDropdown] = useState(false);
  const jarInputRef = useRef<HTMLInputElement>(null);
  const textureInputRef = useRef<HTMLInputElement>(null);
  const jsonInputRef = useRef<HTMLInputElement>(null);

  const handleJarFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (files && files.length > 0) {
      try {
        const result = await loadJarFiles(Array.from(files));

        // 构建详细的成功消息
        const messages: string[] = [];

        if (result.successCount > 0) {
          messages.push(`成功 ${result.successCount} 个文件`);
        }
        if (result.addedItems > 0 || result.addedNames > 0) {
          messages.push(`新增 ${result.addedItems} 个贴图、${result.addedNames} 个名称`);
        }

        // 警告信息
        if (result.duplicateCount > 0) {
          messages.push(`重复 ${result.duplicateCount} 个`);
        }
        if (result.invalidCount > 0) {
          messages.push(`无效 ${result.invalidCount} 个`);
        }
        if (result.emptyCount > 0) {
          messages.push(`无数据 ${result.emptyCount} 个`);
        }

        if (result.successCount > 0) {
          onShowToast?.(messages.join('，'), 'success');
        } else if (result.invalidCount > 0 && result.totalFiles === result.invalidCount) {
          // 全部失败
          onShowToast?.(`全部 ${result.totalFiles} 个文件导入失败，请检查文件格式`, 'error');
        } else if (result.emptyCount > 0 && result.totalFiles === result.emptyCount) {
          // 全部为空数据
          onShowToast?.(`导入的 JAR 文件中没有找到物品贴图或名称数据`, 'warning');
        } else if (result.duplicateCount > 0 && result.totalFiles === result.duplicateCount) {
          // 全部重复
          onShowToast?.(`这些文件之前已经导入过了`, 'info');
        }
      } catch (error) {
        onShowToast?.(`加载失败：${error}`, 'error');
      }
    }
    setShowDropdown(false);
  };

  const handleTextureFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (files && files.length > 0) {
      try {
        const result = await loadJarFiles(Array.from(files));

        // 构建详细的成功消息
        const messages: string[] = [];

        if (result.successCount > 0) {
          messages.push(`成功 ${result.successCount} 个文件`);
        }
        if (result.addedItems > 0 || result.addedNames > 0) {
          messages.push(`新增 ${result.addedItems} 个贴图、${result.addedNames} 个名称`);
        }

        // 警告信息
        if (result.duplicateCount > 0) {
          messages.push(`重复 ${result.duplicateCount} 个`);
        }
        if (result.invalidCount > 0) {
          messages.push(`无效 ${result.invalidCount} 个`);
        }
        if (result.emptyCount > 0) {
          messages.push(`无数据 ${result.emptyCount} 个`);
        }

        if (result.successCount > 0) {
          onShowToast?.(messages.join('，'), 'success');
        } else if (result.invalidCount > 0 && result.totalFiles === result.invalidCount) {
          // 全部失败
          onShowToast?.(`全部 ${result.totalFiles} 个文件导入失败，请检查文件格式`, 'error');
        } else if (result.emptyCount > 0 && result.totalFiles === result.emptyCount) {
          // 全部为空数据
          onShowToast?.(`导入的 JAR 文件中没有找到物品贴图或名称数据`, 'warning');
        } else if (result.duplicateCount > 0 && result.totalFiles === result.duplicateCount) {
          // 全部重复
          onShowToast?.(`这些文件之前已经导入过了`, 'info');
        }
      } catch (error) {
        onShowToast?.(`加载失败：${error}`, 'error');
      }
    }
    setShowDropdown(false);
  };

  const handleJsonFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (files && files.length > 0) {
      // TODO: 处理 JSON 文件导入
      onShowToast?.('JSON 文件导入功能开发中...', 'warning');
    }
    setShowDropdown(false);
  };

  const handleClear = async () => {
    const { clearJarCache } = await import('../utils/itemAtlas');
    clearJarCache();
    clearAtlas();
  };

  const toggleDropdown = () => {
    setShowDropdown(!showDropdown);
  };

  // 统一模式 - 带文本标签的下拉菜单
  return (
    <>
      <input
        ref={jarInputRef}
        type="file"
        accept=".jar"
        multiple
        onChange={handleJarFileSelect}
        className="hidden"
      />
      <input
        ref={textureInputRef}
        type="file"
        accept=".png"
        multiple
        onChange={handleTextureFileSelect}
        className="hidden"
      />
      <input
        ref={jsonInputRef}
        type="file"
        accept=".json"
        multiple
        onChange={handleJsonFileSelect}
        className="hidden"
      />

      <div className="relative flex items-center gap-2">
        <button
          onClick={toggleDropdown}
          disabled={isLoading}
          className={`px-3 py-1.5 text-sm rounded flex-shrink-0 ${isLoading ? 'bg-gray-400 cursor-not-allowed' : 'bg-purple-600 hover:bg-purple-700 text-white'} flex items-center gap-1`}
          title="加载物品贴图"
        >
          {isLoading ? '⏳' : '🗂️'} 加载物品
          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>

          {showDropdown && (
            <>
              <div
                className="fixed inset-0 z-10"
                onClick={() => setShowDropdown(false)}
              />
              <div className="absolute top-full right-0 mt-1 bg-white dark:bg-gray-700 rounded shadow-lg border border-gray-200 dark:border-gray-600 z-20 min-w-[160px]">
                <button
                  onClick={() => { jarInputRef.current?.click(); }}
                  className="w-full px-3 py-2 text-sm text-left hover:bg-gray-100 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 flex items-center gap-2"
                >
                  📦 Jar 文件
                </button>
                <button
                  onClick={() => { textureInputRef.current?.click(); }}
                  className="w-full px-3 py-2 text-sm text-left hover:bg-gray-100 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 flex items-center gap-2"
                >
                  🖼️ 贴图文件
                </button>
                <button
                  onClick={() => { jsonInputRef.current?.click(); }}
                  className="w-full px-3 py-2 text-sm text-left hover:bg-gray-100 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 flex items-center gap-2"
                >
                  📄 JSON 文件
                </button>
                {Object.keys(itemMap).length > 0 && (
                  <>
                    <div className="border-t border-gray-200 dark:border-gray-600 my-1" />
                    <div className="px-3 py-1.5 text-xs text-gray-600 dark:text-gray-400">
                      已加载：{Object.keys(itemMap).length} 个贴图，{Object.keys(itemNames).length} 个名称
                    </div>
                    <button
                      onClick={handleClear}
                      className="w-full px-3 py-2 text-sm text-left hover:bg-red-100 dark:hover:bg-red-900/30 text-red-600 dark:text-red-400"
                    >
                      🗑️ 清除贴图
                    </button>
                  </>
                )}
              </div>
            </>
          )}
        </div>
      </>
  );
}
