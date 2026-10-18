// High-Precision 2D Rigid Body Capsule Collision & Physics for Pens

// Vector math helper on XZ plane
export function distSq(x1, z1, x2, z2) {
  const dx = x1 - x2;
  const dz = z1 - z2;
  return dx * dx + dz * dz;
}

export function cross2D(vx, vz, wx, wz) {
  return vx * wz - vz * wx;
}

// Find closest points between two line segments A->B and C->D
// Ref: Real-Time Collision Detection by Christer Ericson
export function closestPointsBetweenSegments(a, b, c, d) {
  const d1x = b.x - a.x;
  const d1z = b.z - a.z;
  const d2x = d.x - c.x;
  const d2z = d.z - c.z;
  const rx = a.x - c.x;
  const rz = a.z - c.z;

  const aSq = d1x * d1x + d1z * d1z;
  const eSq = d2x * d2x + d2z * d2z;
  const f = d2x * rz - d2z * rx;

  let s = 0.0;
  let t = 0.0;

  // Check if both segments degenerate into points
  if (aSq <= 0.00001 && eSq <= 0.00001) {
    return {
      p1: { x: a.x, z: a.z },
      p2: { x: c.x, z: c.z },
      s: 0,
      t: 0
    };
  }

  if (aSq <= 0.00001) {
    // First segment is a point
    s = 0.0;
    t = Math.max(0.0, Math.min(1.0, (d2x * -rx + d2z * -rz) / eSq));
  } else {
    const cVal = d1x * rx + d1z * rz;
    if (eSq <= 0.00001) {
      // Second segment is a point
      t = 0.0;
      s = Math.max(0.0, Math.min(1.0, -cVal / aSq));
    } else {
      // General non-degenerate case
      const bVal = d1x * d2x + d1z * d2z;
      const denom = aSq * eSq - bVal * bVal;

      if (denom !== 0.0) {
        s = Math.max(0.0, Math.min(1.0, (bVal * (d2x * rx + d2z * rz) - cVal * eSq) / denom));
      } else {
        s = 0.0;
      }

      t = (bVal * s + (d2x * rx + d2z * rz)) / eSq;

      if (t < 0.0) {
        t = 0.0;
        s = Math.max(0.0, Math.min(1.0, -cVal / aSq));
      } else if (t > 1.0) {
        t = 1.0;
        s = Math.max(0.0, Math.min(1.0, (bVal - cVal) / aSq));
      }
    }
  }

  const p1 = {
    x: a.x + d1x * s,
    z: a.z + d1z * s
  };
  const p2 = {
    x: c.x + d2x * t,
    z: c.z + d2z * t
  };

  return { p1, p2, s, t };
}

// Resolve collision between Pen 1 and Pen 2
export function resolvePenPenCollision(pen1, pen2, onCollide) {
  // If either pen is already falling off the table, ignore collision
  if (pen1.isFalling || pen2.isFalling) return false;

  const seg1 = pen1.getSegment();
  const seg2 = pen2.getSegment();

  const { p1, p2 } = closestPointsBetweenSegments(seg1.a, seg1.b, seg2.a, seg2.b);

  let dx = p1.x - p2.x;
  let dz = p1.z - p2.z;
  let dist = Math.sqrt(dx * dx + dz * dz);
  const minDist = pen1.radius + pen2.radius;

  if (dist >= minDist) {
    return false; // No collision
  }

  // Prevent divide by zero if exactly concentric
  if (dist < 0.0001) {
    dx = 1;
    dz = 0;
    dist = 1;
  }

  // Normal from pen2 to pen1
  const nx = dx / dist;
  const nz = dz / dist;
  const penetration = minDist - dist;

  // Contact point in world space
  const cx = (p1.x + p2.x) * 0.5;
  const cz = (p1.z + p2.z) * 0.5;

  // Lever arms from centers of mass
  const r1x = cx - pen1.pos.x;
  const r1z = cz - pen1.pos.z;
  const r2x = cx - pen2.pos.x;
  const r2z = cz - pen2.pos.z;

  // Velocity at contact points
  // v_c = v + omega x r -> (vx - omega * rz, vz + omega * rx)
  const vc1x = pen1.vel.x - pen1.angVel * r1z;
  const vc1z = pen1.vel.z + pen1.angVel * r1x;
  const vc2x = pen2.vel.x - pen2.angVel * r2z;
  const vc2z = pen2.vel.z + pen2.angVel * r2x;

  // Relative velocity of contact points
  const vrelX = vc1x - vc2x;
  const vrelZ = vc1z - vc2z;
  const vNormal = vrelX * nx + vrelZ * nz;

  // Do not resolve if moving apart
  if (vNormal > 0) {
    // Still apply positional separation to prevent overlaps
    const totalMass = pen1.mass + pen2.mass;
    pen1.pos.x += nx * (penetration * (pen2.mass / totalMass));
    pen1.pos.z += nz * (penetration * (pen2.mass / totalMass));
    pen2.pos.x -= nx * (penetration * (pen1.mass / totalMass));
    pen2.pos.z -= nz * (penetration * (pen1.mass / totalMass));
    return false;
  }

  // Restitution & Friction coefficients
  const restitution = Math.min(pen1.bounciness, pen2.bounciness);
  const friction = (pen1.friction + pen2.friction) * 0.5;

  // Angular torque cross product terms
  const r1CrossN = cross2D(r1x, r1z, nx, nz); // r1x * nz - r1z * nx
  const r2CrossN = cross2D(r2x, r2z, nx, nz);

  const invMass1 = 1 / pen1.mass;
  const invMass2 = 1 / pen2.mass;
  const invI1 = 1 / pen1.inertia;
  const invI2 = 1 / pen2.inertia;

  const kNormal = invMass1 + invMass2 + (r1CrossN * r1CrossN) * invI1 + (r2CrossN * r2CrossN) * invI2;
  const jNormal = -(1 + restitution) * vNormal / kNormal;

  // Normal impulse vector
  const jnx = jNormal * nx;
  const jnz = jNormal * nz;

  // Apply Normal Impulse
  pen1.vel.x += jnx * invMass1;
  pen1.vel.z += jnz * invMass1;
  pen1.angVel += r1CrossN * jNormal * invI1;

  pen2.vel.x -= jnx * invMass2;
  pen2.vel.z -= jnz * invMass2;
  pen2.angVel -= r2CrossN * jNormal * invI2;

  // Tangential friction (causes high spin and slice shots!)
  const tx = -nz;
  const tz = nx;
  const vTangential = vrelX * tx + vrelZ * tz;

  const r1CrossT = cross2D(r1x, r1z, tx, tz);
  const r2CrossT = cross2D(r2x, r2z, tx, tz);
  const kTangent = invMass1 + invMass2 + (r1CrossT * r1CrossT) * invI1 + (r2CrossT * r2CrossT) * invI2;

  let jTangent = -vTangential / kTangent;
  // Coulomb friction clamp
  const maxJTangent = friction * jNormal;
  jTangent = Math.max(-maxJTangent, Math.min(maxJTangent, jTangent));

  const jtx = jTangent * tx;
  const jtz = jTangent * tz;

  // Apply Tangential Friction Impulse
  pen1.vel.x += jtx * invMass1;
  pen1.vel.z += jtz * invMass1;
  pen1.angVel += r1CrossT * jTangent * invI1;

  pen2.vel.x -= jtx * invMass2;
  pen2.vel.z -= jtz * invMass2;
  pen2.angVel -= r2CrossT * jTangent * invI2;

  // Positional Separation
  const totalMass = pen1.mass + pen2.mass;
  const sepX = nx * penetration;
  const sepZ = nz * penetration;
  pen1.pos.x += sepX * (pen2.mass / totalMass);
  pen1.pos.z += sepZ * (pen2.mass / totalMass);
  pen2.pos.x -= sepX * (pen1.mass / totalMass);
  pen2.pos.z -= sepZ * (pen1.mass / totalMass);

  // Trigger audio callback
  if (onCollide) {
    const impactMagnitude = Math.abs(vNormal);
    const isMetal = pen1.isMetal || pen2.isMetal;
    onCollide(impactMagnitude, isMetal);
  }

  return true;
}

// Collide pen with static rectangular obstacle (e.g. wooden ruler or eraser)
export function resolvePenObstacleCollision(pen, obstacle, onBump) {
  if (pen.isFalling) return false;

  const seg = pen.getSegment();
  const halfW = obstacle.width * 0.5;
  const halfD = obstacle.depth * 0.5;

  // Transform pen segment into obstacle local space
  const cos = Math.cos(-obstacle.rotation);
  const sin = Math.sin(-obstacle.rotation);

  const localA = {
    x: (seg.a.x - obstacle.pos.x) * cos - (seg.a.z - obstacle.pos.z) * sin,
    z: (seg.a.x - obstacle.pos.x) * sin + (seg.a.z - obstacle.pos.z) * cos
  };
  const localB = {
    x: (seg.b.x - obstacle.pos.x) * cos - (seg.b.z - obstacle.pos.z) * sin,
    z: (seg.b.x - obstacle.pos.x) * sin + (seg.b.z - obstacle.pos.z) * cos
  };

  // Sample points along pen segment
  const samples = 6;
  let collided = false;
  let maxPenetration = 0;
  let bestNormal = { x: 0, z: 0 };
  let bestPoint = { x: 0, z: 0 };

  for (let i = 0; i <= samples; i++) {
    const t = i / samples;
    const px = localA.x + (localB.x - localA.x) * t;
    const pz = localA.z + (localB.z - localA.z) * t;

    // Check against obstacle AABB in local space
    const clampedX = Math.max(-halfW, Math.min(halfW, px));
    const clampedZ = Math.max(-halfD, Math.min(halfD, pz));

    const dx = px - clampedX;
    const dz = pz - clampedZ;
    const distSqVal = dx * dx + dz * dz;

    if (distSqVal < pen.radius * pen.radius) {
      const dist = Math.sqrt(distSqVal);
      const penVal = pen.radius - dist;
      if (penVal > maxPenetration) {
        maxPenetration = penVal;
        const normX = dist > 0.0001 ? dx / dist : 0;
        const normZ = dist > 0.0001 ? dz / dist : 1;
        bestNormal = { x: normX, z: normZ };
        bestPoint = {
          x: seg.a.x + (seg.b.x - seg.a.x) * t,
          z: seg.a.z + (seg.b.z - seg.a.z) * t
        };
        collided = true;
      }
    }
  }

  if (collided && maxPenetration > 0) {
    // Transform normal back to world space
    const cosW = Math.cos(obstacle.rotation);
    const sinW = Math.sin(obstacle.rotation);
    const worldNx = bestNormal.x * cosW - bestNormal.z * sinW;
    const worldNz = bestNormal.x * sinW + bestNormal.z * cosW;

    // Push out
    pen.pos.x += worldNx * maxPenetration;
    pen.pos.z += worldNz * maxPenetration;

    // Bounce
    const rx = bestPoint.x - pen.pos.x;
    const rz = bestPoint.z - pen.pos.z;
    const vcx = pen.vel.x - pen.angVel * rz;
    const vcz = pen.vel.z + pen.angVel * rx;
    const vn = vcx * worldNx + vcz * worldNz;

    if (vn < 0) {
      const rCrossN = cross2D(rx, rz, worldNx, worldNz);
      const invM = 1 / pen.mass;
      const invI = 1 / pen.inertia;
      const k = invM + (rCrossN * rCrossN) * invI;
      const j = -(1 + pen.bounciness * 0.7) * vn / k;

      pen.vel.x += j * worldNx * invM;
      pen.vel.z += j * worldNz * invM;
      pen.angVel += rCrossN * j * invI;

      if (onBump) {
        onBump(Math.abs(vn));
      }
    }
    return true;
  }

  return false;
}
