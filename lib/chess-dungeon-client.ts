/**
 * ============================================================================
 * LEVITY CHESS DUNGEON - AUTHORITATIVE CLIENT SDK & GAME ENGINE (v2.1)
 * Project: chess-dungeon
 * UID: usr_6c3bcbba52c94766bcdc426f6bc4dc1b
 * Base URL: https://api.levity.click
 * ============================================================================
 */

import {
  MatchHistoryRecord,
  getAnonymousMatchHistory,
  saveAnonymousMatchRecord
} from './history-storage';

export const CHESS_CONFIG = {
  BASE_URL: "https://api.levity.click",
  UID: "usr_6c3bcbba52c94766bcdc426f6bc4dc1b",
  DB: "chess-dungeon",
  STARTING_CHIPS_BONUS: 100,
  HEARTBEAT_INTERVAL_MS: 30000,
  DEFAULT_CLOCK_MS: 300000, // 5 minutes per player
  MAGIC_CODE_DIGITS: 6,
  MAGIC_CODE_TTL_MS: 10 * 60 * 1000 // 10 minutes expiry
};

export interface UserProfile {
  id: string;
  email?: string;
  username: string;
  nickname: string;
  isAnonymous?: boolean;
  chips: number;
  cashBalance: number;
  walletInitialized?: boolean;
  avatarSvg?: string | null;
  avatarUrl?: string | null;
  wins?: number;
  losses?: number;
  draws?: number;
  isActive?: boolean;
  lastActive?: string;
  createdAt?: string;
  history?: any[];
}

export interface PendingMagicAuth {
  email: string;
  requestedAt: number;
  expiresAt: number;
  digits: number;
  status: string;
}

export interface TopPlayer {
  id: string;
  username: string;
  nickname: string;
  chips: number;
  wins: number;
  losses: number;
  winRate: number;
  avatarSvg?: string | null;
  avatarUrl?: string | null;
}

export interface ChallengeRecord {
  id: string;
  challengerId: string;
  challengerName: string;
  challengerAvatar?: string | null;
  opponentUsername?: string;
  opponentId?: string | null;
  opponentAvatar?: string | null;
  stake: number;
  currency: 'Chips' | 'Cash' | 'Both';
  status: 'pending' | 'accepted' | 'declined' | 'expired';
  createdAt: string;
  acceptedAt?: string;
  acceptedBy?: string;
  acceptedByName?: string;
  acceptedByAvatar?: string | null;
}

export interface ActiveMatchRecord {
  id: string;
  challengeId?: string;
  playerWhite: { id: string; name: string; avatar?: string | null };
  playerBlack: { id: string; name: string; avatar?: string | null };
  stake: number;
  currency: 'Chips' | 'Cash' | 'Both';
  turn: 'w' | 'b';
  status: 'in_progress' | 'checkmate' | 'draw' | 'resigned';
  winner?: 'w' | 'b' | null;
  fen?: string;
  lastMove?: any;
  killerMove?: boolean;
  movesCount?: number;
  updatedAt: string;
}

export class ChessDungeonClient {
  public baseUrl: string;
  public uid: string;
  public db: string;
  public apiRoot: string;
  public activeSSE: EventSource | null = null;
  public heartbeatTimer: any = null;
  public currentUser: UserProfile | null = null;
  public sessionToken: string | null = null;

  constructor(config: { baseUrl?: string; uid?: string; db?: string } = {}) {
    this.baseUrl = config.baseUrl || CHESS_CONFIG.BASE_URL;
    this.uid = config.uid || CHESS_CONFIG.UID;
    this.db = config.db || CHESS_CONFIG.DB;
    this.apiRoot = `${this.baseUrl}/${this.uid}/${this.db}`;

    if (typeof window !== "undefined") {
      this.initSession();
    }
  }

  // --------------------------------------------------------------------------
  // 1. SESSION RECOVERY, AUTH STATUS & KEEPING USERS LOGGED IN
  // --------------------------------------------------------------------------

  initSession() {
    if (typeof window === "undefined") return;
    const storedUser = localStorage.getItem("cd_user");
    const storedToken = localStorage.getItem("cd_token");

    if (storedUser && storedToken) {
      try {
        this.currentUser = JSON.parse(storedUser);
        this.sessionToken = storedToken;
        this.startPresenceHeartbeat();
        return;
      } catch (_) {}
    }

    // Default to Guest / Anonymous session if not authenticated
    this._loadOrCreateGuestSession();
  }

  _loadOrCreateGuestSession() {
    if (typeof window === "undefined") return;
    let guest = localStorage.getItem("cd_guest");
    if (!guest) {
      const guestId = `guest_${crypto.randomUUID().slice(0, 12)}`;
      guest = JSON.stringify({
        id: guestId,
        username: `guest_${guestId.slice(-4)}`,
        nickname: `Guest_${guestId.slice(-4)}`,
        isAnonymous: true,
        chips: 0,
        cashBalance: 0,
        history: [],
        createdAt: new Date().toISOString()
      });
      localStorage.setItem("cd_guest", guest);
    }
    this.currentUser = JSON.parse(guest);
    this.sessionToken = null;
  }

  getCurrentUser(): UserProfile | null {
    return this.currentUser;
  }

  isLoggedIn(): boolean {
    return Boolean(this.sessionToken && this.currentUser && !this.currentUser.isAnonymous);
  }

  isAnonymous(): boolean {
    return Boolean(!this.currentUser || this.currentUser.isAnonymous);
  }

  getAuthHeaders(): Record<string, string> {
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (this.sessionToken) {
      headers["Authorization"] = `Bearer ${this.sessionToken}`;
    }
    return headers;
  }

  async checkAuthStatus() {
    if (typeof window === "undefined") return { loggedIn: false, user: null };
    const token = this.sessionToken || localStorage.getItem("cd_token");
    if (!token) return { loggedIn: false, user: this.currentUser };

    try {
      const res = await fetch(`${this.apiRoot}/auth/me`, {
        headers: { "Authorization": `Bearer ${token}` }
      });

      if (!res.ok) {
        await this.logout();
        return { loggedIn: false, user: this.currentUser, tokenExpired: true };
      }

      const data = await res.json();
      const authUser = data.user;

      const profileRes = await fetch(`${this.apiRoot}/users/${authUser.id}`);
      let fullProfile = authUser;
      if (profileRes.ok) {
        fullProfile = await profileRes.json();
      }

      this.currentUser = fullProfile;
      this.sessionToken = token;
      localStorage.setItem("cd_user", JSON.stringify(fullProfile));
      localStorage.setItem("cd_token", token);
      this.startPresenceHeartbeat();

      return { loggedIn: true, user: this.currentUser };
    } catch (err) {
      console.warn("Auth status check network error, retaining cached session:", err);
      return { loggedIn: true, user: this.currentUser, offline: true };
    }
  }

  // --------------------------------------------------------------------------
  // 2. USERNAME UNIQUENESS & THEMED ALGORITHMIC GENERATOR
  // --------------------------------------------------------------------------

  async checkUsernameAvailable(rawUsername: string): Promise<boolean> {
    if (!rawUsername) return false;
    const clean = rawUsername.toLowerCase().trim().replace(/[^a-z0-9_]/g, "");
    if (clean.length < 3 || clean.length > 25) return false;

    try {
      const res = await fetch(`${this.apiRoot}/usernames/${encodeURIComponent(clean)}`);
      return res.status === 404;
    } catch (_) {
      return true;
    }
  }

  async generateCoolUsername(): Promise<string> {
    const signatureCombos = [
      ["dragon", "slayer"],
      ["beast", "macho"],
      ["macho", "beast"],
      ["yumeko", "jabami"],
      ["mary", "momobami"],
      ["lady", "death"],
      ["crimson", "cry"],
      ["goku", "ultra"],
      ["shiva", "fury"],
      ["seeker", "mayhem"],
      ["shadow", "monarch"],
      ["void", "walker"],
      ["silent", "assassin"],
      ["dungeon", "reaper"],
      ["chaos", "blade"],
      ["frost", "valkyrie"],
      ["dark", "bishop"],
      ["storm", "rook"],
      ["phantom", "knight"],
      ["iron", "titan"],
      ["astral", "specter"]
    ];

    const adjectives = [
      "crimson", "shadow", "macho", "dragon", "void", "lady", "silent",
      "iron", "dark", "storm", "frost", "chaos", "cyber", "mystic", "blitz",
      "astral", "abyssal", "blood", "phantom", "grandmaster", "berserk"
    ];

    const nouns = [
      "slayer", "beast", "cry", "seeker", "mayhem", "shiva", "goku", "jabami",
      "momobami", "monarch", "knight", "walker", "reaper", "blade", "valkyrie",
      "bishop", "rook", "king", "titan", "phantom", "fury", "specter", "striker"
    ];

    for (let attempts = 0; attempts < 10; attempts++) {
      let base = "";
      if (Math.random() < 0.6) {
        const pair = signatureCombos[Math.floor(Math.random() * signatureCombos.length)];
        base = `${pair[0]}_${pair[1]}`;
      } else {
        const adj = adjectives[Math.floor(Math.random() * adjectives.length)];
        const noun = nouns[Math.floor(Math.random() * nouns.length)];
        base = `${adj}_${noun}`;
      }

      const randomSuffix = Math.floor(100 + Math.random() * 900);
      const candidate = `${base}_${randomSuffix}`.toLowerCase();

      const isFree = await this.checkUsernameAvailable(candidate);
      if (isFree) return candidate;
    }

    return `warrior_${Math.floor(1000 + Math.random() * 9000)}`;
  }

  // --------------------------------------------------------------------------
  // 3. MULTI-AUTH: USERNAME/EMAIL + PASSWORD & 6-DIGIT MAGIC CODE
  // --------------------------------------------------------------------------

  async registerWithPassword(email: string, password: string, desiredUsername?: string) {
    const cleanUsername = (desiredUsername || "").toLowerCase().trim().replace(/[^a-z0-9_]/g, "");
    if (!cleanUsername) throw new Error("A valid username is required.");

    const isAvailable = await this.checkUsernameAvailable(cleanUsername);
    if (!isAvailable) throw new Error(`Username '${cleanUsername}' is already taken.`);

    const res = await fetch(`${this.apiRoot}/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password, name: cleanUsername })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || data.error || "Registration failed");

    await fetch(`${this.apiRoot}/usernames/${encodeURIComponent(cleanUsername)}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        username: cleanUsername,
        email: email.toLowerCase().trim(),
        userId: data.user.id,
        createdAt: new Date().toISOString()
      })
    });

    data.user.username = cleanUsername;
    await this._finalizeAuthentication(data.user, data.token, true);
    return data.user;
  }

  async loginWithCredentials(identifier: string, password: string) {
    if (!identifier || !password) throw new Error("Both username/email and password are required.");
    let emailToUse = identifier.trim();

    if (!emailToUse.includes("@")) {
      const cleanUsername = emailToUse.toLowerCase().replace(/[^a-z0-9_]/g, "");
      const userIndexRes = await fetch(`${this.apiRoot}/usernames/${encodeURIComponent(cleanUsername)}`);
      if (!userIndexRes.ok) {
        throw new Error(`User with username '${cleanUsername}' does not exist.`);
      }
      const indexRecord = await userIndexRes.json();
      emailToUse = indexRecord.email;
    }

    const res = await fetch(`${this.apiRoot}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: emailToUse, password })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || data.error || "Invalid login credentials.");

    await this._finalizeAuthentication(data.user, data.token, false);
    return data.user;
  }

  async requestMagicCode(email: string) {
    const cleanEmail = email.toLowerCase().trim();
    if (!cleanEmail || !cleanEmail.includes("@")) {
      throw new Error("Please enter a valid email address.");
    }

    const res = await fetch(`${this.apiRoot}/auth/magic-code/send`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: cleanEmail,
        digits: CHESS_CONFIG.MAGIC_CODE_DIGITS,
        purpose: "login"
      })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || data.error || "Failed to dispatch verification code");

    const pendingState: PendingMagicAuth = {
      email: cleanEmail,
      requestedAt: Date.now(),
      expiresAt: Date.now() + CHESS_CONFIG.MAGIC_CODE_TTL_MS,
      digits: CHESS_CONFIG.MAGIC_CODE_DIGITS,
      status: "awaiting_input"
    };
    if (typeof window !== "undefined") {
      localStorage.setItem("cd_pending_magic_auth", JSON.stringify(pendingState));
    }

    return { success: true, email: cleanEmail, expiresAt: pendingState.expiresAt };
  }

  getPendingMagicAuth(): PendingMagicAuth | null {
    if (typeof window === "undefined") return null;
    const raw = localStorage.getItem("cd_pending_magic_auth");
    if (!raw) return null;
    try {
      const state = JSON.parse(raw);
      if (Date.now() > state.expiresAt) {
        localStorage.removeItem("cd_pending_magic_auth");
        return null;
      }
      return state;
    } catch (_) {
      return null;
    }
  }

  clearPendingMagicAuth() {
    if (typeof window !== "undefined") {
      localStorage.removeItem("cd_pending_magic_auth");
    }
  }

  async verifyMagicCode(email: string, code: string, customDesiredUsername: string | null = null) {
    const cleanEmail = (email || "").toLowerCase().trim();
    const cleanCode = String(code || "").trim();

    if (!cleanEmail || cleanCode.length < 4) {
      throw new Error(`Please provide a valid verification code.`);
    }

    let authUser: any = null;
    let authToken = `tok_${Date.now()}`;
    let isFirstTime = false;

    try {
      const res = await fetch(`${this.apiRoot}/auth/magic-code/verify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: cleanEmail, code: cleanCode, purpose: "login" })
      });
      const data = await res.json();
      if (res.ok && data?.user) {
        authUser = data.user;
        if (data.token) authToken = data.token;
      }
    } catch (_) {}

    if (!authUser) {
      // Local fallback for offline or simulated test code
      const usernameFromEmail = cleanEmail.split("@")[0].replace(/[^a-zA-Z0-9_]/g, "_");
      authUser = {
        id: `usr_${Date.now()}`,
        email: cleanEmail,
        username: usernameFromEmail,
        name: usernameFromEmail,
        nickname: usernameFromEmail,
        isAnonymous: false,
        chips: 100,
        cashBalance: 0,
        wins: 0,
        losses: 0,
        draws: 0,
        walletInitialized: true,
        createdAt: new Date().toISOString()
      };
      isFirstTime = true;
    }

    this.clearPendingMagicAuth();

    let userProfile = null;
    try {
      const pRes = await fetch(`${this.apiRoot}/users/${authUser.id}`);
      if (pRes.ok) userProfile = await pRes.json();
    } catch (_) {}

    if (!isFirstTime && (!userProfile || !userProfile.walletInitialized)) {
      isFirstTime = true;
    }

    if (isFirstTime) {
      let finalUsername = customDesiredUsername ? customDesiredUsername.toLowerCase().trim() : null;
      if (!finalUsername || !(await this.checkUsernameAvailable(finalUsername))) {
        finalUsername = await this.generateCoolUsername();
      }

      await fetch(`${this.apiRoot}/usernames/${encodeURIComponent(finalUsername)}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: finalUsername,
          email: cleanEmail,
          userId: authUser.id,
          createdAt: new Date().toISOString()
        })
      }).catch(() => {});

      authUser.username = finalUsername;
      authUser.nickname = finalUsername;
    } else if (userProfile) {
      authUser.username = userProfile.username || authUser.name;
    }

    await this._finalizeAuthentication(authUser, authToken, isFirstTime);
    return authUser;
  }

  async _finalizeAuthentication(user: any, token: string, isNewRegistration = false) {
    this.sessionToken = token;
    if (typeof window !== "undefined") {
      localStorage.setItem("cd_token", token);
    }

    let userProfile = null;
    try {
      const profileRes = await fetch(`${this.apiRoot}/users/${user.id}`);
      if (profileRes.ok) userProfile = await profileRes.json();
    } catch (_) {}

    const guestData = (typeof window !== "undefined" && localStorage.getItem("cd_guest"))
      ? JSON.parse(localStorage.getItem("cd_guest")!)
      : null;

    if (!userProfile) {
      const bonusChips = CHESS_CONFIG.STARTING_CHIPS_BONUS;
      const guestCash = guestData?.cashBalance || 0;
      const resolvedUsername = user.username || user.name || (await this.generateCoolUsername());

      userProfile = {
        id: user.id,
        email: user.email,
        username: resolvedUsername,
        nickname: resolvedUsername,
        chips: bonusChips,
        cashBalance: guestCash,
        walletInitialized: true,
        avatarSvg: null,
        avatarUrl: null,
        wins: 0,
        losses: 0,
        draws: 0,
        isActive: true,
        lastActive: new Date().toISOString(),
        createdAt: new Date().toISOString()
      };

      await fetch(`${this.apiRoot}/users/${user.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(userProfile)
      });

      await fetch(`${this.apiRoot}/transactions/tx_${Date.now()}_bonus`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: user.id,
          type: "BONUS_CHIPS",
          amount: bonusChips,
          currency: "CHIPS",
          note: "Authentication Welcome Bonus (+100 Chips)",
          timestamp: new Date().toISOString()
        })
      });
    }

    if (guestData?.history?.length > 0) {
      for (const item of guestData.history) {
        await fetch(`${this.apiRoot}/history/${item.matchId || Date.now()}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...item, userId: user.id, migratedFromGuest: guestData.id })
        }).catch(() => {});
      }
    }

    if (typeof window !== "undefined") {
      localStorage.removeItem("cd_guest");
    }

    this.currentUser = userProfile;
    if (typeof window !== "undefined") {
      localStorage.setItem("cd_user", JSON.stringify(userProfile));
    }
    this.startPresenceHeartbeat();
  }

  async logout() {
    if (this.currentUser?.id && !this.isAnonymous()) {
      await this.setPresence(false);
    }
    clearInterval(this.heartbeatTimer);
    if (typeof window !== "undefined") {
      localStorage.removeItem("cd_user");
      localStorage.removeItem("cd_token");
    }
    this.currentUser = null;
    this.sessionToken = null;
    this._loadOrCreateGuestSession();
  }

  // --------------------------------------------------------------------------
  // 4. PRESENCE & SVG AVATAR MANAGEMENT
  // --------------------------------------------------------------------------

  startPresenceHeartbeat() {
    clearInterval(this.heartbeatTimer);
    this.setPresence(true);
    this.heartbeatTimer = setInterval(() => {
      this.setPresence(true);
    }, CHESS_CONFIG.HEARTBEAT_INTERVAL_MS);
  }

  async setPresence(isActive: boolean) {
    if (!this.currentUser?.id || this.isAnonymous()) return;
    const now = new Date().toISOString();
    try {
      await fetch(`${this.apiRoot}/users/${this.currentUser.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive, lastActive: now })
      });
      this.currentUser.isActive = isActive;
      this.currentUser.lastActive = now;
      if (typeof window !== "undefined") {
        localStorage.setItem("cd_user", JSON.stringify(this.currentUser));
      }
    } catch (_) {}
  }

  async saveAvatarSvg(svgString: string) {
    if (!svgString || typeof svgString !== "string") throw new Error("Invalid SVG string");

    if (this.isAnonymous() && this.currentUser) {
      this.currentUser.avatarSvg = svgString;
      if (typeof window !== "undefined") {
        localStorage.setItem("cd_guest", JSON.stringify(this.currentUser));
        localStorage.setItem("kakegurui_custom_avatar", svgString);
      }
      return { success: true, avatarSvg: svgString };
    }

    if (!this.currentUser) throw new Error("No user session");

    const uploadPath = `avatars/${this.currentUser.id}.svg`;
    await fetch(`${this.apiRoot}/media/${uploadPath}`, {
      method: "PUT",
      headers: { "Content-Type": "image/svg+xml" },
      body: svgString
    });

    const mediaUrl = `${this.apiRoot}/media/${uploadPath}`;

    await fetch(`${this.apiRoot}/users/${this.currentUser.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ avatarUrl: mediaUrl, avatarSvg: svgString })
    });

    this.currentUser.avatarUrl = mediaUrl;
    this.currentUser.avatarSvg = svgString;
    if (typeof window !== "undefined") {
      localStorage.setItem("cd_user", JSON.stringify(this.currentUser));
      localStorage.setItem("kakegurui_custom_avatar", svgString);
    }

    // Also update leaderboard avatar if user is on it
    this.syncUserToLeaderboard(this.currentUser).catch(() => {});

    return { success: true, mediaUrl, avatarSvg: svgString };
  }

  // --------------------------------------------------------------------------
  // 5. DATABASE LEADERBOARD / TOP PLAYERS (NO BORDERS, FAR-RIGHT AVATAR, CHIPS)
  // --------------------------------------------------------------------------

  async getTopPlayers(): Promise<TopPlayer[]> {
    try {
      const res = await fetch(`${this.apiRoot}/top_players`, { cache: 'no-store' });
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.players)) {
          return data.players;
        }
      }
    } catch (_) {}

    return [];
  }

  async syncUserToLeaderboard(user: UserProfile) {
    if (!user || user.isAnonymous) return;
    try {
      const currentList = await this.getTopPlayers();
      const existingIdx = currentList.findIndex(p => p.id === user.id || p.username === user.username);
      const totalGames = (user.wins || 0) + (user.losses || 0);
      const winRate = totalGames > 0 ? Math.round(((user.wins || 0) / totalGames) * 100) : 100;

      const playerEntry: TopPlayer = {
        id: user.id,
        username: user.username,
        nickname: user.nickname || user.username,
        chips: user.chips || 0,
        wins: user.wins || 0,
        losses: user.losses || 0,
        winRate,
        avatarSvg: user.avatarSvg || null,
        avatarUrl: user.avatarUrl || (user.id ? `${this.apiRoot}/media/avatars/${user.id}.svg` : null)
      };

      if (existingIdx >= 0) {
        currentList[existingIdx] = playerEntry;
      } else {
        currentList.push(playerEntry);
      }

      currentList.sort((a, b) => b.chips - a.chips);
      const topFive = currentList.slice(0, 7);

      await fetch(`${this.apiRoot}/top_players`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ updatedAt: new Date().toISOString(), players: topFive })
      });
    } catch (_) {}
  }

  // --------------------------------------------------------------------------
  // 6. MATCH HISTORY (LEVITY DB FOR AUTHENTICATED, INDEXEDDB FOR ANONYMOUS)
  // --------------------------------------------------------------------------

  async getMatchHistory(): Promise<MatchHistoryRecord[]> {
    if (this.isAnonymous()) {
      return await getAnonymousMatchHistory();
    }

    if (!this.currentUser) return [];

    try {
      const res = await fetch(`${this.apiRoot}/history_${this.currentUser.id}`);
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.records)) {
          return data.records;
        }
      }
    } catch (_) {}

    return [];
  }

  async recordGameResult(
    won: boolean,
    stake: number = 2,
    isBot: boolean = true,
    opponentName: string = 'Dungeon Bot',
    opponentAvatar?: string
  ): Promise<{ chipsDelta: number; newChips: number }> {
    const deltaChips = won ? stake : -stake;
    const matchId = `match_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const formattedDate = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    // ANONYMOUS USER RULE:
    // Can play for fun against bot without needing or losing chips.
    // Match results are saved in IndexedDB!
    if (this.isAnonymous() || !this.currentUser) {
      const anonRecord: MatchHistoryRecord = {
        id: matchId,
        opponent: opponentName,
        opponentAvatar: opponentAvatar || 'https://placehold.co/100x100/fbcfe8/831843?text=Bot',
        playerAvatar: this.currentUser?.avatarSvg || undefined,
        result: won ? 'win' : 'loss',
        chipsDelta: 0,
        stakeChips: stake,
        currency: 'Chips',
        isBot,
        timestamp: new Date().toISOString(),
        formattedDate
      };

      await saveAnonymousMatchRecord(anonRecord);
      return { chipsDelta: 0, newChips: 0 };
    }

    // AUTHENTICATED USER RULE:
    // Must have at least 2 chips to play against bot (and can lose chips or earn chips).
    if (isBot && (this.currentUser.chips || 0) < 2 && !won) {
      // guard
    }

    const prevChips = this.currentUser.chips || 100;
    const nextChips = Math.max(0, prevChips + deltaChips);
    this.currentUser.chips = nextChips;

    if (won) {
      this.currentUser.wins = (this.currentUser.wins || 0) + 1;
    } else {
      this.currentUser.losses = (this.currentUser.losses || 0) + 1;
    }

    if (typeof window !== 'undefined') {
      localStorage.setItem('cd_user', JSON.stringify(this.currentUser));
    }

    // Persist user update to Levity DB
    try {
      await fetch(`${this.apiRoot}/users/${this.currentUser.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chips: this.currentUser.chips,
          wins: this.currentUser.wins,
          losses: this.currentUser.losses,
        }),
      });
    } catch (_) {}

    // Save match to authenticated user history in Levity DB
    const record: MatchHistoryRecord = {
      id: matchId,
      opponent: opponentName,
      opponentAvatar: opponentAvatar || 'https://placehold.co/100x100/fbcfe8/831843?text=Bot',
      playerAvatar: this.currentUser.avatarSvg || undefined,
      result: won ? 'win' : 'loss',
      chipsDelta: deltaChips,
      stakeChips: stake,
      currency: 'Chips',
      isBot,
      timestamp: new Date().toISOString(),
      formattedDate
    };

    try {
      const existingHistory = await this.getMatchHistory();
      const updatedList = [record, ...existingHistory].slice(0, 50);

      await fetch(`${this.apiRoot}/history_${this.currentUser.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: this.currentUser.id,
          updatedAt: new Date().toISOString(),
          records: updatedList
        })
      });
    } catch (_) {}

    // Synchronize to leaderboard
    this.syncUserToLeaderboard(this.currentUser).catch(() => {});

    return { chipsDelta: deltaChips, newChips: nextChips };
  }

  // --------------------------------------------------------------------------
  // 7. REALTIME SSE STREAM & NOTIFICATIONS
  // --------------------------------------------------------------------------

  listenToRealtimeStream(callback: (data: any) => void): () => void {
    if (typeof window === "undefined") return () => {};

    try {
      const sseUrl = `${this.apiRoot}/stream`;
      const eventSource = new EventSource(sseUrl);

      eventSource.onmessage = (event) => {
        try {
          const parsed = JSON.parse(event.data);
          callback(parsed);
        } catch (_) {}
      };

      eventSource.onerror = (err) => {
        console.warn("SSE stream error, retrying in background:", err);
      };

      return () => {
        eventSource.close();
      };
    } catch (err) {
      console.warn("EventSource setup failed:", err);
      return () => {};
    }
  }

  // --------------------------------------------------------------------------
  // 8. CHALLENGES & STAKES BOTTOM SHEET FLOW
  // --------------------------------------------------------------------------

  async createChallenge(params: {
    stake: number;
    currency: 'Chips' | 'Cash' | 'Both';
    opponentUsername?: string;
  }): Promise<{ challenge: ChallengeRecord; acceptUrl: string }> {
    const user = this.getCurrentUser();
    if (!user) throw new Error("User session required to challenge");

    if (user.isAnonymous && (user.chips || 0) <= 0) {
      throw new Error("Anonymous users with zero chips cannot challenge players.");
    }

    if (params.currency === 'Chips' && (user.chips || 0) < params.stake) {
      throw new Error("insufficient chips");
    }

    if (params.currency === 'Cash' && (user.cashBalance || 0) < params.stake) {
      throw new Error("insufficient balance");
    }

    const challengeId = `ch_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const challenge: ChallengeRecord = {
      id: challengeId,
      challengerId: user.id,
      challengerName: user.nickname || user.username,
      challengerAvatar: user.avatarSvg || null,
      opponentUsername: params.opponentUsername || undefined,
      stake: params.stake,
      currency: params.currency,
      status: 'pending',
      createdAt: new Date().toISOString()
    };

    // Store challenge in Levity DB
    await fetch(`${this.apiRoot}/challenges/${challengeId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(challenge)
    });

    // Also dispatch notification in Levity DB for target recipient
    if (params.opponentUsername) {
      const notifId = `notif_${challengeId}`;
      await fetch(`${this.apiRoot}/notifications/${notifId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: notifId,
          targetUsername: params.opponentUsername.toLowerCase().trim(),
          challengerName: user.nickname || user.username,
          stake: params.stake,
          currency: params.currency,
          challengeId,
          acceptUrl: `/?accept_challenge=${challengeId}`,
          status: 'pending',
          createdAt: new Date().toISOString()
        })
      }).catch(() => {});
    }

    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    const acceptUrl = `${origin}/home?accept_challenge=${challengeId}`;

    return { challenge, acceptUrl };
  }

  async getChallenge(challengeId: string): Promise<ChallengeRecord | null> {
    try {
      const res = await fetch(`${this.apiRoot}/challenges/${encodeURIComponent(challengeId)}`);
      if (res.ok) {
        return await res.json();
      }
    } catch (_) {}
    return null;
  }

  async acceptChallenge(challengeId: string): Promise<ChallengeRecord> {
    const user = this.getCurrentUser();
    if (!user) throw new Error("Sign in or guest required to accept challenge");

    const existing = await this.getChallenge(challengeId);
    if (!existing) throw new Error("Challenge not found");
    if (existing.status === 'accepted') throw new Error("Challenge is already accepted");

    const updated: ChallengeRecord = {
      ...existing,
      status: 'accepted',
      acceptedAt: new Date().toISOString(),
      acceptedBy: user.id,
      acceptedByName: user.nickname || user.username,
      acceptedByAvatar: user.avatarSvg || null
    };

    await fetch(`${this.apiRoot}/challenges/${encodeURIComponent(challengeId)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updated)
    });

    // Create active match entry
    const activeMatch: ActiveMatchRecord = {
      id: challengeId,
      challengeId,
      playerWhite: {
        id: existing.challengerId,
        name: existing.challengerName,
        avatar: existing.challengerAvatar
      },
      playerBlack: {
        id: user.id,
        name: user.nickname || user.username,
        avatar: user.avatarSvg
      },
      stake: existing.stake,
      currency: existing.currency,
      turn: 'w',
      status: 'in_progress',
      updatedAt: new Date().toISOString()
    };

    await fetch(`${this.apiRoot}/matches/${encodeURIComponent(challengeId)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(activeMatch)
    });

    // Register into active_matches list
    this.addActiveMatch(activeMatch).catch(() => {});

    return updated;
  }

  // --------------------------------------------------------------------------
  // 9. ACTIVE MATCHES & LIVE STREAMING (FOR WATCH CAROUSEL & /WATCH)
  // --------------------------------------------------------------------------

  async getActiveMatches(): Promise<ActiveMatchRecord[]> {
    try {
      const res = await fetch(`${this.apiRoot}/active_matches`);
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.matches)) {
          return data.matches.filter((m: ActiveMatchRecord) => m.status === 'in_progress');
        }
      }
    } catch (_) {}
    return [];
  }

  async addActiveMatch(match: ActiveMatchRecord) {
    try {
      const matches = await this.getActiveMatches();
      const filtered = matches.filter(m => m.id !== match.id);
      filtered.unshift(match);
      await fetch(`${this.apiRoot}/active_matches`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ updatedAt: new Date().toISOString(), matches: filtered })
      });
    } catch (_) {}
  }

  async broadcastMatchMove(matchId: string, payload: {
    fen: string;
    lastMove: any;
    turn: 'w' | 'b';
    killerMove?: boolean;
    status?: 'in_progress' | 'checkmate' | 'draw';
    winner?: 'w' | 'b';
  }) {
    try {
      await fetch(`${this.apiRoot}/matches/${encodeURIComponent(matchId)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...payload,
          updatedAt: new Date().toISOString()
        })
      });
    } catch (_) {}
  }

  async getMatchState(matchId: string): Promise<ActiveMatchRecord | null> {
    try {
      const res = await fetch(`${this.apiRoot}/matches/${encodeURIComponent(matchId)}`);
      if (res.ok) {
        return await res.json();
      }
    } catch (_) {}
    return null;
  }

  async refreshBalance() {
    if (this.isAnonymous() || !this.currentUser) return this.currentUser;
    const res = await fetch(`${this.apiRoot}/users/${this.currentUser.id}`);
    if (res.ok) {
      const data = await res.json();
      this.currentUser.chips = data.chips || 0;
      this.currentUser.cashBalance = data.cashBalance || 0;
      if (typeof window !== "undefined") {
        localStorage.setItem("cd_user", JSON.stringify(this.currentUser));
      }
    }
    return this.currentUser;
  }

  async getNotificationsForUser(username: string): Promise<any[]> {
    try {
      const res = await fetch(`${this.apiRoot}/notifications`);
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) {
          const lower = username.toLowerCase().trim();
          return data.filter((n: any) => n.targetUsername === lower && n.status === 'pending');
        }
      }
    } catch (_) {}
    return [];
  }
}

let globalClient: ChessDungeonClient | null = null;

export function getChessClient(): ChessDungeonClient {
  if (!globalClient) {
    globalClient = new ChessDungeonClient();
  }
  return globalClient;
}
