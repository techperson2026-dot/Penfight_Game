// Intelligent Pen Fight AI Opponent

export class PenBot {
  constructor(difficulty = 'benchmate') {
    this.difficulty = difficulty; // 'rookie', 'benchmate', 'backbencher'
  }

  setDifficulty(diff) {
    this.difficulty = diff;
  }

  // Calculate the best shot given AI pen, player pen, and table bounds
  calculateShot(aiPen, playerPen, tableBounds) {
    const halfW = tableBounds.width * 0.5;
    const halfD = tableBounds.depth * 0.5;

    // Vector from AI to Player
    const dx = playerPen.pos.x - aiPen.pos.x;
    const dz = playerPen.pos.z - aiPen.pos.z;
    const dist = Math.sqrt(dx * dx + dz * dz);

    // Closest table edge to player pen
    const distToLeft = playerPen.pos.x - (-halfW);
    const distToRight = halfW - playerPen.pos.x;
    const distToTop = halfD - playerPen.pos.z;
    const distToBottom = playerPen.pos.z - (-halfD);
    const minEdgeDist = Math.min(distToLeft, distToRight, distToTop, distToBottom);

    // Base aim angle directly at player
    let aimAngle = Math.atan2(dx, dz);

    // Base power estimation based on distance
    // Base table depth is ~22 units, max distance ~25 units
    let desiredPower = Math.min(1.0, 0.35 + (dist / 22.0) * 0.5);

    // If player is vulnerable near the edge, dial up the knockout power!
    if (minEdgeDist < 4.0) {
      desiredPower = Math.min(1.0, desiredPower * 1.3);
    }

    // Default hit offset (0 = center flick, -0.8 to +0.8 = spin sweep)
    let hitOffset = 0.0;

    switch (this.difficulty) {
      case 'rookie': {
        // Classroom Rookie: high inaccuracy and random power variation
        const angleNoise = (Math.random() - 0.5) * (Math.PI / 8); // +/- 22 degrees
        aimAngle += angleNoise;
        desiredPower = Math.max(0.2, Math.min(0.9, desiredPower + (Math.random() - 0.5) * 0.3));
        hitOffset = (Math.random() - 0.5) * 0.4;
        break;
      }

      case 'benchmate': {
        // Average school benchmate: good aim, slight margin of error
        const angleNoise = (Math.random() - 0.5) * (Math.PI / 22); // +/- 8 degrees
        aimAngle += angleNoise;
        desiredPower = Math.max(0.3, Math.min(0.95, desiredPower + (Math.random() - 0.5) * 0.15));

        // Use sweep spin if distance is medium
        if (dist < 10) {
          hitOffset = Math.random() > 0.5 ? 0.45 : -0.45;
        }
        break;
      }

      case 'backbencher':
      default: {
        // Backbencher Pro: lethal calculations, tactical edge push & helicopter sweep
        // Micro angle noise
        const angleNoise = (Math.random() - 0.5) * (Math.PI / 60); // +/- 3 degrees
        aimAngle += angleNoise;

        // If player is very close, use helicopter sweep flick
        if (dist < 8.0) {
          hitOffset = 0.75 * (Math.random() > 0.5 ? 1 : -1);
          desiredPower = Math.min(1.0, desiredPower * 1.15);
        } else {
          // Sharp direct missile flick
          desiredPower = Math.min(1.0, desiredPower * 1.05);
          hitOffset = 0.15 * (Math.random() - 0.5);
        }

        // Check if AI is too close to its own edge; if so, avoid self-destruct overshoot
        const aiDistToEdge = Math.min(
          aiPen.pos.x - (-halfW),
          halfW - aiPen.pos.x,
          halfD - aiPen.pos.z,
          aiPen.pos.z - (-halfD)
        );
        if (aiDistToEdge < 2.5 && desiredPower > 0.75) {
          desiredPower = 0.65; // Controlled strike
        }
        break;
      }
    }

    // Direction vector
    const dirX = Math.sin(aimAngle);
    const dirZ = Math.cos(aimAngle);

    return {
      dirX,
      dirZ,
      power: desiredPower,
      hitOffset
    };
  }
}
