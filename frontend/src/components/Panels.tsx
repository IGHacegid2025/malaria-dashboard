// Author: Khadim Gueye

import type { ReactNode } from "react";
import InfoTip from "./InfoTip";

export function Panel({
  title,
  badge,
  subtitle,
  actions,
  info,
  children,
  className = "",
}: {
  title: string;
  badge?: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
  info?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`panel ${className}`}>
      <header className="panel-header">
        <div>
          <h2>
            {title}
            {badge}
            {info && <InfoTip label={`About ${title}`}>{info}</InfoTip>}
          </h2>
          {subtitle && <p className="panel-subtitle">{subtitle}</p>}
        </div>
        {actions && <div className="panel-actions">{actions}</div>}
      </header>
      {children}
    </section>
  );
}

export function StatTile({
  label,
  value,
  detail,
  accent,
  info,
}: {
  label: string;
  value: ReactNode;
  detail?: ReactNode;
  accent?: ReactNode;
  info?: ReactNode;
}) {
  return (
    <div className="stat-tile">
      <div className="stat-label">
        {accent}
        {label}
        {info && <InfoTip label={`About ${label}`}>{info}</InfoTip>}
      </div>
      <div className="stat-value">{value}</div>
      {detail && <div className="stat-detail">{detail}</div>}
    </div>
  );
}

export function EmptyState({ children }: { children: ReactNode }) {
  return <div className="empty-state">{children}</div>;
}
