// ── Tree gameplay stat calculations ──

export const GROWTH_BASE_RATE = 0.002;     // height/second base
export const GROWTH_ROOT_BONUS = 0.001;    // additional height/second per root
export const ROOT_HP_COST = 15;            // HP cost to create a root
export const DIRECTED_ROOT_COST_MULT = 3;  // directed root costs 3x
export const HP_REGEN_RATE = 0.5;          // HP/second regeneration
export const MAX_HEIGHT = 100;
export const BRANCH_HEIGHT_INTERVAL = 10;  // 1 new branch per 10 height

export const ROOT_GROWTH_RATE = 0.3;       // pixels/second root extension
export const ROOT_MAX_LENGTH = 80;         // max root length in pixels
export const ROOT_INITIAL_LENGTH = 8;      // roots start small and grow

export function getBranchCount(height) {
  return Math.floor(height / BRANCH_HEIGHT_INTERVAL);
}

export function getLeafSize(height) {
  return Math.min(1, 0.1 + height * 0.009);
}

export function getVitality(height) {
  const branches = getBranchCount(height);
  const leafSize = getLeafSize(height);
  return Math.floor(height * 2 + branches * 15 + leafSize * 50);
}

export function getGrowthRate(roots) {
  return GROWTH_BASE_RATE + (roots?.length ?? 0) * GROWTH_ROOT_BONUS;
}

export function getTrunkDimensions(height) {
  return {
    trunkH: 10 + height * 0.5,
    trunkW: 6 + height * 0.18,
    canopyR: 5 + height * 0.55,
  };
}

export function tickGrowth(state, deltaSec) {
  const rate = getGrowthRate(state.roots);
  const height = Math.min(MAX_HEIGHT, state.height + rate * deltaSec);
  const vitality = getVitality(height);
  const currentHP = Math.min(vitality, state.currentHP + HP_REGEN_RATE * deltaSec);

  // Grow existing roots gradually
  let roots = state.roots;
  if (roots.length > 0) {
    let changed = false;
    roots = roots.map(r => {
      if (r.length >= ROOT_MAX_LENGTH) return r;
      changed = true;
      return { ...r, length: Math.min(ROOT_MAX_LENGTH, r.length + ROOT_GROWTH_RATE * deltaSec) };
    });
    if (!changed) roots = state.roots; // avoid unnecessary copies
  }

  return { ...state, height, currentHP, roots };
}

export function canCreateRoot(state) {
  return state.currentHP >= ROOT_HP_COST;
}

export function canCreateDirectedRoot(state) {
  return state.currentHP >= ROOT_HP_COST * DIRECTED_ROOT_COST_MULT;
}

export function createRoot(state) {
  if (!canCreateRoot(state)) return null;
  const rootIndex = state.roots.length;
  const side = rootIndex % 2 === 0 ? 1 : -1;
  const baseAngle = Math.PI * 0.5;
  const spread = Math.PI * 0.35 * side * (0.5 + Math.random() * 0.5);
  const angle = baseAngle + spread;
  return {
    ...state,
    currentHP: state.currentHP - ROOT_HP_COST,
    roots: [...(state.roots || []), { angle, length: ROOT_INITIAL_LENGTH }],
  };
}

export function createDirectedRoot(state, targetWorldX, targetWorldY) {
  const cost = ROOT_HP_COST * DIRECTED_ROOT_COST_MULT;
  if (state.currentHP < cost) return null;

  const dx = targetWorldX - state.x;
  const dy = targetWorldY - state.y;
  // atan2 with forced-positive y so root always goes downward
  let angle = Math.atan2(Math.max(dy, 10), dx);
  angle = Math.max(0.15, Math.min(Math.PI * 0.85, angle));

  return {
    ...state,
    currentHP: state.currentHP - cost,
    roots: [...(state.roots || []), { angle, length: ROOT_INITIAL_LENGTH }],
  };
}

export function createDefaultTreeState(x, y) {
  return {
    x, y,
    seed: Math.floor(Math.random() * 100000),
    height: 1,
    currentHP: 10,
    roots: [],
    lastUpdateTime: Date.now(),
    visionRadius: 6,
  };
}

export function migrateTreeState(tree) {
  return {
    ...tree,
    height: tree.height ?? 100,
    currentHP: tree.currentHP ?? getVitality(tree.height ?? 100),
    roots: tree.roots ?? [],
    lastUpdateTime: tree.lastUpdateTime ?? Date.now(),
    visionRadius: tree.visionRadius ?? 6,
  };
}
