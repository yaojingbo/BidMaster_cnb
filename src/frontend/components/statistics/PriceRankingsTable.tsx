"use client";

import { TrendingUp, TrendingDown } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface PriceRanking {
  rank: number;
  bidderId: string;
  price: number;
  changePercent?: number;
}

interface PriceRankingsTableProps {
  rankings: PriceRanking[];
}

export function PriceRankingsTable({ rankings }: PriceRankingsTableProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>报价排名</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b">
                <th className="text-left p-2 font-medium text-muted-foreground">排名</th>
                <th className="text-left p-2 font-medium text-muted-foreground">投标方</th>
                <th className="text-right p-2 font-medium text-muted-foreground">报价</th>
                <th className="text-right p-2 font-medium text-muted-foreground">变化</th>
              </tr>
            </thead>
            <tbody>
              {rankings.map((item) => (
                <tr key={item.rank} className="border-b hover:bg-muted/50">
                  <td className="p-2">
                    <span
                      className={cn(
                        "w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm",
                        item.rank === 1
                          ? "bg-warning-light text-warning"
                          : item.rank === 2
                          ? "bg-muted text-muted-foreground"
                          : item.rank === 3
                          ? "bg-warning-light text-warning"
                          : "bg-muted text-muted-foreground"
                      )}
                    >
                      {item.rank}
                    </span>
                  </td>
                  <td className="p-2 font-medium">{item.bidderId}</td>
                  <td className="p-2 text-right font-semibold">
                    ¥{item.price.toLocaleString()}
                  </td>
                  <td className="p-2 text-right">
                    {item.changePercent !== undefined && (
                      <span
                        className={cn(
                          "flex items-center justify-end gap-1",
                          item.changePercent > 0 ? "text-destructive" : "text-success"
                        )}
                      >
                        {item.changePercent > 0 ? (
                          <TrendingUp className="h-4 w-4" />
                        ) : (
                          <TrendingDown className="h-4 w-4" />
                        )}
                        {Math.abs(item.changePercent)}%
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
