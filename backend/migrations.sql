-- Schema for Otimiza Pizza backend

CREATE TABLE IF NOT EXISTS ingredients (
  name TEXT PRIMARY KEY,
  stock NUMERIC NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS recipes (
  pizza TEXT NOT NULL,
  ingredient TEXT NOT NULL,
  amount NUMERIC NOT NULL,
  PRIMARY KEY (pizza, ingredient),
  FOREIGN KEY (ingredient) REFERENCES ingredients(name) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS profits (
  pizza TEXT PRIMARY KEY,
  profit NUMERIC NOT NULL
);

CREATE TABLE IF NOT EXISTS production_history (
  id BIGSERIAL PRIMARY KEY,
  timestamp TIMESTAMPTZ NOT NULL DEFAULT now(),
  pizza TEXT NOT NULL,
  quantity NUMERIC NOT NULL,
  consumed JSONB NOT NULL
);
