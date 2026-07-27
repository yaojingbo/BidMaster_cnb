"use client";

import { TrendingUp, TrendingDown, BarChart3 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

interface StatisticsCardsProps {
  priceCount: number;
  lowestPrice: number;
  highestPrice: number;
  averagePrice: number;
  medianPrice?: number;
  dispersionCoefficient?: number;
}

export function StatisticsCards({
  priceCount,
  lowestPrice,
  highestPrice,
  averagePrice,
  medianPrice,
  dispersionCoefficient,
}: StatisticsCardsProps) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      <Card>
        <CardContent className="p-4">
          <p className="text-sm text-muted-foreground">报价数量</p>
          <p className="text-2xl font-bold">{priceCount}</p>
        </CardContent>
      </Card>

      <Card className="border-success">
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">最低价</p>
              <p className="text-2xl font-bold text-success">
                ¥{lowestPrice.toLocaleString()}
              </p>
            </div>
            <TrendingDown className="h-8 w-8 text-success/20" />
          </div>
        </CardContent>
      </Card>

      <Card className="border-destructive">
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">最高价</p>
              <p className="text-2xl font-bold text-destructive">
                ¥{highestPrice.toLocaleString()}
              </p>
            </div>
            <TrendingUp className="h-8 w-8 text-destructive/20" />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">平均价</p>
              <p className="text-2xl font-bold">
                ¥{averagePrice.toLocaleString()}
              </p>
            </div>
            <BarChart3 className="h-8 w-8 text-muted-foreground/20" />
          </div>
        </CardContent>
      </Card>

      {medianPrice !== undefined && (
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">中位数</p>
            <p className="text-2xl font-bold">
              ¥{medianPrice.toLocaleString()}
            </p>
          </CardContent>
        </Card>
      )}

      {dispersionCoefficient !== undefined && (
        <Card className="md:col-span-2">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">离散系数</p>
                <p className="text-3xl font-bold">
                  {dispersionCoefficient.toFixed(2)}%
                </p>
              </div>
              <BarChart3 className="h-12 w-12 text-muted-foreground/20" />
            </div>
            <p className="text-sm text-muted-foreground mt-2">
              离散系数越高表示报价差异越大，竞争程度越高
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
