from flask import Flask, request, jsonify
from flask_cors import CORS
from solver import solve_1d, solve_2d

app = Flask(__name__)
# Enable CORS for all routes so frontend dev server can communicate with backend
CORS(app)

@app.route('/api/solve', methods=['POST'])
def solve():
    try:
        data = request.json or {}
        mode = data.get('mode', 'simple')
        stocks = data.get('stocks', {})
        recipes = data.get('recipes', {})
        profits = data.get('profits', {})
        
        # Ensure all stock and recipe values are float type to prevent calculations on strings
        clean_stocks = {k: float(v) for k, v in stocks.items()}
        
        clean_recipes = {}
        for pizza, ing_recipe in recipes.items():
            clean_recipes[pizza] = {k: float(v) for k, v in ing_recipe.items()}
            
        clean_profits = {k: float(v) for k, v in profits.items()}
        
        if mode in ('simple', 'pizza1'):
            # Solve only for Pizza 1 (Muçarela)
            result = solve_1d(
                stocks=clean_stocks,
                recipe=clean_recipes.get('pizza1', {}),
                profit=clean_profits.get('pizza1', 12.0)
            )
        elif mode == 'pizza2':
            # Solve only for Pizza 2 (Calabresa)
            result = solve_1d(
                stocks=clean_stocks,
                recipe=clean_recipes.get('pizza2', {}),
                profit=clean_profits.get('pizza2', 15.0),
                pizza_var='x2'
            )
        elif mode == 'mix':
            # Solve for the optimal combination of Pizza 1 and Pizza 2
            result = solve_2d(
                stocks=clean_stocks,
                recipes=clean_recipes,
                profits=clean_profits
            )
        else:
            return jsonify({"success": False, "message": f"Modo '{mode}' inválido."}), 400
            
        return jsonify(result)
        
    except ValueError as ve:
        return jsonify({"success": False, "message": f"Erro de conversão numérica: {str(ve)}"}), 400
    except Exception as e:
        return jsonify({"success": False, "message": f"Ocorreu um erro no servidor: {str(e)}"}), 500

if __name__ == '__main__':
    # Run server on port 5000
    app.run(host='127.0.0.1', port=5000, debug=True)
