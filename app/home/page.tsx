'use client';

import React, { useState, useEffect, useCallback, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import AuthBottomSheet from '../../components/AuthBottomSheet';
import ChallengeStakesBottomSheet from '../../components/ChallengeStakesBottomSheet';
import AcceptChallengeBottomSheet from '../../components/AcceptChallengeBottomSheet';
import {
  getChessClient,
  UserProfile,
  TopPlayer,
  ActiveMatchRecord
} from '../../lib/chess-dungeon-client';
import { MatchHistoryRecord } from '../../lib/history-storage';

function HomePageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [currentMode, setCurrentMode] = useState<'Chips' | 'Cash' | 'Both'>('Chips');
  const [activeTab, setActiveTab] = useState<'history' | 'leaderboard'>('history');

  // Bottom sheets
  const [isAuthOpen, setIsAuthOpen] = useState(() => {
    if (typeof window !== 'undefined') {
      const client = getChessClient();
      const user = client.getCurrentUser();
      const isAnon = !user || user.isAnonymous;
      const pending = client.getPendingMagicAuth();
      const sheetOpen = localStorage.getItem('cd_auth_sheet_open') === 'true';
      return Boolean(isAnon && (pending || sheetOpen));
    }
    return false;
  });
  const [isChallengeStakesOpen, setIsChallengeStakesOpen] = useState(false);
  const [dismissedChallengeId, setDismissedChallengeId] = useState<string | null>(null);

  // Derived from URL parameter for challenge callback
  const rawChallengeParam = searchParams.get('accept_challenge');
  const acceptChallengeId = rawChallengeParam && rawChallengeParam !== dismissedChallengeId ? rawChallengeParam : null;

  // User and Game data
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);
  const [topPlayers, setTopPlayers] = useState<TopPlayer[]>([]);
  const [isLoadingTopPlayers, setIsLoadingTopPlayers] = useState(true);
  const [activeMatches, setActiveMatches] = useState<ActiveMatchRecord[]>([]);
  const [historyRecords, setHistoryRecords] = useState<MatchHistoryRecord[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(true);
  const [botChipsWarning, setBotChipsWarning] = useState<string | null>(null);

  const refreshData = useCallback(async () => {
    if (typeof window === 'undefined') return;
    const client = getChessClient();
    const user = client.getCurrentUser();
    setCurrentUser(user);

    client.refreshBalance().then(u => {
      if (u) setCurrentUser(u);
    }).catch(() => {});

    setIsLoadingTopPlayers(true);
    try {
      const players = await client.getTopPlayers();
      setTopPlayers(players);
    } catch (_) {
      setTopPlayers([]);
    } finally {
      setIsLoadingTopPlayers(false);
    }

    try {
      const active = await client.getActiveMatches();
      setActiveMatches(active);
    } catch (_) {}

    try {
      const history = await client.getMatchHistory();
      setHistoryRecords(history);
    } catch (_) {
      setHistoryRecords([]);
    } finally {
      setIsLoadingHistory(false);
    }
  }, []);

  useEffect(() => {
    let isMounted = true;

    // Asynchronous boundary avoids calling setState synchronously within an effect body
    const init = async () => {
      await Promise.resolve();
      if (!isMounted) return;

      const client = getChessClient();
      const user = client.getCurrentUser();
      setCurrentUser(user);

      const pendingAuth = client.getPendingMagicAuth();
      const sheetOpen = localStorage.getItem('cd_auth_sheet_open') === 'true';
      if ((pendingAuth || sheetOpen) && (!user || user.isAnonymous)) {
        setIsAuthOpen(true);
      }

      client.refreshBalance().then(u => {
        if (isMounted && u) setCurrentUser(u);
      }).catch(() => {});

      setIsLoadingTopPlayers(true);
      try {
        const players = await client.getTopPlayers();
        if (isMounted) setTopPlayers(players);
      } catch (_) {
        if (isMounted) setTopPlayers([]);
      } finally {
        if (isMounted) setIsLoadingTopPlayers(false);
      }

      try {
        const active = await client.getActiveMatches();
        if (isMounted) setActiveMatches(active);
      } catch (_) {}

      try {
        const history = await client.getMatchHistory();
        if (isMounted) {
          setHistoryRecords(history);
          setIsLoadingHistory(false);
        }
      } catch (_) {
        if (isMounted) setIsLoadingHistory(false);
      }
    };

    init();

    const client = getChessClient();
    const unsubscribe = client.listenToRealtimeStream((data) => {
      if (data?.matches || data?.documents) {
        client.getActiveMatches().then(m => {
          if (isMounted) setActiveMatches(m);
        }).catch(() => {});
      }
    });

    return () => {
      isMounted = false;
      unsubscribe();
    };
  }, []);

  // Handle Play vs Bot with chips rules:
  // Anonymous: plays for fun without needing or losing chips (saved in IndexedDB)
  // Authenticated: requires at least 2 chips (win: +2, loss: -2)
  const handlePlayBot = () => {
    setBotChipsWarning(null);
    const client = getChessClient();
    const user = client.getCurrentUser();

    if (user && !user.isAnonymous && (user.chips || 0) < 2) {
      setBotChipsWarning('insufficient chips');
      setTimeout(() => setBotChipsWarning(null), 4000);
      return;
    }

    router.push('/match?bot=true');
  };

  const handleRematch = (record: MatchHistoryRecord) => {
    if (record.isBot) {
      handlePlayBot();
    } else {
      setIsChallengeStakesOpen(true);
    }
  };

  const handleOpenAuth = () => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('cd_auth_sheet_open', 'true');
    }
    setIsAuthOpen(true);
  };

  const handleCloseAuth = () => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('cd_auth_sheet_open', 'false');
    }
    setIsAuthOpen(false);
  };

  return (
    <div className="bg-white text-slate-700 min-h-screen flex flex-col justify-between max-w-md mx-auto relative select-none font-['Nunito',sans-serif]">
      {/* Top Header */}
      <header className="px-5 pt-6 pb-2">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-black text-slate-800 tracking-tight">Chess Dungeon</h1>
          <button
            onClick={handleOpenAuth}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-rose-200 bg-rose-50/80 hover:bg-rose-100 text-rose-700 text-xs font-black transition active:scale-95 shadow-xs cursor-pointer"
            title="Account & Auth"
          >
            <i className={`fa-solid ${currentUser && !currentUser.isAnonymous ? 'fa-user-check' : 'fa-user-secret'} text-xs text-rose-600`}></i>
            <span>{currentUser && !currentUser.isAnonymous ? (currentUser.nickname || currentUser.username) : 'Sign In'}</span>
          </button>
        </div>

        <div className="flex items-center space-x-4 mt-2 text-sm font-extrabold text-slate-500">
          <div className="flex items-center space-x-1.5">
            <i className="fa-solid fa-coins text-amber-500 text-base"></i>
            <span className="text-slate-600">{currentUser?.chips ?? 0} CHIPS</span>
            {currentUser && !currentUser.isAnonymous && (currentUser.chips ?? 0) < 2 && (
              <span className="text-[10px] font-black text-rose-600 uppercase bg-rose-50 px-1.5 py-0.5 rounded border border-rose-200">
                insufficient chips
              </span>
            )}
          </div>
          <div className="flex items-center space-x-1.5">
            <i className="fa-solid fa-circle-check text-[#c9020f] text-base"></i>
            <span className="text-slate-600">{currentUser?.wins ?? 0} WINS</span>
          </div>
          <div className="flex items-center space-x-1.5">
            <i className="fa-solid fa-wallet text-amber-500 text-base"></i>
            <span className="text-slate-600">₦{currentUser?.cashBalance ?? 0}</span>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="px-5 py-4 flex-1">
        {/* Game Modes Selection */}
        <div className="grid grid-cols-3 gap-3 mb-5">
          {/* Chips Card */}
          <div
            onClick={() => setCurrentMode('Chips')}
            className={`cursor-pointer border-2 rounded-2xl p-2.5 flex flex-col items-center relative transition transform active:scale-95 ${
              currentMode === 'Chips'
                ? 'border-[#c9020f] bg-[#fef2f2] shadow-sm'
                : 'border-slate-200 bg-slate-50/50'
            }`}
          >
            <div className="w-full aspect-square rounded-xl overflow-hidden bg-amber-100 flex items-center justify-center mb-2">
              <img
                src="https://t3.ftcdn.net/jpg/07/29/03/54/360_F_729035436_yrwyx3geEUlhABPqSmUgHF6XBYRtFVCs.jpg"
                alt="Chips"
                className="w-full h-full object-cover"
                referrerPolicy="no-referrer"
              />
            </div>
            <span
              className={`text-sm ${
                currentMode === 'Chips'
                  ? 'font-extrabold text-[#c9020f]'
                  : 'font-bold text-slate-500'
              }`}
            >
              Chips
            </span>
          </div>

          {/* Cash Card */}
          <div
            onClick={() => setCurrentMode('Cash')}
            className={`cursor-pointer border-2 rounded-2xl p-2.5 flex flex-col items-center relative transition transform active:scale-95 ${
              currentMode === 'Cash'
                ? 'border-[#c9020f] bg-[#fef2f2] shadow-sm'
                : 'border-slate-200 bg-slate-50/50'
            }`}
          >
            <div className="w-full aspect-square rounded-xl overflow-hidden bg-rose-100 flex items-center justify-center mb-2">
              <img
                src="https://icarus.levity.click/api/remove-bg?imageUrl=https%3A%2F%2Fmedia.istockphoto.com%2Fid%2F2194838781%2Fvector%2Fvector-2d-isometric-jar-or-bottle-saving-and-financial-concept-coins-illustration-icon-and.jpg%3Fs%3D612x612%26w%3D0%26k%3D20%26c%3DW4CjXEdg-TR6Kc0U-PvGLcDC-LSfcxaanZscma9vQtk%3D&secret=icarus_sk_1a6b77e6cf8e46c79d71c2c822520375&tolerance=32&smoothness=4&crop=true&padding=12&shadow=false"
                alt="Cash"
                className="w-full h-full object-cover"
                referrerPolicy="no-referrer"
              />
            </div>
            <span
              className={`text-sm ${
                currentMode === 'Cash'
                  ? 'font-extrabold text-[#c9020f]'
                  : 'font-bold text-slate-500'
              }`}
            >
              Cash
            </span>
          </div>

          {/* Both Card */}
          <div
            onClick={() => setCurrentMode('Both')}
            className={`cursor-pointer border-2 rounded-2xl p-2.5 flex flex-col items-center relative transition transform active:scale-95 ${
              currentMode === 'Both'
                ? 'border-[#c9020f] bg-[#fef2f2] shadow-sm'
                : 'border-slate-200 bg-slate-50/50'
            }`}
          >
            <div className="w-full aspect-square rounded-xl overflow-hidden bg-purple-100 flex items-center justify-center mb-2">
              <img
                src="https://placehold.co/150x150/ede9fe/5b21b6?text=Both"
                alt="Both"
                className="w-full h-full object-cover"
              />
            </div>
            <span
              className={`text-sm ${
                currentMode === 'Both'
                  ? 'font-extrabold text-[#c9020f]'
                  : 'font-bold text-slate-500'
              }`}
            >
              Both
            </span>
          </div>
        </div>

        {/* Start Game Button: Opens Challenge Stakes Bottom Sheet */}
        <button
          onClick={() => setIsChallengeStakesOpen(true)}
          className="w-full bg-[#c9020f] hover:bg-[#b0020d] text-white font-black text-base py-4 rounded-2xl shadow-[0_4px_0_0_#96010a] active:shadow-none active:translate-y-1 transition duration-150 uppercase tracking-wider mb-6 cursor-pointer flex items-center justify-center space-x-2"
        >
          <i className="fa-solid fa-swords"></i>
          <span>Start game!</span>
        </button>

        {/* ACTIVE MATCH CAROUSEL: Shown right before history when there are active matches */}
        {activeMatches.length > 0 && (
          <div className="mb-6">
            <div className="flex items-center justify-between mb-2.5">
              <div className="flex items-center space-x-2">
                <span className="w-2.5 h-2.5 rounded-full bg-red-600 animate-ping"></span>
                <h3 className="font-black text-xs uppercase tracking-wider text-slate-800">
                  Live Matches Carousel
                </h3>
              </div>
              <span className="text-[11px] font-black text-rose-600 uppercase">
                {activeMatches.length} In Progress
              </span>
            </div>

            <div className="flex space-x-3 overflow-x-auto pb-2 scrollbar-none">
              {activeMatches.map((m) => (
                <div
                  key={m.id}
                  className="min-w-[240px] bg-slate-50 border border-slate-200 rounded-2xl p-3 flex flex-col justify-between flex-shrink-0 shadow-xs"
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="px-2 py-0.5 rounded-md bg-rose-100 text-rose-700 text-[10px] font-black uppercase flex items-center space-x-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-rose-600"></span>
                      <span>Live Duel</span>
                    </span>
                    <span className="text-xs font-extrabold text-slate-600">
                      {m.currency === 'Cash' ? `₦${m.stake}` : `${m.stake} Chips`}
                    </span>
                  </div>

                  <div className="flex items-center justify-center space-x-3 my-1">
                    <span className="text-xs font-black text-slate-800 truncate max-w-[80px]">
                      {m.playerWhite?.name || 'White'}
                    </span>
                    <span className="text-[10px] font-black text-rose-500">VS</span>
                    <span className="text-xs font-black text-slate-800 truncate max-w-[80px]">
                      {m.playerBlack?.name || 'Black'}
                    </span>
                  </div>

                  <button
                    onClick={() => router.push(`/watch?matchId=${m.id}`)}
                    className="mt-2 w-full py-1.5 rounded-xl bg-slate-800 hover:bg-slate-900 text-white font-black text-xs transition active:scale-95 cursor-pointer flex items-center justify-center space-x-1.5"
                  >
                    <i className="fa-solid fa-eye text-xs"></i>
                    <span>Watch Live</span>
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Tabs Navigation */}
        <div className="flex border-b-2 border-slate-100 mb-5">
          <button
            onClick={() => setActiveTab('history')}
            className={`pb-2.5 px-1 font-black text-xs tracking-wider uppercase transition-all mr-6 cursor-pointer ${
              activeTab === 'history'
                ? 'border-b-4 border-[#c9020f] text-[#c9020f]'
                : 'border-b-4 border-transparent text-slate-400 hover:text-slate-600'
            }`}
          >
            Match History
          </button>
          <button
            onClick={() => setActiveTab('leaderboard')}
            className={`pb-2.5 px-1 font-black text-xs tracking-wider uppercase transition-all cursor-pointer ${
              activeTab === 'leaderboard'
                ? 'border-b-4 border-[#c9020f] text-[#c9020f]'
                : 'border-b-4 border-transparent text-slate-400 hover:text-slate-600'
            }`}
          >
            Top Players
          </button>
        </div>

        {/* Tab Content 1: Match History */}
        {activeTab === 'history' && (
          <div className="space-y-4 pb-28">
            {isLoadingHistory ? (
              <div className="space-y-3 animate-pulse">
                {[1, 2, 3, 4].map((n) => (
                  <div key={n} className="flex items-center justify-between py-2">
                    <div className="flex items-center space-x-3">
                      <div className="w-12 h-12 rounded-full bg-slate-200 flex-shrink-0"></div>
                      <div className="space-y-2">
                        <div className="w-28 h-3.5 bg-slate-200 rounded"></div>
                        <div className="w-20 h-2.5 bg-slate-100 rounded"></div>
                      </div>
                    </div>
                    <div className="w-20 h-8 bg-slate-200 rounded-xl"></div>
                  </div>
                ))}
              </div>
            ) : historyRecords.length === 0 ? (
              <div className="py-6 text-center text-slate-400 text-xs font-bold">
                No recorded matches yet. Play against the bot or challenge players!
              </div>
            ) : (
              historyRecords.map((record) => (
                <div key={record.id} className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className="w-12 h-12 rounded-full overflow-hidden bg-pink-100 flex-shrink-0 border border-slate-100 shadow-sm flex items-center justify-center">
                      {record.opponentAvatar && record.opponentAvatar.includes('<svg') ? (
                        <div
                          className="w-full h-full relative"
                          dangerouslySetInnerHTML={{ __html: record.opponentAvatar }}
                        />
                      ) : (
                        <img
                          src={record.opponentAvatar || 'https://placehold.co/100x100/fbcfe8/831843?text=Opponent'}
                          alt={record.opponent}
                          className="w-full h-full object-cover"
                        />
                      )}
                    </div>
                    <div>
                      <h4 className="font-extrabold text-slate-800 text-sm leading-tight">
                        {record.opponent}
                      </h4>
                      <div className="flex items-center space-x-2 text-xs font-bold text-slate-400 mt-0.5">
                        <span className="flex items-center space-x-1 text-amber-600 font-extrabold">
                          <i className="fa-solid fa-coins text-amber-500"></i>
                          <span>{record.stakeChips} Chips Match</span>
                        </span>
                        <span>•</span>
                        <span
                          className={`flex items-center space-x-1 font-extrabold ${
                            record.result === 'win' ? 'text-[#c9020f]' : 'text-slate-500'
                          }`}
                        >
                          <i
                            className={`fa-solid ${
                              record.result === 'win' ? 'fa-circle-check' : 'fa-circle-xmark'
                            }`}
                          ></i>
                          <span>{record.result === 'win' ? 'Win' : 'Loss'}</span>
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* ONLY Rematch Button - Review is completely removed! */}
                  <button
                    onClick={() => handleRematch(record)}
                    className="bg-[#c9020f] hover:bg-[#96010a] text-white font-black text-xs px-4 py-2 rounded-xl transition active:scale-95 shadow-sm cursor-pointer"
                  >
                    REMATCH
                  </button>
                </div>
              ))
            )}

            {/* You vs Bots with an underline right at the bottom in the middle. No icon, no background, no mechanism description. */}
            <div className="pt-6 pb-2 text-center">
              {botChipsWarning && (
                <div className="mb-2 text-xs font-bold text-rose-600">
                  {botChipsWarning}
                </div>
              )}
              <span
                onClick={handlePlayBot}
                className="inline-block text-xs font-bold text-slate-500 hover:text-slate-800 underline underline-offset-4 cursor-pointer select-none transition"
              >
                You vs Bots
              </span>
            </div>
          </div>
        )}

        {/* Tab Content 2: Top Players (Leaderboard from Database) */}
        {/* Rules: Pure skeleton loader without text, 'No top players' empty state, NO #1/#2, ONLY percentage of win, NO background, Avatar on far right */}
        {activeTab === 'leaderboard' && (
          <div className="space-y-4 pb-28">
            {isLoadingTopPlayers ? (
              <div className="space-y-3 animate-pulse">
                {[1, 2, 3, 4, 5].map((n) => (
                  <div
                    key={n}
                    className="flex items-center justify-between py-3 border-b border-slate-50 last:border-b-0"
                  >
                    <div className="space-y-2">
                      <div className="w-32 h-3.5 bg-slate-200 rounded"></div>
                      <div className="w-14 h-2.5 bg-slate-100 rounded"></div>
                    </div>
                    <div className="w-11 h-11 rounded-full bg-slate-200 flex-shrink-0"></div>
                  </div>
                ))}
              </div>
            ) : topPlayers.length === 0 ? (
              <div className="py-12 text-center text-slate-400 font-bold text-xs">
                No top players available
              </div>
            ) : (
              topPlayers.map((player, index) => (
                <div
                  key={player.id || player.username || index}
                  className="flex items-center justify-between py-2.5 px-1 border-b border-slate-50 last:border-b-0"
                >
                  {/* Left: Player Info with ONLY percentage of win */}
                  <div>
                    <h4 className="font-black text-slate-900 text-sm leading-tight">
                      {player.nickname || player.username}
                    </h4>
                    <div className="text-xs font-extrabold text-[#c9020f] mt-0.5">
                      {player.winRate ?? 0}%
                    </div>
                  </div>

                  {/* Far Right: User Avatar as Profile Image */}
                  <div className="w-11 h-11 rounded-full overflow-hidden bg-rose-50 border border-slate-100 flex-shrink-0 shadow-sm flex items-center justify-center relative">
                    {player.avatarSvg && player.avatarSvg.includes('<svg') ? (
                      <div
                        className="w-full h-full relative"
                        dangerouslySetInnerHTML={{ __html: player.avatarSvg }}
                      />
                    ) : (
                      <img
                        src={player.avatarUrl || 'https://placehold.co/100x100/fbcfe8/831843?text=P'}
                        alt={player.username}
                        className="w-full h-full object-cover"
                      />
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </main>

      {/* Bottom Navigation Bar */}
      <nav className="fixed bottom-0 left-0 right-0 max-w-md mx-auto bg-white/95 backdrop-blur-md border-t border-slate-100 px-6 py-3 flex items-center justify-between z-40">
        <Link href="/home" className="flex flex-col items-center text-[#c9020f] transition active:scale-95">
          <i className="fa-solid fa-chess text-xl"></i>
          <span className="text-[11px] font-black mt-1">Play</span>
        </Link>
        <Link href="/create_avatar" className="flex flex-col items-center text-slate-400 hover:text-slate-700 transition active:scale-95">
          <i className="fa-solid fa-user-astronaut text-xl"></i>
          <span className="text-[11px] font-extrabold mt-1">Avatar</span>
        </Link>
        <button
          onClick={() => setActiveTab('leaderboard')}
          className="flex flex-col items-center text-slate-400 hover:text-slate-700 transition active:scale-95 cursor-pointer"
        >
          <i className="fa-solid fa-trophy text-xl"></i>
          <span className="text-[11px] font-extrabold mt-1">Ranks</span>
        </button>
        <Link href="/" className="flex flex-col items-center text-slate-400 hover:text-slate-700 transition active:scale-95">
          <i className="fa-solid fa-clone text-xl"></i>
          <span className="text-[11px] font-extrabold mt-1">Cards</span>
        </Link>
      </nav>

      {/* 1. Levity Auth Bottom Sheet */}
      <AuthBottomSheet
        isOpen={isAuthOpen}
        onClose={handleCloseAuth}
        onAuthChange={(newUser) => {
          setCurrentUser(newUser);
          refreshData();
        }}
      />

      {/* 2. Challenge Stakes Bottom Sheet */}
      <ChallengeStakesBottomSheet
        isOpen={isChallengeStakesOpen}
        onClose={() => setIsChallengeStakesOpen(false)}
        currentMode={currentMode}
        currentUser={currentUser}
      />

      {/* 3. Accept Challenge Bottom Sheet (Triggered by ?accept_challenge= URL callback) */}
      <AcceptChallengeBottomSheet
        challengeId={acceptChallengeId}
        onClose={() => {
          if (acceptChallengeId) setDismissedChallengeId(acceptChallengeId);
          // Clean URL param
          if (typeof window !== 'undefined') {
            const url = new URL(window.location.href);
            url.searchParams.delete('accept_challenge');
            window.history.replaceState({}, '', url.toString());
          }
        }}
        onOpenCounterChallenge={(opponentName) => {
          if (acceptChallengeId) setDismissedChallengeId(acceptChallengeId);
          setIsChallengeStakesOpen(true);
        }}
      />
    </div>
  );
}

export default function HomePage() {
  return (
    <Suspense
      fallback={
        <div className="bg-white text-slate-700 min-h-screen max-w-md mx-auto p-5 space-y-4 animate-pulse">
          <div className="h-8 bg-slate-200 rounded w-1/2 mb-4"></div>
          <div className="grid grid-cols-3 gap-3 mb-5">
            <div className="h-28 bg-slate-200 rounded-2xl"></div>
            <div className="h-28 bg-slate-200 rounded-2xl"></div>
            <div className="h-28 bg-slate-200 rounded-2xl"></div>
          </div>
          <div className="h-14 bg-slate-200 rounded-2xl mb-6"></div>
          <div className="space-y-3">
            <div className="h-12 bg-slate-100 rounded-xl"></div>
            <div className="h-12 bg-slate-100 rounded-xl"></div>
            <div className="h-12 bg-slate-100 rounded-xl"></div>
          </div>
        </div>
      }
    >
      <HomePageContent />
    </Suspense>
  );
}
