import { useState, useMemo } from 'react';
import { useItemAtlas } from '../context/ItemAtlasContext';
import { parseItemId } from '../utils/itemAtlas';

export default function ItemAtlasViewer() {
  const { itemMap, itemNames, clearAtlas } = useItemAtlas();
  const [searchTerm, setSearchTerm] = useState('');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

  // 生成带 label 的物品列表 - label 优先使用物品名，没有则使用 ID
  const itemsWithLabels = useMemo(() => {
    return Object.entries(itemMap).map(([id, url]) => {
      const parsedId = parseItemId(id);
      const label = itemNames[parsedId] || id;
      return { id, parsedId, url, label };
    });
  }, [itemMap, itemNames]);

  // 过滤和排序物品列表 - 根据 label 搜索
  const filteredItems = useMemo(() => {
    if (!searchTerm) return itemsWithLabels;

    const lowerTerm = searchTerm.toLowerCase();
    return itemsWithLabels.filter(({ id, parsedId, label }) => {
      return id.toLowerCase().includes(lowerTerm) ||
             parsedId.toLowerCase().includes(lowerTerm) ||
             label.toLowerCase().includes(lowerTerm);
    });
  }, [itemsWithLabels, searchTerm]);

  // 按命名空间分组
  const groupedItems = useMemo(() => {
    const groups: Record<string, typeof filteredItems> = {};
    filteredItems.forEach((item) => {
      const namespace = item.parsedId.split(':')[0] || 'unknown';
      if (!groups[namespace]) groups[namespace] = [];
      groups[namespace].push(item);
    });
    return groups;
  }, [filteredItems]);

  if (Object.keys(itemMap).length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-gray-500 dark:text-gray-400">
        <p className="text-4xl mb-4">📭</p>
        <p>还没有加载任何物品贴图</p>
        <p className="text-sm mt-2">点击顶部工具栏的"🗂️ 加载物品贴图"按钮来选择 mod jar 文件</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-gray-100 dark:bg-gray-900">
      {/* 顶部工具栏 */}
      <div className="p-4 bg-white dark:bg-gray-800 border-b border-gray-300 dark:border-gray-700">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold text-gray-800 dark:text-white">
            物品贴图浏览器 ({Object.keys(itemMap).length} 个贴图，{Object.keys(itemNames).length} 个名称)
          </h2>
          <button
            onClick={clearAtlas}
            className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 text-sm"
          >
            清除所有贴图
          </button>
        </div>

        <div className="flex gap-2">
          {/* 搜索框 */}
          <input
            type="text"
            placeholder="搜索物品 ID 或名称..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-800 dark:text-white"
          />

          {/* 视图切换 */}
          <div className="flex border border-gray-300 dark:border-gray-600 rounded overflow-hidden">
            <button
              onClick={() => setViewMode('grid')}
              className={`px-3 py-2 ${viewMode === 'grid' ? 'bg-blue-500 text-white' : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300'}`}
              title="网格视图"
            >
              ⊞
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`px-3 py-2 ${viewMode === 'list' ? 'bg-blue-500 text-white' : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300'}`}
              title="列表视图"
            >
              ☰
            </button>
          </div>
        </div>

        {searchTerm && (
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
            找到 {filteredItems.length} 个匹配的物品
          </p>
        )}
      </div>

      {/* 物品列表 */}
      <div className="flex-1 overflow-auto p-4">
        {viewMode === 'grid' ? (
          /* 网格视图 */
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 xl:grid-cols-10 2xl:grid-cols-12 gap-3">
            {filteredItems.map(({ id, parsedId, url, label }) => (
              <div
                key={id}
                className="group relative bg-white dark:bg-gray-800 rounded border border-gray-300 dark:border-gray-700 p-2 hover:border-blue-500 dark:hover:border-blue-400 cursor-pointer hover:z-50"
                title={label}
              >
                <div className="aspect-square flex items-center justify-center">
                  <img src={url} alt={label} className="max-w-full max-h-full object-contain" />
                </div>
                <p className="text-xs text-gray-600 dark:text-gray-400 truncate mt-1 font-medium" title={label}>
                  {label}
                </p>
                {label !== parsedId && (
                  <p className="text-xs text-gray-400 dark:text-gray-500 truncate" title={parsedId}>
                    {parsedId}
                  </p>
                )}

                {/* 悬停显示完整信息 - 使用向上弹出的方式避免被裁剪 */}
                <div
                  className="pointer-events-none absolute inset-x-0 bottom-full mb-1 mx-2 bg-black/90 text-white text-xs rounded p-2 opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <div className="font-semibold truncate">{label}</div>
                  <div className="text-gray-400 truncate">{parsedId}</div>
                  <div className="text-gray-500 truncate">{id}</div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          /* 列表视图 - 按命名空间分组 */
          <div className="space-y-4">
            {Object.entries(groupedItems).map(([namespace, items]) => (
              <div key={namespace} className="bg-white dark:bg-gray-800 rounded border border-gray-300 dark:border-gray-700 overflow-hidden">
                <div className="px-4 py-2 bg-gray-100 dark:bg-gray-700 border-b border-gray-300 dark:border-gray-600">
                  <h3 className="font-semibold text-gray-800 dark:text-white">
                    {namespace} <span className="text-sm text-gray-500">({items.length})</span>
                  </h3>
                </div>
                <div className="divide-y divide-gray-200 dark:divide-gray-700">
                  {items.map(({ id, parsedId, url, label }) => (
                    <div key={id} className="flex items-center gap-3 p-2 hover:bg-gray-50 dark:hover:bg-gray-700">
                      <div className="w-10 h-10 flex-shrink-0 bg-gray-100 dark:bg-gray-700 rounded flex items-center justify-center">
                        <img src={url} alt={label} className="max-w-full max-h-full object-contain" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm text-gray-800 dark:text-gray-200 font-medium truncate">
                          {label}
                        </div>
                        <code className="text-xs text-gray-500 dark:text-gray-400 truncate block">
                          {parsedId}
                        </code>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {filteredItems.length === 0 && searchTerm && (
          <div className="text-center py-12 text-gray-500 dark:text-gray-400">
            <p className="text-4xl mb-2">🔍</p>
            <p>没有找到匹配 "{searchTerm}" 的物品</p>
          </div>
        )}
      </div>
    </div>
  );
}
