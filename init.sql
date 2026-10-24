-- init.sql: Runs on first PostgreSQL container initialization
CREATE TABLE IF NOT EXISTS products (
    id VARCHAR(100) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    price NUMERIC(10, 2),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Seed initial test product for k6 stampede tests
INSERT INTO products (id, name, description, price)
VALUES (
    'iphone-16',
    'Apple iPhone 16 Pro',
    'Flagship device with A18 Pro chip, 256GB storage, and titanium design',
    999.00
)
ON CONFLICT (id) DO NOTHING;
