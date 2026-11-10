// Pretty patterns made from a solved 3×3, easiest first
export const PATTERNS: { name: string; alg: string; note: string }[] = [
  { name: 'Checkerboard', alg: 'R2 L2 U2 D2 F2 B2', note: 'Only half turns, so it is the easiest to start with. Every face swaps half its stickers with the face opposite.' },
  { name: 'Four spots', alg: "F2 B2 U D' R2 L2 U D'", note: 'The four side centers trade places with the center opposite. Top and bottom stay solid.' },
  { name: 'Six spots', alg: "U D' R L' F B' U D'", note: 'Every face keeps a solid ring with a different color in the middle.' },
  { name: 'Plus', alg: "U F B' L2 U2 L2 F' B U2 L2 U", note: 'The edges stay home while every corner swaps with the opposite face, drawing a plus on each side.' },
  { name: 'Zigzag', alg: 'R L B F R L B F R L B F', note: 'One short sequence, R L B F, done three times. The sides zigzag while top and bottom stay solid.' },
  { name: 'Cube in a cube', alg: "F L F U' R U F2 L2 U' L' B D' B' L2 U", note: 'A small 2×2 cube seems to sit inside the big one, poking out of one corner.' },
  { name: 'Stripes', alg: "F U F R L2 B D' R D2 L D' B R2 L F U F", note: 'Each side gets three upright stripes. Top and bottom stay solid.' },
  { name: 'Superflip', alg: "U R2 F B R B2 R U2 L B2 R U' D' R2 F R' L B2 U2 F2", note: 'Every edge is home but flipped, every corner is solved. It needs 20 moves, the most any cube position can need.' },
]
