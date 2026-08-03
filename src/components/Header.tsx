import React from 'react';
import { Flame, RefreshCw } from 'lucide-react';

interface HeaderProps {
  onRefresh: () => void;
  isLoading: boolean;
  totalTrends: number;
}

export const Header: React.FC<HeaderProps> = ({ onRefresh, isLoading, totalTrends }) => {
  return (
    <header className="navbar">
      <div className="brand">
        <div className="brand-icon">
          <Flame size={24} />
        </div>
        <div>
          <div className="brand-title">TrendPulse ID</div>
          <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
            Real-time Viral Topic & Content Radar Indonesia
          </p>
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
        <div className="badge-live">
          <span className="pulse-dot"></span>
          LIVE RADAR ({totalTrends} TOPIC)
        </div>

        <button 
          className="btn-secondary" 
          onClick={onRefresh} 
          disabled={isLoading}
          style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
        >
          <RefreshCw size={14} className={isLoading ? 'spin-anim' : ''} />
          {isLoading ? 'Fetching...' : 'Update Data'}
        </button>
      </div>
    </header>
  );
};
