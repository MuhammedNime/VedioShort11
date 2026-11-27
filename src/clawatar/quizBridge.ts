import {
  DEFAULT_AVATAR_AUTO_BEHAVIORS,
  type AvatarManualStateId,
  type ClawatarBgMode,
  type ClawatarExpression,
  type TemplateSettings,
} from '../types/quiz';
import type { PresenterChoreography } from '../canvas/presenterRenderer';
import { soundEngine } from '../audio/soundEngine';
import {
  CLAWATAR_STATE_PRESETS,
  mapPresenterPoseToClawatar,
  resolveClawatarModelUrl,
} from './catalog';
import {
  getQuizClawatarEngine,
  preloadClawatarVrma,
  resetQuizClawatarTimer,
  setQuizClawatarRenderMode,
  stepQuizClawatarLive,
} from './ClawatarEngine';

export interface ResolvedClawatarMotion {
  actionId: string;
  loop: boolean;
  expression: Exclude<ClawatarExpression, 'auto'>;
  expressionWeight: number;
}

const LOOPING_ACTION_PREFIXES = [
  '119_Idle',
  '86_Talking',
  '71_Singing',
  '127_Leaning',
  '142_Sad Idle',
  '149_Sitting Idle',
  '75_Sitting',
  '76_Sitting_2',
  'reze_dance_hard',
];
const LOOPING_DM_IDS = new Set([
  'dm_0', 'dm_5', 'dm_6', 'dm_7', 'dm_13', 'dm_14', 'dm_15', 'dm_17',
  'dm_22', 'dm_23', 'dm_24', 'dm_33', 'dm_38', 'dm_46', 'dm_59', 'dm_63',
  'dm_82', 'dm_85', 'dm_86', 'dm_87', 'dm_88', 'dm_89', 'dm_90', 'dm_97',
  'dm_101', 'dm_110', 'dm_111', 'dm_114', 'dm_120', 'dm_121', 'dm_122',
  'dm_123', 'dm_124', 'dm_125', 'dm_126', 'dm_127', 'dm_128', 'dm_129',
  'dm_138', 'dm_139',
]);

let clawatarLivePlaying = false;
let clawatarDemoActive = false;
let demoClawatarStateOverride: AvatarManualStateId | null = null;

export function setClawatarDemoStateOverride(stateId: AvatarManualStateId | null): void {
  demoClawatarStateOverride = stateId;
}

export function setClawatarLivePlaybackState(
  isPlaying: boolean,
  isDemoActive = false
): void {
  const wasMoving = clawatarLivePlaying || clawatarDemoActive;
  clawatarLivePlaying = isPlaying;
  clawatarDemoActive = isDemoActive;
  if (!isDemoActive) {
    demoClawatarStateOverride = null;
  }
  const isNowMoving = clawatarLivePlaying || clawatarDemoActive;
  if (wasMoving && !isNowMoving) {
    resetQuizClawatarTimer();
  }
}

export function restoreClawatarPreviewSize(): void {
  setQuizClawatarRenderMode('preview');
  resetQuizClawatarTimer();
}

function inferShouldLoop(actionId: string): boolean {
  if (LOOPING_DM_IDS.has(actionId)) return true;
  if (LOOPING_ACTION_PREFIXES.includes(actionId)) return true;
  if (
    actionId.includes('Dancing') ||
    actionId.includes('Dance') ||
    actionId.includes('Idle')
  ) {
    return true;
  }
  return false;
}

export function resolveClawatarMotionForChoreo(
  template: TemplateSettings,
  choreo: PresenterChoreography
): ResolvedClawatarMotion {
  const autoBehaviors = {
    ...DEFAULT_AVATAR_AUTO_BEHAVIORS,
    ...(template.avatarAutoBehaviors ?? {}),
  };
  const isLive = choreo.isLivePlayback ?? clawatarLivePlaying;

  if (clawatarDemoActive && demoClawatarStateOverride) {
    const demoPreset = CLAWATAR_STATE_PRESETS.find(
      (s) => s.stateId === demoClawatarStateOverride
    );
    if (demoPreset) {
      return {
        actionId: demoPreset.actionId,
        loop: demoPreset.loop,
        expression: demoPreset.expression,
        expressionWeight: demoPreset.expressionWeight,
      };
    }
  }

  const autoMapped = mapPresenterPoseToClawatar(choreo.pose, choreo.phase);
  const phaseKey = choreo.phase as keyof NonNullable<
    TemplateSettings['clawatarPhaseActions']
  >;
  const phaseOverride = template.clawatarPhaseActions?.[phaseKey];
  const defaultOverride =
    template.clawatarDefaultAction && template.clawatarDefaultAction !== 'auto'
      ? template.clawatarDefaultAction
      : undefined;

  const motionMode = template.avatarMotionMode || 'manualThenAuto';
  const manualStateId = template.avatarManualState;
  const manualPreset = manualStateId
    ? CLAWATAR_STATE_PRESETS.find((s) => s.stateId === manualStateId)
    : undefined;
  const useManualState =
    Boolean(manualPreset) &&
    !choreo.isDemoActive &&
    (motionMode === 'manualLocked' || (motionMode === 'manualThenAuto' && !isLive));

  const chosenAction =
    phaseOverride && phaseOverride !== 'auto'
      ? phaseOverride
      : useManualState && manualPreset
        ? manualPreset.actionId
        : defaultOverride || autoMapped.actionId;

  const chosenLoop =
    useManualState && manualPreset
      ? manualPreset.loop
      : chosenAction === autoMapped.actionId
        ? autoMapped.loop
        : inferShouldLoop(chosenAction);

  const exprSetting = template.clawatarExpression || 'auto';
  const baseAutoExpr =
    useManualState && manualPreset
      ? manualPreset.expression
      : autoBehaviors.autoMicroExpressions === false
        ? 'neutral'
        : autoMapped.expression;
  const baseAutoWeight =
    useManualState && manualPreset
      ? manualPreset.expressionWeight
      : autoBehaviors.autoMicroExpressions === false
        ? 0
        : autoMapped.expressionWeight;

  const expression: Exclude<ClawatarExpression, 'auto'> =
    exprSetting === 'auto' ? baseAutoExpr : exprSetting;
  const expressionWeight =
    exprSetting === 'auto'
      ? baseAutoWeight
      : exprSetting === 'neutral'
        ? 0
        : 0.85;

  return {
    actionId: chosenAction,
    loop: chosenLoop,
    expression,
    expressionWeight,
  };
}

export function syncClawatarQuizPreview(
  template: TemplateSettings,
  choreo: PresenterChoreography,
  overrideDt?: number
): void {
  const engine = getQuizClawatarEngine();
  const modelUrl = resolveClawatarModelUrl(
    template.clawatarModelId,
    template.clawatarCustomModelUrl
  );

  if (engine.getModelUrl() !== modelUrl && !engine.isLoading()) {
    void engine.loadModel(modelUrl);
  }

  const autoBehaviors = {
    ...DEFAULT_AVATAR_AUTO_BEHAVIORS,
    ...(template.avatarAutoBehaviors ?? {}),
  };
  engine.setBehaviorFlags({
    blinkAndBreath: autoBehaviors.naturalBlinkAndBreathing !== false,
    headNodOnSpeech: autoBehaviors.headAndHandsWhileTalking !== false,
    lipSyncEnabled: autoBehaviors.lipSyncWithVoice !== false,
    microExpressions: autoBehaviors.autoMicroExpressions !== false,
  });

  const liveVoiceAmp =
    autoBehaviors.lipSyncWithVoice !== false ? soundEngine.getLiveVoiceAmplitude() : 0;
  const isMoving =
    clawatarLivePlaying ||
    clawatarDemoActive ||
    (overrideDt !== undefined && overrideDt > 0) ||
    liveVoiceAmp > 0.02;

  engine.setCameraPreset(
    template.clawatarCameraPreset || 'upperBody',
    template.clawatarScaleZoom ?? 1,
    template.clawatarYawDeg ?? 0,
    !isMoving
  );

  const motion = resolveClawatarMotionForChoreo(template, choreo);
  engine.requestActionSync(motion.actionId, motion.loop, isMoving ? 0.35 : 0.15);
  engine.setExpression(motion.expression, motion.expressionWeight, isMoving ? 4.5 : 20);

  if (!isMoving) {
    engine.stepFrozen(0);
    return;
  }

  const talkScale = Math.max(0.2, Math.min(1.3, (template.presenterTalkIntensity ?? 70) / 70));
  const rawSpeech =
    autoBehaviors.lipSyncWithVoice === false
      ? 0
      : Math.max(
          choreo.isSpeaking ? choreo.mouthOpen * 0.85 + choreo.speechEnergy * 0.35 : 0,
          liveVoiceAmp
        );
  const mouth = rawSpeech > 0.03 ? Math.max(0.16, Math.min(1, rawSpeech * talkScale)) : 0;

  stepQuizClawatarLive(mouth, overrideDt, 28);
}

export async function prepareClawatarForExport(
  template: TemplateSettings
): Promise<void> {
  if (!template.presenterEnabled || template.presenterStyle !== 'clawatar3d') {
    return;
  }
  setQuizClawatarRenderMode('export');
  const engine = getQuizClawatarEngine();
  const modelUrl = resolveClawatarModelUrl(
    template.clawatarModelId,
    template.clawatarCustomModelUrl
  );

  await engine.loadModel(modelUrl);
  engine.setCameraPreset(
    template.clawatarCameraPreset || 'upperBody',
    template.clawatarScaleZoom ?? 1,
    template.clawatarYawDeg ?? 0,
    true
  );

  const candidateActions = new Set<string>([
    '119_Idle',
    '161_Waving',
    '86_Talking',
    'dm_0',
    'dm_90',
    '88_Thinking',
    'dm_42',
    '19_Clapping',
    '49_Joyful Jump',
    '156_Thankful',
    'dm_134',
    'dm_108',
    'dm_3',
    '145_Shrugging',
  ]);
  if (template.clawatarDefaultAction && template.clawatarDefaultAction !== 'auto') {
    candidateActions.add(template.clawatarDefaultAction);
  }
  if (template.clawatarPhaseActions) {
    for (const val of Object.values(template.clawatarPhaseActions)) {
      if (val && val !== 'auto') candidateActions.add(val);
    }
  }

  await Promise.allSettled(
    Array.from(candidateActions).map((id) => preloadClawatarVrma(id))
  );
}

export async function stepClawatarForExportFrame(
  template: TemplateSettings,
  choreo: PresenterChoreography,
  dt: number
): Promise<void> {
  if (!template.presenterEnabled || template.presenterStyle !== 'clawatar3d') {
    return;
  }
  const engine = getQuizClawatarEngine();
  if (!engine.isReady()) {
    const modelUrl = resolveClawatarModelUrl(
      template.clawatarModelId,
      template.clawatarCustomModelUrl
    );
    await engine.loadModel(modelUrl);
  }

  engine.setCameraPreset(
    template.clawatarCameraPreset || 'upperBody',
    template.clawatarScaleZoom ?? 1,
    template.clawatarYawDeg ?? 0,
    true
  );

  const autoBehaviors = {
    ...DEFAULT_AVATAR_AUTO_BEHAVIORS,
    ...(template.avatarAutoBehaviors ?? {}),
  };
  engine.setBehaviorFlags({
    blinkAndBreath: autoBehaviors.naturalBlinkAndBreathing !== false,
    headNodOnSpeech: autoBehaviors.headAndHandsWhileTalking !== false,
    lipSyncEnabled: autoBehaviors.lipSyncWithVoice !== false,
    microExpressions: autoBehaviors.autoMicroExpressions !== false,
  });

  const motion = resolveClawatarMotionForChoreo(template, {
    ...choreo,
    isLivePlayback: true,
  });
  engine.setExpression(motion.expression, motion.expressionWeight, 12);

  const talkScale = Math.max(0.2, Math.min(1.3, (template.presenterTalkIntensity ?? 70) / 70));
  const mouth =
    autoBehaviors.lipSyncWithVoice !== false && choreo.isSpeaking
      ? Math.max(
          0.18,
          Math.min(1, (choreo.mouthOpen * 0.8 + choreo.speechEnergy * 0.45) * talkScale)
        )
      : 0;

  await engine.ensureActionReadyAndStep(motion.actionId, motion.loop, dt);
  engine.step(0.0001, mouth);
}

export function drawClawatarBackdrop(
  ctx: CanvasRenderingContext2D,
  bgMode: ClawatarBgMode,
  x: number,
  y: number,
  w: number,
  h: number,
  time: number
): void {
  if (bgMode === 'transparent') return;

  if (bgMode === 'white') {
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(x, y, w, h);
    return;
  }

  const cx = x + w / 2;
  const cy = y + h / 2;

  if (bgMode === 'sakura') {
    const grad = ctx.createLinearGradient(x, y, x, y + h);
    grad.addColorStop(0, '#3b1c4a');
    grad.addColorStop(0.55, '#6b285c');
    grad.addColorStop(1, '#261033');
    ctx.fillStyle = grad;
    ctx.fillRect(x, y, w, h);

    for (let i = 0; i < 6; i++) {
      const px = x + ((i * 0.19 + time * 0.04) % 1) * w;
      const py = y + ((i * 0.23 + time * 0.06) % 1) * h;
      ctx.fillStyle = 'rgba(255, 192, 224, 0.22)';
      ctx.beginPath();
      ctx.ellipse(px, py, 6, 3.5, time + i, 0, Math.PI * 2);
      ctx.fill();
    }
    return;
  }

  if (bgMode === 'cyber') {
    const grad = ctx.createLinearGradient(x, y, x + w, y + h);
    grad.addColorStop(0, '#07142b');
    grad.addColorStop(0.5, '#0e2849');
    grad.addColorStop(1, '#1a0f3c');
    ctx.fillStyle = grad;
    ctx.fillRect(x, y, w, h);

    const pulse = 0.08 + 0.04 * Math.sin(time * 2.2);
    ctx.strokeStyle = `rgba(56, 189, 248, ${pulse})`;
    ctx.lineWidth = 1.5;
    for (let gx = x + w * 0.2; gx < x + w; gx += w * 0.2) {
      ctx.beginPath();
      ctx.moveTo(gx, y);
      ctx.lineTo(gx, y + h);
      ctx.stroke();
    }
    return;
  }

  // Default: rich broadcast studio backdrop
  const studioBg = ctx.createRadialGradient(
    cx,
    cy - h * 0.15,
    w * 0.08,
    cx,
    cy,
    h * 0.85
  );
  studioBg.addColorStop(0, '#1e3a6e');
  studioBg.addColorStop(0.55, '#0f2044');
  studioBg.addColorStop(1, '#070d1f');
  ctx.fillStyle = studioBg;
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = 'rgba(237, 214, 162, 0.05)';
  ctx.fillRect(x + w * 0.12, y, w * 0.06, h);
  ctx.fillRect(x + w * 0.82, y, w * 0.06, h);
}

export { preloadClawatarVrma };
