/**
 * InputState - Manages runtime input values from faders and buttons
 *
 * This is the source of truth for all user input during graph evaluation.
 * Values are set via WebSocket messages and read during each frame tick.
 */

export interface ButtonState {
  down: boolean;
  pressedThisFrame: boolean;
  releasedThisFrame: boolean;
}

export class InputState {
  private faderValues = new Map<string, number>();
  private buttonStates = new Map<string, ButtonState>();

  // Track buttons that changed this frame (for Trigger outputs)
  private buttonsPressed = new Set<string>();
  private buttonsReleased = new Set<string>();

  /**
   * Set a fader value (0-1)
   */
  setFader(faderId: string, value: number): void {
    this.faderValues.set(faderId, Math.max(0, Math.min(1, value)));
  }

  /**
   * Get a fader value (defaults to 0 if not set)
   */
  getFader(faderId: string): number {
    return this.faderValues.get(faderId) ?? 0;
  }

  /**
   * Set button down state
   */
  setButtonDown(buttonId: string, down: boolean): void {
    const current = this.buttonStates.get(buttonId) ?? {
      down: false,
      pressedThisFrame: false,
      releasedThisFrame: false,
    };

    if (down && !current.down) {
      // Button just pressed
      this.buttonsPressed.add(buttonId);
    } else if (!down && current.down) {
      // Button just released
      this.buttonsReleased.add(buttonId);
    }

    this.buttonStates.set(buttonId, {
      down,
      pressedThisFrame: down && !current.down,
      releasedThisFrame: !down && current.down,
    });
  }

  /**
   * Check if button is currently held down
   */
  isButtonDown(buttonId: string): boolean {
    return this.buttonStates.get(buttonId)?.down ?? false;
  }

  /**
   * Check if button was pressed this frame (trigger event)
   */
  wasButtonPressed(buttonId: string): boolean {
    return this.buttonsPressed.has(buttonId);
  }

  /**
   * Check if button was released this frame
   */
  wasButtonReleased(buttonId: string): boolean {
    return this.buttonsReleased.has(buttonId);
  }

  /**
   * Clear per-frame state (call at end of each tick)
   */
  endFrame(): void {
    // Clear edge-triggered events
    this.buttonsPressed.clear();
    this.buttonsReleased.clear();

    // Update button states to clear per-frame flags
    for (const [id, state] of this.buttonStates) {
      if (state.pressedThisFrame || state.releasedThisFrame) {
        this.buttonStates.set(id, {
          down: state.down,
          pressedThisFrame: false,
          releasedThisFrame: false,
        });
      }
    }
  }

  /**
   * Get all fader IDs that have been set
   */
  getFaderIds(): string[] {
    return [...this.faderValues.keys()];
  }

  /**
   * Get all button IDs that have been set
   */
  getButtonIds(): string[] {
    return [...this.buttonStates.keys()];
  }

  /**
   * Snapshot all fader values (for frame output)
   */
  snapshotFaders(): Record<string, number> {
    return Object.fromEntries(this.faderValues);
  }

  /**
   * Snapshot all button states (for frame output)
   */
  snapshotButtons(): Record<string, boolean> {
    const result: Record<string, boolean> = {};
    for (const [id, state] of this.buttonStates) {
      result[id] = state.down;
    }
    return result;
  }
}
