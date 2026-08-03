export type TrendCategory = 
  | 'all'
  | 'tech'
  | 'business'
  | 'gaming'
  | 'viral'
  | 'lifestyle'
  | 'crypto';

export type SentimentType = 'positive' | 'neutral' | 'negative' | 'controversial';

export type TrendPlatform = 'Google Trends' | 'Reddit' | 'Twitter/X' | 'TikTok' | 'News RSS';

export interface TrendItem {
  id: string;
  title: string;
  titleEn?: string;
  category: TrendCategory;
  heatScore: number; // 0 - 100
  growthRate: string; // e.g. "+340%"
  searchVolume: string; // e.g. "50K+ penelusuran"
  platform: TrendPlatform;
  sentiment: SentimentType;
  summary: string;
  targetAudience: string;
  hashtags: string[];
  relatedKeywords: string[];
  url?: string;
  updatedAt: string;
  isHot?: boolean;
  isRising?: boolean;
}

export interface GeneratedHooks {
  tiktokHooks: {
    audioVisualHook: string;
    textOnScreen: string;
    scriptAngle: string;
  }[];
  twitterThread: string[];
  youtubeAngle: {
    title: string;
    thumbnailIdea: string;
    keyPoints: string[];
  };
  monetizationIdea: string;
}
