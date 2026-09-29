// Author: Khadim Gueye

import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { api } from "../api";

const KEY = "malaria.visitor";

function visitorId() {
  try {
    let id = localStorage.getItem(KEY);
    if (!id) {
      id = crypto.randomUUID?.() ?? `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
      localStorage.setItem(KEY, id);
    }
    return id;
  } catch {
    return null;
  }
}

export function useVisitTracking() {
  const location = useLocation();
  useEffect(() => {
    if (window.self !== window.top || navigator.webdriver) return;
    const id = visitorId();
    if (!id) return;
    const timer = window.setTimeout(() => {
      api
        .track({ visitor_id: id, path: `${location.pathname}${location.search}`, referrer: document.referrer || undefined })
        .catch(() => undefined);
    }, 600);
    return () => window.clearTimeout(timer);
  }, [location.pathname, location.search]);
}
