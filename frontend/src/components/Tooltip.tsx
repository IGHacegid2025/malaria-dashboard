// Author: Khadim Gueye

import { useCallback, useState, type MouseEvent, type ReactNode } from "react";
import { createPortal } from "react-dom";

export interface TipState {
  x: number;
  y: number;
  content: ReactNode;
}

export function useTooltip() {
  const [tip, setTip] = useState<TipState | null>(null);
  const show = useCallback((e: MouseEvent, content: ReactNode) => {
    setTip({ x: e.clientX, y: e.clientY, content });
  }, []);
  const hide = useCallback(() => setTip(null), []);
  return { tip, show, hide };
}

export function TooltipLayer({ tip }: { tip: TipState | null }) {
  if (!tip) return null;
  const flipX = tip.x > window.innerWidth - 280;
  const flipY = tip.y > window.innerHeight - 160;
  const style = {
    left: flipX ? undefined : tip.x + 14,
    right: flipX ? window.innerWidth - tip.x + 14 : undefined,
    top: flipY ? undefined : tip.y + 14,
    bottom: flipY ? window.innerHeight - tip.y + 14 : undefined,
  };
  return createPortal(
    <div className="tooltip" style={style} role="tooltip">
      {tip.content}
    </div>,
    document.body,
  );
}
