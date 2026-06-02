import unittest
from solver import solve_1d, solve_2d

class TestPizzaSolver(unittest.TestCase):
    def setUp(self):
        # Default stocks
        self.stocks = {
            'farinha': 150.0,
            'manteiga': 25.0,
            'queijo': 50.0,
            'molho': 160.0,
            'calabresa': 30.0
        }
        
        # Recipes
        self.recipes = {
            'pizza1': {
                'farinha': 0.5,
                'manteiga': 0.2,
                'queijo': 0.3,
                'molho': 0.2,
                'calabresa': 0.0
            },
            'pizza2': {
                'farinha': 0.5,
                'manteiga': 0.2,
                'queijo': 0.2,
                'molho': 0.2,
                'calabresa': 0.15
            }
        }
        
        # Profits
        self.profits = {
            'pizza1': 12.0,
            'pizza2': 15.0
        }

    def test_case_1_butter_bottleneck(self):
        # Stocks: Farinha=150, Manteiga=25, Queijo=50, Molho=160
        # Recipe Pizza 1: Farinha=0.5, Manteiga=0.2, Queijo=0.3, Molho=0.2
        # Expected max production: 25 / 0.2 = 125 pizzas
        res = solve_1d(self.stocks, self.recipes['pizza1'], self.profits['pizza1'])
        
        self.assertTrue(res['success'])
        self.assertEqual(res['optimal_x1'], 125.0)
        self.assertEqual(res['total_profit'], 125.0 * 12.0)
        self.assertTrue(res['usage']['manteiga']['bottleneck'])
        self.assertEqual(res['usage']['manteiga']['percent'], 100.0)
        # Verify other usages are less than 100%
        self.assertFalse(res['usage']['farinha']['bottleneck'])
        self.assertLess(res['usage']['farinha']['percent'], 100.0)

    def test_case_2_flour_bottleneck(self):
        # Manteiga rises to 40, Farinha is set to 75 (so 75 / 0.5 = 150 pizzas)
        stocks_case2 = self.stocks.copy()
        stocks_case2['manteiga'] = 40.0
        stocks_case2['farinha'] = 75.0
        
        res = solve_1d(stocks_case2, self.recipes['pizza1'], self.profits['pizza1'])
        
        self.assertTrue(res['success'])
        self.assertEqual(res['optimal_x1'], 150.0)
        self.assertEqual(res['total_profit'], 150.0 * 12.0)
        self.assertTrue(res['usage']['farinha']['bottleneck'])
        self.assertEqual(res['usage']['farinha']['percent'], 100.0)
        # Verify butter usage is not bottleneck anymore (uses 150 * 0.2 = 30kg, which is 75% of 40kg)
        self.assertFalse(res['usage']['manteiga']['bottleneck'])
        self.assertEqual(res['usage']['manteiga']['percent'], 75.0)

    def test_case_3_mix_optimization(self):
        # Verify the 2D LP solver runs and yields valid vertices and optimal mix
        res = solve_2d(self.stocks, self.recipes, self.profits)
        
        self.assertTrue(res['success'])
        self.assertIn('optimal_x1', res)
        self.assertIn('optimal_x2', res)
        self.assertGreater(len(res['vertices']), 2)
        # Verify optimal solution lies on or within constraints
        opt_x1 = res['optimal_x1']
        opt_x2 = res['optimal_x2']
        
        for ing, stock in self.stocks.items():
            used = self.recipes['pizza1'][ing] * opt_x1 + self.recipes['pizza2'][ing] * opt_x2
            self.assertLessEqual(used, stock + 1e-4)

    def test_case_4_calabresa_1d_optimization(self):
        # Recipe Pizza 2: Farinha=0.5, Manteiga=0.2, Queijo=0.2, Molho=0.2, Calabresa=0.15
        # Expected max production: 25 / 0.2 = 125 pizzas (Manteiga limit)
        res = solve_1d(self.stocks, self.recipes['pizza2'], self.profits['pizza2'], pizza_var='x2')
        
        self.assertTrue(res['success'])
        self.assertEqual(res['optimal_x1'], 0.0)
        self.assertEqual(res['optimal_x2'], 125.0)
        self.assertEqual(res['total_profit'], 125.0 * 15.0)
        self.assertTrue(res['usage']['manteiga']['bottleneck'])
        self.assertEqual(res['usage']['manteiga']['percent'], 100.0)

if __name__ == '__main__':
    unittest.main()
