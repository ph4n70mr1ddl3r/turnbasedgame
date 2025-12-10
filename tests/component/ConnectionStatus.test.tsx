import { render, screen } from '@testing-library/react';
import { describe, test, expect, jest } from '@jest/globals';
import { ConnectionStatus } from '@/components/ui/ConnectionStatus';

// Mock the useWebSocket hook
jest.mock('@/hooks/useWebSocket', () => ({
  useWebSocket: jest.fn()
}));

import { useWebSocket } from '@/hooks/useWebSocket';

describe('Story 1.2: Connection Status Display Component', () => {
  const mockUseWebSocket = useWebSocket as jest.MockedFunction<typeof useWebSocket>;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('should display "Connected" status with green color when connected', () => {
    // GIVEN: Mock useWebSocket returns connected state
    mockUseWebSocket.mockReturnValue({
      isConnected: true,
      connectionStatus: 'connected',
      latency: 50,
      sessionToken: 'token',
      playerId: 'player1',
      // other properties not needed for test
    } as any);

    // WHEN: Render component
    render(<ConnectionStatus />);
    
    // THEN: Text "Connected" is displayed
    expect(screen.getByTestId('connection-status')).toHaveTextContent('Connected');
    
    // AND: Icon has green color class
    const icon = screen.getByTestId('connection-status-icon');
    expect(icon).toHaveClass('bg-green-500');
  });

  test('should display "Disconnected" status with red color when disconnected', () => {
    // GIVEN: Mock useWebSocket returns disconnected state
    mockUseWebSocket.mockReturnValue({
      isConnected: false,
      connectionStatus: 'disconnected',
      latency: null,
      sessionToken: null,
      playerId: null,
    } as any);

    // WHEN: Render component
    render(<ConnectionStatus />);
    
    // THEN: Text "Disconnected" is displayed
    expect(screen.getByTestId('connection-status')).toHaveTextContent('Disconnected');
    
    // AND: Icon has red color class
    const icon = screen.getByTestId('connection-status-icon');
    expect(icon).toHaveClass('bg-red-500');
  });

  test('should display "Reconnecting..." status with yellow color when reconnecting', () => {
    // GIVEN: Mock useWebSocket returns reconnecting state
    mockUseWebSocket.mockReturnValue({
      isConnected: false,
      connectionStatus: 'reconnecting',
      latency: null,
      sessionToken: null,
      playerId: null,
    } as any);

    // WHEN: Render component
    render(<ConnectionStatus />);
    
    // THEN: Text "Reconnecting..." is displayed
    expect(screen.getByTestId('connection-status')).toHaveTextContent('Reconnecting...');
    
    // AND: Icon has yellow color class
    const icon = screen.getByTestId('connection-status-icon');
    expect(icon).toHaveClass('bg-yellow-500');
  });

  test('should display checkmark icon when connected', () => {
    // GIVEN: Mock useWebSocket returns connected state
    mockUseWebSocket.mockReturnValue({
      isConnected: true,
      connectionStatus: 'connected',
      latency: 50,
      sessionToken: 'token',
      playerId: 'player1',
    } as any);

    // WHEN: Render component
    render(<ConnectionStatus />);
    
    // THEN: Checkmark icon is visible (aria-label)
    const icon = screen.getByTestId('connection-status-icon');
    expect(icon).toHaveAttribute('aria-label', 'Connected');
  });

  test('should display warning icon when disconnected', () => {
    // GIVEN: Mock useWebSocket returns disconnected state
    mockUseWebSocket.mockReturnValue({
      isConnected: false,
      connectionStatus: 'disconnected',
      latency: null,
      sessionToken: null,
      playerId: null,
    } as any);

    // WHEN: Render component
    render(<ConnectionStatus />);
    
    // THEN: Warning icon is visible (aria-label)
    const icon = screen.getByTestId('connection-status-icon');
    expect(icon).toHaveAttribute('aria-label', 'Disconnected');
  });

  test('should have proper ARIA labels for screen readers', () => {
    // GIVEN: Mock useWebSocket returns connected state
    mockUseWebSocket.mockReturnValue({
      isConnected: true,
      connectionStatus: 'connected',
      latency: 50,
      sessionToken: 'token',
      playerId: 'player1',
    } as any);

    // WHEN: Render component
    render(<ConnectionStatus />);
    
    // THEN: Container has appropriate ARIA role and live region attributes
    const container = screen.getByTestId('connection-status-container');
    expect(container).toHaveAttribute('role', 'status');
    expect(container).toHaveAttribute('aria-live', 'polite');
    expect(container).toHaveAttribute('aria-atomic', 'true');
  });

  // Note: WCAG AA contrast ratio test requires automated contrast checking tools (axe-core)
  // This would be integration test with axe-core, not unit test
});