import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { VRMLoaderPlugin, VRMUtils, type VRM } from '@pixiv/three-vrm';
import {
  createVRMAnimationClip,
  VRMAnimationLoaderPlugin,
  VRMLookAtQuaternionProxy,
  type VRMAnimation,
} from '@pixiv/three-vrm-animation';
import type { ClawatarCameraPreset, ClawatarExpression } from '../types/quiz';
import { withClawatarBasePath } from './catalog';

const globalVrmaCache = new Map<string, VRMAnimation>();
const globalVrmaInflight = new Map<string, Promise<VRMAnimation>>();

const frameReadyListeners = new Set<() => void>();
export function subscribeClawatarFrameReady(cb: () => void): () => void {
  frameReadyListeners.add(cb);
  return () => {
    frameReadyListeners.delete(cb);
  };
}
function notifyClawatarFrameReady(): void {
  frameReadyListeners.forEach((cb) => {
    try {
      cb();
    } catch {
      // ignore listener errors
    }
  });
}

let sharedGltfLoader: GLTFLoader | null = null;
function getGltfLoader(): GLTFLoader {
  if (!sharedGltfLoader) {
    sharedGltfLoader = new GLTFLoader();
    sharedGltfLoader.register((parser) => new VRMLoaderPlugin(parser));
    sharedGltfLoader.register((parser) => new VRMAnimationLoaderPlugin(parser));
  }
  return sharedGltfLoader;
}

export async function preloadClawatarVrma(actionId: string): Promise<VRMAnimation> {
  const cached = globalVrmaCache.get(actionId);
  if (cached) return cached;
  const inflight = globalVrmaInflight.get(actionId);
  if (inflight) return inflight;

  const url = withClawatarBasePath(`animations/${encodeURIComponent(actionId)}.vrma`);
  const promise = (async () => {
    const gltf = await getGltfLoader().loadAsync(url);
    const vrmAnimation = (gltf.userData as { vrmAnimations?: VRMAnimation[] }).vrmAnimations?.[0];
    if (!vrmAnimation) {
      throw new Error(`No VRMAnimation data in ${url}`);
    }
    globalVrmaCache.set(actionId, vrmAnimation);
    return vrmAnimation;
  })().finally(() => {
    globalVrmaInflight.delete(actionId);
  });

  globalVrmaInflight.set(actionId, promise);
  return promise;
}

function trimClip(
  clip: THREE.AnimationClip,
  enabled: boolean,
  trimStartSec = 0.25,
  trimEndSec = 0.25
): THREE.AnimationClip {
  if (!enabled) return clip;
  const newDuration = clip.duration - trimStartSec - trimEndSec;
  if (newDuration <= 0.5) return clip;

  for (const track of clip.tracks) {
    const times = track.times;
    const values = track.values;
    const valueSize = values.length / Math.max(1, times.length);
    let startIdx = 0;
    while (startIdx < times.length && times[startIdx] < trimStartSec) startIdx++;
    let endIdx = times.length - 1;
    const endTime = clip.duration - trimEndSec;
    while (endIdx > startIdx && times[endIdx] > endTime) endIdx--;
    if (endIdx <= startIdx) continue;

    const count = endIdx - startIdx + 1;
    const newTimes = new Float32Array(count);
    const newValues = new Float32Array(count * valueSize);
    for (let i = 0; i < count; i++) {
      newTimes[i] = Math.max(0, times[startIdx + i] - trimStartSec);
      for (let v = 0; v < valueSize; v++) {
        newValues[i * valueSize + v] = values[(startIdx + i) * valueSize + v];
      }
    }
    track.times = newTimes;
    track.values = newValues;
  }
  clip.resetDuration();
  return clip;
}

function ensureLookAtProxy(vrm: VRM): void {
  if (!vrm.lookAt) return;
  const existing = vrm.scene.children.find(
    (child) => child instanceof VRMLookAtQuaternionProxy
  );
  if (existing) return;
  const proxy = new VRMLookAtQuaternionProxy(vrm.lookAt);
  proxy.name = 'VRMLookAtQuaternionProxy';
  vrm.scene.add(proxy);
}

function normalizeGroundDir(v: THREE.Vector3): boolean {
  v.y = 0;
  const lenSq = v.lengthSq();
  if (lenSq <= 1e-6) return false;
  v.multiplyScalar(1 / Math.sqrt(lenSq));
  return true;
}

function autoCorrectFacing(vrm: VRM): void {
  vrm.scene.updateWorldMatrix(true, true);
  const humanoid = vrm.humanoid;
  const leftEye = humanoid?.getNormalizedBoneNode('leftEye');
  const rightEye = humanoid?.getNormalizedBoneNode('rightEye');
  const head = humanoid?.getNormalizedBoneNode('head');
  const targetFront = new THREE.Vector3(0, 0, 1);

  if (leftEye && rightEye && head) {
    const lPos = new THREE.Vector3();
    const rPos = new THREE.Vector3();
    const hPos = new THREE.Vector3();
    leftEye.getWorldPosition(lPos);
    rightEye.getWorldPosition(rPos);
    head.getWorldPosition(hPos);
    const eyeMid = new THREE.Vector3().addVectors(lPos, rPos).multiplyScalar(0.5);
    const depth = eyeMid.sub(hPos).dot(targetFront);
    if (depth < -0.005) {
      vrm.scene.rotation.y += Math.PI;
      vrm.scene.updateWorldMatrix(true, true);
    }
    return;
  }

  if (head) {
    const dir = new THREE.Vector3();
    head.getWorldDirection(dir);
    if (normalizeGroundDir(dir) && dir.dot(targetFront) < -0.35) {
      vrm.scene.rotation.y += Math.PI;
      vrm.scene.updateWorldMatrix(true, true);
    }
  }
}

export interface ClawatarEngineOptions {
  width?: number;
  height?: number;
  maxPixelRatio?: number;
  alpha?: boolean;
  enableOrbitControls?: boolean;
  mountElement?: HTMLElement;
}

export class ClawatarEngine {
  readonly canvas: HTMLCanvasElement;
  readonly scene: THREE.Scene;
  readonly camera: THREE.PerspectiveCamera;
  readonly renderer: THREE.WebGLRenderer;
  readonly controls: OrbitControls | null = null;

  private vrm: VRM | null = null;
  private mixer: THREE.AnimationMixer | null = null;
  private currentModelUrl: string | null = null;
  private loadSeq = 0;
  private isLoadingModel = false;
  private lastLoadError: string | null = null;
  private baseFacingYaw = 0;

  private clipCache = new Map<string, THREE.AnimationClip>();
  private actionCache = new Map<string, THREE.AnimationAction>();
  private currentAction: THREE.AnimationAction | null = null;
  private currentActionId: string | null = null;
  private currentActionLoop = true;
  private desiredActionId: string | null = null;
  private desiredActionLoop = true;
  private pendingActionLoads = new Set<string>();
  private autoReturnOnFinish = true;
  private lastMouthOpen = 0;

  // Behavioral state
  private breathPhase = 0;
  private lastBreath = {
    spineX: 0,
    chestX: 0,
    hipsZ: 0,
    hipsY: 0,
    headX: 0,
    headY: 0,
    leftShoulderZ: 0,
    rightShoulderZ: 0,
  };
  private blinkTimer = 0;
  private nextBlinkInterval = 3.2;
  private isBlinking = false;
  private blinkProgress = 0;

  private expressionTargets = new Map<
    string,
    { target: number; current: number; speed: number }
  >();
  private currentExpressionName: Exclude<ClawatarExpression, 'auto'> = 'neutral';
  private currentExpressionWeight = 0;

  private cameraPreset: ClawatarCameraPreset = 'upperBody';
  private cameraZoom = 1;
  private yawDeg = 0;
  private cameraInitialized = false;
  private targetCamPos = new THREE.Vector3(0, 1.32, 1.55);
  private targetLookPos = new THREE.Vector3(0, 1.25, 0);

  private lipSyncPhase = 0;
  private smoothedMouthOpen = 0;
  private frozenDirty = true;
  private behaviorFlags = {
    blinkAndBreath: true,
    headNodOnSpeech: true,
    lipSyncEnabled: true,
    microExpressions: true,
  };

  constructor(options: ClawatarEngineOptions = {}) {
    const width = options.width ?? 384;
    const height = options.height ?? 512;
    const maxPixelRatio = options.maxPixelRatio ?? 1;
    const alpha = options.alpha ?? true;

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(32, width / height, 0.1, 100);
    this.camera.position.set(0, 1.32, 1.55);

    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha,
      preserveDrawingBuffer: true,
      powerPreference: 'high-performance',
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, maxPixelRatio));
    this.renderer.setSize(width, height, false);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.08;
    if (alpha) {
      this.renderer.setClearColor(0x000000, 0);
    } else {
      this.renderer.setClearColor(0x0f172a, 1);
    }

    this.canvas = this.renderer.domElement;
    if (options.mountElement) {
      this.canvas.style.width = '100%';
      this.canvas.style.height = '100%';
      this.canvas.style.display = 'block';
      options.mountElement.appendChild(this.canvas);
    }

    // Clawatar lighting rig
    const ambient = new THREE.AmbientLight(0xfff5f0, 0.85);
    const hemi = new THREE.HemisphereLight(0xfef3c7, 0x334155, 0.65);
    const key = new THREE.DirectionalLight(0xfffbeb, 1.45);
    key.position.set(1.6, 2.4, 2.2);
    const rim = new THREE.DirectionalLight(0xa5f3fc, 0.72);
    rim.position.set(-1.8, 1.9, -1.6);
    const bounce = new THREE.PointLight(0xfde68a, 0.4, 6);
    bounce.position.set(0, 0.6, 1.2);
    this.scene.add(ambient, hemi, key, rim, bounce);

    if (options.enableOrbitControls) {
      this.controls = new OrbitControls(this.camera, this.canvas);
      this.controls.enableDamping = true;
      this.controls.dampingFactor = 0.08;
      this.controls.target.copy(this.targetLookPos);
      this.controls.update();
    }
  }

  setRenderResolution(width: number, height: number, maxPixelRatio = 1): void {
    if (width <= 0 || height <= 0) return;
    const targetPr = Math.min(window.devicePixelRatio || 1, maxPixelRatio);
    const prevPr = this.renderer.getPixelRatio();
    if (
      Math.abs(prevPr - targetPr) < 0.01 &&
      this.canvas.width === Math.round(width * targetPr) &&
      this.canvas.height === Math.round(height * targetPr)
    ) {
      return;
    }
    this.renderer.setPixelRatio(targetPr);
    this.resize(width, height);
    this.frozenDirty = true;
  }

  resize(width: number, height: number): void {
    if (width <= 0 || height <= 0) return;
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height, false);
    this.frozenDirty = true;
  }

  getVrm(): VRM | null {
    return this.vrm;
  }

  getModelUrl(): string | null {
    return this.currentModelUrl;
  }

  isLoading(): boolean {
    return this.isLoadingModel;
  }

  isReady(): boolean {
    return Boolean(this.vrm);
  }

  getError(): string | null {
    return this.lastLoadError;
  }

  getCurrentActionId(): string | null {
    return this.currentActionId;
  }

  setAutoReturnOnFinish(enabled: boolean): void {
    this.autoReturnOnFinish = enabled;
  }

  setBehaviorFlags(flags: {
    blinkAndBreath?: boolean;
    headNodOnSpeech?: boolean;
    lipSyncEnabled?: boolean;
    microExpressions?: boolean;
  }): void {
    if (flags.blinkAndBreath !== undefined) this.behaviorFlags.blinkAndBreath = flags.blinkAndBreath;
    if (flags.headNodOnSpeech !== undefined) this.behaviorFlags.headNodOnSpeech = flags.headNodOnSpeech;
    if (flags.lipSyncEnabled !== undefined) this.behaviorFlags.lipSyncEnabled = flags.lipSyncEnabled;
    if (flags.microExpressions !== undefined) this.behaviorFlags.microExpressions = flags.microExpressions;
  }

  async loadModel(url: string): Promise<VRM | null> {
    if (!url) return null;
    if (this.currentModelUrl === url && this.vrm && !this.isLoadingModel) {
      return this.vrm;
    }

    const reqId = ++this.loadSeq;
    this.currentModelUrl = url;
    this.isLoadingModel = true;
    this.lastLoadError = null;

    try {
      const gltf = await getGltfLoader().loadAsync(url);
      if (reqId !== this.loadSeq) {
        try {
          VRMUtils.deepDispose(gltf.scene);
        } catch {
          // ignore
        }
        return this.vrm;
      }

      const vrm = (gltf.userData as { vrm?: VRM }).vrm;
      if (!vrm) {
        throw new Error('الملف لا يحتوي على بيانات VRM صالحة.');
      }

      if (this.vrm) {
        this.mixer?.stopAllAction();
        this.scene.remove(this.vrm.scene);
        try {
          VRMUtils.deepDispose(this.vrm.scene);
        } catch {
          // ignore
        }
      }
      this.clipCache.clear();
      this.actionCache.clear();
      this.currentAction = null;
      this.currentActionId = null;

      VRMUtils.removeUnnecessaryVertices(gltf.scene);
      VRMUtils.combineSkeletons(gltf.scene);
      vrm.scene.rotation.y = 0;
      ensureLookAtProxy(vrm);
      this.scene.add(vrm.scene);
      autoCorrectFacing(vrm);

      this.baseFacingYaw = vrm.scene.rotation.y;
      vrm.scene.rotation.y = this.baseFacingYaw + THREE.MathUtils.degToRad(this.yawDeg);
      vrm.scene.updateWorldMatrix(true, true);

      this.vrm = vrm;
      const mixer = new THREE.AnimationMixer(vrm.scene);
      mixer.addEventListener('finished', (event: { action?: THREE.AnimationAction }) => {
        if (!this.autoReturnOnFinish) return;
        if (event.action && event.action === this.currentAction && !this.currentActionLoop) {
          const fallbackAction = this.lastMouthOpen > 0.08 ? '86_Talking' : '119_Idle';
          void this.playAction(fallbackAction, true, 0.35);
        }
      });
      this.mixer = mixer;
      this.isLoadingModel = false;
      this.cameraInitialized = false;

      if (vrm.lookAt) {
        vrm.lookAt.target = this.camera;
      }

      const initialAction = this.desiredActionId || '119_Idle';
      await this.playAction(initialAction, this.desiredActionLoop, 0.15);
      // Advance 1 micro-step so initial VRM pose is immediately seated
      this.mixer.update(0.016);
      this.vrm.update(0.016);
      this.snapCameraToPreset();
      this.renderNow();
      this.frozenDirty = false;
      notifyClawatarFrameReady();
      return vrm;
    } catch (err) {
      if (reqId === this.loadSeq) {
        this.isLoadingModel = false;
        this.lastLoadError =
          err instanceof Error ? err.message : 'تعذر تحميل نموذج Clawatar 3D.';
        notifyClawatarFrameReady();
      }
      return null;
    }
  }

  setCameraPreset(
    preset: ClawatarCameraPreset,
    zoom = 1,
    yawDeg = 0,
    immediate = false
  ): void {
    const changed =
      this.cameraPreset !== preset ||
      Math.abs(this.cameraZoom - zoom) > 0.005 ||
      Math.abs(this.yawDeg - yawDeg) > 0.1 ||
      !this.cameraInitialized;
    this.cameraPreset = preset;
    this.cameraZoom = Math.max(0.6, Math.min(1.65, zoom));
    this.yawDeg = yawDeg;

    if (this.vrm) {
      this.vrm.scene.rotation.y = this.baseFacingYaw + THREE.MathUtils.degToRad(yawDeg);
    }

    if (changed) {
      this.frozenDirty = true;
      this.computeCameraTargets();
      if (immediate || !this.cameraInitialized) {
        this.snapCameraToPreset();
      }
    }
  }

  private computeCameraTargets(): void {
    const headBone = this.vrm?.humanoid?.getNormalizedBoneNode('head');
    const hipsBone = this.vrm?.humanoid?.getNormalizedBoneNode('hips');
    const headPos = new THREE.Vector3(0, 1.42, 0);
    const hipsPos = new THREE.Vector3(0, 0.9, 0);

    if (headBone) {
      headBone.getWorldPosition(headPos);
    }
    if (hipsBone) {
      hipsBone.getWorldPosition(hipsPos);
    }

    const invZoom = 1 / Math.max(0.6, this.cameraZoom);

    switch (this.cameraPreset) {
      case 'face':
        this.targetLookPos.set(headPos.x, headPos.y + 0.03, headPos.z);
        this.targetCamPos.set(headPos.x, headPos.y + 0.04, headPos.z + 0.72 * invZoom);
        break;
      case 'portrait':
        this.targetLookPos.set(headPos.x, headPos.y - 0.07, headPos.z);
        this.targetCamPos.set(headPos.x, headPos.y - 0.02, headPos.z + 1.05 * invZoom);
        break;
      case 'meeting':
        this.targetLookPos.set(headPos.x, headPos.y - 0.14, headPos.z);
        this.targetCamPos.set(headPos.x + 0.06, headPos.y - 0.06, headPos.z + 1.32 * invZoom);
        break;
      case 'full': {
        const midY = (headPos.y + hipsPos.y) * 0.45;
        this.targetLookPos.set(0, midY, 0);
        this.targetCamPos.set(0, midY + 0.18, 2.75 * invZoom);
        break;
      }
      case 'upperBody':
      default:
        this.targetLookPos.set(headPos.x, headPos.y - 0.24, headPos.z);
        this.targetCamPos.set(headPos.x, headPos.y - 0.14, headPos.z + 1.56 * invZoom);
        break;
    }
  }

  private snapCameraToPreset(): void {
    this.computeCameraTargets();
    this.camera.position.copy(this.targetCamPos);
    if (this.controls) {
      this.controls.target.copy(this.targetLookPos);
      this.controls.update();
    } else {
      this.camera.lookAt(this.targetLookPos);
    }
    this.cameraInitialized = true;
  }

  async playAction(
    actionId: string,
    loop = false,
    fadeDuration = 0.35
  ): Promise<void> {
    this.desiredActionId = actionId;
    this.desiredActionLoop = loop;

    if (!this.vrm || !this.mixer) return;
    if (this.currentActionId === actionId && this.currentActionLoop === loop && this.currentAction) {
      return;
    }

    const actionKey = `${actionId}::${loop ? 'loop' : 'once'}`;
    let clip = this.clipCache.get(actionKey);

    if (!clip) {
      if (this.pendingActionLoads.has(actionKey)) return;
      this.pendingActionLoads.add(actionKey);
      try {
        const vrma = await preloadClawatarVrma(actionId);
        if (!this.vrm || !this.mixer) return;
        clip = trimClip(createVRMAnimationClip(vrma, this.vrm), !loop);
        this.clipCache.set(actionKey, clip);
      } catch (err) {
        console.warn(`[Clawatar] Could not load animation "${actionId}":`, err);
        return;
      } finally {
        this.pendingActionLoads.delete(actionKey);
      }
    }

    if (this.desiredActionId !== actionId) return;

    let nextAction = this.actionCache.get(actionKey);
    if (!nextAction) {
      nextAction = this.mixer.clipAction(clip);
      this.actionCache.set(actionKey, nextAction);
    }

    const prevAction = this.currentAction;
    nextAction.enabled = true;
    nextAction.reset();
    nextAction.setEffectiveWeight(1);
    nextAction.setEffectiveTimeScale(1);

    if (loop) {
      nextAction.setLoop(THREE.LoopRepeat, Infinity);
      nextAction.clampWhenFinished = false;
    } else {
      nextAction.setLoop(THREE.LoopOnce, 1);
      nextAction.clampWhenFinished = true;
    }

    if (prevAction && prevAction !== nextAction) {
      prevAction.crossFadeTo(nextAction, Math.max(0.12, fadeDuration), false);
    } else {
      nextAction.fadeIn(Math.max(0.08, fadeDuration * 0.5));
    }

    nextAction.play();
    this.currentAction = nextAction;
    this.currentActionId = actionId;
    this.currentActionLoop = loop;
    this.frozenDirty = true;
    notifyClawatarFrameReady();
  }

  requestActionSync(actionId: string, loop: boolean, fadeDuration = 0.35): void {
    if (this.desiredActionId === actionId && this.desiredActionLoop === loop) {
      return;
    }
    void this.playAction(actionId, loop, fadeDuration);
  }

  async ensureActionReadyAndStep(
    actionId: string,
    loop: boolean,
    dt: number
  ): Promise<void> {
    if (!this.vrm || !this.mixer) return;
    if (this.currentActionId !== actionId || this.currentActionLoop !== loop) {
      await this.playAction(actionId, loop, 0.25);
    }
    this.step(dt);
  }

  setExpression(
    name: Exclude<ClawatarExpression, 'auto'>,
    weight = 0.85,
    speed = 4.0
  ): void {
    if (
      this.currentExpressionName !== name ||
      Math.abs(this.currentExpressionWeight - weight) > 0.01
    ) {
      this.frozenDirty = true;
    }
    this.currentExpressionName = name;
    this.currentExpressionWeight = weight;

    if (name === 'neutral' || weight <= 0.01) {
      for (const entry of this.expressionTargets.values()) {
        entry.target = 0;
        entry.speed = speed;
      }
      return;
    }

    for (const [key, entry] of this.expressionTargets) {
      if (key !== name) {
        entry.target = 0;
        entry.speed = speed;
      }
    }

    const existing = this.expressionTargets.get(name);
    if (existing) {
      existing.target = weight;
      existing.speed = speed;
    } else {
      this.expressionTargets.set(name, { target: weight, current: 0, speed });
    }
  }

  private removeBreathingOffsets(): void {
    const humanoid = this.vrm?.humanoid;
    if (!humanoid) return;
    const spine = humanoid.getNormalizedBoneNode('spine');
    const chest = humanoid.getNormalizedBoneNode('chest');
    const hips = humanoid.getNormalizedBoneNode('hips');
    const head = humanoid.getNormalizedBoneNode('head');
    const leftShoulder = humanoid.getNormalizedBoneNode('leftShoulder');
    const rightShoulder = humanoid.getNormalizedBoneNode('rightShoulder');

    if (spine) spine.rotation.x -= this.lastBreath.spineX;
    if (chest) chest.rotation.x -= this.lastBreath.chestX;
    if (hips) {
      hips.rotation.z -= this.lastBreath.hipsZ;
      hips.position.y -= this.lastBreath.hipsY;
    }
    if (head) {
      head.rotation.x -= this.lastBreath.headX;
      head.rotation.y -= this.lastBreath.headY;
    }
    if (leftShoulder) leftShoulder.rotation.z -= this.lastBreath.leftShoulderZ;
    if (rightShoulder) rightShoulder.rotation.z -= this.lastBreath.rightShoulderZ;
  }

  private updateBreathing(delta: number): void {
    const humanoid = this.vrm?.humanoid;
    if (!humanoid) return;

    this.breathPhase += delta * 1.5;
    const breathAmp = this.behaviorFlags.blinkAndBreath ? 1 : 0;
    const speakAmp =
      this.behaviorFlags.headNodOnSpeech && this.smoothedMouthOpen > 0.05
        ? Math.min(1, this.smoothedMouthOpen * 1.25)
        : 0;

    const spineX = Math.sin(this.breathPhase) * 0.014 * breathAmp;
    const chestX = Math.sin(this.breathPhase - 0.3) * 0.01 * breathAmp;
    const hipsZ = Math.sin(this.breathPhase * 0.35) * 0.008 * breathAmp;
    const hipsY = Math.sin(this.breathPhase * 0.7) * 0.002 * breathAmp;
    const headX =
      Math.sin(this.breathPhase * 0.5) * 0.007 * breathAmp +
      Math.sin(this.lipSyncPhase * 0.65) * 0.026 * speakAmp;
    const headY =
      Math.cos(this.breathPhase * 0.3) * 0.012 * breathAmp +
      Math.cos(this.lipSyncPhase * 0.38) * 0.022 * speakAmp;
    const leftShoulderZ = Math.sin(this.breathPhase * 1.2) * 0.004 * breathAmp;
    const rightShoulderZ = Math.sin(this.breathPhase * 1.2 + Math.PI) * 0.004 * breathAmp;

    const spine = humanoid.getNormalizedBoneNode('spine');
    const chest = humanoid.getNormalizedBoneNode('chest');
    const hips = humanoid.getNormalizedBoneNode('hips');
    const head = humanoid.getNormalizedBoneNode('head');
    const leftShoulder = humanoid.getNormalizedBoneNode('leftShoulder');
    const rightShoulder = humanoid.getNormalizedBoneNode('rightShoulder');

    if (spine) spine.rotation.x += spineX - this.lastBreath.spineX;
    if (chest) chest.rotation.x += chestX - this.lastBreath.chestX;
    if (hips) {
      hips.rotation.z += hipsZ - this.lastBreath.hipsZ;
      hips.position.y += hipsY - this.lastBreath.hipsY;
    }
    if (head) {
      head.rotation.x += headX - this.lastBreath.headX;
      head.rotation.y += headY - this.lastBreath.headY;
    }
    if (leftShoulder) leftShoulder.rotation.z += leftShoulderZ - this.lastBreath.leftShoulderZ;
    if (rightShoulder) rightShoulder.rotation.z += rightShoulderZ - this.lastBreath.rightShoulderZ;

    this.lastBreath = {
      spineX,
      chestX,
      hipsZ,
      hipsY,
      headX,
      headY,
      leftShoulderZ,
      rightShoulderZ,
    };
  }

  private updateBlink(delta: number): void {
    const manager = this.vrm?.expressionManager;
    if (!manager) return;

    this.blinkTimer += delta;
    if (!this.isBlinking && this.blinkTimer >= this.nextBlinkInterval) {
      this.isBlinking = true;
      this.blinkProgress = 0;
      this.blinkTimer = 0;
      this.nextBlinkInterval = 2.6 + Math.random() * 3.2;
    }

    if (this.isBlinking) {
      this.blinkProgress += delta / 0.14;
      let val = 0;
      if (this.blinkProgress < 0.5) {
        val = this.blinkProgress * 2;
      } else if (this.blinkProgress < 1) {
        val = (1 - this.blinkProgress) * 2;
      } else {
        this.isBlinking = false;
        val = 0;
      }
      if (manager.getExpression('blink') != null) {
        manager.setValue('blink', Math.max(0, Math.min(1, val)));
      }
    }
  }

  private updateExpressions(delta: number, snapImmediate = false): void {
    const manager = this.vrm?.expressionManager;
    if (!manager) return;
    const toDelete: string[] = [];

    for (const [name, entry] of this.expressionTargets) {
      if (snapImmediate) {
        entry.current = entry.target;
        if (entry.target === 0) toDelete.push(name);
      } else {
        const diff = entry.target - entry.current;
        if (Math.abs(diff) < 0.002) {
          entry.current = entry.target;
          if (entry.target === 0) toDelete.push(name);
        } else {
          entry.current += diff * Math.min(1, entry.speed * delta);
        }
      }
      if (manager.getExpression(name) != null) {
        manager.setValue(name, entry.current);
      }
    }

    for (const name of toDelete) {
      this.expressionTargets.delete(name);
      if (manager.getExpression(name) != null) {
        manager.setValue(name, 0);
      }
    }
  }

  private updateLipSync(delta: number, mouthOpenOverride?: number): void {
    const manager = this.vrm?.expressionManager;
    if (!manager) return;

    const setMouth = (name: string, val: number) => {
      if (manager.getExpression(name) != null) {
        manager.setValue(name, Math.max(0, Math.min(1, val)));
      }
    };

    const rawOpen = this.behaviorFlags.lipSyncEnabled
      ? Math.max(0, Math.min(1, mouthOpenOverride ?? 0))
      : 0;
    if (delta <= 0) {
      this.smoothedMouthOpen = rawOpen;
    } else {
      const rate = rawOpen > this.smoothedMouthOpen ? 24 : 16;
      this.smoothedMouthOpen += (rawOpen - this.smoothedMouthOpen) * Math.min(1, delta * rate);
    }
    const open = this.smoothedMouthOpen;
    this.lastMouthOpen = open;
    if (open <= 0.02) {
      setMouth('aa', 0);
      setMouth('oh', 0);
      setMouth('ih', 0);
      setMouth('ee', 0);
      setMouth('ou', 0);
      return;
    }

    this.lipSyncPhase += Math.max(0.016, delta) * 12.2;
    const p = this.lipSyncPhase;
    const aa = open * (0.48 + 0.52 * Math.max(0, Math.sin(p) * 0.72 + Math.sin(p * 1.61 + 0.5) * 0.28));
    const oh = open * 0.52 * Math.max(0, Math.cos(p * 0.74) * 0.7 + Math.sin(p * 1.25) * 0.3);
    const ih = open * 0.42 * Math.max(0, Math.sin(p * 1.38 + 1.15));
    const ee = open * 0.34 * Math.max(0, Math.cos(p * 1.72 + 2.1));
    const ou = open * 0.38 * Math.max(0, Math.sin(p * 0.92 + 2.6));
    setMouth('aa', aa);
    setMouth('oh', oh);
    setMouth('ih', ih);
    setMouth('ee', ee);
    setMouth('ou', ou);
  }

  /** Freeze character cleanly at current timeline pose without advancing idle/blink clocks */
  stepFrozen(mouthOpen = 0): void {
    if (!this.vrm || !this.mixer) return;
    const mouthChanged = Math.abs(mouthOpen - this.lastMouthOpen) > 0.02;
    if (!this.frozenDirty && !mouthChanged) return;

    this.snapCameraToPreset();
    this.updateExpressions(0, true);
    this.updateLipSync(0, mouthOpen);
    if (this.vrm.lookAt) {
      this.vrm.lookAt.target = this.camera;
    }
    this.mixer.update(0.001);
    this.vrm.update(0.001);
    this.renderNow();
    this.frozenDirty = false;
  }

  step(deltaSec: number, mouthOpenOverride?: number): void {
    const dt = Math.max(0.001, Math.min(0.08, deltaSec));

    if (this.controls) {
      this.controls.update();
    } else if (this.cameraInitialized) {
      this.computeCameraTargets();
      this.camera.position.lerp(this.targetCamPos, Math.min(1, dt * 6.5));
      this.camera.lookAt(this.targetLookPos);
    }

    if (this.vrm && this.mixer) {
      this.removeBreathingOffsets();
      this.mixer.update(dt);
      this.updateBreathing(dt);
      if (this.behaviorFlags.blinkAndBreath) {
        this.updateBlink(dt);
      } else if (this.vrm.expressionManager?.getExpression('blink') != null) {
        this.vrm.expressionManager.setValue('blink', 0);
      }
      this.updateExpressions(dt, false);
      this.updateLipSync(dt, mouthOpenOverride);
      if (this.vrm.lookAt) {
        this.vrm.lookAt.target = this.camera;
      }
      this.vrm.update(dt);
    }

    this.renderNow();
    this.frozenDirty = false;
  }

  renderNow(): void {
    this.renderer.render(this.scene, this.camera);
  }

  dispose(): void {
    this.mixer?.stopAllAction();
    if (this.vrm) {
      this.scene.remove(this.vrm.scene);
      try {
        VRMUtils.deepDispose(this.vrm.scene);
      } catch {
        // ignore
      }
      this.vrm = null;
    }
    this.clipCache.clear();
    this.actionCache.clear();
    this.controls?.dispose();
    this.renderer.dispose();
  }
}

// ── Shared Singleton for Quiz Presenter Preview & Video Export ───────────────
let quizClawatarEngine: ClawatarEngine | null = null;
let lastPreviewStepAt = 0;

export function getQuizClawatarEngine(): ClawatarEngine {
  if (!quizClawatarEngine) {
    quizClawatarEngine = new ClawatarEngine({
      width: 384,
      height: 512,
      maxPixelRatio: 1,
      alpha: true,
      enableOrbitControls: false,
    });
  }
  return quizClawatarEngine;
}

export function setQuizClawatarRenderMode(mode: 'preview' | 'export'): void {
  const engine = getQuizClawatarEngine();
  if (mode === 'export') {
    engine.setAutoReturnOnFinish(false);
    engine.setRenderResolution(560, 760, 1);
  } else {
    engine.setAutoReturnOnFinish(true);
    engine.setRenderResolution(384, 512, 1);
  }
}

export function disposeQuizClawatarEngine(): void {
  if (quizClawatarEngine) {
    quizClawatarEngine.dispose();
    quizClawatarEngine = null;
  }
  lastPreviewStepAt = 0;
}

export function resetQuizClawatarTimer(): void {
  lastPreviewStepAt = 0;
}

export function stepQuizClawatarLive(
  mouthOpen: number,
  overrideDt?: number,
  minStepIntervalMs = 28
): void {
  const engine = getQuizClawatarEngine();
  const now = performance.now();
  if (overrideDt === undefined && lastPreviewStepAt > 0) {
    const elapsedMs = now - lastPreviewStepAt;
    if (elapsedMs < minStepIntervalMs) {
      return;
    }
  }
  const dt =
    overrideDt !== undefined
      ? overrideDt
      : lastPreviewStepAt > 0
        ? Math.min(0.06, Math.max(0.012, (now - lastPreviewStepAt) / 1000))
        : 1 / 30;
  lastPreviewStepAt = now;
  engine.step(dt, mouthOpen);
}
