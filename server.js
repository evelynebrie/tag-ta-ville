const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
const { v4: uuidv4 } = require('uuid');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Database connection pool
const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'tagyourcity',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD,
});

// Test database connection
pool.query('SELECT NOW()', (err, res) => {
  if (err) {
    console.error('❌ Database connection error:', err);
  } else {
    console.log('✅ Database connected successfully');
  }
});

// Middleware
app.use(cors({
  origin: process.env.CORS_ORIGIN?.split(',') || '*',
  methods: ['GET', 'POST', 'OPTIONS'],
  credentials: true
}));
app.use(express.json({ limit: '50mb' }));

// Health check endpoint
app.get('/api/health', async (req, res) => {
  try {
    const result = await pool.query('SELECT NOW()');
    res.json({ 
      status: 'healthy', 
      database: 'connected',
      timestamp: result.rows[0].now
    });
  } catch (error) {
    res.status(500).json({ status: 'unhealthy', error: error.message });
  }
});

// Main submission endpoint
app.post('/api/submissions', async (req, res) => {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    const {
      userId,  // NEW: User identifier
      sessionTimestamp,
      userLocation,
      radiusMeters,
      dislikedVoxels,
      likedVoxels,
      groundPolygons,
      clusters,
      sessionMetadata  // NEW: Any additional metadata
    } = req.body;
    
    // Generate unique submission ID
    const submissionId = uuidv4();
    
    // Insert main submission record
    const submissionQuery = `
      INSERT INTO submissions (
        submission_id,
        user_id,
        session_timestamp,
        user_lng,
        user_lat,
        radius_meters,
        total_disliked_voxels,
        total_liked_voxels,
        total_clusters,
        session_metadata
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING id, submission_id
    `;
    
    const submissionResult = await client.query(submissionQuery, [
      submissionId,
      userId || 'anonymous',
      new Date(sessionTimestamp),
      userLocation?.lng || null,
      userLocation?.lat || null,
      radiusMeters || 1000,
      dislikedVoxels?.length || 0,
      likedVoxels?.length || 0,
      clusters?.length || 0,
      sessionMetadata ? JSON.stringify(sessionMetadata) : null
    ]);
    
    console.log(`✓ Created submission: ${submissionId} (User: ${userId || 'anonymous'})`);
    
    // Insert ground polygons (2D painted areas)
    if (groundPolygons && groundPolygons.length > 0) {
      for (const polygon of groundPolygons) {
        // Calculate area if provided
        let area = polygon.area || null;
        
        const polygonQuery = `
          INSERT INTO ground_polygons (
            submission_id,
            polygon_type,
            geometry_json,
            area_m2,
            center_lng,
            center_lat
          ) VALUES ($1, $2, $3, $4, $5, $6)
        `;
        
        await client.query(polygonQuery, [
          submissionId,
          polygon.type,
          JSON.stringify(polygon.geometry),
          area,
          polygon.center[0],
          polygon.center[1]
        ]);
      }
      console.log(`  ✓ Inserted ${groundPolygons.length} ground polygons`);
    }
    
    // Insert clusters and their voxels
    if (clusters && clusters.length > 0) {
      for (const cluster of clusters) {
        // Insert cluster record with tags and comment
        const clusterQuery = `
          INSERT INTO clusters (
            submission_id,
            cluster_id,
            cluster_type,
            voxel_count,
            ground_area_m2,
            centroid_lng,
            centroid_lat,
            centroid_height,
            tags,
            comment
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
          RETURNING id
        `;
        
        const clusterResult = await client.query(clusterQuery, [
          submissionId,
          cluster.id,
          cluster.type,
          cluster.voxels?.length || 0,
          cluster.groundAreaM2 || null,
          cluster.centroid.lng,
          cluster.centroid.lat,
          cluster.centroid.height || 0,
          cluster.tags || [],
          cluster.comment || ''
        ]);
        
        const dbClusterId = clusterResult.rows[0].id;
        
        // Log cluster details
        console.log(`  ✓ Cluster ${cluster.id} (${cluster.type}): ${cluster.tags?.length || 0} tags, comment: ${cluster.comment ? 'yes' : 'no'}`);
        
        // Insert voxels for this cluster
        if (cluster.voxels && cluster.voxels.length > 0) {
          const voxelInserts = cluster.voxels.map(voxel => {
            return client.query(`
              INSERT INTO voxels (
                cluster_id,
                voxel_key,
                lng,
                lat,
                height,
                height_meters
              ) VALUES ($1, $2, $3, $4, $5, $6)
            `, [
              dbClusterId,
              voxel.key,
              voxel.lng,
              voxel.lat,
              voxel.height || 0,
              voxel.height || 0
            ]);
          });
          
          await Promise.all(voxelInserts);
          console.log(`    ✓ ${cluster.voxels.length} voxels`);
        }
      }
    }
    
    await client.query('COMMIT');
    
    res.status(201).json({
      success: true,
      submissionId: submissionId,
      message: 'Submission saved successfully',
      stats: {
        dislikedVoxels: dislikedVoxels?.length || 0,
        likedVoxels: likedVoxels?.length || 0,
        groundPolygons: groundPolygons?.length || 0,
        clusters: clusters?.length || 0
      }
    });
    
    console.log(`✅ Submission ${submissionId} completed successfully`);
    
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Error saving submission:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to save submission',
      details: error.message
    });
  } finally {
    client.release();
  }
});

// Get all submissions with full details
app.get('/api/submissions', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT 
        submission_id,
        user_id,
        session_timestamp,
        user_lng as lng,
        user_lat as lat,
        radius_meters,
        total_disliked_voxels,
        total_liked_voxels,
        total_clusters,
        session_metadata,
        created_at
      FROM submissions
      ORDER BY created_at DESC
      LIMIT 100
    `);
    
    res.json({
      success: true,
      count: result.rows.length,
      submissions: result.rows
    });
  } catch (error) {
    console.error('Error fetching submissions:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch submissions'
    });
  }
});

// Get single submission with all clusters, tags, and comments
app.get('/api/submissions/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    const submissionResult = await pool.query(`
      SELECT 
        submission_id,
        user_id,
        session_timestamp,
        user_lng as lng,
        user_lat as lat,
        radius_meters,
        total_disliked_voxels,
        total_liked_voxels,
        total_clusters,
        session_metadata,
        created_at
      FROM submissions
      WHERE submission_id = $1
    `, [id]);
    
    if (submissionResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Submission not found'
      });
    }
    
    // Get clusters with all details
    const clustersResult = await pool.query(`
      SELECT 
        cluster_id,
        cluster_type,
        voxel_count,
        ground_area_m2,
        centroid_lng as lng,
        centroid_lat as lat,
        centroid_height as height,
        tags,
        comment,
        created_at
      FROM clusters
      WHERE submission_id = $1
      ORDER BY created_at
    `, [id]);
    
    // Get ground polygons
    const groundPolygonsResult = await pool.query(`
      SELECT 
        polygon_type,
        geometry_json,
        area_m2,
        center_lng,
        center_lat
      FROM ground_polygons
      WHERE submission_id = $1
    `, [id]);
    
    res.json({
      success: true,
      submission: submissionResult.rows[0],
      clusters: clustersResult.rows,
      groundPolygons: groundPolygonsResult.rows.map(gp => ({
        type: gp.polygon_type,
        geometry: gp.geometry_json,
        area: gp.area_m2,
        center: [gp.center_lng, gp.center_lat]
      }))
    });
  } catch (error) {
    console.error('Error fetching submission:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch submission'
    });
  }
});

// Export complete data as GeoJSON with EVERYTHING: voxels, clusters, ground polygons, tags, comments, timestamps
app.get('/api/export/geojson', async (req, res) => {
  try {
    // Get all clusters with submission details
    const clustersResult = await pool.query(`
      SELECT 
        c.id as cluster_db_id,
        c.submission_id,
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
        s.user_id,
        s.session_timestamp,
        s.user_lng as session_lng,
        s.user_lat as session_lat,
        s.radius_meters,
        s.created_at as submission_created_at
      FROM clusters c
      JOIN submissions s ON c.submission_id = s.submission_id
      ORDER BY s.created_at DESC, c.id
    `);
    
    // Get all voxels with their cluster info
    const voxelsResult = await pool.query(`
      SELECT 
        v.id as voxel_id,
        v.cluster_id as cluster_db_id,
        v.voxel_key,
        v.lng,
        v.lat,
        v.height,
        v.height_meters,
        v.created_at as voxel_created_at,
        c.submission_id,
        c.cluster_id,
        c.cluster_type,
        c.tags,
        c.comment,
        s.user_id,
        s.session_timestamp,
        s.created_at as submission_created_at
      FROM voxels v
      JOIN clusters c ON v.cluster_id = c.id
      JOIN submissions s ON c.submission_id = s.submission_id
      ORDER BY s.created_at DESC, v.id
    `);
    
    // Get ground polygons with submission details
    const groundPolygonsResult = await pool.query(`
      SELECT 
        gp.id as polygon_id,
        gp.submission_id,
        gp.polygon_type,
        gp.geometry_json,
        gp.area_m2,
        gp.center_lng,
        gp.center_lat,
        gp.created_at as polygon_created_at,
        s.user_id,
        s.session_timestamp,
        s.created_at as submission_created_at
      FROM ground_polygons gp
      JOIN submissions s ON gp.submission_id = s.submission_id
      ORDER BY s.created_at DESC, gp.id
    `);
    
    const features = [];
    
    // Add cluster centroid features with all metadata
    clustersResult.rows.forEach(row => {
      features.push({
        type: 'Feature',
        id: `cluster_${row.cluster_id}`,
        geometry: {
          type: 'Point',
          coordinates: [row.centroid_lng, row.centroid_lat, row.centroid_height]
        },
        properties: {
          feature_type: 'cluster_centroid',
          cluster_id: row.cluster_id,
          cluster_db_id: row.cluster_db_id,
          submission_id: row.submission_id,
          user_id: row.user_id,
          cluster_type: row.cluster_type,
          voxel_count: row.voxel_count,
          ground_area_m2: row.ground_area_m2,
          tags: row.tags,
          comment: row.comment,
          session_timestamp: row.session_timestamp,
          session_lng: row.session_lng,
          session_lat: row.session_lat,
          radius_meters: row.radius_meters,
          cluster_created_at: row.cluster_created_at,
          submission_created_at: row.submission_created_at
        }
      });
    });
    
    // Add individual voxel features with all metadata
    voxelsResult.rows.forEach(row => {
      features.push({
        type: 'Feature',
        id: `voxel_${row.voxel_id}`,
        geometry: {
          type: 'Point',
          coordinates: [row.lng, row.lat, row.height]
        },
        properties: {
          feature_type: 'voxel',
          voxel_id: row.voxel_id,
          voxel_key: row.voxel_key,
          height_meters: row.height_meters,
          cluster_id: row.cluster_id,
          cluster_db_id: row.cluster_db_id,
          cluster_type: row.cluster_type,
          submission_id: row.submission_id,
          user_id: row.user_id,
          tags: row.tags,
          comment: row.comment,
          session_timestamp: row.session_timestamp,
          voxel_created_at: row.voxel_created_at,
          submission_created_at: row.submission_created_at
        }
      });
    });
    
    // Add ground polygon features with all metadata
    groundPolygonsResult.rows.forEach(row => {
      features.push({
        type: 'Feature',
        id: `ground_polygon_${row.polygon_id}`,
        geometry: row.geometry_json,
        properties: {
          feature_type: 'ground_polygon',
          polygon_id: row.polygon_id,
          submission_id: row.submission_id,
          user_id: row.user_id,
          polygon_type: row.polygon_type,
          area_m2: row.area_m2,
          center_lng: row.center_lng,
          center_lat: row.center_lat,
          session_timestamp: row.session_timestamp,
          polygon_created_at: row.polygon_created_at,
          submission_created_at: row.submission_created_at
        }
      });
    });
    
    // Set headers for proper .geojson file download
    res.setHeader('Content-Type', 'application/geo+json');
    res.setHeader('Content-Disposition', 'attachment; filename=tagyourcity_complete_export.geojson');
    
    res.json({
      type: 'FeatureCollection',
      metadata: {
        generated_at: new Date().toISOString(),
        total_features: features.length,
        total_clusters: clustersResult.rows.length,
        total_voxels: voxelsResult.rows.length,
        total_ground_polygons: groundPolygonsResult.rows.length,
        description: 'Complete export with all voxels, clusters, ground polygons, tags, comments, and timestamps'
      },
      features: features
    });
  } catch (error) {
    console.error('Error exporting GeoJSON:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to export GeoJSON',
      details: error.message
    });
  }
});

// Export detailed CSV with all tags and comments
app.get('/api/export/csv', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT 
        s.submission_id,
        s.user_id,
        s.session_timestamp,
        s.user_lng,
        s.user_lat,
        c.cluster_id,
        c.cluster_type,
        c.voxel_count,
        c.ground_area_m2,
        c.centroid_lng,
        c.centroid_lat,
        c.centroid_height,
        array_to_string(c.tags, '; ') as tags,
        c.comment,
        c.created_at
      FROM clusters c
      JOIN submissions s ON c.submission_id = s.submission_id
      ORDER BY s.created_at DESC, c.id
    `);
    
    // Convert to CSV
    const headers = ['submission_id', 'user_id', 'session_timestamp', 'session_lng', 'session_lat', 
                    'cluster_id', 'cluster_type', 'voxel_count', 'ground_area_m2',
                    'centroid_lng', 'centroid_lat', 'centroid_height', 'tags', 'comment', 'created_at'];
    
    let csv = headers.join(',') + '\n';
    
    result.rows.forEach(row => {
      const values = headers.map(h => {
        const val = row[h.replace('session_', 'user_')] || row[h];
        // Escape commas and quotes in CSV
        if (val === null || val === undefined) return '';
        const str = String(val);
        if (str.includes(',') || str.includes('"') || str.includes('\n')) {
          return '"' + str.replace(/"/g, '""') + '"';
        }
        return str;
      });
      csv += values.join(',') + '\n';
    });
    
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename=tagyourcity_export.csv');
    res.send(csv);
  } catch (error) {
    console.error('Error exporting CSV:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to export CSV'
    });
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`
╔════════════════════════════════════════╗
║   TagYourCity Backend Server Running   ║
╠════════════════════════════════════════╣
║  Port: ${PORT.toString().padEnd(33)}║
║  Environment: ${(process.env.NODE_ENV || 'development').padEnd(24)}║
║  Database: ${(process.env.DB_NAME || 'tagyourcity').padEnd(27)}║
╚════════════════════════════════════════╝

API Endpoints:
  → POST   /api/submissions       (Submit new data)
  → GET    /api/submissions       (List all submissions)
  → GET    /api/submissions/:id   (Get single submission)
  → GET    /api/export/geojson    (Export as GeoJSON)
  → GET    /api/export/csv        (Export as CSV)
  → GET    /api/health            (Health check)
  `);
});

process.on('SIGTERM', () => {
  console.log('SIGTERM received, closing server...');
  pool.end(() => {
    console.log('Database pool closed');
    process.exit(0);
  });
});
