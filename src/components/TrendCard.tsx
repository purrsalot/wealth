import React from 'react';
import { Flame, TrendingUp, Sparkles, ExternalLink, Clock } from 'lucide-react';
import type { TrendItem } from '../types';

interface TrendCardProps {
  trend: TrendItem;
  onSelect: (trend: TrendItem) => void;
}

export const TrendCard: React.FC<TrendCardProps> = ({ trend, onSelect }) => {
  return (
    <div className={`glass-panel trend-card ${trend.isHot ? 'hot' : trend.isRising ? 'rising' : ''}`}>
      <div>
        <div className="card-header">
          <span className="trend-title">{trend.title}</span>
          <div style={{ display: 'flex', gap: '4px', flexShrink: 0 }}>
            {trend.isHot && (
              <span className="badge-tag badge-hot">
                <Flame size={12} /> HOT
              </span>
            )}
            {trend.isRising && (
              <span className="badge-tag badge-rising">
                <TrendingUp size={12} /> {trend.growthRate}
              </span>
            )}
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '0.78rem', color: 'var(--text-dim)', marginBottom: '10px' }}>
          <span>📍 {trend.platform}</span>
          <span>•</span>
          <span>👁️ {trend.searchVolume}</span>
          <span>•</span>
          <span style={{ display: 'flex', alignItems: 'center', gap: '3px' }}><Clock size={12}/> {trend.updatedAt}</span>
        </div>

        <p className="trend-summary">{trend.summary}</p>

        {/* Heat Bar */}
        <div className="heat-container">
          <div className="heat-header">
            <span>🔥 Viral Index (Heat Score)</span>
            <span style={{ fontWeight: '700', color: '#818cf8' }}>{trend.heatScore}/100</span>
          </div>
          <div className="heat-bar-bg">
            <div className="heat-bar-fill" style={{ width: `${trend.heatScore}%` }}></div>
          </div>
        </div>

        {/* Hashtags */}
        <div className="hashtags-row">
          {trend.hashtags.map((tag, idx) => (
            <span key={idx} className="hashtag-chip">{tag}</span>
          ))}
        </div>
      </div>

      <div>
        {trend.url && (
          <a 
            href={trend.url} 
            target="_blank" 
            rel="noopener noreferrer"
            style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '0.75rem', color: 'var(--text-dim)', marginBottom: '12px', textDecoration: 'none' }}
          >
            <ExternalLink size={12} /> Sumber Artikel Asli
          </a>
        )}

        <button className="btn-primary" onClick={() => onSelect(trend)}>
          <Sparkles size={16} /> Generate Viral Hook & Script
        </button>
      </div>
    </div>
  );
};
