-- TagYourCity Database Setup Script
-- Run this with: psql -U postgres -f setup_database.sql

-- Create the database
DROP DATABASE IF EXISTS tagyourcity;
CREATE DATABASE tagyourcity;

-- Connect to the new database
\c tagyourcity

-- Enable PostGIS extension
CREATE EXTENSION IF NOT EXISTS postgis;

-- Verify PostGIS is enabled
SELECT PostGIS_Version();

-- Create submissions table
CREATE TABLE IF NOT EXISTS submissions (
    id SERIAL PRIMARY KEY,
    submission_id UUID UNIQUE NOT NULL,
    session_timestamp TIMESTAMP WITH TIME ZONE NOT NULL,
    user_location GEOMETRY(Point, 4326),
    radius_meters INTEGER,
    total_disliked_voxels INTEGER DEFAULT 0,
    total_liked_voxels INTEGER DEFAULT 0,
    total_clusters INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create clusters table (stores each labeled cluster)
CREATE TABLE IF NOT EXISTS clusters (
    id SERIAL PRIMARY KEY,
    submission_id UUID NOT NULL REFERENCES submissions(submission_id) ON DELETE CASCADE,
    cluster_id TEXT NOT NULL,
    cluster_type TEXT NOT NULL CHECK (cluster_type IN ('disliked', 'liked')),
    voxel_count INTEGER NOT NULL,
    centroid GEOMETRY(PointZ, 4326),
    tags TEXT[],
    comment TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create voxels table (stores individual voxel coordinates for each cluster)
CREATE TABLE IF NOT EXISTS voxels (
    id SERIAL PRIMARY KEY,
    cluster_id INTEGER NOT NULL REFERENCES clusters(id) ON DELETE CASCADE,
    voxel_key TEXT NOT NULL,
    coordinates GEOMETRY(PointZ, 4326),
    height_meters DECIMAL(10,2),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better query performance
CREATE INDEX idx_submissions_timestamp ON submissions(session_timestamp);
CREATE INDEX idx_submissions_location ON submissions USING GIST(user_location);
CREATE INDEX idx_clusters_submission ON clusters(submission_id);
CREATE INDEX idx_clusters_centroid ON clusters USING GIST(centroid);
CREATE INDEX idx_clusters_type ON clusters(cluster_type);
CREATE INDEX idx_voxels_cluster ON voxels(cluster_id);
CREATE INDEX idx_voxels_coordinates ON voxels USING GIST(coordinates);

-- Grant permissions (adjust if you create a specific user later)
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO postgres;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO postgres;

-- Display success message
SELECT 'Database setup complete! Tables created:' AS status;
SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename;
