-- Create submissions table (without PostGIS)
CREATE TABLE IF NOT EXISTS submissions (
    id SERIAL PRIMARY KEY,
    submission_id VARCHAR(36) UNIQUE NOT NULL,
    user_id VARCHAR(255),  -- User identifier (anonymous or email)
    session_timestamp TIMESTAMP NOT NULL,
    user_lng DOUBLE PRECISION,
    user_lat DOUBLE PRECISION,
    radius_meters INTEGER,
    total_disliked_voxels INTEGER DEFAULT 0,
    total_liked_voxels INTEGER DEFAULT 0,
    total_clusters INTEGER DEFAULT 0,
    session_metadata JSONB,  -- Store any additional session info
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create ground_polygons table
CREATE TABLE IF NOT EXISTS ground_polygons (
    id SERIAL PRIMARY KEY,
    submission_id VARCHAR(36) REFERENCES submissions(submission_id),
    polygon_type VARCHAR(20),  -- 'liked' or 'disliked'
    geometry_json JSONB,  -- Full GeoJSON geometry
    area_m2 DOUBLE PRECISION,  -- Calculated area in square meters
    center_lng DOUBLE PRECISION,
    center_lat DOUBLE PRECISION,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create clusters table
CREATE TABLE IF NOT EXISTS clusters (
    id SERIAL PRIMARY KEY,
    submission_id VARCHAR(36) REFERENCES submissions(submission_id),
    cluster_id VARCHAR(50),
    cluster_type VARCHAR(20),  -- 'liked' or 'disliked'
    voxel_count INTEGER DEFAULT 0,
    ground_area_m2 DOUBLE PRECISION,  -- Ground paint area for this cluster
    centroid_lng DOUBLE PRECISION,
    centroid_lat DOUBLE PRECISION,
    centroid_height DOUBLE PRECISION,
    tags TEXT[],  -- Array of selected tags
    comment TEXT,  -- User's textual comment for this cluster
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create voxels table
CREATE TABLE IF NOT EXISTS voxels (
    id SERIAL PRIMARY KEY,
    cluster_id INTEGER REFERENCES clusters(id) ON DELETE CASCADE,
    voxel_key VARCHAR(100),
    lng DOUBLE PRECISION,
    lat DOUBLE PRECISION,
    height DOUBLE PRECISION,
    height_meters REAL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_submissions_timestamp ON submissions(session_timestamp);
CREATE INDEX IF NOT EXISTS idx_submissions_user_id ON submissions(user_id);
CREATE INDEX IF NOT EXISTS idx_ground_polygons_submission ON ground_polygons(submission_id);
CREATE INDEX IF NOT EXISTS idx_ground_polygons_type ON ground_polygons(polygon_type);
CREATE INDEX IF NOT EXISTS idx_clusters_submission ON clusters(submission_id);
CREATE INDEX IF NOT EXISTS idx_clusters_type ON clusters(cluster_type);
CREATE INDEX IF NOT EXISTS idx_voxels_cluster ON voxels(cluster_id);

-- Create view for easy data export with all details
CREATE OR REPLACE VIEW cluster_details_view AS
SELECT 
    s.submission_id,
    s.user_id,
    s.session_timestamp,
    s.user_lng as session_lng,
    s.user_lat as session_lat,
    s.radius_meters,
    c.cluster_id,
    c.cluster_type,
    c.voxel_count,
    c.ground_area_m2,
    c.centroid_lng,
    c.centroid_lat,
    c.centroid_height,
    c.tags,
    c.comment,
    c.created_at as cluster_created_at,
    -- Count voxels in this cluster
    (SELECT COUNT(*) FROM voxels v WHERE v.cluster_id = c.id) as actual_voxel_count
FROM submissions s
JOIN clusters c ON s.submission_id = c.submission_id
ORDER BY s.created_at DESC, c.id;
