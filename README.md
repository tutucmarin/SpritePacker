# SpritePacker

SpritePacker is a browser-only sprite sheet slicer built with Next.js. Drop in a sheet (or multiple images), auto-detect sprites, tweak boxes, repack to a new atlas, and export individual sprites or an atlas+JSON without sending assets to a server.

## Features

- Auto-detect sprites via alpha / color-key / adaptive background detection
- Repacking with spacing, fixed-size atlases, and multiple packing heuristics
- Export to PNG/JPEG/WebP sprites or atlas bundles with common JSON formats (Pixi/Phaser/etc.)
- Light/Dark theme toggle and configurable checkerboard backgrounds
- 100% client-side; no uploads are persisted

## Planned Improvements

The following enhancements are planned to make SpritePacker more powerful, reliable, and user-friendly:

1. **Increase Test Coverage**
   - Add unit tests for core image processing, detection, and packing logic
   - Introduce integration tests for end-to-end workflows
   - Establish automated CI testing to ensure long-term stability

2. **Support Additional Export Formats**
   - Implement multiple atlas schemas (Unity, Godot, Cocos, Spine, etc.)

3. **Expand and Improve Documentation**
   - Create detailed user guides and tutorials

4. **Enhance Packing Algorithms**
   - Implement additional packing strategies (MaxRects, Guillotine, Shelf, etc.)
   - Improve efficiency and atlas space utilization

5. **“Detect Identical Sprites” Feature**
   - Identify duplicate or visually identical images
   - Automatically merge them to reduce atlas size

6. **Localization Support**
   - Add multi-language interface support

## Quick Start

1. Ensure Node 20+ is installed.
2. Install dependencies:
   ```bash
   npm install
   ```
3. Run the app locally:
   ```bash
   npm run dev
   ```
   The app will be available at http://localhost:3000.
4. Build for production:
   ```bash
   npm run build
   npm start
   ```

## License

MIT License. See [LICENSE](LICENSE) for details.
