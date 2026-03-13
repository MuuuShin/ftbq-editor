import { useRef, useState } from 'react';
import { useItemAtlas } from '../context/ItemAtlasContext';

type ImportType = 'jar' | 'texture' | 'json';

export default function ItemAtlasUploader() {
  const { loadJarFiles, isLoading, progress, itemMap, itemNames, clearAtlas } = useItemAtlas();
  const [importType, setImportType] = useState<ImportType>('jar');
  const jarInputRef = useRef<HTMLInputElement>(null);
  const textureInputRef = useRef<HTMLInputElement>(null);
  const jsonInputRef = useRef<HTMLInputElement>(null);

  const handleJarFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (files && files.length > 0) {
      await loadJarFiles(Array.from(files));
    }
  };

  const handleTextureFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (files && files.length > 0) {
      // TODO: 处理贴图文件夹导入
      alert('贴图文件夹导入功能开发中...');
    }
  };

  const handleJsonFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (files && files.length > 0) {
      // TODO: 处理 JSON 文件导入
      alert('JSON 文件导入功能开发中...');
    }
  };

  const handleClick = () => {
    if (importType === 'jar') {
      jarInputRef.current?.click();
    } else if (importType === 'texture') {
      textureInputRef.current?.click();
    } else if (importType === 'json') {
      jsonInputRef.current?.click();
    }
  };

  const handleClear = async () => {
    const { clearJarCache } = await import('../utils/itemAtlas');
    clearJarCache();
    clearAtlas();
  };

  const getButtonText = () => {
    if (isLoading) return '解析中...';
    switch (importType) {
      case 'jar':
        return '🗂️ 加载物品';
      case 'texture':
        return '🖼️ 加载物品';
      case 'json':
        return '📄 加载物品';
      default:
        return '🗂️ 加载物品';
    }
  };

  return (
    <div className="flex items-center gap-2">
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
      <button
        onClick={handleClick}
        disabled={isLoading}
        className="px-3 py-1.5 bg-purple-600 text-white text-sm rounded hover:bg-purple-700 disabled:bg-gray-400"
        title="选择 Mod Jar 文件来加载物品贴图"
      >
        {getButtonText()}
      </button>

      {/* 导入类型选择下拉框 */}
      <select
        value={importType}
        onChange={(e) => setImportType(e.target.value as ImportType)}
        disabled={isLoading}
        className="px-2 py-1.5 text-xs bg-gray-100 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded text-gray-700 dark:text-gray-300 disabled:opacity-50"
        title="选择导入类型"
      >
        <option value="jar">Jar 文件</option>
        <option value="texture">贴图文件</option>
        <option value="json">JSON 文件</option>
      </select>

      {Object.keys(itemMap).length > 0 && (
        <>
          <span className="text-sm text-gray-600 dark:text-gray-400">
            已加载 {Object.keys(itemMap).length} 个贴图，{Object.keys(itemNames).length} 个名称
          </span>
          <button
            onClick={handleClear}
            className="px-2 py-1.5 text-xs bg-red-600 text-white rounded hover:bg-red-700"
            title="清除已加载的物品贴图"
          >
            清除
          </button>
        </>
      )}

      {isLoading && (
        <span className="text-sm text-gray-600 dark:text-gray-400">
          {progress.current} / {progress.total}
        </span>
      )}
    </div>
  );
}
