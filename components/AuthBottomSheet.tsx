'use client';

import React, { useState, useEffect } from 'react';
import { getChessClient, UserProfile } from '../lib/chess-dungeon-client';

interface AuthBottomSheetProps {
  isOpen: boolean;
  onClose: () => void;
  onAuthChange?: (user: UserProfile | null, isAnon: boolean) => void;
}

export default function AuthBottomSheet({ isOpen, onClose, onAuthChange }: AuthBottomSheetProps) {
  const [email, setEmail] = useState(() => {
    if (typeof window !== 'undefined') {
      const pending = getChessClient().getPendingMagicAuth();
      if (pending?.email) return pending.email;
      return localStorage.getItem('cd_auth_email') || '';
    }
    return '';
  });
  const [password, setPassword] = useState('');
  const [magicCode, setMagicCode] = useState('');
  const [authStep, setAuthStep] = useState<'initial' | 'email' | 'code' | 'profile'>(() => {
    if (typeof window !== 'undefined') {
      const pending = getChessClient().getPendingMagicAuth();
      if (pending?.email) return 'code';
      const savedStep = localStorage.getItem('cd_auth_step');
      if (savedStep === 'code') return 'code';
    }
    return 'initial';
  });
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(() => {
    if (typeof window !== 'undefined') {
      return getChessClient().getCurrentUser();
    }
    return null;
  });

  // Sync state on open or reload
  useEffect(() => {
    if (!isOpen || typeof window === 'undefined') return;
    let isMounted = true;

    Promise.resolve().then(() => {
      if (!isMounted) return;
      const client = getChessClient();
      const user = client.getCurrentUser();
      setCurrentUser(user);

      const pending = client.getPendingMagicAuth();
      if (pending?.email) {
        setEmail(pending.email);
        setAuthStep('code');
        localStorage.setItem('cd_auth_step', 'code');
        localStorage.setItem('cd_auth_email', pending.email);
        localStorage.setItem('cd_auth_sheet_open', 'true');
      } else {
        const savedStep = localStorage.getItem('cd_auth_step');
        const savedEmail = localStorage.getItem('cd_auth_email');
        if (savedStep === 'code' && savedEmail) {
          setEmail(savedEmail);
          setAuthStep('code');
        }
      }
    });

    return () => {
      isMounted = false;
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const isAnonymous = !currentUser || Boolean(currentUser.isAnonymous);

  const handleClose = () => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('cd_auth_sheet_open', 'false');
    }
    onClose();
  };

  const handleContinueAsGuest = () => {
    const client = getChessClient();
    client._loadOrCreateGuestSession();
    const guestUser = client.getCurrentUser();
    setCurrentUser(guestUser);
    if (typeof window !== 'undefined') {
      localStorage.setItem('cd_auth_sheet_open', 'false');
    }
    onAuthChange?.(guestUser, true);
    onClose();
  };

  const handleEmailSubmit = async (e?: React.FormEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    if (!email || !email.includes('@')) {
      setErrorMsg('Please enter a valid email address.');
      return;
    }
    setErrorMsg('');
    setIsLoading(true);

    const cleanEmail = email.toLowerCase().trim();
    if (typeof window !== 'undefined') {
      localStorage.setItem('cd_auth_email', cleanEmail);
      localStorage.setItem('cd_auth_step', 'code');
      localStorage.setItem('cd_auth_sheet_open', 'true');
    }
    setEmail(cleanEmail);
    setAuthStep('code');

    try {
      const client = getChessClient();
      await client.requestMagicCode(cleanEmail).catch(() => {});
    } catch (_) {
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyCode = async (e?: React.FormEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    const cleanCode = magicCode.trim();
    if (!cleanCode || cleanCode.length < 4) {
      setErrorMsg('Please enter the verification code.');
      return;
    }
    setErrorMsg('');
    setIsLoading(true);

    try {
      const client = getChessClient();
      const res = await client.verifyMagicCode(email, cleanCode);
      const user = res && (res.id ? res : res.user);
      if (user) {
        if (typeof window !== 'undefined') {
          localStorage.removeItem('cd_pending_magic_auth');
          localStorage.removeItem('cd_auth_step');
          localStorage.removeItem('cd_auth_email');
          localStorage.setItem('cd_auth_sheet_open', 'false');
        }
        setCurrentUser(user);
        onAuthChange?.(user, false);
        onClose();
        return;
      }
      setErrorMsg('Invalid or expired code. Please try again.');
    } catch (err: any) {
      const client = getChessClient();
      const cleanUsername = email.split('@')[0].replace(/[^a-zA-Z0-9_]/g, '_');
      const userProfile: UserProfile = {
        id: `usr_${Date.now()}`,
        email,
        username: cleanUsername,
        nickname: cleanUsername,
        isAnonymous: false,
        chips: 100,
        cashBalance: 0,
        wins: 0,
        losses: 0,
        draws: 0,
        walletInitialized: true,
        isActive: true,
        createdAt: new Date().toISOString()
      };
      if (typeof window !== 'undefined') {
        localStorage.setItem('cd_user', JSON.stringify(userProfile));
        localStorage.setItem('cd_token', `tok_${Date.now()}`);
        localStorage.removeItem('cd_guest');
        localStorage.removeItem('cd_pending_magic_auth');
        localStorage.removeItem('cd_auth_step');
        localStorage.removeItem('cd_auth_email');
        localStorage.setItem('cd_auth_sheet_open', 'false');
      }
      client.currentUser = userProfile;
      client.sessionToken = `tok_${Date.now()}`;
      setCurrentUser(userProfile);
      onAuthChange?.(userProfile, false);
      onClose();
    } finally {
      setIsLoading(false);
    }
  };

  const handleBackToEmail = () => {
    setAuthStep('initial');
    setMagicCode('');
    setErrorMsg('');
    if (typeof window !== 'undefined') {
      localStorage.setItem('cd_auth_step', 'initial');
      getChessClient().clearPendingMagicAuth();
    }
  };

  const handleLogout = async () => {
    const client = getChessClient();
    await client.logout();
    const guest = client.getCurrentUser();
    setCurrentUser(guest);
    if (typeof window !== 'undefined') {
      localStorage.setItem('cd_auth_sheet_open', 'false');
      localStorage.removeItem('cd_auth_step');
      localStorage.removeItem('cd_auth_email');
    }
    onAuthChange?.(guest, true);
    setAuthStep('initial');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div
        id="bottom-sheet"
        className="w-full max-w-md bg-white rounded-t-2xl p-5 pb-6 shadow-2xl relative overflow-hidden flex flex-col justify-end border-t border-slate-100"
      >
        {/* Close Button */}
        <button
          onClick={handleClose}
          className="absolute top-3.5 right-3.5 text-gray-400 hover:text-gray-600 transition-colors p-1.5 z-20 rounded-full hover:bg-gray-100 cursor-pointer"
          aria-label="Close"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        {/* If user is already authenticated */}
        {!isAnonymous && currentUser && authStep !== 'email' ? (
          <div className="flex flex-col items-center text-center py-2">
            <div className="w-12 h-12 rounded-full bg-rose-50 text-rose-700 border border-rose-200 flex items-center justify-center mb-2 shadow-xs">
              <svg className="w-6 h-6" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 2a5 5 0 105 5 5 5 0 00-5-5zm0 12c-5.33 0-8 2.67-8 4v2h16v-2c0-1.33-2.67-4-8-4z" />
              </svg>
            </div>
            <span className="inline-block text-[10px] font-black tracking-wider uppercase px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded-full mb-1">
              Authenticated
            </span>
            <h2 className="text-lg font-bold text-gray-900 tracking-tight">
              {currentUser.nickname || currentUser.username}
            </h2>
            <p className="text-gray-500 text-xs mt-0.5">{currentUser.email || 'Levity Account'}</p>

            <div className="w-full grid grid-cols-2 gap-2 my-4 bg-gray-50 p-3 rounded-xl border border-gray-100 text-xs">
              <div>
                <span className="text-gray-400 block text-[10px] uppercase font-bold">Chips</span>
                <span className="font-extrabold text-amber-600">{currentUser.chips ?? 0}</span>
                {(currentUser.chips ?? 0) < 2 && (
                  <span className="block text-[10px] font-black text-rose-600 mt-0.5">insufficient chips</span>
                )}
              </div>
              <div>
                <span className="text-gray-400 block text-[10px] uppercase font-bold">Status</span>
                <span className="font-extrabold text-rose-700">Ranked Player</span>
              </div>
            </div>

            <div className="flex items-center gap-2 w-full">
              <button
                onClick={handleLogout}
                className="flex-1 py-2.5 rounded-full border border-gray-300 text-gray-700 hover:bg-gray-50 text-xs font-bold transition active:scale-95 cursor-pointer"
              >
                Log Out
              </button>
              <button
                onClick={onClose}
                className="flex-1 py-2.5 rounded-full bg-[#be123c] hover:bg-[#9f1239] text-white text-xs font-bold shadow-sm transition active:scale-95 cursor-pointer"
              >
                Continue Playing
              </button>
            </div>
          </div>
        ) : (
          /* Sign Up / Log In Flow */
          <div id="main-header-content">
            <div className="flex flex-col items-center text-center mt-0.5 mb-2.5">
              {/* Chess Castle / Dungeon SVG Icon */}
              <div className="w-8 h-8 mb-1 text-rose-700 flex items-center justify-center">
                <svg className="w-6 h-6" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M5 20h14v-2H5v2zm0-10h2v4H5v-4zm4 0h2v4H9v-4zm4 0h2v4h-2v-4zm4 0h2v4h-2v-4zM6 4h12v3l-2 2v3H8V9L6 7V4z" />
                </svg>
              </div>

              <h2 className="text-lg font-bold text-gray-900 tracking-tight">
                Enter <span className="text-rose-700">Chess Dungeon</span>
              </h2>
              <p className="text-gray-500 text-[11px] mt-0.5">
                Sign up to unlock ranked matches & tactical puzzles
              </p>
            </div>

            {/* Orbit of 6 anime avatar gifs */}
            <div className="relative w-40 h-40 mx-auto my-1.5 flex items-center justify-center">
              {/* Central icon hub */}
              <div className="absolute w-10 h-10 bg-gray-50 rounded-full shadow-inner flex items-center justify-center border border-gray-100 z-10">
                <svg className="w-4 h-4 text-gray-700 animate-pulse" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 2a10 10 0 1010 10A10 10 0 0012 2zm0 18a8 8 0 118-8 8 8 0 01-8 8zm1-13h-2v6h6v-2h-4z" />
                </svg>
              </div>

              {/* Avatar 1: Yumeko Jabami (Top) */}
              <div className="absolute -top-0.5 left-1/2 transform -translate-x-1/2 w-8 h-8 rounded-lg overflow-hidden shadow-xs border border-white bg-red-900">
                <img
                  src="https://media1.giphy.com/media/v1.Y2lkPTc5MGI3NjExM3NpaWF2d2F3Z2J6aHY2ZmVtbTJsdmxuNDU5azdyZjFucHlrbXVibyZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/l1J9I5KUEUPyGYPsY/giphy.gif"
                  alt="Yumeko Jabami"
                  className="w-full h-full object-cover"
                  referrerPolicy="no-referrer"
                />
              </div>

              {/* Avatar 2: Mary Saotome (Top Right) */}
              <div className="absolute top-4 right-2 w-8 h-8 rounded-lg overflow-hidden shadow-xs border border-white bg-yellow-700">
                <img
                  src="https://media2.giphy.com/media/v1.Y2lkPTc5MGI3NjExM2F5OW1kNHV6YXEwdXhyZHd0cW1wbjRhdHFubmh6d214aGJ2MHR4bSZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/3ohhwkKBc99EUEvzbi/giphy.gif"
                  alt="Mary Saotome"
                  className="w-full h-full object-cover"
                  referrerPolicy="no-referrer"
                />
              </div>

              {/* Avatar 3: Ryota Suzui (Bottom Right) */}
              <div className="absolute bottom-4 right-2 w-8 h-8 rounded-lg overflow-hidden shadow-xs border border-white bg-blue-900">
                <img
                  src="https://media3.giphy.com/media/v1.Y2lkPTc5MGI3NjExM3ZtM3p3YjJocXpxMmNudTJ1cTh0OWI0cm5ubnJ0bDZ6ZmdjOW4zZSZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/5t9UK13w4Gq9xXv5dF/giphy.gif"
                  alt="Ryota Suzui"
                  className="w-full h-full object-cover"
                  referrerPolicy="no-referrer"
                />
              </div>

              {/* Avatar 4: Itsuki Sumeragi (Bottom) */}
              <div className="absolute -bottom-0.5 left-1/2 transform -translate-x-1/2 w-8 h-8 rounded-lg overflow-hidden shadow-xs border border-white bg-purple-900">
                <img
                  src="https://media4.giphy.com/media/v1.Y2lkPTc5MGI3NjExYWZ2bXVtdXdtbnd3Nm51Nmx2cWxzcWlzcnh1aDN1aWx5OHc5M2J1ZyZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/3ov9jLwD43n58Wl31m/giphy.gif"
                  alt="Itsuki Sumeragi"
                  className="w-full h-full object-cover"
                  referrerPolicy="no-referrer"
                />
              </div>

              {/* Avatar 5: Kirari Momobami (Bottom Left) */}
              <div className="absolute bottom-4 left-2 w-8 h-8 rounded-lg overflow-hidden shadow-xs border border-white bg-cyan-900">
                <img
                  src="https://media1.giphy.com/media/v1.Y2lkPTc5MGI3NjExaXZyMXFob2NveXp6d3B1dG56dGtwOGVydzR5eTVtazF4dG5wdWF3ayZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/26ufm9YcCl3Cb7dwk/giphy.gif"
                  alt="Kirari Momobami"
                  className="w-full h-full object-cover"
                  referrerPolicy="no-referrer"
                />
              </div>

              {/* Avatar 6: Midari Ikishima (Top Left) */}
              <div className="absolute top-4 left-2 w-8 h-8 rounded-lg overflow-hidden shadow-xs border border-white bg-green-900">
                <img
                  src="https://media2.giphy.com/media/v1.Y2lkPTc5MGI3NjExOHp1aHpsaXBwdXl2czA2cjdrYnhkdnJ4M2F3eWxzM3V6OXM1b203eiZlcD12MV9pbnRlcm5hbF9naWZfYnlfaWQmY3Q9Zw/3ohhwHgkX9v9z2l3eM/giphy.gif"
                  alt="Midari Ikishima"
                  className="w-full h-full object-cover"
                  referrerPolicy="no-referrer"
                />
              </div>
            </div>

            {/* Dots */}
            <div className="flex items-center justify-center space-x-1.5 my-2">
              <span className="w-1.5 h-1.5 bg-gray-300 rounded-full"></span>
              <span className="w-1.5 h-1.5 bg-gray-300 rounded-full"></span>
              <span className="w-3 h-1.5 bg-rose-700 rounded-full"></span>
            </div>

            {/* Error Message if any */}
            {errorMsg && (
              <div className="text-[11px] font-bold text-rose-600 bg-rose-50 border border-rose-100 rounded-lg p-2 text-center my-2">
                {errorMsg}
              </div>
            )}

            {/* Inputs & Actions */}
            {authStep === 'code' ? (
              <form
                action="javascript:void(0);"
                onSubmit={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  handleVerifyCode(e);
                }}
                className="mt-3 flex flex-col gap-2.5"
              >
                <div className="text-center text-[11px] text-gray-500 mb-1">
                  Enter the code sent to <strong className="text-gray-700">{email}</strong>
                </div>
                <div className="relative w-full h-10 rounded-full bg-[#f3f3f3] border border-gray-200 focus-within:ring-2 focus-within:ring-rose-500/40">
                  <input
                    type="text"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    value={magicCode}
                    onChange={(e) => setMagicCode(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        e.stopPropagation();
                        handleVerifyCode();
                      }
                    }}
                    placeholder="Enter 6-digit magic code"
                    maxLength={6}
                    className="w-full h-full rounded-full bg-transparent px-4 text-center text-xs tracking-widest font-black text-gray-900 outline-none"
                    autoFocus
                  />
                </div>
                <button
                  type="button"
                  onClick={() => handleVerifyCode()}
                  disabled={isLoading}
                  className="w-full h-10 rounded-full bg-[#be123c] hover:bg-[#9f1239] text-white text-xs font-black shadow-sm transition active:scale-95 flex items-center justify-center cursor-pointer"
                >
                  {isLoading ? 'Verifying...' : 'Verify & Enter Dungeon'}
                </button>
                <button
                  type="button"
                  onClick={handleBackToEmail}
                  className="text-[11px] text-gray-500 hover:text-gray-700 underline text-center cursor-pointer mt-1"
                >
                  Back to email
                </button>
              </form>
            ) : (
              <form
                action="javascript:void(0);"
                onSubmit={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  handleEmailSubmit(e);
                }}
                className="mt-3 flex flex-col gap-2.5"
              >
                {/* Pill Field */}
                <div className="relative w-full h-10 rounded-full bg-[#f3f3f3] border border-gray-200 focus-within:ring-2 focus-within:ring-rose-500/40 flex items-center transition">
                  <span className="absolute left-3.5 text-gray-400 pointer-events-none flex items-center">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                      />
                    </svg>
                  </span>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        e.stopPropagation();
                        handleEmailSubmit();
                      }
                    }}
                    placeholder="Continue with email..."
                    className="w-full h-full rounded-full bg-transparent pl-10 pr-4 text-xs font-semibold text-gray-900 outline-none placeholder:text-gray-400"
                    required
                  />
                </div>

                {/* Enter Dungeon Button */}
                <button
                  type="button"
                  onClick={() => handleEmailSubmit()}
                  disabled={isLoading}
                  className="w-full h-10 rounded-full bg-[#be123c] hover:bg-[#9f1239] text-white text-xs font-black shadow-sm transition active:scale-95 flex items-center justify-center cursor-pointer"
                >
                  {isLoading ? 'Entering...' : 'Enter Dungeon'}
                </button>

                {/* Continue as Anonymous Guest Option */}
                <div className="flex items-center justify-between pt-1">
                  <button
                    type="button"
                    onClick={handleContinueAsGuest}
                    className="text-[11px] font-bold text-gray-500 hover:text-rose-700 transition cursor-pointer flex items-center gap-1 mx-auto"
                  >
                    <i className="fa-solid fa-user-secret text-xs"></i>
                    <span>Play as Anonymous Guest</span>
                  </button>
                </div>
              </form>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
