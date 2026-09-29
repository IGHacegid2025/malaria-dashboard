// Author: Khadim Gueye

import { useEffect, useState } from "react";
import { api, type Partner } from "../api";
import HeroBackdrop, { mediaSrc } from "../components/HeroBackdrop";
import { Reveal } from "../components/Motion";
import { EmptyState } from "../components/Panels";

function initials(name: string) {
  const inBrackets = name.match(/\(([A-Z0-9]{2,6})\)/);
  if (inBrackets) return inBrackets[1];
  const acronym = name.split(/\s+/).find((w) => /^[A-Z][A-Z0-9]{1,5}$/.test(w));
  if (acronym) return acronym;
  return (name.match(/\b[A-Za-z]/g) ?? [name[0]]).slice(0, 2).join("").toUpperCase();
}

function Logo({ item, className }: { item: Partner; className: string }) {
  return item.logo_url ? (
    <img className={className} src={mediaSrc(item.logo_url)} alt={`${item.name} logo`} loading="lazy" />
  ) : (
    <span className={`${className} logo-placeholder`} aria-hidden="true">
      {initials(item.name)}
    </span>
  );
}

function External({ href, children, className }: { href: string | null; children: React.ReactNode; className: string }) {
  return href ? (
    <a className={className} href={href} target="_blank" rel="noreferrer">
      {children}
    </a>
  ) : (
    <div className={className}>{children}</div>
  );
}

export default function ProjectsPage() {
  const [items, setItems] = useState<Partner[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.partners().then(setItems, (err: Error) => setError(err.message));
  }, []);

  if (error) return <EmptyState>Cannot reach the API ({error}).</EmptyState>;
  if (!items) return <div className="loading">Loading projects...</div>;

  const projects = items.filter((i) => i.kind === "project");
  const partners = items.filter((i) => i.kind === "partner");

  return (
    <div className="page">
      <div className="page-hero compact">
        <HeroBackdrop />
        <p className="eyebrow">Working together</p>
        <h1 className="page-title">
          Projects <span>and partners</span>
        </h1>
        <p className="page-lede">The research programmes the lab contributes to, and the institutions it works with.</p>
      </div>

      {projects.length === 0 && partners.length === 0 && <EmptyState>Projects and partners will be listed here soon.</EmptyState>}

      {projects.length > 0 && (
        <section>
          <div className="section-head">
            <h2>Projects</h2>
          </div>
          <div className="project-grid">
            {projects.map((p, i) => (
              <Reveal key={p.id} delay={i * 80}>
                <External href={p.link_url} className="project-card">
                  <Logo item={p} className="project-logo" />
                  <div className="project-body">
                    <h3>{p.name}</h3>
                    {p.description && <p>{p.description}</p>}
                    {p.link_url && <span className="project-link">Visit the project</span>}
                  </div>
                </External>
              </Reveal>
            ))}
          </div>
        </section>
      )}

      {partners.length > 0 && (
        <section>
          <div className="section-head">
            <h2>Partners</h2>
            <p>Click a logo to visit the partner.</p>
          </div>
          <div className="partner-grid">
            {partners.map((p, i) => (
              <Reveal key={p.id} delay={i * 60}>
                <External href={p.link_url} className="partner-tile">
                  <Logo item={p} className="partner-logo" />
                  <span className="partner-name">{p.name}</span>
                </External>
              </Reveal>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
