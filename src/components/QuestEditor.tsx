import { useState, useEffect, useRef, useCallback } from 'react';
import { Quest, QuestTask, QuestReward } from '../types';
import { useItemAtlas } from '../context/ItemAtlasContext';
import Chevron from './icons/Chevron';

interface QuestEditorProps {
  quest: Quest | null;
  onClose: () => void;
  onSave: (quest: Quest) => void;
}

// 最小和最大面板宽度（像素）
const MIN_PANEL_WIDTH = 280;
const MAX_PANEL_WIDTH = 600;
const DEFAULT_PANEL_WIDTH = 400;

// 物品 ID 输入框组件
interface ItemIdInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}

function ItemIdInput({ value, onChange, placeholder, className }: ItemIdInputProps) {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onChange(e.target.value);
  };

  return (
    <input
      type="text"
      value={value}
      onChange={handleChange}
      placeholder={placeholder || 'minecraft:stone'}
      className={className || 'w-full px-2 py-1.5 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm'}
    />
  );
}

/**
 * 任务编辑面板
 * 允许编辑任务的各项属性
 */
export function QuestEditor({ quest, onClose, onSave }: QuestEditorProps) {
  const { itemNames } = useItemAtlas();
  const [formData, setFormData] = useState<Quest | null>(null);
  const [displayLabel, setDisplayLabel] = useState<string>('');
  const [panelWidth, setPanelWidth] = useState<number>(DEFAULT_PANEL_WIDTH);
  const [isResizing, setIsResizing] = useState(false);
  const resizeStartX = useRef<number>(0);
  const resizeStartWidth = useRef<number>(0);

  // 区域展开状态
  const [expandedRegions, setExpandedRegions] = useState<Set<string>>(new Set(['tasks', 'rewards', 'properties']));

  // 每个 task/reward 的展开状态
  const [expandedItems, setExpandedItems] = useState<Set<number>>(new Set());

  // 新增 item 的物品 ID 输入
  const [newTaskItemId, setNewTaskItemId] = useState('');
  const [newRewardItemId, setNewRewardItemId] = useState('');

  // 切换区域展开/收起
  const toggleRegion = (region: string) => {
    const newSet = new Set(expandedRegions);
    if (newSet.has(region)) {
      newSet.delete(region);
    } else {
      newSet.add(region);
    }
    setExpandedRegions(newSet);
  };

  // 切换单个 item 展开/收起
  const toggleItemExpanded = (index: number) => {
    const newSet = new Set(expandedItems);
    if (newSet.has(index)) {
      newSet.delete(index);
    } else {
      newSet.add(index);
    }
    setExpandedItems(newSet);
  };

  // 计算显示用的 label（只读）
  useEffect(() => {
    if (!quest) return;

    const firstTask = quest.tasks && quest.tasks.length > 0 ? quest.tasks[0] : undefined;

    const getItemOrDimension = (task: any) => {
      if (!task) return undefined;
      if (task.item) {
        return typeof task.item === 'object' ? task.item.id : task.item;
      }
      if (task.dimension) {
        return typeof task.dimension === 'object' ? task.dimension.id : task.dimension;
      }
      return undefined;
    };

    if (firstTask?.title) {
      setDisplayLabel(firstTask.title);
      return;
    }

    const itemOrDim = firstTask ? getItemOrDimension(firstTask) : undefined;
    if (itemOrDim) {
      const parts = itemOrDim.split(':');
      const parsedId = parts.length >= 3 ? `${parts[0]}:${parts[1]}` : itemOrDim;
      if (itemNames[parsedId]) {
        setDisplayLabel(itemNames[parsedId] + ` (${parsedId})`);
        return;
      }
      setDisplayLabel(parsedId);
      return;
    }

    if (firstTask?.type === 'checkmark') {
      setDisplayLabel('Checkmark');
      return;
    }

    setDisplayLabel('Untitled');
  }, [quest, itemNames]);

  // 处理鼠标移动 - 调整面板宽度
  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!isResizing) return;

    const deltaX = e.clientX - resizeStartX.current;
    const newWidth = Math.min(MAX_PANEL_WIDTH, Math.max(MIN_PANEL_WIDTH, resizeStartWidth.current - deltaX));
    setPanelWidth(newWidth);
  }, [isResizing]);

  // 处理鼠标松开 - 结束调整
  const handleMouseUp = useCallback(() => {
    setIsResizing(false);
    document.body.style.cursor = 'default';
    document.body.style.userSelect = 'auto';
  }, []);

  // 监听全局鼠标事件
  useEffect(() => {
    if (isResizing) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
    }

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      if (!isResizing) {
        document.body.style.cursor = 'default';
        document.body.style.userSelect = 'auto';
      }
    };
  }, [isResizing, handleMouseMove, handleMouseUp]);

  // 处理调整宽度开始
  const handleResizeStart = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);
    resizeStartX.current = e.clientX;
    resizeStartWidth.current = panelWidth;
  };

  useEffect(() => {
    if (quest) {
      setFormData({ ...quest });
    }
  }, [quest]);

  if (!formData) return null;

  const handleChange = (field: string, value: any) => {
    setFormData((prev) => (prev ? { ...prev, [field]: value } : null));
  };

  const handleSave = () => {
    if (formData) {
      onSave(formData);
    }
  };

  // 处理 description 变更（支持单行和多行）
  const handleDescriptionChange = (value: string) => {
    if (value.includes('\n')) {
      handleChange('description', value.split('\n'));
    } else {
      handleChange('description', value);
    }
  };

  // 将 description 转换为可编辑的字符串
  const getDescriDisplayValue = () => {
    if (!formData.description) return '';
    if (typeof formData.description === 'string') return formData.description;
    if (Array.isArray(formData.description)) return formData.description.join('\n');
    return '';
  };

  // 获取物品显示文本
  const getItemDisplayText = (item: any) => {
    if (!item) return '';
    if (typeof item === 'string') return item;
    if (item.item) {
      const itemStr = typeof item.item === 'string' ? item.item :
                      (typeof item.item === 'object' && item.item.id) ? item.item.id : String(item.item);
      const parts = itemStr.split(':');
      return parts.length >= 3 ? `${parts[0]}:${parts[1]}` : itemStr;
    }
    if (item.dimension) {
      return typeof item.dimension === 'object' ? item.dimension.id : item.dimension;
    }
    if (item.title) return item.title;
    if (item.type) return item.type;
    return JSON.stringify(item);
  };

  // 获取类型的中文显示
  const getTypeDisplay = (type: string) => {
    const typeMap: Record<string, string> = {
      item: '物品',
      fluid: '流体',
      energy: '能量',
      xp: '经验',
      kill: '击杀',
      location: '位置',
      checkmark: '标记',
      advancement: '进度',
      choice: '自选',
      loot: '战利品',
    };
    return typeMap[type] || type;
  };

  // 获取物品的背景色（根据类型）
  const getItemTypeColor = (type?: string) => {
    if (!type) return 'bg-gray-500';
    if (type.includes('checkmark')) return 'bg-green-500';
    if (type.includes('fluid')) return 'bg-blue-500';
    if (type.includes('energy')) return 'bg-yellow-500';
    if (type.includes('xp')) return 'bg-purple-500';
    if (type.includes('kill')) return 'bg-red-500';
    if (type.includes('location')) return 'bg-indigo-500';
    return 'bg-gray-500';
  };

  // ========== Tasks 相关方法 ==========
  const handleAddTask = () => {
    if (!newTaskItemId.trim()) return;

    const newTask: QuestTask = {
      type: 'item',
      item: newTaskItemId.trim(),
      count: 1,
    };

    const newTasks = [...(formData.tasks || []), newTask];
    handleChange('tasks', newTasks);
    setNewTaskItemId('');
    // 自动展开新增的 task
    setExpandedItems(new Set([...expandedItems, newTasks.length - 1]));
  };

  const handleRemoveTask = (index: number) => {
    const newTasks = formData.tasks?.filter((_, i) => i !== index) || [];
    handleChange('tasks', newTasks);
    // 更新展开状态
    const newExpandedItems = new Set(expandedItems);
    newTasks.forEach((_, i) => {
      if (expandedItems.has(i + 1)) {
        newExpandedItems.add(i);
      }
    });
    setExpandedItems(newExpandedItems);
  };

  const handleUpdateTask = (index: number, field: string, value: any) => {
    const newTasks = formData.tasks?.map((task, i) =>
      i === index ? { ...task, [field]: value } : task
    ) || [];
    handleChange('tasks', newTasks);
  };

  // ========== Rewards 相关方法 ==========
  const handleAddReward = () => {
    if (!newRewardItemId.trim()) return;

    const newReward: QuestReward = {
      type: 'item',
      item: newRewardItemId.trim(),
      count: 1,
    };

    const newRewards = [...(formData.rewards || []), newReward];
    handleChange('rewards', newRewards);
    setNewRewardItemId('');
    // 自动展开新增的 reward
    setExpandedItems(new Set([...expandedItems, 1000 + (newRewards.length - 1)])); // 用 1000+ 区分 rewards
  };

  const handleRemoveReward = (index: number) => {
    const newRewards = formData.rewards?.filter((_, i) => i !== index) || [];
    handleChange('rewards', newRewards);
  };

  const handleUpdateReward = (index: number, field: string, value: any) => {
    const newRewards = formData.rewards?.map((reward, i) =>
      i === index ? { ...reward, [field]: value } : reward
    ) || [];
    handleChange('rewards', newRewards);
  };

  // 判断是否是 task 的展开状态（index < 1000）
  const isTaskExpanded = (index: number) => expandedItems.has(index);
  const isRewardExpanded = (index: number) => expandedItems.has(1000 + index);

  return (
    <div
      className="editor-panel absolute right-0 top-0 h-full overflow-y-auto p-4 border-l border-gray-300 dark:border-gray-600 bg-gray-100 dark:bg-gray-800 shadow-lg"
      style={{ width: panelWidth, left: `auto` }}
    >
      {/* 拖动调整手柄 - 左侧边缘 */}
      <div
        className="absolute left-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-blue-500/50 transition-colors z-50"
        onMouseDown={handleResizeStart}
        title="拖动调整宽度"
      />

      <div className="flex justify-between items-center mb-4">
        <h2 className="text-lg font-bold text-gray-800 dark:text-white">编辑任务</h2>
        <button
          onClick={onClose}
          className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-white"
        >
          ✕
        </button>
      </div>

      <div className="space-y-4">
        {/* 解析后的显示名称（只读） */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            显示名称
          </label>
          <input
            type="text"
            value={displayLabel}
            disabled
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400"
            title="根据任务、task 或物品自动生成的显示名称"
          />
          <p className="text-xs text-gray-400 mt-1">
            根据优先级自动生成：任务标题 → task 标题 → jar 物品名 → 物品 ID → Checkmark → Untitled
          </p>
        </div>

        {/* ID (只读) */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            ID
          </label>
          <input
            type="text"
            value={formData.id || ''}
            disabled
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400"
          />
        </div>

        {/* 标题 */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            标题
          </label>
          <input
            type="text"
            value={formData.title || ''}
            onChange={(e) => handleChange('title', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
            placeholder="输入任务标题"
          />
        </div>

        {/* 副标题 */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            副标题
          </label>
          <input
            type="text"
            value={formData.subtitle || ''}
            onChange={(e) => handleChange('subtitle', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
            placeholder="输入副标题"
          />
        </div>

        {/* 描述 */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            描述
          </label>
          <textarea
            value={getDescriDisplayValue()}
            onChange={(e) => handleDescriptionChange(e.target.value)}
            rows={4}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
            placeholder="输入任务描述（支持多行）"
          />
          <p className="text-xs text-gray-400 mt-1">
            当前格式：{typeof formData.description === 'string' ? '单行文本' : '多行数组'}
          </p>
        </div>

        {/* 图标 */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            图标
          </label>
          <input
            type="text"
            value={formData.icon || ''}
            onChange={(e) => handleChange('icon', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
            placeholder="输入图标路径"
          />
          {formData.icon && (
            <div className="mt-2">
              <img
                src={formData.icon}
                alt="preview"
                className="w-12 h-12 border border-gray-300 rounded"
                onError={(e) => {
                  (e.target as HTMLImageElement).src = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg"><rect fill="gray" width="100%" height="100%"/></svg>';
                }}
              />
            </div>
          )}
        </div>
      </div>

      {/* ========== 目标（Tasks）区域 ========== */}
      <div className="mt-6">
        <button
          onClick={() => toggleRegion('tasks')}
          className="flex items-center gap-2 w-full px-3 py-2 bg-indigo-100 dark:bg-indigo-900/50 hover:bg-indigo-200 dark:hover:bg-indigo-900 rounded transition-colors border border-indigo-300 dark:border-indigo-700"
        >
          <span className="w-4 flex items-center justify-center"><Chevron expanded={expandedRegions.has('tasks')} className="w-4 h-4 text-gray-500" /></span>
          <span className="text-base">📋</span>
          <span className="text-sm font-semibold text-indigo-900 dark:text-indigo-200 flex-1 text-left">目标</span>
          <span className="text-xs text-indigo-600 dark:text-indigo-400">{formData.tasks?.length || 0} 项</span>
        </button>

        {expandedRegions.has('tasks') && (
          <div className="mt-2 space-y-2">
            {/* 新增 Task 输入框 */}
            <div className="flex gap-2 items-center">
              <ItemIdInput
                value={newTaskItemId}
                onChange={setNewTaskItemId}
                placeholder="输入物品 ID 后按 + 添加"
                className="flex-1 px-2 py-1.5 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm"
              />
              <button
                onClick={handleAddTask}
                className="px-3 py-1.5 bg-indigo-500 hover:bg-indigo-600 text-white text-sm font-medium rounded transition-colors"
                title="添加目标"
              >
                +
              </button>
            </div>

            {/* Task 列表 */}
            {formData.tasks && formData.tasks.length > 0 ? (
              formData.tasks.map((task, index) => (
                <div key={index} className="border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 overflow-hidden">
                  {/* Task 标题栏 */}
                  <div
                    className="flex items-center gap-2 px-3 py-2 bg-gray-50 dark:bg-gray-750 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                    onClick={() => toggleItemExpanded(index)}
                  >
                    <span className="w-4 flex items-center justify-center"><Chevron expanded={isTaskExpanded(index)} className="w-4 h-4 text-gray-500" /></span>
                    <span className={`w-2 h-2 rounded-full ${getItemTypeColor(task.type)}`}></span>
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300 flex-1 truncate">
                      {getItemDisplayText(task)}
                    </span>
                    <span className="text-xs text-gray-500">{getTypeDisplay(task.type)} ({task.type})</span>
                    {task.count !== undefined && (
                      <span className="text-xs text-gray-500">×{task.count}</span>
                    )}
                    <button
                      onClick={(e) => { e.stopPropagation(); handleRemoveTask(index); }}
                      className="ml-1 p-1 hover:bg-red-500 hover:text-white rounded transition-colors text-gray-400"
                      title="删除"
                    >
                      ✕
                    </button>
                  </div>

                  {/* Task 详细属性 */}
                  {isTaskExpanded(index) && (
                    <div className="px-3 py-3 space-y-3 border-t border-gray-300 dark:border-gray-600">
                      {/* 物品 ID */}
                      <div>
                        <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                          物品 ID
                        </label>
                        <ItemIdInput
                          value={typeof task.item === 'string' ? task.item : (task.item as any)?.id || ''}
                          onChange={(val) => handleUpdateTask(index, 'item', val)}
                          placeholder="minecraft:stone"
                        />
                      </div>

                      {/* 数量 */}
                      <div>
                        <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                          数量
                        </label>
                        <input
                          type="number"
                          value={task.count ?? 1}
                          onChange={(e) => handleUpdateTask(index, 'count', parseInt(e.target.value) || 1)}
                          className="w-full px-2 py-1.5 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm"
                        />
                      </div>

                      {/* 任务类型 */}
                      <div>
                        <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                          任务类型
                        </label>
                        <select
                          value={task.type || 'item'}
                          onChange={(e) => handleUpdateTask(index, 'type', e.target.value)}
                          className="w-full px-2 py-1.5 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm"
                        >
                          <option value="item">物品 (item)</option>
                          <option value="fluid">流体 (fluid)</option>
                          <option value="energy">能量 (energy)</option>
                          <option value="xp">经验 (xp)</option>
                          <option value="kill">击杀 (kill)</option>
                          <option value="location">位置 (location)</option>
                          <option value="checkmark">标记 (checkmark)</option>
                          <option value="advancement">进度 (advancement)</option>
                        </select>
                      </div>

                      {/* 描述 */}
                      <div>
                        <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                          描述
                        </label>
                        <input
                          type="text"
                          value={task.description || ''}
                          onChange={(e) => handleUpdateTask(index, 'description', e.target.value)}
                          className="w-full px-2 py-1.5 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm"
                          placeholder="可选"
                        />
                      </div>
                    </div>
                  )}
                </div>
              ))
            ) : (
              <div className="text-sm text-gray-500 text-center py-4">暂无目标</div>
            )}
          </div>
        )}
      </div>

      {/* ========== 奖励（Rewards）区域 ========== */}
      <div className="mt-6">
        <button
          onClick={() => toggleRegion('rewards')}
          className="flex items-center gap-2 w-full px-3 py-2 bg-green-100 dark:bg-green-900/50 hover:bg-green-200 dark:hover:bg-green-900 rounded transition-colors border border-green-300 dark:border-green-700"
        >
          <span className="w-4 flex items-center justify-center"><Chevron expanded={expandedRegions.has('rewards')} className="w-4 h-4 text-gray-500" /></span>
          <span className="text-base">🎁</span>
          <span className="text-sm font-semibold text-green-900 dark:text-green-200 flex-1 text-left">奖励</span>
          <span className="text-xs text-green-600 dark:text-green-400">{formData.rewards?.length || 0} 项</span>
        </button>

        {expandedRegions.has('rewards') && (
          <div className="mt-2 space-y-2">
            {/* 新增 Reward 输入框 */}
            <div className="flex gap-2 items-center">
              <ItemIdInput
                value={newRewardItemId}
                onChange={setNewRewardItemId}
                placeholder="输入物品 ID 后按 + 添加"
                className="flex-1 px-2 py-1.5 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm"
              />
              <button
                onClick={handleAddReward}
                className="px-3 py-1.5 bg-green-500 hover:bg-green-600 text-white text-sm font-medium rounded transition-colors"
                title="添加奖励"
              >
                +
              </button>
            </div>

            {/* Reward 列表 */}
            {formData.rewards && formData.rewards.length > 0 ? (
              formData.rewards.map((reward, index) => (
                <div key={index} className="border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 overflow-hidden">
                  {/* Reward 标题栏 */}
                  <div
                    className="flex items-center gap-2 px-3 py-2 bg-gray-50 dark:bg-gray-750 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                    onClick={() => toggleItemExpanded(index)}
                  >
                    <span className="w-4 flex items-center justify-center"><Chevron expanded={isRewardExpanded(index)} className="w-4 h-4 text-gray-500" /></span>
                    <span className={`w-2 h-2 rounded-full ${getItemTypeColor(reward.type)}`}></span>
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300 flex-1 truncate">
                      {getItemDisplayText(reward)}
                    </span>
                    <span className="text-xs text-gray-500">{getTypeDisplay(reward.type)} ({reward.type})</span>
                    {reward.count !== undefined && (
                      <span className="text-xs text-gray-500">×{reward.count}</span>
                    )}
                    <button
                      onClick={(e) => { e.stopPropagation(); handleRemoveReward(index); }}
                      className="ml-1 p-1 hover:bg-red-500 hover:text-white rounded transition-colors text-gray-400"
                      title="删除"
                    >
                      ✕
                    </button>
                  </div>

                  {/* Reward 详细属性 */}
                  {isRewardExpanded(index) && (
                    <div className="px-3 py-3 space-y-3 border-t border-gray-300 dark:border-gray-600">
                      {/* 物品 ID */}
                      <div>
                        <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                          物品 ID
                        </label>
                        <ItemIdInput
                          value={typeof reward.item === 'string' ? reward.item : (reward.item as any)?.id || ''}
                          onChange={(val) => handleUpdateReward(index, 'item', val)}
                          placeholder="minecraft:stone"
                        />
                      </div>

                      {/* 数量 */}
                      <div>
                        <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                          数量
                        </label>
                        <input
                          type="number"
                          value={reward.count ?? 1}
                          onChange={(e) => handleUpdateReward(index, 'count', parseInt(e.target.value) || 1)}
                          className="w-full px-2 py-1.5 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm"
                        />
                      </div>

                      {/* 奖励类型 */}
                      <div>
                        <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                          奖励类型
                        </label>
                        <select
                          value={reward.type || 'item'}
                          onChange={(e) => handleUpdateReward(index, 'type', e.target.value)}
                          className="w-full px-2 py-1.5 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm"
                        >
                          <option value="item">物品 (item)</option>
                          <option value="fluid">流体 (fluid)</option>
                          <option value="energy">能量 (energy)</option>
                          <option value="xp">经验 (xp)</option>
                          <option value="choice">自选 (choice)</option>
                          <option value="loot">战利品 (loot)</option>
                        </select>
                      </div>

                      {/* 描述 */}
                      {reward.description && (
                        <div>
                          <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                            描述
                          </label>
                          <input
                            type="text"
                            value={reward.description || ''}
                            onChange={(e) => handleUpdateReward(index, 'description', e.target.value)}
                            className="w-full px-2 py-1.5 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm"
                          />
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))
            ) : (
              <div className="text-sm text-gray-500 text-center py-4">暂无奖励</div>
            )}
          </div>
        )}
      </div>

      {/* ========== 属性区域 ========== */}
      <div className="mt-6">
        <button
          onClick={() => toggleRegion('properties')}
          className="flex items-center gap-2 w-full px-3 py-2 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 rounded transition-colors border border-gray-300 dark:border-gray-600"
        >
          <span className="w-4 flex items-center justify-center"><Chevron expanded={expandedRegions.has('properties')} className="w-4 h-4 text-gray-500" /></span>
          <span className="text-base">⚙️</span>
          <span className="text-sm font-semibold text-gray-700 dark:text-gray-300 flex-1 text-left">属性</span>
        </button>

        {expandedRegions.has('properties') && (
          <div className="mt-2 space-y-3 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 p-3">
            {/* 坐标 */}
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                坐标 (游戏内坐标)
              </label>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <span className="text-xs text-gray-500 mr-1">X</span>
                  <input
                    type="number"
                    step="0.5"
                    value={formData.x || 0}
                    onChange={(e) => handleChange('x', parseFloat(e.target.value))}
                    className="w-full px-2 py-1.5 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm"
                  />
                </div>
                <div>
                  <span className="text-xs text-gray-500 mr-1">Y</span>
                  <input
                    type="number"
                    step="0.5"
                    value={formData.y || 0}
                    onChange={(e) => handleChange('y', parseFloat(e.target.value))}
                    className="w-full px-2 py-1.5 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm"
                  />
                </div>
              </div>
            </div>

            {/* 尺寸和形状 */}
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                  尺寸 (直径，游戏单位)
                </label>
                <input
                  type="number"
                  step="0.1"
                  value={formData.size ?? 1}
                  onChange={(e) => handleChange('size', parseFloat(e.target.value) || 1)}
                  className="w-full px-2 py-1.5 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                  形状
                </label>
                <select
                  value={formData.shape || 'circle'}
                  onChange={(e) => handleChange('shape', e.target.value)}
                  className="w-full px-2 py-1.5 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm"
                >
                  <option value="circle">圆形 (circle)</option>
                  <option value="hexagon">六边形 (hexagon)</option>
                  <option value="gear">齿轮形 (gear)</option>
                  <option value="diamond">菱形 (diamond)</option>
                  <option value="pentagon">五边形 (pentagon)</option>
                  <option value="octagon">八边形 (octagon)</option>
                  <option value="none">无 (none)</option>
                </select>
              </div>
            </div>

            {/* 依赖 */}
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                依赖 (ID 列表，逗号分隔)
              </label>
              <input
                type="text"
                value={formData.dependencies?.join(', ') || ''}
                onChange={(e) =>
                  handleChange(
                    'dependencies',
                    e.target.value
                      .split(',')
                      .map((s) => s.trim())
                      .filter(Boolean)
                  )
                }
                className="w-full px-2 py-1.5 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm"
                placeholder="依赖的任务 ID，用逗号分隔"
              />
            </div>

            {/* 隐藏状态 */}
            <div className="border-t border-gray-200 dark:border-gray-700 pt-3">
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-2">
                隐藏状态
              </label>
              <div className="space-y-2">
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={!!formData.invisible}
                    onChange={(e) => handleChange('invisible', e.target.checked)}
                    className="rounded border-gray-300 dark:border-gray-600"
                  />
                  <span className="text-gray-700 dark:text-gray-300">不可见 (invisible)</span>
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={!!formData.hide_until_deps_complete}
                    onChange={(e) => handleChange('hide_until_deps_complete', e.target.checked)}
                    className="rounded border-gray-300 dark:border-gray-600"
                  />
                  <span className="text-gray-700 dark:text-gray-300">前置完成后可见</span>
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={!!formData.hide_until_deps_visible}
                    onChange={(e) => handleChange('hide_until_deps_visible', e.target.checked)}
                    className="rounded border-gray-300 dark:border-gray-600"
                  />
                  <span className="text-gray-700 dark:text-gray-300">前置可见后可见</span>
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={!!formData.hide_dependency_lines}
                    onChange={(e) => handleChange('hide_dependency_lines', e.target.checked)}
                    className="rounded border-gray-300 dark:border-gray-600"
                  />
                  <span className="text-gray-700 dark:text-gray-300">隐藏依赖线</span>
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={!!formData.hide_dependent_lines}
                    onChange={(e) => handleChange('hide_dependent_lines', e.target.checked)}
                    className="rounded border-gray-300 dark:border-gray-600"
                  />
                  <span className="text-gray-700 dark:text-gray-300">隐藏被依赖线</span>
                </label>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 保存按钮 */}
      <div className="mt-6 flex gap-2">
        <button
          onClick={handleSave}
          className="flex-1 bg-blue-500 hover:bg-blue-600 text-white font-medium py-2 px-4 rounded"
        >
          保存
        </button>
        <button
          onClick={onClose}
          className="flex-1 bg-gray-300 hover:bg-gray-400 text-gray-800 font-medium py-2 px-4 rounded"
        >
          取消
        </button>
      </div>
    </div>
  );
}
