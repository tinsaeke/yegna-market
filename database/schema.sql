-- ============================================
-- YEGNA MARKET - DATABASE SCHEMA
-- Multi-Vendor E-commerce Platform
-- ============================================

-- ============================================
-- 1. CREATE TABLES
-- ============================================

-- Categories Table
CREATE TABLE IF NOT EXISTS categories (
    id BIGSERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    icon TEXT DEFAULT '📦',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Sellers Table
CREATE TABLE IF NOT EXISTS sellers (
    id BIGSERIAL PRIMARY KEY,
    user_id UUID NOT NULL UNIQUE,
    shop_name TEXT NOT NULL,
    shop_description TEXT,
    shop_logo TEXT DEFAULT '🏪',
    rating DECIMAL(3,2) DEFAULT 0,
    total_sales INTEGER DEFAULT 0,
    status TEXT DEFAULT 'pending',
    bank_name TEXT,
    account_number TEXT,
    account_holder_name TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Products Table
CREATE TABLE IF NOT EXISTS products (
    id BIGSERIAL PRIMARY KEY,
    seller_id BIGINT NOT NULL REFERENCES sellers(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    price DECIMAL(10,2) NOT NULL,
    image TEXT DEFAULT '📦',
    category_id BIGINT REFERENCES categories(id) ON DELETE SET NULL,
    stock_quantity INTEGER DEFAULT 0,
    product_type TEXT DEFAULT 'physical',
    status TEXT DEFAULT 'active',
    rating DECIMAL(3,2) DEFAULT 0,
    review_count INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Orders Table
CREATE TABLE IF NOT EXISTS orders (
    id BIGSERIAL PRIMARY KEY,
    customer_id UUID,
    customer_name TEXT NOT NULL,
    customer_email TEXT NOT NULL,
    total_amount DECIMAL(10,2) NOT NULL,
    payment_status TEXT DEFAULT 'pending',
    payment_method TEXT,
    shipping_address TEXT,
    receipt_image TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Seller Orders Table
CREATE TABLE IF NOT EXISTS seller_orders (
    id BIGSERIAL PRIMARY KEY,
    order_id BIGINT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    seller_id BIGINT NOT NULL REFERENCES sellers(id) ON DELETE CASCADE,
    subtotal DECIMAL(10,2) NOT NULL,
    status TEXT DEFAULT 'pending',
    tracking_number TEXT,
    shipped_at TIMESTAMPTZ,
    delivered_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Order Items Table
CREATE TABLE IF NOT EXISTS order_items (
    id BIGSERIAL PRIMARY KEY,
    seller_order_id BIGINT NOT NULL REFERENCES seller_orders(id) ON DELETE CASCADE,
    product_id BIGINT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    product_name TEXT NOT NULL,
    product_image TEXT,
    quantity INTEGER NOT NULL,
    price DECIMAL(10,2) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Reviews Table
CREATE TABLE IF NOT EXISTS reviews (
    id BIGSERIAL PRIMARY KEY,
    product_id BIGINT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    user_id UUID NOT NULL,
    seller_order_id BIGINT REFERENCES seller_orders(id) ON DELETE CASCADE,
    rating INTEGER CHECK (rating >= 1 AND rating <= 5),
    comment TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Wishlist Table
CREATE TABLE IF NOT EXISTS wishlist (
    id BIGSERIAL PRIMARY KEY,
    user_id UUID NOT NULL,
    product_id BIGINT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, product_id)
);

-- Seller Ratings Table
CREATE TABLE IF NOT EXISTS seller_ratings (
    id SERIAL PRIMARY KEY,
    seller_id INTEGER REFERENCES sellers(id) ON DELETE CASCADE,
    customer_email TEXT NOT NULL,
    seller_order_id INTEGER REFERENCES seller_orders(id) ON DELETE CASCADE,
    rating INTEGER CHECK (rating >= 1 AND rating <= 5),
    comment TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(seller_order_id, customer_email)
);

-- Seller Payouts Table
CREATE TABLE IF NOT EXISTS seller_payouts (
    id BIGSERIAL PRIMARY KEY,
    seller_id BIGINT NOT NULL REFERENCES sellers(id) ON DELETE CASCADE,
    seller_order_id BIGINT NOT NULL REFERENCES seller_orders(id) ON DELETE CASCADE,
    amount DECIMAL(10,2) NOT NULL,
    commission_rate DECIMAL(5,2) DEFAULT 10.00,
    commission_amount DECIMAL(10,2) NOT NULL,
    net_amount DECIMAL(10,2) NOT NULL,
    status TEXT DEFAULT 'pending',
    payment_method TEXT,
    transaction_reference TEXT,
    paid_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 2. CREATE INDEXES
-- ============================================

CREATE INDEX IF NOT EXISTS idx_products_seller ON products(seller_id);
CREATE INDEX IF NOT EXISTS idx_products_category ON products(category_id);
CREATE INDEX IF NOT EXISTS idx_products_status ON products(status);
CREATE INDEX IF NOT EXISTS idx_seller_orders_order ON seller_orders(order_id);
CREATE INDEX IF NOT EXISTS idx_seller_orders_seller ON seller_orders(seller_id);
CREATE INDEX IF NOT EXISTS idx_order_items_seller_order ON order_items(seller_order_id);
CREATE INDEX IF NOT EXISTS idx_orders_customer ON orders(customer_id);
CREATE INDEX IF NOT EXISTS idx_wishlist_user ON wishlist(user_id);
CREATE INDEX IF NOT EXISTS idx_sellers_status ON sellers(status);

-- ============================================
-- 3. CREATE FUNCTIONS
-- ============================================

-- Function: Update Seller Rating
CREATE OR REPLACE FUNCTION update_seller_rating(p_seller_id INTEGER)
RETURNS VOID AS $$
DECLARE
  avg_rating NUMERIC;
  rating_count INTEGER;
BEGIN
  SELECT COUNT(*), AVG(rating) 
  INTO rating_count, avg_rating
  FROM seller_ratings 
  WHERE seller_id = p_seller_id;
  
  UPDATE sellers 
  SET rating = COALESCE(avg_rating, 0)
  WHERE id = p_seller_id;
END;
$$ LANGUAGE plpgsql;

-- Function: Reduce Product Stock
CREATE OR REPLACE FUNCTION reduce_product_stock(p_product_id INTEGER, p_quantity INTEGER)
RETURNS VOID AS $$
BEGIN
  UPDATE products 
  SET stock_quantity = GREATEST(stock_quantity - p_quantity, 0)
  WHERE id = p_product_id;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- 4. DISABLE RLS (Row Level Security)
-- ============================================

ALTER TABLE categories DISABLE ROW LEVEL SECURITY;
ALTER TABLE sellers DISABLE ROW LEVEL SECURITY;
ALTER TABLE products DISABLE ROW LEVEL SECURITY;
ALTER TABLE orders DISABLE ROW LEVEL SECURITY;
ALTER TABLE seller_orders DISABLE ROW LEVEL SECURITY;
ALTER TABLE order_items DISABLE ROW LEVEL SECURITY;
ALTER TABLE reviews DISABLE ROW LEVEL SECURITY;
ALTER TABLE wishlist DISABLE ROW LEVEL SECURITY;
ALTER TABLE seller_ratings DISABLE ROW LEVEL SECURITY;
ALTER TABLE seller_payouts DISABLE ROW LEVEL SECURITY;

-- ============================================
-- 5. GRANT PERMISSIONS
-- ============================================

GRANT ALL ON categories TO anon, authenticated;
GRANT ALL ON sellers TO anon, authenticated;
GRANT ALL ON products TO anon, authenticated;
GRANT ALL ON orders TO anon, authenticated;
GRANT ALL ON seller_orders TO anon, authenticated;
GRANT ALL ON order_items TO anon, authenticated;
GRANT ALL ON reviews TO anon, authenticated;
GRANT ALL ON wishlist TO anon, authenticated;
GRANT ALL ON seller_ratings TO anon, authenticated;
GRANT ALL ON seller_payouts TO anon, authenticated;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated;

-- ============================================
-- 6. INSERT SAMPLE DATA
-- ============================================

INSERT INTO categories (name, icon) VALUES 
('Electronics', '💻'),
('Fashion', '👕'),
('Home & Garden', '🏠'),
('Sports', '⚽'),
('Books', '📚'),
('Toys', '🧸')
ON CONFLICT DO NOTHING;
