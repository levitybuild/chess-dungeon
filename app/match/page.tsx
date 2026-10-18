'use client';

import React, { useEffect, useRef, useState, useCallback } from 'react';
import Link from 'next/link';
import { renderBotAvatar, renderPlayerAvatar } from '../../lib/avatar-engine';
import { getChessClient } from '../../lib/chess-dungeon-client';
import { playKillerMoveSound } from '../../lib/chess-audio';

type PieceType = 'P' | 'R' | 'N' | 'B' | 'Q' | 'K';
type PieceColor = 'w' | 'b';

interface Piece {
  type: PieceType;
  color: PieceColor;
  hasMoved: boolean;
}

interface Move {
  r: number;
  c: number;
  isCastle?: 'kingside' | 'queenside';
  isCapture?: boolean;
}

interface MoveHistoryState {
  board: (Piece | null)[][];
  currentTurn: PieceColor;
  lastMove: { fromR: number; fromC: number; toR: number; toC: number } | null;
  playerTime: number;
  botTime: number;
}

const PIECE_IMAGES: Record<PieceType, string> = {
  P: '/images/pawn.png',
  R: '/images/rook.png',
  N: '/images/knight.png',
  B: '/images/bishop.png',
  Q: '/images/queen.png',
  K: '/images/king.png',
};

const createStartingBoard = (): (Piece | null)[][] => {
  const backRank: PieceType[] = ['R', 'N', 'B', 'Q', 'K', 'B', 'N', 'R'];
  const newBoard: (Piece | null)[][] = Array(8).fill(null).map(() => Array(8).fill(null));

  for (let c = 0; c < 8; c++) {
    newBoard[0][c] = { type: backRank[c], color: 'b', hasMoved: false };
    newBoard[1][c] = { type: 'P', color: 'b', hasMoved: false };
    newBoard[6][c] = { type: 'P', color: 'w', hasMoved: false };
    newBoard[7][c] = { type: backRank[c], color: 'w', hasMoved: false };
  }
  return newBoard;
};

export default function MatchPage() {
  const [board, setBoard] = useState<(Piece | null)[][]>(createStartingBoard);
  const [currentTurn, setCurrentTurn] = useState<PieceColor>('w');
  const [selectedSquare, setSelectedSquare] = useState<{ r: number; c: number } | null>(null);
  const [legalMoves, setLegalMoves] = useState<Move[]>([]);
  const [lastMove, setLastMove] = useState<{ fromR: number; fromC: number; toR: number; toC: number } | null>(null);
  const [playerTime, setPlayerTime] = useState(300);
  const [botTime, setBotTime] = useState(300);
  const [bannerText, setBannerText] = useState('Your turn (White)');
  const [showBanner, setShowBanner] = useState(true);
  const [isGameOver, setIsGameOver] = useState(false);

  // Overlay state
  const [showOverlay, setShowOverlay] = useState(false);
  const [slamSubjectText, setSlamSubjectText] = useState('You');
  const [slamVerbText, setSlamVerbText] = useState('Win');
  const [subjectSlammed, setSubjectSlammed] = useState(false);
  const [verbSlammed, setVerbSlammed] = useState(false);
  const [chipsPopped, setChipsPopped] = useState(false);
  const [awardedChipsText, setAwardedChipsText] = useState('+2 chips');
  const [showRematchBtn, setShowRematchBtn] = useState(false);

  const moveHistoryRef = useRef<MoveHistoryState[]>([]);
  const boardRef = useRef<(Piece | null)[][]>(board);
  const isGameOverRef = useRef(isGameOver);

  useEffect(() => {
    boardRef.current = board;
  }, [board]);

  useEffect(() => {
    isGameOverRef.current = isGameOver;
  }, [isGameOver]);

  const makeMoveRef = useRef<((fromR: number, fromC: number, toR: number, toC: number, isCastle?: 'kingside' | 'queenside') => void) | null>(null);

  const botContainerRef = useRef<HTMLDivElement>(null);
  const playerContainerRef = useRef<HTMLDivElement>(null);
  const piercingStageRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const flashRef = useRef<HTMLDivElement>(null);
  const screenRef = useRef<HTMLDivElement>(null);

  // Audio References
  const moveAudioRef = useRef<HTMLAudioElement | null>(null);
  const captureAudioRef = useRef<HTMLAudioElement | null>(null);
  const coreAudioRef = useRef<HTMLAudioElement | null>(null);
  const checkmateAudioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    moveAudioRef.current = new Audio('/sounds/move.mp3');
    captureAudioRef.current = new Audio('/sounds/capture.mp3');
    coreAudioRef.current = new Audio('/sounds/kakegurui.mp3');
    checkmateAudioRef.current = new Audio('/sounds/kakegurui_imasho.mp3');

    const unlock = () => {
      [moveAudioRef, captureAudioRef, coreAudioRef, checkmateAudioRef].forEach(ref => {
        if (ref.current) {
          ref.current.play().then(() => {
            ref.current?.pause();
            ref.current!.currentTime = 0;
          }).catch(() => {});
        }
      });
      window.removeEventListener('pointerdown', unlock);
      window.removeEventListener('keydown', unlock);
    };

    window.addEventListener('pointerdown', unlock);
    window.addEventListener('keydown', unlock);

    return () => {
      window.removeEventListener('pointerdown', unlock);
      window.removeEventListener('keydown', unlock);
    };
  }, []);

  const playSound = (audio: HTMLAudioElement | null, volume = 0.85) => {
    if (!audio) return;
    try {
      const s = audio.cloneNode() as HTMLAudioElement;
      s.volume = volume;
      s.play().catch(() => {});
    } catch (e) {}
  };

  const playChipClackSound = () => {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      if (ctx.state === 'suspended') ctx.resume();

      [0, 0.038].forEach((delay, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        const filter = ctx.createBiquadFilter();

        osc.type = 'triangle';
        const baseFreq = idx === 0 ? 3200 : 2650;
        osc.frequency.setValueAtTime(baseFreq, ctx.currentTime + delay);
        osc.frequency.exponentialRampToValueAtTime(750, ctx.currentTime + delay + 0.045);

        filter.type = 'bandpass';
        filter.frequency.setValueAtTime(2800, ctx.currentTime + delay);
        filter.Q.value = 5.0;

        gain.gain.setValueAtTime(0.65, ctx.currentTime + delay);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + delay + 0.05);

        osc.connect(filter);
        filter.connect(gain);
        gain.connect(ctx.destination);

        osc.start(ctx.currentTime + delay);
        osc.stop(ctx.currentTime + delay + 0.06);
      });
    } catch (e) {}
  };

  // Procedural Lightning Strike
  const triggerRedLightning = useCallback((impactX?: number, impactY?: number) => {
    const canvas = canvasRef.current;
    const flash = flashRef.current;
    const screen = screenRef.current;
    if (!canvas || !flash) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    // Viewport camera shake
    if (screen) {
      screen.classList.remove('lightning-shaking');
      void screen.offsetWidth;
      screen.classList.add('lightning-shaking');
      setTimeout(() => screen?.classList.remove('lightning-shaking'), 680);
    }

    // Flash
    flash.style.opacity = '0.9';
    setTimeout(() => { flash.style.opacity = '0.4'; }, 50);
    setTimeout(() => { flash.style.opacity = '0.85'; }, 100);
    setTimeout(() => { flash.style.opacity = '0'; }, 320);

    const w = canvas.width;
    const h = canvas.height;
    const targetX = impactX ?? w * 0.5;

    // Generate zigzag path
    const createZigzag = (start: { x: number; y: number }, end: { x: number; y: number }, maxDisp: number) => {
      let pts = [start, end];
      let disp = maxDisp;
      for (let iter = 0; iter < 4; iter++) {
        const next = [pts[0]];
        for (let i = 0; i < pts.length - 1; i++) {
          const p1 = pts[i];
          const p2 = pts[i + 1];
          const midX = (p1.x + p2.x) / 2 + (Math.random() - 0.5) * disp;
          const midY = (p1.y + p2.y) / 2;
          next.push({ x: midX, y: midY }, p2);
        }
        pts = next;
        disp *= 0.55;
      }
      return pts;
    };

    const mainTrunk = createZigzag({ x: targetX + (Math.random() - 0.5) * 60, y: 0 }, { x: targetX, y: h }, 90);
    const branches: { x: number; y: number }[][] = [];
    for (let b = 0; b < 4; b++) {
      const idx = Math.floor(mainTrunk.length * (0.2 + Math.random() * 0.6));
      const fork = mainTrunk[idx];
      if (fork) {
        const side = b % 2 === 0 ? 1 : -1;
        const bEnd = { x: Math.max(20, Math.min(w - 20, fork.x + side * (100 + Math.random() * 150))), y: Math.min(h, fork.y + 120 + Math.random() * 150) };
        branches.push(createZigzag(fork, bEnd, 40));
      }
    }

    let startT = performance.now();
    const duration = 520;

    const drawBolt = (pts: { x: number; y: number }[], alpha: number, isMain: boolean) => {
      if (pts.length < 2) return;
      ctx.save();
      ctx.beginPath();
      ctx.moveTo(pts[0].x, pts[0].y);
      for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);

      // Crimson outer glow
      ctx.strokeStyle = `rgba(201, 2, 15, ${0.9 * alpha})`;
      ctx.lineWidth = isMain ? 12 : 6;
      ctx.shadowColor = '#ff0022';
      ctx.shadowBlur = 24;
      ctx.stroke();

      // Bright inner core
      ctx.beginPath();
      ctx.moveTo(pts[0].x, pts[0].y);
      for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
      ctx.strokeStyle = `rgba(255, 255, 255, ${0.95 * alpha})`;
      ctx.lineWidth = isMain ? 3 : 1.5;
      ctx.stroke();
      ctx.restore();
    };

    const animate = (now: number) => {
      const elapsed = now - startT;
      const progress = elapsed / duration;
      if (progress >= 1) {
        ctx.clearRect(0, 0, w, h);
        return;
      }
      const alpha = Math.max(0, 1 - Math.pow(progress, 1.2));
      ctx.clearRect(0, 0, w, h);
      drawBolt(mainTrunk, alpha, true);
      branches.forEach(br => drawBolt(br, alpha * 0.8, false));
      requestAnimationFrame(animate);
    };

    requestAnimationFrame(animate);
  }, []);

  // Check if coordinates inside 8x8
  const inBounds = (r: number, c: number) => r >= 0 && r < 8 && c >= 0 && c < 8;

  // Compute piece legal moves
  const getPieceMoves = useCallback((r: number, c: number, currentBoard: (Piece | null)[][]): Move[] => {
    const piece = currentBoard[r][c];
    if (!piece) return [];
    const moves: Move[] = [];
    const color = piece.color;
    const oppColor = color === 'w' ? 'b' : 'w';

    if (piece.type === 'P') {
      const dir = color === 'w' ? -1 : 1;
      const startRow = color === 'w' ? 6 : 1;
      if (inBounds(r + dir, c) && !currentBoard[r + dir][c]) {
        moves.push({ r: r + dir, c: c });
        if (r === startRow && !currentBoard[r + 2 * dir][c]) {
          moves.push({ r: r + 2 * dir, c: c });
        }
      }
      [-1, 1].forEach(dc => {
        const tr = r + dir;
        const tc = c + dc;
        if (inBounds(tr, tc) && currentBoard[tr][tc] && currentBoard[tr][tc]?.color === oppColor) {
          moves.push({ r: tr, c: tc, isCapture: true });
        }
      });
    }

    if (piece.type === 'R' || piece.type === 'Q') {
      const dirs = [[0, 1], [0, -1], [1, 0], [-1, 0]];
      dirs.forEach(([dr, dc]) => {
        let tr = r + dr;
        let tc = c + dc;
        while (inBounds(tr, tc)) {
          if (!currentBoard[tr][tc]) {
            moves.push({ r: tr, c: tc });
          } else {
            if (currentBoard[tr][tc]?.color === oppColor) {
              moves.push({ r: tr, c: tc, isCapture: true });
            }
            break;
          }
          tr += dr;
          tc += dc;
        }
      });
    }

    if (piece.type === 'B' || piece.type === 'Q') {
      const dirs = [[1, 1], [1, -1], [-1, 1], [-1, -1]];
      dirs.forEach(([dr, dc]) => {
        let tr = r + dr;
        let tc = c + dc;
        while (inBounds(tr, tc)) {
          if (!currentBoard[tr][tc]) {
            moves.push({ r: tr, c: tc });
          } else {
            if (currentBoard[tr][tc]?.color === oppColor) {
              moves.push({ r: tr, c: tc, isCapture: true });
            }
            break;
          }
          tr += dr;
          tc += dc;
        }
      });
    }

    if (piece.type === 'N') {
      const jumps = [
        [2, 1], [2, -1], [-2, 1], [-2, -1],
        [1, 2], [1, -2], [-1, 2], [-1, -2]
      ];
      jumps.forEach(([dr, dc]) => {
        const tr = r + dr;
        const tc = c + dc;
        if (inBounds(tr, tc)) {
          if (!currentBoard[tr][tc]) {
            moves.push({ r: tr, c: tc });
          } else if (currentBoard[tr][tc]?.color === oppColor) {
            moves.push({ r: tr, c: tc, isCapture: true });
          }
        }
      });
    }

    if (piece.type === 'K') {
      for (let dr = -1; dr <= 1; dr++) {
        for (let dc = -1; dc <= 1; dc++) {
          if (dr === 0 && dc === 0) continue;
          const tr = r + dr;
          const tc = c + dc;
          if (inBounds(tr, tc)) {
            if (!currentBoard[tr][tc]) {
              moves.push({ r: tr, c: tc });
            } else if (currentBoard[tr][tc]?.color === oppColor) {
              moves.push({ r: tr, c: tc, isCapture: true });
            }
          }
        }
      }

      if (!piece.hasMoved) {
        if (currentBoard[r][7] && currentBoard[r][7]?.type === 'R' && !currentBoard[r][7]?.hasMoved) {
          if (!currentBoard[r][5] && !currentBoard[r][6]) {
            moves.push({ r, c: 6, isCastle: 'kingside' });
          }
        }
        if (currentBoard[r][0] && currentBoard[r][0]?.type === 'R' && !currentBoard[r][0]?.hasMoved) {
          if (!currentBoard[r][1] && !currentBoard[r][2] && !currentBoard[r][3]) {
            moves.push({ r, c: 2, isCastle: 'queenside' });
          }
        }
      }
    }

    return moves;
  }, []);

  const isCheck = useCallback((color: PieceColor, b: (Piece | null)[][] = boardRef.current) => {
    let kingR = -1;
    let kingC = -1;
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        if (b[r][c]?.type === 'K' && b[r][c]?.color === color) {
          kingR = r;
          kingC = c;
          break;
        }
      }
      if (kingR !== -1) break;
    }
    if (kingR === -1) return false;

    const oppColor = color === 'w' ? 'b' : 'w';
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        if (b[r][c]?.color === oppColor) {
          const moves = getPieceMoves(r, c, b);
          if (moves.some(m => m.r === kingR && m.c === kingC)) {
            return true;
          }
        }
      }
    }
    return false;
  }, [getPieceMoves]);

  const updateAvatarsMood = useCallback(() => {
    const botContainer = botContainerRef.current;
    const playerContainer = playerContainerRef.current;
    if (!botContainer || !playerContainer) return;

    const values: Record<PieceType, number> = { P: 1, N: 3, B: 3, R: 5, Q: 9, K: 0 };
    let whiteScore = 0;
    let blackScore = 0;
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        const p = boardRef.current[r][c];
        if (p) {
          if (p.color === 'w') whiteScore += values[p.type];
          else blackScore += values[p.type];
        }
      }
    }

    const diff = whiteScore - blackScore;
    const playerInCheck = isCheck('w');
    const botInCheck = isCheck('b');

    let playerMood = 'neutral';
    if (playerInCheck) playerMood = 'pickle';
    else if (diff >= 3 || botInCheck) playerMood = 'thriving';
    else if (diff <= -3) playerMood = 'pickle';

    let botMood = 'neutral';
    if (botInCheck) botMood = 'pickle';
    else if (diff <= -3 || playerInCheck) botMood = 'thriving';
    else if (diff >= 3) botMood = 'pickle';

    const applyMood = (container: HTMLElement, mood: string) => {
      const eyesSvg = container.querySelector('#eyes');
      const mouthSvg = container.querySelector('#mouths');
      const eyebrowsSvg = container.querySelector('#eyebrows');
      if (!eyesSvg || !mouthSvg) return;

      let targetEye = 'e_default';
      let targetMouth = 'm_default';
      let targetEyebrow = 'eb_default';

      if (mood === 'thriving') {
        targetEye = 'e_happy';
        targetMouth = 'm_smile';
        targetEyebrow = 'eb_raised';
      } else if (mood === 'pickle') {
        targetEye = 'e_surprised';
        targetMouth = 'm_grimace';
        targetEyebrow = 'eb_sad';
      }

      eyesSvg.querySelectorAll('g').forEach((g: any) => { g.style.display = g.id === targetEye ? '' : 'none'; });
      mouthSvg.querySelectorAll('g').forEach((g: any) => { g.style.display = g.id === targetMouth ? '' : 'none'; });
      if (eyebrowsSvg) {
        eyebrowsSvg.querySelectorAll('g').forEach((g: any) => { g.style.display = g.id === targetEyebrow ? '' : 'none'; });
      }
    };

    applyMood(playerContainer, playerMood);
    applyMood(botContainer, botMood);

    // Straight path to win soft crimson eye glow
    if (!isGameOverRef.current) {
      if (diff >= 4 || (diff >= 2 && botInCheck)) {
        playerContainer.classList.add('straight-path-glow');
      } else {
        playerContainer.classList.remove('straight-path-glow');
      }
    }
  }, [isCheck]);

  const attachHorizontalEyeFlares = (container: HTMLElement) => {
    container.querySelectorAll('.horizontal-eye-flare').forEach(el => el.remove());
    const leftFlare = document.createElement('div');
    leftFlare.className = 'horizontal-eye-flare left-flare';
    const rightFlare = document.createElement('div');
    rightFlare.className = 'horizontal-eye-flare right-flare';
    container.appendChild(leftFlare);
    container.appendChild(rightFlare);
  };

  const endGame = useCallback((winner: PieceColor, msg?: string) => {
    if (isGameOverRef.current) return;
    setIsGameOver(true);
    isGameOverRef.current = true;

    const userWon = winner === 'w';
    const client = getChessClient();
    const isAnon = client.isAnonymous();

    if (isAnon) {
      setAwardedChipsText(userWon ? '+2 chips (Fun)' : '0 chips (Fun)');
    } else {
      setAwardedChipsText(userWon ? '+2 chips' : '-2 chips');
    }

    try {
      client.recordGameResult(userWon, 2, true, 'Dungeon Bot').catch(() => {});
    } catch (_) {}

    playKillerMoveSound();
    playSound(checkmateAudioRef.current, 0.95);

    if (navigator.vibrate) {
      try { navigator.vibrate([150, 70, 250, 60, 450]); } catch (e) {}
    }

    triggerRedLightning();

    const botContainer = botContainerRef.current;
    const playerContainer = playerContainerRef.current;
    const piercingStage = piercingStageRef.current;

    const winnerContainer = winner === 'w' ? playerContainer : botContainer;
    const loserContainer = winner === 'w' ? botContainer : playerContainer;

    if (loserContainer) {
      loserContainer.classList.add('loser-dimmed');
      loserContainer.classList.remove('winner-piercing', 'piercing-crimson-eyes', 'straight-path-glow');
    }

    if (winnerContainer && piercingStage) {
      const rect = winnerContainer.getBoundingClientRect();
      piercingStage.style.top = rect.top + 'px';
      piercingStage.style.left = rect.left + 'px';
      piercingStage.style.width = rect.width + 'px';
      piercingStage.style.height = rect.height + 'px';
      piercingStage.innerHTML = winnerContainer.innerHTML;
      piercingStage.style.display = 'flex';
      attachHorizontalEyeFlares(piercingStage);
    }

    if (winnerContainer) {
      winnerContainer.classList.add('winner-piercing', 'piercing-crimson-eyes');
      winnerContainer.classList.remove('loser-dimmed', 'straight-path-glow');
      attachHorizontalEyeFlares(winnerContainer);
    }

    // Sequence Overlay & Slam Animations
    setSlamSubjectText(winner === 'w' ? 'You' : 'Bot');
    setSlamVerbText(winner === 'w' ? 'Win' : 'Wins');
    setSubjectSlammed(false);
    setVerbSlammed(false);
    setChipsPopped(false);
    setShowRematchBtn(false);
    setShowOverlay(true);

    setTimeout(() => {
      setSubjectSlammed(true);
      if (navigator.vibrate) try { navigator.vibrate(80); } catch (e) {}
    }, 450);

    setTimeout(() => {
      setVerbSlammed(true);
      if (navigator.vibrate) try { navigator.vibrate(120); } catch (e) {}
    }, 640);

    setTimeout(() => {
      setChipsPopped(true);
      playChipClackSound();
      if (navigator.vibrate) try { navigator.vibrate([60, 40, 90]); } catch (e) {}
      setShowRematchBtn(true);
    }, 950);

    setBannerText(msg || (winner === 'w' ? 'Checkmate! You win!' : 'Checkmate! Bot wins!'));
    setShowBanner(true);
  }, [triggerRedLightning]);

  const initBoard = useCallback(() => {
    const backRank: PieceType[] = ['R', 'N', 'B', 'Q', 'K', 'B', 'N', 'R'];
    const newBoard = Array(8).fill(null).map(() => Array(8).fill(null));

    for (let c = 0; c < 8; c++) {
      newBoard[0][c] = { type: backRank[c], color: 'b', hasMoved: false };
      newBoard[1][c] = { type: 'P', color: 'b', hasMoved: false };
      newBoard[6][c] = { type: 'P', color: 'w', hasMoved: false };
      newBoard[7][c] = { type: backRank[c], color: 'w', hasMoved: false };
    }

    setBoard(newBoard);
    boardRef.current = newBoard;
    setCurrentTurn('w');
    setSelectedSquare(null);
    setLegalMoves([]);
    setLastMove(null);
    setIsGameOver(false);
    isGameOverRef.current = false;
    setPlayerTime(300);
    setBotTime(300);
    setBannerText('Your turn (White)');
    setShowBanner(true);

    // Reset overlay
    setShowOverlay(false);
    setSubjectSlammed(false);
    setVerbSlammed(false);
    setChipsPopped(false);
    setShowRematchBtn(false);

    document.querySelectorAll('.horizontal-eye-flare').forEach(el => el.remove());
    if (piercingStageRef.current) {
      piercingStageRef.current.innerHTML = '';
      piercingStageRef.current.style.display = 'none';
    }

    const botC = botContainerRef.current;
    const playerC = playerContainerRef.current;
    if (botC) botC.classList.remove('winner-piercing', 'piercing-crimson-eyes', 'loser-dimmed', 'capture-crimson-tint');
    if (playerC) playerC.classList.remove('winner-piercing', 'piercing-crimson-eyes', 'loser-dimmed', 'capture-crimson-tint', 'straight-path-glow');

    // Render Avatars
    if (botC) renderBotAvatar(botC, true, { transparentBackground: true });
    if (playerC) renderPlayerAvatar(playerC, true, { transparentBackground: true });
    setTimeout(updateAvatarsMood, 120);
  }, [updateAvatarsMood]);

  // Initial mount - render avatars immediately
  useEffect(() => {
    const botC = botContainerRef.current;
    const playerC = playerContainerRef.current;
    if (botC && !botC.querySelector('svg')) {
      renderBotAvatar(botC, true, { transparentBackground: true });
    }
    if (playerC && !playerC.querySelector('svg')) {
      renderPlayerAvatar(playerC, false, { transparentBackground: true });
    }
    updateAvatarsMood();
  }, [updateAvatarsMood]);

  // Timers
  useEffect(() => {
    if (isGameOver) return;
    const timer = setInterval(() => {
      if (currentTurn === 'w') {
        setPlayerTime(prev => {
          if (prev <= 1) {
            endGame('b', 'Time Out! Bot won.');
            return 0;
          }
          return prev - 1;
        });
      } else {
        setBotTime(prev => {
          if (prev <= 1) {
            endGame('w', 'Time Out! You won.');
            return 0;
          }
          return prev - 1;
        });
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [currentTurn, isGameOver, endGame]);

  // Make move execution
  const makeMove = useCallback((fromR: number, fromC: number, toR: number, toC: number, isCastle?: 'kingside' | 'queenside') => {
    const curBoard = boardRef.current;
    const movingPiece = curBoard[fromR][fromC];
    if (!movingPiece) return;

    moveHistoryRef.current.push({
      board: JSON.parse(JSON.stringify(curBoard)),
      currentTurn,
      lastMove,
      playerTime,
      botTime,
    });

    const targetPiece = curBoard[toR][toC];
    const isCapture = !!targetPiece;
    const nextBoard = curBoard.map(row => [...row]);
    movingPiece.hasMoved = true;

    // Screen coordinates of impact
    let impactX = window.innerWidth / 2;
    let impactY = window.innerHeight / 2;
    const targetSq = document.querySelector(`.square[data-r="${toR}"][data-c="${toC}"]`);
    if (targetSq) {
      const rect = targetSq.getBoundingClientRect();
      impactX = rect.left + rect.width / 2;
      impactY = rect.top + rect.height / 2;
    }

    let isKingKilled = false;

    if (isCapture && targetPiece) {
      const targetType = targetPiece.type;
      if (targetType === 'K') {
        isKingKilled = true;
        triggerRedLightning(impactX, impactY);
      } else if (targetType === 'Q') {
        triggerRedLightning(impactX, impactY);
        playSound(coreAudioRef.current);
        if (navigator.vibrate) try { navigator.vibrate([120, 60, 200]); } catch (e) {}
      } else if (targetType === 'R' || targetType === 'B' || targetType === 'N') {
        playSound(coreAudioRef.current);
      } else {
        playSound(captureAudioRef.current);
      }

      // Slight crimson eye tint
      const capturerC = movingPiece.color === 'w' ? playerContainerRef.current : botContainerRef.current;
      if (capturerC) {
        capturerC.classList.add('capture-crimson-tint');
        setTimeout(() => capturerC?.classList.remove('capture-crimson-tint'), 1800);
      }
    } else {
      playSound(moveAudioRef.current);
    }

    // Castling
    if (isCastle === 'kingside') {
      nextBoard[toR][toC] = movingPiece;
      nextBoard[fromR][fromC] = null;
      const rook = nextBoard[fromR][7]!;
      rook.hasMoved = true;
      nextBoard[fromR][5] = rook;
      nextBoard[fromR][7] = null;
    } else if (isCastle === 'queenside') {
      nextBoard[toR][toC] = movingPiece;
      nextBoard[fromR][fromC] = null;
      const rook = nextBoard[fromR][0]!;
      rook.hasMoved = true;
      nextBoard[fromR][3] = rook;
      nextBoard[fromR][0] = null;
    } else {
      if (movingPiece.type === 'P' && (toR === 0 || toR === 7)) {
        movingPiece.type = 'Q';
      }
      nextBoard[toR][toC] = movingPiece;
      nextBoard[fromR][fromC] = null;
    }

    setBoard(nextBoard);
    boardRef.current = nextBoard;
    setLastMove({ fromR, fromC, toR, toC });
    setSelectedSquare(null);
    setLegalMoves([]);

    if (isKingKilled) {
      endGame(movingPiece.color, movingPiece.color === 'w' ? 'Checkmate! King captured! You win!' : 'Checkmate! King captured! Bot wins!');
      updateAvatarsMood();
      return;
    }

    const nextTurn = currentTurn === 'w' ? 'b' : 'w';
    setCurrentTurn(nextTurn);
    updateAvatarsMood();

    // Trigger Bot if black's turn
    if (nextTurn === 'b' && !isGameOverRef.current) {
      setBannerText("Bot is calculating...");
      setShowBanner(true);

      setTimeout(() => {
        if (isGameOverRef.current) return;
        const b = boardRef.current;
        const allBotMoves: { fromR: number; fromC: number; toR: number; toC: number; isCastle?: any; isCapture?: any }[] = [];

        for (let r = 0; r < 8; r++) {
          for (let c = 0; c < 8; c++) {
            if (b[r][c]?.color === 'b') {
              const mvs = getPieceMoves(r, c, b);
              mvs.forEach(m => {
                allBotMoves.push({ fromR: r, fromC: c, toR: m.r, toC: m.c, isCastle: m.isCastle, isCapture: m.isCapture });
              });
            }
          }
        }

        if (allBotMoves.length === 0) {
          endGame('w', 'Checkmate! You won!');
          return;
        }

        const weights: Record<PieceType, number> = { K: 1000, Q: 90, R: 50, B: 30, N: 30, P: 10 };
        allBotMoves.sort((m1, m2) => {
          const t1 = b[m1.toR][m1.toC];
          const t2 = b[m2.toR][m2.toC];
          const s1 = t1 ? (weights[t1.type] || 0) : (m1.toR > 3 ? 2 : 0);
          const s2 = t2 ? (weights[t2.type] || 0) : (m2.toR > 3 ? 2 : 0);
          return s2 - s1;
        });

        const topBucket = allBotMoves.slice(0, Math.min(3, allBotMoves.length));
        const chosen = topBucket[Math.floor(Math.random() * topBucket.length)];

        makeMoveRef.current?.(chosen.fromR, chosen.fromC, chosen.toR, chosen.toC, chosen.isCastle);

        if (!isGameOverRef.current) {
          let playerHasMove = false;
          const curB = boardRef.current;
          for (let r = 0; r < 8; r++) {
            for (let c = 0; c < 8; c++) {
              if (curB[r][c]?.color === 'w' && getPieceMoves(r, c, curB).length > 0) {
                playerHasMove = true;
                break;
              }
            }
            if (playerHasMove) break;
          }

          if (!playerHasMove) {
            endGame('b', 'Checkmate! Bot won!');
            return;
          }
          setBannerText("Your turn (White)");
          setShowBanner(true);
        }
      }, 650);
    }
  }, [currentTurn, lastMove, playerTime, botTime, triggerRedLightning, endGame, updateAvatarsMood, getPieceMoves]);

  useEffect(() => {
    makeMoveRef.current = makeMove;
  }, [makeMove]);

  const handleSquareClick = (r: number, c: number) => {
    if (isGameOver || currentTurn !== 'w') return;

    const chosen = legalMoves.find(m => m.r === r && m.c === c);
    if (selectedSquare && chosen) {
      makeMove(selectedSquare.r, selectedSquare.c, r, c, chosen.isCastle);
      return;
    }

    const p = board[r][c];
    if (p && p.color === 'w') {
      setSelectedSquare({ r, c });
      setLegalMoves(getPieceMoves(r, c, board));
    } else {
      setSelectedSquare(null);
      setLegalMoves([]);
    }
  };

  const handleUndo = () => {
    if (isGameOver || moveHistoryRef.current.length === 0) return;
    const prev = moveHistoryRef.current.pop();
    if (!prev) return;
    setBoard(prev.board);
    boardRef.current = prev.board;
    setCurrentTurn(prev.currentTurn);
    setLastMove(prev.lastMove);
    setPlayerTime(prev.playerTime);
    setBotTime(prev.botTime);
    setSelectedSquare(null);
    setLegalMoves([]);
    updateAvatarsMood();
    setBannerText("Move undone");
    setShowBanner(true);
  };

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}:${sec < 10 ? '0' : ''}${sec}`;
  };

  return (
    <div className="w-full h-[100dvh] max-h-[100dvh] bg-slate-50 text-slate-900 overflow-hidden relative select-none font-['Nunito',sans-serif] flex flex-col justify-between">
      {/* Shockwave flash & procedural red lightning canvas */}
      <div
        ref={flashRef}
        className="fixed inset-0 pointer-events-none z-[99998] transition-opacity duration-75 opacity-0 bg-[radial-gradient(circle_at_center,rgba(255,20,50,0.55)_0%,rgba(180,0,30,0.75)_60%,rgba(90,0,15,0.9)_100%)] mix-blend-screen"
      />
      <canvas ref={canvasRef} className="fixed inset-0 pointer-events-none z-[99999]" />

      {/* Dark Checkmate Cinematic Overlay */}
      {showOverlay && (
        <div className="fixed inset-0 w-screen h-screen z-[1000] bg-[radial-gradient(circle_at_center,rgba(12,10,14,0.94)_0%,rgba(4,4,6,0.98)_100%)] flex flex-col items-center justify-center backdrop-blur-sm transition-opacity duration-500 opacity-100">
          {/* Dedicated Piercing Stage inside overlay */}
          <div ref={piercingStageRef} className="piercing-winner-stage" />

          {/* Slanted linear typography slam */}
          <div className="flex flex-col items-center justify-center pointer-events-none mt-5">
            <div className={`slam-line slam-white ${subjectSlammed ? 'slam-anim' : ''}`}>
              {slamSubjectText}
            </div>
            <div className={`slam-line slam-crimson ${verbSlammed ? 'slam-anim' : ''}`}>
              {slamVerbText}
            </div>

            {/* Gold chips award popup */}
            <div className={`chips-award-container ${chipsPopped ? 'pop-in' : ''}`}>
              <i className="fa-solid fa-coins"></i>
              <span>{awardedChipsText}</span>
            </div>

            {/* Rematch Button */}
            <button
              onClick={initBoard}
              className={`overlay-rematch-btn ${showRematchBtn ? 'show' : ''}`}
            >
              Play Again
            </button>
          </div>
        </div>
      )}

      {/* Main Screen Container */}
      <div ref={screenRef} className="w-full h-full flex flex-col justify-between items-center relative overflow-hidden">
        {/* Top Header */}
        <header className="w-full h-[46px] flex items-center justify-between px-4 pt-1 flex-shrink-0 z-10">
          <Link href="/home" className="w-9 h-9 rounded-full flex items-center justify-center text-slate-500 hover:bg-slate-200 transition active:scale-95 text-lg">
            ✕
          </Link>

          {/* Timers Pill */}
          <div className="flex items-center bg-slate-200 rounded-full p-1 gap-1">
            <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full font-mono text-xs font-black transition ${currentTurn === 'w' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'}`}>
              <i className="fa-regular fa-clock text-[11px]"></i>
              <span>{formatTime(playerTime)}</span>
            </div>
            <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full font-mono text-xs font-black transition ${currentTurn === 'b' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'}`}>
              <i className="fa-regular fa-clock text-[11px]"></i>
              <span>{formatTime(botTime)}</span>
            </div>
          </div>

          {/* Score Badge */}
          <div className="flex items-center gap-1 bg-[#fef2f2] border border-[#fca5a5] text-[#c9020f] rounded-full px-2.5 py-1 font-mono text-xs font-black">
            <i className="fa-solid fa-trophy text-[10px]"></i>
            <span>13</span>
          </div>
        </header>

        {/* Status Notice Banner */}
        <div className={`status-banner ${showBanner ? 'show' : ''}`}>
          {bannerText}
        </div>

        {/* Opponent Area (Top Bot Avatar) */}
        <div className="w-full flex-1 min-h-[110px] max-h-[180px] flex flex-col items-center justify-end relative z-[5]">
          <div
            ref={botContainerRef}
            id="bot-avatar-display"
            className="bot-avatar-display"
            title="Opponent Bot"
          />
        </div>

        {/* Center Chessboard Section */}
        <div className="w-full flex items-center justify-center flex-shrink-0 bg-[#0d0d0f]">
          <div
            id="chessboard"
            className="w-full max-w-[100vw] aspect-square grid grid-cols-8 grid-rows-8 border-y-[2.5px] border-[#c9020f] overflow-hidden touch-manipulation"
          >
            {board.map((row, r) =>
              row.map((piece, c) => {
                const isDark = (r + c) % 2 === 1;
                const isSelected = selectedSquare?.r === r && selectedSquare?.c === c;
                const isHighlightLast = lastMove && ((lastMove.fromR === r && lastMove.fromC === c) || (lastMove.toR === r && lastMove.toC === c));
                const legalMove = legalMoves.find(m => m.r === r && m.c === c);

                let squareClasses = `square ${isDark ? 'dark' : 'light'} `;
                if (isSelected) squareClasses += 'selected ';
                else if (isHighlightLast) squareClasses += 'highlight-last ';

                const bgCol = isSelected
                  ? '#e60012'
                  : isHighlightLast
                  ? '#780008'
                  : isDark
                  ? '#121215'
                  : '#c9020f';

                return (
                  <div
                    key={`${r}-${c}`}
                    data-r={r}
                    data-c={c}
                    onClick={() => handleSquareClick(r, c)}
                    className={squareClasses}
                    style={{ backgroundColor: bgCol }}
                  >
                    {legalMove && (
                      <div
                        className={piece && piece.color !== currentTurn ? 'move-capture-ring' : 'move-dot'}
                        style={
                          piece && piece.color !== currentTurn
                            ? {
                                width: '82%',
                                height: '82%',
                                borderRadius: '9999px',
                                border: '3.5px solid #ffffff',
                                boxShadow: '0 0 10px #c9020f, inset 0 0 6px #c9020f',
                                pointerEvents: 'none',
                                position: 'absolute',
                                zIndex: 10,
                              }
                            : {
                                width: '28%',
                                height: '28%',
                                borderRadius: '9999px',
                                backgroundColor: 'rgba(255, 255, 255, 0.95)',
                                boxShadow: '0 0 8px #c9020f, 0 0 4px #ffffff',
                                pointerEvents: 'none',
                                position: 'absolute',
                                zIndex: 10,
                              }
                        }
                      />
                    )}
                    {piece && (
                      <img
                        src={PIECE_IMAGES[piece.type]}
                        alt={`${piece.color} ${piece.type}`}
                        className={`piece-img ${piece.color === 'w' ? 'piece-white' : ''}`}
                      />
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Bottom Player Area (Player Avatar Middle, Action controls sides) */}
        <div className="w-full flex-1 min-h-[110px] max-h-[180px] flex items-center justify-between px-5 pb-2 relative z-[5]">
          <button
            onClick={handleUndo}
            className="w-10 h-10 rounded-full border border-slate-300 bg-white text-slate-600 flex items-center justify-center hover:bg-slate-100 transition active:scale-95 shadow-sm"
            title="Undo"
          >
            <i className="fa-solid fa-rotate-left text-sm"></i>
          </button>

          <div
            ref={playerContainerRef}
            id="player-avatar-stage"
            className="player-avatar-stage"
            title="Your Avatar"
          />

          <button
            onClick={initBoard}
            className="w-10 h-10 rounded-full border border-slate-300 bg-white text-slate-600 flex items-center justify-center hover:bg-slate-100 transition active:scale-95 shadow-sm"
            title="Reset Game"
          >
            <i className="fa-solid fa-arrows-rotate text-sm"></i>
          </button>
        </div>
      </div>
    </div>
  );
}
