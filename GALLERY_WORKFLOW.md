# Gallery Workflow

1. Drop new original images into `images/originals/`.
2. Run:

   ```bash
   npm run ingest
   ```

3. Open `gallery-cms.html`.
4. Click images in the preview and tune city, size, movement, and crop.
5. Use the CMS config export to update `assets/galleryConfig.js` when the layout is final.

The ingest step is safe to run repeatedly. It preserves existing entries in
`assets/galleryConfig.js`, adds missing images to `imageOrder`, writes missing
default crop/layout settings, regenerates only stale thumbnails, and updates
`assets/imageMeta.json`.

To ingest from another folder without moving files first:

```bash
npm run ingest:from -- /path/to/folder
```
