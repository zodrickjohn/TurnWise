# Turnwise

Learn to solve your own Rubik's cube with the 8-step beginner's method. Scan your cube with the camera (or paint its colors), then follow an animated 3D walkthrough that explains what to look for and why each algorithm works. Progress is remembered across refreshes.

- **Practice mode:** drill any of the 8 steps on a real cube state, with hints and a par move count.
- **Mistake detective:** if your cube stops matching the screen, scan it and Turnwise finds the slip or replans.
- **Dark mode:** with a cube-sticker transition when you switch.

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
- `src/views/`: Home (live demo), Learn (notation + quiz), Input (paint or scan, also used to check a cube mid-solve), Scanner (camera dialog), Solve (guided walkthrough + mistake recovery), Practice (step drills)

## The 8 steps

Daisy → White cross → White corners → Middle layer → Yellow cross → Yellow edges → Place yellow corners → Twist yellow corners
