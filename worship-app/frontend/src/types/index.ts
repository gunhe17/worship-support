export interface Worship {
  id: string;
  title: string;
  scripture: string;
  sermon_direction: string;
  duration_minutes: number;
  leader_meditation: string;
  created_at: string;
}

export interface SectionSummary {
  id: string;
  section_type: string;
  section_label: string;
  order: number;
}

export interface Arrangement {
  id: string;
  worship_id: string;
  song_id: string;
  order: number;
  song_form: string[];
  ment: string;
  sheet_url: string | null;
  song_title: string;
  song_artist: string;
  song_bpm: number;
  song_key?: string;
  song_sheet_url?: string | null;
  sections: SectionSummary[];
}

export interface SongSheet {
  id: string;
  song_id: string;
  key: string;
  sheet_url: string;
  page_order: number;
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
  sections: SongSection[];
  sheets?: SongSheet[];
}

export interface SongSection {
  id: string;
  song_id: string;
  section_type: string;
  section_label: string;
  lyrics: string;
  bars: number;
  chord?: string | null;
  order: number;
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
  sheet_url?: string | null;
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
  bars_from?: number;
  bars_to?: number;
  scripture: string;
  theme: string;
  worship_type?: string;
}

export interface SectionMentRecommendResponse {
  ment: string;
  alternatives: string[];
}

export interface SongFormSection {
  name: string;
  bars: number;
}

export interface SongFormWithBarsRequest {
  song_title: string;
  artist: string;
  bpm: number;
  worship_type?: string;
  available_minutes: number;
}

export interface SongFormWithBarsResponse {
  sections: SongFormSection[];
  total_estimated_minutes: number;
}

export interface PostSong {
  id: string;
  post_id: string;
  song_id: string;
  order: number;
  ment: string;
  song_title?: string;
  song_artist?: string;
}

export interface Comment {
  id: string;
  post_id: string;
  author_name: string;
  content: string;
  created_at: string;
}

export interface Post {
  id: string;
  author_name: string;
  scripture: string;
  meditation: string;
  view_count: number;
  created_at: string;
  songs: PostSong[];
  comments: Comment[];
}

export interface PostSummary {
  id: string;
  author_name: string;
  scripture: string;
  meditation: string;
  view_count: number;
  created_at: string;
  song_count: number;
  comment_count: number;
}
