#!/usr/bin/env python3
"""
EMERGENCY FIXES for critical bugs
"""

def apply_emergency_fixes(filepath):
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()
    
    print("Applying EMERGENCY fixes...")
    
    # FIX 1: Replace alert() with custom alert in submit
    print("✓ Fixing submit popup...")
    old_submit = r'alert\(`✅ Submission successful!\\n\\nSubmission ID: \${result\.submissionId}\\n\\nDisliked areas: \${result\.stats\.dislikedVoxels} voxels\\nLiked areas: \${result\.stats\.likedVoxels} voxels\\nGround polygons: \${result\.stats\.groundPolygons}\\nLabeled clusters: \${result\.stats\.clusters}\\n\\nThank you for your contribution!`\);'
    
    new_submit = '''const overlay = document.createElement('div');
      overlay.className = 'custom-alert-overlay';
      overlay.innerHTML = `
        <div class="custom-alert">
          <h3>✅ Submission Successful!</h3>
          <div class="custom-alert-content">
            <div style="margin-bottom: 15px; padding: 10px; background: #f0f7ff; border-radius: 6px;">
              <strong>Submission ID:</strong><br>
              <span style="font-size: 11px; color: #666; word-break: break-all;">${result.submissionId}</span>
            </div>
            <div style="margin-bottom: 10px;">
              <strong style="color: #ea4335;">Disliked areas:</strong> ${result.stats.dislikedVoxels} voxels
            </div>
            <div style="margin-bottom: 10px;">
              <strong style="color: #34a853;">Liked areas:</strong> ${result.stats.likedVoxels} voxels
            </div>
            <div style="margin-bottom: 10px;">
              <strong>Ground polygons:</strong> ${result.stats.groundPolygons}
            </div>
            <div style="margin-bottom: 10px;">
              <strong>Labeled clusters:</strong> ${result.stats.clusters}
            </div>
            <p style="margin-top: 15px; color: #666; font-size: 13px;">Thank you for your contribution!</p>
          </div>
          <button class="custom-alert-button" onclick="this.closest('.custom-alert-overlay').remove()">
            OK
          </button>
        </div>
      `;
      document.body.appendChild(overlay);'''
    
    import re
    content = re.sub(old_submit, new_submit, content)
    
    # FIX 2: Fix 3D distance calculation properly
    print("✓ Fixing 3D distance (voxel stacking bug)...")
    
    # The issue is mixing degrees with meters. Need to check ONLY height difference
    old_3d_dist = '''// FIX 3: 3D distance check to prevent stacking bug
            const clickHeight = clickPoint[2] || 0;
            const voxelHeight = voxel._center[2] || 0;
            
            const dx = clickPoint[0] - voxel._center[0];
            const dy = clickPoint[1] - voxel._center[1];
            const dz = clickHeight - voxelHeight;
            
            // True 3D distance squared
            const distSquared3D = dx * dx + dy * dy + dz * dz;
            
            if (distSquared3D < radiusDegSquared) {'''
    
    new_3d_dist = '''// FIX 3: 3D distance check to prevent stacking bug
            const clickHeight = clickPoint[2] || 0;
            const voxelHeight = voxel._center[2] || 0;
            
            // Horizontal distance in degrees
            const dx = clickPoint[0] - voxel._center[0];
            const dy = clickPoint[1] - voxel._center[1];
            const distSquared2D = dx * dx + dy * dy;
            
            // CRITICAL: Also check vertical distance (height)
            // Voxels are ~5-10m tall, so if height difference > toolSize, don't paint
            const heightDiff = Math.abs(clickHeight - voxelHeight);
            
            // Only paint if within horizontal range AND height difference is small
            if (distSquared2D < radiusDegSquared && heightDiff < 15) {'''
    
    content = content.replace(old_3d_dist, new_3d_dist)
    
    # FIX 3: Aggressive performance - reduce update frequency even more
    print("✓ Boosting performance...")
    
    old_batch = '''function batchUpdateVoxels() {
  if (updateBatchTimeout) return;
  updateBatchTimeout = setTimeout(() => {
    updateVoxelColors();
    updateBatchTimeout = null;
  }, 16); // ~60fps
}'''
    
    new_batch = '''function batchUpdateVoxels() {
  if (updateBatchTimeout) return;
  updateBatchTimeout = setTimeout(() => {
    updateVoxelColors();
    updateBatchTimeout = null;
  }, 100); // Update every 100ms instead of 16ms for better performance
}'''
    
    content = content.replace(old_batch, new_batch)
    
    # FIX 4: Reduce spatial index search area
    print("✓ Optimizing spatial search...")
    
    old_grid = 'const gridRadius = Math.ceil(radiusDeg / GRID_SIZE) + 1;'
    new_grid = 'const gridRadius = Math.ceil(radiusDeg / GRID_SIZE); // Removed +1 to search less area'
    
    content = content.replace(old_grid, new_grid)
    
    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(content)
    
    print("\n✅ EMERGENCY FIXES APPLIED!")
    print("\nFixed issues:")
    print("  1. Submit popup now uses custom styled alert")
    print("  2. 3D distance properly checks height (no stacking)")
    print("  3. Performance boosted (100ms batch updates)")
    print("  4. Reduced spatial search area")

if __name__ == '__main__':
    import sys
    if len(sys.argv) != 2:
        print("Usage: python3 emergency_fix.py index_file.html")
        sys.exit(1)
    
    apply_emergency_fixes(sys.argv[1])
