from __future__ import annotations
"""
Statistics service for calculating bid analysis metrics.
"""
from typing import List, Dict, Any


class StatisticsService:
    """Service for calculating statistical metrics from bid data."""

    @staticmethod
    def calculate_price_statistics(prices: List[float]) -> Dict[str, Any]:
        """
        Calculate comprehensive price statistics.

        Args:
            prices: List of bid prices

        Returns:
            Dictionary containing statistical metrics
        """
        if not prices:
            return {}

        sorted_prices = sorted(prices)
        n = len(sorted_prices)

        # Calculate rankings
        price_rankings = [
            {"bidderId": f"bidder_{i+1}", "price": p, "rank": i + 1}
            for i, p in enumerate(sorted_prices)
        ]

        # Basic statistics
        avg_price = sum(prices) / n
        min_price = min(prices)
        max_price = max(prices)

        # Standard deviation and dispersion coefficient
        variance = sum((p - avg_price) ** 2 for p in prices) / n
        std_dev = variance ** 0.5
        dispersion = (std_dev / avg_price * 100) if avg_price > 0 else 0

        # Price change percentages
        price_changes = []
        for i in range(1, len(sorted_prices)):
            if sorted_prices[i - 1] > 0:
                change = (sorted_prices[i - 1] - sorted_prices[i]) / sorted_prices[i - 1] * 100
                price_changes.append(round(change, 2))

        return {
            "prices": prices,
            "priceRankings": price_rankings,
            "averagePrice": round(avg_price, 2),
            "lowestPrice": min_price,
            "highestPrice": max_price,
            "dispersionCoefficient": round(dispersion, 2),
            "priceChanges": price_changes,
        }

    @staticmethod
    def parse_excel_prices(file_content: bytes) -> List[float]:
        """
        Parse prices from Excel file content.

        Args:
            file_content: Excel file bytes

        Returns:
            List of price values
        """
        import io
        import pandas as pd

        try:
            # Read Excel from bytes
            df = pd.read_excel(io.BytesIO(file_content))

            # Try to find price columns (look for common column names)
            price_columns = ["price", "报价", "bid", "投标价", "金额"]
            prices = []

            for col in df.columns:
                col_lower = str(col).lower()
                if any(pc in col_lower for pc in price_columns):
                    # Try to convert to numeric
                    numeric_values = pd.to_numeric(df[col], errors='coerce').dropna()
                    prices.extend(numeric_values.tolist())

            return prices
        except Exception:
            return []

    @staticmethod
    def parse_csv_prices(file_content: bytes) -> List[float]:
        """
        Parse prices from CSV file content.

        Args:
            file_content: CSV file bytes

        Returns:
            List of price values
        """
        import io
        import pandas as pd

        try:
            df = pd.read_csv(io.BytesIO(file_content))

            # Look for price columns
            price_columns = ["price", "报价", "bid", "投标价", "金额"]
            prices = []

            for col in df.columns:
                col_lower = str(col).lower()
                if any(pc in col_lower for pc in price_columns):
                    numeric_values = pd.to_numeric(df[col], errors='coerce').dropna()
                    prices.extend(numeric_values.tolist())

            return prices
        except Exception:
            return []