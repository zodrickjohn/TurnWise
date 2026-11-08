# Turnwise

Learn to solve your own Rubik's cube with the 8-step beginner's method. Paint in your cube's colors, then follow an animated 3D walkthrough that explains what to look for and why each algorithm works.

## Run

```bash
npm install
npm run dev     # http://localhost:5173
npm run check   # solver self-check: solves random scrambles, rejects impossible cubes
npm run build
```

## Layout

- `src/cube/model.ts`: facelet model (54 stickers, URFDLB), move permutations generated from 3D geometry
- `src/cube/solver.ts`: 8-step beginner solver plus the teaching copy. Each step is a short search over that step's beginner algorithms only, so solutions use moves a beginner actually learns
- `src/cube/Cube3D.ts`: three.js cube that renders a state and animates moves
- `src/views/`: Home (live demo), Learn (notation), Input (paint the net), Solve (guided walkthrough)

## The 8 steps

Daisy → White cross → White corners → Middle layer → Yellow cross → Yellow edges → Place yellow corners → Twist yellow corners
