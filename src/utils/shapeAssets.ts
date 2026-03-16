export interface ShapeAssets {
  background: string;
  mask: string; // shape mask (PNG)
  outline: string;
}

// Return public URLs for the three-layer shape assets under /shapes/{shape}/
export function getShapeAssets(shapeName?: string): ShapeAssets {
  const s = shapeName || 'circle';
  const base = `/shapes/${s}`;
  return {
    background: `${base}/background.png`,
    mask: `${base}/shape.png`,
    outline: `${base}/outline.png`,
  };
}
