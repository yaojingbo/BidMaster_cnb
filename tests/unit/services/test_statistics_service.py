"""
Statistics service unit tests.
"""
from app.services.statistics_service import StatisticsService


class TestStatisticsService:
    """Tests for StatisticsService price calculation."""

    def test_calculate_price_statistics_with_prices(self):
        """正常价格列表应返回完整统计结果。"""
        prices = [100, 200, 150, 300, 250]
        result = StatisticsService.calculate_price_statistics(prices)

        assert result["averagePrice"] == 200
        assert result["lowestPrice"] == 100
        assert result["highestPrice"] == 300
        assert len(result["priceRankings"]) == 5
        assert result["priceRankings"][0]["rank"] == 1
        assert result["priceRankings"][0]["price"] == 100

    def test_calculate_price_statistics_empty_list(self):
        """空列表应返回空字典。"""
        result = StatisticsService.calculate_price_statistics([])
        assert result == {}

    def test_calculate_price_statistics_single_price(self):
        """单一价格应返回正确结果。"""
        result = StatisticsService.calculate_price_statistics([100])
        assert result["averagePrice"] == 100
        assert result["lowestPrice"] == 100
        assert result["highestPrice"] == 100
        assert result["dispersionCoefficient"] == 0
        assert len(result["priceChanges"]) == 0

    def test_calculate_dispersion_coefficient(self):
        """离散系数应正确计算。"""
        result = StatisticsService.calculate_price_statistics([100, 200, 300])
        assert "dispersionCoefficient" in result
        assert result["dispersionCoefficient"] > 0

    def test_dispersion_coefficient_identical_prices(self):
        """相同价格的离散系数应为 0。"""
        result = StatisticsService.calculate_price_statistics([100, 100, 100])
        assert result["dispersionCoefficient"] == 0

    def test_calculate_price_changes(self):
        """价格变化数量应为 n-1。"""
        result = StatisticsService.calculate_price_statistics([100, 200, 150, 300, 250])
        assert len(result["priceChanges"]) == 4

    def test_calculate_price_rankings_ordered(self):
        """价格排名应按升序排列。"""
        result = StatisticsService.calculate_price_statistics([300, 100, 200])
        rankings = result["priceRankings"]
        assert rankings[0]["price"] == 100
        assert rankings[0]["rank"] == 1
        assert rankings[2]["price"] == 300
        assert rankings[2]["rank"] == 3

    def test_average_price_calculation(self):
        """平均价格应正确计算。"""
        result = StatisticsService.calculate_price_statistics([100, 200, 300])
        assert result["averagePrice"] == 200

    def test_result_contains_original_prices(self):
        """结果应包含原始价格列表。"""
        prices = [100, 200, 150]
        result = StatisticsService.calculate_price_statistics(prices)
        assert result["prices"] == prices
