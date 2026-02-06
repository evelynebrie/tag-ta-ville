-- Enhanced TagYourCity Database Setup
-- Includes ground polygons (2D painted areas) as described in the paper

-- Connect to database
\c tagyourcity

-- Add ground_polygons table for 2D painted areas
CREATE TABLE IF NOT EXISTS ground_polygons (
    id SERIAL PRIMARY KEY,
    submission_id UUID NOT NULL REFERENCES submissions(submission_id) ON DELETE CASCADE,
    polygon_type TEXT NOT NULL CHECK (polygon_type IN ('disliked', 'liked')),
    geometry GEOMETRY(Polygon, 4326) NOT NULL,
    paint_radius_meters DECIMAL(10,2),
    center_point GEOMETRY(Point, 4326),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create spatial index for ground polygons
CREATE INDEX IF NOT EXISTS idx_ground_polygons_submission ON ground_polygons(submission_id);
CREATE INDEX IF NOT EXISTS idx_ground_polygons_geometry ON ground_polygons USING GIST(geometry);
CREATE INDEX IF NOT EXISTS idx_ground_polygons_type ON ground_polygons(polygon_type);

-- Grant permissions
GRANT ALL PRIVILEGES ON ground_polygons TO postgres;
GRANT ALL PRIVILEGES ON ground_polygons_id_seq TO postgres;

-- Display tables
SELECT 'Enhanced database schema created!' AS status;
SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename;
