// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';

const copied: string[] = [];
vi.mock('../src/components/clipboard', () => ({
  copyText: async (text: string) => {
    copied.push(text);
    return true;
  },
}));

const { Share } = await import('../src/components/Share');

afterEach(() => {
  cleanup();
  copied.length = 0;
  window.history.replaceState(null, '', '/');
});

describe('share', () => {
  it('leaves the tour step out of the embed snippet but keeps it in the link', async () => {
    window.history.replaceState(null, '', '/?view=tray&select=compute-tray.1&tour=3');
    render(<Share />);
    fireEvent.click(screen.getByRole('button', { name: 'Copy embed code' }));
    fireEvent.click(screen.getByRole('button', { name: 'Copy link to this view' }));
    await waitFor(() => expect(copied).toHaveLength(2));
    const embed = copied.find((c) => c.startsWith('<iframe'))!;
    const link = copied.find((c) => !c.startsWith('<iframe'))!;
    expect(embed).toContain('/?view=tray&select=compute-tray.1&embed=1"');
    expect(embed).not.toContain('tour=');
    expect(link).toContain('tour=3');
  });
});
