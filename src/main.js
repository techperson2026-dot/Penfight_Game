import * as THREE from './libs/three.module.js';
import { sounds } from './audio/soundFX.js';
import { resolvePenPenCollision, resolvePenObstacleCollision } from './physics/collision.js';
import { Pen, PEN_PRESETS } from './entities/Pen.js';
import { ClassroomDesk } from './entities/Table.js';
import { PenBot } from './ai/PenBot.js';

// Game States
const STATE = {
  P1_TURN: 'P1_TURN',
  P2_TURN: 'P2_TURN',
  AI_THINKING: 'AI_THINKING',
  MOVING: 'MOVING',
  FALL_DRAMA: 'FALL_DRAMA',
  ROUND_OVER: 'ROUND_OVER',
  MATCH_OVER: 'MATCH_OVER'
};

class PenFightGame {
  constructor() {
    this.container = document.getElementById('canvas-container');
    this.table = new ClassroomDesk(16, 22, 10);
    this.tableBounds = this.table.getBounds();

    // Game Config & Options
    this.mode = 'pve'; // 'pve' or 'pvp'
    this.difficulty = 'benchmate';
    this.targetScore = 3;
    this.bot = new PenBot(this.difficulty);

    // Score & Round tracking
    this.p1Score = 0;
    this.p2Score = 0;
    this.currentRound = 1;
    this.state = STATE.P1_TURN;

    // Selected Pen Models
    this.p1PenType = 'reynolds_045';
    this.p2PenType = 'cello_gripper';

    // Three.js Core
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x0f172a);

    this.initCamera();
    this.initRenderer();
    this.initLighting();
    this.initSceneObjects();
    this.initAimGuides();

    // Input & Interaction
    this.raycaster = new THREE.Raycaster();
    this.mouse = new THREE.Vector2();
    this.tablePlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    this.isDragging = false;
    this.dragStart = new THREE.Vector3();
    this.dragCurrent = new THREE.Vector3();
    this.dragOffsetLocal = 0.0; // Along pen axis: -1 (cap) to +1 (tip)

    // UI Elements
    this.bindDOM();
    this.updateHUD();

    // Reset pens for round 1
    this.resetRound();

    // Event Listeners
    this.bindEvents();

    // Main animation loop
    this.clock = new THREE.Clock();
    this.animate = this.animate.bind(this);
    requestAnimationFrame(this.animate);
  }

  initCamera() {
    const aspect = window.innerWidth / window.innerHeight;
    this.camera = new THREE.PerspectiveCamera(45, aspect, 0.1, 100);

    // Default 3D Isometric View
    this.camViews = {
      iso: { pos: new THREE.Vector3(0, 22, 20), look: new THREE.Vector3(0, 0, 0) },
      topDown: { pos: new THREE.Vector3(0, 28, 0.01), look: new THREE.Vector3(0, 0, 0) }
    };
    this.currentViewMode = 'iso';
    this.cameraTargetPos = this.camViews.iso.pos.clone();
    this.cameraTargetLook = this.camViews.iso.look.clone();
    this.camera.position.copy(this.cameraTargetPos);
    this.camera.lookAt(this.cameraTargetLook);
  }

  initRenderer() {
    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.container.appendChild(this.renderer.domElement);
  }

  initLighting() {
    // Ambient light with soft blue classroom room tone
    const ambientLight = new THREE.AmbientLight(0xfff7ed, 0.75);
    this.scene.add(ambientLight);

    // Warm classroom window directional sunlight
    const dirLight = new THREE.DirectionalLight(0xffeedd, 1.4);
    dirLight.position.set(14, 26, 12);
    dirLight.castShadow = true;
    dirLight.shadow.mapSize.width = 2048;
    dirLight.shadow.mapSize.height = 2048;
    dirLight.shadow.camera.near = 0.5;
    dirLight.shadow.camera.far = 60;
    dirLight.shadow.camera.left = -16;
    dirLight.shadow.camera.right = 16;
    dirLight.shadow.camera.top = 16;
    dirLight.shadow.camera.bottom = -16;
    dirLight.shadow.bias = -0.0005;
    this.scene.add(dirLight);

    // Soft overhead classroom ceiling tube light
    const tubeLight = new THREE.PointLight(0xe0f2fe, 0.6, 40);
    tubeLight.position.set(-8, 16, -6);
    this.scene.add(tubeLight);
  }

  initSceneObjects() {
    // Classroom Desk Arena
    this.scene.add(this.table.group);

    // Instantiate Pens
    this.pen1 = new Pen(this.p1PenType, false);
    this.pen2 = new Pen(this.p2PenType, true);

    this.scene.add(this.pen1.mesh);
    this.scene.add(this.pen2.mesh);
  }

  initAimGuides() {
    // 3D Aiming Arrow & Trajectory Line
    this.aimGroup = new THREE.Group();
    this.aimGroup.visible = false;

    // Arrow line
    const lineMat = new THREE.LineBasicMaterial({ color: 0x38bdf8, linewidth: 3 });
    const lineGeo = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3(0, 0, 3)
    ]);
    this.aimLine = new THREE.Line(lineGeo, lineMat);
    this.aimGroup.add(this.aimLine);

    // Arrow Cone Tip
    const coneGeo = new THREE.ConeGeometry(0.32, 0.8, 16);
    coneGeo.rotateX(Math.PI / 2);
    this.aimConeMat = new THREE.MeshBasicMaterial({ color: 0x38bdf8 });
    this.aimCone = new THREE.Mesh(coneGeo, this.aimConeMat);
    this.aimCone.position.z = 3;
    this.aimGroup.add(this.aimCone);

    // Spin Offset Dot Indicator (where finger touches pen)
    const spinDotGeo = new THREE.SphereGeometry(0.18, 12, 12);
    const spinDotMat = new THREE.MeshBasicMaterial({ color: 0xf59e0b });
    this.spinDot = new THREE.Mesh(spinDotGeo, spinDotMat);
    this.aimGroup.add(this.spinDot);

    this.scene.add(this.aimGroup);
  }

  resetRound() {
    // Reset Pen positions:
    // P1 starts at the South side of desk, facing North
    // P2 starts at the North side of desk, facing South
    const startOffsetZ = this.tableBounds.depth * 0.34;
    this.pen1.reset(0, startOffsetZ, 0); // Facing North (rot = 0)
    this.pen2.reset(0, -startOffsetZ, Math.PI); // Facing South (rot = PI)

    this.aimGroup.visible = false;
    document.getElementById('power-gauge').style.display = 'none';

    // Round starting turn
    this.state = STATE.P1_TURN;
    this.updateHUD();
    this.updatePenHighlights();
  }

  updatePenHighlights() {
    this.pen1.setHighlight(this.state === STATE.P1_TURN);
    this.pen2.setHighlight(this.state === STATE.P2_TURN);
  }

  // Bind DOM elements and modals
  bindDOM() {
    this.p1ScoreEl = document.getElementById('p1-score');
    this.p2ScoreEl = document.getElementById('p2-score');
    this.roundLabelEl = document.getElementById('round-label');
    this.p1PenNameEl = document.getElementById('p1-pen-name');
    this.p2PenNameEl = document.getElementById('p2-pen-name');
    this.p2TitleEl = document.getElementById('p2-title');
    this.turnBannerEl = document.getElementById('turn-banner');
    this.turnTextEl = document.getElementById('turn-text');
    this.turnDotEl = document.getElementById('turn-dot');

    this.powerGaugeEl = document.getElementById('power-gauge');
    this.powerBarFillEl = document.getElementById('power-bar-fill');
    this.powerLabelEl = document.getElementById('power-label');
    this.spinLabelEl = document.getElementById('spin-label');

    this.announceBanner = document.getElementById('announcement-banner');
    this.announceTitle = document.getElementById('announce-title');
    this.announceSub = document.getElementById('announce-sub');
    this.btnNextRound = document.getElementById('btn-next-round');

    // Modals
    this.penModal = document.getElementById('pen-modal');
    this.settingsModal = document.getElementById('settings-modal');
    this.penGridContainer = document.getElementById('pen-grid-container');

    // Header buttons
    document.getElementById('btn-camera').addEventListener('click', () => this.toggleCameraView());
    document.getElementById('btn-sound').addEventListener('click', (e) => {
      const isMuted = sounds.toggleMute();
      e.target.textContent = isMuted ? '🔇' : '🔊';
    });
    document.getElementById('btn-pens').addEventListener('click', () => this.openPenModal());
    document.getElementById('btn-settings').addEventListener('click', () => this.openSettingsModal());
    document.getElementById('btn-reset').addEventListener('click', () => this.restartMatch());

    // Next round button
    this.btnNextRound.addEventListener('click', () => {
      this.announceBanner.classList.remove('show');
      if (this.state === STATE.MATCH_OVER) {
        this.restartMatch();
      } else {
        this.currentRound++;
        this.resetRound();
      }
    });

    // Pen Modal buttons
    document.getElementById('btn-close-pen-modal').addEventListener('click', () => this.penModal.classList.remove('active'));
    document.getElementById('btn-confirm-pens').addEventListener('click', () => {
      this.penModal.classList.remove('active');
      this.rebuildPens();
    });

    // Settings Modal
    document.getElementById('btn-close-settings-modal').addEventListener('click', () => this.settingsModal.classList.remove('active'));
    document.getElementById('btn-save-settings').addEventListener('click', () => this.applySettings());

    // Mode select change triggers AI difficulty row visibility
    const modeSelect = document.getElementById('select-mode');
    modeSelect.addEventListener('change', (e) => {
      const rowAi = document.getElementById('row-ai-difficulty');
      rowAi.style.display = e.target.value === 'pve' ? 'flex' : 'none';
    });
  }

  toggleCameraView() {
    if (this.currentViewMode === 'iso') {
      this.currentViewMode = 'topDown';
      this.cameraTargetPos.copy(this.camViews.topDown.pos);
      this.cameraTargetLook.copy(this.camViews.topDown.look);
    } else {
      this.currentViewMode = 'iso';
      this.cameraTargetPos.copy(this.camViews.iso.pos);
      this.cameraTargetLook.copy(this.camViews.iso.look);
    }
  }

  openPenModal() {
    this.penModal.classList.add('active');
    this.activePenTab = 'p1';
    this.renderPenGrid();

    const tabP1 = document.getElementById('tab-p1-pens');
    const tabP2 = document.getElementById('tab-p2-pens');
    tabP1.onclick = () => {
      this.activePenTab = 'p1';
      tabP1.style.background = 'linear-gradient(135deg, #2563eb, #1d4ed8)';
      tabP2.style.background = '#334155';
      this.renderPenGrid();
    };
    tabP2.onclick = () => {
      this.activePenTab = 'p2';
      tabP2.style.background = 'linear-gradient(135deg, #ef4444, #b91c1c)';
      tabP1.style.background = '#334155';
      this.renderPenGrid();
    };
  }

  renderPenGrid() {
    this.penGridContainer.innerHTML = '';
    const selectedKey = this.activePenTab === 'p1' ? this.p1PenType : this.p2PenType;

    Object.values(PEN_PRESETS).forEach((preset) => {
      const card = document.createElement('div');
      card.className = `pen-card ${preset.id === selectedKey ? 'selected' : ''}`;
      card.innerHTML = `
        <div class="pen-card-title">${preset.name}</div>
        <div class="pen-card-tag">${preset.tagline}</div>
        <div style="font-size: 11px; color: #94a3b8; margin: 4px 0;">${preset.description}</div>
        <div class="stat-row"><span>Speed / Accel</span><div class="stat-bar"><div class="stat-bar-fill" style="width: ${Math.min(100, (1.8 / preset.mass) * 55)}%"></div></div></div>
        <div class="stat-row"><span>Impact Mass</span><div class="stat-bar"><div class="stat-bar-fill" style="width: ${(preset.mass / 2.2) * 100}%"></div></div></div>
        <div class="stat-row"><span>Desk Grip</span><div class="stat-bar"><div class="stat-bar-fill" style="width: ${(preset.friction / 0.06) * 100}%"></div></div></div>
        <div class="stat-row"><span>Spin Control</span><div class="stat-bar"><div class="stat-bar-fill" style="width: ${(preset.spinFactor / 1.6) * 100}%"></div></div></div>
      `;
      card.onclick = () => {
        if (this.activePenTab === 'p1') {
          this.p1PenType = preset.id;
        } else {
          this.p2PenType = preset.id;
        }
        this.renderPenGrid();
      };
      this.penGridContainer.appendChild(card);
    });
  }

  rebuildPens() {
    this.scene.remove(this.pen1.mesh);
    this.scene.remove(this.pen2.mesh);
    this.pen1 = new Pen(this.p1PenType, false);
    this.pen2 = new Pen(this.p2PenType, true);
    this.scene.add(this.pen1.mesh);
    this.scene.add(this.pen2.mesh);
    this.resetRound();
  }

  openSettingsModal() {
    this.settingsModal.classList.add('active');
    document.getElementById('select-mode').value = this.mode;
    document.getElementById('select-difficulty').value = this.difficulty;
    document.getElementById('select-rounds').value = this.targetScore.toString();
    document.getElementById('row-ai-difficulty').style.display = this.mode === 'pve' ? 'flex' : 'none';
  }

  applySettings() {
    this.mode = document.getElementById('select-mode').value;
    this.difficulty = document.getElementById('select-difficulty').value;
    this.bot.setDifficulty(this.difficulty);
    this.targetScore = parseInt(document.getElementById('select-rounds').value, 10);
    this.settingsModal.classList.remove('active');
    this.restartMatch();
  }

  restartMatch() {
    this.announceBanner.classList.remove('show');
    this.p1Score = 0;
    this.p2Score = 0;
    this.currentRound = 1;
    this.resetRound();
  }

  updateHUD() {
    this.p1ScoreEl.textContent = this.p1Score;
    this.p2ScoreEl.textContent = this.p2Score;
    this.roundLabelEl.textContent = `ROUND ${this.currentRound} / ${this.targetScore}`;
    this.p1PenNameEl.textContent = PEN_PRESETS[this.p1PenType].name;
    this.p2PenNameEl.textContent = PEN_PRESETS[this.p2PenType].name;

    if (this.mode === 'pve') {
      const diffTitle = {
        rookie: 'Rookie (AI)',
        benchmate: 'Benchmate (AI)',
        backbencher: 'Backbencher ★ (AI)'
      }[this.difficulty] || 'AI Bot';
      this.p2TitleEl.textContent = diffTitle;
    } else {
      this.p2TitleEl.textContent = 'Player 2';
    }

    // Turn Banner message
    if (this.state === STATE.P1_TURN) {
      this.turnBannerEl.style.display = 'flex';
      this.turnDotEl.style.background = '#60a5fa';
      this.turnDotEl.style.boxShadow = '0 0 12px #60a5fa';
      this.turnTextEl.textContent = 'Player 1 Turn: Pull back pen to aim & flick!';
    } else if (this.state === STATE.P2_TURN) {
      this.turnBannerEl.style.display = 'flex';
      this.turnDotEl.style.background = '#f87171';
      this.turnDotEl.style.boxShadow = '0 0 12px #f87171';
      this.turnTextEl.textContent = 'Player 2 Turn: Pull back pen to aim & flick!';
    } else if (this.state === STATE.AI_THINKING) {
      this.turnBannerEl.style.display = 'flex';
      this.turnDotEl.style.background = '#fde047';
      this.turnDotEl.style.boxShadow = '0 0 12px #fde047';
      this.turnTextEl.textContent = `${this.p2TitleEl.textContent} is planning shot...`;
    } else {
      this.turnBannerEl.style.display = 'none';
    }
  }

  // Pointer & Drag Input Handling
  bindEvents() {
    window.addEventListener('resize', () => {
      this.camera.aspect = window.innerWidth / window.innerHeight;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(window.innerWidth, window.innerHeight);
    });

    const getTableIntersection = (e) => {
      const clientX = e.clientX || (e.touches && e.touches[0].clientX);
      const clientY = e.clientY || (e.touches && e.touches[0].clientY);
      if (clientX === undefined || clientY === undefined) return null;

      this.mouse.x = (clientX / window.innerWidth) * 2 - 1;
      this.mouse.y = -(clientY / window.innerHeight) * 2 + 1;

      this.raycaster.setFromCamera(this.mouse, this.camera);
      const intersection = new THREE.Vector3();
      const hit = this.raycaster.ray.intersectPlane(this.tablePlane, intersection);
      return hit ? intersection : null;
    };

    const onPointerDown = (e) => {
      // Allow only when it's P1 turn, or P2 turn in PvP mode
      const isPlayerTurn = (this.state === STATE.P1_TURN) || (this.state === STATE.P2_TURN && this.mode === 'pvp');
      if (!isPlayerTurn) return;

      const hit = getTableIntersection(e);
      if (!hit) return;

      const activePen = this.state === STATE.P1_TURN ? this.pen1 : this.pen2;
      const seg = activePen.getSegment();

      // Check distance from click point to pen segment
      const dx = hit.x - activePen.pos.x;
      const dz = hit.z - activePen.pos.z;
      const distToPen = Math.sqrt(dx * dx + dz * dz);

      // Generous grab radius around the pen
      if (distToPen <= activePen.length * 0.75 + 0.8) {
        this.isDragging = true;
        this.dragStart.copy(hit);
        this.dragCurrent.copy(hit);

        // Calculate offset along pen length (-1 cap, +1 tip) for spin torque
        const cos = Math.cos(activePen.rot);
        const sin = Math.sin(activePen.rot);
        // Project onto pen axis: body vector is (sin, cos)
        const proj = dx * sin + dz * cos;
        this.dragOffsetLocal = Math.max(-1.0, Math.min(1.0, proj / (activePen.length * 0.5)));

        this.aimGroup.visible = true;
        this.powerGaugeEl.style.display = 'flex';
        this.updateAimVisuals(activePen);
      }
    };

    const onPointerMove = (e) => {
      if (!this.isDragging) return;
      const hit = getTableIntersection(e);
      if (!hit) return;

      this.dragCurrent.copy(hit);
      const activePen = this.state === STATE.P1_TURN ? this.pen1 : this.pen2;
      this.updateAimVisuals(activePen);
    };

    const onPointerUp = () => {
      if (!this.isDragging) return;
      this.isDragging = false;
      this.aimGroup.visible = false;
      this.powerGaugeEl.style.display = 'none';

      const activePen = this.state === STATE.P1_TURN ? this.pen1 : this.pen2;

      // Pull back vector (drag from pen backward -> flick shoots forward!)
      const dragDx = this.dragStart.x - this.dragCurrent.x;
      const dragDz = this.dragStart.z - this.dragCurrent.z;
      const dragDist = Math.sqrt(dragDx * dragDx + dragDz * dragDz);

      const maxDrag = 5.2;
      const power = Math.min(1.0, dragDist / maxDrag);

      // Require minimum flick pull
      if (power >= 0.06) {
        const dirX = dragDx / dragDist;
        const dirZ = dragDz / dragDist;

        sounds.playFlick(power);
        activePen.applyFlick(dirX, dirZ, power, this.dragOffsetLocal);

        this.state = STATE.MOVING;
        this.updateHUD();
      }
    };

    // Attach mouse and touch listeners
    window.addEventListener('mousedown', onPointerDown);
    window.addEventListener('mousemove', onPointerMove);
    window.addEventListener('mouseup', onPointerUp);

    window.addEventListener('touchstart', onPointerDown, { passive: true });
    window.addEventListener('touchmove', onPointerMove, { passive: true });
    window.addEventListener('touchend', onPointerUp);
  }

  updateAimVisuals(activePen) {
    const dragDx = this.dragStart.x - this.dragCurrent.x;
    const dragDz = this.dragStart.z - this.dragCurrent.z;
    const dragDist = Math.sqrt(dragDx * dragDx + dragDz * dragDz);

    const maxDrag = 5.2;
    const power = Math.min(1.0, dragDist / maxDrag);

    // Aim direction
    let dirX = 0, dirZ = 1;
    if (dragDist > 0.05) {
      dirX = dragDx / dragDist;
      dirZ = dragDz / dragDist;
    }

    const angle = Math.atan2(dirX, dirZ);

    // Position aim group at the pen center
    this.aimGroup.position.set(activePen.pos.x, activePen.pos.y + 0.15, activePen.pos.z);
    this.aimGroup.rotation.y = angle;

    // Arrow length based on power
    const arrowLen = Math.max(0.6, power * 7.5);
    const positions = this.aimLine.geometry.attributes.position.array;
    positions[3] = 0;
    positions[4] = 0;
    positions[5] = arrowLen;
    this.aimLine.geometry.attributes.position.needsUpdate = true;

    this.aimCone.position.z = arrowLen;

    // Dynamic color gradient based on power (Green -> Yellow -> Red)
    let arrowColor = 0x22c55e;
    if (power > 0.7) {
      arrowColor = 0xef4444; // Red
    } else if (power > 0.35) {
      arrowColor = 0xeab308; // Yellow
    }
    this.aimLine.material.color.setHex(arrowColor);
    this.aimConeMat.color.setHex(arrowColor);

    // Spin dot indicator on pen body
    const halfL = activePen.length * 0.5;
    const spinLocalZ = this.dragOffsetLocal * halfL;
    this.spinDot.position.set(0, 0, spinLocalZ);

    // Update HUD Power Bar
    const powerPercent = Math.round(power * 100);
    this.powerBarFillEl.style.width = `${powerPercent}%`;
    this.powerLabelEl.textContent = `POWER: ${powerPercent}%`;

    let spinText = 'SPIN: CENTER (STRAIGHT)';
    if (this.dragOffsetLocal > 0.3) spinText = 'SPIN: TIP (RIGHT SWEEP)';
    else if (this.dragOffsetLocal < -0.3) spinText = 'SPIN: CAP (LEFT SWEEP)';
    this.spinLabelEl.textContent = spinText;
  }

  // AI Turn Execution
  triggerAITurn() {
    this.state = STATE.AI_THINKING;
    this.updateHUD();
    this.updatePenHighlights();

    // AI thinking delay for natural gameplay pacing
    setTimeout(() => {
      if (this.state !== STATE.AI_THINKING) return;

      const shot = this.bot.calculateShot(this.pen2, this.pen1, this.tableBounds);

      // Show brief AI aim arrow for visual feedback
      this.aimGroup.position.set(this.pen2.pos.x, this.pen2.pos.y + 0.15, this.pen2.pos.z);
      const angle = Math.atan2(shot.dirX, shot.dirZ);
      this.aimGroup.rotation.y = angle;

      const arrowLen = Math.max(0.6, shot.power * 7.5);
      const positions = this.aimLine.geometry.attributes.position.array;
      positions[5] = arrowLen;
      this.aimLine.geometry.attributes.position.needsUpdate = true;
      this.aimCone.position.z = arrowLen;
      this.aimLine.material.color.setHex(0xf87171);
      this.aimConeMat.color.setHex(0xf87171);
      this.aimGroup.visible = true;

      // Execute AI flick after brief aim preview
      setTimeout(() => {
        this.aimGroup.visible = false;
        sounds.playFlick(shot.power);
        this.pen2.applyFlick(shot.dirX, shot.dirZ, shot.power, shot.hitOffset);

        this.state = STATE.MOVING;
        this.updateHUD();
      }, 500);
    }, 700);
  }

  // Check round outcome and winners
  checkRoundEnd() {
    const p1Fell = this.pen1.isFalling;
    const p2Fell = this.pen2.isFalling;

    if (p1Fell || p2Fell) {
      this.state = STATE.ROUND_OVER;

      let roundWinner = null;
      if (p1Fell && p2Fell) {
        // Both fell off: tie or sudden reset
        this.announceTitle.textContent = 'DOUBLE KNOCKOUT!';
        this.announceSub.textContent = 'Both pens tumbled off the desk! Replaying round.';
      } else if (p2Fell) {
        // P1 Won round
        this.p1Score++;
        roundWinner = 'Player 1';
        sounds.playRoundWin();
        this.announceTitle.textContent = 'KNOCKOUT!';
        this.announceSub.textContent = `Player 1 knocked the opponent off the desk! (+1 Point)`;
      } else if (p1Fell) {
        // P2 Won round
        this.p2Score++;
        roundWinner = this.mode === 'pve' ? this.p2TitleEl.textContent : 'Player 2';
        if (this.mode === 'pve') {
          sounds.playRoundLose();
        } else {
          sounds.playRoundWin();
        }
        this.announceTitle.textContent = 'KNOCKOUT!';
        this.announceSub.textContent = `${roundWinner} pushed your pen off the desk!`;
      }

      this.updateHUD();

      // Check Match Victory
      if (this.p1Score >= this.targetScore || this.p2Score >= this.targetScore) {
        this.state = STATE.MATCH_OVER;
        const matchWinner = this.p1Score >= this.targetScore ? 'Player 1' : (this.mode === 'pve' ? this.p2TitleEl.textContent : 'Player 2');
        this.announceTitle.textContent = 'CHAMPION OF THE BENCH!';
        this.announceSub.textContent = `🏆 ${matchWinner} won the match (${this.p1Score} - ${this.p2Score})!`;
        this.btnNextRound.textContent = 'PLAY AGAIN';
      } else {
        this.btnNextRound.textContent = 'NEXT ROUND';
      }

      // Show celebration banner after brief fall tumble
      setTimeout(() => {
        this.announceBanner.classList.add('show');
      }, 1100);

      return;
    }

    // Both pens survived on table! Switch turn.
    if (this.previousTurn === STATE.P1_TURN) {
      if (this.mode === 'pve') {
        this.triggerAITurn();
      } else {
        this.state = STATE.P2_TURN;
        this.updateHUD();
        this.updatePenHighlights();
      }
    } else {
      this.state = STATE.P1_TURN;
      this.updateHUD();
      this.updatePenHighlights();
    }
  }

  // Physics Simulation Step
  updatePhysics(dt) {
    // 5 Sub-steps per frame for high collision precision
    const subSteps = 5;
    const subDt = dt / subSteps;

    for (let s = 0; s < subSteps; s++) {
      // 1. Update pens
      this.pen1.update(subDt, this.tableBounds);
      this.pen2.update(subDt, this.tableBounds);

      // 2. Pen-to-Pen collision
      resolvePenPenCollision(this.pen1, this.pen2, (impact, isMetal) => {
        sounds.playCollision(impact, isMetal);
      });

      // 3. Pen-to-Obstacle collisions (Ruler, Eraser)
      this.table.obstacles.forEach((obs) => {
        resolvePenObstacleCollision(this.pen1, obs, (impact) => {
          sounds.playDeskBump(impact);
        });
        resolvePenObstacleCollision(this.pen2, obs, (impact) => {
          sounds.playDeskBump(impact);
        });
      });
    }

    // Audio for falling off desk
    if (this.pen1.isFalling && !this.pen1.hasPlayedFallSound) {
      this.pen1.hasPlayedFallSound = true;
      sounds.playFall();
    }
    if (this.pen2.isFalling && !this.pen2.hasPlayedFallSound) {
      this.pen2.hasPlayedFallSound = true;
      sounds.playFall();
    }

    // Turn resolution when all motion has ceased
    if (this.state === STATE.MOVING) {
      const p1Settled = this.pen1.isResting || this.pen1.pos.y < -6;
      const p2Settled = this.pen2.isResting || this.pen2.pos.y < -6;

      if (p1Settled && p2Settled) {
        this.checkRoundEnd();
      }
    }
  }

  // Main Render & Animation Loop
  animate() {
    requestAnimationFrame(this.animate);

    const dt = Math.min(this.clock.getDelta(), 0.05);

    // Save turn before moving so we know who flicked
    if (this.state === STATE.P1_TURN || this.state === STATE.P2_TURN || this.state === STATE.AI_THINKING) {
      this.previousTurn = this.state;
    }

    // Update Physics
    this.updatePhysics(dt);

    // Smooth Camera lerp
    this.camera.position.lerp(this.cameraTargetPos, dt * 3.5);
    this.camera.lookAt(this.cameraTargetLook);

    // Render Scene
    this.renderer.render(this.scene, this.camera);
  }
}

// Start Game when DOM is loaded
window.addEventListener('DOMContentLoaded', () => {
  new PenFightGame();
});
