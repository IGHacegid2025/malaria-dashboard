// Author: Khadim Gueye

import type { ReactElement } from "react";
import { Navigate, NavLink, Route, Routes } from "react-router-dom";
import AdminApp from "./admin/AdminApp";
import { FilterProvider } from "./filters";
import { useVisitTracking } from "./lib/track";
import { SettingsProvider, useSettings } from "./settings";
import ExplorePage from "./pages/ExplorePage";
import GenomicsPage from "./pages/GenomicsPage";
import HomePage from "./pages/HomePage";
import LandingPage from "./pages/LandingPage";
import TeamPage from "./pages/TeamPage";
import MapExplorer from "./pages/MapExplorer";
import ProjectsPage from "./pages/ProjectsPage";
import SourcesPage from "./pages/SourcesPage";
import "./App.css";

const NAV: { to: string; label: string; end?: boolean; key?: string }[] = [
  { to: "/", label: "Home", end: true },
  { to: "/dashboard", label: "Dashboard" },
  { to: "/map", label: "Map", key: "map" },
  { to: "/trends", label: "Trends", key: "trends" },
  { to: "/genomics", label: "Genomics", key: "genomics" },
  { to: "/sources", label: "Data sources", key: "sources" },
  { to: "/team", label: "Team", key: "team" },
  { to: "/projects", label: "Projects", key: "projects" },
];

function Logo() {
  return (
    <svg className="logo" viewBox="0 0 40 40" aria-hidden="true">
      <defs>
        <linearGradient id="logo-grad" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#6da7ec" />
          <stop offset="1" stopColor="#1baf7a" />
        </linearGradient>
      </defs>
      <rect width="40" height="40" rx="11" fill="url(#logo-grad)" />
      <path
        d="M13 9c0 6 14 8 14 14s-14 5-14 8M27 9c0 6-14 8-14 14s14 5 14 8"
        stroke="#fff"
        strokeWidth="2.4"
        fill="none"
        strokeLinecap="round"
      />
      <path d="M15 14h10M14.5 26h11" stroke="#fff" strokeWidth="2" strokeLinecap="round" opacity="0.8" />
    </svg>
  );
}

function PublicSite() {
  useVisitTracking();
  const { settings } = useSettings();
  const title = settings?.["site.title"] ?? "Malaria Genomic Surveillance";
  const hidden = new Set(settings ? settings["nav.hidden"] ?? [] : ["projects"]);
  const off = (key: string, page: ReactElement) => (settings && hidden.has(key) ? <Navigate to="/" replace /> : page);
  const lab = settings?.["site.lab"] ?? "Ify Aniebo Lab";
  const institute = settings?.["site.institute"] ?? "Institute of Genomics and Global Health, Nigeria";
  const announcement = settings?.["site.announcement"];
  const github = settings?.["site.github_url"] ?? "https://github.com/AnieboGenomicsLab";
  const website = settings?.["site.website_url"] ?? "https://ighresearch.org/en/";
  const linkedin = settings?.["site.linkedin_url"] ?? "https://www.linkedin.com/company/acegid-igh";
  return (
    <FilterProvider>
      <div className="app-shell">
        {announcement && (
          <div className="announcement" role="status">
            <span className="live-dot" aria-hidden="true" />
            {announcement}
          </div>
        )}
        <header className="app-header">
          <div className="app-header-inner">
            <NavLink to="/" className="brand">
              <Logo />
              <div>
                <div className="brand-name">{title}</div>
                <div className="brand-sub">
                  <strong>{lab}</strong> · {institute}
                </div>
              </div>
            </NavLink>
            <nav className="app-nav" aria-label="Main">
              {NAV.filter((item) => !item.key || !hidden.has(item.key)).map((item) => (
                <NavLink key={item.to} to={item.to} end={item.end} className={({ isActive }) => (isActive ? "active" : "")}>
                  {item.label}
                </NavLink>
              ))}
            </nav>
          </div>
        </header>
        <main className="app-main">
          <Routes>
            <Route path="/" element={<LandingPage />} />
            <Route path="/dashboard" element={<HomePage />} />
            <Route path="/team" element={off("team", <TeamPage />)} />
            <Route path="/map" element={off("map", <MapExplorer />)} />
            <Route path="/trends" element={off("trends", <ExplorePage />)} />
            <Route path="/explore" element={off("trends", <ExplorePage />)} />
            <Route path="/sources" element={off("sources", <SourcesPage />)} />
            <Route path="/genomics" element={off("genomics", <GenomicsPage />)} />
            <Route path="/projects" element={off("projects", <ProjectsPage />)} />
          </Routes>
        </main>
        <footer className="app-footer">
          <span>
            {lab}, {institute}
          </span>
          <span>Data: IGH sequencing and published studies</span>
          <span className="footer-links">
            {website && (
              <a href={website} target="_blank" rel="noreferrer">
                <svg viewBox="0 0 16 16" aria-hidden="true">
                  <circle cx="8" cy="8" r="6.5" fill="none" stroke="currentColor" strokeWidth="1.4" />
                  <path d="M1.5 8h13M8 1.5c2 2 2.8 4.2 2.8 6.5S10 12.5 8 14.5C6 12.5 5.2 10.3 5.2 8S6 3.5 8 1.5z" fill="none" stroke="currentColor" strokeWidth="1.4" />
                </svg>
                IGH website
              </a>
            )}
            {linkedin && (
              <a href={linkedin} target="_blank" rel="noreferrer">
                <svg viewBox="0 0 16 16" aria-hidden="true">
                  <path fill="currentColor" d="M13.6 0H2.4A2.4 2.4 0 000 2.4v11.2A2.4 2.4 0 002.4 16h11.2a2.4 2.4 0 002.4-2.4V2.4A2.4 2.4 0 0013.6 0zM4.9 13.3H2.7V6h2.2v7.3zM3.8 5A1.3 1.3 0 113.8 2.4 1.3 1.3 0 013.8 5zm9.5 8.3h-2.2V9.8c0-.9 0-2-1.2-2s-1.4 1-1.4 1.9v3.6H6.3V6h2.1v1a2.3 2.3 0 012.1-1.2c2.2 0 2.7 1.5 2.7 3.4v4.1z" />
                </svg>
                LinkedIn
              </a>
            )}
            {github && (
              <a href={github} target="_blank" rel="noreferrer">
                <svg viewBox="0 0 16 16" aria-hidden="true">
                  <path fill="currentColor" d="M8 0a8 8 0 00-2.53 15.59c.4.07.55-.17.55-.38v-1.33c-2.23.48-2.7-1.07-2.7-1.07-.36-.92-.89-1.17-.89-1.17-.73-.5.05-.49.05-.49.8.06 1.23.83 1.23.83.72 1.23 1.88.87 2.34.67.07-.52.28-.87.5-1.07-1.78-.2-3.65-.89-3.65-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82a7.6 7.6 0 014 0c1.53-1.03 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.28.82 2.15 0 3.07-1.87 3.75-3.66 3.95.29.25.54.73.54 1.48v2.2c0 .21.15.46.55.38A8 8 0 008 0z" />
                </svg>
                GitHub
              </a>
            )}
          </span>
          <NavLink to="/admin" className="footer-admin">
            Admin
          </NavLink>
        </footer>
      </div>
    </FilterProvider>
  );
}

export default function App() {
  return (
    <SettingsProvider>
      <Routes>
        <Route path="/admin/*" element={<AdminApp />} />
        <Route path="/*" element={<PublicSite />} />
      </Routes>
    </SettingsProvider>
  );
}
