-- Drop tables if they exist to start fresh
DROP TABLE IF EXISTS ingredients;
DROP TABLE IF EXISTS shades;
DROP TABLE IF EXISTS recipes;
DROP TABLE IF EXISTS colors;

-- Create Colors Table
CREATE TABLE colors (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Create Recipes Table
CREATE TABLE recipes (
    id SERIAL PRIMARY KEY,
    code TEXT NOT NULL UNIQUE,
    client TEXT,
    fabric TEXT,
    total_liters REAL,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Create Shades Table
CREATE TABLE shades (
    id SERIAL PRIMARY KEY,
    recipe_id INTEGER NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
    shade_number INTEGER NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE(recipe_id, shade_number)
);

-- Create Ingredients Table
CREATE TABLE ingredients (
    id SERIAL PRIMARY KEY,
    shade_id INTEGER NOT NULL REFERENCES shades(id) ON DELETE CASCADE,
    color_name TEXT NOT NULL,
    quantity_liters REAL NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);
