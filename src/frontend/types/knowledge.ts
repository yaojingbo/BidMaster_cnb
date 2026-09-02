export type RagIndexStatus =
  | 'not_indexed'
  | 'pending'
  | 'processing'
  | 'completed'
  | 'failed'
  | 'stale';

export interface KnowledgeBaseSummary {
  id: string;
  name: string;
  description: string;
  file_count: number;
  completed_count: number;
  processing_count: number;
  failed_count: number;
  stale_count: number;
  created_at: string;
  updated_at: string;
}

export interface KnowledgeBaseFile {
  id: string;
  original_name: string;
  size: number;
  type: string;
  file_hash?: string;
  created_at: string;
  index_status: RagIndexStatus;
  chunk_count: number;
  error_message?: string | null;
  index_id?: string | null;
}

export interface KnowledgeBaseDetail extends KnowledgeBaseSummary {
  files: KnowledgeBaseFile[];
}

export interface RagCitation {
  citation_id: number;
  knowledge_base_id: string;
  chunk_id: string;
  file_id: string;
  file_name: string;
  page_start: number | null;
  page_end: number | null;
  section_path: string | null;
  content_preview: string;
  score: number;
}

export interface RagExcludedFile {
  file_id: string;
  file_name: string;
  reason: string;
}

export interface RagQueryResult {
  answer: string;
  citations: RagCitation[];
  excluded_files: RagExcludedFile[];
  usage: Record<string, unknown>;
  refused: boolean;
}

export interface KnowledgeSourceOption {
  source_type: 'extract' | 'simulate' | 'opening';
  source_ref_id: string;
  source_variant: string;
  display_name: string;
  provenance_type: 'derived_extraction' | 'derived_structured' | 'derived_ai';
  created_at?: string;
}

export interface RagIndexJobItem {
  id: string;
  file_id?: string | null;
  source_id?: string | null;
  display_name: string;
  status: string;
  current_stage: string;
  progress_percent: number;
  progress_message?: string | null;
  error_message?: string | null;
}

export interface RagIndexJob {
  id: string;
  status: string;
  requested_file_ids: string[];
  completed_file_count: number;
  failed_file_count: number;
  total_item_count: number;
  skipped_item_count: number;
  current_stage?: string | null;
  current_item_id?: string | null;
  progress_percent: number;
  progress_message?: string | null;
  error_message?: string | null;
}
