// Author: Khadim Gueye

import { forceCenter, forceCollide, forceLink, forceManyBody, forceSimulation, forceX, forceY, type SimulationNodeDatum } from "d3-force";
import { useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent, type WheelEvent } from "react";
import type { GeneFlowLink, GeneFlowNode } from "../api";
import { STATE_PATHS, MAP_VIEWBOX } from "../data/nigeriaMap";

export type Metric = "outdegree" | "indegree" | "betweenness" | "closeness" | "source_hub_ratio" | "samples";

export interface Positioned {
  x: number;
  y: number;
}

interface Props {
  nodes: GeneFlowNode[];
  links: GeneFlowLink[];
  metric: Metric;
  colors: Map<string, string>;
  visible: number;
  selected: string | null;
  onSelect: (id: string | null) => void;
  mode: "network" | "map";
  codes: Record<string, string>;
  metricLabel: string;
}

const SIZE = 900;

interface SimNode extends SimulationNodeDatum {
  id: string;
}

function radiusScale(nodes: GeneFlowNode[], metric: Metric, min: number, max: number) {
  const top = Math.max(1e-9, ...nodes.map((n) => n[metric]));
  return (n: GeneFlowNode) => min + (max - min) * Math.sqrt(Math.max(0, n[metric]) / top);
}

function useForceLayout(nodes: GeneFlowNode[], links: GeneFlowLink[], radius: (n: GeneFlowNode) => number) {
  return useMemo(() => {
    const sim: SimNode[] = nodes.map((n, i) => {
      const angle = (i / Math.max(1, nodes.length)) * Math.PI * 2;
      return { id: n.id, x: SIZE / 2 + Math.cos(angle) * 250, y: SIZE / 2 + Math.sin(angle) * 250 };
    });
    const byId = new Map(nodes.map((n) => [n.id, n]));
    const maxW = Math.max(1, ...links.map((l) => l.weight));
    const simulation = forceSimulation(sim)
      .force(
        "link",
        forceLink<SimNode, { source: string; target: string; weight: number }>(links.map((l) => ({ ...l })))
          .id((d) => d.id)
          .distance((l) => 230 - 150 * Math.sqrt(l.weight / maxW))
          .strength((l) => 0.05 + 0.35 * (l.weight / maxW)),
      )
      .force("charge", forceManyBody().strength(-520))
      .force("center", forceCenter(SIZE / 2, SIZE / 2))
      .force("x", forceX(SIZE / 2).strength(0.06))
      .force("y", forceY(SIZE / 2).strength(0.06))
      .force("collide", forceCollide<SimNode>((d) => radius(byId.get(d.id)!) + 14))
      .stop();
    for (let i = 0; i < 360; i++) simulation.tick();
    const xs = sim.map((d) => d.x!);
    const ys = sim.map((d) => d.y!);
    const [x0, x1, y0, y1] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
    const scale = Math.min((SIZE - 140) / Math.max(1, x1 - x0), (SIZE - 140) / Math.max(1, y1 - y0), 1.6);
    const out = new Map<string, Positioned>();
    for (const d of sim) {
      out.set(d.id, { x: SIZE / 2 + (d.x! - (x0 + x1) / 2) * scale, y: SIZE / 2 + (d.y! - (y0 + y1) / 2) * scale });
    }
    return out;
  }, [nodes, links, radius]);
}

function useMapLayout(codes: Record<string, string>, nodes: GeneFlowNode[], active: boolean) {
  const ref = useRef<SVGGElement>(null);
  const [centres, setCentres] = useState<Map<string, Positioned>>(new Map());
  useEffect(() => {
    if (!active || !ref.current) return;
    const out = new Map<string, Positioned>();
    for (const n of nodes) {
      const el = ref.current.querySelector<SVGPathElement>(`[data-code="${codes[n.id]}"]`);
      if (!el) continue;
      const b = el.getBBox();
      out.set(n.id, { x: b.x + b.width / 2, y: b.y + b.height / 2 });
    }
    setCentres(out);
  }, [codes, nodes, active]);
  return { ref, centres };
}

function curve(a: Positioned, b: Positioned, ra: number, rb: number, bend: number) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len = Math.hypot(dx, dy) || 1;
  const nx = -dy / len;
  const ny = dx / len;
  const cx = (a.x + b.x) / 2 + nx * len * bend;
  const cy = (a.y + b.y) / 2 + ny * len * bend;
  const sa = Math.hypot(cx - a.x, cy - a.y) || 1;
  const sb = Math.hypot(b.x - cx, b.y - cy) || 1;
  const start = { x: a.x + ((cx - a.x) / sa) * ra, y: a.y + ((cy - a.y) / sa) * ra };
  const end = { x: b.x - ((b.x - cx) / sb) * (rb + 2), y: b.y - ((b.y - cy) / sb) * (rb + 2) };
  const ux = (end.x - cx) / (Math.hypot(end.x - cx, end.y - cy) || 1);
  const uy = (end.y - cy) / (Math.hypot(end.x - cx, end.y - cy) || 1);
  return { d: `M${start.x},${start.y} Q${cx},${cy} ${end.x},${end.y}`, end, ux, uy };
}

export default function GeneFlowGraph({ nodes, links, metric, colors, visible, selected, onSelect, mode, codes, metricLabel }: Props) {
  const isMap = mode === "map";
  const radius = useMemo(() => radiusScale(nodes, metric, isMap ? 4 : 9, isMap ? 20 : 36), [nodes, metric, isMap]);
  const layoutRadius = useMemo(() => radiusScale(nodes, "outdegree", 9, 36), [nodes]);
  const force = useForceLayout(nodes, links, layoutRadius);
  const map = useMapLayout(codes, nodes, isMap);
  const [dragged, setDragged] = useState<Map<string, Positioned>>(new Map());
  const [view, setView] = useState({ k: 1, x: 0, y: 0 });
  const [hover, setHover] = useState<string | null>(null);
  const svg = useRef<SVGSVGElement>(null);
  const drag = useRef<{ id: string | null; x: number; y: number; moved: boolean } | null>(null);
  const [viewW, viewH] = isMap ? MAP_VIEWBOX.split(" ").slice(2).map(Number) : [SIZE, SIZE];

  useEffect(() => {
    setDragged(new Map());
    setView({ k: 1, x: 0, y: 0 });
  }, [nodes, mode]);

  const pos = (id: string) => (isMap ? map.centres.get(id) : dragged.get(id) ?? force.get(id));
  const byId = useMemo(() => new Map(nodes.map((n) => [n.id, n])), [nodes]);
  const maxW = Math.max(1, ...links.map((l) => l.weight));
  const focus = hover ?? selected;
  const pairs = useMemo(() => new Set(links.map((l) => `${l.source}>${l.target}`)), [links]);

  const toSvg = (e: { clientX: number; clientY: number }) => {
    const r = svg.current!.getBoundingClientRect();
    const sx = ((e.clientX - r.left) / r.width) * viewW;
    const sy = ((e.clientY - r.top) / r.height) * viewH;
    return { x: (sx - view.x) / view.k, y: (sy - view.y) / view.k, sx, sy };
  };

  const onWheel = (e: WheelEvent<SVGSVGElement>) => {
    if (!e.ctrlKey && !e.metaKey) return;
    e.preventDefault();
    zoomAt(e.deltaY < 0 ? 1.2 : 1 / 1.2, toSvg(e));
  };

  const zoomAt = (factor: number, at?: { sx: number; sy: number }) => {
    setView((v) => {
      const k = Math.max(0.5, Math.min(5, v.k * factor));
      const sx = at?.sx ?? viewW / 2;
      const sy = at?.sy ?? viewH / 2;
      return { k, x: sx - ((sx - v.x) / v.k) * k, y: sy - ((sy - v.y) / v.k) * k };
    });
  };

  const onDown = (e: ReactPointerEvent, id: string | null) => {
    e.stopPropagation();
    (e.target as Element).setPointerCapture?.(e.pointerId);
    const p = toSvg(e);
    drag.current = { id, x: id ? p.x : p.sx, y: id ? p.y : p.sy, moved: false };
  };

  const onMove = (e: ReactPointerEvent) => {
    const d = drag.current;
    if (!d) return;
    const p = toSvg(e);
    if (d.id) {
      if (isMap) return;
      d.moved = true;
      setDragged((m) => new Map(m).set(d.id!, { x: p.x, y: p.y }));
    } else {
      const dx = p.sx - d.x;
      const dy = p.sy - d.y;
      if (Math.abs(dx) + Math.abs(dy) > 2) d.moved = true;
      d.x = p.sx;
      d.y = p.sy;
      setView((v) => ({ ...v, x: v.x + dx, y: v.y + dy }));
    }
  };

  const onUp = () => {
    const d = drag.current;
    drag.current = null;
    if (!d) return;
    if (!d.moved) onSelect(d.id && d.id !== selected ? d.id : null);
  };

  const shown = links.slice(0, visible);
  const drawn = [...shown].sort((a, b) => a.weight - b.weight);
  const particles = focus ? drawn.filter((l) => l.source === focus || l.target === focus) : drawn.slice(-70);
  const tip = hover ? byId.get(hover) : null;
  const tipPos = hover ? pos(hover) : null;

  return (
    <div className={`gf-graph${isMap ? " is-map" : ""}`}>
      <svg
        ref={svg}
        viewBox={`0 0 ${viewW} ${viewH}`}
        onWheel={onWheel}
        onPointerDown={(e) => onDown(e, null)}
        onPointerMove={onMove}
        onPointerUp={onUp}
        role="img"
        aria-label={`Gene flow ${mode}, node size shows ${metricLabel}`}
      >
        <g transform={`translate(${view.x},${view.y}) scale(${view.k})`}>
          {isMap && (
            <g ref={map.ref} className="gf-map-states">
              {Object.entries(STATE_PATHS).map(([code, d]) => (
                <path key={code} d={d} data-code={code} />
              ))}
            </g>
          )}
          <g className="gf-links">
            {drawn.map((l) => {
              const a = pos(l.source);
              const b = pos(l.target);
              if (!a || !b) return null;
              const na = byId.get(l.source)!;
              const nb = byId.get(l.target)!;
              const c = curve(a, b, radius(na), radius(nb), pairs.has(`${l.target}>${l.source}`) ? 0.16 : 0.1);
              const w = (isMap ? 0.6 : 1) + (isMap ? 4 : 7) * Math.sqrt(l.weight / maxW);
              const dim = focus && l.source !== focus && l.target !== focus;
              const hot = focus && !dim;
              const head = 3 + w * 1.4;
              const color = colors.get(l.source) ?? "#2a78d6";
              return (
                <g key={`${l.source}>${l.target}`} className={`gf-link${dim ? " dim" : ""}${hot ? " hot" : ""}`}>
                  <path id={`gf-${mode}-${l.source}-${l.target}`.replace(/\s+/g, "_")} d={c.d} stroke={color} strokeWidth={w} fill="none" />
                  <path
                    d={`M${c.end.x},${c.end.y} L${c.end.x - c.ux * head - c.uy * head * 0.6},${c.end.y - c.uy * head + c.ux * head * 0.6} L${c.end.x - c.ux * head + c.uy * head * 0.6},${c.end.y - c.uy * head - c.ux * head * 0.6} Z`}
                    fill={color}
                  />
                  <title>{`${l.source} → ${l.target}: ${l.weight} transition${l.weight === 1 ? "" : "s"}`}</title>
                </g>
              );
            })}
          </g>
          <g className="gf-particles" aria-hidden="true">
            {particles.flatMap((l, i) => {
              if (!pos(l.source) || !pos(l.target)) return [];
              const dur = Math.min(12, 1.2 * Math.pow(maxW / l.weight, 0.75));
              const dots = 1 + Math.min(2, Math.floor((3 * l.weight) / maxW));
              const href = `#gf-${mode}-${l.source}-${l.target}`.replace(/\s+/g, "_");
              return Array.from({ length: dots }, (_, k) => (
                <circle key={`${l.source}>${l.target}>${k}`} r={isMap ? 2.2 : 3.2} fill="#fff" stroke={colors.get(l.source)} strokeWidth={1.4}>
                  <animateMotion dur={`${dur}s`} begin={`${((i % 7) * 0.3 + (k * dur) / dots).toFixed(2)}s`} repeatCount="indefinite">
                    <mpath href={href} />
                  </animateMotion>
                </circle>
              ));
            })}
          </g>
          <g className="gf-nodes">
            {nodes.map((n) => {
              const p = pos(n.id);
              if (!p) return null;
              const r = radius(n);
              const dim = focus && focus !== n.id && !pairs.has(`${focus}>${n.id}`) && !pairs.has(`${n.id}>${focus}`);
              return (
                <g
                  key={n.id}
                  className={`gf-node${dim ? " dim" : ""}${selected === n.id ? " selected" : ""}`}
                  transform={`translate(${p.x},${p.y})`}
                  onPointerDown={(e) => onDown(e, n.id)}
                  onPointerEnter={() => setHover(n.id)}
                  onPointerLeave={() => setHover(null)}
                >
                  <circle r={r} fill={colors.get(n.id)} style={{ transition: "r 0.6s ease" }} />
                  <text y={r + (isMap ? 9 : 13)} fontSize={isMap ? 9 : 13}>
                    {n.id === "Federal Capital Territory" ? "FCT" : n.id}
                  </text>
                </g>
              );
            })}
          </g>
        </g>
      </svg>
      {tip && tipPos && (
        <div
          className="gf-tip"
          style={{ left: `${((tipPos.x * view.k + view.x) / viewW) * 100}%`, top: `${((tipPos.y * view.k + view.y) / viewH) * 100}%` }}
        >
          <strong>{tip.id}</strong>
          <span>{tip.samples} samples</span>
          <span>
            Sends to {tip.outdegree} states · receives from {tip.indegree}
          </span>
          <span>
            {tip.out_flow} outgoing / {tip.in_flow} incoming gene flow links
          </span>
        </div>
      )}
      <div className="gf-zoom">
        <button onClick={() => zoomAt(1.25)} aria-label="Zoom in">
          +
        </button>
        <button onClick={() => zoomAt(0.8)} aria-label="Zoom out">
          −
        </button>
        <button onClick={() => { setView({ k: 1, x: 0, y: 0 }); setDragged(new Map()); }} aria-label="Reset view">
          ⟲
        </button>
      </div>
    </div>
  );
}
