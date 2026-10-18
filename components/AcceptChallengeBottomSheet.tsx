'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { getChessClient, ChallengeRecord, UserProfile } from '../lib/chess-dungeon-client';

interface AcceptChallengeBottomSheetProps {
  challengeId: string | null;
  onClose: () => void;
  onOpenCounterChallenge?: (opponentUsername: string) => void;
}

export default function AcceptChallengeBottomSheet({
  challengeId,
  onClose,
  onOpenCounterChallenge,
}: AcceptChallengeBottomSheetProps) {
  const router = useRouter();
  const [challenge, setChallenge] = useState<ChallengeRecord | null>(null);
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isAccepting, setIsAccepting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!challengeId) return;

    let isMounted = true;
    const fetchChallengeData = async () => {
      setIsLoading(true);
      setErrorMsg(null);
      const client = getChessClient();
      setCurrentUser(client.getCurrentUser());

      try {
        const data = await client.getChallenge(challengeId);
        if (isMounted) {
          setChallenge(data);
        }
      } catch (err: any) {
        if (isMounted) setErrorMsg('Failed to load challenge details.');
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };

    fetchChallengeData();
    return () => {
      isMounted = false;
    };
  }, [challengeId]);

  if (!challengeId) return null;

  const handleAccept = async () => {
    if (!challenge) return;
    setIsAccepting(true);
    setErrorMsg(null);

    try {
      const client = getChessClient();
      await client.acceptChallenge(challenge.id);
      router.push(`/match?matchId=${challenge.id}&stake=${challenge.stake}&currency=${challenge.currency}`);
    } catch (err: any) {
      setErrorMsg(err.message || 'Could not accept challenge');
      setIsAccepting(false);
    }
  };

  const isAlreadyAccepted = challenge && challenge.status === 'accepted';

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-xs transition-opacity duration-300">
      {/* Plain and white bottom sheet */}
      <div className="w-full max-w-md bg-white rounded-t-3xl p-6 shadow-2xl relative flex flex-col font-['Nunito',sans-serif] animate-in slide-in-from-bottom duration-300">
        {/* Subtle drag handle */}
        <div className="w-10 h-1 bg-slate-200 rounded-full mx-auto mb-4"></div>

        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-5 right-5 text-slate-400 hover:text-slate-600 w-8 h-8 rounded-full flex items-center justify-center hover:bg-slate-100 transition cursor-pointer"
        >
          <i className="fa-solid fa-xmark text-lg"></i>
        </button>

        {isLoading ? (
          <div className="py-12 flex flex-col items-center justify-center space-y-3">
            <i className="fa-solid fa-circle-notch fa-spin text-2xl text-[#c9020f]"></i>
            <span className="text-xs font-black text-slate-400">Loading challenge...</span>
          </div>
        ) : !challenge ? (
          <div className="py-8 text-center space-y-3">
            <i className="fa-solid fa-triangle-exclamation text-2xl text-amber-500"></i>
            <h3 className="text-base font-black text-slate-800">Challenge Not Found</h3>
            <p className="text-xs font-bold text-slate-400">This challenge may have expired or was cancelled.</p>
            <button
              onClick={onClose}
              className="mt-3 px-5 py-2 rounded-xl bg-slate-800 text-white font-black text-xs cursor-pointer"
            >
              Back to Home
            </button>
          </div>
        ) : isAlreadyAccepted ? (
          /* Missed match state */
          <div className="py-4 text-center space-y-4">
            <div className="w-14 h-14 rounded-full bg-amber-50 border border-amber-200 text-amber-600 mx-auto flex items-center justify-center text-xl shadow-inner">
              <i className="fa-solid fa-hourglass-end"></i>
            </div>

            <div>
              <h3 className="text-lg font-black text-slate-900 leading-snug">
                Oops! Missed this one.
              </h3>
              <p className="text-xs font-extrabold text-slate-500 mt-1 max-w-xs mx-auto">
                Challenge user for a match to control the stakes
              </p>
            </div>

            {/* Challenger Card */}
            <div className="p-3 bg-slate-50 rounded-2xl border border-slate-100 flex items-center justify-center space-x-3 max-w-xs mx-auto">
              <div className="w-10 h-10 rounded-full bg-rose-100 overflow-hidden flex items-center justify-center flex-shrink-0 border border-rose-200 shadow-xs">
                {challenge.challengerAvatar ? (
                  <div
                    className="w-full h-full relative"
                    dangerouslySetInnerHTML={{ __html: challenge.challengerAvatar }}
                  />
                ) : (
                  <span className="font-black text-rose-700 text-sm">
                    {challenge.challengerName.charAt(0).toUpperCase()}
                  </span>
                )}
              </div>
              <div className="text-left">
                <span className="text-xs font-black text-slate-800">{challenge.challengerName}</span>
                <span className="block text-[11px] font-bold text-slate-400">Previous Stake: {challenge.stake} {challenge.currency}</span>
              </div>
            </div>

            <div className="space-y-2 pt-2">
              <button
                onClick={() => {
                  onClose();
                  if (onOpenCounterChallenge) {
                    onOpenCounterChallenge(challenge.challengerName);
                  }
                }}
                className="w-full bg-[#c9020f] hover:bg-[#b0020d] text-white font-black text-sm py-3.5 rounded-2xl shadow-[0_4px_0_0_#96010a] active:shadow-none active:translate-y-1 transition duration-150 uppercase tracking-wider cursor-pointer"
              >
                Challenge {challenge.challengerName} Back
              </button>
              <button
                onClick={onClose}
                className="w-full py-2.5 text-xs font-black text-slate-400 hover:text-slate-600 transition cursor-pointer"
              >
                Dismiss
              </button>
            </div>
          </div>
        ) : (
          /* Plain White Bottom Sheet showing both avatars with "You vs. {name}" */
          <div className="py-2 text-center">
            {/* Plain white avatar duel presentation */}
            <div className="flex items-center justify-center space-x-6 my-4">
              {/* You (Left) */}
              <div className="flex flex-col items-center">
                <div className="w-16 h-16 rounded-full bg-slate-100 border-2 border-slate-200 overflow-hidden flex items-center justify-center shadow-sm relative">
                  {currentUser?.avatarSvg ? (
                    <div
                      className="w-full h-full relative"
                      dangerouslySetInnerHTML={{ __html: currentUser.avatarSvg }}
                    />
                  ) : (
                    <span className="font-black text-slate-700 text-lg">YOU</span>
                  )}
                </div>
                <span className="text-xs font-black text-slate-800 mt-1.5">You</span>
              </div>

              {/* VS badge */}
              <div className="w-8 h-8 rounded-full bg-[#c9020f] text-white flex items-center justify-center font-black text-xs shadow-sm">
                VS
              </div>

              {/* Challenger (Right) */}
              <div className="flex flex-col items-center">
                <div className="w-16 h-16 rounded-full bg-rose-50 border-2 border-rose-200 overflow-hidden flex items-center justify-center shadow-sm relative">
                  {challenge.challengerAvatar ? (
                    <div
                      className="w-full h-full relative"
                      dangerouslySetInnerHTML={{ __html: challenge.challengerAvatar }}
                    />
                  ) : (
                    <span className="font-black text-rose-700 text-lg">
                      {challenge.challengerName.charAt(0).toUpperCase()}
                    </span>
                  )}
                </div>
                <span className="text-xs font-black text-slate-800 mt-1.5">{challenge.challengerName}</span>
              </div>
            </div>

            {/* Title: You vs. {name} */}
            <h2 className="text-2xl font-black text-slate-900 tracking-tight mt-1 mb-2">
              You vs. {challenge.challengerName}
            </h2>

            {/* Stakes badge */}
            <div className="inline-block px-4 py-1.5 rounded-full bg-rose-50 border border-rose-200 text-[#c9020f] font-black text-xs mb-5">
              Stakes: {challenge.currency === 'Cash' ? `₦${challenge.stake}` : `${challenge.stake} Chips`}
            </div>

            {errorMsg && (
              <div className="mb-4 p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs font-black">
                {errorMsg}
              </div>
            )}

            {/* Action Buttons */}
            <div className="space-y-2">
              <button
                onClick={handleAccept}
                disabled={isAccepting}
                className="w-full bg-[#c9020f] hover:bg-[#b0020d] disabled:opacity-50 text-white font-black text-sm py-3.5 rounded-2xl shadow-[0_4px_0_0_#96010a] active:shadow-none active:translate-y-1 transition duration-150 uppercase tracking-wider flex items-center justify-center space-x-2 cursor-pointer"
              >
                {isAccepting ? (
                  <>
                    <i className="fa-solid fa-circle-notch fa-spin"></i>
                    <span>Entering Dungeon Match...</span>
                  </>
                ) : (
                  <>
                    <i className="fa-solid fa-chess"></i>
                    <span>Accept Challenge</span>
                  </>
                )}
              </button>

              <button
                onClick={onClose}
                className="w-full py-2.5 text-xs font-black text-slate-400 hover:text-slate-600 transition cursor-pointer"
              >
                Decline
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
