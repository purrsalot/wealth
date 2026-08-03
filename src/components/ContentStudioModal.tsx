import React, { useState } from 'react';
import { X, Copy, Check, Video, MessageSquare, Film, DollarSign, Wand2 } from 'lucide-react';
import type { TrendItem, GeneratedHooks } from '../types';
import { generateViralHooks } from '../services/aiHookGenerator';
import confetti from 'canvas-confetti';

interface ContentStudioModalProps {
  trend: TrendItem | null;
  onClose: () => void;
  onHooksGenerated: () => void;
}

export const ContentStudioModal: React.FC<ContentStudioModalProps> = ({ trend, onClose, onHooksGenerated }) => {
  if (!trend) return null;

  const [tone, setTone] = useState<'casual' | 'controversial' | 'professional'>('casual');
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const hooks: GeneratedHooks = generateViralHooks(trend, tone);

  const handleCopy = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    confetti({ particleCount: 40, spread: 60, origin: { y: 0.8 } });
    onHooksGenerated();
    setTimeout(() => setCopiedKey(null), 2000);
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <button className="close-btn" onClick={onClose}><X size={20} /></button>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
          <div style={{ padding: '6px', background: 'var(--accent-gradient)', borderRadius: '8px', color: 'white' }}>
            <Wand2 size={20} />
          </div>
          <div>
            <h3 style={{ fontSize: '1.2rem', color: 'white' }}>Viral Content Studio</h3>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              Topik: <span style={{ color: '#818cf8', fontWeight: '600' }}>{trend.title}</span>
            </p>
          </div>
        </div>

        {/* Tone Selector */}
        <div className="tone-selector">
          <button 
            className={`tone-btn ${tone === 'casual' ? 'active' : ''}`}
            onClick={() => setTone('casual')}
          >
            😎 Santai & Viral
          </button>
          <button 
            className={`tone-btn ${tone === 'controversial' ? 'active' : ''}`}
            onClick={() => setTone('controversial')}
          >
            🔥 Pro-Kontra (Clickbait)
          </button>
          <button 
            className={`tone-btn ${tone === 'professional' ? 'active' : ''}`}
            onClick={() => setTone('professional')}
          >
            📊 Edukatif & Bisnis
          </button>
        </div>

        {/* Section 1: TikTok / Reels 3-Second Hooks */}
        <div style={{ marginBottom: '24px' }}>
          <h4 style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#f472b6', marginBottom: '12px' }}>
            <Video size={18} /> TikTok & Instagram Reels (3-Second Visual Hooks)
          </h4>

          {hooks.tiktokHooks.map((item, idx) => (
            <div key={idx} className="script-box">
              <button 
                className="copy-badge"
                onClick={() => handleCopy(`${item.audioVisualHook}\nText: ${item.textOnScreen}\nAngle: ${item.scriptAngle}`, `tiktok-${idx}`)}
              >
                {copiedKey === `tiktok-${idx}` ? <Check size={12} /> : <Copy size={12} />}
                {copiedKey === `tiktok-${idx}` ? 'Tersalin!' : 'Salin Script'}
              </button>
              <div style={{ fontSize: '0.9rem', color: '#e2e8f0', marginBottom: '6px', fontWeight: '600' }}>
                🗣️ Hook Ucapan: <span style={{ color: '#93c5fd' }}>{item.audioVisualHook}</span>
              </div>
              <div style={{ fontSize: '0.82rem', color: '#fca5a5', marginBottom: '4px' }}>
                📺 Text On Screen: <span style={{ background: 'rgba(239, 68, 68, 0.2)', padding: '2px 6px', borderRadius: '4px' }}>{item.textOnScreen}</span>
              </div>
              <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                💡 Alur Video: {item.scriptAngle}
              </div>
            </div>
          ))}
        </div>

        {/* Section 2: Twitter Thread Starter */}
        <div style={{ marginBottom: '24px' }}>
          <h4 style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#38bdf8', marginBottom: '12px' }}>
            <MessageSquare size={18} /> Twitter / X Thread Starter
          </h4>
          <div className="script-box">
            <button 
              className="copy-badge"
              onClick={() => handleCopy(hooks.twitterThread.join('\n\n'), 'twitter-thread')}
            >
              {copiedKey === 'twitter-thread' ? <Check size={12} /> : <Copy size={12} />}
              {copiedKey === 'twitter-thread' ? 'Tersalin!' : 'Salin Full Thread'}
            </button>
            <pre style={{ fontFamily: 'var(--font-sans)', whiteSpace: 'pre-wrap', fontSize: '0.85rem', color: '#cbd5e1' }}>
              {hooks.twitterThread.join('\n\n')}
            </pre>
          </div>
        </div>

        {/* Section 3: YouTube Shorts / Video Angle */}
        <div style={{ marginBottom: '24px' }}>
          <h4 style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#ef4444', marginBottom: '12px' }}>
            <Film size={18} /> YouTube Title & Thumbnail Angle
          </h4>
          <div className="script-box">
            <button 
              className="copy-badge"
              onClick={() => handleCopy(`Title: ${hooks.youtubeAngle.title}\nThumbnail: ${hooks.youtubeAngle.thumbnailIdea}`, 'yt-angle')}
            >
              {copiedKey === 'yt-angle' ? <Check size={12} /> : <Copy size={12} />}
              {copiedKey === 'yt-angle' ? 'Tersalin!' : 'Salin Data'}
            </button>
            <div style={{ fontWeight: '700', fontSize: '0.95rem', color: '#f8fafc', marginBottom: '6px' }}>
              🎬 Judul Video: {hooks.youtubeAngle.title}
            </div>
            <div style={{ fontSize: '0.82rem', color: '#fde047', marginBottom: '8px' }}>
              🖼️ Ide Thumbnail: {hooks.youtubeAngle.thumbnailIdea}
            </div>
            <ul style={{ paddingLeft: '20px', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              {hooks.youtubeAngle.keyPoints.map((pt, i) => (
                <li key={i}>{pt}</li>
              ))}
            </ul>
          </div>
        </div>

        {/* Section 4: Monetization Strategy */}
        <div style={{ background: 'rgba(16, 185, 129, 0.1)', border: '1px solid rgba(16, 185, 129, 0.3)', padding: '16px', borderRadius: 'var(--radius-sm)' }}>
          <h4 style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#34d399', marginBottom: '6px' }}>
            <DollarSign size={18} /> Potensi Monetisasi (Cara Hasikan Uang)
          </h4>
          <p style={{ fontSize: '0.88rem', color: '#a7f3d0' }}>
            {hooks.monetizationIdea}
          </p>
        </div>
      </div>
    </div>
  );
};
