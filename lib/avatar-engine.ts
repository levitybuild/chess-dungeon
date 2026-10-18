import { AVATAR_SVG_TEMPLATE } from './avatar-template';

export const SKINS = ["ffdbb4", "edb98a", "fd9841", "fcee93", "d08b5b", "ae5d29", "614335"];
export const EYES = ["default", "dizzy", "eyeroll", "happy", "close", "hearts", "side", "wink", "squint", "surprised", "winkwacky", "cry"];
export const EYEBROWS = ["default", "default2", "raised", "sad", "sad2", "unibrow", "updown", "updown2", "angry", "angry2"];
export const MOUTHS = ["default", "twinkle", "tongue", "smile", "serious", "scream", "sad", "grimace", "eating", "disbelief", "concerned", "vomit"];
export const HAIRSTYLES = ["bold", "longhair", "longhairbob", "hairbun", "longhaircurly", "longhaircurvy", "longhairdread", "nottoolong", "miawallace", "longhairstraight", "longhairstraight2", "shorthairdreads", "shorthairdreads2", "shorthairfrizzle", "shorthairshaggy", "shorthaircurly", "shorthairflat", "shorthairround", "shorthairwaved", "shorthairsides"];
export const HAIRCOLORS = ["bb7748_9a4f2b_6f2912", "404040_262626_101010", "c79d63_ab733e_844713", "e1c68e_d0a964_b88339", "906253_663d32_3b1d16", "f8afaf_f48a8a_ed5e5e", "f1e6cf_e9d8b6_dec393", "d75324_c13215_a31608", "59a0ff_3777ff_194bff"];
export const FACIALHAIRS = ["none", "magnum", "fancy", "magestic", "light"];
export const CLOTHES = ["vneck", "sweater", "hoodie", "overall", "blazer"];
export const FABRICCOLORS = ["545454", "65c9ff", "5199e4", "25557c", "e6e6e6", "929598", "a7ffc4", "ffdeb5", "ffafb9", "ffffb1", "ff5c5c", "e3adff"];
export const BACKGROUNDCOLORS = ["ffffff", "f5f6eb", "e5fde2", "d5effd", "d1d0fc", "f7d0fc", "d0d0d0"];
export const GLASSES = ["none", "rambo", "fancy", "old", "nerd", "fancy2", "harry"];
export const GLASSOPACITIES = ["10", "25", "50", "75", "100"];
export const TATTOOS = ["non", "harry", "airbender", "krilin", "front", "tribal", "tribal2", "throat"];
export const ACCESORIES = ["none", "earphones", "earring1", "earring2", "earring3"];

export interface AvatarConfig {
  skin: string;
  eye: string;
  eyebrow: string;
  mouth: string;
  hairstyle: string;
  haircolor: string;
  facialhair: string;
  clothes: string;
  fabriccolor: string;
  backgroundcolor: string;
  glasses: string;
  glassopacity: number;
  tattoos: string;
  accesories: string;
}

export const STORAGE_KEY_PLAYER = 'kakegurui_custom_avatar';
export const STORAGE_KEY_BOT = 'kakegurui_bot_avatar';

export function getRandomAvatarConfig(): AvatarConfig {
  return {
    skin: SKINS[Math.floor(Math.random() * SKINS.length)],
    eye: EYES[Math.floor(Math.random() * EYES.length)],
    eyebrow: EYEBROWS[Math.floor(Math.random() * EYEBROWS.length)],
    mouth: MOUTHS[Math.floor(Math.random() * MOUTHS.length)],
    hairstyle: HAIRSTYLES[Math.floor(Math.random() * HAIRSTYLES.length)],
    haircolor: HAIRCOLORS[Math.floor(Math.random() * HAIRCOLORS.length)],
    facialhair: FACIALHAIRS[Math.floor(Math.random() * FACIALHAIRS.length)],
    clothes: CLOTHES[Math.floor(Math.random() * CLOTHES.length)],
    fabriccolor: FABRICCOLORS[Math.floor(Math.random() * FABRICCOLORS.length)],
    backgroundcolor: BACKGROUNDCOLORS[Math.floor(Math.random() * BACKGROUNDCOLORS.length)],
    glasses: GLASSES[Math.floor(Math.random() * GLASSES.length)],
    glassopacity: parseInt(GLASSOPACITIES[Math.floor(Math.random() * GLASSOPACITIES.length)]) / 100,
    tattoos: TATTOOS[Math.floor(Math.random() * TATTOOS.length)],
    accesories: ACCESORIES[Math.floor(Math.random() * ACCESORIES.length)],
  };
}

export function mountAvatarTemplate(container: HTMLElement): void {
  if (!container) return;
  container.innerHTML = AVATAR_SVG_TEMPLATE;
  const svgs = container.querySelectorAll('svg');
  for (let i = 0; i < svgs.length; i++) {
    const s = svgs[i];
    s.style.position = 'absolute';
    s.style.top = '0';
    s.style.left = '0';
    s.style.width = '100%';
    s.style.height = '100%';
    s.style.pointerEvents = 'none';
  }
}

export function applyAvatarConfig(
  container: HTMLElement,
  cfg: AvatarConfig,
  options?: { transparentBackground?: boolean }
): void {
  if (!container || !cfg) return;

  // Make sure SVGs exist
  if (!container.querySelector('svg')) {
    mountAvatarTemplate(container);
  }

  // 1. Skin
  const bodyPath = container.querySelector('#skin #body');
  if (bodyPath) bodyPath.setAttribute('fill', '#' + cfg.skin);

  // 2. Eyes
  container.querySelectorAll('#eyes g').forEach((g: any) => (g.style.display = 'none'));
  const activeEye = container.querySelector('#eyes #e_' + cfg.eye) as HTMLElement;
  if (activeEye) activeEye.style.display = '';

  // 3. Eyebrows
  container.querySelectorAll('#eyebrows g').forEach((g: any) => (g.style.display = 'none'));
  const activeEb = container.querySelector('#eyebrows #eb_' + cfg.eyebrow) as HTMLElement;
  if (activeEb) activeEb.style.display = '';

  // 4. Mouth
  container.querySelectorAll('#mouths g').forEach((g: any) => (g.style.display = 'none'));
  const activeM = container.querySelector('#mouths #m_' + cfg.mouth) as HTMLElement;
  if (activeM) activeM.style.display = '';

  // 5. Hairstyle
  container.querySelectorAll('#hair_front g').forEach((g: any) => (g.style.display = 'none'));
  container.querySelectorAll('#hair_back g').forEach((g: any) => (g.style.display = 'none'));
  const activeHf = container.querySelectorAll('#hair_front .h_' + cfg.hairstyle);
  activeHf.forEach((g: any) => (g.style.display = ''));
  const activeHb = container.querySelectorAll('#hair_back .h_' + cfg.hairstyle);
  activeHb.forEach((g: any) => (g.style.display = ''));

  // 6. Hair Colors
  const colors = (cfg.haircolor || 'bb7748_9a4f2b_6f2912').split('_');
  container
    .querySelectorAll('#hair_front .h_' + cfg.hairstyle + ' .tinted')
    .forEach((p: any) => p.setAttribute('fill', '#' + colors[0]));
  container
    .querySelectorAll('#hair_back .h_' + cfg.hairstyle + ' .tinted')
    .forEach((p: any) => p.setAttribute('fill', '#' + colors[1]));

  // 7. Facial Hair
  container.querySelectorAll('#facialhair g').forEach((g: any) => (g.style.display = 'none'));
  const activeFh = container.querySelector('#facialhair #f_' + cfg.facialhair) as HTMLElement;
  if (activeFh) {
    activeFh.style.display = '';
    activeFh.querySelectorAll('.tinted').forEach((p: any) => p.setAttribute('fill', '#' + (colors[2] || colors[0])));
  }

  // 8. Clothes
  container.querySelectorAll('#clothes g').forEach((g: any) => (g.style.display = 'none'));
  const activeC = container.querySelector('#clothes #c_' + cfg.clothes) as HTMLElement;
  if (activeC) activeC.style.display = '';
  container
    .querySelectorAll('#clothes g .tinted')
    .forEach((p: any) => p.setAttribute('fill', '#' + cfg.fabriccolor));

  // 9. Glasses
  container.querySelectorAll('#glasses g').forEach((g: any) => (g.style.display = 'none'));
  const activeG = container.querySelector('#glasses #g_' + cfg.glasses) as HTMLElement;
  if (activeG) activeG.style.display = '';
  container
    .querySelectorAll('.glass')
    .forEach((p: any) => p.setAttribute('fill-opacity', `${cfg.glassopacity ?? 0.5}`));

  // 10. Background
  const bg = container.querySelector('#background') as HTMLElement;
  if (bg) {
    if (options?.transparentBackground) {
      bg.style.display = 'none';
    } else {
      bg.style.display = '';
      bg.setAttribute('fill', '#' + cfg.backgroundcolor);
    }
  }

  // 11. Tattoos
  container.querySelectorAll('#tattoos g').forEach((g: any) => (g.style.display = 'none'));
  const activeT = container.querySelector('#tattoos #t_' + cfg.tattoos) as HTMLElement;
  if (activeT) activeT.style.display = '';

  // 12. Accessories
  container.querySelectorAll('#accesories g').forEach((g: any) => (g.style.display = 'none'));
  const activeA = container.querySelector('#accesories #a_' + cfg.accesories) as HTMLElement;
  if (activeA) activeA.style.display = '';
}

export function savePlayerAvatar(containerOrHtml: HTMLElement | string): void {
  try {
    const html = typeof containerOrHtml === 'string' ? containerOrHtml : containerOrHtml.innerHTML;
    if (html && html.includes('<svg')) {
      localStorage.setItem(STORAGE_KEY_PLAYER, html);
    }
  } catch (_) {}
}

export function getPlayerAvatar(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEY_PLAYER);
  } catch (_) {
    return null;
  }
}

export function renderPlayerAvatar(
  container: HTMLElement,
  forceNew = false,
  options?: { transparentBackground?: boolean }
): AvatarConfig | null {
  if (!container) return null;
  if (!forceNew) {
    const saved = getPlayerAvatar();
    if (saved && saved.includes('<svg') && saved.includes('skin')) {
      container.innerHTML = saved;
      const svgs = container.querySelectorAll('svg');
      for (let i = 0; i < svgs.length; i++) {
        const s = svgs[i];
        s.style.position = 'absolute';
        s.style.top = '0';
        s.style.left = '0';
        s.style.width = '100%';
        s.style.height = '100%';
        s.style.pointerEvents = 'none';
      }
      if (options?.transparentBackground) {
        const bg = container.querySelector('#background') as HTMLElement;
        if (bg) bg.style.display = 'none';
      }
      return null;
    }
  }

  const cfg = getRandomAvatarConfig();
  mountAvatarTemplate(container);
  applyAvatarConfig(container, cfg, { transparentBackground: options?.transparentBackground ?? true });
  savePlayerAvatar(container);
  return cfg;
}

export function renderBotAvatar(
  container: HTMLElement,
  forceNew = false,
  options?: { transparentBackground?: boolean }
): AvatarConfig | null {
  if (!container) return null;
  let cfg: AvatarConfig | null = null;
  if (!forceNew) {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_BOT);
      if (saved) cfg = JSON.parse(saved);
    } catch (_) {}
  }
  if (!cfg) {
    cfg = getRandomAvatarConfig();
    try {
      localStorage.setItem(STORAGE_KEY_BOT, JSON.stringify(cfg));
    } catch (_) {}
  }

  mountAvatarTemplate(container);
  applyAvatarConfig(container, cfg, { transparentBackground: options?.transparentBackground ?? true });
  return cfg;
}

// Global AvatarSystem object for window compatibility
if (typeof window !== 'undefined') {
  (window as any).AvatarSystem = {
    SVG_TEMPLATE: AVATAR_SVG_TEMPLATE,
    STORAGE_KEY_PLAYER,
    STORAGE_KEY_BOT,
    mountTemplate: mountAvatarTemplate,
    applyConfig: applyAvatarConfig,
    getRandomConfig: getRandomAvatarConfig,
    renderRandomAvatar: (container: HTMLElement, options?: any) => {
      const cfg = getRandomAvatarConfig();
      mountAvatarTemplate(container);
      applyAvatarConfig(container, cfg, options);
      return cfg;
    },
    renderPlayerAvatar,
    renderBotAvatar,
    savePlayerAvatar,
    getPlayerAvatar,
  };
}
