import * as THREE from '../libs/three.module.js';

export const PEN_PRESETS = {
  reynolds_045: {
    id: 'reynolds_045',
    name: 'Reynolds 045 Carbure',
    tagline: 'Lightweight & Lightning Fast',
    description: 'The legendary school classic. Hexagonal white body with sharp acceleration.',
    mass: 1.0,
    length: 3.2,
    radius: 0.16,
    friction: 0.038,
    bounciness: 0.65,
    spinFactor: 1.15,
    isMetal: false,
    primaryColor: 0x1e56a0, // Classic royal blue
    bodyColor: 0xf5f5f5,    // White barrel
    accentColor: 0x1e56a0
  },
  cello_gripper: {
    id: 'cello_gripper',
    name: 'Cello Gripper',
    tagline: 'High Table Grip & Stability',
    description: 'Equipped with rubber grip ribs. Harder to push off desk edges.',
    mass: 1.3,
    length: 3.1,
    radius: 0.18,
    friction: 0.055, // Rubber friction prevents edge slides
    bounciness: 0.55,
    spinFactor: 1.0,
    isMetal: false,
    primaryColor: 0x1b1b1b,
    bodyColor: 0x242424,
    accentColor: 0x0099ff
  },
  pilot_v5: {
    id: 'pilot_v5',
    name: 'Pilot V5 Hi-Tec',
    tagline: 'The Spin & Trickshot Master',
    description: 'Needle-point precision with supreme rotational spin capability.',
    mass: 1.15,
    length: 3.3,
    radius: 0.17,
    friction: 0.040,
    bounciness: 0.70,
    spinFactor: 1.55, // Incredible spin control
    isMetal: false,
    primaryColor: 0x475569,
    bodyColor: 0x334155,
    accentColor: 0xe2e8f0
  },
  heavy_parker: {
    id: 'heavy_parker',
    name: 'Parker Vector Metal',
    tagline: 'The Heavyweight Tank',
    description: 'All-metal stainless steel body. Unstoppable momentum on direct hits.',
    mass: 2.1, // Heavy mass
    length: 3.0,
    radius: 0.20,
    friction: 0.035,
    bounciness: 0.48,
    spinFactor: 0.75,
    isMetal: true,
    primaryColor: 0xd1d5db, // Brushed silver
    bodyColor: 0xe5e7eb,
    accentColor: 0xf59e0b  // Golden clip
  },
  trimax_octane: {
    id: 'trimax_octane',
    name: 'Trimax Octane Gel',
    tagline: 'The Power Striker',
    description: 'Chunky aerodynamic barrel with explosive forward punch.',
    mass: 1.6,
    length: 3.25,
    radius: 0.19,
    friction: 0.042,
    bounciness: 0.62,
    spinFactor: 1.25,
    isMetal: false,
    primaryColor: 0x111827,
    bodyColor: 0x0f172a,
    accentColor: 0x06b6d4  // Vibrant cyan
  }
};

export class Pen {
  constructor(presetKey = 'reynolds_045', isPlayer2 = false) {
    this.presetKey = presetKey;
    this.isPlayer2 = isPlayer2;
    this.config = PEN_PRESETS[presetKey] || PEN_PRESETS.reynolds_045;

    // Physical characteristics
    this.mass = this.config.mass;
    this.length = this.config.length;
    this.radius = this.config.radius;
    this.friction = this.config.friction;
    this.bounciness = this.config.bounciness;
    this.spinFactor = this.config.spinFactor;
    this.isMetal = this.config.isMetal;
    // Moment of inertia for thin rod/cylinder rotating about perpendicular center axis: I = 1/12 * m * L^2
    this.inertia = (1 / 12) * this.mass * (this.length * this.length);

    // Dynamic states on table
    this.pos = { x: 0, y: this.radius, z: 0 };
    this.vel = { x: 0, z: 0 };
    this.rot = 0; // Yaw angle in radians
    this.angVel = 0; // Angular velocity (rad/s)

    // Falling state
    this.isFalling = false;
    this.fallY = 0;
    this.fallVelY = 0;
    this.pitch = 0;
    this.roll = 0;
    this.pitchVel = 0;
    this.rollVel = 0;

    // Resting state threshold
    this.isResting = true;

    // Build 3D mesh
    this.mesh = this.buildMesh();
    this.updateMeshTransform();
  }

  buildMesh() {
    const group = new THREE.Group();
    const halfL = this.length * 0.5;
    const r = this.radius;

    // Adjust theme color for Player 2 if needed (e.g. Red vs Blue tint)
    let pColor = this.config.primaryColor;
    let bColor = this.config.bodyColor;
    let aColor = this.config.accentColor;

    if (this.isPlayer2 && this.presetKey === 'reynolds_045') {
      pColor = 0xd90429; // Red classic cap
      aColor = 0xd90429;
    } else if (this.isPlayer2 && this.presetKey === 'trimax_octane') {
      aColor = 0xf43f5e; // Pink/red neon
    }

    const bodyMat = new THREE.MeshStandardMaterial({
      color: bColor,
      roughness: this.isMetal ? 0.3 : 0.45,
      metalness: this.isMetal ? 0.85 : 0.08
    });

    const capMat = new THREE.MeshStandardMaterial({
      color: pColor,
      roughness: this.isMetal ? 0.25 : 0.4,
      metalness: this.isMetal ? 0.7 : 0.1
    });

    const clipMat = new THREE.MeshStandardMaterial({
      color: aColor,
      roughness: 0.2,
      metalness: 0.85
    });

    const tipMetalMat = new THREE.MeshStandardMaterial({
      color: 0xcccccc,
      roughness: 0.2,
      metalness: 0.95
    });

    // Main barrel cylinder
    const barrelL = this.length * 0.65;
    const barrelGeo = new THREE.CylinderGeometry(r * 0.96, r, barrelL, 24);
    barrelGeo.rotateX(Math.PI / 2); // Align with Z axis (lengthwise)
    const barrel = new THREE.Mesh(barrelGeo, bodyMat);
    barrel.position.z = -this.length * 0.05;
    barrel.castShadow = true;
    barrel.receiveShadow = true;
    group.add(barrel);

    // Front cone / taper
    const coneL = this.length * 0.15;
    const coneGeo = new THREE.ConeGeometry(r * 0.96, coneL, 24);
    coneGeo.rotateX(-Math.PI / 2); // Pointing forward (+Z)
    const cone = new THREE.Mesh(coneGeo, bodyMat);
    cone.position.z = halfL - coneL * 0.5 - this.length * 0.05;
    cone.castShadow = true;
    group.add(cone);

    // Metallic Writing Tip / Nib
    const nibL = this.length * 0.08;
    const nibGeo = new THREE.ConeGeometry(r * 0.35, nibL, 16);
    nibGeo.rotateX(-Math.PI / 2);
    const nib = new THREE.Mesh(nibGeo, tipMetalMat);
    nib.position.z = halfL - nibL * 0.5;
    nib.castShadow = true;
    group.add(nib);

    // Tiny ball point sphere
    const ballGeo = new THREE.SphereGeometry(r * 0.12, 12, 12);
    const ball = new THREE.Mesh(ballGeo, tipMetalMat);
    ball.position.z = halfL;
    group.add(ball);

    // Pen Cap or Back Plug
    const capL = this.length * 0.25;
    const capGeo = new THREE.CylinderGeometry(r * 1.08, r * 1.05, capL, 24);
    capGeo.rotateX(Math.PI / 2);
    const cap = new THREE.Mesh(capGeo, capMat);
    cap.position.z = -halfL + capL * 0.5;
    cap.castShadow = true;
    group.add(cap);

    // Pocket Clip on the Cap
    const clipL = capL * 0.75;
    const clipGeo = new THREE.BoxGeometry(r * 0.25, r * 0.22, clipL);
    const clip = new THREE.Mesh(clipGeo, clipMat);
    clip.position.set(0, r * 1.15, -halfL + capL * 0.5);
    clip.castShadow = true;
    group.add(clip);

    // If Cello Gripper, add rubber grip rings
    if (this.presetKey === 'cello_gripper') {
      const gripMat = new THREE.MeshStandardMaterial({
        color: 0x111111,
        roughness: 0.9,
        metalness: 0.0
      });
      const gripGeo = new THREE.CylinderGeometry(r * 1.06, r * 1.06, this.length * 0.2, 24);
      gripGeo.rotateX(Math.PI / 2);
      const grip = new THREE.Mesh(gripGeo, gripMat);
      grip.position.z = halfL * 0.35;
      group.add(grip);
    }

    // Directional Ring Indicator near tip (for orientation clarity)
    const ringGeo = new THREE.TorusGeometry(r * 0.98, r * 0.06, 8, 24);
    const ring = new THREE.Mesh(ringGeo, clipMat);
    ring.position.z = halfL * 0.6;
    group.add(ring);

    // Player indicator badge / glow disk at center
    const haloGeo = new THREE.RingGeometry(r * 1.2, r * 1.45, 24);
    haloGeo.rotateX(-Math.PI / 2);
    const haloMat = new THREE.MeshBasicMaterial({
      color: this.isPlayer2 ? 0xef4444 : 0x3b82f6,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.7
    });
    const halo = new THREE.Mesh(haloGeo, haloMat);
    halo.position.y = -r * 0.95;
    halo.name = 'playerIndicator';
    group.add(halo);

    return group;
  }

  // Get segment endpoints in world space (Tip is at +Z local, Cap is at -Z local)
  getSegment() {
    const halfL = this.length * 0.5;
    const cos = Math.cos(this.rot);
    const sin = Math.sin(this.rot);

    // Tip: local (0, halfL) -> world (+sin * halfL, +cos * halfL)
    const tipX = this.pos.x + sin * halfL;
    const tipZ = this.pos.z + cos * halfL;

    // Cap/Back: local (0, -halfL) -> world (-sin * halfL, -cos * halfL)
    const backX = this.pos.x - sin * halfL;
    const backZ = this.pos.z - cos * halfL;

    return {
      a: { x: tipX, z: tipZ }, // Tip
      b: { x: backX, z: backZ } // Back cap
    };
  }

  // Apply a flick impulse
  // hitOffsetNormalized: -1.0 (cap) to +1.0 (tip), 0.0 is center
  applyFlick(dirX, dirZ, power, hitOffsetNormalized = 0.0) {
    if (this.isFalling) return;

    // Clamp power
    const clampedPower = Math.min(Math.max(power, 0.05), 1.0);
    // Base speed scaled by pen mass
    const speed = (clampedPower * 28.0) / Math.sqrt(this.mass);

    this.vel.x = dirX * speed;
    this.vel.z = dirZ * speed;

    // Off-center flick creates rotational spin (Torque!)
    // Torque tau = r x F
    const halfL = this.length * 0.5;
    const rArm = hitOffsetNormalized * halfL;

    // Vector along pen body: (sin(rot), cos(rot))
    const bodyX = Math.sin(this.rot);
    const bodyZ = Math.cos(this.rot);

    // 2D cross product between lever arm along pen axis and flick direction
    const torque = (bodyX * dirZ - bodyZ * dirX) * rArm * (speed * this.mass * 0.85);

    this.angVel = (torque / this.inertia) * this.spinFactor;

    // Cap angular velocity
    const maxSpin = 26.0;
    this.angVel = Math.max(-maxSpin, Math.min(maxSpin, this.angVel));

    this.isResting = false;
  }

  update(dt, tableBounds) {
    if (this.isFalling) {
      // 3D gravity falling physics
      this.fallVelY -= 45.0 * dt; // Gravity
      this.pos.y += this.fallVelY * dt;
      this.pos.x += this.vel.x * dt;
      this.pos.z += this.vel.z * dt;

      this.rot += this.angVel * dt;
      this.pitch += this.pitchVel * dt;
      this.roll += this.rollVel * dt;

      this.updateMeshTransform();
      return;
    }

    // Moving on table
    const speed = Math.sqrt(this.vel.x * this.vel.x + this.vel.z * this.vel.z);
    const spinSpeed = Math.abs(this.angVel);

    if (speed < 0.08 && spinSpeed < 0.1) {
      this.vel.x = 0;
      this.vel.z = 0;
      this.angVel = 0;
      this.isResting = true;
    } else {
      this.isResting = false;

      // Integrate position
      this.pos.x += this.vel.x * dt;
      this.pos.z += this.vel.z * dt;
      this.rot += this.angVel * dt;

      // Normalization of rotation
      this.rot = (this.rot + Math.PI * 2) % (Math.PI * 2);

      // Coulomb & aerodynamic friction
      const frictionDecel = (18.0 * this.friction + 0.15 * speed) * dt;
      const newSpeed = Math.max(0, speed - frictionDecel);
      if (speed > 0.0001) {
        this.vel.x = (this.vel.x / speed) * newSpeed;
        this.vel.z = (this.vel.z / speed) * newSpeed;
      }

      // Angular damping
      const angDamping = 3.2 * dt;
      this.angVel *= Math.max(0, 1 - angDamping);
    }

    // Check table bounds & falling
    this.checkTableEdge(tableBounds);
    this.updateMeshTransform();
  }

  checkTableEdge(bounds) {
    const halfW = bounds.width * 0.5;
    const halfD = bounds.depth * 0.5;

    // Check if Center of Mass is off the table
    const centerOff =
      this.pos.x < -halfW || this.pos.x > halfW ||
      this.pos.z < -halfD || this.pos.z > halfD;

    // Check if both ends are off the table
    const seg = this.getSegment();
    const tipOff = seg.a.x < -halfW || seg.a.x > halfW || seg.a.z < -halfD || seg.a.z > halfD;
    const backOff = seg.b.x < -halfW || seg.b.x > halfW || seg.b.z < -halfD || seg.b.z > halfD;

    if (centerOff || (tipOff && backOff)) {
      this.startFalling(bounds);
    }
  }

  startFalling(bounds) {
    this.isFalling = true;
    this.isResting = false;
    this.fallVelY = -1.5;

    // Impart tumble pitch and roll based on which edge was crossed
    const halfW = bounds.width * 0.5;
    const halfD = bounds.depth * 0.5;

    if (this.pos.x > halfW) this.rollVel = 6.0;
    else if (this.pos.x < -halfW) this.rollVel = -6.0;

    if (this.pos.z > halfD) this.pitchVel = 6.0;
    else if (this.pos.z < -halfD) this.pitchVel = -6.0;

    // Random tumble flavor
    this.pitchVel += (Math.random() - 0.5) * 4.0;
    this.rollVel += (Math.random() - 0.5) * 4.0;
  }

  updateMeshTransform() {
    this.mesh.position.set(this.pos.x, this.pos.y, this.pos.z);
    this.mesh.rotation.y = this.rot;
    this.mesh.rotation.x = this.pitch;
    this.mesh.rotation.z = this.roll;
  }

  reset(x, z, rot) {
    this.pos = { x, y: this.radius, z };
    this.vel = { x: 0, z: 0 };
    this.rot = rot;
    this.angVel = 0;
    this.isFalling = false;
    this.fallVelY = 0;
    this.pitch = 0;
    this.roll = 0;
    this.pitchVel = 0;
    this.rollVel = 0;
    this.isResting = true;
    this.updateMeshTransform();
  }

  setHighlight(active) {
    const halo = this.mesh.getObjectByName('playerIndicator');
    if (halo) {
      halo.material.opacity = active ? 0.95 : 0.35;
      halo.scale.setScalar(active ? 1.25 : 1.0);
    }
  }
}
