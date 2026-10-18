'use client';

import React, { useState, useEffect, useRef, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams, useRouter } from 'next/navigation';
import { getChessClient, ActiveMatchRecord } from '../../lib/chess-dungeon-client';
import { playMoveSound, playCaptureSound, playKillerMoveSound } from '../../lib/chess-audio';

type PieceType = 'P' | 'R' | 'N' | 'B' | 'Q' | 'K';
type PieceColor = 'w' | 'b';

interface Piece {
  type: PieceType;
  color: PieceColor;
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
    newBoard[0][c] = { type: backRank[c], color: 'b' };
    newBoard[1][c] = { type: 'P', color: 'b' };
    newBoard[6][c] = { type: 'P', color: 'w' };
    newBoard[7][c] = { type: backRank[c], color: 'w' };
  }
  return newBoard;
};

function WatchLiveContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const matchId = searchParams.get('matchId') || 'live_match';

  const [match, setMatch] = useState<ActiveMatchRecord | null>(null);
  const [board, setBoard] = useState<(Piece | null)[][]>(createStartingBoard);
  const [currentTurn, setCurrentTurn] = useState<PieceColor>('w');
  const [lastMove, setLastMove] = useState<{ fromR: number; fromC: number; toR: number; toC: number } | null>(null);
  const [killerFlash, setKillerFlash] = useState(false);
  const [viewerCount, setViewerCount] = useState(12);

  const prevMoveTimestampRef = useRef<string | null>(null);

  useEffect(() => {
    const client = getChessClient();

    const fetchMatch = async () => {
      const data = await client.getMatchState(matchId);
      if (data) {
        setMatch(data);
        if (data.turn) setCurrentTurn(data.turn);

        // Check if a new killer move was broadcast
        if (data.updatedAt !== prevMoveTimestampRef.current) {
          prevMoveTimestampRef.current = data.updatedAt;
          if (data.killerMove) {
            playKillerMoveSound();
            setKillerFlash(true);
            setTimeout(() => setKillerFlash(false), 900);
          } else if (data.lastMove) {
            playMoveSound();
          }
        }
      } else {
        // Fallback demo match for instant spectating experience if no live duel is active
        setMatch({
          id: matchId,
          playerWhite: { id: 'p1', name: 'Yumeko Jabami' },
          playerBlack: { id: 'p2', name: 'Mary Saotome' },
          stake: 25,
          currency: 'Chips',
          turn: 'w',
          status: 'in_progress',
          updatedAt: new Date().toISOString()
        });
      }
    };

    fetchMatch();
    const pollInterval = setInterval(fetchMatch, 1500);

    // Listen to real-time SSE stream from Levity
    const unsubscribeSSE = client.listenToRealtimeStream((eventData) => {
      if (eventData?.id === matchId || eventData?.matchId === matchId) {
        setMatch(prev => ({ ...(prev || {}), ...eventData }));
        if (eventData.killerMove) {
          playKillerMoveSound();
          setKillerFlash(true);
          setTimeout(() => setKillerFlash(false), 900);
        } else {
          playMoveSound();
        }
      }
    });

    return () => {
      clearInterval(pollInterval);
      unsubscribeSSE();
    };
  }, [matchId]);

  return (
    <div className="bg-slate-950 text-white min-h-screen flex flex-col justify-between max-w-md mx-auto relative select-none font-['Nunito',sans-serif] overflow-hidden">
      {/* Red Lightning Killer Flash Effect */}
      {killerFlash && (
        <div className="fixed inset-0 z-50 pointer-events-none bg-red-600/35 mix-blend-screen animate-ping"></div>
      )}

      {/* Top Header */}
      <header className="px-4 py-3 bg-slate-900/90 backdrop-blur-md border-b border-slate-800 flex items-center justify-between z-10">
        <Link
          href="/home"
          className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center text-slate-300 hover:text-white transition active:scale-95"
        >
          <i className="fa-solid fa-arrow-left text-xs"></i>
        </Link>

        <div className="flex items-center space-x-2">
          <span className="w-2.5 h-2.5 rounded-full bg-rose-600 animate-pulse"></span>
          <span className="text-xs font-black tracking-wider uppercase text-rose-500">
            SPECTATING LIVE
          </span>
        </div>

        <div className="flex items-center space-x-1.5 text-xs font-extrabold text-slate-400">
          <i className="fa-solid fa-users text-[11px]"></i>
          <span>{viewerCount}</span>
        </div>
      </header>

      {/* Players Header */}
      <div className="px-4 py-3 bg-slate-900/50 border-b border-slate-800/80">
        <div className="flex items-center justify-between">
          {/* White Player */}
          <div className="flex items-center space-x-2.5">
            <div className="w-10 h-10 rounded-full bg-slate-800 border-2 border-white/80 overflow-hidden flex items-center justify-center">
              {match?.playerWhite?.avatar ? (
                <div className="w-full h-full relative" dangerouslySetInnerHTML={{ __html: match.playerWhite.avatar }} />
              ) : (
                <span className="font-black text-xs text-white">W</span>
              )}
            </div>
            <div>
              <div className="text-xs font-black text-slate-200">{match?.playerWhite?.name || 'White'}</div>
              <div className="text-[10px] font-bold text-slate-400">White Pieces</div>
            </div>
          </div>

          {/* Stakes Badge */}
          <div className="text-center px-3 py-1 rounded-full bg-rose-950/60 border border-rose-800/60 text-[#c9020f] font-black text-xs">
            {match?.currency === 'Cash' ? `₦${match?.stake}` : `${match?.stake} Chips`}
          </div>

          {/* Black Player */}
          <div className="flex items-center space-x-2.5 flex-row-reverse space-x-reverse">
            <div className="w-10 h-10 rounded-full bg-slate-800 border-2 border-slate-700 overflow-hidden flex items-center justify-center">
              {match?.playerBlack?.avatar ? (
                <div className="w-full h-full relative" dangerouslySetInnerHTML={{ __html: match.playerBlack.avatar }} />
              ) : (
                <span className="font-black text-xs text-slate-400">B</span>
              )}
            </div>
            <div className="text-right">
              <div className="text-xs font-black text-slate-200">{match?.playerBlack?.name || 'Black'}</div>
              <div className="text-[10px] font-bold text-slate-400">Black Pieces</div>
            </div>
          </div>
        </div>
      </div>

      {/* Live Chessboard */}
      <div className="flex-1 flex flex-col items-center justify-center p-3">
        <div className="w-full max-w-[360px] aspect-square rounded-2xl overflow-hidden border-4 border-slate-800 shadow-2xl relative bg-slate-900 grid grid-cols-8 grid-rows-8">
          {board.map((row, r) =>
            row.map((piece, c) => {
              const isLight = (r + c) % 2 === 0;
              const isLast = lastMove && ((lastMove.fromR === r && lastMove.fromC === c) || (lastMove.toR === r && lastMove.toC === c));

              return (
                <div
                  key={`${r}-${c}`}
                  className={`relative flex items-center justify-center ${
                    isLast
                      ? 'bg-amber-400/30'
                      : isLight
                      ? 'bg-[#ececd0]'
                      : 'bg-[#779956]'
                  }`}
                >
                  {piece && (
                    <img
                      src={PIECE_IMAGES[piece.type]}
                      alt={piece.type}
                      className={`w-[75%] h-[75%] object-contain pointer-events-none drop-shadow-md ${
                        piece.color === 'b' ? 'brightness-0 contrast-200' : ''
                      }`}
                    />
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Live Status Banner */}
        <div className="mt-4 px-4 py-2 rounded-xl bg-slate-900 border border-slate-800 flex items-center space-x-2">
          <i className="fa-solid fa-chess-clock text-rose-500 text-xs"></i>
          <span className="text-xs font-black text-slate-300">
            {currentTurn === 'w' ? "White's turn to move" : "Black's turn to move"}
          </span>
        </div>
      </div>

      {/* Spectator Bottom Controls */}
      <div className="px-5 py-4 bg-slate-900/90 border-t border-slate-800 flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <button
            onClick={() => playKillerMoveSound()}
            className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-black flex items-center space-x-1.5 transition active:scale-95 cursor-pointer"
            title="Test killer sound effect"
          >
            <i className="fa-solid fa-volume-high text-rose-500"></i>
            <span>Killer Audio</span>
          </button>
        </div>

        <button
          onClick={() => router.push('/home')}
          className="px-4 py-2 rounded-xl bg-[#c9020f] hover:bg-[#b0020d] text-white font-black text-xs transition active:scale-95 shadow-sm cursor-pointer"
        >
          Back to Lobby
        </button>
      </div>
    </div>
  );
}

export default function WatchLivePage() {
  return (
    <Suspense
      fallback={
        <div className="bg-slate-950 text-white min-h-screen flex items-center justify-center">
          <i className="fa-solid fa-circle-notch fa-spin text-2xl text-rose-600"></i>
        </div>
      }
    >
      <WatchLiveContent />
    </Suspense>
  );
}
