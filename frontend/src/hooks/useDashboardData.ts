// Author: Khadim Gueye

import { useEffect, useState } from "react";
import {
  api,
  type AlertRule,
  type HrpRow,
  type MisRow,
  type MoiRow,
  type Observation,
  type Publication,
  type SpeciesRow,
  type StateInfo,
} from "../api";

export interface DashboardData {
  states: StateInfo[];
  observations: Observation[];
  species: SpeciesRow[];
  hrp: HrpRow[];
  moi: MoiRow[];
  mis: MisRow[];
  publications: Publication[];
  alerts: AlertRule[];
}

let cache: Promise<DashboardData> | null = null;

export function invalidateDashboardData() {
  cache = null;
}

function loadAll(): Promise<DashboardData> {
  if (!cache) {
    cache = Promise.all([
      api.states(),
      api.observations(),
      api.species(),
      api.hrpDeletions(),
      api.moi(),
      api.misCases(),
      api.publications(),
      api.alerts(),
    ]).then(([states, observations, species, hrp, moi, mis, publications, alerts]) => ({
      states,
      observations,
      species,
      hrp,
      moi,
      mis,
      publications,
      alerts,
    }));
    cache.catch(() => {
      cache = null;
    });
  }
  return cache;
}

export function useDashboardData() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    loadAll()
      .then((result) => active && setData(result))
      .catch((err: Error) => active && setError(err.message));
    return () => {
      active = false;
    };
  }, []);

  return { data, error };
}
