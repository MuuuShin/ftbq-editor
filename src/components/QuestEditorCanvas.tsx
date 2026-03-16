import {useCallback, useRef, useMemo, useEffect, useState} from 'react';
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
import {Quest} from '../types';
import QuestNode from './QuestNode';
import CustomEdge from './CustomEdge';
import {useItemAtlas} from '../context/ItemAtlasContext';
import {parseItemId} from '../utils/itemAtlas';

// 原点标记节点组件
function OriginMarkerNode() {
  return (
    <div
      className="w-3 h-3 bg-red-500 rounded-full border-2 border-white shadow-lg pointer-events-none"
      style={{transform: 'translate(-50%, -50%)'}}
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
  const {itemMap} = useItemAtlas();
  const {screenToFlowPosition, fitView} = useReactFlow();

  // 统一的 fitView 参数对象，供代码中所有 fitView 调用共享
  const FIT_VIEW_OPTIONS = useMemo(() => ({
    padding: 0.1,
    duration: 200,
    minZoom: 0.5,
    maxZoom: 2,
  }), []);

  // Ctrl / Cmd pressed state: when true, disable grid snapping and keep high-precision positions
  const [ctrlPressed, setCtrlPressed] = useState(false);

  // keyboard listeners to toggle ctrlPressed (supports Mac Cmd via metaKey)
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey) setCtrlPressed(true);
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (!e.ctrlKey && !e.metaKey) setCtrlPressed(false);
    };
    const onBlur = () => setCtrlPressed(false);
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', onBlur);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', onBlur);
    };
  }, []);

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

  // 初始化节点 - 使用中心点坐标（position 表示元素中心）
  const initialNodes: Node[] = useMemo(() => quests.map((quest) => {
    const size = quest.size || 1;
    const nodeDiameter = size * 32;
    const nodeRadius = nodeDiameter / 2;
    const iconUrl = getIconUrl(quest.icon);
    return {
      id: quest.id,
      type: 'questNode',
      position: {
        // React Flow expects position = top-left; store top-left = center_px - radius
        x: (quest.x || 0) * GAME_TO_PIXEL_SCALE - nodeRadius,
        y: (quest.y || 0) * GAME_TO_PIXEL_SCALE - nodeRadius,
      },
      data: {
        quest,
        label: quest.title,
        icon: iconUrl,
        nodeRadius,
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
          style: {stroke: '#6366f1', strokeWidth: 2},
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

    // 创建任务节点 - 位置是节点左上角（游戏坐标 × 缩放 - 半径）
    // 这样 fitView 能正确计算边界
    const questNodes: Node[] = quests.map((quest) => {
      const size = quest.size || 1;
      const nodeDiameter = size * 32; // 与 QuestNode.tsx 保持一致
      const nodeRadius = nodeDiameter / 2;
      const iconUrl = getIconUrl(quest.icon);
      return {
        id: quest.id,
        type: 'questNode',
        position: {
          // React Flow position is top-left; convert from game center coordinate to top-left
          x: (quest.x || 0) * GAME_TO_PIXEL_SCALE - nodeRadius,
          y: (quest.y || 0) * GAME_TO_PIXEL_SCALE - nodeRadius,
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
      position: {x: 0, y: 0},
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
          style: {stroke: '#6366f1', strokeWidth: 2},
          className: isHidden ? 'hidden-edge' : '',
          data: {
            // 使用节点中心点坐标（左上角 + 半径）
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
      // 使用 fitView 自动调整视图以适应所有节点
      requestAnimationFrame(() => {
        fitView(FIT_VIEW_OPTIONS);
      });
    }
  }, [quests, setNodes, setEdges, getIconUrl, fitView]);

  // 处理节点拖动结束 - node.position 现在为中心点（像素）
  const handleNodeDragStop = useCallback(
    (_: React.MouseEvent, node: Node) => {
      // node.position is top-left (pixels). Convert to center pixels by adding radius
      const nodeRadius = (node.data as any)?.nodeRadius ?? (((node.data as any)?.quest?.size || 1) * GAME_TO_PIXEL_SCALE / 2);
      const centerX = node.position.x + nodeRadius;
      const centerY = node.position.y + nodeRadius;

      // pixel grid step (e.g., 16 px for 0.5 game unit)
      const gridPx = SNAP_GRID[0];

      if (ctrlPressed) {
        // 自由模式：保留小数点后 4 位精度（游戏坐标）
        const gameX = Math.round((centerX / GAME_TO_PIXEL_SCALE) * 10000) / 10000;
        const gameY = Math.round((centerY / GAME_TO_PIXEL_SCALE) * 10000) / 10000;
        onPositionChange(node.id, gameX, gameY);
      } else {
        // 网格模式：以像素为单位进行对齐，避免半径为小数导致的偏移
        const snappedCenterX = Math.round(centerX / gridPx) * gridPx;
        const snappedCenterY = Math.round(centerY / gridPx) * gridPx;
        const gameX = Math.round((snappedCenterX / GAME_TO_PIXEL_SCALE) * 10000) / 10000;
        const gameY = Math.round((snappedCenterY / GAME_TO_PIXEL_SCALE) * 10000) / 10000;
        onPositionChange(node.id, gameX, gameY);
      }
    },
    [onPositionChange, ctrlPressed]
  );

  // 处理节点拖动时（实时），我们需要确保拖动时节点的中心能够吸附到网格
  // 这样当节点半径不是整数时，拖动视觉上也会与网格对齐。
  const handleNodeDrag = useCallback((_: React.MouseEvent, node: Node) => {
    // 如果按住 Ctrl，则不进行网格吸附（自由拖动）
    setNodes((nds) => nds.map((n) => {
      if (n.id !== node.id) return n;
      const nodeRadius = (n.data as any)?.nodeRadius ?? (((n.data as any)?.quest?.size || 1) * GAME_TO_PIXEL_SCALE / 2);
      // node.position 在此时为 top-left（像素）
      const centerX = node.position.x + nodeRadius;
      const centerY = node.position.y + nodeRadius;

      // pixel grid step
      const gridPx = SNAP_GRID[0];

      let snappedCenterX = centerX;
      let snappedCenterY = centerY;
      if (!ctrlPressed) {
        snappedCenterX = Math.round(centerX / gridPx) * gridPx;
        snappedCenterY = Math.round(centerY / gridPx) * gridPx;
      }

      // compute new top-left and round to avoid float drift
      const newX = Number((snappedCenterX - nodeRadius).toFixed(4));
      const newY = Number((snappedCenterY - nodeRadius).toFixed(4));

      // 避免无谓的 setNodes 引发 rerender
      if (Math.abs(newX - n.position.x) < 0.0001 && Math.abs(newY - n.position.y) < 0.0001) return n;
      return {
        ...n,
        position: {x: newX, y: newY},
      } as Node;
    }));
  }, [ctrlPressed, setNodes]);

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

          // node.position is top-left (pixels) — compute center by adding radius
          const sourceCenterX = sourceNode.position.x + sourceRadius;
          const sourceCenterY = sourceNode.position.y + sourceRadius;
          const targetCenterX = targetNode.position.x + targetRadius;
          const targetCenterY = targetNode.position.y + targetRadius;

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
        style: {stroke: '#6366f1', strokeWidth: 2},
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
        // 我们使用自定义的拖动吸附逻辑（中心点对齐），因此禁用 React Flow 内置 snapToGrid
        snapToGrid={false}
        snapGrid={SNAP_GRID}
        minZoom={0.1}
        maxZoom={4}
        defaultEdgeOptions={{
          type: 'custom',
          markerEnd: 'edge-arrow',
        }}
        onNodeDrag={handleNodeDrag}
        connectionLineType={ConnectionLineType.Straight}
        className="bg-gray-400 dark:bg-gray-700"
      >
        <Controls
          className="bg-white dark:bg-gray-600 border border-gray-500 dark:border-gray-500 rounded shadow"
          style={{bottom: 50, left: 10}}
          fitViewOptions={FIT_VIEW_OPTIONS}
        />
        <Background
          variant={BackgroundVariant.Dots}
          gap={16}
          size={1}
          // restored original light-dot color
          color="#4b5563"
        />

        {/* 工具信息面板 - 右上角 */}
        <Panel position="top-right" className="bg-white/80 dark:bg-gray-800/80 p-2 rounded shadow text-xs m-2">
          <div className="text-gray-700 dark:text-gray-300">
            <p>🖱️ 左键点击节点 - 查看/编辑任务</p>
            <p>🖱️ 拖拽节点 - 移动位置 (吸附 0.5 单位网格)</p>
            <p>🔍 滚轮 - 缩放视图</p>
          </div>
        </Panel>

        {/* 鼠标坐标显示 - 左下角 */}
        <Panel position="bottom-left"
               className="bg-gray-900/90 text-white px-3 py-2 rounded shadow-lg text-sm font-mono">
          <span className="text-green-400">📍</span> X: {mousePos?.x.toFixed(1) ?? '---'} |
          Y: {mousePos?.y.toFixed(1) ?? '---'}
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
