/**
 * Shared types for La Base game
 */

export type Suit = 'oros' | 'copas' | 'espadas' | 'bastos';
export type CardValue = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 10 | 11 | 12;

export type Card = {
  suit: Suit;
  value: CardValue;
};

export type GameStructure = 'clasica' | 'alternativa' | 'postpandemia' | 'custom';

export type AcePowers = {
  espadas: boolean;  // Ancho de Espadas kills Ancho de Bastos
  copas: boolean;    // As de Copas changes direction
  oros: boolean;     // As de Oros chooses next Mano
};

export type AssignedTeam = 'nosotros' | 'ellos';
export type Team = AssignedTeam | 'random';

export type Player = {
  id: string;
  name: string;
  team: Team;
  hand: Card[];
  isMano: boolean;
  reconnectToken: string;
  isAuthenticated: boolean;
  userId?: string;
};

export type Bid = {
  team: AssignedTeam;
  value: number;
  isKamikaze: boolean;
  /** who declared it (v2) */
  playerId?: string;
};

export type PlayedCard = {
  playerId: string;
  card: Card;
  order: number;
};

export type PendingOrosChoice = {
  chooserPlayerId: string;
  team: AssignedTeam;
  options: string[];
} | null;

export type InitialDrawCard = {
  playerId: string;
  card: Card;
  order: number;
};

export type InitialDrawState = {
  currentDrawerPlayerId: string | null;
  drawnCards: InitialDrawCard[];
  dealerPlayerId: string | null;
  manoPlayerId: string | null;
  completed: boolean;
};

/**
 * Ready gate (v2): after every base (kind 'base') and every round (kind 'round') the game waits
 * until every connected player confirms, so everybody can read what happened. The base's cards
 * stay on the table meanwhile. For 'round', `round` summarises the round that just ended.
 */
export type RoundSummary = {
  index: number;
  bids: Bid[];
  basesWon: Record<AssignedTeam, number>;
  points: Record<AssignedTeam, number>;
  totals: Record<AssignedTeam, number>;
};

export type ReadyGate = {
  kind: 'base' | 'round';
  readyPlayerIds: string[];
  baseCards: PlayedCard[];
  winnerPlayerId: string;
  winnerTeam: AssignedTeam;
  baseNumber: number;
  basesInRound: number;
  round?: RoundSummary;
};

export type GamePhase =
  | 'lobby'
  | 'config'
  | 'initial_draw'
  | 'round_setup'
  | 'bidding'
  | 'playing'
  | 'base_resolution'
  | 'round_scoring'
  | 'game_over';

export type GameState = {
  phase: GamePhase;
  structure: GameStructure;
  structureSequence: number[];
  roundIndex: number;
  acePowers: AcePowers;
  scores: Record<AssignedTeam, number>;
  bids: Bid[];
  kamikazesRemaining: Record<AssignedTeam, number>;
  playDirection: 'antihorario' | 'horario';
  currentManoPlayerId: string;
  currentTurnPlayerId: string;
  currentBidPlayerId: string | null;
  pendingOrosChoice: PendingOrosChoice;
  currentBaseCards: PlayedCard[];
  basesWon: Record<AssignedTeam, number>;
  lastBaseWinnerPlayerId: string | null;
  kamikazeTeam: AssignedTeam | null;
  initialDraw: InitialDrawState | null;
  readyGate?: ReadyGate | null;
  /** who dealt this round (rotates antihorario every round); the next player is the round's Mano */
  dealerPlayerId?: string | null;
  /** every kamikaze called this game, in order (one metal plane token on the table each) */
  kamikazeCalls?: Array<{ playerId: string; team: AssignedTeam; round: number }>;
  // tied after the last round: two extra rounds with the structure's most bases were appended
  tiebreak?: boolean;
  /** how the Pie may bid (default 'estricta': the sum is one less or one more than the round's bases) */
  pieBidRule?: import('./scoring.js').PieBidRule;
  /** the bidding (chess) clock; null/absent: played without time */
  bidClock?: import('./bidClock.js').BidClock | null;
};

export type GameConfig = {
  structure: GameStructure;
  customStructure?: number[];
  acePowers: AcePowers;
  kamikazesPerTeam: number;
  playerCount: 4 | 6 | 8;
};

export type AuthUser = {
  id: string;
  username: string;
  email: string;
  createdAt: string;
};
