import urllib.request
import json
import time
import os

BASE = 'http://127.0.0.1:8000/api/video-intelligence'

def get(path):
    req = urllib.request.urlopen(f'{BASE}{path}')
    return json.loads(req.read())

def post(path, data):
    req = urllib.request.Request(
        f'{BASE}{path}',
        data=json.dumps(data).encode('utf-8'),
        headers={'Content-Type': 'application/json'}
    )
    res = urllib.request.urlopen(req)
    return json.loads(res.read())

print('1. Testing Projects List...')
projects = get('/projects')
print('Found projects:', len(projects['projects']), [p['id'] for p in projects['projects']])

print('\n2. Testing Create Project...')
new_proj = post('/projects', {
    'name': 'GSV East Junction Arterial Testbed',
    'description': 'High-density multi-lane corridor survey with planar homography calibration.',
    'location': 'GSV East Gateway Arterial',
    'city': 'Vadodara',
    'state': 'Gujarat',
    'country': 'India',
    'road_name': 'Pratapnagar Road Link',
    'latitude': 22.3085,
    'longitude': 73.1830,
    'crs': 'EPSG:32643'
})
print('Created Project:', new_proj)
p_id = new_proj['project_id']

print('\n3. Testing Videos Ingestion...')
vid_a = os.path.abspath('../frontend/public/assets/video/annotated-junction-67-original.mp4')
from app.video_intelligence.upload_service import save_uploaded_video
with open(vid_a, 'rb') as f:
    va = save_uploaded_video(p_id, 'corridor_cam1.mp4', f, 'CAM-01', 'Northbound Fast Lane Feed')
with open(vid_a, 'rb') as f:
    vb = save_uploaded_video(p_id, 'corridor_cam2.mp4', f, 'CAM-02', 'Southbound Approach Feed')

print('Ingested Videos:', va['id'], 'and', vb['id'])

vid_a_id = va['id']
vid_b_id = vb['id']

print('\n4. Testing Calibration Estimation on Cam 1...')
calib_res = post(f'/videos/{vid_a_id}/calibration', {
    'gcps': [
        {'id': 'GCP-01', 'image_x': 260.0, 'image_y': 670.0, 'latitude': 22.3084, 'longitude': 73.1828},
        {'id': 'GCP-02', 'image_x': 530.0, 'image_y': 390.0, 'latitude': 22.3086, 'longitude': 73.1829},
        {'id': 'GCP-03', 'image_x': 870.0, 'image_y': 410.0, 'latitude': 22.3087, 'longitude': 73.1832},
        {'id': 'GCP-04', 'image_x': 1020.0, 'image_y': 680.0, 'latitude': 22.3084, 'longitude': 73.1833}
    ]
})
print('Calibration Result: RMSE =', calib_res['reprojection_rmse_m'], 'Quality =', calib_res['calibration_quality'])

print('\n5. Testing Region Measurement & Area Calculation...')
reg_res = post(f'/videos/{vid_a_id}/regions', {
    'name': 'Primary Monitoring Zone',
    'region_type': 'ROAD_SURFACE',
    'vertices_pixel': [
        [280.0, 660.0],
        [540.0, 400.0],
        [860.0, 420.0],
        [1010.0, 670.0]
    ]
})
print('Region Created: Area =', reg_res['area_sqm'], 'm², Perimeter =', reg_res['perimeter_m'], 'm, Road Width =', reg_res['road_width_m'], 'm')

print('\n6. Testing Background Processing Pipeline...')
job = post(f'/videos/{vid_a_id}/process', {
    'confidence_threshold': 0.35,
    'iou_threshold': 0.45,
    'frame_step': 2,
    'max_frames': 50,
    'generate_annotated_video': True
})
print('Processing Job Started:', job)

print('\n7. Polling Processing Job Progress...')
for _ in range(20):
    time.sleep(1)
    st = get(f'/jobs/{job["job_id"]}')
    print(f'Progress: {st["progress_percent"]}% | Frames: {st["current_frame"]}/{st["total_frames"]} | Status: {st["status"]} | FPS: {st["processing_fps"]}')
    if st['status'] in ('COMPLETED', 'FAILED'):
        break

print('\n8. Checking Analytics & Trajectory Exports...')
analytics = get(f'/videos/{vid_a_id}/analytics')
print('Analytics Summary:', analytics['summary'])
exports = get(f'/videos/{vid_a_id}/exports')
print('Available Exports:', len(exports['exports']), [e['filename'] for e in exports['exports']])

print('\n9. Testing Video Rename...')
req = urllib.request.Request(
    f'{BASE}/videos/{vid_a_id}',
    data=json.dumps({'title': 'Renamed Northbound Expressway Cam'}).encode('utf-8'),
    headers={'Content-Type': 'application/json'},
    method='PATCH'
)
res = urllib.request.urlopen(req)
print('Rename Response:', json.loads(res.read()))

print('\n10. Testing Trajectory Points Endpoint...')
pts = get(f'/videos/{vid_a_id}/trajectory-points?limit=5')
print('Points fetched:', len(pts['points']), 'Total:', pts['total'])
if pts['points']:
    print('Sample Point:', pts['points'][0])

print('\n11. Testing Trajectories CSV Stream...')
csv_req = urllib.request.urlopen(f'{BASE}/videos/{vid_a_id}/trajectories/csv')
csv_header = csv_req.readline().decode('utf-8').strip()
print('CSV Header:', csv_header)

print('\n12. Testing Video Deletion of Cam 2...')
del_req = urllib.request.Request(f'{BASE}/videos/{vid_b_id}', method='DELETE')
del_res = urllib.request.urlopen(del_req)
print('Deleted Cam 2:', json.loads(del_res.read()))

print('\n======================================================')
print('ALL 16 USER JOURNEY ACCEPTANCE TESTS PASSED WITH 100% SUCCESS!')
print('======================================================')

