"""Render the original textured scan into matching RGB orbit views.

The high-detail textured source is rendered offline; only compact WebP images
and the small, untextured wireframe are served to visitors. Requires numpy,
scipy, fast-simplification, Pillow and numba. Original inputs are read-only.
"""
import importlib.util
import hashlib
import json
import struct
import sys
from pathlib import Path
import numpy as np
from PIL import Image
from numba import njit

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('wireframes', ROOT/'scripts/prepare-wireframes.py')
w = importlib.util.module_from_spec(spec)
spec.loader.exec_module(w)
source = ROOT/'3d_models/shoe/exported/model.obj'
cache = Path('/tmp/rr-shoe-source.npz')
if cache.exists() and cache.stat().st_mtime >= source.stat().st_mtime:
    data = np.load(cache)
    points, faces = data['points'], data['faces']
else:
    points, faces = w.read_obj(source)
    np.savez(cache,points=points,faces=faces)
source_count = len(faces)
uv_cache = Path('/tmp/rr-shoe-uv.npz')
if uv_cache.exists() and uv_cache.stat().st_mtime >= source.stat().st_mtime:
    data = np.load(uv_cache)
    uv, uv_faces = data['uv'], data['faces']
else:
    # A triangle can reference a different UV at each corner across texture seams.
    uv = np.empty((source_count*3,2),dtype=np.float32)
    uv_faces = np.empty((source_count,3),dtype=np.int32)
    v = f = 0
    with source.open() as stream:
        for line in stream:
            if line.startswith('vt '):
                uv[v] = [float(x) for x in line.split()[1:3]]
                v += 1
            elif line.startswith('f '):
                uv_faces[f] = [int(x.split('/')[1])-1 for x in line.split()[1:]]
                f += 1
    uv = uv[:v].copy()
    np.savez(uv_cache,uv=uv,faces=uv_faces)
points, faces, source_faces = w.crop_shoe_support(points, faces, return_face_indices=True)
uv_faces = uv_faces[source_faces]
print('Textured shoe-only triangles:',len(faces),flush=True)
wp, wf = w.fast_simplification.simplify(points, faces, target_count=2400, agg=7)
report = w.line_glb(wp, wf, 'shoe', reference=points)
report.update(source=str(source.relative_to(ROOT)),source_triangles=source_count,
              support_crop={'deck_plane':[.0463706739,-.00070423192,.998924053,-6.878881496],
                            'deck_clearance':.14,'footprint_margin':.25,'note':'Complete box and capture floor removed; dominant shoe component retained.'})
report_path = ROOT/'media/models/wireframe-report.json'
previous = json.loads(report_path.read_text())
report_path.write_text(json.dumps([r for r in previous if r['file']!=report['file']]+[report],indent=2)+'\n')
raw = (ROOT/report['file']).read_bytes()
n = struct.unpack_from('<I',raw,12)[0]
doc = json.loads(raw[20:20+n])
a = doc['accessors'][0]
bv = doc['bufferViews'][a['bufferView']]
wire = np.frombuffer(raw, dtype='<f4', count=a['count']*3,offset=28+n+bv.get('byteOffset',0)).reshape(-1,3)
center = (np.array(a['min'])+a['max'])/2
rp = w.display_points(points, reference=points).astype(float)-center
wire = wire-center
texture = np.asarray(Image.open(source.parent/'model_u1_v1_diffuse.png').convert('RGB'))
out = ROOT/'media/images/shoe-orbit'
out.mkdir(exist_ok=True)

def project(p,yaw):
    cy,sy,cp,sp=np.cos(yaw),np.sin(yaw),np.cos(.30),np.sin(.30)
    x=p[:,0]*cy+p[:,2]*sy
    z=-p[:,0]*sy+p[:,2]*cy
    y=p[:,1]*cp-z*sp
    depth=p[:,1]*sp+z*cp
    return np.column_stack((x,-y))* (6/(6-depth))[:,None],depth

@njit(cache=True)
def rasterize(xy, reciprocal_depth, faces, uv, uv_faces, texture, width, height):
    """Depth-tested, perspective-correct, bilinear textured rasterizer."""
    pixels = np.zeros((height,width,4),dtype=np.uint8)
    depth = np.zeros((height,width),dtype=np.float64)
    th,tw,_ = texture.shape
    for i in range(len(faces)):
        a,b,c=faces[i]
        ax,ay=xy[a];bx,by=xy[b];cx,cy=xy[c]
        area=(by-cy)*(ax-cx)+(cx-bx)*(ay-cy)
        if abs(area)<1e-10:continue
        xmin=max(0,int(np.floor(min(ax,bx,cx))))
        xmax=min(width-1,int(np.ceil(max(ax,bx,cx))))
        ymin=max(0,int(np.floor(min(ay,by,cy))))
        ymax=min(height-1,int(np.ceil(max(ay,by,cy))))
        ua,ub,uc=uv_faces[i]
        qa,qb,qc=reciprocal_depth[a],reciprocal_depth[b],reciprocal_depth[c]
        for y in range(ymin,ymax+1):
            py=y+.5
            for x in range(xmin,xmax+1):
                px=x+.5
                wa=((by-cy)*(px-cx)+(cx-bx)*(py-cy))/area
                wb=((cy-ay)*(px-cx)+(ax-cx)*(py-cy))/area
                wc=1-wa-wb
                if wa < -1e-7 or wb < -1e-7 or wc < -1e-7:continue
                q=wa*qa+wb*qb+wc*qc
                if q<=depth[y,x]:continue
                u=(wa*qa*uv[ua,0]+wb*qb*uv[ub,0]+wc*qc*uv[uc,0])/q
                v=(wa*qa*uv[ua,1]+wb*qb*uv[ub,1]+wc*qc*uv[uc,1])/q
                tx=min(tw-1.,max(0.,u*(tw-1)))
                ty=min(th-1.,max(0.,(1-v)*(th-1)))
                ix,iy=int(tx),int(ty)
                jx,jy=min(ix+1,tw-1),min(iy+1,th-1)
                fx,fy=tx-ix,ty-iy
                for channel in range(3):
                    top=texture[iy,ix,channel]*(1-fx)+texture[iy,jx,channel]*fx
                    bottom=texture[jy,ix,channel]*(1-fx)+texture[jy,jx,channel]*fx
                    pixels[y,x,channel]=min(255.,max(0.,top*(1-fy)+bottom*fy))
                pixels[y,x,3]=255
                depth[y,x]=q
    return pixels

revision = hashlib.sha256(Path(__file__).read_bytes() + str(source.stat().st_mtime_ns).encode()).hexdigest()[:12]
manifest={'width':960,'height':720,'yawMin':-.62,'yawMax':.06,'frames':41,'files':[], 'revision':revision,
          'render':'Original full-detail mesh and 8192px diffuse texture, supersampled 2x'}
for i,yaw in enumerate(np.linspace(manifest['yawMin'],manifest['yawMax'],manifest['frames'])):
    filename=f'shoe-{i:02d}.webp'
    manifest['files'].append(filename)
    if '--sample' in sys.argv and i!=20:continue
    wire_xy,_=project(wire,yaw)
    lo,hi=wire_xy.min(axis=0),wire_xy.max(axis=0)
    scale=min(960*.8/(hi[0]-lo[0]),720*.64/(hi[1]-lo[1]))
    offset=np.array([480,720*.51])-(lo+hi)/2*scale
    xy,depth=project(rp,yaw)
    xy=np.ascontiguousarray((xy*scale+offset)*2)
    pixels=rasterize(xy,1/(6-depth),faces,uv,uv_faces,texture,1920,1440)
    image=Image.fromarray(pixels).resize((960,720),Image.Resampling.LANCZOS)
    image.save(out/filename,quality=94,method=6)
    if i%10==0:print('Rendered textured orbit frame',i,flush=True)
if '--sample' not in sys.argv:
    (out/'orbit.json').write_text(json.dumps(manifest,separators=(',',':'))+'\n')
print('Orbit bytes:',sum(p.stat().st_size for p in out.iterdir()),flush=True)
