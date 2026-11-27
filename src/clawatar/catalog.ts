import type { ClawatarCameraPreset, ClawatarExpression, PresenterPoseId } from '../types/quiz';
import { isAndroidNativeApp } from '../utils/nativeDownload';

export interface ClawatarModelInfo {
  id: string;
  file: string;
  nameAr: string;
  nameEn: string;
  subtitleAr: string;
  gender: 'female' | 'male' | 'stylized';
  sizeMB: string;
  badgeColor: string;
  emoji: string;
}

export const CLAWATAR_MODELS: ClawatarModelInfo[] = [
  {
    id: 'Comet_Kringle.vrm',
    file: 'Comet_Kringle.vrm',
    nameAr: 'كوميت السريعة (4.8MB - ممتازة للأندرويد)',
    nameEn: 'Comet Kringle',
    subtitleAr: 'خفيفة وسريعة جداً للأجهزة المحمولة والأندرويد',
    gender: 'stylized',
    sizeMB: '4.8',
    badgeColor: '#f59e0b',
    emoji: '☄️',
  },
  {
    id: 'base_female.vrm',
    file: 'base_female.vrm',
    nameAr: 'شخصية Clawatar الافتراضية (أنثى)',
    nameEn: 'Clawatar Base Female',
    subtitleAr: 'الشخصية الرسمية لـ Clawatar بحركات وتعابير كاملة',
    gender: 'female',
    sizeMB: '16.3',
    badgeColor: '#ec4899',
    emoji: '🌸',
  },
  {
    id: 'base_male.vrm',
    file: 'base_male.vrm',
    nameAr: 'شخصية Clawatar الافتراضية (شاب)',
    nameEn: 'Clawatar Base Male',
    subtitleAr: 'مذيع شاب 3D بتفاصيل أنمي عالية الدقة',
    gender: 'male',
    sizeMB: '17.9',
    badgeColor: '#3b82f6',
    emoji: '🎙️',
  },
  {
    id: 'sakurada_fumiriya.vrm',
    file: 'sakurada_fumiriya.vrm',
    nameAr: 'ساكورادا فوميريا',
    nameEn: 'Sakurada Fumiriya',
    subtitleAr: 'شخصية أنمي أنيقة ومناسبة للبرامج التعليمية',
    gender: 'female',
    sizeMB: '19.6',
    badgeColor: '#f43f5e',
    emoji: '🎀',
  },
  {
    id: 'sendagaya_shino.vrm',
    file: 'sendagaya_shino.vrm',
    nameAr: 'سينداغايا شينو',
    nameEn: 'Sendagaya Shino',
    subtitleAr: 'مذيعة حيوية بتعابير وجه غنية',
    gender: 'female',
    sizeMB: '14.9',
    badgeColor: '#a855f7',
    emoji: '✨',
  },
  {
    id: 'avatarsample_d.vrm',
    file: 'avatarsample_d.vrm',
    nameAr: 'أفاتار ستوديو D',
    nameEn: 'Avatar Sample D',
    subtitleAr: 'شخصية عصرية مناسبة لتحديات الشورتس',
    gender: 'female',
    sizeMB: '16.9',
    badgeColor: '#10b981',
    emoji: '🌟',
  },
  {
    id: 'avatarsample_d_darkness.vrm',
    file: 'avatarsample_d_darkness.vrm',
    nameAr: 'أفاتار داركنس D',
    nameEn: 'Avatar Sample D Darkness',
    subtitleAr: 'إصدار داكن غامض لألغاز التحدي',
    gender: 'female',
    sizeMB: '21.0',
    badgeColor: '#6366f1',
    emoji: '🌙',
  },
  {
    id: 'avatarsample_e.vrm',
    file: 'avatarsample_e.vrm',
    nameAr: 'أفاتار ستوديو E',
    nameEn: 'Avatar Sample E',
    subtitleAr: 'شخصية مذيع حيوية ومتفاعلة',
    gender: 'male',
    sizeMB: '17.9',
    badgeColor: '#0ea5e9',
    emoji: '⚡',
  },
  {
    id: 'avatarsample_f.vrm',
    file: 'avatarsample_f.vrm',
    nameAr: 'أفاتار ستوديو F',
    nameEn: 'Avatar Sample F',
    subtitleAr: 'شخصية خفيفة بأسلوب شبابي',
    gender: 'female',
    sizeMB: '14.2',
    badgeColor: '#14b8a6',
    emoji: '🎯',
  },
  {
    id: 'avatarsample_g.vrm',
    file: 'avatarsample_g.vrm',
    nameAr: 'أفاتار ستوديو G',
    nameEn: 'Avatar Sample G',
    subtitleAr: 'شخصية متوازنة للعروض الثقافية',
    gender: 'male',
    sizeMB: '15.3',
    badgeColor: '#eab308',
    emoji: '🎭',
  },
  {
    id: 'vroidhub_179351269068834908.vrm',
    file: 'vroidhub_179351269068834908.vrm',
    nameAr: 'VRoid Hub #1',
    nameEn: 'VRoid Hub Model 1',
    subtitleAr: 'نموذج VRoid متكامل المفاصل',
    gender: 'female',
    sizeMB: '17.4',
    badgeColor: '#fb7185',
    emoji: '🦋',
  },
  {
    id: 'vroidhub_2762146181498781620.vrm',
    file: 'vroidhub_2762146181498781620.vrm',
    nameAr: 'VRoid Hub #2',
    nameEn: 'VRoid Hub Model 2',
    subtitleAr: 'شخصية VRoid مخصصة للتقديم',
    gender: 'female',
    sizeMB: '14.8',
    badgeColor: '#f97316',
    emoji: '🔥',
  },
  {
    id: 'vroidhub_3140471646257021412.vrm',
    file: 'vroidhub_3140471646257021412.vrm',
    nameAr: 'VRoid Hub #3',
    nameEn: 'VRoid Hub Model 3',
    subtitleAr: 'شخصية أنمي بحركات دقيقة',
    gender: 'female',
    sizeMB: '18.2',
    badgeColor: '#8b5cf6',
    emoji: '💫',
  },
  {
    id: 'vroidhub_4346870624568174514.vrm',
    file: 'vroidhub_4346870624568174514.vrm',
    nameAr: 'VRoid Hub #4',
    nameEn: 'VRoid Hub Model 4',
    subtitleAr: 'شخصية أنيقة لمحتوى الأسئلة',
    gender: 'female',
    sizeMB: '17.3',
    badgeColor: '#06b6d4',
    emoji: '💎',
  },
  {
    id: 'vroidhub_4576339738611439136.vrm',
    file: 'vroidhub_4576339738611439136.vrm',
    nameAr: 'VRoid Hub #5',
    nameEn: 'VRoid Hub Model 5',
    subtitleAr: 'شخصية احترافية لليوتيوب ريلز',
    gender: 'female',
    sizeMB: '18.3',
    badgeColor: '#10b981',
    emoji: '🎬',
  },
  {
    id: 'vroidhub_4638883143034966573.vrm',
    file: 'vroidhub_4638883143034966573.vrm',
    nameAr: 'VRoid Hub #6',
    nameEn: 'VRoid Hub Model 6',
    subtitleAr: 'شخصية بث مباشر تفاعلية',
    gender: 'female',
    sizeMB: '17.5',
    badgeColor: '#ec4899',
    emoji: '📺',
  },
  {
    id: 'vroidhub_4852780412724878387.vrm',
    file: 'vroidhub_4852780412724878387.vrm',
    nameAr: 'VRoid Hub #7',
    nameEn: 'VRoid Hub Model 7',
    subtitleAr: 'شخصية حيوية بتفاصيل دقيقة',
    gender: 'female',
    sizeMB: '18.8',
    badgeColor: '#f59e0b',
    emoji: '⭐',
  },
  {
    id: 'vroidhub_6145582116460020698.vrm',
    file: 'vroidhub_6145582116460020698.vrm',
    nameAr: 'VRoid Hub #8',
    nameEn: 'VRoid Hub Model 8',
    subtitleAr: 'شخصية عصرية بمظهر جذاب',
    gender: 'female',
    sizeMB: '17.9',
    badgeColor: '#3b82f6',
    emoji: '🚀',
  },
  {
    id: 'vroidhub_6231013805233726257.vrm',
    file: 'vroidhub_6231013805233726257.vrm',
    nameAr: 'VRoid Hub #9',
    nameEn: 'VRoid Hub Model 9',
    subtitleAr: 'شخصية مميزة لمقاطع المسابقات',
    gender: 'female',
    sizeMB: '18.1',
    badgeColor: '#a855f7',
    emoji: '🏆',
  },
  {
    id: 'vroidhub_7059432225102797152.vrm',
    file: 'vroidhub_7059432225102797152.vrm',
    nameAr: 'VRoid Hub #10',
    nameEn: 'VRoid Hub Model 10',
    subtitleAr: 'شخصية متقدمة بتعابير حية',
    gender: 'female',
    sizeMB: '18.9',
    badgeColor: '#14b8a6',
    emoji: '🌈',
  },
  {
    id: 'vroidhub_7155589085427280158.vrm',
    file: 'vroidhub_7155589085427280158.vrm',
    nameAr: 'VRoid Hub #11',
    nameEn: 'VRoid Hub Model 11',
    subtitleAr: 'شخصية VRoid عالية الجودة',
    gender: 'female',
    sizeMB: '19.5',
    badgeColor: '#e11d48',
    emoji: '🌺',
  },
  {
    id: 'vroidhub_7759704671414503471.vrm',
    file: 'vroidhub_7759704671414503471.vrm',
    nameAr: 'VRoid Hub #12',
    nameEn: 'VRoid Hub Model 12',
    subtitleAr: 'شخصية أنمي احترافية',
    gender: 'female',
    sizeMB: '19.5',
    badgeColor: '#84cc16',
    emoji: '🍀',
  },
];

const HF_MODEL_BASE_URL =
  'https://huggingface.co/datasets/shuaishuaicdp/VRM/resolve/main/release-human-plus-comet-v1/models/';

function getApiBase(): string {
  const env = (import.meta as unknown as { env?: Record<string, string | undefined> }).env;
  return (env?.VITE_API_BASE_URL || '').trim().replace(/\/$/, '');
}

export function withClawatarBasePath(relPath: string): string {
  const env = (import.meta as unknown as { env?: Record<string, string | undefined> }).env;
  const base = (env?.BASE_URL || '/').trim() || '/';
  const normalizedBase = base.endsWith('/') ? base : `${base}/`;
  return `${normalizedBase}${relPath.replace(/^\/+/, '')}`;
}

export function resolveClawatarModelUrl(
  modelId?: string,
  customModelUrl?: string
): string {
  if (modelId === 'custom' && customModelUrl) {
    return customModelUrl;
  }
  const cleanId = (modelId || 'base_female.vrm').trim();
  const known = CLAWATAR_MODELS.find((m) => m.id === cleanId || m.file === cleanId);
  const file = known ? known.file : 'base_female.vrm';

  const apiBase = getApiBase();
  if (isAndroidNativeApp() && !apiBase) {
    // Inside offline/local Android Capacitor WebView without external backend URL, fetch directly via HTTPS
    return `${HF_MODEL_BASE_URL}${encodeURIComponent(file)}`;
  }
  return `${apiBase}/api/clawatar/vrm-proxy?file=${encodeURIComponent(file)}`;
}

export type ClawatarMotionStateId =
  | 'idle'
  | 'talking'
  | 'thinking'
  | 'explaining'
  | 'greeting'
  | 'happy'
  | 'surprised'
  | 'confused';

export interface ClawatarStatePreset {
  stateId: ClawatarMotionStateId;
  actionId: string;
  labelAr: string;
  loop: boolean;
  expression: Exclude<ClawatarExpression, 'auto'>;
  expressionWeight: number;
}

export const CLAWATAR_STATE_PRESETS: ClawatarStatePreset[] = [
  { stateId: 'idle', actionId: '119_Idle', labelAr: 'سكون ووقفة طبيعية (Idle)', loop: true, expression: 'neutral', expressionWeight: 0 },
  { stateId: 'talking', actionId: '86_Talking', labelAr: 'تحدث مع الصوت (Talking)', loop: true, expression: 'happy', expressionWeight: 0.3 },
  { stateId: 'thinking', actionId: '88_Thinking', labelAr: 'تفكير وتركيز (Thinking)', loop: false, expression: 'neutral', expressionWeight: 0 },
  { stateId: 'explaining', actionId: 'dm_0', labelAr: 'شرح وتقديم (Explaining)', loop: true, expression: 'happy', expressionWeight: 0.35 },
  { stateId: 'greeting', actionId: '161_Waving', labelAr: 'ترحيب وتلويح (Greeting)', loop: false, expression: 'happy', expressionWeight: 0.75 },
  { stateId: 'happy', actionId: '19_Clapping', labelAr: 'فرح واحتفال (Happy)', loop: false, expression: 'happy', expressionWeight: 0.9 },
  { stateId: 'surprised', actionId: 'dm_42', labelAr: 'تشويق ودهشة (Surprised)', loop: false, expression: 'surprised', expressionWeight: 0.65 },
  { stateId: 'confused', actionId: '145_Shrugging', labelAr: 'تساؤل وحيرة (Confused)', loop: false, expression: 'relaxed', expressionWeight: 0.45 },
];

export interface ClawatarAnimationEntry {
  id: string;
  file: string;
  category: string;
  subcategory: string | null;
  loop: boolean;
  tags: string[];
  trigger: string;
  labelAr?: string;
}

export const FEATURED_CLAWATAR_ANIMATIONS: ClawatarAnimationEntry[] = [
  { id: '119_Idle', file: '119_Idle.vrma', category: 'idle', subcategory: null, loop: true, tags: ['idle'], trigger: 'Standard idle', labelAr: 'سكون طبيعي (Idle)' },
  { id: 'dm_24', file: 'dm_24.vrma', category: 'idle', subcategory: null, loop: true, tags: ['idle', 'cute'], trigger: 'Cute standby', labelAr: 'وقفة لطيفة متفاعلة' },
  { id: 'dm_23', file: 'dm_23.vrma', category: 'idle', subcategory: null, loop: true, tags: ['idle', 'cool'], trigger: 'Cool standby pose', labelAr: 'وقفة واثقة (Cool)' },
  { id: '86_Talking', file: '86_Talking.vrma', category: 'talking', subcategory: null, loop: true, tags: ['talking'], trigger: 'During conversation', labelAr: 'تحدث وحوار (Talking)' },
  { id: 'dm_0', file: 'dm_0.vrma', category: 'talking', subcategory: 'presenting', loop: true, tags: ['talking', 'presenting'], trigger: 'Presenting while speaking', labelAr: 'شرح وتقديم (Explaining)' },
  { id: 'dm_90', file: 'dm_90.vrma', category: 'talking', subcategory: 'presenting', loop: true, tags: ['talking', 'presenting'], trigger: 'Presenting/showing something', labelAr: 'إشارة للخيارات' },
  { id: 'dm_13', file: 'dm_13.vrma', category: 'talking', subcategory: null, loop: true, tags: ['talking'], trigger: 'Conversation gesture 1', labelAr: 'حركة يدين أثناء الكلام 1' },
  { id: 'dm_14', file: 'dm_14.vrma', category: 'talking', subcategory: null, loop: true, tags: ['talking'], trigger: 'Conversation gesture 2', labelAr: 'حركة يدين أثناء الكلام 2' },
  { id: '161_Waving', file: '161_Waving.vrma', category: 'reaction', subcategory: 'hello', loop: false, tags: ['hello'], trigger: 'Greeting wave', labelAr: 'ترحيب وتلويح (Greeting)' },
  { id: '79_Standing Greeting', file: '79_Standing Greeting.vrma', category: 'reaction', subcategory: 'hello', loop: false, tags: ['hello'], trigger: 'Standing greeting', labelAr: 'تحية وقوف احترافية' },
  { id: '88_Thinking', file: '88_Thinking.vrma', category: 'reaction', subcategory: 'thinking', loop: false, tags: ['thinking'], trigger: 'Deep thinking', labelAr: 'تفكير وتركيز (Thinking)' },
  { id: 'dm_3', file: 'dm_3.vrma', category: 'reaction', subcategory: 'thinking', loop: false, tags: ['thinking'], trigger: 'Thoughtful pose', labelAr: 'تأمل بالذقن' },
  { id: 'dm_108', file: 'dm_108.vrma', category: 'reaction', subcategory: 'thinking', loop: false, tags: ['thinking', 'point'], trigger: 'Pointing & thinking', labelAr: 'إشارة للأعلى نحو السؤال' },
  { id: 'dm_134', file: 'dm_134.vrma', category: 'oneshot', subcategory: null, loop: false, tags: ['watch'], trigger: 'Looking at watch', labelAr: 'تنبيه للوقت (الساعة)' },
  { id: 'dm_42', file: 'dm_42.vrma', category: 'reaction', subcategory: 'shush', loop: false, tags: ['shush'], trigger: 'Finger to lips shhh', labelAr: 'تشويق ودهشة (Surprised)' },
  { id: '145_Shrugging', file: '145_Shrugging.vrma', category: 'reaction', subcategory: 'whatever', loop: false, tags: ['shrug'], trigger: 'Shrug', labelAr: 'حيرة وتساؤل (Confused)' },
  { id: '49_Joyful Jump', file: '49_Joyful Jump.vrma', category: 'oneshot', subcategory: 'happy', loop: false, tags: ['happy', 'jump'], trigger: 'Happy jump', labelAr: 'قفزة احتفال وفرح' },
  { id: '19_Clapping', file: '19_Clapping.vrma', category: 'reaction', subcategory: 'happy', loop: false, tags: ['happy', 'clap'], trigger: 'Clapping applause', labelAr: 'تصفيق وفرح (Happy)' },
  { id: 'dm_28', file: 'dm_28.vrma', category: 'reaction', subcategory: 'encourage', loop: false, tags: ['cheer'], trigger: 'Cheer/encourage', labelAr: 'تشجيع وحماس' },
  { id: '156_Thankful', file: '156_Thankful.vrma', category: 'reaction', subcategory: 'grateful', loop: false, tags: ['grateful'], trigger: 'Thankful bow/heart', labelAr: 'شكر وختام (اشتراك)' },
  { id: '118_Head Nod Yes', file: '118_Head Nod Yes.vrma', category: 'reaction', subcategory: 'agree', loop: false, tags: ['agree'], trigger: 'Nod yes', labelAr: 'إيماءة موافقة' },
  { id: '144_Shaking Head No', file: '144_Shaking Head No.vrma', category: 'reaction', subcategory: 'refuse', loop: false, tags: ['refuse'], trigger: 'Shake head no', labelAr: 'هز الرأس بالرفض' },
  { id: 'reze_dance_hard', file: 'reze_dance_hard.vrma', category: 'dance', subcategory: null, loop: true, tags: ['dance'], trigger: 'Signature dance', labelAr: 'رقصة احتفالية' },
];

export const CLAWATAR_ARABIC_LABELS: Record<string, string> = Object.fromEntries(
  FEATURED_CLAWATAR_ANIMATIONS.map((a) => [a.id, a.labelAr || a.trigger || a.id])
);

export const CLAWATAR_CAMERA_PRESETS: {
  id: ClawatarCameraPreset;
  labelAr: string;
}[] = [
  { id: 'face', labelAr: 'الوجه' },
  { id: 'portrait', labelAr: 'بورتريه' },
  { id: 'upperBody', labelAr: 'نصف علوي' },
  { id: 'meeting', labelAr: 'كاميرا بث' },
  { id: 'full', labelAr: 'كامل الجسم' },
];

export const CLAWATAR_EXPRESSIONS: {
  id: Exclude<ClawatarExpression, 'auto'>;
  labelAr: string;
  emoji: string;
}[] = [
  { id: 'neutral', labelAr: 'طبيعي', emoji: '🙂' },
  { id: 'happy', labelAr: 'سعيد', emoji: '😄' },
  { id: 'relaxed', labelAr: 'هادئ', emoji: '😌' },
  { id: 'surprised', labelAr: 'متفاجئ', emoji: '😮' },
  { id: 'sad', labelAr: 'حزين', emoji: '🥺' },
  { id: 'angry', labelAr: 'جاد/غاضب', emoji: '😤' },
];

export interface ClawatarPoseMapping {
  actionId: string;
  loop: boolean;
  expression: Exclude<ClawatarExpression, 'auto'>;
  expressionWeight: number;
}

export function mapPresenterPoseToClawatar(
  pose: PresenterPoseId,
  phase: string
): ClawatarPoseMapping {
  switch (pose) {
    case 'waveSpeak':
      return { actionId: '161_Waving', loop: false, expression: 'happy', expressionWeight: 0.72 };
    case 'explain':
      return { actionId: 'dm_0', loop: true, expression: 'happy', expressionWeight: 0.35 };
    case 'pointUp':
      return { actionId: 'dm_108', loop: false, expression: 'relaxed', expressionWeight: 0.45 };
    case 'pointSide':
      return { actionId: 'dm_90', loop: true, expression: 'happy', expressionWeight: 0.45 };
    case 'thinkForehead':
      return { actionId: '88_Thinking', loop: false, expression: 'neutral', expressionWeight: 0 };
    case 'thinkChin':
      return { actionId: 'dm_3', loop: false, expression: 'relaxed', expressionWeight: 0.35 };
    case 'tapWatch':
      return { actionId: 'dm_134', loop: false, expression: 'surprised', expressionWeight: 0.55 };
    case 'leanSuspense':
      return { actionId: 'dm_42', loop: false, expression: 'surprised', expressionWeight: 0.55 };
    case 'celebrate':
      return { actionId: '49_Joyful Jump', loop: false, expression: 'happy', expressionWeight: 0.92 };
    case 'pointSubscribe':
      return { actionId: '156_Thankful', loop: false, expression: 'happy', expressionWeight: 0.8 };
    default: {
      if (phase === 'intro') {
        return { actionId: '161_Waving', loop: false, expression: 'happy', expressionWeight: 0.75 };
      }
      if (phase === 'outro') {
        return { actionId: '156_Thankful', loop: false, expression: 'happy', expressionWeight: 0.85 };
      }
      if (phase === 'thinking') {
        return { actionId: '88_Thinking', loop: false, expression: 'neutral', expressionWeight: 0 };
      }
      if (phase === 'suspense') {
        return { actionId: 'dm_42', loop: false, expression: 'surprised', expressionWeight: 0.55 };
      }
      if (phase === 'reveal') {
        return { actionId: '19_Clapping', loop: false, expression: 'happy', expressionWeight: 0.9 };
      }
      if (phase === 'readingOptions') {
        return { actionId: 'dm_90', loop: true, expression: 'happy', expressionWeight: 0.4 };
      }
      return { actionId: '86_Talking', loop: true, expression: 'happy', expressionWeight: 0.3 };
    }
  }
}

let cachedCatalogPromise: Promise<ClawatarAnimationEntry[]> | null = null;

export async function fetchVerifiedClawatarAnimations(): Promise<ClawatarAnimationEntry[]> {
  if (cachedCatalogPromise) return cachedCatalogPromise;
  cachedCatalogPromise = (async () => {
    const apiBase = getApiBase();
    try {
      if (!isAndroidNativeApp() || apiBase) {
        const resp = await fetch(`${apiBase}/api/clawatar/animations`);
        if (resp.ok) {
          const data = (await resp.json()) as { animations?: ClawatarAnimationEntry[] };
          if (Array.isArray(data.animations) && data.animations.length > 0) {
            return data.animations.map((a) => ({
              ...a,
              labelAr: CLAWATAR_ARABIC_LABELS[a.id] || a.trigger || a.id,
            }));
          }
        }
      } else {
        // On offline Android Capacitor APK, read local bundled animations/catalog.json directly
        const resp = await fetch(withClawatarBasePath('animations/catalog.json'));
        if (resp.ok) {
          const data = (await resp.json()) as { animations?: ClawatarAnimationEntry[] };
          if (Array.isArray(data.animations) && data.animations.length > 0) {
            return data.animations.map((a) => ({
              ...a,
              labelAr: CLAWATAR_ARABIC_LABELS[a.id] || a.trigger || a.id,
            }));
          }
        }
      }
    } catch {
      // fallback to featured list
    }
    return FEATURED_CLAWATAR_ANIMATIONS;
  })();
  return cachedCatalogPromise;
}
