// src/db/types.ts
import { InferSelectModel, InferInsertModel } from 'drizzle-orm';
import {
  users,
  files,
  simulates,
  openings,
  extracts,
  apiKeys,
  verificationCodes,
  resetTokens,
  cliDeviceCodes,
} from './schema';

// ============================================
// 后端真实表类型
// ============================================
export type User = InferSelectModel<typeof users>;
export type NewUser = InferInsertModel<typeof users>;

export type FileRecord = InferSelectModel<typeof files>;
export type NewFileRecord = InferInsertModel<typeof files>;

export type SimulateRecord = InferSelectModel<typeof simulates>;
export type NewSimulateRecord = InferInsertModel<typeof simulates>;

export type OpeningRecord = InferSelectModel<typeof openings>;
export type NewOpeningRecord = InferInsertModel<typeof openings>;

export type ExtractRecord = InferSelectModel<typeof extracts>;
export type NewExtractRecord = InferInsertModel<typeof extracts>;

export type ApiKeyRecord = InferSelectModel<typeof apiKeys>;
export type NewApiKeyRecord = InferInsertModel<typeof apiKeys>;

export type VerificationCode = InferSelectModel<typeof verificationCodes>;
export type NewVerificationCode = InferInsertModel<typeof verificationCodes>;

export type ResetToken = InferSelectModel<typeof resetTokens>;
export type NewResetToken = InferInsertModel<typeof resetTokens>;

export type CliDeviceCode = InferSelectModel<typeof cliDeviceCodes>;
export type NewCliDeviceCode = InferInsertModel<typeof cliDeviceCodes>;

// ============================================
// Enums
// ============================================
export type DocumentCategory = 'tender' | 'bid';
export type DocumentStatus = 'uploading' | 'processing' | 'ready' | 'error';
export type AnalysisType = 'element_extract' | 'opening_analysis' | 'simulated_doc';
export type AnalysisStatus = 'pending' | 'processing' | 'done' | 'failed';
export type ElementName = '资质要求' | '评标办法' | '业绩门槛' | '定标方法' | '合同条款';

// ============================================
// API Response Types
// ============================================
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  code?: string;
  pagination?: {
    page: number;
    limit: number;
    total: number;
  };
}

export interface FileUploadResponse {
  id: string;
  name: string;
  size: number;
  type: string;
  status: DocumentStatus;
  createdAt: string;
}

export interface ProviderInfo {
  id: string;
  name: string;
  models: string[];
}

export interface ProvidersResponse {
  providers: ProviderInfo[];
  active: string;
}

export interface TestConnectionResponse {
  success: boolean;
  message: string;
  latencyMs?: number;
  error?: string;
}

// ============================================
// Element Types
// ============================================
export interface Element {
  name: ElementName;
  content: string;
  confidence?: number;
  position?: {
    page?: number;
    startLine?: number;
    endLine?: number;
  };
}

export interface StatisticsData {
  prices?: number[];
  priceRankings?: Array<{
    bidderId: string;
    price: number;
    rank: number;
  }>;
  averagePrice?: number;
  lowestPrice?: number;
  highestPrice?: number;
  dispersionCoefficient?: number;
  priceChanges?: number[];
}

// ============================================
// SSE Stream Events
// ============================================
export type StreamEvent =
  | { type: 'progress'; message: string }
  | { type: 'element'; data: Element }
  | { type: 'statistics'; data: StatisticsData }
  | { type: 'done'; data: { summary: string; elementCount?: number } }
  | { type: 'error'; data: { message: string } };
