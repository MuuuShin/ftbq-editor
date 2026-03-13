import { memo, type JSX, useState } from 'react';
import { Handle, Position } from '@xyflow/react';
import { QuestNodeData } from '../types';
import { useItemAtlas } from '../context/ItemAtlasContext';
import { parseItemId } from '../utils/itemAtlas';

interface QuestNodeProps {
  id: string;
  data: QuestNodeData;
  selected?: boolean;
  type?: string;
}

// 形状到贴图路径的映射
const shapeToTexture: Record<string, string> = {
  circle: '/shapes/circle/shape.png',
  gear: '/shapes/gear/shape.png',
  hexagon: '/shapes/hexagon/shape.png',
  diamond: '/shapes/diamond/shape.png',
  pentagon: '/shapes/pentagon/shape.png',
  octagon: '/shapes/octagon/shape.png',
  none: '',
};

/**
 * 任务节点组件
 * 默认只显示图标，鼠标悬停时显示标题和副标题
 * 节点位置为中心点定位
 */
function QuestNode({ data, id, selected }: QuestNodeProps): JSX.Element {
  const { quest } = data;
  const { itemMap, itemNames } = useItemAtlas();
  const [isHovered, setIsHovered] = useState(false);

  const shape = quest.shape || 'circle';
  const shapeTexture = shapeToTexture[shape] || shapeToTexture['circle'];
  const size = quest.size || 1;

  // 如果节点有隐藏连线属性，添加 data 属性
  const hasHideDependencyLines = !!quest.hide_dependency_lines;
  const hasHideDependentLines = !!quest.hide_dependent_lines;

  // 根据 size 计算节点直径（游戏单位转像素，1 单位 = 32px）
  // size 即为节点直径（从上端点到下端点的距离）
  const nodeDiameter = size * 32 * 0.9;
  const nodeRadius = nodeDiameter / 2;

  // 获取物品的 item 或 dimension 字段
  const getItemOrDimension = (task: any) => {
    if (!task) return undefined;
    // 优先使用 item 字段
    if (task.item) {
      return typeof task.item === 'object' ? task.item.id : task.item;
    }
    // 使用 dimension 字段（维度任务）
    if (task.dimension) {
      return typeof task.dimension === 'object' ? task.dimension.id : task.dimension;
    }
    return undefined;
  };

  // 从物品对象中获取 title 字段
  const getItemTitle = (task: any) => {
    if (!task) return undefined;
    // 如果 task 本身有 title 字段（如 checkmark 任务）
    if (task.title) {
      return task.title;
    }
    return undefined;
  };

  // 遍历所有 task 查找第一个有效的 label
  const findLabelFromTasks = () => {
    if (!quest.tasks || quest.tasks.length === 0) return undefined;

    for (const task of quest.tasks) {
      // 1. 先检查 task 是否有 title
      const taskTitle = getItemTitle(task);
      if (taskTitle) return taskTitle;

      // 2. 检查 item 或 dimension 对应的名称
      const itemOrDim = getItemOrDimension(task);
      if (itemOrDim) {
        const parsedId = parseItemId(itemOrDim);
        // 从 jar 包中查找名称，将名称和id一起返回
        if (parsedId && itemNames[parsedId]) {
          return itemNames[parsedId]
        }
        // 返回 ID 作为后备
        return parsedId;
      }

      // 3. checkmark 任务
      if (task.type === 'checkmark') {
        return 'Checkmark';
      }
    }
    return undefined;
  };

  // 获取图标：优先级 quest.icon > itemId 对应的 jar 包图标
  const getIconUrl = () => {
    // 1. 优先使用 quest.icon
    if (quest.icon) {
      return quest.icon;
    }

    // 2. 从第一个任务的 item/dimension 获取图标
    const firstTask = quest.tasks && quest.tasks.length > 0 ? quest.tasks[0] : undefined;
    const itemOrDim = firstTask ? getItemOrDimension(firstTask) : undefined;
    if (itemOrDim) {
      const parsedId = parseItemId(itemOrDim);
      if (parsedId && itemMap[parsedId]) {
        return itemMap[parsedId];
      }
    }

    return undefined;
  };

  const iconUrl = getIconUrl();

  // label 显示逻辑优先级：
  // 1. quest.title
  // 2. task.title（第一个任务的 title 字段）
  // 3. 从 jar 包中查找物品名称
  // 4. 物品 ID / dimension ID
  // 5. checkmark 任务显示 "Checkmark"
  // 6. "Untitled"
  const displayLabel = quest.title || findLabelFromTasks() || 'Untitled';

  // 判断是否为微型节点（size <= 0.25）
  const isTinyNode = size <= 0.25;

  // 计算节点透明度和隐藏状态类型
  // invisible: true - 25% 透明，悬浮/选中恢复正常
  // hide_until_deps_complete: true - 50% 透明，悬浮/选中恢复正常
  // hide_until_deps_visible: true - 50% 透明，悬浮/选中恢复正常
  // size <= 0.25 - 置于最底层，透明度保持 1，不显示悬浮框
  const getOpacityInfo = () => {
    if (quest.invisible) {
      return {
        baseOpacity: 0.25,
        type: 'invisible',
        label: '不可见任务',
      };
    }
    if (quest.hide_until_deps_complete) {
      return {
        baseOpacity: 0.5,
        type: 'hide_until_deps_complete',
        label: '前置任务完成后可见',
      };
    }
    if (quest.hide_until_deps_visible) {
      return {
        baseOpacity: 0.5,
        type: 'hide_until_deps_visible',
        label: '前置任务可见后可见',
      };
    }
    return { baseOpacity: 1, type: 'normal', label: null };
  };

  const { baseOpacity, label: opacityLabel } = getOpacityInfo();

  // hover 或选中时恢复正常透明度
  const opacity = isHovered || selected ? 1 : baseOpacity;

  return (
    <>
      {/* 隐藏的 Handles - 位于节点中心 */}
      {/* 注意：position 必须使用有效值（left/top/right/bottom），不能用 "center" */}
      <Handle
        type="target"
        position={Position.Bottom}
        className="!w-1 !h-1 !bg-transparent !opacity-0"
        style={{
          background: 'transparent',
          // 将 Handle 定位到节点中心
          left: '50%',
          top: '50%',
          transform: 'translate(-50%, -50%)',
        }}
        data-hide-dependency-lines={hasHideDependencyLines}
        data-hide-dependent-lines={hasHideDependentLines}
      />
      <Handle
        type="source"
        position={Position.Bottom}
        className="!w-1 !h-1 !bg-transparent !opacity-0"
        style={{
          background: 'transparent',
          // 将 Handle 定位到节点中心
          left: '50%',
          top: '50%',
          transform: 'translate(-50%, -50%)',
        }}
        data-hide-dependency-lines={hasHideDependencyLines}
        data-hide-dependent-lines={hasHideDependentLines}
      />

      {/* 图标容器 - 按形状渲染，带 group 类用于悬停效果 */}
      {/* 使用负 margin 实现中心定位（React Flow 位置点是节点左上角）*/}
      {/* 微型节点置于最底层（z-index: -1），确保在所有正常节点下方 */}
      <div
        className="quest-node-icon-wrapper relative group cursor-pointer"
        style={{
          width: nodeDiameter,
          height: nodeDiameter,
          marginLeft: -nodeRadius,
          marginTop: -nodeRadius,
        }}
        data-node-id={id}
        data-tiny-node={isTinyNode}
        data-hide-dependency-lines={hasHideDependencyLines}
        data-hide-dependent-lines={hasHideDependentLines}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        {/* 形状容器 - 使用 FTBQ 官方贴图作为遮罩，内外圈完美对齐 */}
        <div className="w-full h-full relative">
          {/* 边框层 - 深灰色背景，使用 shape 贴图作为遮罩 */}
          <div
            className="absolute inset-0 transition-opacity duration-200"
            style={{
              backgroundColor: 'rgba(64, 64, 64, 0.9)',
              opacity: opacity,
              maskImage: `url(${shapeTexture})`,
              maskSize: 'contain',
              maskPosition: 'center',
              maskRepeat: 'no-repeat',
              WebkitMaskImage: `url(${shapeTexture})`,
              WebkitMaskSize: 'contain',
              WebkitMaskPosition: 'center',
              WebkitMaskRepeat: 'no-repeat',
            }}
          />
          {/* 内容层 - 浅灰色背景（比边框层小，通过 inset 留出边框空间） */}
          <div
            className="absolute inset-[2px] transition-opacity duration-200"
            style={{
              backgroundColor: 'rgba(180, 180, 180, 0.7)',
              opacity: opacity,
              maskImage: `url(${shapeTexture})`,
              maskSize: 'contain',
              maskPosition: 'center',
              maskRepeat: 'no-repeat',
              WebkitMaskImage: `url(${shapeTexture})`,
              WebkitMaskSize: 'contain',
              WebkitMaskPosition: 'center',
              WebkitMaskRepeat: 'no-repeat',
            }}
          >
            {/* 任务图标 - 渲染在形状上面 */}
            {iconUrl ? (
              <img
                src={iconUrl}
                alt="quest icon"
                className="w-full h-full object-cover p-1"
                onError={(e) => {
                  (e.target as HTMLImageElement).style.display = 'none';
                }}
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-white text-xs font-bold">
                ?
              </div>
            )}
          </div>
        </div>

        {/* 悬停提示框 - 显示标题、副标题和隐藏状态（微型节点不显示）*/}
        {!isTinyNode && (
          <div
            className="absolute left-1/2 -translate-x-1/2 bottom-full mb-2 px-3 py-2 bg-gray-900/95 text-white text-xs rounded-lg shadow-xl opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none whitespace-nowrap"
            style={{ zIndex: 9999 }}
          >
            <div className="font-semibold">{displayLabel}</div>
            {quest.subtitle && (
              <div className="text-gray-300 mt-0.5">{quest.subtitle}</div>
            )}
            {/* 隐藏状态类型 */}
            {opacityLabel && (
              <div className="text-yellow-400 mt-0.5 italic">{opacityLabel}</div>
            )}
            {/* 小三角 */}
            <div className="absolute left-1/2 -translate-x-1/2 top-full w-0 h-0 border-l-4 border-r-4 border-t-4 border-l-transparent border-r-transparent border-t-gray-900/95"></div>
          </div>
        )}
      </div>
    </>
  );
}

export default memo(QuestNode);
