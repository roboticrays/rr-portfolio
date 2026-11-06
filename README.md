# Robotic Rays — The Scan Collection

A static showroom for three scanned objects and seven proposed future directions. No build step or package installation is needed to view it. GitHub Pages deployment files are prepared for `portfolio.roboticrays.com`; publishing and domain setup are described in [DEPLOYMENT.md](DEPLOYMENT.md).

## Preview

From this directory, run:

```bash
python scripts/preview.py
```

Open http://127.0.0.1:4173 in a browser. The local server supports byte ranges for video seeking. Fonts, the 3D viewer library, wireframes and media are served locally.

## Project contents

- `index.html`: page structure and shared object viewer.
- `assets/`: styling, catalogue, interactions, local fonts and viewer library. Third-party licence files are retained.
- `media/images/`: gallery covers, original object photographs, video posters and the textured shoe orbit views used by the hero.
- `media/video/`: the three optimized rendered showroom videos.
- `media/models/`: the three small interactive wireframes and their preparation report.
- `media/logos/`: the logo used by the page.
- `scripts/`: the preview server and optional tools for preparing future captures.

The initial capture folders, full OBJ/GLB exports, textures, loose render frames, original video inputs, unused images, duplicate logos, old demo models and obsolete prototype scripts have been removed. All prepared files required by the finished site remain in this project. The website does not need the original source data.

## Presentation

The collection has Image, 3D wireframe and Rendered video views, category filters, previous/next navigation, fullscreen and copyable object links. Image views use the actual capture photographs. Gallery covers and videos show the rendered reconstructions.

Interactive viewers currently serve lightweight line-only wireframes with the capture floor removed. The complete box is also removed from the shoe. Each viewer has a small wrench icon and “In progress” badge; its hover text explains that the full 3D model will follow. The supplied footwear model shows a different shoe from its photograph and rendered video, as noted in the viewer.

Bags has an enabled filter with an upcoming-pilot empty state. Future collection cards are clearly marked as planned. The page includes responsive layouts, readable text, keyboard controls, reduced-motion support and on-demand video/3D loading.

## RGB to wireframe hero

The hero converts matching textured RGB renders into the shoe wireframe from left to right, with a scanning strip and very slow rotation. Its label reads “RGB → Reconstruction → Model”. The RGB views were rendered offline from the detailed source mesh and original 8192px texture. Only compact WebP views and the tiny wireframe are served to visitors.

Pause/play freezes and resumes the motion. Animation stops off screen, when the document is hidden and while an object viewer is open. Reduced-motion preferences show a static RGB/wireframe comparison. A matching RGB poster remains available if canvas or asset loading is unavailable.

## Add or replace objects

Keep master captures and working exports outside the web project. Put prepared web assets in `media/` and edit `assets/catalogue.js`. Each object specifies its ID, number, title, category, tags, description and paths for:

- `photo`: photograph of the physical object.
- `cover`: gallery preview still.
- `full`: rendered video poster.
- `video`: optimized rendered video.
- `model`: interactive GLB.

Counts and category filters are calculated from the catalogue. A future full GLB can replace an item's `model` path; update the shared wireframe tab labels, preview badge and viewer descriptions when switching the presentation to finished models.

The optional preparation tools are retained for future work:

- `scripts/prepare-media.py`: FFmpeg video compression and still extraction.
- `scripts/prepare-wireframes.py`: floor removal, simplification and line-only GLB creation (NumPy, SciPy and fast-simplification).
- `scripts/prepare-shoe-hero.py`: matching textured RGB orbit views and shoe wireframe creation (the above dependencies, Pillow and Numba).

These tools require fresh source files at the input paths documented in their code, or adjusted paths to external working folders. They cannot regenerate the old captures after removal of their source data. Shoe-specific crop coordinates must be checked if the shoe scan is replaced. `media/models/wireframe-report.json` retains historical preparation measurements and source filenames.
