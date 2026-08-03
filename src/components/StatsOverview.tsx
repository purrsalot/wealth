import React from 'react';
import { Flame, TrendingUp, Zap, Sparkles } from 'lucide-react';
import type { TrendItem } from '../types';

interface StatsOverviewProps {
  trends: TrendItem[];
  hooksCount: number;
}

export const StatsOverview: React.FC<StatsOverviewProps> = ({ trends, hooksCount }) => {
  const topRising = [...trends].sort((a, b) => b.heatScore - a.heatScore)[0];
  const hotCount = trends.filter(t => t.isHot).length;

  return (
    <div className="stats-grid">
      <div className="glass-panel stat-card">
        <div style={{ display: 'flex', justifyContent: 'space-between', color: '#818cf8' }}>
          <span className="stat-label">Total Topic Aktif</span>
          <TrendingUp size={20} />
        </div>
        <div className="stat-value">{trends.length} Topik</div>
        <span style={{ fontSize: '0.75rem', color: '#34d399' }}>⚡ Google, Reddit & RSS Data</span>
      </div>

      <div className="glass-panel stat-card">
        <div style={{ display: 'flex', justifyContent: 'space-between', color: '#ef4444' }}>
          <span className="stat-label">Hot Viral Topic</span>
          <Flame size={20} />
        </div>
        <div className="stat-value">{hotCount} Hot Items</div>
        <span style={{ fontSize: '0.75rem', color: '#f87171' }}>🔥 Heat Score &gt; 90</span>
      </div>

      <div className="glass-panel stat-card">
        <div style={{ display: 'flex', justifyContent: 'space-between', color: '#34d399' }}>
          <span className="stat-label">Fastest Growth Rate</span>
          <Zap size={20} />
        </div>
        <div className="stat-value">{topRising ? topRising.growthRate : '+350%'}</div>
        <span style={{ fontSize: '0.75rem', color: '#a7f3d0', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          📌 {topRising ? topRising.title : 'Loading...'}
        </span>
      </div>

      <div className="glass-panel stat-card">
        <div style={{ display: 'flex', justifyContent: 'space-between', color: '#c084fc' }}>
          <span className="stat-label">AI Hooks Generated</span>
          <Sparkles size={20} />
        </div>
        <div className="stat-value">{hooksCount} Scripts</div>
        <span style={{ fontSize: '0.75rem', color: '#e9d5ff' }}>✨ TikTok, Twitter & YT Shorts</span>
      </div>
    </div>
  );
};
