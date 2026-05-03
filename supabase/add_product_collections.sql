-- 1. Create the new junction table
CREATE TABLE IF NOT EXISTS product_collections (
    product_id UUID REFERENCES products(id) ON DELETE CASCADE,
    collection_id UUID REFERENCES collections(id) ON DELETE CASCADE,
    PRIMARY KEY (product_id, collection_id)
);

-- 2. Migrate existing data from products table to the junction table
INSERT INTO product_collections (product_id, collection_id)
SELECT id, collection_id
FROM products
WHERE collection_id IS NOT NULL
ON CONFLICT DO NOTHING;

-- 3. Drop the collection_id column from the products table
-- Note: Make sure the qissey-new frontend is also updated before running this dropping step!
ALTER TABLE products DROP COLUMN IF EXISTS collection_id;
