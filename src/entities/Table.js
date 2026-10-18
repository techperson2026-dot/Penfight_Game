import * as THREE from '../libs/three.module.js';

export class ClassroomDesk {
  constructor(width = 16, depth = 22, height = 10) {
    this.width = width;
    this.depth = depth;
    this.height = height;

    this.group = new THREE.Group();
    this.obstacles = []; // Bouncers/obstacles on the desk

    this.buildDesk();
    this.buildClassroomProps();
  }

  // Create high-detail procedural wooden desk canvas texture with school carvings
  createWoodTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 1024;
    canvas.height = 1024;
    const ctx = canvas.getContext('2d');

    // Base warm teak wood color
    const gradient = ctx.createLinearGradient(0, 0, 0, 1024);
    gradient.addColorStop(0, '#c48b59');
    gradient.addColorStop(0.5, '#b17544');
    gradient.addColorStop(1, '#a36636');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 1024, 1024);

    // Wood grain lines
    ctx.fillStyle = 'rgba(70, 35, 12, 0.05)';
    for (let i = 0; i < 800; i++) {
      const y = Math.random() * 1024;
      const h = 1 + Math.random() * 4;
      ctx.fillRect(0, y, 1024, h);
    }

    // Wood knot rings
    for (let k = 0; k < 3; k++) {
      const kx = 250 + Math.random() * 500;
      const ky = 200 + Math.random() * 600;
      ctx.strokeStyle = 'rgba(60, 25, 8, 0.12)';
      ctx.lineWidth = 1.5;
      for (let r = 5; r < 50; r += 6) {
        ctx.beginPath();
        ctx.ellipse(kx, ky, r * 1.8, r * 0.9, Math.PI / 12, 0, Math.PI * 2);
        ctx.stroke();
      }
    }

    // Desk Doodles & Carvings (Nostalgic School Desk Artifacts!)
    ctx.strokeStyle = 'rgba(50, 20, 5, 0.45)';
    ctx.fillStyle = 'rgba(50, 20, 5, 0.45)';
    ctx.lineWidth = 2.5;

    // 1. Carved compass circle with scratch marks
    ctx.beginPath();
    ctx.arc(320, 280, 48, 0, Math.PI * 2);
    ctx.stroke();
    // Center compass pin hole
    ctx.beginPath();
    ctx.arc(320, 280, 4, 0, Math.PI * 2);
    ctx.fill();

    // 2. Tic-Tac-Toe carved game
    const tx = 680, ty = 720;
    ctx.beginPath();
    ctx.moveTo(tx - 35, ty - 12); ctx.lineTo(tx + 35, ty - 12);
    ctx.moveTo(tx - 35, ty + 12); ctx.lineTo(tx + 35, ty + 12);
    ctx.moveTo(tx - 12, ty - 35); ctx.lineTo(tx - 12, ty + 35);
    ctx.moveTo(tx + 12, ty - 35); ctx.lineTo(tx + 12, ty + 35);
    ctx.stroke();
    // X and O marks
    ctx.beginPath();
    ctx.moveTo(tx - 30, ty - 30); ctx.lineTo(tx - 16, ty - 16);
    ctx.moveTo(tx - 16, ty - 30); ctx.lineTo(tx - 30, ty - 16);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(tx, ty, 8, 0, Math.PI * 2);
    ctx.stroke();

    // 3. Carved "PEN FIGHT" lettering
    ctx.font = 'bold 26px "Courier New", monospace';
    ctx.fillStyle = 'rgba(40, 15, 5, 0.4)';
    ctx.fillText('PEN FIGHT ★ 2026', 360, 520);

    // 4. Subtle desk ruler markings on the bottom edge
    ctx.strokeStyle = 'rgba(40, 15, 5, 0.5)';
    ctx.lineWidth = 1.8;
    for (let x = 60; x < 964; x += 18) {
      const markH = (x % 90 === 0) ? 22 : 12;
      ctx.beginPath();
      ctx.moveTo(x, 1014);
      ctx.lineTo(x, 1014 - markH);
      ctx.stroke();
    }

    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    return texture;
  }

  buildDesk() {
    const woodTex = this.createWoodTexture();

    // Main Table Top Surface
    const topThickness = 0.8;
    const topGeo = new THREE.BoxGeometry(this.width, topThickness, this.depth);
    const topMat = new THREE.MeshStandardMaterial({
      map: woodTex,
      roughness: 0.6,
      metalness: 0.05
    });

    const tableTop = new THREE.Mesh(topGeo, topMat);
    tableTop.position.y = -topThickness * 0.5;
    tableTop.receiveShadow = true;
    this.group.add(tableTop);

    // Desk Edge Bevel / Borders
    const borderMat = new THREE.MeshStandardMaterial({
      color: 0x874d23,
      roughness: 0.7,
      metalness: 0.05
    });

    // Outer desk trim
    const trimThick = 0.2;
    const trimGeoX = new THREE.BoxGeometry(this.width + trimThick * 2, topThickness * 1.2, trimThick);
    const trimNorth = new THREE.Mesh(trimGeoX, borderMat);
    trimNorth.position.set(0, -topThickness * 0.5, this.depth * 0.5 + trimThick * 0.5);
    this.group.add(trimNorth);

    const trimSouth = new THREE.Mesh(trimGeoX, borderMat);
    trimSouth.position.set(0, -topThickness * 0.5, -this.depth * 0.5 - trimThick * 0.5);
    this.group.add(trimSouth);

    // 4 Classic Wooden Desk Legs
    const legW = 0.9;
    const legGeo = new THREE.BoxGeometry(legW, this.height, legW);
    const legMat = new THREE.MeshStandardMaterial({
      color: 0x5a3214,
      roughness: 0.8
    });

    const legPositions = [
      [-this.width * 0.45, -this.height * 0.5 - topThickness, -this.depth * 0.45],
      [this.width * 0.45, -this.height * 0.5 - topThickness, -this.depth * 0.45],
      [-this.width * 0.45, -this.height * 0.5 - topThickness, this.depth * 0.45],
      [this.width * 0.45, -this.height * 0.5 - topThickness, this.depth * 0.45]
    ];

    legPositions.forEach(([x, y, z]) => {
      const leg = new THREE.Mesh(legGeo, legMat);
      leg.position.set(x, y, z);
      leg.castShadow = true;
      leg.receiveShadow = true;
      this.group.add(leg);
    });

    // Classroom Floor below desk (so falling pen lands somewhere realistic!)
    const floorGeo = new THREE.PlaneGeometry(60, 60);
    const floorMat = new THREE.MeshStandardMaterial({
      color: 0x2b303a, // Classroom slate tile
      roughness: 0.9
    });
    const floor = new THREE.Mesh(floorGeo, floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -this.height - topThickness;
    floor.receiveShadow = true;
    this.group.add(floor);
  }

  buildClassroomProps() {
    // 1. School Notebook lying at top-right corner of desk
    const bookW = 4.2, bookL = 5.6, bookH = 0.35;
    const bookGeo = new THREE.BoxGeometry(bookW, bookH, bookL);

    // Canvas texture for notebook cover with title label
    const nbCanvas = document.createElement('canvas');
    nbCanvas.width = 512;
    nbCanvas.height = 512;
    const nbCtx = nbCanvas.getContext('2d');
    nbCtx.fillStyle = '#2563eb'; // Blue school notebook cover
    nbCtx.fillRect(0, 0, 512, 512);
    // White label box
    nbCtx.fillStyle = '#ffffff';
    nbCtx.fillRect(100, 140, 312, 160);
    nbCtx.strokeStyle = '#1d4ed8';
    nbCtx.lineWidth = 4;
    nbCtx.strokeRect(100, 140, 312, 160);
    nbCtx.fillStyle = '#1e293b';
    nbCtx.font = 'bold 24px sans-serif';
    nbCtx.fillText('CLASSWORK NOTEBOOK', 120, 185);
    nbCtx.font = '18px sans-serif';
    nbCtx.fillText('NAME: ________________', 120, 225);
    nbCtx.fillText('SUBJECT: PEN FIGHT ★', 120, 265);

    const nbTex = new THREE.CanvasTexture(nbCanvas);
    const bookMat = new THREE.MeshStandardMaterial({ map: nbTex, roughness: 0.6 });
    const notebook = new THREE.Mesh(bookGeo, bookMat);
    notebook.position.set(this.width * 0.32, bookH * 0.5, -this.depth * 0.35);
    notebook.rotation.y = -0.12;
    notebook.castShadow = true;
    notebook.receiveShadow = true;
    this.group.add(notebook);

    // 2. Wooden 15cm Camlin Ruler (acts as an interactive bumper obstacle!)
    const rulerW = 1.0, rulerL = 5.2, rulerH = 0.16;
    const rulerGeo = new THREE.BoxGeometry(rulerW, rulerH, rulerL);

    const rCanvas = document.createElement('canvas');
    rCanvas.width = 256;
    rCanvas.height = 512;
    const rCtx = rCanvas.getContext('2d');
    rCtx.fillStyle = '#fde68a'; // Yellow wood ruler
    rCtx.fillRect(0, 0, 256, 512);
    rCtx.fillStyle = '#111827';
    rCtx.font = 'bold 22px sans-serif';
    rCtx.fillText('CAMLIN 15cm', 45, 260);
    // Millimeter tick marks
    rCtx.strokeStyle = '#111827';
    rCtx.lineWidth = 2;
    for (let y = 30; y < 480; y += 12) {
      const len = (y % 60 === 0) ? 40 : 20;
      rCtx.beginPath();
      rCtx.moveTo(0, y);
      rCtx.lineTo(len, y);
      rCtx.stroke();
    }

    const rTex = new THREE.CanvasTexture(rCanvas);
    const rulerMat = new THREE.MeshStandardMaterial({ map: rTex, roughness: 0.5 });
    const ruler = new THREE.Mesh(rulerGeo, rulerMat);
    const rulerPos = { x: -this.width * 0.33, y: rulerH * 0.5, z: this.depth * 0.25 };
    const rulerRot = 0.25;
    ruler.position.set(rulerPos.x, rulerPos.y, rulerPos.z);
    ruler.rotation.y = rulerRot;
    ruler.castShadow = true;
    ruler.receiveShadow = true;
    this.group.add(ruler);

    // Register ruler as physical obstacle
    this.obstacles.push({
      type: 'box',
      name: 'Ruler',
      pos: { x: rulerPos.x, z: rulerPos.z },
      width: rulerW,
      depth: rulerL,
      rotation: rulerRot
    });

    // 3. Apsara Platinum Eraser (Corner obstacle)
    const eraserW = 1.1, eraserL = 2.0, eraserH = 0.45;
    const eraserGeo = new THREE.BoxGeometry(eraserW, eraserH, eraserL);
    const eraserMat = new THREE.MeshStandardMaterial({
      color: 0x1e293b, // Black Apsara eraser
      roughness: 0.8
    });
    const eraser = new THREE.Mesh(eraserGeo, eraserMat);
    const eraserPos = { x: -this.width * 0.36, y: eraserH * 0.5, z: -this.depth * 0.38 };
    const eraserRot = -0.35;
    eraser.position.set(eraserPos.x, eraserPos.y, eraserPos.z);
    eraser.rotation.y = eraserRot;
    eraser.castShadow = true;
    eraser.receiveShadow = true;
    this.group.add(eraser);

    this.obstacles.push({
      type: 'box',
      name: 'Eraser',
      pos: { x: eraserPos.x, z: eraserPos.z },
      width: eraserW,
      depth: eraserL,
      rotation: eraserRot
    });
  }

  getBounds() {
    return {
      width: this.width,
      depth: this.depth
    };
  }
}
