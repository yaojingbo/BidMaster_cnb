"use client";

import { useState, useCallback } from "react";

interface ParsedData {
  records: Record<string, unknown>[];
  columns: string[];
  rowCount: number;
  numericColumns: string[];
}

interface PriceStatistics {
  averagePrice: number;
  lowestPrice: number;
  highestPrice: number;
  medianPrice: number;
  dispersionCoefficient: number;
  priceRankings: { rank: number; bidder: string; price: number }[];
}

interface StatisticsResult {
  analysisId: string;
  prices: number[];
  statistics: PriceStatistics;
  suggestions: string[];
}

interface UseStatisticsOptions {
  onSuccess?: (data: StatisticsResult) => void;
  onError?: (error: Error) => void;
}

export function useStatistics(options: UseStatisticsOptions = {}) {
  const [isLoading, setIsLoading] = useState(false);
  const [parsedData, setParsedData] = useState<ParsedData | null>(null);
  const [statisticsResult, setStatisticsResult] = useState<StatisticsResult | null>(null);
  const [error, setError] = useState<Error | null>(null);

  const parseFile = useCallback(async (file: File): Promise<ParsedData | null> => {
    setIsLoading(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch("/api/statistics/parse", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        throw new Error(`Parse failed: ${response.statusText}`);
      }

      const result = await response.json();
      if (result.success) {
        setParsedData(result.data);
        return result.data;
      } else {
        throw new Error(result.detail || "Parse failed");
      }
    } catch (e) {
      const err = e instanceof Error ? e : new Error(String(e));
      setError(err);
      options.onError?.(err);
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [options]);

  const analyzePrices = useCallback(async (prices: number[]): Promise<StatisticsResult | null> => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/statistics/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prices }),
      });

      if (!response.ok) {
        throw new Error(`Analyze failed: ${response.statusText}`);
      }

      const result = await response.json();
      if (result.success) {
        setStatisticsResult(result.data);
        options.onSuccess?.(result.data);
        return result.data;
      } else {
        throw new Error(result.detail || "Analyze failed");
      }
    } catch (e) {
      const err = e instanceof Error ? e : new Error(String(e));
      setError(err);
      options.onError?.(err);
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [options]);

  const exportReport = useCallback(async (
    analysisId: string,
    format: "pdf" | "excel" | "json" = "pdf"
  ): Promise<string | null> => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(
        `/api/statistics/export/${analysisId}?format=${format}`
      );

      if (!response.ok) {
        throw new Error(`Export failed: ${response.statusText}`);
      }

      const result = await response.json();
      if (result.success) {
        return result.data.downloadUrl;
      } else {
        throw new Error(result.detail || "Export failed");
      }
    } catch (e) {
      const err = e instanceof Error ? e : new Error(String(e));
      setError(err);
      options.onError?.(err);
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [options]);

  const reset = useCallback(() => {
    setParsedData(null);
    setStatisticsResult(null);
    setError(null);
    setIsLoading(false);
  }, []);

  return {
    isLoading,
    parsedData,
    statisticsResult,
    error,
    parseFile,
    analyzePrices,
    exportReport,
    reset,
  };
}
