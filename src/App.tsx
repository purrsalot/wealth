import { useState, useEffect } from 'react';
import { Search, Sparkles } from 'lucide-react';
import { Header } from './components/Header';
import { StatsOverview } from './components/StatsOverview';
import { TrendCard } from './components/TrendCard';
import { ContentStudioModal } from './components/ContentStudioModal';
import type { TrendItem, TrendCategory } from './types';
import { fetchLiveTrends } from './services/trendAggregator';

export default function App() {
  const [trends, setTrends] = useState<TrendItem[]>([]);
  const [filteredTrends, setFilteredTrends] = useState<TrendItem[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedCategory, setSelectedCategory] = useState<TrendCategory>('all');
  const [activeTrend, setActiveTrend] = useState<TrendItem | null>(null);
  const [generatedHooksCount, setGeneratedHooksCount] = useState<number>(12);

  const loadData = async () => {
    setIsLoading(true);
    const data = await fetchLiveTrends();
    setTrends(data);
    setFilteredTrends(data);
    setIsLoading(false);
  };

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    let result = trends;

    if (selectedCategory !== 'all') {
      result = result.filter(item => item.category === selectedCategory);
    }

    if (searchQuery.trim() !== '') {
      const q = searchQuery.toLowerCase();
      result = result.filter(item => 
        item.title.toLowerCase().includes(q) ||
        item.summary.toLowerCase().includes(q) ||
        item.hashtags.some(h => h.toLowerCase().includes(q)) ||
        item.relatedKeywords.some(k => k.toLowerCase().includes(q))
      );
    }

    setFilteredTrends(result);
  }, [searchQuery, selectedCategory, trends]);

  const categories: { id: TrendCategory; label: string }[] = [
    { id: 'all', label: '🔥 Semua Topik' },
    { id: 'tech', label: '🤖 Tech & AI' },
    { id: 'business', label: '💸 Finansial & Bisnis' },
    { id: 'crypto', label: '⚡ Crypto & Web3' },
    { id: 'viral', label: '🚀 Viral & Marketing' },
    { id: 'lifestyle', label: '✨ Lifestyle & Hobi' },
    { id: 'gaming', label: '🎮 Gaming & Pop' },
  ];

  return (
    <div className="app-container">
      {/* Navbar Header */}
      <Header 
        onRefresh={loadData} 
        isLoading={isLoading} 
        totalTrends={trends.length} 
      />

      {/* Hero Stats */}
      <StatsOverview 
        trends={trends} 
        hooksCount={generatedHooksCount} 
      />

      {/* Toolbar: Search & Categories */}
      <div className="toolbar">
        <div className="search-box">
          <Search className="search-icon" size={18} />
          <input 
            type="text" 
            className="search-input" 
            placeholder="Cari topik viral, keyword, hashtag (#GajiUSD, #VibeCoding)..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        <div className="category-pills">
          {categories.map(cat => (
            <button 
              key={cat.id}
              className={`pill-btn ${selectedCategory === cat.id ? 'active' : ''}`}
              onClick={() => setSelectedCategory(cat.id)}
            >
              {cat.label}
            </button>
          ))}
        </div>
      </div>

      {/* Content Section */}
      {isLoading ? (
        <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--text-muted)' }}>
          <Sparkles size={32} className="spin-anim" style={{ color: '#818cf8', marginBottom: '12px' }} />
          <p>Menganalisis data dari Google Trends & RSS Feeds...</p>
        </div>
      ) : filteredTrends.length === 0 ? (
        <div className="glass-panel" style={{ textAlign: 'center', padding: '48px', color: 'var(--text-muted)' }}>
          <p style={{ fontSize: '1.1rem', marginBottom: '8px' }}>Tidak ada topik yang cocok dengan pencarian "{searchQuery}"</p>
          <button className="btn-secondary" onClick={() => { setSearchQuery(''); setSelectedCategory('all'); }}>
            Reset Filter
          </button>
        </div>
      ) : (
        <div className="trends-grid">
          {filteredTrends.map(trend => (
            <TrendCard 
              key={trend.id} 
              trend={trend} 
              onSelect={(selected) => setActiveTrend(selected)} 
            />
          ))}
        </div>
      )}

      {/* Viral Studio Modal */}
      <ContentStudioModal 
        trend={activeTrend} 
        onClose={() => setActiveTrend(null)} 
        onHooksGenerated={() => setGeneratedHooksCount(prev => prev + 1)}
      />
    </div>
  );
}
