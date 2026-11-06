"""Derive small, untextured line-only GLBs from the supplied OBJ scan exports.

Requires numpy and fast-simplification. Original exports are read-only inputs.
The dominant capture floor is removed; topology is simplified for presentation.
"""
import json
import re
import struct
import sys
from pathlib import Path

import numpy as np
from scipy.sparse import coo_matrix
from scipy.sparse.csgraph import connected_components
from scipy.spatial import ConvexHull
try:
    import fast_simplification
except ImportError:
    sys.path.insert(0, '/tmp/rr-mesh-tools')
    import fast_simplification

ROOT = Path(__file__).resolve().parents[1]
DEST = ROOT / 'media' / 'models'
DEST.mkdir(parents=True, exist_ok=True)

def read_obj(path):
    with path.open() as stream:
        header = ''.join(stream.readline() for _ in range(7))
    counts = re.search(r'(\d+) vertices, (\d+) faces', header)
    if not counts:
        raise ValueError(f'Expected RealityScan OBJ counts in {path}')
    points = np.empty((int(counts[1]), 3), dtype=np.float64)
    faces = np.empty((int(counts[2]), 3), dtype=np.int32)
    v = f = 0
    with path.open() as stream:
        for line in stream:
            if line.startswith('v '):
                points[v] = [float(x) for x in line.split()[1:4]]
                v += 1
            elif line.startswith('f '):
                parts = line.split()[1:]
                if len(parts) != 3:
                    raise ValueError('Expected triangulated OBJ')
                faces[f] = [int(x.split('/')[0])-1 for x in parts]
                f += 1
    return points[:v], faces[:f]

def remove_floor(points, faces):
    # OBJ exports are Z-up. Fit the broad horizontal support plane robustly.
    rng = np.random.default_rng(42)
    sample = points[rng.choice(len(points), min(24000, len(points)), replace=False)]
    floor_candidates = sample[sample[:, 2] < np.quantile(sample[:, 2], .4)]
    best = None
    for _ in range(180):
        a, b, c = floor_candidates[rng.choice(len(floor_candidates), 3, replace=False)]
        normal = np.cross(b-a, c-a)
        norm = np.linalg.norm(normal)
        if norm < 1e-8:
            continue
        normal /= norm
        if normal[2] < 0:
            normal *= -1
        if normal[2] < .92:
            continue
        offset = -np.dot(normal, a)
        distances = floor_candidates @ normal + offset
        score = np.count_nonzero(np.abs(distances) < .16)
        if best is None or score > best[0]:
            best = (score, normal, offset)
    if best is None:
        raise ValueError('Could not identify the capture floor')
    _, normal, offset = best
    d = points @ normal + offset
    cutoff = .35
    keep = (d[faces] > cutoff).all(axis=1)
    faces = faces[keep]
    # Compact indices before simplification, discarding unused floor vertices.
    used, inverse = np.unique(faces, return_inverse=True)
    return points[used], inverse.reshape(-1, 3).astype(np.int32), normal, offset, cutoff

def crop_shoe_support(points, faces, return_face_indices=False):
    """Remove the entire box using its inspected, slightly tilted top plane.

    The clearance removes noisy deck points too. These coordinates apply only
    to this supplied scan; recheck them when replacing the source OBJ.
    """
    normal = np.array([.0463706739, -.00070423192, .998924053])
    above_deck = points @ normal - 6.878881496 > .14
    upper = points[points[:, 2] > 7.8, :2]
    hull = ConvexHull(upper)
    candidates = np.flatnonzero(above_deck)
    inside = np.ones(len(candidates), dtype=bool)
    for a, b, c in hull.equations:
        inside &= points[candidates, 0] * a + points[candidates, 1] * b + c <= .25
    keep = np.zeros(len(points), dtype=bool)
    keep[candidates[inside]] = True
    source_face_indices = np.flatnonzero(keep[faces].all(axis=1))
    faces = faces[source_face_indices]
    edges = np.vstack((faces[:, [0, 1]], faces[:, [1, 2]], faces[:, [2, 0]]))
    graph = coo_matrix((np.ones(len(edges)), (edges[:, 0], edges[:, 1])), shape=(len(points), len(points)))
    _, labels = connected_components(graph, directed=False)
    largest = np.argmax(np.bincount(labels[faces[:, 0]]))
    component_faces = labels[faces[:, 0]] == largest
    source_face_indices = source_face_indices[component_faces]
    faces = faces[component_faces]
    used, inverse = np.unique(faces, return_inverse=True)
    result = (points[used], inverse.reshape(-1, 3).astype(np.int32))
    return (*result, source_face_indices) if return_face_indices else result

def display_points(points, reference=None):
    reference = points if reference is None else reference
    mean = reference[:, :2].mean(axis=0)
    xy = reference[:, :2] - mean
    _, basis = np.linalg.eigh(xy.T @ xy)
    long_axis = basis[:, -1]
    side_axis = np.array([-long_axis[1], long_axis[0]])
    def align(p):
        xy = p[:, :2] - mean
        return np.column_stack((xy @ long_axis, p[:, 2], -xy @ side_axis))
    ref = align(reference)
    center = (ref.max(axis=0) + ref.min(axis=0)) / 2
    scale = 2.5 / np.ptp(ref, axis=0).max()
    result = (align(points) - center) * scale
    result[:, 1] -= (ref[:, 1].min() - center[1]) * scale
    return result.astype('<f4')

def line_glb(points, faces, name, reference=None):
    # Remove tiny detached reconstruction fragments without joining components.
    edge_list = np.vstack([faces[:, [0, 1]], faces[:, [1, 2]], faces[:, [2, 0]]])
    graph = coo_matrix((np.ones(len(edge_list)), (edge_list[:, 0], edge_list[:, 1])), shape=(len(points), len(points)))
    _, labels = connected_components(graph, directed=False)
    counts = np.bincount(labels[faces[:, 0]])
    faces = faces[counts[labels[faces[:, 0]]] >= 12]
    used, inverse = np.unique(faces, return_inverse=True)
    points, faces = points[used], inverse.reshape(-1, 3)
    points = display_points(points, reference)
    edges = np.vstack([faces[:, [0, 1]], faces[:, [1, 2]], faces[:, [2, 0]]])
    edges = np.unique(np.sort(edges, axis=1), axis=0).astype('<u2')
    position_data = points.tobytes()
    index_data = edges.tobytes()
    data = position_data + index_data
    data += b'\0' * (-len(data) % 4)
    doc = {
        'asset': {'version': '2.0', 'generator': 'Robotic Rays / OBJ-derived simplified wireframe'},
        'scene': 0, 'scenes': [{'nodes': [0]}], 'nodes': [{'mesh': 0, 'name': name}],
        'meshes': [{'primitives': [{'attributes': {'POSITION': 0}, 'indices': 1, 'material': 0, 'mode': 1}]}],
        'materials': [{'name': 'Graphite wire', 'pbrMetallicRoughness': {'baseColorFactor': [.12, .22, .18, 1], 'metallicFactor': 0, 'roughnessFactor': 1}, 'extensions': {'KHR_materials_unlit': {}}}],
        'extensionsUsed': ['KHR_materials_unlit'],
        'buffers': [{'byteLength': len(data)}],
        'bufferViews': [{'buffer': 0, 'byteOffset': 0, 'byteLength': len(position_data), 'target': 34962}, {'buffer': 0, 'byteOffset': len(position_data), 'byteLength': len(index_data), 'target': 34963}],
        'accessors': [{'bufferView': 0, 'componentType': 5126, 'count': len(points), 'type': 'VEC3', 'min': points.min(axis=0).tolist(), 'max': points.max(axis=0).tolist()}, {'bufferView': 1, 'componentType': 5123, 'count': edges.size, 'type': 'SCALAR'}]
    }
    raw = json.dumps(doc, separators=(',', ':')).encode()
    raw += b' ' * (-len(raw) % 4)
    glb = struct.pack('<III', 0x46546C67, 2, 12+8+len(raw)+8+len(data)) + struct.pack('<II', len(raw), 0x4E4F534A) + raw + struct.pack('<II', len(data), 0x004E4942) + data
    out = DEST / f'{name}-wireframe.glb'
    out.write_bytes(glb)
    return {'file': str(out.relative_to(ROOT)), 'vertices': len(points), 'simplified_triangles': len(faces), 'line_segments': len(edges), 'bytes': len(glb)}

def main():
    report = []
    for name, source_folder, target in [('shoe', 'shoe', 2400), ('ball', 'ball', 1200), ('wooden-toy', 'wooden_toy', 3200)]:
        if len(sys.argv) > 1 and name not in sys.argv[1:]:
            continue
        source = ROOT / '3d_models' / source_folder / 'exported' / 'model.obj'
        print(f'Reading {name} OBJ...', flush=True)
        points, faces = read_obj(source)
        source_triangles = len(faces)
        points, faces, normal, offset, cutoff = remove_floor(points, faces)
        if name == 'shoe':
            points, faces = crop_shoe_support(points, faces)
        print(f'{name}: {source_triangles:,} source triangles; {len(faces):,} object triangles; simplifying...', flush=True)
        reference = points if name == 'shoe' else None
        points, faces = fast_simplification.simplify(points, faces, target_count=target, agg=7)
        result = line_glb(points, faces, name, reference=reference)
        result.update(source=str(source.relative_to(ROOT)), source_triangles=source_triangles, floor_plane=[*normal.tolist(), float(offset)], floor_clearance=cutoff)
        if name == 'shoe':
            result['support_crop'] = {'deck_plane': [.0463706739, -.00070423192, .998924053, -6.878881496], 'deck_clearance': .14, 'footprint_margin': .25, 'note': 'Complete box and capture floor removed.'}
        report.append(result)
        print(json.dumps(result), flush=True)
    if report:
        report_path = DEST / 'wireframe-report.json'
        previous = json.loads(report_path.read_text()) if report_path.exists() else []
        previous = [x for x in previous if x['file'] not in {x['file'] for x in report}]
        report_path.write_text(json.dumps(previous+report, indent=2)+'\n')


if __name__ == "__main__":
    main()
