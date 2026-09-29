// Author: Khadim Gueye

import { useEffect, useState } from "react";
import { api, type TeamMember } from "../api";
import HeroBackdrop, { mediaSrc } from "../components/HeroBackdrop";
import { EmptyState } from "../components/Panels";

function initials(name: string) {
  return name
    .replace(/^(Dr|Prof)\.?\s+/i, "")
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0])
    .join("")
    .toUpperCase();
}

function Photo({ member, className }: { member: TeamMember; className: string }) {
  return member.photo_url ? (
    <img className={className} src={mediaSrc(member.photo_url)} alt={member.name} loading="lazy" />
  ) : (
    <div className={`${className} photo-placeholder`} aria-hidden="true">
      {initials(member.name)}
    </div>
  );
}

function LinkedIn({ member, label }: { member: TeamMember; label?: boolean }) {
  if (!member.linkedin_url) return null;
  return (
    <a
      className={label ? "member-linkedin-button" : "member-linkedin"}
      href={member.linkedin_url}
      target="_blank"
      rel="noreferrer"
      aria-label={`${member.name} on LinkedIn`}
      onClick={(e) => e.stopPropagation()}
    >
      <svg viewBox="0 0 16 16" aria-hidden="true">
        <path fill="currentColor" d="M13.6 0H2.4A2.4 2.4 0 000 2.4v11.2A2.4 2.4 0 002.4 16h11.2a2.4 2.4 0 002.4-2.4V2.4A2.4 2.4 0 0013.6 0zM4.9 13.3H2.7V6h2.2v7.3zM3.8 5A1.3 1.3 0 113.8 2.4 1.3 1.3 0 013.8 5zm9.5 8.3h-2.2V9.8c0-.9 0-2-1.2-2s-1.4 1-1.4 1.9v3.6H6.3V6h2.1v1a2.3 2.3 0 012.1-1.2c2.2 0 2.7 1.5 2.7 3.4v4.1z" />
      </svg>
      {label && "LinkedIn profile"}
    </a>
  );
}

function Bio({ text }: { text: string }) {
  return (
    <>
      {text.split(/\n\s*\n/).map((p) => (
        <p key={p.slice(0, 32)}>{p}</p>
      ))}
    </>
  );
}

function MemberSheet({ member, onClose }: { member: TeamMember; onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <div className="member-overlay" onClick={onClose} role="presentation">
      <div className="member-sheet" role="dialog" aria-modal="true" aria-label={member.name} onClick={(e) => e.stopPropagation()}>
        <button className="member-close" onClick={onClose} aria-label="Close">
          <svg viewBox="0 0 12 12" aria-hidden="true">
            <path d="M3 3l6 6M9 3l-6 6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
          </svg>
        </button>
        <Photo member={member} className="member-sheet-photo" />
        <div className="member-sheet-body">
          <h2>{member.name}</h2>
          {member.title && <div className="member-title">{member.title}</div>}
          {member.affiliation && <div className="member-affiliation">{member.affiliation}</div>}
          {member.bio ? <Bio text={member.bio} /> : <p>A short biography will be added soon.</p>}
          <LinkedIn member={member} label />
          {member.email && (
            <div className="member-email">
              Contact: <strong>{member.email}</strong>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function TeamPage() {
  const [team, setTeam] = useState<TeamMember[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState<TeamMember | null>(null);

  useEffect(() => {
    api.team().then(setTeam, (err: Error) => setError(err.message));
  }, []);

  if (error) return <EmptyState>Cannot reach the API ({error}).</EmptyState>;
  if (!team) return <div className="loading">Loading the team...</div>;

  const leads = team.filter((m) => m.is_lead && !m.is_alumni);
  const others = team.filter((m) => !m.is_lead && !m.is_alumni);
  const alumni = team.filter((m) => m.is_alumni);

  return (
    <div className="page">
      <div className="page-hero compact">
        <HeroBackdrop />
        <p className="eyebrow">The people behind the data</p>
        <h1 className="page-title">
          Our <span>team</span>
        </h1>
        <p className="page-lede">Scientists at the Institute of Genomics and Global Health tracking malaria resistance across Nigeria.</p>
      </div>

      {leads.map((m) => (
        <div key={m.id} className="member-wrap">
          <button className="lead-card" onClick={() => setOpen(m)}>
            <Photo member={m} className="lead-photo" />
            <div className="lead-body">
              <span className="lead-eyebrow">Lab lead</span>
              <h2>{m.name}</h2>
              {m.title && <div className="member-title">{m.title}</div>}
              {m.affiliation && <div className="member-affiliation">{m.affiliation}</div>}
              {m.bio && <p>{m.bio.split(/\n\s*\n/)[0]}</p>}
              <span className="lead-more">Read more</span>
            </div>
          </button>
          <LinkedIn member={m} />
        </div>
      ))}

      {others.length > 0 && (
        <section>
          <div className="section-head">
            <h2>Team members</h2>
            <p>Click a member to read more.</p>
          </div>
          <div className="member-grid">
            {others.map((m, i) => (
              <div key={m.id} className="member-wrap">
                <button className="member-card" onClick={() => setOpen(m)} style={{ animationDelay: `${i * 60}ms` }}>
                  <Photo member={m} className="member-photo" />
                  <div className="member-card-body">
                    <strong>{m.name}</strong>
                    {m.title && <span>{m.title}</span>}
                  </div>
                </button>
                <LinkedIn member={m} />
              </div>
            ))}
          </div>
        </section>
      )}

      {alumni.length > 0 && (
        <section className="alumni-section">
          <div className="section-head">
            <h2>Alumni</h2>
            <p>Former members of the lab.</p>
          </div>
          <div className="alumni-grid">
            {alumni.map((m) => (
              <div key={m.id} className="member-wrap">
                <button className="alumni-card" onClick={() => setOpen(m)}>
                  <Photo member={m} className="alumni-photo" />
                  <span className="alumni-body">
                    <strong>{m.name}</strong>
                    {m.title && <span>{m.title}</span>}
                  </span>
                </button>
                <LinkedIn member={m} />
              </div>
            ))}
          </div>
        </section>
      )}

      {open && <MemberSheet member={open} onClose={() => setOpen(null)} />}
    </div>
  );
}
