// Author: Khadim Gueye

import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { useEffect, useRef } from "react";

export interface MapPoint {
  lat: number;
  lon: number;
  weight: number;
  label: string;
  recent?: boolean;
}

export default function WorldMap({ points, height = 420 }: { points: MapPoint[]; height?: number }) {
  const box = useRef<HTMLDivElement>(null);
  const map = useRef<L.Map | null>(null);
  const layer = useRef<L.LayerGroup | null>(null);
  const fitted = useRef(false);

  useEffect(() => {
    if (!box.current || map.current) return;
    map.current = L.map(box.current, { worldCopyJump: true, minZoom: 1, scrollWheelZoom: false }).setView([15, 10], 2);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 12,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    }).addTo(map.current);
    layer.current = L.layerGroup().addTo(map.current);
    const observer = new ResizeObserver(() => map.current?.invalidateSize());
    observer.observe(box.current);
    return () => {
      observer.disconnect();
      map.current?.remove();
      map.current = null;
      fitted.current = false;
    };
  }, []);

  useEffect(() => {
    const group = layer.current;
    if (!group || !map.current) return;
    group.clearLayers();
    const max = Math.max(1, ...points.map((p) => p.weight));
    for (const p of points) {
      const radius = 6 + 22 * Math.sqrt(p.weight / max);
      L.circleMarker([p.lat, p.lon], {
        radius,
        color: "#0f7a5c",
        weight: 1.2,
        fillColor: p.recent ? "#f59e0b" : "#1baf7a",
        fillOpacity: 0.55,
        className: p.recent ? "map-pulse" : "",
      })
        .bindTooltip(p.label, { direction: "top" })
        .addTo(group);
    }
    if (!fitted.current && points.length) {
      fitted.current = true;
      if (points.length > 1) map.current.fitBounds(L.latLngBounds(points.map((p) => [p.lat, p.lon])), { padding: [30, 30], maxZoom: 5 });
      else map.current.setView([points[0].lat, points[0].lon], 5);
    }
  }, [points]);

  return <div ref={box} className="world-map" style={{ height }} />;
}
