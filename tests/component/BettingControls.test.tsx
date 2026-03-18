import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, test, expect, jest, beforeEach, afterEach } from '@jest/globals';
import { BettingControls } from '@/components/poker-table/BettingControls';
import { BetAction } from '@/types/game-types';

describe('BettingControls Component', () => {
  const mockOnBetAction = jest.fn<(action: BetAction, amount?: number) => void>();

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  const defaultProps = {
    isMyTurn: true,
    availableActions: ['check', 'call', 'raise', 'fold'] as BetAction[],
    onBetAction: mockOnBetAction,
    minBet: 50,
    maxBet: 1500,
  };

  describe('when not player turn', () => {
    test('should display waiting message when not player turn', () => {
      render(<BettingControls {...defaultProps} isMyTurn={false} />);

      expect(screen.getByText(/waiting for opponent/i)).toBeInTheDocument();
    });

    test('should not show action buttons when not player turn', () => {
      render(<BettingControls {...defaultProps} isMyTurn={false} />);

      expect(screen.queryByRole('button', { name: /check/i })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /call/i })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /raise/i })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /fold/i })).not.toBeInTheDocument();
    });
  });

  describe('when player turn', () => {
    test('should display all available action buttons', () => {
      render(<BettingControls {...defaultProps} />);

      expect(screen.getByRole('button', { name: /check your hand/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /call the current bet/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /open raise amount input/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /fold your hand/i })).toBeInTheDocument();
    });

    test('should only display available actions', () => {
      render(
        <BettingControls
          {...defaultProps}
          availableActions={['check', 'fold'] as BetAction[]}
        />
      );

      expect(screen.getByRole('button', { name: /check/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /fold/i })).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /call/i })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /raise/i })).not.toBeInTheDocument();
    });

    test('should call onBetAction with check when Check button clicked', () => {
      render(<BettingControls {...defaultProps} />);

      fireEvent.click(screen.getByRole('button', { name: /check your hand/i }));

      expect(mockOnBetAction).toHaveBeenCalledWith('check');
    });

    test('should call onBetAction with call when Call button clicked', () => {
      render(<BettingControls {...defaultProps} />);

      fireEvent.click(screen.getByRole('button', { name: /call the current bet/i }));

      expect(mockOnBetAction).toHaveBeenCalledWith('call');
    });

    test('should call onBetAction with fold when Fold button clicked', () => {
      render(<BettingControls {...defaultProps} />);

      fireEvent.click(screen.getByRole('button', { name: /fold your hand/i }));

      expect(mockOnBetAction).toHaveBeenCalledWith('fold');
    });

    test('should display min and max bet information', () => {
      render(<BettingControls {...defaultProps} />);

      expect(screen.getByText(/min bet: 50/i)).toBeInTheDocument();
      expect(screen.getByText(/max bet: 1500/i)).toBeInTheDocument();
    });
  });

  describe('raise functionality', () => {
    test('should show raise input when Raise button clicked', () => {
      render(<BettingControls {...defaultProps} />);

      fireEvent.click(screen.getByRole('button', { name: /open raise amount input/i }));

      expect(screen.getByLabelText(/raise amount/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /raise by 50 chips/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /cancel raise/i })).toBeInTheDocument();
    });

    test('should hide raise input when Cancel clicked', () => {
      render(<BettingControls {...defaultProps} />);

      fireEvent.click(screen.getByRole('button', { name: /open raise amount input/i }));
      expect(screen.getByRole('textbox', { name: /raise amount/i })).toBeInTheDocument();

      fireEvent.click(screen.getByRole('button', { name: /cancel raise/i }));

      expect(screen.queryByRole('textbox', { name: /raise amount/i })).not.toBeInTheDocument();
      expect(screen.getByRole('button', { name: /open raise amount input/i })).toBeInTheDocument();
    });

    test('should update raise amount when input changes', () => {
      render(<BettingControls {...defaultProps} />);

      fireEvent.click(screen.getByRole('button', { name: /open raise amount input/i }));

      const input = screen.getByLabelText(/raise amount/i);
      fireEvent.change(input, { target: { value: '100' } });

      expect(screen.getByRole('button', { name: /raise by 100 chips/i })).toBeInTheDocument();
    });

    test('should reject values above maxBet on change', () => {
      render(<BettingControls {...defaultProps} minBet={50} maxBet={500} />);

      fireEvent.click(screen.getByRole('button', { name: /open raise amount input/i }));

      const input = screen.getByLabelText(/raise amount/i) as HTMLInputElement;
      fireEvent.change(input, { target: { value: '1000' } });

      expect(input.value).toBe('50');
    });

    test('should clamp raise amount to minBet when blurred below minimum', () => {
      render(<BettingControls {...defaultProps} />);

      fireEvent.click(screen.getByRole('button', { name: /open raise amount input/i }));

      const input = screen.getByLabelText(/raise amount/i) as HTMLInputElement;
      fireEvent.change(input, { target: { value: '10' } });
      fireEvent.blur(input);

      expect(input.value).toBe('50');
    });

    test('should cancel raise on Escape key', () => {
      render(<BettingControls {...defaultProps} />);

      fireEvent.click(screen.getByRole('button', { name: /open raise amount input/i }));
      expect(screen.getByRole('textbox', { name: /raise amount/i })).toBeInTheDocument();

      const input = screen.getByRole('textbox', { name: /raise amount/i });
      fireEvent.keyDown(input, { key: 'Escape' });

      expect(screen.queryByRole('textbox', { name: /raise amount/i })).not.toBeInTheDocument();
    });
  });

  describe('quick raise buttons', () => {
    test('should show quick raise options when raise input is open', () => {
      render(<BettingControls {...defaultProps} minBet={100} maxBet={1000} />);

      fireEvent.click(screen.getByRole('button', { name: /open raise amount input/i }));

      expect(screen.getByText(/quick raise/i)).toBeInTheDocument();
    });

    test('should show All-in label for max bet quick raise', () => {
      render(<BettingControls {...defaultProps} minBet={100} maxBet={1000} />);

      fireEvent.click(screen.getByRole('button', { name: /open raise amount input/i }));

      expect(screen.getByRole('button', { name: /go all-in/i })).toBeInTheDocument();
    });
  });

  describe('accessibility', () => {
    test('should have proper aria labels for action buttons', () => {
      render(<BettingControls {...defaultProps} />);

      expect(screen.getByRole('button', { name: /check your hand/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /call the current bet/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /fold your hand/i })).toBeInTheDocument();
    });

    test('should have aria-busy attribute when processing', () => {
      render(<BettingControls {...defaultProps} />);

      const container = document.querySelector('[aria-busy]');
      expect(container).toBeInTheDocument();
      expect(container).toHaveAttribute('aria-busy', 'false');
    });

    test('should have aria-label for quick raise group', () => {
      render(<BettingControls {...defaultProps} />);

      fireEvent.click(screen.getByRole('button', { name: /open raise amount input/i }));

      expect(screen.getByRole('group', { name: /quick raise options/i })).toBeInTheDocument();
    });
  });

  describe('edge cases', () => {
    test('should handle empty availableActions array', () => {
      render(<BettingControls {...defaultProps} availableActions={[]} />);

      expect(screen.getByText(/no actions available/i)).toBeInTheDocument();
    });

    test('should handle minBet equal to maxBet', () => {
      render(<BettingControls {...defaultProps} minBet={500} maxBet={500} />);

      fireEvent.click(screen.getByRole('button', { name: /open raise amount input/i }));

      const input = screen.getByLabelText(/raise amount/i) as HTMLInputElement;
      expect(input.value).toBe('500');
    });

    test('should update raiseAmountInput when minBet prop changes', () => {
      const { rerender } = render(<BettingControls {...defaultProps} minBet={50} />);

      fireEvent.click(screen.getByRole('button', { name: /open raise amount input/i }));

      rerender(<BettingControls {...defaultProps} minBet={100} />);

      const input = screen.getByLabelText(/raise amount/i) as HTMLInputElement;
      expect(input.value).toBe('100');
    });
  });
});
