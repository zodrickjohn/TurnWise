# Turnwise

Learn to solve your own Rubik's cube with the 8-step beginner's method. Scan your cube with the camera (or paint its colors), then follow an animated 3D walkthrough that explains what to look for and why each algorithm works. Progress is remembered across refreshes.

## Run

```bash
npm install
npm run dev     # http://localhost:5173
npm run check   # self-checks: solves random scrambles, rejects impossible cubes, color recognition
npm run build
```

## Layout

- `src/cube/model.ts`: facelet model (54 stickers, URFDLB), move permutations generated from 3D geometry
- `src/cube/solver.ts`: 8-step beginner solver plus the teaching copy. Each step is a short search over that step's beginner algorithms only, so solutions use moves a beginner actually learns
- `src/cube/Cube3D.ts`: three.js cube that renders a state and animates moves
- `src/cube/colors.ts`: sticker color recognition for camera scans (CIE Lab, calibrated by face centers)
- `src/views/`: Home (live demo), Learn (notation), Input (paint or scan your cube), Scanner (camera dialog), Solve (guided walkthrough)

## The 8 steps

Daisy → White cross → White corners → Middle layer → Yellow cross → Yellow edges → Place yellow corners → Twist yellow corners
