import { afterEach, describe, expect, test, vi } from 'vitest';
import { haptic, setHaptics } from './haptics';

afterEach(() => {
  setHaptics(null);
  vi.unstubAllGlobals();
});

describe('haptic', () => {
  test("uses the host's haptics once installed, and not the vibration", () => {
    const vibrate = vi.fn();
    vi.stubGlobal('navigator', { vibrate });
    const host = vi.fn();
    setHaptics(host);
    haptic();
    expect(host).toHaveBeenCalledWith('light');
    expect(vibrate).not.toHaveBeenCalled();
  });

  test('falls back to a short vibration without them', () => {
    const vibrate = vi.fn();
    vi.stubGlobal('navigator', { vibrate });
    haptic('light');
    expect(vibrate).toHaveBeenCalledWith(10);
  });

  test('does nothing where there is neither, and never throws', () => {
    vi.stubGlobal('navigator', {});
    expect(() => haptic()).not.toThrow();
    setHaptics(() => {
      throw new Error('no engine');
    });
    expect(() => haptic()).not.toThrow();
  });
});
