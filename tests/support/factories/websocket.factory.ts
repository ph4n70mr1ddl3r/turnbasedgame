import { faker } from '@faker-js/faker';

/**
 * Factory for generating WebSocket session data
 * Uses faker for random but realistic data
 */

export interface WebSocketSession {
  session_token: string;
  connection_id: string;
  created_at: string;
  expires_at: string;
}

export interface WebSocketMessage {
  type: string;
  data: Record<string, unknown>;
  timestamp: number;
}

/**
 * Create a valid WebSocket session with UUIDv4 token
 */
export const createWebSocketSession = (overrides: Partial<WebSocketSession> = {}): WebSocketSession => {
  const now = new Date();
  const expires = new Date(now.getTime() + 30 * 60 * 1000); // 30 minutes from now
  
  return {
    session_token: faker.string.uuid(),
    connection_id: `conn_${faker.string.alphanumeric(16)}`,
    created_at: now.toISOString(),
    expires_at: expires.toISOString(),
    ...overrides,
  };
};

/**
 * Create a batch of WebSocket sessions
 */
export const createWebSocketSessions = (count: number): WebSocketSession[] => {
  return Array.from({ length: count }, () => createWebSocketSession());
};

/**
 * Create a standard WebSocket message with type and data fields
 */
export const createWebSocketMessage = (
  type: string,
  dataOverrides: Record<string, unknown> = {}
): WebSocketMessage => {
  const baseData: Record<string, unknown> = {
    timestamp: faker.date.recent().getTime(),
    ...dataOverrides,
  };
  
  // Add type-specific default data aligned with actual protocol
  switch (type) {
    case 'game_state_update':
      baseData.players = [];
      baseData.community_cards = [];
      baseData.pot = 0;
      baseData.round = 'preflop';
      baseData.game_status = 'waiting';
      break;
    case 'connection_status':
      baseData.status = 'connected';
      baseData.player_id = 'p1';
      break;
    case 'heartbeat':
      baseData.timestamp = Date.now();
      break;
    case 'error':
      baseData.code = 'server_error';
      baseData.message = faker.lorem.sentence();
      break;
    case 'session_init':
      break;
    case 'bet_action':
      baseData.action = 'check';
      break;
    case 'chat_message':
      baseData.player_id = 'p1';
      baseData.message = faker.lorem.sentence();
      break;
  }
  
  return {
    type,
    data: baseData,
    timestamp: Date.now(),
  };
};

/**
 * Create a valid UUIDv4 token for session testing
 */
export const createSessionToken = (): string => {
  return faker.string.uuid();
};

/**
 * Validate a session token is in UUIDv4 format
 */
export const isValidSessionToken = (token: string): boolean => {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(token);
};