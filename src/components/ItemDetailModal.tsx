import { PixelImage } from './PixelImage';

export interface ItemDetailData {
  id: string;
  parsedId: string;
  url: string;
  label: string;
  sourceJar?: string;
  sourcePath?: string;
  jsonPath?: string;
  jsonKey?: string;
  textureJsonPath?: string;
}

export interface ItemDetailModalProps {
  item: ItemDetailData;
  onClose: () => void;
  showCloseButton?: boolean;
}

/**
 * 物品详情弹窗组件
 * 用于网格视图和列表视图的统一物品详情展示
 */
export default function ItemDetailModal({
  item,
  onClose,
  showCloseButton = true,
}: ItemDetailModalProps) {
  return (
    <div
      className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-gray-800 rounded-lg shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 模态窗口头部 */}
        <div className="flex justify-between items-center p-4 border-b border-gray-300 dark:border-gray-600 sticky top-0 bg-white dark:bg-gray-800">
          <h3 className="text-lg font-bold text-gray-800 dark:text-white">物品详情</h3>
          {showCloseButton && (
            <button
              onClick={onClose}
              className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-white text-2xl leading-none"
            >
              ×
            </button>
          )}
        </div>

        {/* 模态窗口内容 */}
        <div className="p-6">
          {/* 物品图片 */}
          <div className="flex justify-center mb-6">
            <div className="w-32 h-32 bg-gray-100 dark:bg-gray-700 rounded-lg p-4 flex items-center justify-center">
              <PixelImage
                src={item.url}
                alt={item.label}
                size={96}
                className="max-w-full max-h-full object-contain"
              />
            </div>
          </div>

          {/* 物品信息 */}
          <div className="space-y-3">
            <div>
              <label className="text-xs text-gray-500 dark:text-gray-400 uppercase">物品名称</label>
              <p className="text-lg font-semibold text-gray-800 dark:text-white">{item.label}</p>
            </div>

            <div>
              <label className="text-xs text-gray-500 dark:text-gray-400 uppercase">物品 ID</label>
              <code className="text-sm text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded block mt-1">
                {item.parsedId}
              </code>
            </div>

            <div>
              <label className="text-xs text-gray-500 dark:text-gray-400 uppercase">完整 ID</label>
              <code className="text-sm text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded block mt-1 break-all">
                {item.id}
              </code>
            </div>

            <div>
              <label className="text-xs text-gray-500 dark:text-gray-400 uppercase">命名空间</label>
              <p className="text-sm text-gray-700 dark:text-gray-300">
                {item.parsedId.split(':')[0] || 'unknown'}
              </p>
            </div>

            {item.sourceJar && (
              <>
                <div>
                  <label className="text-xs text-gray-500 dark:text-gray-400 uppercase">来源 JAR</label>
                  <p className="text-sm text-gray-700 dark:text-gray-300" title={item.sourceJar}>
                    {item.sourceJar}
                  </p>
                </div>

                <div>
                  <label className="text-xs text-gray-500 dark:text-gray-400 uppercase">贴图路径</label>
                  <code className="text-xs text-gray-600 dark:text-gray-400 bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded block mt-1 break-all">
                    {item.sourcePath}
                  </code>
                </div>

                {item.textureJsonPath && (
                  <div>
                    <label className="text-xs text-gray-500 dark:text-gray-400 uppercase">纹理 JSON</label>
                    <code className="text-xs text-gray-600 dark:text-gray-400 bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded block mt-1 break-all">
                      {item.textureJsonPath}
                    </code>
                  </div>
                )}

                {item.jsonPath && (
                  <>
                    <div>
                      <label className="text-xs text-gray-500 dark:text-gray-400 uppercase">JSON 来源</label>
                      <code className="text-xs text-gray-600 dark:text-gray-400 bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded block mt-1 break-all">
                        {item.jsonPath}
                      </code>
                      {item.jsonKey && (
                        <code className="text-xs text-gray-500 dark:text-gray-500 block mt-1">
                          键：{item.jsonKey}
                        </code>
                      )}
                    </div>
                  </>
                )}
              </>
            )}
          </div>
        </div>

        {/* 模态窗口底部 */}
        <div className="p-4 border-t border-gray-300 dark:border-gray-600 sticky bottom-0 bg-white dark:bg-gray-800">
          <button
            onClick={onClose}
            className="w-full py-2 bg-blue-600 hover:bg-blue-700 text-white rounded font-medium"
          >
            关闭
          </button>
        </div>
      </div>
    </div>
  );
}
