'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { getChessClient, UserProfile, ChallengeRecord } from '../lib/chess-dungeon-client';

interface ChallengeStakesBottomSheetProps {
  isOpen: boolean;
  onClose: () => void;
  currentMode: 'Chips' | 'Cash' | 'Both';
  currentUser: UserProfile | null;
}

export default function ChallengeStakesBottomSheet({
  isOpen,
  onClose,
  currentMode,
  currentUser,
}: ChallengeStakesBottomSheetProps) {
  const router = useRouter();
  const [selectedStake, setSelectedStake] = useState<number | null>(null);
  const stake = selectedStake ?? (currentMode === 'Cash' ? 250 : 10);
  const [opponentUsername, setOpponentUsername] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [activeChallenge, setActiveChallenge] = useState<ChallengeRecord | null>(null);
  const [copied, setCopied] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const pollTimerRef = useRef<any>(null);

  // Cleanup polling on unmount or close
  useEffect(() => {
    return () => {
      if (pollTimerRef.current) clearInterval(pollTimerRef.current);
    };
  }, []);

  if (!isOpen) return null;

  const chipsPresets = [2, 5, 10, 25, 50, 100];
  const cashPresets = [100, 250, 500, 1000, 2500];

  const handleSendChallenge = async () => {
    setErrorMsg(null);
    const client = getChessClient();
    const user = client.getCurrentUser();

    if (!user) {
      setErrorMsg('Please sign in or continue as guest to challenge players.');
      return;
    }

    if (user.isAnonymous && (user.chips ?? 0) <= 0) {
      setErrorMsg('Anonymous users with zero chips are not allowed to challenge players.');
      return;
    }

    if ((currentMode === 'Chips' || currentMode === 'Both') && (user.chips || 0) < stake) {
      setErrorMsg('insufficient chips');
      return;
    }

    if ((currentMode === 'Cash' || currentMode === 'Both') && (user.cashBalance || 0) < stake) {
      setErrorMsg('insufficient balance');
      return;
    }

    setIsSubmitting(true);
    try {
      if ('Notification' in window && Notification.permission === 'default') {
        Notification.requestPermission().catch(() => {});
      }

      const { challenge } = await client.createChallenge({
        stake,
        currency: currentMode,
        opponentUsername: opponentUsername.trim() || undefined,
      });

      setActiveChallenge(challenge);

      // Start authoritative polling until opponent accepts
      if (pollTimerRef.current) clearInterval(pollTimerRef.current);
      pollTimerRef.current = setInterval(async () => {
        const latest = await client.getChallenge(challenge.id);
        if (latest && latest.status === 'accepted') {
          clearInterval(pollTimerRef.current);
          setActiveChallenge(latest);
          setTimeout(() => {
            router.push(`/match?matchId=${challenge.id}&stake=${stake}&currency=${currentMode}`);
          }, 1200);
        }
      }, 1500);

      // Also listen to realtime SSE stream from Levity
      const unsubscribeSSE = client.listenToRealtimeStream((eventData) => {
        if (eventData?.id === challenge.id && eventData?.status === 'accepted') {
          clearInterval(pollTimerRef.current);
          unsubscribeSSE();
          setActiveChallenge(eventData);
          setTimeout(() => {
            router.push(`/match?matchId=${challenge.id}&stake=${stake}&currency=${currentMode}`);
          }, 1200);
        }
      });
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to dispatch challenge');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCopyLink = () => {
    if (!activeChallenge) return;
    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    const shareUrl = `${origin}/home?accept_challenge=${activeChallenge.id}`;
    if (navigator.clipboard) {
      navigator.clipboard.writeText(shareUrl).then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2200);
      }).catch(() => {});
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-xs transition-opacity duration-300">
      <div className="w-full max-w-md bg-white rounded-t-3xl p-6 shadow-2xl relative border-t border-slate-100 flex flex-col font-['Nunito',sans-serif] animate-in slide-in-from-bottom duration-300 max-h-[90vh] overflow-y-auto">
        {/* Drag handle */}
        <div className="w-12 h-1.5 bg-slate-200 rounded-full mx-auto mb-4"></div>

        {/* Close Button */}
        <button
          onClick={() => {
            if (pollTimerRef.current) clearInterval(pollTimerRef.current);
            onClose();
          }}
          className="absolute top-5 right-5 text-slate-400 hover:text-slate-600 w-8 h-8 rounded-full flex items-center justify-center hover:bg-slate-100 transition cursor-pointer"
        >
          <i className="fa-solid fa-xmark text-lg"></i>
        </button>

        {!activeChallenge ? (
          <div>
            <div className="flex items-center space-x-2.5 mb-1">
              <span className="w-2.5 h-2.5 rounded-full bg-[#c9020f] animate-pulse"></span>
              <h2 className="text-xl font-black text-slate-800 tracking-tight">Challenge Real Players</h2>
            </div>
            <p className="text-xs font-bold text-slate-400 mb-5">
              Set your stakes in <span className="text-[#c9020f] font-extrabold">{currentMode}</span> and duel for supremacy.
            </p>

            {/* User Balance Header */}
            <div className="p-3 bg-slate-50 rounded-2xl border border-slate-100 mb-5 flex items-center justify-between">
              <span className="text-xs font-black text-slate-500 uppercase tracking-wider">Your Balance</span>
              <div className="flex items-center space-x-3 text-sm font-black">
                <span className="text-slate-700 flex items-center space-x-1">
                  <i className="fa-solid fa-coins text-amber-500"></i>
                  <span>{currentUser?.chips ?? 0} Chips</span>
                </span>
                <span className="text-slate-700 flex items-center space-x-1">
                  <i className="fa-solid fa-wallet text-emerald-600"></i>
                  <span>₦{currentUser?.cashBalance ?? 0}</span>
                </span>
              </div>
            </div>

            {/* Stakes Selector */}
            <div className="mb-5">
              <label className="block text-xs font-black text-slate-700 uppercase tracking-wider mb-2">
                Select {currentMode === 'Cash' ? 'Cash' : 'Chips'} Stake
              </label>
              <div className="grid grid-cols-3 gap-2 mb-3">
                {(currentMode === 'Cash' ? cashPresets : chipsPresets).map((val) => (
                  <button
                    key={val}
                    type="button"
                    onClick={() => setSelectedStake(val)}
                    className={`py-2.5 rounded-xl font-black text-xs transition active:scale-95 cursor-pointer border ${
                      stake === val
                        ? 'bg-[#c9020f] border-[#c9020f] text-white shadow-sm'
                        : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    {currentMode === 'Cash' ? `₦${val}` : `${val} Chips`}
                  </button>
                ))}
              </div>

              {/* Custom Stake */}
              <div className="relative">
                <input
                  type="number"
                  min="1"
                  value={stake}
                  onChange={(e) => setSelectedStake(Math.max(1, parseInt(e.target.value) || 0))}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-xs font-bold text-slate-800 outline-none focus:border-[#c9020f] focus:bg-white transition"
                  placeholder="Custom stake amount"
                />
                <span className="absolute right-4 top-2.5 text-xs font-black text-slate-400 pointer-events-none">
                  {currentMode === 'Cash' ? 'NGN' : 'CHIPS'}
                </span>
              </div>
            </div>

            {/* Target Opponent */}
            <div className="mb-6">
              <label className="block text-xs font-black text-slate-700 uppercase tracking-wider mb-2">
                Target Opponent (Optional)
              </label>
              <div className="relative">
                <i className="fa-solid fa-at absolute left-3.5 top-3 text-slate-400 text-xs"></i>
                <input
                  type="text"
                  value={opponentUsername}
                  onChange={(e) => setOpponentUsername(e.target.value)}
                  placeholder="Leave empty for Open Challenge Link"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-4 py-2.5 text-xs font-bold text-slate-800 outline-none focus:border-[#c9020f] focus:bg-white transition"
                />
              </div>
              <p className="text-[11px] font-bold text-slate-400 mt-1">
                Enter a specific username to send a direct notification, or share the challenge link with any opponent.
              </p>
            </div>

            {/* Balance Warnings */}
            {currentUser?.isAnonymous && (currentUser?.chips || 0) <= 0 && (
              <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-xl text-amber-800 text-xs font-black flex items-center space-x-2">
                <i className="fa-solid fa-circle-exclamation"></i>
                <span>Anonymous users with zero chips cannot challenge players.</span>
              </div>
            )}

            {!currentUser?.isAnonymous && (currentMode === 'Chips' || currentMode === 'Both') && (currentUser?.chips || 0) < stake && (
              <div className="mb-4 p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs font-black flex items-center space-x-2">
                <i className="fa-solid fa-triangle-exclamation"></i>
                <span>insufficient chips</span>
              </div>
            )}

            {errorMsg && (
              <div className="mb-4 p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs font-black flex items-center space-x-2">
                <i className="fa-solid fa-triangle-exclamation"></i>
                <span>{errorMsg}</span>
              </div>
            )}

            {/* Send Request Button */}
            {(() => {
              const isAnonZero = currentUser?.isAnonymous && (currentUser?.chips || 0) <= 0;
              const isNoChips = (currentMode === 'Chips' || currentMode === 'Both') && (currentUser?.chips || 0) < stake;
              const isNoCash = (currentMode === 'Cash' || currentMode === 'Both') && (currentUser?.cashBalance || 0) < stake;
              const isBlocked = isAnonZero || isNoChips || isNoCash;

              return (
                <button
                  onClick={handleSendChallenge}
                  disabled={isSubmitting || isBlocked}
                  className="w-full bg-[#c9020f] hover:bg-[#b0020d] disabled:opacity-50 text-white font-black text-sm py-3.5 rounded-2xl shadow-[0_4px_0_0_#96010a] active:shadow-none active:translate-y-1 transition duration-150 uppercase tracking-wider flex items-center justify-center space-x-2 cursor-pointer disabled:cursor-not-allowed"
                >
                  {isSubmitting ? (
                    <>
                      <i className="fa-solid fa-circle-notch fa-spin"></i>
                      <span>Creating Challenge...</span>
                    </>
                  ) : isAnonZero ? (
                    <span>Cannot Challenge (0 Chips)</span>
                  ) : isNoChips ? (
                    <span>insufficient chips</span>
                  ) : isNoCash ? (
                    <span>insufficient balance</span>
                  ) : (
                    <>
                      <i className="fa-solid fa-swords"></i>
                      <span>Send Challenge ({currentMode === 'Cash' ? `₦${stake}` : `${stake} Chips`})</span>
                    </>
                  )}
                </button>
              );
            })()}
          </div>
        ) : (
          /* Live Challenge Polling / Waiting state - Sheet stays open! */
          <div className="text-center py-2">
            {activeChallenge.status === 'accepted' ? (
              <div className="space-y-4 animate-in fade-in zoom-in duration-300">
                <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-600 mx-auto flex items-center justify-center text-2xl shadow-sm">
                  <i className="fa-solid fa-check"></i>
                </div>
                <h3 className="text-lg font-black text-slate-900 tracking-tight">Challenge Accepted!</h3>
                <p className="text-xs font-bold text-slate-500">
                  {activeChallenge.acceptedByName || 'Opponent'} joined the duel. Loading dungeon match...
                </p>
                <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                  <div className="bg-emerald-500 h-full w-full animate-pulse"></div>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                {/* Radar pulse animation */}
                <div className="relative w-20 h-20 mx-auto flex items-center justify-center">
                  <div className="absolute inset-0 rounded-full bg-rose-500/20 animate-ping"></div>
                  <div className="relative w-16 h-16 rounded-full bg-rose-50 border-2 border-rose-200 flex items-center justify-center text-rose-600 text-2xl shadow-inner">
                    <i className="fa-solid fa-radar fa-spin"></i>
                  </div>
                </div>

                <div>
                  <h3 className="text-base font-black text-slate-900 tracking-tight">
                    Waiting for Opponent to Accept...
                  </h3>
                  <div className="inline-block mt-1 px-3 py-1 rounded-full bg-rose-50 border border-rose-200 text-[#c9020f] font-extrabold text-xs">
                    Stakes: {activeChallenge.currency === 'Cash' ? `₦${activeChallenge.stake}` : `${activeChallenge.stake} Chips`}
                  </div>
                </div>

                <p className="text-xs font-bold text-slate-500 max-w-xs mx-auto">
                  {activeChallenge.opponentUsername
                    ? `Notification dispatched to @${activeChallenge.opponentUsername}. Listening for their response...`
                    : 'Share this challenge link with your opponent to initiate the match.'}
                </p>

                {/* Share Link Box */}
                <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200 flex items-center justify-between space-x-2">
                  <span className="text-[11px] font-mono text-slate-600 truncate text-left">
                    {typeof window !== 'undefined' ? `${window.location.origin}/home?accept_challenge=${activeChallenge.id}` : ''}
                  </span>
                  <button
                    onClick={handleCopyLink}
                    className={`px-3 py-1.5 rounded-xl font-black text-xs transition active:scale-95 cursor-pointer whitespace-nowrap flex items-center space-x-1 ${
                      copied ? 'bg-emerald-600 text-white' : 'bg-slate-800 text-white hover:bg-slate-900'
                    }`}
                  >
                    <i className={`fa-solid ${copied ? 'fa-check' : 'fa-copy'}`}></i>
                    <span>{copied ? 'Copied!' : 'Copy Link'}</span>
                  </button>
                </div>

                <div className="pt-2">
                  <button
                    onClick={() => {
                      if (pollTimerRef.current) clearInterval(pollTimerRef.current);
                      setActiveChallenge(null);
                      onClose();
                    }}
                    className="text-xs font-extrabold text-slate-400 hover:text-slate-600 transition"
                  >
                    Cancel Challenge
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
