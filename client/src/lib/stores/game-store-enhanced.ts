/**
 * Enhanced game store with improved error handling, performance monitoring,
  * type safety, and advanced state management features.
 */

import { create } from "zustand";
import { GameState, PlayerState, BetAction, isValidBettingRound, isValidPlayerId, isValidGameStatus, MAX_PLAYERS } from "@/types/game-types";
import { registerPlayerIdCallback } from "@/lib/stores/connection-store";
import { 
  createAppError, 
  handleError, 
  ErrorCategory, 
  ErrorSeverity,
  ErrorRecovery 
} from "@/lib/utils/enhanced-error-handling";
import { globalPerformanceMonitor, MetricCategory } from "@/lib/utils/performance-monitor-enhanced";
import { logError, logWarn, logInfo } from "@/lib/utils/logger";

// Constants for game configuration
const MAX_CHIP_VALUE = 1_000_000_000;
const MAX_TIME_REMAINING_MS = 24 * 60 * 60 * 1000;
const MAX_STORE_HISTORY = 100;
const PERFORMANCE_THRESHOLDS = {
  slowGameStateUpdate: 50, // 50ms
  slowPlayerUpdate: 30,    // 30ms
  maxHistoryEntries: 100,
};

// Enhanced interface for game store with history
interface GameHistoryEntry {
  timestamp: number;
  gameState: GameState | null;
  action: string;
  playerId?: string;
}

interface GameStoreEnhanced {
  // State
  gameState: GameState | null;
  isMyTurn: boolean;
  availableActions: BetAction[];
  lastError: string | null;
  cachedPlayerId: string | null;
  isInitialized: boolean;
  
  // Performance tracking
  updateCount: number;
  lastUpdateTime: number | null;
  averageUpdateTime: number;
  
  // History for debugging and debugging
  history: GameHistoryEntry[];
  maxHistory: number;
  
  // Loading state
  isLoading: boolean;
  isProcessingAction: boolean;
  
  // Actions
  setGameState: (gameState: GameState) => void;
  updatePlayer: (playerId: string, updates: Partial<PlayerState>) => void;
  setAvailableActions: (actions: BetAction[]) => void;
  setError: (error: string | null) => void;
  clearError: () => void;
  reset: () => void;
  resetGameState: () => void;
  setCachedPlayerId: (id: string | null) => void;
  
  // Enhanced actions
  updateGameState: (gameState: GameState) => Promise<void>;
  performAction: (action: BetAction, amount?: number) => Promise<boolean>;
  getMyPlayer: () => PlayerState | null;
  getOpponentPlayer: () => PlayerState | null;
  getPlayer: (playerId: string) => PlayerState | null;
  getGameStateSnapshot: () => GameState | null;
  getHistory: () => GameHistoryEntry[];
  clearHistory: () => void;
  setMaxHistory: (max: number) => void;
  
  // Performance monitoring
  getPerformanceMetrics: () => {
    updateCount: number;
    lastUpdateTime: number | null;
    averageUpdateTime: number;
    historySize: number;
  };
  
  // Loading state management
  setLoading: (loading: boolean) => void;
  setProcessingAction: (processing: boolean) => void;
  
  // Validation
  validateGameState: (state: GameState) => boolean;
  validatePlayerState: (player: PlayerState) => boolean;
  validateAvailableActions: (actions: BetAction[]) => boolean;
}

// Enhanced validation functions
function isValidChipValue(value: unknown): value is number {
  return typeof value === 'number' && 
         Number.isFinite(value) && 
         value >= 0 && 
         value <= MAX_CHIP_VALUE;
}

function isValidTimeRemaining(value: unknown): value is number {
  return typeof value === 'number' && 
         Number.isFinite(value) && 
         value >= 0 && 
         value <= MAX_TIME_REMAINING_MS;
}

function isValidGameState(state: unknown): state is GameState {
  if (!state || typeof state !== 'object') return false;

  const s = state as Record<string, unknown>;

  // Structural checks
  if (!Array.isArray(s.players) || s.players.length === 0 || s.players.length > MAX_PLAYERS) return false;
  if (typeof s.pot !== 'number' || !Number.isFinite(s.pot) || s.pot < 0) return false;
  if (typeof s.round !== 'string' || !isValidBettingRound(s.round)) return false;
  if (typeof s.game_status !== 'string' || !isValidGameStatus(s.game_status)) return false;

  // Invariant: min_bet must not exceed max_bet
  if (typeof s.min_bet !== 'number' || typeof s.max_bet !== 'number') return false;
  if (s.min_bet > s.max_bet) return false;

  if (s.current_player !== null && typeof s.current_player !== 'string') return false;
  if (!Array.isArray(s.community_cards) || s.community_cards.length > 5) return false;

  // Boundary checks on player values
  for (let i = 0; i < s.players.length; i++) {
    const p = s.players[i] as Record<string, unknown>;
    if (!p || typeof p !== 'object') return false;
    if (typeof p.player_id !== 'string' || !isValidPlayerId(p.player_id)) return false;
    if (!isValidChipValue(p.chip_stack)) return false;
    if (!Array.isArray(p.hole_cards) || p.hole_cards.length > 2) return false;
  }

  return true;
}

function isValidPlayerState(player: unknown): player is PlayerState {
  if (!player || typeof player !== 'object') return false;

  const p = player as PlayerState;

  return (
    typeof p.player_id === 'string' &&
    isValidPlayerId(p.player_id) &&
    isValidChipValue(p.chip_stack) &&
    Array.isArray(p.hole_cards) &&
    p.hole_cards.length <= 2 &&
    typeof p.position === 'string' &&
    isValidChipValue(p.current_bet) &&
    typeof p.is_active === 'boolean' &&
    typeof p.is_folded === 'boolean' &&
    typeof p.is_all_in === 'boolean' &&
    (p.last_action === undefined || typeof p.last_action === 'string')
  );
}

function deriveAvailableActions(
  gameState: GameState | null,
  cachedPlayerId: string | null
): BetAction[] {
  if (!gameState || !cachedPlayerId) return [];
  if (gameState.current_player !== cachedPlayerId) return [];
  if (gameState.game_status !== "active") return [];
  if (!Array.isArray(gameState.players) || gameState.players.length === 0) return [];

  const myPlayer = gameState.players.find((p) => p.player_id === cachedPlayerId);
  if (!myPlayer || myPlayer.is_folded || myPlayer.is_all_in) return [];

  const actions: BetAction[] = [];
  const bets = gameState.players.map((p) => p.current_bet);
  const highestBet = bets.length > 0 ? Math.max(0, ...bets) : 0;
  const myBet = myPlayer.current_bet;
  const toCall = highestBet - myBet;

  if (toCall === 0) {
    actions.push("check");
  } else {
    actions.push("call");
  }

  if (myPlayer.chip_stack > toCall) {
    actions.push("raise");
  }

  actions.push("fold");

  return actions;
}

// Enhanced game store implementation
export const useGameStore = create<GameStoreEnhanced>((set, get) => ({
  // Initial state
  gameState: null,
  isMyTurn: false,
  availableActions: [],
  lastError: null,
  cachedPlayerId: null,
  isInitialized: false,
  updateCount: 0,
  lastUpdateTime: null,
  averageUpdateTime: 0,
  history: [],
  maxHistory: MAX_STORE_HISTORY,
  isLoading: false,
  isProcessingAction: false,

  // Set game state with enhanced validation and performance tracking
  setGameState: (gameState: GameState): void => {
    const startTime = performance.now();
    
    try {
      if (!isValidGameState(gameState)) {
        const error = createAppError(
          'InvalidGameState',
          'Invalid game state received',
          ErrorCategory.VALIDATION,
          { details: { gameState } }
        );
        logError('Invalid game state received:', error);
        set({ lastError: 'Invalid game state received' });
        return;
      }
      
      const { cachedPlayerId } = get();
      const isMyTurn = cachedPlayerId !== null && gameState.current_player === cachedPlayerId;
      const availableActions = deriveAvailableActions(gameState, cachedPlayerId);
      
      // Add to history
      const historyEntry: GameHistoryEntry = {
        timestamp: Date.now(),
        gameState: { ...gameState },
        action: 'setGameState',
        playerId: cachedPlayerId,
      };
      
      set((state) => ({
        gameState,
        isMyTurn,
        availableActions,
        lastError: null,
        updateCount: state.updateCount + 1,
        lastUpdateTime: performance.now() - startTime,
        averageUpdateTime: (state.averageUpdateTime * state.updateCount + (performance.now() - startTime)) / (state.updateCount + 1),
        history: [...state.history.slice(-state.maxHistory + 1), historyEntry],
        isInitialized: true,
      }));
      
      // Track performance
      globalPerformanceMonitor.trackCustomMetric(
        'gameStateUpdate',
        performance.now() - startTime,
        'ms',
        { category: 'store' }
      );
      
    } catch (error) {
      const appError = handleError(error, {
        category: ErrorCategory.GAME_STATE,
        component: 'GameStore',
        action: 'setGameState',
      });
      
      logError('Error setting game state:', appError);
      set({ lastError: appError.message });
    }
  },

  // Update player with enhanced validation
  updatePlayer: (playerId: string, updates: Partial<PlayerState>): void => {
    const startTime = performance.now();
    
    try {
      set((state) => {
        if (!state.gameState) {
          const error = createAppError(
            'NoGameState',
            'Cannot update player: no game state',
            ErrorCategory.GAME_STATE,
            { details: { playerId, updates } }
          );
          logError('Cannot update player: no game state', error);
          return state;
        }

        // Validate updates
        if (updates.chip_stack !== undefined && !isValidChipValue(updates.chip_stack)) {
          const error = createAppError(
            'InvalidChipValue',
            'Invalid chip_stack value in update',
            ErrorCategory.VALIDATION,
            { details: { playerId, chip_stack: updates.chip_stack } }
          );
          logError('Invalid chip_stack value in update:', error);
          return state;
        }

        if (updates.current_bet !== undefined && !isValidChipValue(updates.current_bet)) {
          const error = createAppError(
            'InvalidBetValue',
            'Invalid current_bet value in update',
            ErrorCategory.VALIDATION,
            { details: { playerId, current_bet: updates.current_bet } }
          );
          logError('Invalid current_bet value in update:', error);
          return state;
        }

        if (updates.time_remaining !== undefined && !isValidTimeRemaining(updates.time_remaining)) {
          const error = createAppError(
            'InvalidTimeValue',
            'Invalid time_remaining value in update',
            ErrorCategory.VALIDATION,
            { details: { playerId, time_remaining: updates.time_remaining } }
          );
          logError('Invalid time_remaining value in update:', error);
          return state;
        }

        const playerExists = state.gameState.players.some(
          (player) => player.player_id === playerId
        );
        if (!playerExists) {
          const error = createAppError(
            'PlayerNotFound',
            'Attempted to update non-existent player',
            ErrorCategory.VALIDATION,
            { details: { playerId } }
          );
          logError('Attempted to update non-existent player:', error);
          return state;
        }

        const updatedPlayers = state.gameState.players.map((player) =>
          player.player_id === playerId ? { ...player, ...updates } : player
        );

        const newGameState = { ...state.gameState, players: updatedPlayers };
        const isMyTurn = newGameState.current_player === state.cachedPlayerId;
        const availableActions = deriveAvailableActions(newGameState, state.cachedPlayerId);

        // Add to history
        const historyEntry: GameHistoryEntry = {
          timestamp: Date.now(),
          gameState: { ...newGameState },
          action: 'updatePlayer',
          playerId,
        };

        return {
          gameState: newGameState,
          isMyTurn,
          availableActions,
          updateCount: state.updateCount + 1,
          lastUpdateTime: performance.now() - startTime,
          averageUpdateTime: (state.averageUpdateTime * state.updateCount + (performance.now() - startTime)) / (state.updateCount + 1),
          history: [...state.history.slice(-state.maxHistory + 1), historyEntry],
        };
      });
      
      // Track performance
      globalPerformanceMonitor.trackCustomMetric(
        'playerUpdate',
        performance.now() - startTime,
        'ms',
        { category: 'store' }
      );
      
    } catch (error) {
      const appError = handleError(error, {
        category: ErrorCategory.GAME_STATE,
        component: 'GameStore',
        action: 'updatePlayer',
      });
      
      logError('Error updating player:', appError);
      set({ lastError: appError.message });
    }
  },

  // Set available actions with validation
  setAvailableActions: (actions: BetAction[]): void => {
    try {
      if (!get().validateAvailableActions(actions)) {
        const error = createAppError(
          'InvalidActions',
          'Invalid available actions provided',
          ErrorCategory.VALIDATION,
          { details: { actions } }
        );
        logError('Invalid available actions provided:', error);
        return;
      }
      
      set({ availableActions: actions });
    } catch (error) {
      const appError = handleError(error, {
        category: ErrorCategory.GAME_STATE,
        component: 'GameStore',
        action: 'setAvailableActions',
      });
      
      logError('Error setting available actions:', appError);
      set({ lastError: appError.message });
    }
  },

  // Error handling
  setError: (error: string | null): void => {
    set({ lastError: error });
    if (error) {
      globalPerformanceMonitor.trackError('gameStoreError', 1);
    }
  },

  clearError: (): void => {
    set({ lastError: null });
  },

  // Reset functionality
  reset: (): void => {
    set({
      gameState: null,
      isMyTurn: false,
      availableActions: [],
      lastError: null,
      cachedPlayerId: null,
      isInitialized: false,
      updateCount: 0,
      lastUpdateTime: null,
      averageUpdateTime: 0,
      history: [],
      isLoading: false,
      isProcessingAction: false,
    });
  },

  resetGameState: (): void => {
    set({
      gameState: null,
      isMyTurn: false,
      availableActions: [],
      lastError: null,
      updateCount: 0,
      lastUpdateTime: null,
      averageUpdateTime: 0,
      history: [],
    });
  },

  // Set cached player ID
  setCachedPlayerId: (id: string | null): void => {
    const { gameState } = get();
    const availableActions = deriveAvailableActions(gameState, id);
    set({ 
      cachedPlayerId: id, 
      availableActions 
    });
    
    // Register callback for player ID changes
    if (id) {
      try {
        registerPlayerIdCallback((newId) => {
          if (newId !== id) {
            get().setCachedPlayerId(newId);
          }
        });
      } catch (error) {
        const appError = handleError(error, {
          category: ErrorCategory.SESSION,
          component: 'GameStore',
          action: 'setCachedPlayerId',
        });
        
        logError('Error registering player ID callback:', appError);
        set({ lastError: appError.message });
      }
    }
  },

  // Enhanced update game state method
  updateGameState: async (gameState: GameState): Promise<void> => {
    const startTime = performance.now();
    
    return new Promise((resolve, reject) => {
      try {
        if (!isValidGameState(gameState)) {
          const error = createAppError(
            'InvalidGameState',
            'Cannot update with invalid game state',
            ErrorCategory.VALIDATION,
            { details: { gameState } }
          );
          logError('Cannot update with invalid game state:', error);
          reject(error);
          return;
        }
        
        get().setGameState(gameState);
        resolve();
      } catch (error) {
        const appError = handleError(error, {
          category: ErrorCategory.GAME_STATE,
          component: 'GameStore',
          action: 'updateGameState',
        });
        
        logError('Error updating game state:', appError);
        reject(appError);
      }
    });
  },

  // Perform action with enhanced error handling
  performAction: async (action: BetAction, amount?: number): Promise<boolean> => {
    const startTime = performance.now();
    const state = get();
    
    try {
      set({ isProcessingAction: true, lastError: null });
      
      // Validate action
      if (!state.availableActions.includes(action)) {
        const error = createAppError(
          'InvalidAction',
          `Cannot perform action: ${action}`,
          ErrorCategory.VALIDATION,
          { details: { action, availableActions: state.availableActions } }
        );
        
        logError('Invalid action performed:', error);
        set({ lastError: error.message, isProcessingAction: false });
        return false;
      }
      
      // Here you would typically send the action to the server
      // For now, we'll just simulate the action
      const success = await ErrorRecovery.retryWithBackoff(
        () => Promise.resolve(true), // Simulate server call
        3,
        1000,
        { category: ErrorCategory.NETWORK, component: 'GameStore', action: 'performAction' }
      );
      
      if (success) {
        // Add to history
        const historyEntry: GameHistoryEntry = {
          timestamp: Date.now(),
          gameState: state.gameState ? { ...state.gameState } : null,
          action,
          playerId: state.cachedPlayerId,
          amount,
        };
        
        set((prevState) => ({
          updateCount: prevState.updateCount + 1,
          lastUpdateTime: performance.now() - startTime,
          averageUpdateTime: (prevState.averageUpdateTime * prevState.updateCount + (performance.now() - startTime)) / (prevState.updateCount + 1),
          history: [...prevState.history.slice(-prevState.maxHistory + 1), historyEntry],
          isProcessingAction: false,
        }));
        
        // Track performance
        globalPerformanceMonitor.trackCustomMetric(
          'performAction',
          performance.now() - startTime,
          'ms',
          { action, category: 'store' }
        );
      }
      
      return success;
      
    } catch (error) {
      const appError = handleError(error, {
        category: ErrorCategory.GAME_STATE,
        component: 'GameStore',
        action: 'performAction',
      });
      
      logError('Error performing action:', appError);
      set({ lastError: appError.message, isProcessingAction: false });
      return false;
    }
  },

  // Player getters
  getMyPlayer: (): PlayerState | null => {
    const state = get();
    if (!state.gameState || !state.cachedPlayerId) return null;
    return state.gameState.players.find((p) => p.player_id === state.cachedPlayerId) || null;
  },

  getOpponentPlayer: (): PlayerState | null => {
    const state = get();
    if (!state.gameState || !state.cachedPlayerId) return null;
    return state.gameState.players.find((p) => p.player_id !== state.cachedPlayerId) || null;
  },

  getPlayer: (playerId: string): PlayerState | null => {
    const state = get();
    if (!state.gameState) return null;
    return state.gameState.players.find((p) => p.player_id === playerId) || null;
  },

  // Get game state snapshot
  getGameStateSnapshot: (): GameState | null => {
    const state = get();
    return state.gameState ? { ...state.gameState } : null;
  },

  // History management
  getHistory: (): GameHistoryEntry[] => {
    return [...get().history];
  },

  clearHistory: (): void => {
    set({ history: [] });
  },

  setMaxHistory: (max: number): void => {
    set({ maxHistory: Math.max(1, max) });
  },

  // Performance metrics
  getPerformanceMetrics: () => {
    const state = get();
    return {
      updateCount: state.updateCount,
      lastUpdateTime: state.lastUpdateTime,
      averageUpdateTime: state.averageUpdateTime,
      historySize: state.history.length,
    };
  },

  // Loading state management
  setLoading: (loading: boolean): void => {
    set({ isLoading: loading });
  },

  setProcessingAction: (processing: boolean): void => {
    set({ isProcessingAction: processing });
  },

  // Validation methods
  validateGameState: (state: unknown): state is GameState => {
    return isValidGameState(state);
  },

  validatePlayerState: (player: unknown): player is PlayerState => {
    return isValidPlayerState(player);
  },

  validateAvailableActions: (actions: unknown): actions is BetAction[] => {
    if (!Array.isArray(actions)) return false;
    return actions.every(action => ['check', 'call', 'raise', 'fold'].includes(action));
  },
}));

// Export selectors
export const gameStateSelector = (state: GameStoreEnhanced): GameState | null =>
  state.gameState;

export const isMyTurnSelector = (state: GameStoreEnhanced): boolean =>
  state.isMyTurn;

export const availableActionsSelector = (state: GameStoreEnhanced): BetAction[] =>
  state.availableActions;

export const lastErrorSelector = (state: GameStoreEnhanced): string | null =>
  state.lastError;

export const cachedPlayerIdSelector = (state: GameStoreEnhanced): string | null =>
  state.cachedPlayerId;

export const performanceMetricsSelector = (state: GameStoreEnhanced) => ({
  updateCount: state.updateCount,
  lastUpdateTime: state.lastUpdateTime,
  averageUpdateTime: state.averageUpdateTime,
  historySize: state.history.length,
});

// Initialize game store
export function initializeGameStore(): () => void {
  if (typeof window === 'undefined') return () => {};
  
  try {
    // Initialize the store with any saved session data
    useGameStore.getState().setInitialized(true);
    
    // Setup periodic performance monitoring
    const interval = setInterval(() => {
      const metrics = useGameStore.getState().getPerformanceMetrics();
      globalPerformanceMonitor.trackCustomMetric(
        'gameStorePerformance',
        metrics.averageUpdateTime,
        'ms',
        { category: 'store' }
      );
    }, 30000);
    
    return () => clearInterval(interval);
  } catch (error) {
    const appError = handleError(error, {
      category: ErrorCategory.SESSION,
      component: 'GameStore',
      action: 'initializeGameStore',
    });
    
    logError('Failed to initialize game store:', appError);
    useGameStore.getState().setInitialized(false);
    return () => {};
  }
}

// Reset game store initialization
export function resetGameStoreInitialization(): void {
  if (typeof window === 'undefined') return;
  
  try {
    useGameStore.getState().reset();
  } catch (error) {
    const appError = handleError(error, {
      category: ErrorCategory.SESSION,
      component: 'GameStore',
      action: 'resetGameStoreInitialization',
    });
    
    logError('Error during game store reset:', appError);
  }
}