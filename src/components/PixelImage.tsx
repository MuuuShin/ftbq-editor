import { useRef, useEffect, useState, useCallback } from 'react';
import { detectAnimationFromImage, type AnimationInfo } from '../utils/itemAtlas';

export interface PixelImageProps {
  src: string;
  alt?: string;
  size?: number | string;      // 数字=等比宽高（px），字符串=自定义（如 "100%"）
  width?: string | number;
  height?: string | number;
  className?: string;
  fps?: number;                // 动图帧率，默认 15
  onError?: () => void;
  onLoad?: (info: AnimationInfo) => void;
}

/**
 * Minecraft 像素画渲染组件
 *
 * 功能特性：
 * - 自动检测图片尺寸，使用像素化渲染（CSS image-rendering: pixelated）
 * - 自动检测并播放 Minecraft 风格动图（垂直堆叠的 sprite sheet）
 * - 支持自定义尺寸和帧率
 *
 * @example
 * <PixelImage src="/path/to/sprite.png" size={64} />
 * <PixelImage src="/path/to/animation.png" size={32} fps={20} />
 */
export default function PixelImage({
  src,
  alt = '',
  size,
  width,
  height,
  className = '',
  fps = 10,
  onError,
  onLoad,
}: PixelImageProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const [animationInfo, setAnimationInfo] = useState<AnimationInfo | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const [hasError, setHasError] = useState(false);
  const DEBUG = true; // set true locally to enable verbose logs

  // 计算显示尺寸
  const displaySize = useCallback(() => {
    if (size !== undefined) {
      if (typeof size === 'number') {
        return { width: `${size}px`, height: `${size}px` };
      }
      return { width: size, height: size };
    }
    return {
      width: width !== undefined ? (typeof width === 'number' ? `${width}px` : width) : 'auto',
      height: height !== undefined ? (typeof height === 'number' ? `${height}px` : height) : 'auto',
    };
  }, [size, width, height]);

  // 加载图片并检测动图
  useEffect(() => {
    setHasError(false);
    setIsLoaded(false);
    setAnimationInfo(null);

    // Validate src: accept common loadable schemes/paths including blob: (object URLs created from Blobs)
    const isLikelyUrl = (s: string) => {
      if (!s) return false;
      const trimmed = s.trim();
      return (
        trimmed.startsWith('data:') ||
        trimmed.startsWith('blob:') ||
        trimmed.startsWith('http://') ||
        trimmed.startsWith('https://') ||
        trimmed.startsWith('/') ||
        trimmed.startsWith('./') ||
        trimmed.startsWith('../')
      );
    };

    if (!isLikelyUrl(src)) {
      // Treat as non-URL; likely an item id that should be resolved by upstream code (itemMap)
      setHasError(true);
      onError?.();
      return;
    }

    const img = new Image();
    imgRef.current = img;

    img.onload = () => {
      if (DEBUG) console.debug('[PixelImage] onload', { src, naturalWidth: img.naturalWidth, naturalHeight: img.naturalHeight });
      // 使用已加载的 img 元素直接检测是否为动图（避免二次加载）
      const detectedInfo = detectAnimationFromImage(img);
      setAnimationInfo(detectedInfo);
      setIsLoaded(true);
      onLoad?.(detectedInfo);
    };

    img.onerror = () => {
      if (DEBUG) console.warn('[PixelImage] onerror', { src });
      setHasError(true);
      onError?.();
    };

    img.src = src;

    // 清理
    return () => {
      imgRef.current = null;
    };
  }, [src, onError, onLoad]);

  // 绘制动图
  useEffect(() => {
    if (!isLoaded || !animationInfo || !animationInfo.isAnimation) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // 设置 Canvas 尺寸为单帧尺寸
    canvas.width = animationInfo.frameWidth;
    canvas.height = animationInfo.frameHeight;

    // 禁用图像平滑（像素化渲染）
    ctx.imageSmoothingEnabled = false;
    ctx.imageSmoothingQuality = 'low' as ImageSmoothingQuality;

    let currentFrame = 0;
    let rafId: number | null = null;
    let lastTime = performance.now();
    const frameInterval = 1000 / fps;

    const loop = (time: number) => {
      if (!imgRef.current || !canvas) return;
      const elapsed = time - lastTime;
      if (elapsed >= frameInterval) {
        const { frameWidth, frameHeight, frameSize } = animationInfo;
        const sourceY = currentFrame * frameSize;
        ctx.clearRect(0, 0, frameWidth, frameHeight);
        ctx.drawImage(
          imgRef.current,
          0, sourceY, frameWidth, frameHeight,
          0, 0, frameWidth, frameHeight
        );
        currentFrame = (currentFrame + 1) % animationInfo.frameCount;
        lastTime = time;
      }
      rafId = requestAnimationFrame(loop);
    };

    rafId = requestAnimationFrame(loop);

    return () => {
      if (rafId !== null) cancelAnimationFrame(rafId);
    };
  }, [isLoaded, animationInfo, fps]);

  // 错误状态
  if (hasError) {
    return (
      <div
        className={`flex items-center justify-center bg-gray-200 dark:bg-gray-700 text-gray-400 dark:text-gray-500 ${className}`}
        style={{ width: displaySize().width, height: displaySize().height }}
      >
        <span className="text-xs">图片加载失败</span>
      </div>
    );
  }

  // 加载状态
  if (!isLoaded) {
    return (
      <div
        className={`flex items-center justify-center bg-gray-100 dark:bg-gray-800 animate-pulse ${className}`}
        style={{ width: displaySize().width, height: displaySize().height }}
      >
        <span className="text-xs text-gray-400">加载中...</span>
      </div>
    );
  }

  // 如果是动图，渲染 Canvas
  if (animationInfo?.isAnimation) {
    return (
      <canvas
        ref={canvasRef}
        className={`pixelated ${className}`}
        style={{
          width: displaySize().width,
          height: displaySize().height,
          imageRendering: 'pixelated',
        } as React.CSSProperties}
      />
    );
  }

  // 静态图，直接渲染 img
  return (
    <img
      src={src}
      alt={alt}
      onError={(e) => { if (DEBUG) console.warn('[PixelImage] <img> onError', { src, ev: e }); }}
      className={`pixelated ${className}`}
      style={{
        width: displaySize().width,
        height: displaySize().height,
        imageRendering: 'pixelated',
      } as React.CSSProperties}
    />
  );
}

export { PixelImage };
