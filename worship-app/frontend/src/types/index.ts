export interface Worship {
  id: string;
  title: string;
  scripture: string;
  sermon_direction: string;
  duration_minutes: number;
  created_at: string;
}

export interface Song {
  id: string;
  title: string;
  artist: string;
  default_key: string;
  bpm: number;
  category: string;
  lyrics: string;
  sheet?: string;
}

export interface SongArrangement {
  id: string;
  song_id: string;
  worship_id: string;
  key: string;
  tempo: number;
  song_form: string[];
  ment: string;
  memo: string;
  order: number;
}

export interface YoutubeReference {
  id: string;
  song_id: string;
  title: string;
  url: string;
  channel: string;
  arrangement_type: string;
}

export interface ScriptureAnalysis {
  themes: string[];
  keywords: string[];
  storyline: string;
  emotional_flow: string[];
}

export interface YoutubeResult {
  title: string;
  url: string;
  channel: string;
  thumbnail: string;
}

export interface SongRecommendation {
  title: string;
  artist: string;
  reason: string;
  recommended_key: string;
  bpm: number;
  mood: string;
  estimated_duration_minutes: number;
  song_form: string[];
  connection_to_prev: string;
  connection_note: string;
  youtube_links: YoutubeResult[];
}

export interface FullRecommendResponse {
  worship_id: string;
  analysis: ScriptureAnalysis;
  recommendations: SongRecommendation[];
  total_estimated_duration: number;
}

export interface WorshipMentItem {
  id?: string;
  song_title: string;
  section_label: string;
  ment_text: string;
  order: number;
}

export interface WorshipMentListResponse {
  worship_id: string;
  ments: WorshipMentItem[];
}

export interface SectionMentRecommendRequest {
  song_title: string;
  section_from: string;
  section_to: string;
  scripture: string;
  theme: string;
  worship_type?: string;
}

export interface SectionMentRecommendResponse {
  ment: string;
  alternatives: string[];
}
