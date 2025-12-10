import { test as base, expect } from '@playwright/test';
import { createWebSocketSession, createSessionToken } from '../factories/websocket.factory';

/**
 * WebSocket test fixtures for Playwright
 * Provides authenticated WebSocket connections and session management
 */

export interface WebSocketFixtures {
  connectedWebSocket: {
    sessionToken: string;
    connectionTime: number;
  };
  disconnectedWebSocket: {
    sessionToken: string;
    disconnectTime: number;
  };
  mockWebSocketServer: {
    url: string;
    messages: Array<{ type: string; data: any }>;
  };
}

export const test = base.extend<WebSocketFixtures>({
  /**
   * Fixture that establishes a WebSocket connection with valid session token
   * Auto-cleans up after test by closing connection
   */
  connectedWebSocket: async ({ page }, use) => {
    // Setup: Mock WebSocket connection in browser context
    await page.route('ws://localhost:8080/ws', async (route) => {
      // In a real test, we would connect to actual WebSocket server
      // For ATDD phase, we mock the connection
      console.log('WebSocket connection attempted to:', route.request().url());
      route.fulfill({
        status: 101, // Switching Protocols
      });
    });

    // Inject session token into localStorage
    const sessionToken = createSessionToken();
    await page.addInitScript((token) => {
      localStorage.setItem('session_token', token);
    }, sessionToken);

    // Navigate to application
    await page.goto('http://localhost:8080');

    // Wait for connection status to show "Connected"
    await expect(page.locator('[data-testid="connection-status"]')).toHaveText('Connected', {
      timeout: 2000,
    });

    // Provide fixture data to test
    await use({
      sessionToken,
      connectionTime: Date.now(),
    });

    // Cleanup: Close connection and clear localStorage
    await page.evaluate(() => {
      localStorage.removeItem('session_token');
      // Close WebSocket if exists
      if (window.__testWebSocket) {
        window.__testWebSocket.close();
      }
    });
  },

  /**
   * Fixture that simulates a disconnected WebSocket state
   */
  disconnectedWebSocket: async ({ page }, use) => {
    // Setup: Simulate network failure
    await page.route('ws://localhost:8080/ws', async (route) => {
      // Simulate connection failure
      route.abort('failed');
    });

    const sessionToken = createSessionToken();
    await page.addInitScript((token) => {
      localStorage.setItem('session_token', token);
    }, sessionToken);

    await page.goto('http://localhost:8080');

    // Wait for connection status to show "Disconnected"
    await expect(page.locator('[data-testid="connection-status"]')).toHaveText('Disconnected', {
      timeout: 2000,
    });

    await use({
      sessionToken,
      disconnectTime: Date.now(),
    });

    // Cleanup
    await page.evaluate(() => {
      localStorage.removeItem('session_token');
    });
  },

  /**
   * Fixture that provides a mock WebSocket server for testing
   * Records messages sent by client and allows sending responses
   */
  mockWebSocketServer: async ({ page }, use) => {
    const messages: Array<{ type: string; data: any }> = [];
    
    // Setup WebSocket interception
    await page.route('ws://localhost:8080/ws', async (route) => {
      // Capture WebSocket upgrade request
      const request = route.request();
      console.log('WebSocket connection to:', request.url());
      
      // In a real implementation, we would use Playwright's WebSocket support
      // For ATDD phase, we just record the attempt
      messages.push({
        type: 'connection_attempt',
        data: { url: request.url(), headers: request.headers() },
      });
      
      // Continue with actual connection (will fail in ATDD phase)
      route.continue();
    });

    await use({
      url: 'ws://localhost:8080/ws',
      messages,
    });

    // No cleanup needed for mock server
  },
});

export { expect };