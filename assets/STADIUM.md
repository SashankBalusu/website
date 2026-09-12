# SoFi miniature

The homepage scene is an original, procedural Three.js model. Its exterior uses
[HKS's SoFi Stadium photographs](https://www.hksinc.com/what-we-do/projects/sofi-stadium/)
and the user-provided [CGTrader model gallery](https://www.cgtrader.com/3d-models/exterior/stadium/sofi-stadium)
as visual references, with actual HKS photographs taking precedence over the
third-party model. The shell proportions also use the architect-supplied
[HKS roof plan](https://www.archdaily.com/980581/sofi-stadium-hks/62613a513e4b31197700004b-sofi-stadium-hks-roof-diagram)
and [shell diagram](https://www.archdaily.com/980581/sofi-stadium-hks/62613a4a3e4b31e97700001d-sofi-stadium-hks-shell-diagram).
The main oval's displayed width/length ratio is approximately 0.777, close to
the 770-by-980-foot cable roof described by [structural engineer sbp](https://www.sbp.de/en/project/sofi-stadium/).
These references establish proportions, not surveyed coordinates.
The canopy uses long, gently tapered side sweeps, eased tips,
and a narrow curved perimeter. A broad shield-shaped glazed field covers the
stadium and plaza; an independent oval band sits within it. The glazed field
ends at a curved seam shared with the solid theater tail, which joins the outer
rim rather than floating inside a glass border. The rear sweeps progressively
sideways from the widest station along a quadratic centerline. Its transverse
sections stay parallel and retain their width, giving a long diagonal edge and
a nearly straight opposite side. Rotating those sections at this larger offset
would pinch the roof into a hook. The point sits beside the oval, about 1.35 oval
radii off-center, rather than tapering toward its middle. The two front corners
stay fixed when the tail is edited. This sweep is an adjustable interpretation
of the reference, not a surveyed measurement. Elevation is separate from the
outline in plan: the edge rises gradually from the tail, holds a broad nearly
level span, and curls down close to the prongs instead of making the entire
facade an arch. The short-end elevation is deliberately asymmetric: viewed
head-on with the current site preset, the left wing projects outward and follows
one shallow continuous curve into an offset crest, while the right side stays higher before
returning down. The shorter corner narrows toward the entrance in plan; the long
wing retains its outward reach. A thinner rim and a shorter front apron make
the canopy read as a continuous sheet. The front elevation uses one asymmetric
arch with a continuous change in curvature. This removes the abrupt change in
bending where the former straight ramp met an elliptical shoulder.
The film uses a broader roll at the wing
and broad solid apron panels at the corners. The adjustable short return can pass vertical
and narrow inward at its waist, then open outward again toward its footing.
This optional S-shaped return follows the flare visible in the HKS shell photograph.
The current site preset uses Inward curl = 0 and Shoulder curve = 1.4, as selected
in the editor; the short end descends directly without that undercut.
The deformation blends smoothly into the upper sheet, and denser roof, fascia
and lighting meshes preserve the curve between vertices. The front rim stays in one plane in plan, without a projecting central
ledge. Both low tips share the same landing height and depth; the return folds
sideways beneath the roof, not backward behind the other tip. Corner easing is
corrected locally so different slopes do not lift one tip higher than the other.
This is a stylized interpretation of
the supplied elevation reference, not a surveyed reconstruction.
Round, tapered columns have foundation collars and flared capitals. They meet a
continuous compression beam, shallow perimeter truss and connected roof ribs.
Paired structural chords and diagonal webs sit beneath the ETFE panels. The
aluminum skin has fine triangular panel joints and a filtered perforation map;
its satin finish reflects a small, procedurally generated HDR sky. This lighting
environment is invisible, keeping the background transparent. Fine fascia
joints and a darker folded edge make the canopy legible from low viewpoints.
The separate tapered theater has vertical fins, recessed doors, warm soffit
lights and stair handrails. Subtle paving joints give the compact foundation
scale without introducing a surrounding landscape.
The front colonnade now shelters a curved glazed entrance with framed door bays,
a shallow lintel and a landing. Its smaller roof wordmark faces arriving visitors
and illuminates in cool white at night.

The interior supplies depth through the roof: three stepped seating tiers,
6,244 instanced blue seats, radial aisles, recessed club glazing, balcony ribbons
and open concourse decks with guardrails. The field remains at y = 0.06, above
the bowl floor and foundation. It has a correctly proportioned playing surface,
yard markings, hashes, Chargers end zones, a curved bolt and goalposts. The
dual-sided Infinity Screen has a physical open center and cables attached to
the edited canopy. This is supporting architectural detail, not a survey of the
real interior. The floor slab follows the canopy footprint, including its swept
tail, and supports the theater stairs. Its top remains at y = -0.01.
The lake, landscaped island, surrounding plaza and shoreline furniture remain
removed; there is no surrounding environment.
Brief, branching blue-white electrical arcs surround it instead, with gold forks.
The site uses Burst frequency = 0.15, leaving about 4.3 seconds between bursts at
the existing speed of 0.45; the flare and fade speed stays unchanged. Proportions and support
count are stylized; no third-party stadium mesh or photograph is included.

- `stadium.js` builds the exterior architecture, lighting and camera controls.
- `stadium-framing.js` centers the projected building outline beside the text,
  enlarging the homepage view by up to 28% while preserving edge clearance.
  Poster exports share this framing; the editor keeps its working camera.
- `stadium-interior.js` builds the batched seating, concourses, field and screen.
  It is independent of the DOM and has a bounded geometry budget.
- `stadium-textures.js` generates the cladding, ETFE frit, paving, pitch, screen
  artwork and reflection environment. No downloaded textures are required.
- `stadium-lighting.js` adds steady nighttime fixtures: a cyan fascia edge and
  oval frame, soft blue roof spill and column-foot pools, amber concourse ribbons,
  and warm theater and entrance soffits. Four unshadowed point lights illuminate
  the actual bowl, facades and plaza from within the model's coordinate system.
  The fixture group is hidden in daylight. Surface halos are subdivided across
  their width so they follow the curved front instead of cutting through it.
  There is no bloom pass, extra shadow map, animation or idle render loop.
- `stadium-floor.js` derives the compact slab outline from the canopy, interior
  and theater stairs. Width and tail edits rebuild it, but canopy-height edits
  do not raise it. It adds one shadow-receiving mesh with a small generated paving texture.
- `stadium-lightning.js` batches 12 irregular discharge paths into one draw call
  (2,232 vertices). Each has a thin trunk and three tapered forks, stretched 60%
  around its midpoint for longer reach without thicker lines or added geometry,
  then revealed and faded by a small shader. No icons, textures, postprocessing, extra lights,
  spawning timers or per-frame geometry uploads. One arc flares at a time;
  defaults give an approximately 0.84-second burst every 3.07 seconds of active
  playback. Even at maximum speed/frequency there is a quiet gap between bursts.
  Normal alpha blending keeps the blue/gold halo visible on both page themes;
  depth testing lets the building occlude arcs behind it. Controls update in
  place; geometry edits do not reset the clock. Effect resources are disposed
  with the scene.
- `stadium-roof.js` defines a shared material-coordinate sheet, connected regions,
  and panel-grid clipping. A bounded smooth loft blends the front and adjoining
  side together; the rear follows the offset plan. `deform()` folds the low
  return in 3D, allowing an actual undercut that a height field alone cannot make.
  Clip/fill using the original coordinates, then apply the same deformation to
  the film, rim, seams, oval, grid, wordmarks, and attached structure. Do not use
  the folded X/Z projection to look up a height: two parts can overlap in plan.
  `surfaceNormal()` uses full 3D tangents and can point down beneath the curl;
  material thickness and surface details are offset along that normal.
  Film and tail meshes share seam vertices. Glazing stops at the seam, including
  underneath the solid tail. Rear supports, the theater, and its entrances follow
  the same bend. The lateral shear has an exact inverse, keeping height queries
  and panel lines on the curved roof throughout the wider control range.
- `stadium.css` keeps the homepage stadium in the same grid row as the introduction
  and work history on desktop and hides it at widths up to 1050px. The intro is plain text, without
  model triggers. The editor retains its own responsive layout and controls.
- `stadium-loader.js` mounts the scene once when the desktop figure becomes
  visible and handles load failures. Mobile visits do not import the renderer
  or create a WebGL scene. Resizing to desktop loads it; resizing back hides it
  and the renderer's visibility observer suspends drawing. Editor preview links
  use the saved draft through the same desktop-only homepage presentation.
- `site-header.css` supplies the same responsive navigation styles on Home and
  Pictures, reserving scrollbar space so links stay aligned between pages.
- `theme.js` shares the saved page theme across both pages and the editor,
  including the stadium's day/night lighting.
- `sofi-poster.png` and `sofi-poster-night.png` are matching transparent renders
  used while loading or without WebGL; CSS selects the current page theme.
- `vendor/three/` contains Three.js 0.180.0 and OrbitControls under the included
  MIT license. These are served locally; no runtime CDN or build step is needed.

Drag horizontally to rotate on touchscreens; vertical swipes continue scrolling
the page. Desktop dragging also tilts the view. The editor provides zoom and reset buttons.
On the homepage, focus the canvas to use arrow keys, +/- to zoom, Home to reset,
or P to pause and resume lightning.
The homepage model is always visible on desktop and hidden on mobile.
Without JavaScript or WebGL, the matching day/night poster remains visible.
The pause button holds lightning still without disabling camera interaction.
Reduced motion always freezes the effect; the pause button cannot override
that preference. Initial reduced-motion views show one still arc. There are no
full-scene flashes, rapid strobing or click-triggered discharges.

The scene respects reduced motion, pauses when hidden or offscreen, caps pixel
density, instances columns, batches arcs and caches shadows. Idle effect
rendering is capped at 30fps. Paused/hidden/zero-speed/zero-amount effects do not
schedule idle frames; camera changes still render on demand.
A lost WebGL context shows the poster and can recover without reloading. The
reflection environment is regenerated on recovery because its GPU render target
loses its contents with the context. Poster exports use a fixed lightning phase,
restore the live view afterwards, and share the responsive camera framing. Serve the repository with
any static HTTP server to preview it; opening `index.html` as a file URL will not
load ES modules.

## Tuning the miniature

Open `/stadium-editor.html` on the same static server as the website (for example,
`http://localhost:8080/stadium-editor.html`). No install, backend, or build is
required. It uses the same renderer as the homepage, with native browser controls.

1. Open Shape, Supports, Materials, Texture, Lighting or Lightning and adjust the controls.
   Shape updates keep the camera in place and rebuild the attached supports.
   Colors and finishes update without rebuilding geometry. The parameter ranges
   are intentionally bounded for small edits, not unrestricted sculpting.
   Canopy width spans 0.84–1.10; the roof and its attached supports scale together.
   Side sweep controls the outer taper. Tail sweep spans −6.8 to +6.8 and carries
   the rear toward either side without moving the front corners; zero centers
   its point. Its existing JSON key, `tailOffset`, is retained so presets still
   load and the saved tip displacement stays the same. The default is −6.5;
   the site's mirrored orientation uses +6.5.
   Front sweep extends the front wing outward, independently of the
   tail. Positive values sweep the right wing (when facing the front), negative
   values swap sides, and 0 restores even sides. The JSON key `frontAsymmetry`
   is retained; older presets and drafts default to 1 without losing other values.
   Inward curl (`cornerReturn`) controls the S-shaped return: 0 disables it,
   1 is the default, and 1.2 is the strongest return. It follows the shorter side
   selected by Front sweep; at zero Front sweep, both ends curl evenly. The long
   wing and tail are not pulled inward. Old presets gain this control at 1.
   Glazed roof coverage changes the narrow perimeter independently of Oval width
   / length / border width. Glazing toward the tail moves the shared curved seam,
   with the solid tail always connected to the rim. The oval auto-fits inside
   the actual glazed outline when controls are combined at their extremes.
   Lightning controls burst frequency, flare/fade speed, glow and the two colors.
   Set frequency or glow to zero to remove the effect, or speed to zero to freeze
   the current phase. The JSON keys `lightningAmount` and `lightningSpeed` remain
   compatible with older presets. Pause is session-only, not baked into presets.
2. Use Front / Side / Top to inspect the result. Compare with site toggles the
   current site preset from the same camera angle without changing your draft.
   Undo/redo includes resets, imports, and loaded versions. Keyboard shortcuts
   are Cmd/Ctrl Z and Cmd/Ctrl Shift Z (outside text/number inputs).
3. Drafts autosave on this browser and origin. Versions & export can save named
   copies or import an exported JSON preset. Export files for durable backups;
   browser storage is not shared between devices or different localhost ports.
4. Preview on site opens `/?stadium-preview=1` with a snapshot of your draft from
   browser storage. The ordinary homepage does **not** read drafts. This special
   link is not a shareable preset and does not publish anything.
5. To publish, export the preset and replace `assets/stadium-preset.json` with
   that file. Download a poster in each theme from Versions & export and replace
   `assets/sofi-poster.png` and `assets/sofi-poster-night.png`. The download follows
   the selected day/night theme and restores the live view after capture.
   Deploy those files normally. The editor cannot
   silently write project files or deploy the website from the browser.

The editor is a separate, unlinked page with a `noindex` directive, **not** an
authenticated admin page. If deployed it is still accessible by URL, but has no
server write capability. Do not put secrets in presets or in the editor.

`stadium-settings.js` defines the shared defaults, control ranges, versioned JSON
format, and input validation. `stadium-preset.json` uses the revised shell plan:
0.87 canopy width, 1.08 oval width, a 6.5 lateral tail sweep, full side taper,
and a 0.15 rim thickness. The asymmetric wing remains; inward curl is disabled.
The architectural finish and lighting use pale satin
aluminum, softer ETFE contrast, printed frit, and stronger grounding shadows.
Daylight uses warm direct light and a cool sky reflection; night has a cyan
roof outline, blue facade uplighting, white bowl floodlighting, lit roof signs,
warm hospitality glazing and amber soffits. The site uses the quieter lightning
frequency described above. Legacy `grassColor` / `waterColor`
keys remain accepted and round-trip in JSON so existing exports do not break,
but their obsolete controls are hidden and cannot recreate the environment.
The original Downloads file is not modified. Version 1
presets and browser drafts remain compatible: missing new controls receive their
defaults. Stored numbers survive, but the old two-layer roof is not retained.
Load site preset in the editor to see the checked-in look if a different local
draft is restored. Missing or invalid site presets fall back to defaults.
Rebuilds dispose old GPU resources; WebGL
loss preserves exportable settings. Texture controls tune generated roof patterns
and material appearance, not arbitrary image maps.

Run tests with `node --test tests/stadium-*.test.js`.
Particle tests cover deterministic layout, bounded counts, a single instanced
geometry, in-place controls, disabling and resource disposal. Settings tests
cover legacy environment exports and hidden controls as well as new defaults.
The roof tests check shared seam and perimeter vertices, progressive sweep,
parallel cross-sections, exact inverse projection, reference proportions,
fixed front corners, non-overlapping
film and tail, the adjoining side sweep, asymmetric front returns, continuous wing
and shoulder curvature (including the visible rim underside),
coplanar front span, aligned tip heights/depths, containment,
independent controls, and grid clipping at individual and combined extremes.
Return tests require a recessed waist, an outward flare into the footing, and an outer
normal that passes below vertical; folded positions, normals and shared edges are
checked throughout the editor ranges.

The refinement checks also cover finite interior geometry, upward-facing seating
terraces, a genuinely open video-board center, field proportions, canopy/floor
containment and a bounded instancing budget. Run the complete miniature suite
with `node --test tests/*.test.js`.
Lighting tests check the draw/triangle/light budget and sample triangle interiors
over the roof to catch the clipping that caused jagged bright spikes at the front.
Framing tests check projected centering, edge clearance and repeatable resizing
without accumulated zoom or offsets.
