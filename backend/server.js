const express = require('express');
const cors = require('cors');
const db = require('./db');
require('dotenv').config();
const path = require('path');

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 10000;

// Serve frontend static files when deployed as single service
const frontendDist = path.join(__dirname, '..', 'frontend', 'dist');
app.use(express.static(frontendDist));

async function initDb() {
  // create schema
  const sql = require('fs').readFileSync(__dirname + '/migrations.sql', 'utf8');
  await db.query(sql);

  // insert default ingredients if missing
  const { rows } = await db.query('SELECT COUNT(*)::int AS cnt FROM ingredients');
  if (rows[0].cnt === 0) {
    // default seed values (from existing frontend defaults)
    const defaultIngredients = {
      farinha: 150,
      manteiga: 25,
      queijo: 50,
      molho: 160,
      calabresa: 30
    };

    for (const [name, stock] of Object.entries(defaultIngredients)) {
      await db.query('INSERT INTO ingredients(name, stock) VALUES($1, $2)', [name, stock]);
    }

    // default recipes
    const recipes = {
      pizza1: { farinha: 0.5, manteiga: 0.2, queijo: 0.3, molho: 0.2, calabresa: 0.0 },
      pizza2: { farinha: 0.5, manteiga: 0.2, queijo: 0.2, molho: 0.2, calabresa: 0.15 }
    };

    for (const [pizza, ingmap] of Object.entries(recipes)) {
      for (const [ing, amount] of Object.entries(ingmap)) {
        await db.query('INSERT INTO recipes(pizza, ingredient, amount) VALUES($1, $2, $3)', [pizza, ing, amount]);
      }
    }

    // default profits
    await db.query('INSERT INTO profits(pizza, profit) VALUES($1, $2)', ['pizza1', 12.00]);
    await db.query('INSERT INTO profits(pizza, profit) VALUES($1, $2)', ['pizza2', 15.00]);
  }
}

// Utility: read full state
app.get('/api/state', async (req, res) => {
  try {
    const ingredientsR = await db.query('SELECT name, stock FROM ingredients');
    const recipesR = await db.query('SELECT pizza, ingredient, amount FROM recipes');
    const profitsR = await db.query('SELECT pizza, profit FROM profits');
    const historyR = await db.query('SELECT id, timestamp, pizza, quantity, consumed FROM production_history ORDER BY timestamp DESC LIMIT 200');

    const stocks = {};
    ingredientsR.rows.forEach(r => stocks[r.name] = Number(r.stock));

    const recipes = {};
    recipesR.rows.forEach(r => {
      recipes[r.pizza] = recipes[r.pizza] || {};
      recipes[r.pizza][r.ingredient] = Number(r.amount);
    });

    const profits = {};
    profitsR.rows.forEach(r => profits[r.pizza] = Number(r.profit));

    res.json({ success: true, stocks, recipes, profits, productionHistory: historyR.rows });

  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'DB error' });
  }
});

// POST /api/produce
app.post('/api/produce', async (req, res) => {
  const { pizza, quantity } = req.body || {};
  const qty = Number(quantity) || 0;
  if (!pizza || qty <= 0) return res.status(400).json({ success: false, message: 'Invalid pizza or quantity' });

  const client = await db.getClient();
  try {
    await client.query('BEGIN');

    // load recipe
    const recipeRes = await client.query('SELECT ingredient, amount FROM recipes WHERE pizza=$1', [pizza]);
    const recipe = {};
    recipeRes.rows.forEach(r => recipe[r.ingredient] = Number(r.amount));

    // load current stocks
    const ingRes = await client.query('SELECT name, stock FROM ingredients FOR UPDATE');
    const stocks = {};
    ingRes.rows.forEach(r => stocks[r.name] = Number(r.stock));

    // compute required
    const consumed = {};
    for (const ing of Object.keys(stocks)) {
      const requiredPerUnit = recipe[ing] || 0;
      const required = Number((requiredPerUnit * qty).toFixed(2));
      consumed[ing] = required;
      if (required > stocks[ing]) {
        await client.query('ROLLBACK');
        return res.status(400).json({ success: false, message: `Insufficient ${ing}`, missing: required - stocks[ing] });
      }
    }

    // deduct
    for (const [ing, req] of Object.entries(consumed)) {
      await client.query('UPDATE ingredients SET stock = stock - $1 WHERE name = $2', [req, ing]);
    }

    // insert history
    const insertRes = await client.query('INSERT INTO production_history(pizza, quantity, consumed) VALUES($1, $2, $3) RETURNING id, timestamp', [pizza, qty, consumed]);
    await client.query('COMMIT');

    // return updated state
    const updatedIngs = await db.query('SELECT name, stock FROM ingredients');
    const stocksOut = {};
    updatedIngs.rows.forEach(r => stocksOut[r.name] = Number(r.stock));

    res.json({ success: true, production: { id: insertRes.rows[0].id, timestamp: insertRes.rows[0].timestamp, pizza, quantity: qty, consumed }, stocks: stocksOut });

  } catch (err) {
    await client.query('ROLLBACK');
    console.error(err);
    res.status(500).json({ success: false, message: 'Production failed' });
  } finally {
    client.release();
  }
});

// POST /api/solve - port of solver logic
app.post('/api/solve', async (req, res) => {
  try {
    const data = req.body || {};
    const mode = data.mode || 'simple';
    const stocks = data.stocks || {};
    const recipes = data.recipes || {};
    const profits = data.profits || {};

    // ensure numbers
    const clean_stocks = {};
    Object.entries(stocks).forEach(([k,v]) => clean_stocks[k] = Number(v));

    const clean_recipes = {};
    Object.entries(recipes).forEach(([pizza, ing]) => {
      clean_recipes[pizza] = {};
      Object.entries(ing).forEach(([k,v]) => clean_recipes[pizza][k] = Number(v));
    });

    const clean_profits = {};
    Object.entries(profits).forEach(([k,v]) => clean_profits[k] = Number(v));

    // simple 1d or 2d solver based on existing python logic
    function calculate_usage(x1, x2, recipes, stocks) {
      const usage = {};
      Object.entries(stocks).forEach(([ing, stock]) => {
        const used = (recipes.pizza1?.[ing] || 0) * x1 + (recipes.pizza2?.[ing] || 0) * x2;
        const clamped = Math.max(0.0, Math.min(used, stock));
        const percent = stock > 0 ? (clamped / stock) * 100 : 0;
        usage[ing] = { used: Math.round(clamped*100)/100, stock: stock, percent: Math.round(percent*10)/10, bottleneck: percent >= 99.9 };
      });
      return usage;
    }

    if (mode === 'simple' || mode === 'pizza1') {
      // solve 1d for pizza1
      const recipe = clean_recipes.pizza1 || {};
      let max_q = Infinity;
      Object.entries(clean_stocks).forEach(([ing, stock]) => {
        const req = recipe[ing] || 0;
        if (req > 0) {
          const limit = stock / req;
          if (limit < max_q) max_q = limit;
        }
      });
      if (!isFinite(max_q)) max_q = 0;
      const optimal_q = Math.round(max_q*100)/100;
      const total_profit = Math.round(optimal_q * (clean_profits.pizza1 || 12)*100)/100;
      const fake_recipes = { pizza1: recipe, pizza2: {} };
      const usage = calculate_usage(optimal_q, 0, fake_recipes, clean_stocks);
      return res.json({ success:true, optimal_x1: optimal_q, optimal_x2:0, total_profit, usage, vertices:[[0,0],[optimal_q,0]] });

    } else if (mode === 'pizza2') {
      const recipe = clean_recipes.pizza2 || {};
      let max_q = Infinity;
      Object.entries(clean_stocks).forEach(([ing, stock]) => {
        const req = recipe[ing] || 0;
        if (req > 0) {
          const limit = stock / req;
          if (limit < max_q) max_q = limit;
        }
      });
      if (!isFinite(max_q)) max_q = 0;
      const optimal_q = Math.round(max_q*100)/100;
      const total_profit = Math.round(optimal_q * (clean_profits.pizza2 || 15)*100)/100;
      const fake_recipes = { pizza1: {}, pizza2: recipe };
      const usage = calculate_usage(0, optimal_q, fake_recipes, clean_stocks);
      return res.json({ success:true, optimal_x1:0, optimal_x2:optimal_q, total_profit, usage, vertices:[[0,0],[0,optimal_q]] });

    } else if (mode === 'mix') {
      // vertex enumeration
      const lines = [ [1,0,0], [0,1,0] ];
      Object.entries(clean_stocks).forEach(([ing, stock]) => {
        const a1 = clean_recipes.pizza1?.[ing] || 0;
        const a2 = clean_recipes.pizza2?.[ing] || 0;
        if (a1>0 || a2>0) lines.push([a1,a2,stock]);
      });

      function getIntersection(l1,l2){
        const [A1,B1,C1]=l1; const [A2,B2,C2]=l2;
        const det = A1*B2 - A2*B1; if (Math.abs(det)<1e-9) return null;
        const x1 = (C1*B2 - C2*B1)/det; const x2 = (A1*C2 - A2*C1)/det; return [x1,x2];
      }

      let raw_points = [];
      for (let i=0;i<lines.length;i++) for (let j=i+1;j<lines.length;j++){ const p=getIntersection(lines[i],lines[j]); if(p) raw_points.push(p); }

      function feasible(x1,x2){
        if (x1 < -1e-6 || x2 < -1e-6) return false;
        for (const [ing,stock] of Object.entries(clean_stocks)){
          const used = (clean_recipes.pizza1?.[ing]||0)*x1 + (clean_recipes.pizza2?.[ing]||0)*x2;
          if (used > stock + 1e-6) return false;
        }
        return true;
      }

      const feasible_vertices = [];
      raw_points.forEach(pt=>{
        const x1 = Math.abs(pt[0])<1e-6?0:pt[0]; const x2 = Math.abs(pt[1])<1e-6?0:pt[1];
        if (feasible(x1,x2)){
          let dup=false; for (const v of feasible_vertices) if (Math.hypot(v[0]-x1,v[1]-x2)<1e-4) dup=true;
          if(!dup) feasible_vertices.push([x1,x2]);
        }
      });

      if (feasible_vertices.length===0) return res.json({ success:false, message:'Região viável vazia.'});

      const cx = feasible_vertices.reduce((s,v)=>s+v[0],0)/feasible_vertices.length;
      const cy = feasible_vertices.reduce((s,v)=>s+v[1],0)/feasible_vertices.length;
      feasible_vertices.sort((a,b)=>Math.atan2(a[1]-cy,a[0]-cx)-Math.atan2(b[1]-cy,b[0]-cx));

      let best_profit=-Infinity; let best_vertex=[0,0];
      const c1 = clean_profits.pizza1 || 0; const c2 = clean_profits.pizza2 || 0;
      feasible_vertices.forEach(v=>{ const profit = c1*v[0]+c2*v[1]; if (profit>best_profit){ best_profit=profit; best_vertex=v; } });
      const optimal_x1 = Math.round(best_vertex[0]*100)/100; const optimal_x2 = Math.round(best_vertex[1]*100)/100; const total_profit = Math.round(best_profit*100)/100;
      const usage = calculate_usage(optimal_x1, optimal_x2, clean_recipes, clean_stocks);
      const formatted_vertices = feasible_vertices.map(v=>[Math.round(v[0]*100)/100, Math.round(v[1]*100)/100]);

      const chart_lines = Object.entries(clean_stocks).map(([ing,stock])=>({ ingredient:ing, a1: clean_recipes.pizza1?.[ing]||0, a2: clean_recipes.pizza2?.[ing]||0, stock }));

      return res.json({ success:true, optimal_x1, optimal_x2, total_profit, usage, vertices:formatted_vertices, constraint_lines: chart_lines });

    } else {
      return res.status(400).json({ success:false, message:'Invalid mode' });
    }

  } catch (err) {
    console.error(err);
    res.status(500).json({ success:false, message:'Server error' });
  }
});

// start server after init
initDb().then(()=>{
  // Fallback: serve index.html for any non-API route (Vue Router history mode)
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api/')) return next();
    res.sendFile(path.join(frontendDist, 'index.html'));
  });

  app.listen(PORT, ()=> console.log(`Server running on port ${PORT}`));
}).catch(err=>{ console.error('Failed to init DB', err); process.exit(1); });
