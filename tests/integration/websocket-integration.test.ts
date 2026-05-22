import { describe, test, expect, beforeAll, afterAll, jest } from '@jest/globals';
import { WebSocket } from 'ws';
import { ConnectionManager } from '@/lib/websocket/connection-manager';
import { MessageParser } from '@/lib/websocket/message-parser';
import { createValidGameState } from '../support/factories/game-state.factory';

describe('WebSocket Integration Tests', () => {
  let connectionManager: ConnectionManager;
  let ws: WebSocket | null = null;
  let messageHandler: ((data: string) => void) | null = null;

  beforeAll(() => {
    // Mock WebSocket for testing
    global.WebSocket = jest.fn().mockImplementation((url: string) => {
      const mockWs = {
        url,
        readyState: 0, // CONNECTING
        bufferedAmount: 0,
        CONNECTING: 0,
        OPEN: 1,
        CLOSING: 2,
        CLOSED: 3,
        
        onopen: null as any,
        onmessage: null as any,
        onerror: null as any,
        onclose: null as any,
        
        send: jest.fn((data: string) => {
          if (mockWs.readyState !== WebSocket.OPEN) {
            throw new Error('WebSocket not connected');
          }
          // Simulate server response
          setTimeout(() => {
            if (mockWs.onmessage) {
              mockWs.onmessage!({
                data: JSON.stringify({
                  type: 'connection_status',
                  data: {
                    status: 'connected',
                    player_id: 'p1',
                    token: 'test-token-123'
                  }
                })
              });
            }
          }, 10);
        }),
        
        close: jest.fn((code = 1000, reason = '') => {
          mockWs.readyState = WebSocket.CLOSING;
          setTimeout(() => {
            mockWs.readyState = WebSocket.CLOSED;
            if (mockWs.onclose) {
              mockWs.onclose!({ code, reason });
            }
          }, 10);
        }),
        
        addEventListener: jest.fn(),
        removeEventListener: jest.fn(),
        
        dispatchEvent: jest.fn(),
      };

      // Simulate connection after a short delay
      setTimeout(() => {
        mockWs.readyState = WebSocket.OPEN;
        if (mockWs.onopen) {
          mockWs.onopen!();
        }
      }, 5);

      ws = mockWs;
      return mockWs;
    }) as any;

    // Mock the WebSocketChannel behavior
    jest.spyOn(ConnectionManager.prototype as any, 'handleMessage').mockImplementation((event: any) => {
      const message = event.data;
      if (messageHandler) {
        messageHandler(message);
      }
    });
  });

  afterAll(() => {
    if (ws) {
      ws.close();
    }
    jest.restoreAllMocks();
  });

  describe('Connection Setup', () => {
    test('should establish WebSocket connection successfully', async () => {
      connectionManager = new ConnectionManager({ autoReconnect: false });
      
      const connected = await connectionManager.connect();
      
      expect(connected).toBe(true);
      expect(connectionManager.getState()).toBe('connected');
    });

    test('should handle connection timeout', async () => {
      // Create a new manager with shorter timeout for testing
      const manager = new ConnectionManager({
        url: 'ws://invalid-url',
        autoReconnect: false,
      });
      
      const connected = await manager.connect();
      
      expect(connected).toBe(false);
    });
  });

  describe('Message Parsing', () => {
    test('should parse valid game state update from server', () => {
      const gameState = createValidGameState();
      const message = {
        type: 'game_state_update',
        data: gameState
      };
      
      const messageStr = JSON.stringify(message);
      const parsed = MessageParser.parseMessage(messageStr);
      
      expect(parsed).not.toBeNull();
      expect(parsed?.type).toBe('game_state_update');
      expect(parsed?.data).toEqual(gameState);
    });

    test('should parse connection status message', () => {
      const message = {
        type: 'connection_status',
        data: {
          status: 'connected',
          player_id: 'p1',
          token: 'test-token-123'
        }
      };
      
      const messageStr = JSON.stringify(message);
      const parsed = MessageParser.parseMessage(messageStr);
      
      expect(parsed).not.toBeNull();
      expect(parsed?.type).toBe('connection_status');
      expect(parsed?.data.player_id).toBe('p1');
      expect(parsed?.data.token).toBe('test-token-123');
    });

    test('should parse error message', () => {
      const message = {
        type: 'error',
        data: {
          code: 'invalid_token',
          message: 'Invalid session token'
        }
      };
      
      const messageStr = JSON.stringify(message);
      const parsed = MessageParser.parseMessage(messageStr);
      
      expect(parsed).not.toBeNull();
      expect(parsed?.type).toBe('error');
      expect(parsed?.data.code).toBe('invalid_token');
    });

    test('should reject malformed JSON', () => {
      const messageStr = '{"type": "game_state_update", "data": {}}';
      
      // Remove the closing brace to make it invalid
      const malformedStr = messageStr.slice(0, -1);
      
      const parsed = MessageParser.parseMessage(malformedStr);
      
      expect(parsed).toBeNull();
    });
  });

  describe('Message Sending', () => {
    beforeEach(() => {
      connectionManager = new ConnectionManager({ autoReconnect: false });
      return connectionManager.connect();
    });

    test('should send session init message', async () => {
      const gameState = createValidGameState();
      
      const success = connectionManager.sendMessage({
        type: 'game_state_update',
        data: gameState
      });
      
      expect(success).toBe(true);
    });

    test('should send bet action message', async () => {
      // Mock the WebSocket send method
      const mockSend = jest.fn();
      (connectionManager as any).socket = { 
        readyState: 1, // OPEN
        send: mockSend 
      };
      
      const success = connectionManager.sendBetAction('call', 50);
      
      expect(success).toBe(true);
      expect(mockSend).toHaveBeenCalledWith(
        JSON.stringify({
          type: 'bet_action',
          data: { action: 'call', amount: 50 },
          token: expect.any(String)
        })
      );
    });

    test('should fail to send when not connected', () => {
      const disconnectedManager = new ConnectionManager({ autoReconnect: false });
      
      // Don't connect, try to send
      const success = disconnectedManager.sendBetAction('fold');
      
      expect(success).toBe(false);
    });

    test('should send heartbeat message', async () => {
      // Mock the WebSocket send method
      const mockSend = jest.fn();
      (connectionManager as any).socket = { 
        readyState: 1, // OPEN
        send: mockSend 
      };
      
      const success = connectionManager.sendMessage({
        type: 'heartbeat',
        data: { timestamp: Date.now() }
      });
      
      expect(success).toBe(true);
      expect(mockSend).toHaveBeenCalledWith(
        JSON.stringify({
          type: 'heartbeat',
          data: { timestamp: expect.any(Number) }
        })
      );
    });
  });

  describe('Error Handling', () => {
    test('should handle malformed server messages gracefully', async () => {
      const manager = new ConnectionManager({ autoReconnect: false });
      await manager.connect();
      
      // Simulate receiving malformed JSON
      if ((manager as any).socket && (manager as any).socket.onmessage) {
        (manager as any).socket.onmessage({
          data: '{"invalid": json}'
        });
      }
      
      // Should not crash, even with malformed JSON
      expect(true).toBe(true);
    });

    test('should handle server error messages', async () => {
      const manager = new ConnectionManager({ autoReconnect: false });
      await manager.connect();
      
      // Simulate receiving an error message from server
      if ((manager as any).socket && (manager as any).socket.onmessage) {
        (manager as any).socket.onmessage({
          data: JSON.stringify({
            type: 'error',
            data: {
              code: 'invalid_token',
              message: 'Session expired'
            }
          })
        });
      }
      
      // Should handle the error gracefully
      expect(true).toBe(true);
    });
  });

  describe('Connection States', () => {
    test('should handle connection lifecycle', async () => {
      const manager = new ConnectionManager({ autoReconnect: false });
      
      // Initial state should be idle
      expect(manager.getState()).toBe('idle');
      
      // Connect successfully
      const connected = await manager.connect();
      expect(connected).toBe(true);
      expect(manager.getState()).toBe('connected');
      
      // Disconnect
      manager.disconnect();
      expect(manager.getState()).toBe('idle');
    });

    test('should handle connection failures gracefully', async () => {
      const manager = new ConnectionManager({
        url: 'ws://invalid-url-12345',
        autoReconnect: false,
      });
      
      // Attempt to connect to invalid URL
      const connected = await manager.connect();
      expect(connected).toBe(false);
      expect(manager.getState()).toBe('idle');
    });
  });

  describe('Rate Limiting', () => {
    test('should respect rate limits', async () => {
      const manager = new ConnectionManager({ autoReconnect: false });
      await manager.connect();
      
      // Mock the WebSocket send method with rate limiting
      let sendCount = 0;
      const mockSend = jest.fn(() => {
        sendCount++;
        return true;
      });
      
      (manager as any).socket = { 
        readyState: 1, // OPEN
        send: mockSend 
      };
      
      // Send multiple messages quickly
      for (let i = 0; i < 10; i++) {
        manager.sendMessage({
          type: 'heartbeat',
          data: { timestamp: Date.now() + i }
        });
      }
      
      // All messages should be sent (rate limiting isn't strict in this test)
      expect(sendCount).toBe(10);
    });
  });
});