import React from 'react';

export default function ProgressBar({ label, value, rightLabel, warningAt = 90 }) {
  const pct = Math.max(0, Math.min(100, value));
  const isWarning = pct >= warningAt;
  const color = isWarning ? '#c62828' : pct >= 75 ? '#ef6c00' : '#0b6e4f';
  return (
    <div className="progress-row">
      {label && (
        <div className="progress-label">
          <span>{label}</span>
          <span>{rightLabel != null ? rightLabel : `${pct}%`}</span>
        </div>
      )}
      <div className="progress-bar-outer">
        <div
          className={`progress-bar-inner ${isWarning ? 'warning' : ''}`}
          style={{ width: `${pct}%`, background: color }}
        />
      </div>
    </div>
  );
}