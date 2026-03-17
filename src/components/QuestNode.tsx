import { memo, type JSX, useState, useEffect } from 'react';
import { Handle, Position } from '@xyflow/react';
import { QuestNodeData } from '../types';
import { useItemAtlas } from '../context/ItemAtlasContext';
import { parseItemId } from '../utils/itemAtlas';
import { getShapeAssets } from '../utils/shapeAssets';
import themeColors from '../utils/themeColors';
import PixelImage from './PixelImage';

interface QuestNodeProps {
  id: string;
  data: QuestNodeData;
  selected?: boolean;
  type?: string;
}

/**
 * 任务节点组件
 * 默认只显示图标，鼠标悬停时显示标题和副标题
 * 节点位置由 QuestEditorCanvas 从游戏中心坐标转换为左上角坐标
 */
function QuestNode({ data, id, selected }: QuestNodeProps): JSX.Element {
  const { quest } = data;
  const { itemMap, itemNames } = useItemAtlas();
  const [isHovered, setIsHovered] = useState(false);

  // shape preference: quest.shape > chapter default shape > 'circle'
  const shape = (quest.shape as string) || data?.chapterDefaultShape || 'circle';
  // shape assets: background, mask(shape), outline
  const { background: backgroundUrl, mask: shapeMaskUrl, outline: outlineUrl } = getShapeAssets(shape);
  const size = quest.size || 1;

  // Inject minimal CSS for pulsing selection highlight once
  useEffect(() => {
    if (typeof document === 'undefined') return;
    if (document.getElementById('ftb-quest-node-styles')) return;
    const s = document.createElement('style');
    s.id = 'ftb-quest-node-styles';
    s.innerHTML = `
      @keyframes ftb-pulse { 0% { opacity: 0.55; } 50% { opacity: 0.95; } 100% { opacity: 0.55; } }
      .ftb-pulse { animation: ftb-pulse 1.6s ease-in-out infinite; }
    `;
    document.head.appendChild(s);
  }, []);

  // Use FTB Quests theme colors centrally (outline uses locked color by default here)
  // You can adjust to use other themeColors.* variants later.
  const outlineColor = themeColors.quest_locked_color;

  // 根据 size 计算节点直径（游戏单位转像素，1 单位 = 32px）
  const nodeDiameter = size * 32;
  // 计算像素精确的内外尺寸，避免使用 CSS calc 导致的亚像素差异
  const outerSizePx = Math.round(nodeDiameter); // 保证整数像素

  // 如果节点有隐藏连线属性，添加 data 属性
  const hasHideDependencyLines = !!quest.hide_dependency_lines;
  const hasHideDependentLines = !!quest.hide_dependent_lines;

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
    const rawIcon = (quest as any).icon;
    // 如果 quest.icon 存在并且看起来是 URL/path，则直接返回
    if (rawIcon) {
      if (typeof rawIcon === 'string') {
        const s = rawIcon;
        if (s.startsWith('data:') || s.startsWith('http://') || s.startsWith('https://') || s.startsWith('/')) {
          return s;
        }

        // 否则把字符串当成物品 id，尝试解析并从 itemMap 找到贴图
        const parsed = parseItemId(s);
        if (parsed && itemMap[parsed]) return itemMap[parsed];

        // 无法解析为可用 URL
        return undefined;
      }

      // 如果 quest.icon 是对象（可能含 id 字段），尝试提取 id 并解析
      if (typeof rawIcon === 'object') {
        const qi: any = rawIcon as any;
        const iconId = qi?.id || qi?.Item || undefined;
        if (iconId && typeof iconId === 'string') {
          const parsed = parseItemId(iconId);
          if (parsed && itemMap[parsed]) return itemMap[parsed];
        }
      }
    }

    // 退回到第一个任务的 item/dimension（旧逻辑）
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
      {/* QuestEditorCanvas 已将游戏坐标（中心点）转换为左上角坐标，此处直接渲染即可 */}
      {/* 微型节点置于最底层（z-index: -1），确保在所有正常节点下方 */}
      <div
        className="quest-node-icon-wrapper relative group cursor-pointer"
        style={{
          width: outerSizePx,
          height: outerSizePx,
          // React Flow position is top-left; do not translate here so the wrapper's top-left
          // matches the node.position. Inner children are centered using left/top 50%.
        }}
        data-node-id={id}
        data-tiny-node={isTinyNode}
        data-hide-dependency-lines={hasHideDependencyLines}
        data-hide-dependent-lines={hasHideDependentLines}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        <div className="relative" style={{ width: outerSizePx, height: outerSizePx }}>
          {/* 1) Shape fill - match FTB: draw shape filled with dark gray first */}
          <div
            className="absolute transition-opacity duration-200"
            style={{
              width: `${outerSizePx}px`,
              height: `${outerSizePx}px`,
              left: '50%',
              top: '50%',
              transform: 'translate(-50%, -50%)',
              backgroundColor: '#2f2f2f', // DARK_GRAY-like (restore previous darker fill)
              // Use shape PNG as mask to color the interior
              maskImage: `url(${shapeMaskUrl})`,
              maskSize: 'contain',
              maskPosition: 'center',
              maskRepeat: 'no-repeat',
              WebkitMaskImage: `url(${shapeMaskUrl})`,
              WebkitMaskSize: 'contain',
              WebkitMaskPosition: 'center',
              WebkitMaskRepeat: 'no-repeat',
              opacity: opacity,
              pointerEvents: 'none',
            }}
          />

          {/* 2) Background texture - semi-transparent white tint over background (alpha 150/255 ≈ 0.588) */}
          <div
            className={`absolute transition-opacity duration-200 ${selected ? 'ftb-pulse' : ''}`}
            style={{
              width: `${outerSizePx}px`,
              height: `${outerSizePx}px`,
              left: '50%',
              top: '50%',
              transform: 'translate(-50%, -50%)',
              backgroundImage: `url(${backgroundUrl})`,
              backgroundSize: 'cover',
              backgroundPosition: 'center',
              backgroundRepeat: 'no-repeat',
              // restore previous semi-transparent white tint used earlier (approx alpha 150/255 ≈ 0.588)
              opacity: 0.588 * opacity,
              boxSizing: 'border-box',
              pointerEvents: 'none',
            }}
          />

          {/* 3) Content icon - drawn in center with FTB-like scale: (2/3)*w*iconScale */}
          <div
            style={{
              position: 'absolute',
              left: '50%',
              top: '50%',
              transform: 'translate(-50%, -50%)',
              width: `${Math.round(outerSizePx * (2 / 3) * (quest.iconScale || 1))}px`,
              height: `${Math.round(outerSizePx * (2 / 3) * (quest.iconScale || 1))}px`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              pointerEvents: 'none',
            }}
          >
            {/* 任务图标 - 渲染在形状上面，使用 PixelImage 组件支持像素化渲染和动图 */}
            {iconUrl ? (
              <PixelImage
                src={iconUrl}
                alt="quest icon"
                size="100%"
                className="object-cover w-full h-full"
                onError={() => {}}
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-white text-xs font-bold">?</div>
            )}
          </div>
        </div>

        {/* 4) Hover / locked overlays: match FTB behavior */}
        {/* If not startable, render darkened shape */}
        {(!(quest.canStart ?? true) || quest.locked) && (
          <div
            style={{
              position: 'absolute',
              left: '50%',
              top: '50%',
              transform: 'translate(-50%, -50%)',
              width: `${outerSizePx}px`,
              height: `${outerSizePx}px`,
              // use FTB locked theme color as the overlay tint; combine with node opacity
              backgroundColor: themeColors.quest_locked_color,
              opacity: 0.39 * opacity,
              maskImage: `url(${shapeMaskUrl})`,
              WebkitMaskImage: `url(${shapeMaskUrl})`,
              maskSize: 'contain',
              WebkitMaskSize: 'contain',
              maskPosition: 'center',
              WebkitMaskPosition: 'center',
              maskRepeat: 'no-repeat',
              WebkitMaskRepeat: 'no-repeat',
              pointerEvents: 'none',
            }}
          />
        )}

        {/* Hover highlight: white overlay inside shape */}
        {isHovered && (
          <div
            style={{
              position: 'absolute',
              left: '50%',
              top: '50%',
              transform: 'translate(-50%, -50%)',
              width: `${outerSizePx}px`,
              height: `${outerSizePx}px`,
              backgroundColor: 'rgba(255,255,255,0.39)',
              maskImage: `url(${shapeMaskUrl})`,
              WebkitMaskImage: `url(${shapeMaskUrl})`,
              maskSize: 'contain',
              WebkitMaskSize: 'contain',
              maskPosition: 'center',
              WebkitMaskPosition: 'center',
              maskRepeat: 'no-repeat',
              WebkitMaskRepeat: 'no-repeat',
              pointerEvents: 'none',
            }}
          />
        )}

        {/* 5) Outline - colored */}
        <div
          style={{
            position: 'absolute',
            left: '50%',
            top: '50%',
            transform: 'translate(-50%, -50%)',
            width: `${outerSizePx}px`,
            height: `${outerSizePx}px`,
            backgroundColor: outlineColor,
            maskImage: `url(${outlineUrl})`,
            WebkitMaskImage: `url(${outlineUrl})`,
            maskSize: 'contain',
            WebkitMaskSize: 'contain',
            maskPosition: 'center',
            WebkitMaskPosition: 'center',
            maskRepeat: 'no-repeat',
            WebkitMaskRepeat: 'no-repeat',
            opacity: opacity,
            pointerEvents: 'none',
          }}
        />

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
