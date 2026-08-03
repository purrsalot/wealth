import type { TrendItem } from '../types';
import { INITIAL_TRENDS } from './mockTrendsData';

export async function fetchLiveTrends(): Promise<TrendItem[]> {
  try {
    // Attempt to fetch live Google Trends Indonesia RSS feed via public proxy or direct feed
    const rssUrl = 'https://trends.google.com/trending/rss?geo=ID';
    const proxyUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(rssUrl)}`;
    
    const response = await fetch(proxyUrl, { cache: 'no-store' });
    if (!response.ok) {
      throw new Error('Failed to fetch RSS');
    }

    const xmlText = await response.text();
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(xmlText, 'text/xml');
    const items = xmlDoc.querySelectorAll('item');

    if (items.length === 0) {
      return INITIAL_TRENDS;
    }

    const liveItems: TrendItem[] = Array.from(items).slice(0, 10).map((item, index) => {
      const title = item.querySelector('title')?.textContent || `Viral Topic #${index + 1}`;
      const approxTraffic = item.querySelector('ht\\:approx_traffic, approx_traffic')?.textContent || '50K+ penelusuran';
      const description = item.querySelector('description')?.textContent || 'Penelusuran populer di Indonesia saat ini.';
      const newsItemTitle = item.querySelector('ht\\:news_item_title, news_item_title')?.textContent || title;
      const newsItemUrl = item.querySelector('ht\\:news_item_url, news_item_url')?.textContent || '';

      // Determine category based on title keywords
      const titleLower = title.toLowerCase();
      let category: TrendItem['category'] = 'viral';
      if (titleLower.includes('ai') || titleLower.includes('tech') || titleLower.includes('apple') || titleLower.includes('samsung') || titleLower.includes('game')) {
        category = 'tech';
      } else if (titleLower.includes('saham') || titleLower.includes('gaji') || titleLower.includes('bisnis') || titleLower.includes('bank')) {
        category = 'business';
      } else if (titleLower.includes('crypto') || titleLower.includes('bitcoin') || titleLower.includes('btc')) {
        category = 'crypto';
      } else if (titleLower.includes('liga') || titleLower.includes('vs') || titleLower.includes('fc') || titleLower.includes('cup')) {
        category = 'gaming';
      }

      return {
        id: `live-google-${index}-${Date.now()}`,
        title,
        category,
        heatScore: Math.min(99, 85 + (10 - index)),
        growthRate: `+${Math.floor(150 + Math.random() * 300)}%`,
        searchVolume: approxTraffic,
        platform: 'Google Trends',
        sentiment: 'positive',
        summary: description.replace(/<[^>]*>?/gm, '').slice(0, 150) + '...',
        targetAudience: 'Content Creator, Marketer, General Audience',
        hashtags: [`#${title.replace(/\s+/g, '')}`, '#TrenIndo', '#ViralId'],
        relatedKeywords: [newsItemTitle.slice(0, 30), title, 'berita hari ini'],
        url: newsItemUrl,
        updatedAt: 'Baru saja diperbarui',
        isHot: index < 3,
        isRising: true,
      };
    });

    // Merge live RSS items with curated niche trends for high richness
    return [...liveItems, ...INITIAL_TRENDS];
  } catch (error) {
    console.warn('Google Trends live fetch failed, fallback to rich curated trends:', error);
    return INITIAL_TRENDS;
  }
}
