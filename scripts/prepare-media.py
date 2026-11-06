"""Reproduce the showroom assets from the user's original videos (FFmpeg required)."""
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
ITEMS = [
    ('shoe', 'media/video/shoe-reconstruction.mp4'),
    ('ball', 'media/video/ball-reconstruction.mp4'),
    ('wooden-toy', 'rendered_imgs_1/woodentoy_rendering.mp4'),
]

def ffmpeg(*args):
    subprocess.run(['ffmpeg', '-y', '-hide_banner', '-loglevel', 'error', *args], cwd=ROOT, check=True)

for name, source in ITEMS:
    for suffix, filters in [
        ('reconstruction-full', r'select=eq(n\,200),scale=1920:-1'),
        ('cover', r'select=eq(n\,200),format=rgb24,drawbox=x=0:y=0:w=960:h=540:color=white:t=fill,crop=2880:2160:200:0,scale=1440:1080'),
        ('reference', r'select=eq(n\,0),crop=960:540:0:0'),
    ]:
        ffmpeg('-i', source, '-vf', filters, '-frames:v', '1', '-q:v', '2', f'media/images/{name}-{suffix}.jpg')
    ffmpeg('-i', source, '-c:v', 'libx264', '-crf', '20', '-maxrate', '10M', '-bufsize', '20M', '-preset', 'slow', '-threads', '3', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', '-an', f'media/video/{name}-showroom.mp4')
    print(f'Prepared {name}', flush=True)
