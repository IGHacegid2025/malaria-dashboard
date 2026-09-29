// Author: Khadim Gueye

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, Navigate, useLocation } from "react-router-dom";
import { api, type Activity, type TeamMember } from "../api";
import { mediaSrc } from "../components/HeroBackdrop";
import { CountUp, Reveal } from "../components/Motion";
import { useDashboardData } from "../hooks/useDashboardData";
import { availableYears, formatPercent, summariseDrugs, summariseMarkers, titleCase } from "../lib/analysis";
import { useFilters } from "../filters";
import { useSettings } from "../settings";
import { geneLabel, markerLabel, markerTip, mutationLabel } from "../lib/markers";

interface Slide {
  src: string;
  tag: string;
  title: string;
  text: string;
  link?: string | null;
}

const BASE_SLIDES: Slide[] = [
  { src: "/home/lab_53.jpg", tag: "Our lab", title: "The Ify Aniebo Lab at IGH", text: "Scientists and bioinformaticians working together on malaria genomics in Nigeria." },
  { src: "/home/lab_34.jpg", tag: "Samples", title: "Dried blood spots from the field", text: "Every sample card is logged and prepared for DNA extraction in the IGH laboratory." },
  { src: "/home/lab_21.jpg", tag: "Analysis", title: "Reading the results together", text: "The team reviews new sequencing runs before they reach the dashboard." },
  { src: "/home/lab_15.jpg", tag: "IGH, Ede", title: "Institute of Genomics and Global Health", text: "A genomics centre at Redeemer's University serving Nigeria and West Africa." },
];

const FEATURES = [
  {
    photo: "/home/lab_16.jpg",
    title: "Drug resistance",
    text: "Genetic markers that make artemisinin, chloroquine or sulfadoxine-pyrimethamine less effective, tracked state by state.",
    to: "/dashboard",
    cta: "See treatment alerts",
  },
  {
    photo: "/home/lab_49.jpg",
    title: "Diagnostic resistance",
    text: "hrp2 and hrp3 gene deletions that let parasites escape rapid diagnostic tests, measured against the WHO 5% threshold.",
    to: "/map?theme=diagnostic",
    cta: "Open the diagnostics map",
  },
  {
    photo: "/home/lab_29.jpg",
    title: "Parasite diversity",
    text: "Species, multiplicity of infection and how markers spread over time, from IGH sequencing and published studies.",
    to: "/trends",
    cta: "Watch the trends",
  },
];

const JOURNEY = [
  { photo: "/home/lab_34.jpg", title: "Collect", text: "Blood samples from patients with malaria are gathered with health facilities across Nigerian states." },
  { photo: "/home/lab_8.jpg", title: "Sequence", text: "Parasite DNA is extracted and the resistance genes are sequenced at IGH." },
  { photo: "/home/lab_21.jpg", title: "Analyse", text: "Pipelines turn raw reads into mutation frequencies, checked by the team." },
  { photo: "/home/lab_33.jpg", title: "Inform", text: "Results are compared with WHO thresholds and shared here with decision-makers." },
];

const GALLERY = [
  { src: "/home/lab_3.jpg", alt: "Researcher preparing samples in the lab", span: "tall" },
  { src: "/home/lab_33.jpg", alt: "Presenting sampling results across Nigeria", span: "wide" },
  { src: "/home/lab_28.jpg", alt: "Microscopy of malaria parasites", span: "" },
  { src: "/home/lab_8.jpg", alt: "Pipetting DNA samples", span: "" },
  { src: "/home/lab_55.jpg", alt: "Blood sample on a slide", span: "" },
  { src: "/home/lab_35.jpg", alt: "Inspecting a sample tube", span: "tall" },
  { src: "/home/lab_22.jpg", alt: "Team meeting at IGH", span: "wide" },
  { src: "/home/lab_32.jpg", alt: "Preparing a presentation of new findings", span: "" },
];

const SLIDE_MS = 7000;

function activityDate(value: string | null) {
  if (!value) return null;
  return new Date(`${value.slice(0, 10)}T00:00:00`).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

function HeroSlides({ slides }: { slides: Slide[] }) {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const count = slides.length;
  const go = useCallback((next: number) => setIndex(((next % count) + count) % count), [count]);

  useEffect(() => {
    const next = slides[(index + 1) % count];
    if (next) new Image().src = mediaSrc(next.src);
  }, [index, slides, count]);

  const slide = slides[index % count];

  return (
    <>
      <div className="hero-slides" aria-hidden="true">
        {slides.map((s, i) => (
          <img key={s.src + i} src={mediaSrc(s.src)} alt="" className={`hero-slide${i === index ? " active" : ""}`} loading={i === 0 ? "eager" : "lazy"} />
        ))}
      </div>
      <div className="landing-hero-shade" />
      {slide && (
        <div className="hero-caption" onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)}>
          <div key={index} className="hero-caption-body">
            <span className="hero-caption-tag">{slide.tag}</span>
            <strong>{slide.title}</strong>
            <p>{slide.text}</p>
            {slide.link && (
              <a href={slide.link} target="_blank" rel="noreferrer">
                Learn more
              </a>
            )}
          </div>
          {count > 1 && (
            <div className="hero-caption-nav">
              <button onClick={() => go(index - 1)} aria-label="Previous photo">
                ‹
              </button>
              <div className={`hero-progress${paused ? " paused" : ""}`} style={{ "--slide-ms": `${SLIDE_MS}ms` } as React.CSSProperties}>
                {slides.map((s, i) => (
                  <button key={s.src + i} onClick={() => go(i)} aria-label={`Photo ${i + 1}: ${s.title}`} className={i === index ? "active" : i < index ? "done" : ""}>
                    <span key={i === index ? index : undefined} onAnimationEnd={i === index ? () => go(index + 1) : undefined} />
                  </button>
                ))}
              </div>
              <button onClick={() => go(index + 1)} aria-label="Next photo">
                ›
              </button>
            </div>
          )}
        </div>
      )}
    </>
  );
}

function Lightbox({ items, index, onClose, onMove }: { items: typeof GALLERY; index: number; onClose: () => void; onMove: (i: number) => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowRight") onMove((index + 1) % items.length);
      if (e.key === "ArrowLeft") onMove((index - 1 + items.length) % items.length);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [index, items.length, onClose, onMove]);
  const item = items[index];
  return (
    <div className="lightbox" onClick={onClose} role="dialog" aria-modal="true" aria-label={item.alt}>
      <button className="lightbox-arrow left" onClick={(e) => { e.stopPropagation(); onMove((index - 1 + items.length) % items.length); }} aria-label="Previous">
        ‹
      </button>
      <figure onClick={(e) => e.stopPropagation()}>
        <img key={item.src} src={mediaSrc(item.src)} alt={item.alt} />
        <figcaption>
          {item.alt}
          <span>
            {index + 1} / {items.length}
          </span>
        </figcaption>
      </figure>
      <button className="lightbox-arrow right" onClick={(e) => { e.stopPropagation(); onMove((index + 1) % items.length); }} aria-label="Next">
        ›
      </button>
    </div>
  );
}

export default function LandingPage() {
  const location = useLocation();
  const { data } = useDashboardData();
  const { settings } = useSettings();
  const { setMarker } = useFilters();
  const [lead, setLead] = useState<TeamMember | null>(null);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [photo, setPhoto] = useState<number | null>(null);

  useEffect(() => {
    api.team().then((t) => setLead(t.find((m) => m.is_lead) ?? null), () => undefined);
    api.activities().then(setActivities, () => undefined);
  }, []);

  const slides = useMemo(() => {
    const featured = activities
      .filter((a) => a.is_featured && a.image_url)
      .map((a) => ({ src: a.image_url!, tag: a.category ?? "Activity", title: a.title, text: a.description ?? "", link: a.link_url }));
    return [BASE_SLIDES[0], ...featured, ...BASE_SLIDES.slice(1)];
  }, [activities]);

  const stats = useMemo(() => {
    if (!data) return null;
    const years = availableYears(data.observations, data.hrp);
    const sequencingYears = years.filter((y) => data.observations.some((o) => o.year === y && o.source_type === "sequencing"));
    const latest = sequencingYears[sequencingYears.length - 1] ?? years[years.length - 1];
    const markers = summariseMarkers(data.observations, data.alerts, { year: latest, states: [] });
    const drugs = summariseDrugs(markers);
    return {
      samples: data.moi.reduce((s, r) => s + r.sample_count, 0),
      states: new Set(data.observations.map((o) => o.state)).size,
      studies: data.publications.length,
      markers: new Set(data.observations.map((o) => `${o.gene}|${o.mutation}`)).size,
      years: years.length ? `${years[0]} to ${years[years.length - 1]}` : "",
      span: years.length ? years[years.length - 1] - years[0] + 1 : 0,
      latest,
      alerts: drugs.filter((d) => d.classification === "high").map((d) => d.drug),
      ticker: markers
        .filter((m) => m.prevalence > 0)
        .sort((a, b) => b.prevalence - a.prevalence)
        .slice(0, 14),
    };
  }, [data]);

  const params = new URLSearchParams(location.search);
  if (["year", "states", "marker", "view"].some((k) => params.has(k))) {
    return <Navigate to={`/dashboard${location.search}`} replace />;
  }

  const lab = settings?.["site.lab"] ?? "Ify Aniebo Lab";
  const institute = settings?.["site.institute"] ?? "Institute of Genomics and Global Health, Nigeria";

  return (
    <div className="landing">
      <section className="landing-hero">
        <HeroSlides slides={slides} />
        <div className="landing-hero-content">
          <p className="eyebrow">
            {lab} · {institute}
          </p>
          <h1>
            Tracking malaria drug resistance <span>across Nigeria</span>
          </h1>
          <p className="landing-lede">
            Genomic surveillance that turns parasite DNA into clear signals for treatment and diagnosis policy, state by state and year by
            year.
          </p>
          <div className="landing-ctas">
            <Link to="/dashboard" className="landing-button primary cta-live">
              Open the dashboard
              <svg className="cta-arrow" viewBox="0 0 16 16" aria-hidden="true">
                <path d="M3 8h9M8.5 4.5 12 8l-3.5 3.5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </Link>
            <Link to="/map" className="landing-button ghost">
              Explore the map
            </Link>
          </div>
        </div>
        {stats && (
          <div className="landing-stats">
            <div>
              <strong>
                <CountUp value={stats.samples} duration={1400} />
              </strong>
              <span>parasite samples sequenced by IGH</span>
            </div>
            <div>
              <strong>
                <CountUp value={stats.states} duration={1400} />
              </strong>
              <span>states and FCT covered</span>
            </div>
            <div>
              <strong>
                <CountUp value={stats.markers} duration={1400} />
              </strong>
              <span>resistance markers tracked</span>
            </div>
            <div>
              <strong>
                <CountUp value={stats.studies} duration={1400} />
              </strong>
              <span>published studies included</span>
            </div>
          </div>
        )}
      </section>

      {stats && stats.alerts.length > 0 && (
        <Link to={`/dashboard?year=${stats.latest}`} className="landing-alert">
          <span className="live-dot" aria-hidden="true" />
          <span>
            <strong>Latest national signal ({stats.latest}):</strong> high alert for {stats.alerts.map(titleCase).join(", ")} resistance markers.
          </span>
          <span className="landing-alert-cta">See what it means</span>
        </Link>
      )}

      {stats && stats.ticker.length > 0 && (
        <div className="signal-ticker" aria-label={`Markers detected nationally in ${stats.latest}`}>
          <span className="signal-ticker-label">
            <span className="live-dot" aria-hidden="true" />
            {stats.latest} national
          </span>
          <div className="signal-ticker-window">
            <div className="signal-ticker-track">
              {[0, 1].map((copy) => (
                <div key={copy} className="signal-ticker-set" aria-hidden={copy === 1}>
                  {Array.from({ length: Math.ceil(10 / stats.ticker.length) }, () => stats.ticker).flat().map((m, i) => (
                    <Link
                      key={`${m.key}-${i}`}
                      to={`/trends?marker=${encodeURIComponent(`${m.gene}|${m.mutation}`)}`}
                      onClick={() => setMarker(`${m.gene}|${m.mutation}`)}
                      title={markerTip(m.gene, m.mutation) ?? `See the trend of ${markerLabel(m.gene, m.mutation)}`}
                      className={`signal-chip ${m.classification}`}
                      tabIndex={copy || i >= stats.ticker.length ? -1 : 0}
                    >
                      <em>{geneLabel(m.gene)}</em> {mutationLabel(m.gene, m.mutation)}
                      <strong>{formatPercent(m.prevalence)}</strong>
                    </Link>
                  ))}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      <section className="landing-section">
        <Reveal className="landing-section-head">
          <p className="eyebrow dark">What we monitor</p>
          <h2>Three threats to malaria control</h2>
        </Reveal>
        <div className="feature-grid">
          {FEATURES.map((f, i) => (
            <Reveal key={f.title} delay={i * 110}>
              <Link to={f.to} className="feature-card">
                <div className="feature-photo">
                  <img src={f.photo} alt="" loading="lazy" />
                </div>
                <div className="feature-body">
                  <h3>{f.title}</h3>
                  <p>{f.text}</p>
                  <span className="feature-cta">{f.cta}</span>
                </div>
              </Link>
            </Reveal>
          ))}
        </div>
      </section>

      <section className="journey">
        <Reveal className="landing-section-head light">
          <p className="eyebrow">How it works</p>
          <h2>From a drop of blood to a policy signal</h2>
        </Reveal>
        <ol className="journey-steps">
          {JOURNEY.map((s, i) => (
            <Reveal as="li" key={s.title} delay={i * 140} className="journey-step">
              <div className="journey-photo">
                <img src={s.photo} alt="" loading="lazy" />
                <span className="journey-num">{i + 1}</span>
              </div>
              <h3>{s.title}</h3>
              <p>{s.text}</p>
            </Reveal>
          ))}
        </ol>
        {stats && (
          <Reveal className="journey-facts">
            <span>
              <strong>{stats.span}</strong> years of evidence
            </span>
            <span>
              <strong>{stats.states}</strong> states
            </span>
            <span>
              <strong>{stats.markers}</strong> markers
            </span>
          </Reveal>
        )}
      </section>

      {activities.length > 0 && (
        <section className="landing-section">
          <Reveal className="landing-section-head row">
            <div>
              <p className="eyebrow dark">Lab activities</p>
              <h2>What the team is doing</h2>
            </div>
            <Link to="/team" className="section-link">
              Meet the team
            </Link>
          </Reveal>
          <Reveal>
            <ActivitySpotlight activities={activities} />
          </Reveal>
        </section>
      )}

      <Reveal as="section" className="landing-research">
        <div>
          <p className="eyebrow dark">Research areas</p>
          <h2>Malaria genomics for Nigeria and Africa</h2>
          <p>
            The Aniebo Genomics Lab studies Plasmodium falciparum population structure in Nigeria and follows how drug resistance emerges and
            spreads, using amplicon sequencing and whole-genome analysis.
          </p>
        </div>
        <ul className="research-chips">
          {["Malaria population genomics", "Antimalarial drug resistance", "Genomic surveillance", "Bioinformatics and data analysis", "Amplicon sequencing", "Whole-genome analysis"].map((r, i) => (
            <li key={r} style={{ animationDelay: `${i * 90}ms` }}>
              {r}
            </li>
          ))}
        </ul>
      </Reveal>

      <Reveal as="section" className="landing-lead">
        <div className="landing-lead-photo">
          <img src="/home/lab_38.jpg" alt={lead?.name ?? "Principal Investigator"} loading="lazy" />
        </div>
        <div className="landing-lead-body">
          <p className="eyebrow dark">{lead?.title ?? "Principal Investigator"}</p>
          <h2>{lead?.name ?? "Dr. Ify Aniebo"}</h2>
          {lead?.affiliation && <div className="member-affiliation">{lead.affiliation}</div>}
          <blockquote>
            {lead?.bio ??
              "The lab combines field sampling, genomic sequencing and published evidence to give decision-makers an up-to-date picture of malaria resistance in Nigeria."}
          </blockquote>
          <Link to="/team" className="landing-button primary">
            Meet the team
          </Link>
        </div>
      </Reveal>

      <section className="landing-section">
        <Reveal className="landing-section-head">
          <p className="eyebrow dark">Inside the lab</p>
          <h2>From blood sample to national evidence</h2>
        </Reveal>
        <div className="gallery">
          {GALLERY.map((g, i) => (
            <Reveal key={g.src} delay={(i % 4) * 90} className={`gallery-item ${g.span}`}>
              <button onClick={() => setPhoto(i)} aria-label={`Open photo: ${g.alt}`}>
                <img src={mediaSrc(g.src)} alt={g.alt} loading="lazy" />
                <span className="gallery-caption">{g.alt}</span>
              </button>
            </Reveal>
          ))}
        </div>
      </section>

      <Reveal as="section" className="landing-cta">
        <div>
          <h2>Evidence for every state, every year</h2>
          <p>
            {stats?.years ? `Data from ${stats.years}, ` : ""}updated as new sequencing and studies arrive. Export any view as a PDF report for
            meetings and briefings.
          </p>
        </div>
        <Link to="/dashboard" className="landing-button light">
          Open the dashboard
        </Link>
      </Reveal>

      {photo !== null && <Lightbox items={GALLERY} index={photo} onClose={() => setPhoto(null)} onMove={setPhoto} />}
    </div>
  );
}

const ACTIVITY_MS = 15000;

function ActivitySpotlight({ activities }: { activities: Activity[] }) {
  const [index, setIndex] = useState(0);
  const [hover, setHover] = useState(false);
  const [visible, setVisible] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const touchX = useRef<number | null>(null);
  const count = activities.length;
  const current = index % count;
  const go = useCallback((next: number) => setIndex(((next % count) + count) % count), [count]);
  const reduced = useMemo(() => typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches, []);

  useEffect(() => {
    const el = box.current;
    if (!el || typeof IntersectionObserver === "undefined") return setVisible(true);
    const observer = new IntersectionObserver(([entry]) => setVisible(entry.isIntersecting), { threshold: 0.35 });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const next = activities[(current + 1) % count];
    if (next?.image_url) new Image().src = mediaSrc(next.image_url);
  }, [activities, current, count]);

  const main = activities[current];
  const upNext = Array.from({ length: Math.min(3, count - 1) }, (_, i) => (current + 1 + i) % count);
  const paused = hover || !visible || reduced;

  return (
    <div
      ref={box}
      className="activity-layout"
      aria-roledescription="carousel"
      aria-label="Lab activities"
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      onFocus={() => setHover(true)}
      onBlur={() => setHover(false)}
    >
      <div
        className="activity-card main"
        onTouchStart={(e) => (touchX.current = e.touches[0].clientX)}
        onTouchEnd={(e) => {
          if (touchX.current === null) return;
          const dx = e.changedTouches[0].clientX - touchX.current;
          touchX.current = null;
          if (Math.abs(dx) > 50) go(current + (dx < 0 ? 1 : -1));
        }}
      >
        <div key={main.id} className="activity-slide">
          <ActivityCard activity={main} />
        </div>
        {count > 1 && (
          <>
            <div className="activity-controls">
              <button type="button" onClick={() => go(current - 1)} aria-label="Previous activity">
                ‹
              </button>
              <span aria-live="polite">
                {current + 1} / {count}
              </span>
              <button type="button" onClick={() => go(current + 1)} aria-label="Next activity">
                ›
              </button>
            </div>
            <div className={`activity-progress${paused ? " paused" : ""}`} style={{ "--slide-ms": `${ACTIVITY_MS}ms` } as React.CSSProperties}>
              {activities.map((a, i) => (
                <button key={a.id} type="button" onClick={() => go(i)} aria-label={`Activity ${i + 1}: ${a.title}`} className={i === current ? "active" : ""}>
                  <span key={i === current ? `${current}-run` : undefined} onAnimationEnd={i === current ? () => go(current + 1) : undefined} />
                </button>
              ))}
            </div>
          </>
        )}
      </div>
      {upNext.length > 0 && (
        <div className="activity-side">
          {upNext.map((i, n) => (
            <div key={`${activities[i].id}-${current}`} className="activity-card side-enter" style={{ animationDelay: `${n * 90}ms` }}>
              <ActivityCard activity={activities[i]} onSelect={() => go(i)} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ActivityCard({ activity, onSelect }: { activity: Activity; onSelect?: () => void }) {
  const date = activityDate(activity.activity_date);
  const body = (
    <>
      <div className="activity-photo">
        {activity.image_url ? <img src={mediaSrc(activity.image_url)} alt="" loading="lazy" /> : <div className="photo-placeholder">{activity.title[0]}</div>}
        {activity.category && <span className="activity-tag">{activity.category}</span>}
      </div>
      <div className="activity-body">
        {date && <time>{date}</time>}
        <h3>{activity.title}</h3>
        {activity.description && <p>{activity.description}</p>}
        {activity.link_url && <span className="feature-cta">Learn more</span>}
      </div>
    </>
  );
  if (onSelect)
    return (
      <button type="button" className="activity-inner" onClick={onSelect} aria-label={`Show ${activity.title}`}>
        {body}
      </button>
    );
  return activity.link_url ? (
    <a href={activity.link_url} target="_blank" rel="noreferrer" className="activity-inner">
      {body}
    </a>
  ) : (
    <div className="activity-inner">{body}</div>
  );
}
