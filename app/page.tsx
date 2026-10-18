'use client';

import React, { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';

interface CardData {
  name: string;
  img: string;
}

const CARDS_DATA: CardData[] = [
  { name: 'QUEEN', img: '/images/queen.png' },
  { name: 'KING', img: '/images/king.png' },
  { name: 'ROOK', img: '/images/rook.png' },
];

export default function CurvedCarouselPage() {
  const [activeIndex, setActiveIndex] = useState(1);
  const containerRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);

  // References for smooth animation physics loop
  const stateRef = useRef({
    activeIndex: 1,
    currentX: 0,
    targetX: 0,
    velocity: 0,
    isDragging: false,
    startX: 0,
    dragStartX: 0,
    lastDragX: 0,
    lastDragTime: 0,
    dragVelocity: 0,
    hasDraggedFar: false,
    cardWidth: 300,
    cardHeight: 480,
    cardSpacing: 330,
    radius: 360,
    curvature: 0.62,
    isDesktop: false,
  });

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const ch = params.get('accept_challenge');
      if (ch) {
        window.location.href = `/home?accept_challenge=${encodeURIComponent(ch)}`;
        return;
      }
    }

    const s = stateRef.current;

    const updateGeometry = () => {
      const isDesktop = window.innerWidth >= 768;
      s.isDesktop = isDesktop;
      s.cardWidth = isDesktop ? 370 : 300;
      s.cardHeight = isDesktop ? 550 : 480;
      s.cardSpacing = isDesktop ? 430 : 330;
      s.radius = isDesktop ? 1100 : 360;
      s.curvature = isDesktop ? 0.35 : 0.62;

      s.targetX = -s.activeIndex * s.cardSpacing;
      s.currentX = s.targetX;
    };

    updateGeometry();
    window.addEventListener('resize', updateGeometry);

    const snapToIndex = (idx: number) => {
      const clamped = Math.max(0, Math.min(CARDS_DATA.length - 1, idx));
      s.activeIndex = clamped;
      s.targetX = -clamped * s.cardSpacing;
      setActiveIndex(clamped);
    };

    const onPointerDown = (e: MouseEvent | TouchEvent) => {
      // Ignore if clicking bottom navigation buttons
      if ((e.target as HTMLElement)?.closest('.bottom-bar-nav')) return;

      s.isDragging = true;
      s.hasDraggedFar = false;
      const clientX = 'clientX' in e ? e.clientX : e.touches[0].clientX;
      s.startX = clientX;
      s.dragStartX = s.currentX;
      s.lastDragX = clientX;
      s.lastDragTime = performance.now();
      s.dragVelocity = 0;
    };

    const onPointerMove = (e: MouseEvent | TouchEvent) => {
      if (!s.isDragging) return;
      const clientX = 'clientX' in e ? e.clientX : (e.touches ? e.touches[0].clientX : 0);
      const delta = clientX - s.startX;
      if (Math.abs(delta) > 5) s.hasDraggedFar = true;

      s.currentX = s.dragStartX + delta;
      s.targetX = s.currentX;

      const now = performance.now();
      const dt = now - s.lastDragTime;
      if (dt > 8) {
        s.dragVelocity = (clientX - s.lastDragX) / dt;
        s.lastDragX = clientX;
        s.lastDragTime = now;
      }
    };

    const onPointerUp = () => {
      if (!s.isDragging) return;
      s.isDragging = false;

      let target = s.activeIndex;
      if (Math.abs(s.dragVelocity) > 0.35 || Math.abs(s.currentX - s.dragStartX) > s.cardSpacing * 0.2) {
        if (s.dragVelocity < -0.25 || (s.currentX - s.dragStartX) < -s.cardSpacing * 0.2) {
          target = s.activeIndex + 1;
        } else if (s.dragVelocity > 0.25 || (s.currentX - s.dragStartX) > s.cardSpacing * 0.2) {
          target = s.activeIndex - 1;
        }
      } else {
        target = Math.round(-s.currentX / s.cardSpacing);
      }

      snapToIndex(target);
    };

    const container = containerRef.current;
    if (container) {
      container.addEventListener('mousedown', onPointerDown);
      window.addEventListener('mousemove', onPointerMove);
      window.addEventListener('mouseup', onPointerUp);

      container.addEventListener('touchstart', onPointerDown, { passive: true });
      window.addEventListener('touchmove', onPointerMove, { passive: true });
      window.addEventListener('touchend', onPointerUp, { passive: true });
    }

    let animationFrameId: number;

    const render = () => {
      if (!s.isDragging) {
        const k = 0.16;
        const d = 0.76;
        const force = (s.targetX - s.currentX) * k;
        s.velocity = (s.velocity + force) * d;
        s.currentX += s.velocity;
      }

      const stage = stageRef.current;
      if (stage) {
        const cardElements = stage.querySelectorAll<HTMLElement>('.carousel-card');
        cardElements.forEach((card, i) => {
          const basePos = i * s.cardSpacing;
          const dx = s.currentX + basePos;
          const theta = dx / s.radius;

          const transformX = s.radius * Math.sin(theta);
          const transformY = (1 - Math.cos(theta)) * s.radius * s.curvature;
          const rotateZ = (theta * 180 / Math.PI) * (s.isDesktop ? 0.72 : 0.88);
          const rotateY = (-theta * 180 / Math.PI) * (s.isDesktop ? 0.2 : 0.32);

          const distance = Math.abs(dx);
          const maxVisible = s.isDesktop ? s.cardSpacing * 2.8 : s.cardSpacing * 1.8;
          let opacity = 1;
          if (distance > maxVisible) {
            opacity = Math.max(0, 1 - (distance - maxVisible) / (s.cardSpacing * 0.8));
          }

          const scale = 1 - Math.min(distance / (s.cardSpacing * 2.2), 1) * 0.08;
          const zIndex = Math.round(100 - distance * 0.1);

          card.style.transform = `translate3d(${transformX}px, ${transformY}px, 0px) rotateZ(${rotateZ}deg) rotateY(${rotateY}deg) scale(${scale})`;
          card.style.opacity = `${opacity}`;
          card.style.zIndex = `${zIndex}`;
          card.style.width = `${s.cardWidth}px`;
          card.style.height = `${s.cardHeight}px`;
          card.style.marginLeft = `${-s.cardWidth / 2}px`;
          card.style.marginTop = `${-s.cardHeight / 2}px`;
        });
      }

      animationFrameId = requestAnimationFrame(render);
    };

    animationFrameId = requestAnimationFrame(render);

    return () => {
      window.removeEventListener('resize', updateGeometry);
      if (container) {
        container.removeEventListener('mousedown', onPointerDown);
        container.removeEventListener('touchstart', onPointerDown);
      }
      window.removeEventListener('mousemove', onPointerMove);
      window.removeEventListener('mouseup', onPointerUp);
      window.removeEventListener('touchmove', onPointerMove);
      window.removeEventListener('touchend', onPointerUp);
      cancelAnimationFrame(animationFrameId);
    };
  }, []);

  const handleCardClick = (idx: number) => {
    if (!stateRef.current.hasDraggedFar) {
      stateRef.current.activeIndex = idx;
      stateRef.current.targetX = -idx * stateRef.current.cardSpacing;
      setActiveIndex(idx);
    }
  };

  return (
    <div
      ref={containerRef}
      className="fixed inset-0 w-full h-full overflow-hidden bg-white text-slate-900 cursor-grab active:cursor-grabbing select-none touch-none"
    >
      {/* Curved Stage */}
      <div
        ref={stageRef}
        className="relative w-full h-full flex items-center justify-center pointer-events-none -translate-y-[8vh]"
      >
        {CARDS_DATA.map((item, i) => {
          const isActive = i === activeIndex;
          const isLeft = i < activeIndex;
          const isRight = i > activeIndex;

          let cardClasses = 'absolute top-1/2 left-1/2 rounded-[14px] flex items-center justify-center p-0 pointer-events-auto cursor-pointer will-change-transform overflow-hidden transition-colors duration-300 origin-[50%_90%] carousel-card ';

          if (isActive) {
            cardClasses += 'bg-[#c9020f] border-transparent shadow-none';
          } else if (isLeft) {
            cardClasses += 'bg-transparent border-t-transparent border-l-transparent border-b-[3.5px] border-r-[3.5px] border-[#c9020f] rounded-br-[14px]';
          } else if (isRight) {
            cardClasses += 'bg-transparent border-t-transparent border-r-transparent border-b-[3.5px] border-l-[3.5px] border-[#c9020f] rounded-bl-[14px]';
          }

          return (
            <div
              key={item.name}
              onClick={() => handleCardClick(i)}
              className={cardClasses}
            >
              <div className="relative w-full h-full flex items-center justify-center overflow-hidden">
                {/* Big piece title at top of active card in black */}
                <div
                  className={`absolute top-[10%] left-1/2 -translate-x-1/2 text-black font-black uppercase tracking-tighter z-10 pointer-events-none whitespace-nowrap transition-opacity duration-300 text-[clamp(2.8rem,13vw,5.5rem)] ${
                    isActive ? 'opacity-100' : 'opacity-0'
                  }`}
                >
                  {item.name}
                </div>

                {/* Oversized Chess Piece Graphic */}
                <Image
                  src={item.img}
                  alt={item.name}
                  width={600}
                  height={600}
                  priority
                  className={`relative z-20 w-[175%] h-[175%] max-w-none max-h-none object-contain pointer-events-none transition-all duration-300 ${
                    isActive ? 'invert scale-105' : ''
                  }`}
                />
              </div>
            </div>
          );
        })}
      </div>

      {/* Bottom Bar: X icon left, Pill button right linking to /home */}
      <div className="fixed bottom-0 left-0 right-0 flex items-center justify-between p-6 md:p-8 z-50 pointer-events-auto bottom-bar-nav">
        {/* X (Twitter) */}
        <a
          href="https://x.com"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center justify-center w-11 h-11 text-slate-800 hover:opacity-70 transition active:scale-95"
          aria-label="X (Twitter)"
        >
          <svg viewBox="0 0 24 24" className="w-[22px] h-[22px] fill-current">
            <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
          </svg>
        </a>

        {/* Pill button linking to /home */}
        <Link
          href="/home"
          className="inline-flex items-center gap-2.5 px-6 py-3 rounded-full border-2 border-[#c9020f] bg-white text-[#c9020f] font-bold text-sm tracking-tight transition duration-200 shadow-[0_2px_8px_rgba(201,2,15,0.1)] hover:bg-[#c9020f] hover:text-white hover:-translate-y-0.5 hover:shadow-[0_4px_14px_rgba(201,2,15,0.3)] active:scale-95 group"
        >
          <span>Chess Dungeon</span>
          <svg viewBox="0 0 20 20" className="w-4 h-4 fill-current transition-transform duration-200 group-hover:translate-x-1">
            <path fillRule="evenodd" d="M10.293 3.293a1 1 0 011.414 0l6 6a1 1 0 010 1.414l-6 6a1 1 0 01-1.414-1.414L14.586 11H3a1 1 0 110-2h11.586l-4.293-4.293a1 1 0 010-1.414z" clipRule="evenodd" />
          </svg>
        </Link>
      </div>
    </div>
  );
}
