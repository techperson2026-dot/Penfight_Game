# 🖊️ Classroom Pen Fight 3D

An authentic, nostalgic 3D Pen Fight game recreating the classic school classroom desk battle!

## Features

- **Classroom Desk Arena**: Detailed 3D wooden desk with carved compass marks, tick-tack-toe scratches, desk ruler, eraser, and table edge drop-offs.
- **5 Legendary School Pens**:
  - **Reynolds 045 Carbure**: Lightweight, agile, sharp acceleration.
  - **Cello Gripper**: Rubber grip ribs with high table friction against edge slides.
  - **Pilot V5 Hi-Tec**: Needle-point precision with supreme rotational spin capability.
  - **Parker Vector Metal**: Heavyweight stainless steel tank with high impact momentum.
  - **Trimax Octane Gel**: Chunky aerodynamic barrel with explosive striker power.
- **Realistic Physics Engine**:
  - Rigid-body capsule collisions with impulse resolution and restitution.
  - Off-center flicking: Flicking near the tip or cap imparts rotational spin torque (the classic "sweep" and "helicopter" moves).
  - Desk obstacles: Wooden 15cm Camlin ruler and Apsara eraser serve as tactical bank cushions.
  - Desk-fall detection with 3D gravity tumble physics.
- **Procedural Sound Engine**: Pure Web Audio API synthesizers for flick whooshes, plastic and metal clacks, table sliding, desk-fall drops, and round fanfare.
- **Multiple Game Modes**:
  - **1 Player vs AI**: Classroom Rookie (Easy), Benchmate (Medium), Backbencher Pro (Lethal).
  - **2 Players (Pass & Play)**: Local turn-based multiplayer on the same screen.
  - **Best of 3 / Best of 5** match format.
- **Camera Views**: Toggle between 3D Isometric View and 2D Top-Down Tactical View.

## How to Play

### Controls
1. **Aim**: Click / touch on your pen and pull backward (slingshot style).
2. **Spin**: Drag towards the tip or cap to adjust spin offset and curve your shot.
3. **Power**: Pull further to increase power (gauge turns from green to red).
4. **Launch**: Release to flick your pen!

### Goal
Knock your opponent's pen completely off the wooden desk while keeping your own pen safely on the table!

## Quick Start

Open in any browser:
```bash
npm start
# or open http://localhost:8080 in your browser
```
