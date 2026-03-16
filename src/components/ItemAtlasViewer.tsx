import { useState, useMemo, useEffect } from 'react';
import { useItemAtlas } from '../context/ItemAtlasContext';
import { parseItemId } from '../utils/itemAtlas';
import PixelImage from './PixelImage';
import ItemDetailModal, { type ItemDetailData } from './ItemDetailModal';

const ITEMS_PER_PAGE = 50;

export default function ItemAtlasViewer() {
  const { itemMap, itemNames, itemSources, clearAtlas } = useItemAtlas();
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedItem, setSelectedItem] = useState<ItemDetailData | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [selectedListItem, setSelectedListItem] = useState<ItemDetailData | null>(null);

  // 重置页码当搜索词变化时
  useEffect(() => {
    setCurrentPage(1);
  }, [debouncedSearchTerm]);

  // 搜索防抖 (300ms)
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm);
    }, 300);

    return () => clearTimeout(timer);
  }, [searchTerm]);

  // 生成带 label 的物品列表 - label 优先使用物品名，没有则使用 ID
  const itemsWithLabels = useMemo(() => {
    return Object.entries(itemMap).map(([id, url]) => {
      const parsedId = parseItemId(id);
      const label = itemNames[parsedId] || id;
      const source = itemSources[parsedId];
      return {
        id,
        parsedId,
        url,
        label,
        sourceJar: source?.sourceJar,
        sourcePath: source?.sourcePath,
        jsonPath: source?.jsonPath,
        jsonKey: source?.jsonKey,
        textureJsonPath: source?.textureJsonPath,
      };
    });
  }, [itemMap, itemNames, itemSources]);

  // 过滤和排序物品列表 - 根据 label 搜索 (使用防抖后的搜索词)
  const filteredItems = useMemo(() => {
    if (!debouncedSearchTerm) return itemsWithLabels;

    const lowerTerm = debouncedSearchTerm.toLowerCase();
    return itemsWithLabels.filter(({ id, parsedId, label }) => {
      return id.toLowerCase().includes(lowerTerm) ||
             parsedId.toLowerCase().includes(lowerTerm) ||
             label.toLowerCase().includes(lowerTerm);
    });
  }, [itemsWithLabels, debouncedSearchTerm]);

  // 分页计算
  const totalPages = Math.ceil(filteredItems.length / ITEMS_PER_PAGE);
  const paginatedItems = useMemo(() => {
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    const endIndex = startIndex + ITEMS_PER_PAGE;
    return filteredItems.slice(startIndex, endIndex);
  }, [filteredItems, currentPage]);

  // 按命名空间分组（用于列表视图）
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

        {/* 分页控制器 */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between mt-4">
            <button
              onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
              disabled={currentPage === 1}
              className="px-3 py-1.5 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded hover:bg-gray-300 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
            >
              ← 上一页
            </button>
            <span className="text-sm text-gray-600 dark:text-gray-400">
              第 {currentPage} 页 / 共 {totalPages} 页 ({filteredItems.length} 个物品)
            </span>
            <button
              onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
              disabled={currentPage === totalPages}
              className="px-3 py-1.5 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded hover:bg-gray-300 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
            >
              下一页 →
            </button>
          </div>
        )}
      </div>

      {/* 物品列表 */}
      <div className="flex-1 overflow-auto p-4">
        {viewMode === 'grid' ? (
          /* 网格视图 */
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 xl:grid-cols-10 2xl:grid-cols-12 gap-3">
            {paginatedItems.map((item) => (
              <div
                key={item.id}
                className="group relative bg-white dark:bg-gray-800 rounded border border-gray-300 dark:border-gray-700 p-2 hover:border-blue-500 dark:hover:border-blue-400 cursor-pointer transition-all duration-200"
                onClick={() => { setSelectedItem(item); setShowModal(true); }}
              >
                <div className="aspect-square flex items-center justify-center">
                  <PixelImage src={item.url} alt={item.label} size="100%" className="max-w-full max-h-full object-contain" />
                </div>
                <p className="text-xs text-gray-600 dark:text-gray-400 truncate mt-1 font-medium" title={item.label}>
                  {item.label}
                </p>
                {item.label !== item.parsedId && (
                  <p className="text-xs text-gray-400 dark:text-gray-500 truncate" title={item.parsedId}>
                    {item.parsedId}
                  </p>
                )}

                {/* 悬停时背景变暗，在网格项上叠加显示信息 */}
                <div
                  className="pointer-events-none absolute inset-0 bg-black/80 text-white text-xs rounded p-2 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-end"
                >
                  <div className="font-semibold truncate">{item.label}</div>
                  <div className="text-gray-300 truncate">{item.parsedId}</div>
                  <div className="text-gray-400 truncate">{item.id}</div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          /* 列表视图 - 左右分栏布局 */
          <div className="flex h-full gap-4">
            {/* 左侧：物品列表 */}
            <div className="w-72 flex-shrink-0 flex flex-col border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800">
              <div className="p-3 border-b border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-700">
                <h3 className="font-semibold text-gray-800 dark:text-white text-sm">
                  物品列表 ({filteredItems.length})
                </h3>
              </div>
              <div className="flex-1 overflow-y-auto">
                {Object.entries(groupedItems).map(([namespace, items]) => (
                  <div key={namespace}>
                    <div className="px-3 py-2 bg-gray-100 dark:bg-gray-700 border-b border-gray-300 dark:border-gray-600">
                      <h4 className="font-semibold text-gray-700 dark:text-white text-xs uppercase">
                        {namespace} <span className="text-gray-500">({items.length})</span>
                      </h4>
                    </div>
                    {items.map((item) => {
                      const isSelected = selectedListItem?.id === item.id;
                      return (
                        <div
                          key={item.id}
                          className={`flex items-center gap-2 p-2 cursor-pointer transition-colors ${
                            isSelected
                              ? 'bg-blue-100 dark:bg-blue-900/30 border-l-2 border-blue-500'
                              : 'hover:bg-gray-50 dark:hover:bg-gray-700 border-l-2 border-transparent'
                          }`}
                          onClick={() => setSelectedListItem(item)}
                        >
                          <div className="w-8 h-8 flex-shrink-0 bg-gray-100 dark:bg-gray-600 rounded flex items-center justify-center">
                            <PixelImage src={item.url} alt={item.label} size={32} className="max-w-full max-h-full object-contain" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="text-sm text-gray-800 dark:text-gray-200 font-medium truncate">
                              {item.label}
                            </div>
                            <code className="text-xs text-gray-500 dark:text-gray-400 truncate block">
                              {item.parsedId}
                            </code>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ))}
              </div>
            </div>

            {/* 右侧：物品详情面板 */}
            <div className="flex-1 flex flex-col border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800">
              {selectedListItem ? (
                <>
                  {/* 详情面板头部 */}
                  <div className="p-4 border-b border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-700">
                    <h3 className="text-lg font-bold text-gray-800 dark:text-white">{selectedListItem.label}</h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                      命名空间：{selectedListItem.parsedId.split(':')[0] || 'unknown'}
                    </p>
                  </div>

                  {/* 详情面板内容 */}
                  <div className="flex-1 p-6 overflow-auto">
                    {/* 物品图片 */}
                    <div className="flex justify-center mb-6">
                      <div className="w-48 h-48 bg-gray-100 dark:bg-gray-700 rounded-lg p-6 flex items-center justify-center shadow-inner">
                        <PixelImage
                          src={selectedListItem.url}
                          alt={selectedListItem.label}
                          size={128}
                          className="max-w-full max-h-full object-contain"
                        />
                      </div>
                    </div>

                    {/* 物品信息 */}
                    <div className="space-y-4 max-w-md mx-auto">
                      <div>
                        <label className="text-xs text-gray-500 dark:text-gray-400 uppercase block mb-1">物品名称</label>
                        <p className="text-base font-semibold text-gray-800 dark:text-white">{selectedListItem.label}</p>
                      </div>

                      <div>
                        <label className="text-xs text-gray-500 dark:text-gray-400 uppercase block mb-1">物品 ID</label>
                        <code className="text-sm text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 px-3 py-2 rounded block">
                          {selectedListItem.parsedId}
                        </code>
                      </div>

                      <div>
                        <label className="text-xs text-gray-500 dark:text-gray-400 uppercase block mb-1">完整 ID</label>
                        <code className="text-sm text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 px-3 py-2 rounded block break-all">
                          {selectedListItem.id}
                        </code>
                      </div>

                      {selectedListItem.sourceJar && (
                        <>
                          <div>
                            <label className="text-xs text-gray-500 dark:text-gray-400 uppercase block mb-1">来源 JAR</label>
                            <p className="text-sm text-gray-700 dark:text-gray-300" title={selectedListItem.sourceJar}>
                              {selectedListItem.sourceJar}
                            </p>
                          </div>

                          <div>
                            <label className="text-xs text-gray-500 dark:text-gray-400 uppercase block mb-1">贴图路径</label>
                            <code className="text-xs text-gray-600 dark:text-gray-400 bg-gray-100 dark:bg-gray-700 px-3 py-2 rounded block break-all">
                              {selectedListItem.sourcePath}
                            </code>
                          </div>

                          {selectedListItem.textureJsonPath && (
                            <div>
                              <label className="text-xs text-gray-500 dark:text-gray-400 uppercase block mb-1">纹理 JSON</label>
                              <code className="text-xs text-gray-600 dark:text-gray-400 bg-gray-100 dark:bg-gray-700 px-3 py-2 rounded block break-all">
                                {selectedListItem.textureJsonPath}
                              </code>
                            </div>
                          )}

                          {selectedListItem.jsonPath && (
                            <div>
                              <label className="text-xs text-gray-500 dark:text-gray-400 uppercase block mb-1">JSON 来源</label>
                              <code className="text-xs text-gray-600 dark:text-gray-400 bg-gray-100 dark:bg-gray-700 px-3 py-2 rounded block break-all">
                                {selectedListItem.jsonPath}
                              </code>
                              {selectedListItem.jsonKey && (
                                <code className="text-xs text-gray-500 dark:text-gray-500 block mt-1">
                                  键：{selectedListItem.jsonKey}
                                </code>
                              )}
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  </div>

                  {/* 详情面板底部 */}
                  <div className="p-4 border-t border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-700">
                    <button
                      onClick={() => { setSelectedItem(selectedListItem); setShowModal(true); }}
                      className="w-full py-2 bg-blue-600 hover:bg-blue-700 text-white rounded font-medium transition-colors"
                    >
                      查看大图
                    </button>
                  </div>
                </>
              ) : (
                <div className="flex-1 flex items-center justify-center text-gray-500 dark:text-gray-400">
                  <div className="text-center">
                    <p className="text-5xl mb-4">📦</p>
                    <p className="text-lg">点击左侧物品查看详情</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {filteredItems.length === 0 && searchTerm && (
          <div className="text-center py-12 text-gray-500 dark:text-gray-400">
            <p className="text-4xl mb-2">🔍</p>
            <p>没有找到匹配 "{searchTerm}" 的物品</p>
          </div>
        )}
      </div>

      {/* 物品详情模态窗口 - 网格视图 */}
      {showModal && selectedItem && (
        <ItemDetailModal
          item={selectedItem}
          onClose={() => setShowModal(false)}
        />
      )}
    </div>
  );
}
