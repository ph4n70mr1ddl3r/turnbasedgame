import { render, screen } from '@testing-library/react';
import { describe, test, expect, jest, beforeEach } from '@jest/globals';
import { ConnectionStatus } from '@/components/ui/ConnectionStatus';
import { ConnectionStatus as ConnectionStatusType } from '@/types/game-types';

jest.mock('@/lib/stores/connection-store', () => ({
  useConnectionStore: jest.fn(),
  connectionStatusSelector: jest.fn((s) => s.status),
  isConnectedSelector: jest.fn((s) => s.isConnected),
  latencySelector: jest.fn((s) => s.latency),
  sessionTokenSelector: jest.fn((s) => s.sessionToken),
  playerIdSelector: jest.fn((s) => s.playerId),
}));

import { useConnectionStore } from '@/lib/stores/connection-store';

const mockUseConnectionStore = useConnectionStore as jest.MockedFunction<typeof useConnectionStore>;

interface MockConnectionState {
  isConnected: boolean;
  status: ConnectionStatusType;
  latency: number | null;
  sessionToken: string | null;
  playerId: string | null;
  setStatus: jest.Mock;
  setConnected: jest.Mock;
  updateHeartbeat: jest.Mock;
  setLatency: jest.Mock;
  setSession: jest.Mock;
  clearSession: jest.Mock;
  reset: jest.Mock;
}

describe('Story 1.2: Connection Status Display Component', () => {
  const createMockStore = (state: {
    isConnected: boolean;
    status: ConnectionStatusType;
    latency: number | null;
  }) => {
    mockUseConnectionStore.mockImplementation((selector: (s: MockConnectionState) => unknown) => {
      const fullState: MockConnectionState = {
        ...state,
        sessionToken: null,
        playerId: null,
        setStatus: jest.fn(),
        setConnected: jest.fn(),
        updateHeartbeat: jest.fn(),
        setLatency: jest.fn(),
        setSession: jest.fn(),
        clearSession: jest.fn(),
        reset: jest.fn(),
      };
      if (typeof selector === 'function') {
        return selector(fullState);
      }
      return fullState;
    });
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('should display "Connected" status with green color when connected', () => {
    createMockStore({ isConnected: true, status: 'connected', latency: 50 });

    render(<ConnectionStatus />);
    
    expect(screen.getByTestId('connection-status')).toHaveTextContent('Connected');
    
    const icon = screen.getByTestId('connection-status-icon');
    expect(icon).toHaveClass('bg-green-500');
  });

  test('should display "Disconnected" status with red color when disconnected', () => {
    createMockStore({ isConnected: false, status: 'disconnected', latency: null });

    render(<ConnectionStatus />);
    
    expect(screen.getByTestId('connection-status')).toHaveTextContent('Disconnected');
    
    const icon = screen.getByTestId('connection-status-icon');
    expect(icon).toHaveClass('bg-red-500');
  });

  test('should display "Reconnecting..." status with yellow color when reconnecting', () => {
    createMockStore({ isConnected: false, status: 'reconnecting', latency: null });

    render(<ConnectionStatus />);
    
    expect(screen.getByTestId('connection-status')).toHaveTextContent('Reconnecting...');
    
    const icon = screen.getByTestId('connection-status-icon');
    expect(icon).toHaveClass('bg-yellow-500');
  });

  test('should display checkmark icon when connected', () => {
    createMockStore({ isConnected: true, status: 'connected', latency: 50 });

    render(<ConnectionStatus />);
    
    const icon = screen.getByTestId('connection-status-icon');
    expect(icon).toHaveAttribute('aria-label', 'Connected');
  });

  test('should display warning icon when disconnected', () => {
    createMockStore({ isConnected: false, status: 'disconnected', latency: null });

    render(<ConnectionStatus />);
    
    const icon = screen.getByTestId('connection-status-icon');
    expect(icon).toHaveAttribute('aria-label', 'Disconnected');
  });

  test('should have proper ARIA labels for screen readers', () => {
    createMockStore({ isConnected: true, status: 'connected', latency: 50 });

    render(<ConnectionStatus />);
    
    const container = screen.getByTestId('connection-status-container');
    expect(container).toHaveAttribute('role', 'status');
    expect(container).toHaveAttribute('aria-live', 'polite');
    expect(container).toHaveAttribute('aria-atomic', 'true');
  });
});