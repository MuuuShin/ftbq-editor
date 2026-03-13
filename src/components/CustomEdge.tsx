import { memo } from 'react';
import { EdgeProps } from '@xyflow/react';

/**
 * 自定义直线边组件
 * 从一个节点中心连接到另一个节点中心
 */
function CustomEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  data,
  style = {},
  markerEnd,
}: EdgeProps) {
  // 使用 data 中的自定义坐标（节点中心坐标）
  const customSourceX = typeof data?.sourceX === 'number' ? data.sourceX : sourceX;
  const customSourceY = typeof data?.sourceY === 'number' ? data.sourceY : sourceY;
  const customTargetX = typeof data?.targetX === 'number' ? data.targetX : targetX;
  const customTargetY = typeof data?.targetY === 'number' ? data.targetY : targetY;

  // 直接从源节点中心连接到目标节点中心
  const startX = customSourceX;
  const startY = customSourceY;
  const endX = customTargetX;
  const endY = customTargetY;

  // 计算直线路径
  const path = `M ${startX} ${startY} L ${endX} ${endY}`;

  return (
    <g>
      <path
        id={id}
        className="react-flow__edge-path"
        d={path}
        style={{
          ...style,
          stroke: '#6366f1',
          strokeWidth: 2,
          fill: 'none',
        }}
        markerEnd={markerEnd}
      />
    </g>
  );
}

export default memo(CustomEdge);
