import {
  DEFAULT_TEMPLATE,
  PRESET_BACKDROPS,
  PresetBackdropInfo,
  PresetId,
  QuizCategory,
  STUDIO_THEME_ORDER,
  TemplateSettings,
  VideoAspectRatio,
  applyStudioThemePreset,
} from './quiz';

export type ThemeCategoryId =
  | 'all'
  | 'cinematic'
  | 'luxury'
  | 'tv'
  | 'neon'
  | 'science'
  | 'sports'
  | 'history'
  | 'islamic'
  | 'minimal'
  | 'modern'
  | 'gaming'
  | 'space'
  | 'nature'
  | 'mystery'
  | 'vintage';

export interface ThemeCategoryMeta {
  id: ThemeCategoryId;
  label: string;
  emoji: string;
}

export const THEME_CATEGORIES: ThemeCategoryMeta[] = [
  { id: 'all', label: 'كل الثيمات', emoji: '🎨' },
  { id: 'cinematic', label: 'السينمائي والحماسي', emoji: '🎬' },
  { id: 'luxury', label: 'الذهبي والفخم', emoji: '👑' },
  { id: 'tv', label: 'مسابقات التلفزيون', emoji: '📺' },
  { id: 'neon', label: 'النيون والتقني', emoji: '⚡' },
  { id: 'gaming', label: 'الألعاب والتحدي', emoji: '🎮' },
  { id: 'science', label: 'العلمي والرياضيات', emoji: '🔬' },
  { id: 'sports', label: 'الرياضي', emoji: '⚽' },
  { id: 'islamic', label: 'الإسلامي والهندسي', emoji: '🕌' },
  { id: 'history', label: 'التاريخ والورق والكتب', emoji: '📚' },
  { id: 'space', label: 'الفضاء والشفق', emoji: '🌌' },
  { id: 'nature', label: 'الطبيعة والمحيط', emoji: '🌿' },
  { id: 'minimal', label: 'البسيط Minimal', emoji: '◽' },
  { id: 'modern', label: 'الحديث Modern', emoji: '💠' },
  { id: 'mystery', label: 'الألغاز والغموض', emoji: '🕵️' },
  { id: 'vintage', label: 'كلاسيكي Vintage', emoji: '🎞️' },
];

export interface ThemeCatalogMeta {
  id: PresetId;
  name: string;
  subtitle: string;
  emoji: string;
  category: Exclude<ThemeCategoryId, 'all'>;
  isLight?: boolean;
  decorSummary: string;
  recommendedQuizCategories?: QuizCategory[];
}

export const THEME_METADATA_MAP: Partial<Record<PresetId, ThemeCatalogMeta>> = {
  darkCinematic: {
    id: 'darkCinematic',
    name: 'السينمائي الداكن',
    subtitle: 'إضاءة درامية وإطار معدني فضي بتباين فائق الوضوح',
    emoji: '🎬',
    category: 'cinematic',
    decorSummary: 'إطار سينمائي معدني · زوم بطيء · تلاشي ناعم',
    recommendedQuizCategories: ['general', 'history', 'discussion'],
  },
  sunsetCinema: {
    id: 'sunsetCinema',
    name: 'الغروب السينمائي',
    subtitle: 'دفء سينمائي متدرج مع توهج دافئ وبطاقات زجاجية',
    emoji: '🌅',
    category: 'cinematic',
    decorSummary: 'توهج غروب · زوم وجزيئات · انتقال زوم',
    recommendedQuizCategories: ['general', 'literature'],
  },
  crimsonArena: {
    id: 'crimsonArena',
    name: 'الأحمر الحماسي (حلبة التحدي)',
    subtitle: 'طاقة تنافسية عالية مع مؤقت حلقي متوهج وإطارات حادة',
    emoji: '🔥',
    category: 'cinematic',
    decorSummary: 'شبكة حماسية · زوايا مضيئة · انتقال انزلاقي',
    recommendedQuizCategories: ['sports', 'general', 'discussion'],
  },
  samuraiInk: {
    id: 'samuraiInk',
    name: 'حبر الساموراي الحماسي',
    subtitle: 'قرص قرمزي وإطار ذهبي مزدوج ببطاقات مشطوفة',
    emoji: '⛩️',
    category: 'cinematic',
    decorSummary: 'شمس حبرية · إطار مزدوج · حواف مشطوفة',
    recommendedQuizCategories: ['history', 'general'],
  },
  luxuryGold: {
    id: 'luxuryGold',
    name: 'الذهبي الفخم',
    subtitle: 'فخامة آرت ديكو بلمعان ذهبي عميق وعداد سداسي',
    emoji: '👑',
    category: 'luxury',
    decorSummary: 'زوايا آرت ديكو ذهبية · جزيئات ذهبية · مسح ذهبي',
    recommendedQuizCategories: ['general', 'history'],
  },
  luxuryMarble: {
    id: 'luxuryMarble',
    name: 'الرخام الملكي الفخم',
    subtitle: 'رخام فاتح أنيق بعروق ذهبية ناعمة وتصميم راقٍ',
    emoji: '🏛️',
    category: 'luxury',
    isLight: true,
    decorSummary: 'عروق رخام ذهبية · بطاقات طبقية · مسح ذهبي',
    recommendedQuizCategories: ['literature', 'general', 'history'],
  },
  royalPurple: {
    id: 'royalPurple',
    name: 'البنفسجي الملكي',
    subtitle: 'ملكي بلمسات ذهبية وإضاءة مسرحية فخمة',
    emoji: '👑',
    category: 'luxury',
    decorSummary: 'حزم ضوئية ملكية · عداد سداسي · مسح ذهبي',
    recommendedQuizCategories: ['general', 'history'],
  },
  espressoLounge: {
    id: 'espressoLounge',
    name: 'لاونج الإسبريسو الدافئ',
    subtitle: 'دفء خشبي فاخر وإضاءة هادئة للقراءة والتركيز',
    emoji: '☕',
    category: 'luxury',
    decorSummary: 'حلقات دافئة · إطار ذهبي ناعم · تلاشي',
    recommendedQuizCategories: ['literature', 'discussion', 'general'],
  },
  tvShowGold: {
    id: 'tvShowGold',
    name: 'مسابقات التلفزيون الذهبي',
    subtitle: 'أجواء برامج المسابقات التلفزيونية بإضاءة وأضواء كاشفة',
    emoji: '📺',
    category: 'tv',
    decorSummary: 'كشافات مسرحية · حواف 3D · مسح ذهبي',
    recommendedQuizCategories: ['general', 'geography', 'sports'],
  },
  millionaire: {
    id: 'millionaire',
    name: 'من سيربح المليون',
    subtitle: 'بطاقات سداسية أيقونية وسُلّم الجوائز التلفزيوني',
    emoji: '💎',
    category: 'tv',
    decorSummary: 'دوائر ساحة المليونير · سلم جوائز · بطاقات سداسية',
    recommendedQuizCategories: ['general', 'history', 'geography'],
  },
  goldenQuizShow: {
    id: 'goldenQuizShow',
    name: 'مسرح الأضواء الذهبي',
    subtitle: 'ستارة مسرحية ذهبية مع عداد سداسي وتشويق بصري',
    emoji: '🎭',
    category: 'tv',
    decorSummary: 'كشافات ذهبية · لمعان 3D · مسح ذهبي',
    recommendedQuizCategories: ['general', 'discussion'],
  },
  channelSand: {
    id: 'channelSand',
    name: 'قالب القناة الرملي الكلاسيكي',
    subtitle: 'أسلوب القناة المألوف بلون رملي دافئ وتباين عالٍ',
    emoji: '🏜️',
    category: 'tv',
    isLight: true,
    decorSummary: 'خلفية القناة الرسمية · عداد متطابق · وضوح فائق',
    recommendedQuizCategories: ['general', 'islamic', 'geography'],
  },
  channelNavy: {
    id: 'channelNavy',
    name: 'الكحلي الملكي (القناة)',
    subtitle: 'تصميم القناة الرسمي باللون الكحلي والإطار الذهبي',
    emoji: '📘',
    category: 'tv',
    decorSummary: 'كحلي وإطار ذهبي · لمعان بطاقات · وضوح فائق',
    recommendedQuizCategories: ['general', 'geography', 'history'],
  },
  channelEmerald: {
    id: 'channelEmerald',
    name: 'الزمردي الكلاسيكي (القناة)',
    subtitle: 'بطاقات كريمية دافئة على خلفية زمردية راقية',
    emoji: '💚',
    category: 'tv',
    decorSummary: 'خلفية زمردية · بطاقات فاتحة وإطار ذهبي',
    recommendedQuizCategories: ['islamic', 'general'],
  },
  neonCyber: {
    id: 'neonCyber',
    name: 'أضواء النيون Neon',
    subtitle: 'توهج سماوي وأرجواني كهربائي مع شبكة سايبر مستقبلية',
    emoji: '⚡',
    category: 'neon',
    decorSummary: 'شبكة نيون · حلقة عداد مضيئة · انتقال زوم',
    recommendedQuizCategories: ['technology', 'science', 'general'],
  },
  techBlue: {
    id: 'techBlue',
    name: 'الأزرق التقني',
    subtitle: 'تصميم هندسي أزرق بمسارات دوائر إلكترونية واضحة',
    emoji: '💻',
    category: 'neon',
    decorSummary: 'مسارات دوائر تقنية · شريط بث · خط تجوال',
    recommendedQuizCategories: ['technology', 'science', 'math'],
  },
  matrixTerminal: {
    id: 'matrixTerminal',
    name: 'مصفوفة الشفرة الرقمية',
    subtitle: 'أخضر تقني داكن بأسلوب الشفرات والبرمجة والذكاء',
    emoji: '🧑‍💻',
    category: 'neon',
    decorSummary: 'خطوط رقمية عمودية · توهج أخضر · انزلاق',
    recommendedQuizCategories: ['technology', 'math', 'science'],
  },
  tokyoDrift: {
    id: 'tokyoDrift',
    name: 'طوكيو سينثويف نيون',
    subtitle: 'أفق ليلي وأضواء نيون وردية وسماوية سريعة الإيقاع',
    emoji: '🌆',
    category: 'neon',
    decorSummary: 'شبكة منظور وأفق نيون · حلقة نيون متوهجة',
    recommendedQuizCategories: ['technology', 'general', 'discussion'],
  },
  gamingArena: {
    id: 'gamingArena',
    name: 'ثيم الألعاب Gaming',
    subtitle: 'واجهات eSports بزوايا HUD وحواف مشطوفة واحتفال ناري',
    emoji: '🎮',
    category: 'gaming',
    decorSummary: 'إطار HUD ألعاب · زوايا تصويب · حلقة نيون',
    recommendedQuizCategories: ['technology', 'general', 'discussion'],
  },
  comicPop: {
    id: 'comicPop',
    name: 'كوميكس بوب الحيوي',
    subtitle: 'أشعة بوب صفراء وحواف بارزة ممتعة للتحديات الشبابية',
    emoji: '💥',
    category: 'gaming',
    isLight: true,
    decorSummary: 'أشعة بوب مبهجة · تباين أصفر وأزرق · كونفيتي',
    recommendedQuizCategories: ['general', 'discussion', 'sports'],
  },
  playfulKids: {
    id: 'playfulKids',
    name: 'ألوان مبهجة 3D',
    subtitle: 'أزرق سماوي ولمسات صفراء مرحة مناسبة للمسابقات الخفيفة',
    emoji: '🎨',
    category: 'gaming',
    isLight: true,
    decorSummary: 'فقاعات ملونة ناعمة · زوايا دائرية · عداد دائري',
    recommendedQuizCategories: ['general', 'science', 'math'],
  },
  scienceLab: {
    id: 'scienceLab',
    name: 'الثيم العلمي',
    subtitle: 'مدارات ذرية وخلايا سداسية بأسلوب المختبرات والعلوم',
    emoji: '🔬',
    category: 'science',
    decorSummary: 'مدارات ذرية وسداسيات · خط تجوال · توهج سماوي',
    recommendedQuizCategories: ['science', 'technology', 'math'],
  },
  channelMath: {
    id: 'channelMath',
    name: 'سبورة الرياضيات والألغاز',
    subtitle: 'سبورة خضراء واضحة مع إطار رملي مثالية للمعادلات',
    emoji: '🧮',
    category: 'science',
    decorSummary: 'خلفية سبورة حقيقية · وضوح أرقام ومعادلات',
    recommendedQuizCategories: ['math', 'science'],
  },
  stadiumArena: {
    id: 'stadiumArena',
    name: 'الثيم الرياضي (ملعب الأبطال)',
    subtitle: 'أضواء الملاعب الخضراء وتفاصيل حماسية للبطولات',
    emoji: '⚽',
    category: 'sports',
    decorSummary: 'أضواء ملعب · عداد كبسولة · انتقال سريع',
    recommendedQuizCategories: ['sports'],
  },
  stealthCarbon: {
    id: 'stealthCarbon',
    name: 'كاربون السباقات الرياضي',
    subtitle: 'ألياف كاربون داكنة مع شرائط حمراء سريعة للرياضة والسيارات',
    emoji: '🏎️',
    category: 'sports',
    decorSummary: 'نسيج كاربون وأشرطة سباق · انتقال سريع',
    recommendedQuizCategories: ['sports', 'technology'],
  },
  islamicAndalusian: {
    id: 'islamicAndalusian',
    name: 'الثيم الإسلامي الأندلسي',
    subtitle: 'زخارف هندسية راقية وخط أميري أصيل وألوان زمردية ذهبية',
    emoji: '🕌',
    category: 'islamic',
    decorSummary: 'خلفية أندلسية · خط أميري · إطار ذهبي وعداد سداسي',
    recommendedQuizCategories: ['islamic', 'history', 'literature'],
  },
  ramadanLantern: {
    id: 'ramadanLantern',
    name: 'الليالي الإسلامية والهندسية',
    subtitle: 'نجوم ثمانية وزوايا هندسية ذهبية على خلفية ليلية هادئة',
    emoji: '🌙',
    category: 'islamic',
    decorSummary: 'نجوم ثمانية هندسية · إطار مزدوج · خط أميري',
    recommendedQuizCategories: ['islamic', 'history'],
  },
  ancientHistory: {
    id: 'ancientHistory',
    name: 'الثيم التاريخي',
    subtitle: 'مخطوطات وأعمدة حضارية بألوان برونزية ذهبية وخط أميري',
    emoji: '🏛️',
    category: 'history',
    decorSummary: 'مشهد تاريخي · خط أميري · إطار ذهبي كلاسيكي',
    recommendedQuizCategories: ['history', 'geography', 'islamic'],
  },
  bookArchive: {
    id: 'bookArchive',
    name: 'ثيم الورق والكتب',
    subtitle: 'صفحة كتاب مسطّرة وبطاقات تذاكر أدبية أنيقة ومريحة للعين',
    emoji: '📚',
    category: 'history',
    isLight: true,
    decorSummary: 'سطور ورقية وهامش كتاب · خط أميري · تباين داكن واضح',
    recommendedQuizCategories: ['literature', 'history', 'islamic'],
  },
  parchmentGold: {
    id: 'parchmentGold',
    name: 'المخطوطة والرق الذهبي',
    subtitle: 'ملمس مخطوطة قديمة بإطار ذهبي مزدوج وخط عربي أصيل',
    emoji: '📜',
    category: 'history',
    isLight: true,
    decorSummary: 'إطار مخطوطة مزدوج · خط أميري · تباين تراثي',
    recommendedQuizCategories: ['history', 'literature', 'islamic'],
  },
  desertMirage: {
    id: 'desertMirage',
    name: 'سراب الصحراء التاريخي',
    subtitle: 'تدرجات رملية دافئة وكثبان هادئة للسير والتاريخ والجغرافيا',
    emoji: '🏜️',
    category: 'history',
    decorSummary: 'كثبان صحراوية وشمس دافئة · مسح ذهبي',
    recommendedQuizCategories: ['geography', 'history', 'islamic'],
  },
  cosmicSpace: {
    id: 'cosmicSpace',
    name: 'ثيم الفضاء والمجرات',
    subtitle: 'أعماق المجرة والنجوم المتلألئة مع حلقات نيون فلكية',
    emoji: '🌌',
    category: 'space',
    decorSummary: 'مجرة ونجوم لامعة · حلقة نيون · انتقال زوم',
    recommendedQuizCategories: ['science', 'geography', 'technology'],
  },
  auroraBorealis: {
    id: 'auroraBorealis',
    name: 'الشفق القطبي الفضائي',
    subtitle: 'موجات الشفق التركوازية والبنفسجية فوق أفق سماوي هادئ',
    emoji: '✨',
    category: 'space',
    decorSummary: 'أشرطة شفق قطبي · عداد حلقي · تدرج تركوازي',
    recommendedQuizCategories: ['science', 'geography', 'general'],
  },
  galacticRose: {
    id: 'galacticRose',
    name: 'السديم الوردي الكوني',
    subtitle: 'سديم فضائي وردي وأرجواني مع مسار مداري ناعم',
    emoji: '🌸',
    category: 'space',
    decorSummary: 'سديم ومدار بيضاوي · توهج أرجواني لطيف',
    recommendedQuizCategories: ['science', 'general', 'literature'],
  },
  natureEmerald: {
    id: 'natureEmerald',
    name: 'ثيم الطبيعة الخضراء',
    subtitle: 'أخضر غابات طبيعي بأقواس نباتية ناعمة وألوان مريحة للعين',
    emoji: '🌿',
    category: 'nature',
    decorSummary: 'أقواس أوراق نباتية · زوم هادئ · بطاقات طبقية',
    recommendedQuizCategories: ['science', 'geography', 'general'],
  },
  oceanAbyss: {
    id: 'oceanAbyss',
    name: 'أعماق المحيط الهادئ',
    subtitle: 'زرقة بحرية عميقة مع انعكاسات ضوء مائية وأمواج ناعمة',
    emoji: '🌊',
    category: 'nature',
    decorSummary: 'تموجات مائية · عداد دائري · تباين أزرق سماوي',
    recommendedQuizCategories: ['geography', 'science', 'general'],
  },
  arcticCyan: {
    id: 'arcticCyan',
    name: 'الجليد القطبي الزجاجي',
    subtitle: 'بلورات جليدية زجاجية نقية وتدرج أزرق بارد ومريح',
    emoji: '❄️',
    category: 'nature',
    decorSummary: 'حلقات جليدية · بطاقات زجاجية · تلاشي ناعم',
    recommendedQuizCategories: ['geography', 'science'],
  },
  minimalClean: {
    id: 'minimalClean',
    name: 'الثيم البسيط Minimal',
    subtitle: 'نقاء بصري أبيض وأسود بخطوط واضحة وتنسيق تحريري نظيف',
    emoji: '◽',
    category: 'minimal',
    isLight: true,
    decorSummary: 'خطوط هندسية رفيعة · أقصى وضوح للنص · تلاشي نظيف',
    recommendedQuizCategories: ['general', 'literature', 'math'],
  },
  mintEditorial: {
    id: 'mintEditorial',
    name: 'النعناعي البسيط العصري',
    subtitle: 'خلفية فاتحة هادئة بلمسة نعناعية واضحة ومحببة',
    emoji: '🌱',
    category: 'minimal',
    isLight: true,
    decorSummary: 'دوائر ناعمة · ألوان باستيل طبيعية · تلاشي ناعم',
    recommendedQuizCategories: ['general', 'science', 'discussion'],
  },
  pastelDream: {
    id: 'pastelDream',
    name: 'الباستيل البسيط الناعم',
    subtitle: 'درجات وردي وخزامى فاتحة خالية من التشتيت',
    emoji: '☁️',
    category: 'minimal',
    isLight: true,
    decorSummary: 'سحب باستيل لطيفة · بطاقات بيضاء صافية',
    recommendedQuizCategories: ['general', 'discussion', 'literature'],
  },
  modernStudio: {
    id: 'modernStudio',
    name: 'الثيم الحديث Modern',
    subtitle: 'زجاج ضبابي عصري وتدرجات نيلية نظيفة متوافقة مع الهوية',
    emoji: '💠',
    category: 'modern',
    decorSummary: 'أشرطة ضوئية قطرية · بطاقات زجاجية · انتقال زوم',
    recommendedQuizCategories: ['technology', 'general', 'discussion'],
  },
  quizProSignature: {
    id: 'quizProSignature',
    name: 'كويز برو الحديث التوقيعي',
    subtitle: 'الهوية البصرية الحديثة بالزمردي والذهبي المتوازن',
    emoji: '💎',
    category: 'modern',
    decorSummary: 'حزم زمردية ومعينات ذهبية · وضوح عالٍ',
    recommendedQuizCategories: ['general', 'technology', 'sports'],
  },
  mysteryVault: {
    id: 'mysteryVault',
    name: 'ثيم الألغاز والغموض',
    subtitle: 'ضباب أرجواني داكن وحلقات تركيز غامضة للألغاز والذكاء',
    emoji: '🕵️',
    category: 'mystery',
    decorSummary: 'حلقات غموض متحدة المركز · إضاءة بنفسجية · زوم وتلاشي',
    recommendedQuizCategories: ['general', 'math', 'history', 'discussion'],
  },
  vintageClassic: {
    id: 'vintageClassic',
    name: 'ثيم كلاسيكي Vintage',
    subtitle: 'طابع سينمائي عتيق بإطارات منقطة ذهبية وخط أميري دافئ',
    emoji: '🎞️',
    category: 'vintage',
    decorSummary: 'شريط كلاسيكي وزخرفة زوايا · خط أميري · إطار ذهبي متقطع',
    recommendedQuizCategories: ['history', 'literature', 'general'],
  },
  emerald: {
    id: 'emerald',
    name: 'الزمرد الذهبي الكلاسيكي',
    subtitle: 'تصميم زمردي ذهبي هادئ ومناسب لجميع المسابقات',
    emoji: '❇️',
    category: 'luxury',
    decorSummary: 'خلفية زمردية مصممة · تباين ذهبي',
  },
  navy: {
    id: 'navy',
    name: 'الأزرق الليلي الكلاسيكي',
    subtitle: 'خلفية زرقاء عميقة تناسب المعلومات العامة والجغرافيا',
    emoji: '🌌',
    category: 'vintage',
    decorSummary: 'خلفية زرقاء ليلية متوازنة',
  },
  obsidian: {
    id: 'obsidian',
    name: 'الأوبسيديان والبرونز الغامض',
    subtitle: 'درجات برونزية داكنة مع بريق هادئ للمسابقات المسائية',
    emoji: '🪨',
    category: 'mystery',
    decorSummary: 'خلفية برونزية داكنة فخمة',
  },
};

export interface ThemeLibraryEntry {
  id: PresetId;
  backdrop: PresetBackdropInfo;
  meta: ThemeCatalogMeta;
  previewTemplate: TemplateSettings;
}

const cachedEntriesByAspect: Partial<Record<VideoAspectRatio, ThemeLibraryEntry[]>> = {};

export function getThemeLibraryEntries(aspectRatio: VideoAspectRatio = '9:16'): ThemeLibraryEntry[] {
  if (cachedEntriesByAspect[aspectRatio]) {
    return cachedEntriesByAspect[aspectRatio]!;
  }

  const orderIndex = new Map<PresetId, number>();
  STUDIO_THEME_ORDER.forEach((id, idx) => orderIndex.set(id, idx));

  const sortedBackdrops = [...PRESET_BACKDROPS].sort((a, b) => {
    const ia = orderIndex.has(a.id) ? orderIndex.get(a.id)! : 999;
    const ib = orderIndex.has(b.id) ? orderIndex.get(b.id)! : 999;
    return ia - ib;
  });

  const baseTpl: TemplateSettings = { ...DEFAULT_TEMPLATE, aspectRatio };

  const entries: ThemeLibraryEntry[] = sortedBackdrops.map((backdrop) => {
    const fallbackMeta: ThemeCatalogMeta = {
      id: backdrop.id,
      name: backdrop.label,
      subtitle: 'ثيم بصري متكامل متوافق مع الشورتس والفيديو الطويل',
      emoji: '🎨',
      category: 'modern',
      decorSummary: 'تنسيق متوازن جاهز للتصدير',
    };
    const meta = THEME_METADATA_MAP[backdrop.id] ?? fallbackMeta;
    const previewTemplate = applyStudioThemePreset(baseTpl, backdrop.id);
    return {
      id: backdrop.id,
      backdrop,
      meta,
      previewTemplate,
    };
  });

  cachedEntriesByAspect[aspectRatio] = entries;
  return entries;
}

export function getThemeEntryById(
  presetId: PresetId,
  aspectRatio: VideoAspectRatio = '9:16'
): ThemeLibraryEntry {
  const list = getThemeLibraryEntries(aspectRatio);
  return list.find((e) => e.id === presetId) ?? list[0];
}
