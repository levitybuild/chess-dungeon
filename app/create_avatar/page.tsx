'use client';

import React, { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { getChessClient } from '../../lib/chess-dungeon-client';
import {
  mountAvatarTemplate,
  SKINS,
  EYES,
  EYEBROWS,
  MOUTHS,
  HAIRSTYLES,
  HAIRCOLORS,
  FACIALHAIRS,
  CLOTHES,
  FABRICCOLORS,
  BACKGROUNDCOLORS,
  GLASSES,
  GLASSOPACITIES,
  TATTOOS,
  ACCESORIES,
} from '../../lib/avatar-engine';

const CATEGORIES = [
  { id: 'skins', label: 'Body' },
  { id: 'eyes', label: 'Eyes' },
  { id: 'eyebrows', label: 'Eyebrows' },
  { id: 'mouths', label: 'Mouths' },
  { id: 'hairstyles', label: 'Hairstyles' },
  { id: 'haircolors', label: 'Hair Colors' },
  { id: 'facialhairs', label: 'Facial Hair' },
  { id: 'clothes', label: 'Clothes' },
  { id: 'fabriccolors', label: 'Fabric Colors' },
  { id: 'backgroundcolors', label: 'Background' },
  { id: 'glasses', label: 'Glasses' },
  { id: 'glassopacity', label: 'Glass Opacity' },
  { id: 'tattoos', label: 'Tattoos' },
  { id: 'accesories', label: 'Accessories' },
];

const SPRITE_URL = 'https://i.imgur.com/q0DdlUI.png';
const SPRITE_ROW_OFFSETS: Record<string, number> = {
  eyes: 0,
  eyebrows: -53,
  mouths: -106,
  hairstyles: -159,
  facialhairs: -212,
  clothes: -265,
  glasses: -313,
  accesories: -369,
  tattoos: -419,
};

interface CategoryOption {
  id: string;
  label: string;
  color?: string;
  spriteIndex?: number;
}

export default function AvatarMakerPage() {
  const router = useRouter();
  const createdRef = useRef<HTMLDivElement>(null);
  const [activeCategory, setActiveCategory] = useState('skins');

  const avatarStateRef = useRef({
    skin: 'ffdbb4',
    hairColor: 'bb7748_9a4f2b_6f2912',
    hairstyle: 'longhair',
    fabricColor: '545454',
    glassOpacity: 0.5,
  });

  const saveAvatar = () => {
    const el = createdRef.current;
    if (!el || !el.querySelector('svg')) return;
    try {
      const html = el.innerHTML;
      if (html && html.includes('<svg')) {
        // Save to localStorage so games (local & online) can use it immediately
        localStorage.setItem('kakegurui_custom_avatar', html);
        localStorage.setItem('cd_custom_avatar_config', JSON.stringify(avatarStateRef.current));

        const client = getChessClient();
        // If authenticated, this persists to Levity database (users & media/avatars)
        client.saveAvatarSvg(html).catch((err) => {
          console.warn('Avatar DB save warning:', err);
        });
      }
    } catch (_) {}
  };

  const handleDone = () => {
    saveAvatar();
    // Clicking done routes back home (not to any chess game)
    router.push('/home');
  };

  const applyRandom = () => {
    const el = createdRef.current;
    if (!el) return;

    if (!el.querySelector('svg')) {
      mountAvatarTemplate(el);
    }

    const randSkin = SKINS[Math.floor(Math.random() * SKINS.length)];
    const randEyes = EYES[Math.floor(Math.random() * EYES.length)];
    const randEyebrows = EYEBROWS[Math.floor(Math.random() * EYEBROWS.length)];
    const randMouth = MOUTHS[Math.floor(Math.random() * MOUTHS.length)];
    const randHair = HAIRSTYLES[Math.floor(Math.random() * HAIRSTYLES.length)];
    const randHairColor = HAIRCOLORS[Math.floor(Math.random() * HAIRCOLORS.length)];
    const randFacial = FACIALHAIRS[Math.floor(Math.random() * FACIALHAIRS.length)];
    const randClothes = CLOTHES[Math.floor(Math.random() * CLOTHES.length)];
    const randFabric = FABRICCOLORS[Math.floor(Math.random() * FABRICCOLORS.length)];
    const randBg = BACKGROUNDCOLORS[Math.floor(Math.random() * BACKGROUNDCOLORS.length)];
    const randGlasses = GLASSES[Math.floor(Math.random() * GLASSES.length)];
    const randGlassOp = parseInt(GLASSOPACITIES[Math.floor(Math.random() * GLASSOPACITIES.length)]) / 100;
    const randTattoo = TATTOOS[Math.floor(Math.random() * TATTOOS.length)];
    const randAccessory = ACCESORIES[Math.floor(Math.random() * ACCESORIES.length)];

    avatarStateRef.current = {
      skin: randSkin,
      hairColor: randHairColor,
      hairstyle: randHair,
      fabricColor: randFabric,
      glassOpacity: randGlassOp,
    };

    // Body skin
    const bodyPath = el.querySelector('#skin #body');
    if (bodyPath) bodyPath.setAttribute('fill', '#' + randSkin);

    // Eyes
    el.querySelectorAll('#eyes g').forEach((g: any) => (g.style.display = 'none'));
    const eyeEl = el.querySelector('#eyes #e_' + randEyes) as HTMLElement;
    if (eyeEl) eyeEl.style.display = '';

    // Eyebrows
    el.querySelectorAll('#eyebrows g').forEach((g: any) => (g.style.display = 'none'));
    const ebEl = el.querySelector('#eyebrows #eb_' + randEyebrows) as HTMLElement;
    if (ebEl) ebEl.style.display = '';

    // Mouths
    el.querySelectorAll('#mouths g').forEach((g: any) => (g.style.display = 'none'));
    const mEl = el.querySelector('#mouths #m_' + randMouth) as HTMLElement;
    if (mEl) mEl.style.display = '';

    // Hairstyles
    el.querySelectorAll('#hair_front g').forEach((g: any) => (g.style.display = 'none'));
    el.querySelectorAll('#hair_back g').forEach((g: any) => (g.style.display = 'none'));
    el.querySelectorAll('#hair_front .h_' + randHair).forEach((g: any) => (g.style.display = ''));
    el.querySelectorAll('#hair_back .h_' + randHair).forEach((g: any) => (g.style.display = ''));

    // Hair colors
    const colors = randHairColor.split('_');
    el.querySelectorAll('#hair_front .h_' + randHair + ' .tinted').forEach((p: any) => p.setAttribute('fill', '#' + colors[0]));
    el.querySelectorAll('#hair_back .h_' + randHair + ' .tinted').forEach((p: any) => p.setAttribute('fill', '#' + colors[1]));
    el.querySelectorAll('#facialhair g .tinted').forEach((p: any) => p.setAttribute('fill', '#' + colors[2]));

    // Facial hair
    el.querySelectorAll('#facialhair g').forEach((g: any) => (g.style.display = 'none'));
    const fEl = el.querySelector('#facialhair #f_' + randFacial) as HTMLElement;
    if (fEl) fEl.style.display = '';

    // Clothes
    el.querySelectorAll('#clothes g').forEach((g: any) => (g.style.display = 'none'));
    const cEl = el.querySelector('#clothes #c_' + randClothes) as HTMLElement;
    if (cEl) cEl.style.display = '';
    el.querySelectorAll('#clothes g .tinted').forEach((p: any) => p.setAttribute('fill', '#' + randFabric));

    // Glasses
    el.querySelectorAll('#glasses g').forEach((g: any) => (g.style.display = 'none'));
    const gEl = el.querySelector('#glasses #g_' + randGlasses) as HTMLElement;
    if (gEl) gEl.style.display = '';
    el.querySelectorAll('.glass').forEach((p: any) => p.setAttribute('fill-opacity', `${randGlassOp}`));

    // Background
    const bg = el.querySelector('#background') as HTMLElement;
    if (bg) bg.setAttribute('fill', '#' + randBg);

    // Tattoos
    el.querySelectorAll('#tattoos g').forEach((g: any) => (g.style.display = 'none'));
    const tEl = el.querySelector('#tattoos #t_' + randTattoo) as HTMLElement;
    if (tEl) tEl.style.display = '';

    // Accessories
    el.querySelectorAll('#accesories g').forEach((g: any) => (g.style.display = 'none'));
    const aEl = el.querySelector('#accesories #a_' + randAccessory) as HTMLElement;
    if (aEl) aEl.style.display = '';

    saveAvatar();
  };

  // Immediate synchronous mount on client: Loads DB avatar for auth users or localStorage for anon
  useEffect(() => {
    const el = createdRef.current;
    if (!el) return;

    try {
      const client = getChessClient();
      const user = client.getCurrentUser();

      // Check if authenticated user has custom avatar in DB or cached locally
      let avatarHtmlToLoad: string | null = null;
      if (user && !user.isAnonymous && user.avatarSvg && user.avatarSvg.includes('<svg')) {
        avatarHtmlToLoad = user.avatarSvg;
      } else {
        const saved = localStorage.getItem('kakegurui_custom_avatar');
        if (saved && saved.includes('<svg') && saved.includes('skincolor') && saved.includes('eyes')) {
          avatarHtmlToLoad = saved;
        }
      }

      if (avatarHtmlToLoad) {
        el.innerHTML = avatarHtmlToLoad;
        // Make sure all SVGs have proper CSS positioning
        const svgs = el.querySelectorAll('svg');
        for (let i = 0; i < svgs.length; i++) {
          const s = svgs[i];
          s.style.position = 'absolute';
          s.style.top = '0';
          s.style.left = '0';
          s.style.width = '100%';
          s.style.height = '100%';
          s.style.pointerEvents = 'none';
        }
      } else {
        mountAvatarTemplate(el);
        applyRandom();
      }
    } catch (_) {
      mountAvatarTemplate(el);
      applyRandom();
    }
  }, []);

  const selectOption = (cat: string, val: string) => {
    const el = createdRef.current;
    if (!el) return;

    if (!el.querySelector('svg')) {
      mountAvatarTemplate(el);
    }

    if (cat === 'skins') {
      avatarStateRef.current.skin = val;
      const body = el.querySelector('#skin #body');
      if (body) body.setAttribute('fill', '#' + val);
    } else if (cat === 'eyes') {
      el.querySelectorAll('#eyes g').forEach((g: any) => (g.style.display = 'none'));
      const target = el.querySelector('#eyes #e_' + val) as HTMLElement;
      if (target) target.style.display = '';
    } else if (cat === 'eyebrows') {
      el.querySelectorAll('#eyebrows g').forEach((g: any) => (g.style.display = 'none'));
      const target = el.querySelector('#eyebrows #eb_' + val) as HTMLElement;
      if (target) target.style.display = '';
    } else if (cat === 'mouths') {
      el.querySelectorAll('#mouths g').forEach((g: any) => (g.style.display = 'none'));
      const target = el.querySelector('#mouths #m_' + val) as HTMLElement;
      if (target) target.style.display = '';
    } else if (cat === 'hairstyles') {
      avatarStateRef.current.hairstyle = val;
      el.querySelectorAll('#hair_front g').forEach((g: any) => (g.style.display = 'none'));
      el.querySelectorAll('#hair_back g').forEach((g: any) => (g.style.display = 'none'));
      el.querySelectorAll('#hair_front .h_' + val).forEach((g: any) => (g.style.display = ''));
      el.querySelectorAll('#hair_back .h_' + val).forEach((g: any) => (g.style.display = ''));
      const parts = avatarStateRef.current.hairColor.split('_');
      el.querySelectorAll('#hair_front .h_' + val + ' .tinted').forEach((p: any) => p.setAttribute('fill', '#' + parts[0]));
      el.querySelectorAll('#hair_back .h_' + val + ' .tinted').forEach((p: any) => p.setAttribute('fill', '#' + parts[1]));
    } else if (cat === 'haircolors') {
      avatarStateRef.current.hairColor = val;
      const parts = val.split('_');
      const hs = avatarStateRef.current.hairstyle;
      el.querySelectorAll('#hair_front .h_' + hs + ' .tinted').forEach((p: any) => p.setAttribute('fill', '#' + parts[0]));
      el.querySelectorAll('#hair_back .h_' + hs + ' .tinted').forEach((p: any) => p.setAttribute('fill', '#' + parts[1]));
      el.querySelectorAll('#facialhair g .tinted').forEach((p: any) => p.setAttribute('fill', '#' + parts[2]));
    } else if (cat === 'facialhairs') {
      el.querySelectorAll('#facialhair g').forEach((g: any) => (g.style.display = 'none'));
      const target = el.querySelector('#facialhair #f_' + val) as HTMLElement;
      if (target) target.style.display = '';
    } else if (cat === 'clothes') {
      el.querySelectorAll('#clothes g').forEach((g: any) => (g.style.display = 'none'));
      const target = el.querySelector('#clothes #c_' + val) as HTMLElement;
      if (target) target.style.display = '';
      el.querySelectorAll('#clothes g .tinted').forEach((p: any) => p.setAttribute('fill', '#' + avatarStateRef.current.fabricColor));
    } else if (cat === 'fabriccolors') {
      avatarStateRef.current.fabricColor = val;
      el.querySelectorAll('#clothes g .tinted').forEach((p: any) => p.setAttribute('fill', '#' + val));
    } else if (cat === 'backgroundcolors') {
      const bg = el.querySelector('#background');
      if (bg) bg.setAttribute('fill', '#' + val);
    } else if (cat === 'glasses') {
      el.querySelectorAll('#glasses g').forEach((g: any) => (g.style.display = 'none'));
      const target = el.querySelector('#glasses #g_' + val) as HTMLElement;
      if (target) target.style.display = '';
    } else if (cat === 'glassopacity') {
      const op = parseInt(val) / 100;
      avatarStateRef.current.glassOpacity = op;
      el.querySelectorAll('.glass').forEach((p: any) => p.setAttribute('fill-opacity', `${op}`));
    } else if (cat === 'tattoos') {
      el.querySelectorAll('#tattoos g').forEach((g: any) => (g.style.display = 'none'));
      const target = el.querySelector('#tattoos #t_' + val) as HTMLElement;
      if (target) target.style.display = '';
    } else if (cat === 'accesories') {
      el.querySelectorAll('#accesories g').forEach((g: any) => (g.style.display = 'none'));
      const target = el.querySelector('#accesories #a_' + val) as HTMLElement;
      if (target) target.style.display = '';
    }

    saveAvatar();
  };

  const getOptionsForCategory = (): CategoryOption[] => {
    switch (activeCategory) {
      case 'skins':
        return SKINS.map(s => ({ id: s, label: `#${s}`, color: `#${s}` }));
      case 'eyes':
        return EYES.map((e, idx) => ({ id: e, label: e, spriteIndex: idx }));
      case 'eyebrows':
        return EYEBROWS.map((e, idx) => ({ id: e, label: e, spriteIndex: idx }));
      case 'mouths':
        return MOUTHS.map((m, idx) => ({ id: m, label: m, spriteIndex: idx }));
      case 'hairstyles':
        return HAIRSTYLES.map((h, idx) => ({ id: h, label: h, spriteIndex: idx }));
      case 'haircolors':
        return HAIRCOLORS.map(c => ({ id: c, label: c.split('_')[0], color: `#${c.split('_')[0]}` }));
      case 'facialhairs':
        return FACIALHAIRS.map((f, idx) => ({ id: f, label: f, spriteIndex: idx }));
      case 'clothes':
        return CLOTHES.map((c, idx) => ({ id: c, label: c, spriteIndex: idx }));
      case 'fabriccolors':
        return FABRICCOLORS.map(f => ({ id: f, label: `#${f}`, color: `#${f}` }));
      case 'backgroundcolors':
        return BACKGROUNDCOLORS.map(b => ({ id: b, label: `#${b}`, color: `#${b}` }));
      case 'glasses':
        return GLASSES.map((g, idx) => ({ id: g, label: g, spriteIndex: idx }));
      case 'glassopacity':
        return GLASSOPACITIES.map(o => ({ id: o, label: `${o}%` }));
      case 'tattoos':
        return TATTOOS.map((t, idx) => ({ id: t, label: t, spriteIndex: idx }));
      case 'accesories':
        return ACCESORIES.map((a, idx) => ({ id: a, label: a, spriteIndex: idx }));
      default:
        return [];
    }
  };

  return (
    <div className="min-h-screen bg-white text-slate-900 flex flex-col font-['Nunito',sans-serif] select-none">
      {/* Top Navigation */}
      <header className="h-[52px] w-full max-w-lg mx-auto flex items-center justify-between px-4 border-b border-slate-100 z-50 bg-white">
        <Link
          href="/home"
          className="w-9 h-9 rounded-full flex items-center justify-center text-slate-500 hover:bg-slate-100 transition active:scale-95"
          aria-label="Back"
        >
          <i className="fa-solid fa-chevron-left text-sm"></i>
        </Link>
        <h1 className="font-extrabold text-base text-slate-800 tracking-tight">Avatar Maker</h1>
        <button
          onClick={handleDone}
          className="px-4 py-1.5 rounded-full bg-[#c9020f] hover:bg-[#96010a] text-white font-black text-xs transition active:scale-95 shadow-sm cursor-pointer"
        >
          DONE
        </button>
      </header>

      {/* Main Avatar Creation Area */}
      <main className="flex-1 w-full max-w-lg mx-auto flex flex-col">
        {/* Live Avatar Preview Stage */}
        <div className="w-full flex flex-col items-center justify-center py-4 px-4 bg-slate-50 border-b border-slate-100 relative">
          <div
            id="created"
            ref={createdRef}
            className="w-[300px] h-[300px] max-w-[calc(100vw-32px)] max-h-[calc(100vw-32px)] relative bg-white rounded-2xl shadow-md overflow-hidden flex-shrink-0"
          >
            {/* SVGs rendered synchronously by avatar-engine */}
          </div>

          {/* Quick Randomizer button */}
          <div className="mt-3 flex items-center gap-2">
            <button
              onClick={applyRandom}
              className="inline-flex items-center gap-2 px-4 py-2 bg-white hover:border-[#c9020f] hover:text-[#c9020f] border border-slate-200 rounded-full text-xs font-black text-slate-700 shadow-sm transition active:scale-95 cursor-pointer"
            >
              <i className="fa-solid fa-dice text-[#c9020f] text-sm"></i>
              <span>Randomize Avatar</span>
            </button>
          </div>
        </div>

        {/* Categories Selector Horizontal Bar */}
        <div className="w-full flex items-center overflow-x-auto gap-2 px-4 py-3 bg-white border-b border-slate-100 no-scrollbar">
          {CATEGORIES.map(cat => {
            const isActive = cat.id === activeCategory;
            return (
              <button
                key={cat.id}
                onClick={() => setActiveCategory(cat.id)}
                className={`flex-shrink-0 px-3.5 py-1.5 rounded-full text-xs font-black transition active:scale-95 cursor-pointer ${
                  isActive
                    ? 'bg-[#c9020f] text-white shadow-sm'
                    : 'bg-white border border-slate-200 text-slate-600 hover:border-[#c9020f] hover:text-[#c9020f]'
                }`}
              >
                {cat.label}
              </button>
            );
          })}
        </div>

        {/* Options Items Selector */}
        <div className="p-4 flex-1">
          <div className="text-xs font-black uppercase tracking-wider text-[#c9020f] mb-3">
            Select {CATEGORIES.find(c => c.id === activeCategory)?.label}
          </div>

          <div className="flex flex-wrap gap-2.5 max-h-[300px] overflow-y-auto no-scrollbar pb-12">
            {getOptionsForCategory().map(opt => {
              const isColor = !!opt.color;
              const hasSprite = opt.spriteIndex !== undefined && SPRITE_ROW_OFFSETS[activeCategory] !== undefined;

              if (hasSprite) {
                const posX = opt.spriteIndex! * -53;
                const posY = SPRITE_ROW_OFFSETS[activeCategory];
                return (
                  <button
                    key={opt.id}
                    onClick={() => selectOption(activeCategory, opt.id)}
                    style={{
                      backgroundImage: `url(${SPRITE_URL})`,
                      backgroundPosition: `${posX}px ${posY}px`,
                      backgroundColor: '#ffdbb4',
                    }}
                    className="w-[53px] h-[53px] rounded-xl border-2 border-slate-200 hover:border-[#c9020f] hover:-translate-y-0.5 hover:shadow-md transition active:scale-95 bg-no-repeat flex-shrink-0 cursor-pointer"
                    title={opt.label}
                    aria-label={opt.label}
                  />
                );
              }

              return (
                <button
                  key={opt.id}
                  onClick={() => selectOption(activeCategory, opt.id)}
                  style={isColor ? { backgroundColor: opt.color } : undefined}
                  className={`rounded-xl text-xs font-bold border transition transform active:scale-95 flex items-center justify-center flex-shrink-0 cursor-pointer ${
                    isColor
                      ? 'w-[53px] h-[53px] border-slate-300 shadow-sm hover:scale-105 hover:border-[#c9020f]'
                      : 'px-3.5 py-2.5 bg-slate-50 hover:bg-[#fef2f2] hover:border-[#c9020f] hover:text-[#c9020f] border-slate-200 text-slate-700 min-w-[54px]'
                  }`}
                  title={opt.label}
                >
                  {!isColor && opt.label}
                </button>
              );
            })}
          </div>
        </div>
      </main>
    </div>
  );
}
