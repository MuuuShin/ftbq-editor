import { useCallback, useRef, useMemo, useEffect, useState } from 'react';
import {
  ReactFlow,
  Node,
  Edge,
  useNodesState,
  useEdgesState,
  Controls,
  Background,
  BackgroundVariant,
  Connection,
  addEdge,
  ReactFlowProvider,
  Panel,
  NodeTypes,
  EdgeTypes,
  ConnectionLineType,
  useReactFlow,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { Quest } from '../types';
import QuestNode from './QuestNode';
import CustomEdge from './CustomEdge';
import { useItemAtlas } from '../context/ItemAtlasContext';
import { parseItemId } from '../utils/itemAtlas';

// 原点标记节点组件
function OriginMarkerNode() {
  return (
    <div
      className="w-3 h-3 bg-red-500 rounded-full border-2 border-white shadow-lg pointer-events-none"
      style={{ transform: 'translate(-50%, -50%)' }}
      title="原点 (0,0)"
    />
  );
}

// 注册自定义节点类型
const extendedNodeTypes: NodeTypes = {
  questNode: QuestNode,
  originMarker: OriginMarkerNode,
};

// 注册自定义边类型
const edgeTypes: EdgeTypes = {
  custom: CustomEdge,
};

// 网格吸附设置 (0.5 单位 = 1 游戏内单位)
// 游戏内 1 单位 = 32px, 所以 0.5 单位 = 16px
const SNAP_GRID: [number, number] = [16, 16];

// 将游戏坐标转换为画布像素坐标
// 游戏坐标 (0,0) 对应画布中心
const GAME_TO_PIXEL_SCALE = 32; // 每游戏单位 32 像素

interface QuestEditorCanvasProps {
  quests: Quest[];
  onQuestSelect: (quest: Quest | null) => void;
  onPositionChange: (questId: string, x: number, y: number) => void;
}

/**
 * 编辑器画布组件
 * 使用 React Flow 实现可视化任务编辑
 * 坐标系统：中心点为 (0,0)，与游戏内 FTBQ 坐标一致
 */
function QuestEditorCanvas({
  quests,
  onQuestSelect,
  onPositionChange,
}: QuestEditorCanvasProps) {
  const reactFlowWrapper = useRef<HTMLDivElement>(null);
  const { itemMap } = useItemAtlas();
  const { screenToFlowPosition, fitView } = useReactFlow();

  // 当前鼠标位置（游戏坐标）
  const [mousePos, setMousePos] = useState<{ x: number; y: number } | null>(null);

  // 当前悬停的节点 ID
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);

  // 处理鼠标移动 - 直接用 clientX/clientY
  const handleMouseMove = useCallback((event: React.MouseEvent) => {
    const position = screenToFlowPosition({
      x: event.clientX,
      y: event.clientY
    });

    // Flow 坐标（像素）转换为游戏坐标
    setMousePos({
      x: Math.round((position.x / GAME_TO_PIXEL_SCALE) * 2) / 2,
      y: Math.round((position.y / GAME_TO_PIXEL_SCALE) * 2) / 2,
    });
  }, [screenToFlowPosition]);

  // 鼠标离开画布时清除坐标
  const handleMouseLeave = useCallback(() => {
    setMousePos(null);
  }, []);

  // 将物品 ID 转换为贴图 URL
  const getIconUrl = useCallback((icon: any): string | undefined => {
    if (!icon) return undefined;

    // 如果 icon 是对象，提取 id 字段
    let iconStr: string;
    if (typeof icon === 'object') {
      iconStr = icon.id || icon.Item || '';
    } else {
      iconStr = String(icon);
    }

    if (!iconStr) return undefined;

    // 如果已经是 base64 或 http 开头的 URL，直接返回
    if (iconStr.startsWith('data:') || iconStr.startsWith('http://') || iconStr.startsWith('https://')) {
      return iconStr;
    }

    // 解析物品 ID（去除数量后缀）
    const parsedId = parseItemId(iconStr);

    // 查找贴图映射
    if (itemMap[parsedId]) {
      return itemMap[parsedId];
    }

    // 没找到映射，返回 undefined（不加载 jar 时就是这样）
    return undefined;
  }, [itemMap]);

  // 初始化节点 - 使用游戏坐标作为节点中心坐标
  const initialNodes: Node[] = useMemo(() => quests.map((quest) => {
    const size = quest.size || 1;
    const nodeRadius = (size * 32) / 2;
    const iconUrl = getIconUrl(quest.icon);
    return {
      id: quest.id,
      type: 'questNode',
      position: {
        // 游戏坐标是节点中心
        x: (quest.x || 0) * GAME_TO_PIXEL_SCALE,
        y: (quest.y || 0) * GAME_TO_PIXEL_SCALE
      },
      data: {
        quest,
        label: quest.title, // 可能为空，由 QuestNode 处理
        icon: iconUrl,
        nodeRadius, // 传递半径用于边计算
      },
    };
  }), [quests, itemMap, getIconUrl]);

  // 初始化边 (依赖关系) - 直接传入节点中心坐标
  const initialEdges: Edge[] = useMemo(() => {
    const questMap = new Map(quests.map((q) => [q.id, q]));
    return quests.flatMap((quest) =>
      quest.dependencies?.map((depId) => {
        const depQuest = questMap.get(depId);
        // 判断边是否应该隐藏
        const isHidden = !!(quest.hide_dependency_lines || depQuest?.hide_dependent_lines);
        // 计算节点半径
        const sourceRadius = (depQuest?.size || 1) * 32 / 2;
        const targetRadius = (quest.size || 1) * 32 / 2;
        return {
          id: `${depId}->${quest.id}`,
          source: depId,
          target: quest.id,
          type: 'custom',
          markerEnd: 'edge-arrow',
          style: { stroke: '#6366f1', strokeWidth: 2 },
          className: isHidden ? 'hidden-edge' : '',
          // 直接传入节点中心坐标和半径
          data: {
            sourceX: (depQuest?.x || 0) * GAME_TO_PIXEL_SCALE,
            sourceY: (depQuest?.y || 0) * GAME_TO_PIXEL_SCALE,
            targetX: (quest.x || 0) * GAME_TO_PIXEL_SCALE,
            targetY: (quest.y || 0) * GAME_TO_PIXEL_SCALE,
            sourceRadius,
            targetRadius,
            isHidden,
          },
        };
      }) || []
    );
  }, [quests]);

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

  // 追踪上一次的 quests 引用，用于检测是否是章节切换
  const prevQuestsRef = useRef<Quest[] | null>(null);

  // 当 quests 变化时（切换章节），更新节点和边
  useEffect(() => {
    // 检测是否是章节切换（数组完全替换，而不是位置更新）
    const isChapterSwitch = prevQuestsRef.current === null ||
      (quests.length !== prevQuestsRef.current.length) ||
      (quests.length > 0 && quests[0].id !== prevQuestsRef.current[0]?.id);

    // 更新引用
    prevQuestsRef.current = quests;

    // 创建任务节点
    const questNodes: Node[] = quests.map((quest) => {
      const size = quest.size || 1;
      const nodeRadius = (size * 32) / 2;
      const iconUrl = getIconUrl(quest.icon);
      return {
        id: quest.id,
        type: 'questNode',
        position: {
          x: (quest.x || 0) * GAME_TO_PIXEL_SCALE,
          y: (quest.y || 0) * GAME_TO_PIXEL_SCALE
        },
        data: {
          quest,
          label: quest.title,
          icon: iconUrl,
          nodeRadius,
        },
      };
    });

    // 添加原点标记节点 (z-index 最低)
    const originNode: Node = {
      id: '__origin_marker__',
      type: 'originMarker',
      position: { x: 0, y: 0 },
      data: {},
      draggable: false,
      selectable: false,
      zIndex: -1000,
    };

    setNodes([originNode, ...questNodes]);

    const questMap = new Map(quests.map((q) => [q.id, q]));
    const newEdges: Edge[] = quests.flatMap((quest) =>
      quest.dependencies?.map((depId) => {
        const depQuest = questMap.get(depId);
        const isHidden = !!(quest.hide_dependency_lines || depQuest?.hide_dependent_lines);
        const sourceRadius = (depQuest?.size || 1) * 32 / 2;
        const targetRadius = (quest.size || 1) * 32 / 2;
        return {
          id: `${depId}->${quest.id}`,
          source: depId,
          target: quest.id,
          type: 'custom',
          markerEnd: 'edge-arrow',
          style: { stroke: '#6366f1', strokeWidth: 2 },
          className: isHidden ? 'hidden-edge' : '',
          data: {
            sourceX: (depQuest?.x || 0) * GAME_TO_PIXEL_SCALE,
            sourceY: (depQuest?.y || 0) * GAME_TO_PIXEL_SCALE,
            targetX: (quest.x || 0) * GAME_TO_PIXEL_SCALE,
            targetY: (quest.y || 0) * GAME_TO_PIXEL_SCALE,
            sourceRadius,
            targetRadius,
            isHidden,
          },
        };
      }) || []
    );
    setEdges(newEdges);

    // 只在章节切换时调整视图
    if (isChapterSwitch && quests.length > 0) {
      // 计算所有任务的最左、最右、最上、最下位置
      let minX = Infinity;
      let maxX = -Infinity;
      let minY = Infinity;
      let maxY = -Infinity;

      quests.forEach((quest) => {
        const x = (quest.x || 0) * GAME_TO_PIXEL_SCALE;
        const y = (quest.y || 0) * GAME_TO_PIXEL_SCALE;
        const size = quest.size || 1;
        const nodeRadius = (size * 32) / 2;

        // 考虑节点大小，计算边界（节点边缘而非中心）
        minX = Math.min(minX, x - nodeRadius);
        maxX = Math.max(maxX, x + nodeRadius);
        minY = Math.min(minY, y - nodeRadius);
        maxY = Math.max(maxY, y + nodeRadius);
      });

      // 使用 fitView 自动调整视图以适应所有节点
      requestAnimationFrame(() => {
        fitView({
          padding: 0.2,
          duration: 300,
        });
      });
    }
  }, [quests, setNodes, setEdges, getIconUrl, fitView]);

  // 处理节点拖动结束 - 将像素坐标转换回游戏坐标
  const handleNodeDragStop = useCallback(
    (_: React.MouseEvent, node: Node) => {
      const { x, y } = node.position;
      // 四舍五入到最近的 0.5 单位
      const gameX = Math.round(x / GAME_TO_PIXEL_SCALE * 2) / 2;
      const gameY = Math.round(y / GAME_TO_PIXEL_SCALE * 2) / 2;
      onPositionChange(node.id, gameX, gameY);
    },
    [onPositionChange]
  );

  // 当节点位置变化或 hover 状态变化时，更新边的坐标和样式
  useEffect(() => {
    setEdges((eds) =>
      eds.map((edge) => {
        const sourceNode = nodes.find((n) => n.id === edge.source);
        const targetNode = nodes.find((n) => n.id === edge.target);
        if (sourceNode && targetNode) {
          const sourceQuest = sourceNode.data?.quest as any;
          const targetQuest = targetNode.data?.quest as any;
          const isHidden = !!(targetQuest?.hide_dependency_lines || sourceQuest?.hide_dependent_lines);

          // 根据 size 计算节点半径（游戏单位转像素，1 单位 = 32px，size 是直径）
          const sourceRadius = (sourceQuest?.size || 1) * 32 / 2;
          const targetRadius = (targetQuest?.size || 1) * 32 / 2;

          // 节点位置已经是中心坐标
          const sourceCenterX = sourceNode.position.x;
          const sourceCenterY = sourceNode.position.y;
          const targetCenterX = targetNode.position.x;
          const targetCenterY = targetNode.position.y;

          // 判断是否应该显示隐藏的边（悬停时显示）
          const shouldShowHidden = hoveredNodeId && (
            (hoveredNodeId === edge.source && sourceQuest?.hide_dependent_lines) ||
            (hoveredNodeId === edge.target && targetQuest?.hide_dependency_lines)
          );

          // 检查节点是否有隐藏状态（invisible、hide_until_deps_complete、hide_until_deps_visible）
          const isSourceHidden = sourceQuest?.invisible ||
            sourceQuest?.hide_until_deps_complete ||
            sourceQuest?.hide_until_deps_visible;
          const isTargetHidden = targetQuest?.invisible ||
            targetQuest?.hide_until_deps_complete ||
            targetQuest?.hide_until_deps_visible;

          // 判断是否有节点被悬停（悬停时边恢复正常透明度）
          const isSourceHovered = hoveredNodeId === edge.source;
          const isTargetHovered = hoveredNodeId === edge.target;
          const isAnyHovered = isSourceHovered || isTargetHovered;

          // 计算边的透明度
          let edgeOpacity = 1;
          if (isAnyHovered) {
            // 悬停时恢复正常透明度
            edgeOpacity = 1;
          } else if (sourceQuest?.hide_dependent_lines || targetQuest?.hide_dependency_lines) {
            // hide_dependency_lines 或 hide_dependent_lines 且未悬停
            edgeOpacity = 0.25;
          } else if (isSourceHidden || isTargetHidden) {
            // 节点有隐藏状态（invisible/hide_until_deps_*）且未悬停 内联样式中还有透明度降低，所以这个线看起来会更淡
            edgeOpacity = 0.25;
          }

          return {
            ...edge,
            className: isHidden && !shouldShowHidden ? 'hidden-edge' : '',
            style: {
              stroke: '#6366f1',
              strokeWidth: 2,
              opacity: edgeOpacity,
            },
            data: {
              ...edge.data,
              isHidden,
              sourceX: sourceCenterX,
              sourceY: sourceCenterY,
              targetX: targetCenterX,
              targetY: targetCenterY,
              sourceRadius,
              targetRadius,
            },
          };
        }
        return edge;
      })
    );
  }, [nodes, setEdges, hoveredNodeId]);

  // 处理节点点击
  const handleNodeClick = useCallback(
    (_: React.MouseEvent, node: Node) => {
      const quest = (node.data as any)?.quest;
      if (quest) {
        onQuestSelect(quest);
      }
    },
    [onQuestSelect]
  );

  // 处理节点鼠标进入
  const handleNodeMouseEnter = useCallback(
    (_: React.MouseEvent, node: Node) => {
      setHoveredNodeId(node.id);
    },
    []
  );

  // 处理节点鼠标离开
  const handleNodeMouseLeave = useCallback(
    () => {
      setHoveredNodeId(null);
    },
    []
  );

  // 处理连线
  const onConnect = useCallback(
    (params: Connection) => {
      setEdges((eds) => addEdge({
        ...params,
        type: 'custom',
        markerEnd: 'edge-arrow',
        style: { stroke: '#6366f1', strokeWidth: 2 },
      }, eds));
    },
    [setEdges]
  );

  return (
    <div ref={reactFlowWrapper} className="w-full h-full">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onNodeDragStop={handleNodeDragStop}
        onNodeClick={handleNodeClick}
        onNodeMouseEnter={handleNodeMouseEnter}
        onNodeMouseLeave={handleNodeMouseLeave}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        nodeTypes={extendedNodeTypes}
        edgeTypes={edgeTypes}
        snapToGrid={true}
        snapGrid={SNAP_GRID}
        defaultEdgeOptions={{
          type: 'custom',
          markerEnd: 'edge-arrow',
        }}
        connectionLineType={ConnectionLineType.Straight}
        className="bg-gray-400 dark:bg-gray-700"
      >
        <Controls className="bg-white dark:bg-gray-600 border border-gray-500 dark:border-gray-500 rounded shadow" />
        <Background
          variant={BackgroundVariant.Dots}
          gap={16}
          size={1}
          color="#4b5563"
        />

        {/* 工具信息面板 */}
        <Panel position="top-left" className="bg-white/80 dark:bg-gray-800/80 p-2 rounded shadow text-xs">
          <div className="text-gray-700 dark:text-gray-300">
            <p>🖱️ 左键点击节点 - 查看/编辑任务</p>
            <p>🖱️ 拖拽节点 - 移动位置 (吸附 0.5 单位网格)</p>
            <p>🖱️ 拖拽连线 - 创建依赖关系</p>
            <p>🔍 滚轮 - 缩放视图</p>
            <p className="mt-1 text-gray-500">📍 坐标：游戏内坐标，中心点 (0,0)</p>
          </div>
        </Panel>

        {/* 鼠标坐标显示 - 左下角 */}
        <Panel position="bottom-left" className="bg-gray-900/90 text-white px-3 py-2 rounded shadow-lg text-sm font-mono">
          <span className="text-green-400">📍</span> X: {mousePos?.x.toFixed(1) ?? '---'} | Y: {mousePos?.y.toFixed(1) ?? '---'}
        </Panel>
      </ReactFlow>
    </div>
  );
}

// 导出包裹在 ReactFlowProvider 中的组件
export function QuestEditorCanvasWrapper(props: QuestEditorCanvasProps) {
  return (
    <ReactFlowProvider>
      <QuestEditorCanvas {...props} />
    </ReactFlowProvider>
  );
}
