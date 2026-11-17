import { expect, test, type Page } from '@playwright/test';

/** Wait until the 3D rack has mounted: its six group labels are in the DOM. */
async function rackReady(page: Page) {
  await expect(page.locator('.group-label')).toHaveCount(6, { timeout: 60_000 });
}

const param = (page: Page, key: string) => new URL(page.url()).searchParams.get(key);

test.describe('rack', () => {
  test('loads the 3D rack without errors', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
    await page.goto('/');
    await rackReady(page);
    await expect(page.locator('canvas')).toBeVisible();
    await expect(page.getByRole('heading', { level: 2 })).toContainText('DGX Vera Rubin NVL72 rack');
    expect(errors).toEqual([]);
  });

  test('group labels do not overlap when zoomed out', async ({ page }) => {
    // A short window squeezes the rack, so its labels collide once zoomed out.
    await page.setViewportSize({ width: 1280, height: 480 });
    await page.goto('/');
    await rackReady(page);
    const box = (await page.locator('canvas').boundingBox())!;
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    for (let i = 0; i < 10; i++) await page.mouse.wheel(0, 400);
    await expect
      .poll(async () => {
        const rects = await page.locator('.group-label span').evaluateAll((els) =>
          els
            .filter((el) => getComputedStyle(el).visibility !== 'hidden')
            .map((el) => el.getBoundingClientRect())
            .filter((r) => r.width > 0 && r.height > 0)
            .map((r) => ({ x: r.left, y: r.top, w: r.width, h: r.height })),
        );
        let clashes = 0;
        for (let i = 0; i < rects.length; i++)
          for (let j = i + 1; j < rects.length; j++) {
            const a = rects[i]!;
            const b = rects[j]!;
            if (a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h) clashes++;
          }
        return { clashes, visible: rects.length > 0 };
      })
      .toEqual({ clashes: 0, visible: true });
  });

  test('a real click on the canvas selects a rack unit', async ({ page }) => {
    await page.goto('/');
    await rackReady(page);
    const box = (await page.locator('canvas').boundingBox())!;
    // The rack stands in the middle of the stage; its centre is a compute or switch tray.
    await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
    await expect.poll(() => param(page, 'select')).toMatch(/^(compute-tray|switch-tray|power-shelf|tor-switch)\.\d+$/);
  });

  for (const side of ['front', 'rear'] as const) {
    test(`hovering a rack unit names it (${side})`, async ({ page }) => {
      await page.goto('/');
      await rackReady(page);
      if (side === 'rear') await page.getByRole('button', { name: 'Rear', exact: true }).click();
      const box = (await page.locator('canvas').boundingBox())!;
      const label = page.locator('.unit-hover-label span');
      // From the rear, rear parts stand in front of some trays: sweep across until the pointer is on a unit.
      for (const f of [0.5, 0.55, 0.6, 0.45, 0.65]) {
        await page.mouse.move(box.x + box.width * f, box.y + box.height / 2);
        // The tag mounts a frame or two after the move, so wait briefly at each position.
        if (await label.waitFor({ state: 'attached', timeout: 1500 }).then(() => true, () => false)) break;
      }
      await expect(label).toHaveText(/^(Compute tray|NVLink 6 switch tray|Power shelf|Top-of-rack Ethernet switch) \d+$/);
      await page.mouse.move(box.x + 5, box.y + 5);
      await expect(page.locator('.unit-hover-label')).toHaveCount(0);
    });
  }

  test('hovering a tray part names it', async ({ page }) => {
    // No moving dots: the software renderer in CI then answers each pointer move quickly.
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/?select=compute-tray.3&view=tray');
    await expect(page.locator('.tray-label')).toHaveCount(2, { timeout: 60_000 });
    // Connections sit over some parts and show their own card, so hide them for this sweep.
    await page.getByRole('button', { name: 'Connections', exact: true }).click();
    const box = (await page.locator('canvas').boundingBox())!;
    const label = page.locator('.part-tooltip span');
    let found = false;
    for (const fy of [0.5, 0.45, 0.55, 0.4, 0.6]) {
      for (const fx of [0.5, 0.4, 0.6, 0.3, 0.7]) {
        await page.mouse.move(box.x + box.width * fx, box.y + box.height * fy);
        if (await label.waitFor({ state: 'attached', timeout: 800 }).then(() => true, () => false)) {
          found = true;
          break;
        }
      }
      if (found) break;
    }
    await expect(label).toHaveText(/\S/);
    await page.mouse.move(box.x + 5, box.y + 5);
    await expect(page.locator('.part-tooltip')).toHaveCount(0);
  });

  test('a part name tag goes when the Parts layer is turned off by keyboard under the pointer', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/?select=compute-tray.3&view=tray');
    await expect(page.locator('.tray-label')).toHaveCount(2, { timeout: 60_000 });
    await page.getByRole('button', { name: 'Connections', exact: true }).click();
    const box = (await page.locator('canvas').boundingBox())!;
    const label = page.locator('.part-tooltip span');
    let found = false;
    for (const fy of [0.5, 0.45, 0.55, 0.4, 0.6]) {
      for (const fx of [0.5, 0.4, 0.6, 0.3, 0.7]) {
        await page.mouse.move(box.x + box.width * fx, box.y + box.height * fy);
        if (await label.waitFor({ state: 'attached', timeout: 800 }).then(() => true, () => false)) {
          found = true;
          break;
        }
      }
      if (found) break;
    }
    expect(found).toBe(true);
    // The pointer stays where it is; only the keyboard turns the layer off.
    await page.getByRole('button', { name: 'Parts', exact: true }).focus();
    await page.keyboard.press('Space');
    await expect(page.getByRole('button', { name: 'Parts', exact: true })).toHaveAttribute('aria-pressed', 'false');
    await expect(page.locator('.part-tooltip')).toHaveCount(0);
  });

  test('Show in 3D on a hidden kind shows that kind again and draws the pin', async ({ page }) => {
    await page.goto('/?select=compute-tray.3/vera-cpu.1&view=tray&lk=clink');
    await expect(page.locator('.tray-label')).toHaveCount(2, { timeout: 60_000 });
    const clink = page.locator('.link-legend').getByRole('button', { name: 'Clink (CPU to CPU)', exact: true });
    await expect(clink).toHaveAttribute('aria-pressed', 'false');
    const show = page.getByRole('button', { name: /^Show in 3D: Clink/ }).first();
    await show.click();
    await expect(show).toHaveAttribute('aria-pressed', 'true');
    await expect(clink).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('.link-card.pinned')).toBeVisible();
    await expect.poll(() => param(page, 'lk')).toBeNull();
  });

  test('the legend hides and shows connection kinds and keeps it in the URL', async ({ page }) => {
    await page.goto('/?select=compute-tray.3&view=tray');
    await expect(page.locator('.tray-label')).toHaveCount(2, { timeout: 60_000 });
    const pcie = page.locator('.link-legend').getByRole('button', { name: 'PCIe', exact: true });
    await expect(pcie).toHaveAttribute('aria-pressed', 'true');
    await pcie.click();
    await expect(pcie).toHaveAttribute('aria-pressed', 'false');
    await expect.poll(() => param(page, 'lk')).toBe('pcie');
    await page.reload();
    await expect(page.locator('.link-legend').getByRole('button', { name: 'PCIe', exact: true })).toHaveAttribute('aria-pressed', 'false');
    await page.locator('.link-legend').getByRole('button', { name: 'Show all' }).click();
    await expect.poll(() => param(page, 'lk')).toBeNull();
    await expect(page.locator('.link-legend').getByRole('button', { name: 'PCIe', exact: true })).toHaveAttribute('aria-pressed', 'true');
  });

  test('hovering a connection shows its card, and a click pins it in the panel', async ({ page }) => {
    // No moving dots: the software renderer in CI then answers each pointer move quickly.
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/?select=compute-tray.3&view=tray');
    await expect(page.locator('.tray-label')).toHaveCount(2, { timeout: 60_000 });
    // Only coolant left, drawn as thick pipes, so the sweep finds one quickly.
    for (const k of ['PCIe', 'C2C (CPU to GPU)', 'Clink (CPU to CPU)', 'NVLink (to the cable cartridge)', 'Power'])
      await page.locator('.link-legend').getByRole('button', { name: k, exact: true }).click();
    const box = (await page.locator('canvas').boundingBox())!;
    const card = page.locator('.link-card');
    let at: { x: number; y: number } | null = null;
    for (let fy = 0.3; fy <= 0.75 && !at; fy += 0.03)
      for (let fx = 0.3; fx <= 0.7; fx += 0.02) {
        const p = { x: box.x + box.width * fx, y: box.y + box.height * fy };
        await page.mouse.move(p.x, p.y);
        if (await card.waitFor({ state: 'attached', timeout: 150 }).then(() => true, () => false)) {
          at = p;
          break;
        }
      }
    expect(at).not.toBeNull();
    await expect(card).toContainText('Coolant');
    await expect(card).toContainText('→');
    await expect(card).toContainText('Source:');
    await page.mouse.click(at!.x, at!.y);
    await expect(page.locator('.pinned-connection')).toContainText('Coolant');
    await expect.poll(() => param(page, 'select')).toBe('compute-tray.3');
    // Moving away keeps a pinned card on screen.
    await page.mouse.move(box.x + 5, box.y + 5);
    await expect(card).toHaveClass(/pinned/);
    await page.keyboard.press('Escape');
    await expect(page.locator('.pinned-connection')).toHaveCount(0);
    await expect(card).toHaveCount(0);
    await expect.poll(() => param(page, 'view')).toBe('tray');
  });

  test('a connection pinned from the panel shows in 3D; Escape lets go, then goes up', async ({ page }) => {
    await page.goto('/?select=compute-tray.3/vera-cpu.1&view=tray');
    await expect(page.locator('.tray-label')).toHaveCount(2, { timeout: 60_000 });
    const show = page.getByRole('button', { name: 'Show in 3D' }).first();
    await show.click();
    await expect(show).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('.pinned-connection h3')).toHaveText('Pinned connection');
    await expect(page.locator('.pinned-connection a')).toHaveAttribute('href', /docs\.nvidia\.com/);
    await expect(page.locator('.link-card.pinned')).toBeVisible();
    await page.locator('#rack-stage').focus();
    await page.keyboard.press('Escape');
    await expect(page.locator('.pinned-connection')).toHaveCount(0);
    await expect(page.locator('.link-card')).toHaveCount(0);
    await expect.poll(() => param(page, 'select')).toBe('compute-tray.3/vera-cpu.1');
    await page.keyboard.press('Escape');
    await expect.poll(() => param(page, 'select')).toBe('compute-tray.3');
  });

  for (const reduced of [false, true]) {
    test(`dots move along the tray connections ${reduced ? 'not at all with reduced motion' : 'while idle'}`, async ({ page }) => {
      const errors: string[] = [];
      page.on('pageerror', (e) => errors.push(e.message));
      // Count draw calls: the canvas only redraws while something animates (frameloop="demand").
      await page.addInitScript(() => {
        const w = window as unknown as { __draws: number };
        w.__draws = 0;
        for (const proto of [WebGL2RenderingContext.prototype, WebGLRenderingContext.prototype]) {
          for (const name of ['drawElements', 'drawArrays', 'drawElementsInstanced', 'drawArraysInstanced'] as const) {
            const original = (proto as unknown as Record<string, (...a: unknown[]) => unknown>)[name];
            if (!original) continue;
            (proto as unknown as Record<string, unknown>)[name] = function (this: unknown, ...a: unknown[]) {
              w.__draws++;
              return original.apply(this, a);
            };
          }
        }
      });
      if (reduced) await page.emulateMedia({ reducedMotion: 'reduce' });
      await page.goto('/?select=compute-tray.3&view=tray');
      await expect(page.locator('.tray-label')).toHaveCount(2, { timeout: 60_000 });
      await page.waitForTimeout(1500);
      const draws = () => page.evaluate(() => (window as unknown as { __draws: number }).__draws);
      const before = await draws();
      await page.waitForTimeout(1000);
      const grew = (await draws()) - before;
      if (reduced) expect(grew).toBe(0);
      else expect(grew).toBeGreaterThan(0);
      // Turning the connections off stops the dots too.
      if (!reduced) {
        await page.getByRole('button', { name: 'Connections', exact: true }).click();
        await page.waitForTimeout(500);
        const off = await draws();
        await page.waitForTimeout(1000);
        expect((await draws()) - off).toBe(0);
      }
      expect(errors).toEqual([]);
    });
  }

  test('at 390px a tray with a pinned connection does not scroll sideways and the stage buttons stay usable', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/?select=compute-tray.3/vera-cpu.1&view=tray');
    await expect(page.locator('.tray-label')).toHaveCount(2, { timeout: 60_000 });
    await page.getByRole('button', { name: 'Show in 3D' }).first().click();
    await expect(page.locator('.pinned-connection')).toBeVisible();
    const card = page.locator('.link-card.pinned');
    await expect(card).toBeVisible();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow).toBeLessThanOrEqual(0);
    // The card lets pointer events through, so the stage buttons stay clickable wherever the two meet.
    const back = page.getByRole('button', { name: '← Back to rack' });
    await back.scrollIntoViewIfNeeded();
    const b = (await back.boundingBox())!;
    const onTop = await page.evaluate(([x, y]) => document.elementFromPoint(x!, y!)?.closest('button')?.textContent ?? '', [b.x + b.width / 2, b.y + b.height / 2]);
    expect(onTop).toContain('Back to rack');
    await expect(page.locator('.link-legend').getByRole('button', { name: 'PCIe', exact: true })).toBeVisible();
  });

  test('keyboard steps through the rack and opens a compute tray', async ({ page }) => {
    await page.goto('/?select=compute-tray.3');
    await rackReady(page);
    await page.locator('#rack-stage').focus();
    await page.keyboard.press('ArrowDown');
    await expect.poll(() => param(page, 'select')).toBe('compute-tray.4');
    await page.keyboard.press('Enter');
    await expect.poll(() => param(page, 'view')).toBe('tray');
    await expect(page.locator('.tray-label')).toHaveCount(2);
    await page.keyboard.press('ArrowDown');
    await expect.poll(() => param(page, 'select')).toBe('compute-tray.4/rubin-gpu.1');
    await expect(page.getByText('GPU0 (HPM_L GPU_0)')).toBeVisible();
    await page.keyboard.press('Escape');
    await page.keyboard.press('Escape');
    await expect.poll(() => param(page, 'view')).toBeNull();
  });

  test('the exploded view spreads the tray parts and keeps them selectable', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.goto('/?select=compute-tray.4&view=tray');
    await expect(page.locator('.tray-label')).toHaveCount(2, { timeout: 60_000 });
    const toggle = page.getByRole('button', { name: 'Exploded view' });
    await expect(toggle).toHaveAttribute('aria-pressed', 'false');
    await toggle.click();
    await expect(toggle).toHaveAttribute('aria-pressed', 'true');
    await page.locator('#rack-stage').focus();
    await page.keyboard.press('ArrowDown');
    await expect.poll(() => param(page, 'select')).toBe('compute-tray.4/rubin-gpu.1');
    // A real click on the exploded scene still selects a part.
    const box = (await page.locator('canvas').boundingBox())!;
    await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
    await expect.poll(() => param(page, 'select')).toMatch(/^compute-tray\.4(\/|$)/);
    await toggle.click();
    await expect(toggle).toHaveAttribute('aria-pressed', 'false');
    await page.getByRole('button', { name: '← Back to rack' }).click();
    await expect(page.getByRole('button', { name: 'Exploded view' })).toHaveCount(0);
    expect(errors).toEqual([]);
  });
});

test.describe('operator features', () => {
  test('Read aloud speaks the side panel only after a press, and stops', async ({ page }) => {
    // Headless Chromium has no voices, so record what the page asks the browser to say.
    await page.addInitScript(() => {
      const said: { text: string; lang: string }[] = [];
      (window as unknown as { said: typeof said }).said = said;
      class U {
        lang = '';
        voice: unknown = null;
        onend: (() => void) | null = null;
        onerror: (() => void) | null = null;
        constructor(public text: string) {}
      }
      const synth = {
        speaking: false,
        pending: false,
        getVoices: () => [{ lang: 'en-US', name: 'Test', localService: true, default: true, voiceURI: 'test' }],
        speak: (u: U) => {
          said.push({ text: u.text, lang: u.lang });
          synth.speaking = true;
        },
        cancel: () => {
          said.push({ text: '<cancel>', lang: '' });
          synth.speaking = false;
        },
        addEventListener: () => {},
        removeEventListener: () => {},
      };
      Object.defineProperty(window, 'speechSynthesis', { value: synth, configurable: true });
      Object.defineProperty(window, 'SpeechSynthesisUtterance', { value: U, configurable: true });
    });
    await page.goto('/?select=compute-tray.2');
    await rackReady(page);
    const said = () => page.evaluate(() => (window as unknown as { said: { text: string; lang: string }[] }).said);
    expect((await said()).filter((u) => u.text !== '<cancel>')).toEqual([]);
    await page.getByRole('button', { name: 'Read aloud: Compute tray 2' }).click();
    const spoken = (await said()).filter((u) => u.text !== '<cancel>');
    const text = spoken.map((u) => u.text).join(' ');
    expect(text).toContain('Compute tray 2');
    expect(text).toContain('What it is');
    expect(text).not.toContain('Copy link');
    expect(spoken.every((u) => u.lang === 'en-US')).toBe(true);
    await page.getByRole('button', { name: 'Stop reading' }).click();
    expect((await said()).at(-1)?.text).toBe('<cancel>');
    await expect(page.getByRole('button', { name: 'Read aloud: Compute tray 2' })).toBeVisible();
  });

  test('collapses and expands the details panel, and remembers it', async ({ page }) => {
    await page.goto('/?select=compute-tray.7');
    const panel = page.getByRole('region', { name: 'Details' });
    await expect(panel.getByRole('heading', { name: 'Compute tray 7' })).toBeVisible();
    const wide = (await panel.boundingBox())!.width;
    await page.getByRole('button', { name: 'Collapse details' }).click();
    await expect(panel.getByRole('heading', { name: 'Compute tray 7' })).toBeHidden();
    await expect.poll(async () => (await panel.boundingBox())!.width).toBeLessThan(60);
    expect(wide).toBeGreaterThan(250);
    await page.reload();
    await expect(page.getByRole('button', { name: 'Expand details' })).toHaveAttribute('aria-expanded', 'false');
    await page.getByRole('button', { name: 'Expand details' }).click();
    await expect(panel.getByRole('heading', { name: 'Compute tray 7' })).toBeVisible();
  });

  test('shows Record in the top bar, but not in an embed', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('button', { name: 'Record' })).toBeVisible();
    await page.goto('/?embed=1');
    await expect(page.getByRole('button', { name: 'Record' })).toHaveCount(0);
  });

  test('Screenshot saves a PNG of the 3D view with labels and a caption', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.goto('/?select=compute-tray.2');
    await rackReady(page);
    const button = page.getByRole('button', { name: 'Screenshot', exact: true });
    const group = page.getByRole('group', { name: 'Screenshot' });
    const before = (await group.boundingBox())!.width;
    await button.focus();
    const [download] = await Promise.all([page.waitForEvent('download'), page.keyboard.press('Enter')]);
    expect(download.suggestedFilename()).toMatch(/^vr-nvl72-\d{8}-\d{6}\.png$/);
    const bytes = await (await download.createReadStream()).toArray();
    const png = Buffer.concat(bytes);
    expect(png.subarray(0, 8).toString('hex')).toBe('89504e470d0a1a0a');
    await expect(page.getByRole('group', { name: 'Screenshot' }).getByRole('status')).toHaveText('Screenshot saved.');
    // The note floats: the group does not grow, so the header cannot re-wrap (it did on macOS).
    expect((await group.boundingBox())!.width).toBe(before);
    // It clears itself.
    await expect(page.locator('.screenshot-status')).toBeHidden({ timeout: 6_000 });
    // Decode it in the page: the canvas size plus a caption bar, and real pixels, not a blank frame.
    const info = await page.evaluate(async (b64) => {
      const blob = new Blob([Uint8Array.from(atob(b64), (ch) => ch.charCodeAt(0))], { type: 'image/png' });
      const img = await createImageBitmap(blob);
      const gl = document.querySelector('canvas')!;
      const c = document.createElement('canvas');
      c.width = img.width;
      c.height = img.height;
      const ctx = c.getContext('2d')!;
      ctx.drawImage(img, 0, 0);
      const colours = (y0: number, y1: number) => {
        const d = ctx.getImageData(0, y0, img.width, y1 - y0).data;
        const seen = new Set<number>();
        for (let i = 0; i < d.length; i += 4) seen.add((d[i]! << 16) | (d[i + 1]! << 8) | d[i + 2]!);
        return seen.size;
      };
      return {
        width: img.width,
        height: img.height,
        glWidth: gl.width,
        glHeight: gl.height,
        sceneColours: colours(0, gl.height),
        captionColours: colours(gl.height + 2, img.height),
      };
    }, png.toString('base64'));
    expect(info.width).toBe(info.glWidth);
    expect(info.height).toBeGreaterThan(info.glHeight);
    expect(info.height - info.glHeight).toBeLessThanOrEqual(28 * 2 + 1);
    expect(info.sceneColours).toBeGreaterThan(50);
    expect(info.captionColours).toBeGreaterThan(2);
    // No screen-sharing prompt: the page never asked for one.
    expect(errors).toEqual([]);
    await page.goto('/?embed=1');
    await expect(page.locator('canvas')).toBeVisible({ timeout: 60_000 });
    await expect(page.getByRole('button', { name: 'Screenshot', exact: true })).toHaveCount(0);
  });

  test('the quiz plays a question from the list at phone width, and hides in an embed', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.setViewportSize({ width: 400, height: 860 });
    await page.goto('/?list=1');
    await page.getByRole('button', { name: 'Quiz', exact: true }).click();
    const quiz = page.getByRole('region', { name: 'Quiz' });
    await expect(quiz.getByRole('heading', { name: 'Quiz · question 1 of 10' })).toBeVisible();
    await expect.poll(() => param(page, 'quiz')).toMatch(/^[1-9][0-9]*$/);
    const seed = param(page, 'quiz');
    const first = await quiz.locator('.quiz-question').textContent();
    // A multiple-choice question is answered in the panel; any other by selecting a part in the list.
    const choices = quiz.getByRole('group', { name: 'Answers' }).getByRole('button');
    if ((await choices.count()) > 0) await choices.first().click();
    else await page.getByRole('navigation').getByRole('button', { name: 'Liquid-cooled bus bar' }).click();
    await expect(quiz.getByRole('status')).toContainText(/Correct\.|Not quite\. The answer is/);
    await expect(quiz.getByRole('status').getByRole('link')).toHaveAttribute('href', /^https:\/\/docs\.nvidia\.com\//);
    await expect(quiz.getByText(/^Score: [01] of 10$/)).toBeVisible();
    await page.keyboard.press('Enter');
    await expect(quiz.getByRole('heading', { name: 'Quiz · question 2 of 10' })).toBeVisible();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow).toBeLessThanOrEqual(0);
    // The same link replays the same round.
    await page.goto(`/?list=1&quiz=${seed}`);
    await expect(page.getByRole('region', { name: 'Quiz' }).locator('.quiz-question')).toHaveText(first ?? '');
    await page.getByRole('button', { name: 'Quit quiz' }).click();
    await expect(page.getByRole('region', { name: 'Quiz' })).toHaveCount(0);
    await expect.poll(() => param(page, 'quiz')).toBeNull();
    await page.goto('/?embed=1');
    await expect(page.getByRole('button', { name: 'Quiz', exact: true })).toHaveCount(0);
    expect(errors).toEqual([]);
  });

  test('search finds a cage by its RDMA device and shows its host names', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('combobox', { name: 'Search parts' }).fill('mlx5_4');
    await page.keyboard.press('Enter');
    await expect.poll(() => param(page, 'select')).toBe('compute-tray/ct-port-cx9-osfp.2');
    await expect(page.getByText('enP3p1s0f0np0').first()).toBeVisible();
  });

  test('the Ctrl+K command palette highlights a network and selects a part', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('button', { name: /Commands/ })).toBeVisible();
    await page.keyboard.press('Control+k');
    const input = page.getByRole('dialog', { name: 'Command palette' }).getByRole('combobox', { name: 'Command or part' });
    await expect(input).toBeFocused();
    await input.fill('ipminet');
    await page.keyboard.press('Enter');
    await expect.poll(() => param(page, 'net')).toBe('ipminet');
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await page.keyboard.press('Control+k');
    await input.fill('mlx5_4');
    await page.keyboard.press('Enter');
    await expect.poll(() => param(page, 'select')).toBe('compute-tray/ct-port-cx9-osfp.2');
  });

  test('the network overlay highlights ipminet and lists what is on it', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: /4 ipminet/ }).click();
    await expect.poll(() => param(page, 'net')).toBe('ipminet');
    await expect(page.getByText('Network 4: ipminet · Ethernet')).toBeVisible();
  });

  test('selecting a network animates its path without page or console errors', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
    await page.goto('/');
    await rackReady(page);
    const bar = page.getByRole('group', { name: 'Highlight a network' });
    const buttons = bar.getByRole('button');
    // Every network in turn, so each one's flow mounts, compiles its shader and draws a few frames.
    for (let i = 0; i < (await buttons.count()); i++) {
      await buttons.nth(i).click();
      await expect(buttons.nth(i)).toHaveAttribute('aria-pressed', 'true');
      await page.waitForTimeout(300);
    }
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await buttons.first().click();
    await page.waitForTimeout(300);
    await expect(page.locator('canvas')).toBeVisible();
    expect(errors).toEqual([]);
  });

  test('the cold reboot walkthrough steps through and lights up the power shelves', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: /Walk through: Cold reboot the rack/ }).click();
    await page.getByRole('button', { name: /Next/ }).click();
    await expect.poll(() => param(page, 'step')).toBe('2');
    await expect.poll(() => param(page, 'select')).toBe('power-shelf');
    await expect(page.getByText(/three to five minutes/)).toBeVisible();
  });

  test('the Start here tour opens a compute tray, turns to the rear and exits back', async ({ page }) => {
    await page.goto('/');
    await rackReady(page);
    await page.getByRole('button', { name: 'Start here' }).click();
    const tour = page.getByRole('region', { name: 'Guided tour' });
    await expect(tour.getByRole('heading')).toContainText('step 1 of');
    await tour.getByRole('button', { name: 'Next', exact: true }).click();
    await expect.poll(() => param(page, 'select')).toBe('compute-tray.1');
    await page.keyboard.press('ArrowRight');
    await expect.poll(() => param(page, 'view')).toBe('tray');
    await expect(tour.getByRole('heading')).toContainText('step 3 of');
    for (let i = 0; i < 5; i++) await page.keyboard.press('ArrowRight');
    await expect.poll(() => param(page, 'view')).toBe('rear');
    await expect.poll(() => param(page, 'select')).toBe('nvlink-cable-cartridge');
    await page.setViewportSize({ width: 400, height: 800 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await page.keyboard.press('Escape');
    await expect(tour).toHaveCount(0);
    await expect.poll(() => param(page, 'view')).toBe(null);
    await expect.poll(() => param(page, 'select')).toBe(null);
  });

  test('a tour link opens its step, Next moves the link on and leaving drops it', async ({ page }) => {
    await page.goto('/?tour=3');
    const tour = page.getByRole('region', { name: 'Guided tour' });
    await expect(tour.getByRole('heading')).toContainText('step 3 of');
    await expect.poll(() => param(page, 'view')).toBe('tray');
    await expect.poll(() => param(page, 'select')).toBe('compute-tray.1');
    await tour.getByRole('button', { name: 'Next', exact: true }).click();
    await expect(tour.getByRole('heading')).toContainText('step 4 of');
    await expect.poll(() => param(page, 'tour')).toBe('4');
    await expect.poll(() => param(page, 'select')).toBe('compute-tray.1/rubin-gpu.1');
    await tour.getByRole('button', { name: 'Back', exact: true }).click();
    await expect.poll(() => param(page, 'tour')).toBe('3');
    await page.keyboard.press('Escape');
    await expect(tour).toHaveCount(0);
    await expect.poll(() => param(page, 'tour')).toBeNull();
    await expect.poll(() => param(page, 'select')).toBeNull();
    await page.goto('/?tour=99');
    await rackReady(page);
    await expect(page.getByRole('region', { name: 'Guided tour' })).toHaveCount(0);
    await expect.poll(() => param(page, 'tour')).toBeNull();
    // Moving off the step takes it out of the link; the next step puts it back.
    await page.goto('/?tour=2');
    await rackReady(page);
    await expect.poll(() => param(page, 'tour')).toBe('2');
    await page.getByRole('button', { name: /4 ipminet/ }).click();
    await expect.poll(() => param(page, 'net')).toBe('ipminet');
    await expect.poll(() => param(page, 'tour')).toBeNull();
    await expect(page.getByRole('region', { name: 'Guided tour' }).getByRole('heading')).toContainText('step 2 of');
    await page.getByRole('region', { name: 'Guided tour' }).getByRole('button', { name: 'Next', exact: true }).click();
    await expect.poll(() => param(page, 'tour')).toBe('3');
  });

  test('the rear view and the sources page open', async ({ page }) => {
    await page.goto('/');
    await rackReady(page);
    await page.getByRole('button', { name: 'Rear', exact: true }).click();
    await expect.poll(() => param(page, 'view')).toBe('rear');
    await page.getByRole('button', { name: 'Sources' }).click();
    await expect(page.getByRole('heading', { name: 'Sources and open questions' })).toBeVisible();
    // There is no 3D view on the Sources page, so there is nothing to screenshot.
    await expect(page.getByRole('button', { name: 'Screenshot', exact: true })).toHaveCount(0);
  });

  test('the What changed page opens from its URL and lists the changes with NVIDIA links', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.goto('/?page=changes');
    await expect(page.getByRole('heading', { name: 'What changed' })).toBeVisible();
    const entries = page.locator('.changes-list > li');
    await expect(entries.first()).toBeVisible();
    expect(await entries.count()).toBeGreaterThan(1);
    // Newest first.
    const dates = await entries.locator('time').evaluateAll((els) => els.map((e) => e.getAttribute('datetime') ?? ''));
    expect([...dates].sort().reverse()).toEqual(dates);
    // The first import of each document is there, with its date.
    await expect(entries.filter({ hasText: 'First import of the User Guide dated 2026-11-05' })).toHaveCount(1);
    await expect(entries.filter({ hasText: 'First import of the Service Manual dated 2026-10-07' })).toHaveCount(1);
    await expect(entries.filter({ hasText: 'Detailed the fronts of the power shelf' })).toHaveCount(1);
    await expect(page.getByText(/The SHA-256 is inferred/)).toHaveCount(2);
    // Every section link goes to one of NVIDIA's two documents.
    const hrefs = await page.locator('.changes-list details a').evaluateAll((els) => els.map((e) => (e as HTMLAnchorElement).href));
    expect(hrefs.length).toBeGreaterThan(10);
    for (const h of hrefs) expect(h).toMatch(/^https:\/\/docs\.nvidia\.com\/dgx\/dgxvr-(user-guide|service-manual)\/[a-z-]+\.html(#[a-z0-9-]+)?$/);
    const guide = entries.filter({ hasText: 'First import of the User Guide' });
    await guide.locator('summary').click();
    await expect(guide.getByRole('link', { name: '1.1 Rack Configuration' })).toHaveAttribute(
      'href',
      'https://docs.nvidia.com/dgx/dgxvr-user-guide/hardware.html#rack-configuration',
    );
    // The fingerprints of both PDFs.
    await expect(page.getByRole('link', { name: 'NVIDIA DGX VR NVL72 User Guide' })).toHaveAttribute('href', /dgxvr-user-guide\.pdf$/);
    await expect(page.getByText(/PDF last modified on 2026-10-07/)).toBeVisible();
    // It is reachable from the footer and from the Sources page, and the URL follows.
    await page.getByRole('button', { name: 'Sources and open questions' }).click();
    await expect.poll(() => param(page, 'page')).toBe('sources');
    await page.getByRole('button', { name: 'What changed in these documents and in the data' }).click();
    await expect.poll(() => param(page, 'page')).toBe('changes');
    await page.getByRole('button', { name: '← Back to the rack' }).click();
    await expect.poll(() => param(page, 'page')).toBe(null);
    await page.locator('footer').getByRole('button', { name: 'What changed' }).click();
    await expect(page.getByRole('heading', { name: 'What changed' })).toBeVisible();
    expect(errors).toEqual([]);
  });

  test('camera presets move the view and Reset brings it back', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
    await page.goto('/');
    await rackReady(page);
    const shot = () => page.locator('canvas').screenshot();
    // The scene writes the camera position on the canvas as "x y z".
    const pose = () => page.locator('canvas').getAttribute('data-camera');
    const z = async () => Number(((await pose()) ?? '').split(' ')[2]);
    const before = await shot();
    const home = await pose();
    expect(home).toMatch(/^-?[\d.]+ -?[\d.]+ -?[\d.]+$/);
    const camera = page.getByRole('group', { name: 'Camera angle' });
    const press = (name: string) => camera.getByRole('button', { name, exact: true }).click();
    const reset = 'Camera: reset camera to the starting angle';
    await press('Camera: from above');
    await expect.poll(async () => (await shot()).equals(before)).toBe(false);
    await expect.poll(pose).not.toBe(home);
    await press('Camera: straight on, at eye level');
    await press('Camera: from the other side, at eye level');
    await expect.poll(z).toBeLessThan(-1);
    await press('Camera: angled, 45° to one side');
    await press(reset);
    await expect.poll(pose).toBe(home);

    // The presets follow the rear view and leave the view switch alone.
    await page.getByRole('button', { name: 'Rear', exact: true }).click();
    await expect.poll(() => param(page, 'view')).toBe('rear');
    await expect.poll(z).toBeLessThan(-1);
    const rear = await pose();
    await press('Camera: straight on, at eye level');
    await expect.poll(pose).not.toBe(rear);
    await expect.poll(async () => Math.abs(Number(((await pose()) ?? '9').split(' ')[0]))).toBeLessThan(0.01);
    expect(await z()).toBeLessThan(-1);
    expect(await param(page, 'view')).toBe('rear');
    await press(reset);
    await expect.poll(pose).toBe(rear);
    await expect(page.getByRole('button', { name: 'Rear', exact: true })).toHaveCount(1);
    expect(errors).toEqual([]);
  });

  test('the dataset is published next to the app', async ({ request }) => {
    const res = await request.get('/data/nvl72-topology.json');
    expect(res.ok()).toBe(true);
    const data = await res.json();
    expect(data.components.every((c: { references: unknown[] }) => c.references.length > 0)).toBe(true);
  });
});

test.describe('first visit', () => {
  test('shows the first-visit hint once, clear of the rack, and brings it back from "?"', async ({ page }) => {
    await page.goto('/');
    await rackReady(page);
    const hint = page.getByRole('region', { name: 'Quick tips' });
    await expect(hint).toBeVisible();
    await expect(hint.getByRole('listitem')).toHaveCount(3);
    // It does not take focus, and the middle of the stage is still the canvas.
    expect(await hint.evaluate((el) => el.contains(document.activeElement))).toBe(false);
    const box = (await page.locator('canvas').boundingBox())!;
    const atCentre = await page.evaluate(([x, y]) => document.elementFromPoint(x!, y!)?.tagName, [box.x + box.width / 2, box.y + box.height / 2]);
    expect(atCentre).toBe('CANVAS');
    await hint.getByRole('button', { name: 'Got it' }).click();
    await expect(hint).toHaveCount(0);
    await page.reload();
    await rackReady(page);
    await expect(hint).toHaveCount(0);
    await page.getByRole('button', { name: 'Show tips' }).click();
    await expect(hint).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(hint).toHaveCount(0);
    // A shared link to a part does not show it, nor does an embed, at phone width or not.
    await page.evaluate(() => localStorage.clear());
    await page.goto('/?select=compute-tray.2');
    await expect(page.getByRole('heading', { name: 'Compute tray 2' })).toBeVisible();
    await expect(hint).toHaveCount(0);
    await page.setViewportSize({ width: 400, height: 860 });
    await page.goto('/');
    await expect(hint).toBeVisible();
    const card = (await hint.boundingBox())!;
    const stage = (await page.locator('#rack-stage').boundingBox())!;
    expect(card.x).toBeGreaterThanOrEqual(0);
    expect(card.x + card.width).toBeLessThanOrEqual(400);
    expect(card.height).toBeLessThan(stage.height / 2);
    await page.goto('/?embed=1');
    await expect(page.locator('canvas')).toBeVisible({ timeout: 60_000 });
    await expect(hint).toHaveCount(0);
  });
});

test.describe('fallbacks and layouts', () => {
  test('without WebGL the rack is shown as a list', async ({ browser }) => {
    const context = await browser.newContext();
    await context.addInitScript(() => {
      const original = HTMLCanvasElement.prototype.getContext;
      HTMLCanvasElement.prototype.getContext = function (this: HTMLCanvasElement, type: string, ...rest: unknown[]) {
        if (type === 'webgl' || type === 'webgl2') return null;
        return (original as (...a: unknown[]) => unknown).call(this, type, ...rest);
      } as typeof original;
    });
    const page = await context.newPage();
    await page.goto('/');
    await expect(page.getByText('WebGL is not available in this browser')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Screenshot', exact: true })).toHaveCount(0);
    await page.getByRole('button', { name: 'Compute tray 5', exact: false }).first().click();
    await expect.poll(() => new URL(page.url()).searchParams.get('select')).toBe('compute-tray.5');
    await context.close();
  });

  test('the list filters by type and network, from a shared link and by keyboard', async ({ page }) => {
    await page.setViewportSize({ width: 400, height: 860 });
    await page.goto('/?list=1&ft=compute-tray,moon&fn=bogus');
    await expect.poll(() => param(page, 'ft')).toBe('compute-tray');
    expect(param(page, 'fn')).toBeNull();
    const nav = page.getByRole('navigation', { name: 'Rack units, top to bottom' });
    const status = nav.getByRole('status');
    await expect(status).toHaveText(/^18 of 33 units$/);
    await expect(nav.getByRole('button', { name: 'Switch tray 1', exact: false })).toHaveCount(0);
    const nets = nav.getByRole('group', { name: 'Filter by network' });
    const chip = nets.getByRole('button').first();
    await chip.focus();
    await page.keyboard.press('Enter');
    await expect(chip).toHaveAttribute('aria-pressed', 'true');
    await expect.poll(() => param(page, 'fn')).not.toBeNull();
    expect(param(page, 'net')).toBeNull();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow).toBeLessThanOrEqual(0);
    await nav.getByRole('button', { name: 'Clear filters' }).click();
    await expect(status).toHaveText(/^33 of 33 units$/);
    await expect.poll(() => param(page, 'ft')).toBeNull();
  });

  test('works at phone width without horizontal scrolling', async ({ page }) => {
    await page.setViewportSize({ width: 400, height: 860 });
    await page.goto('/?select=compute-tray.2');
    await expect(page.locator('canvas')).toBeVisible({ timeout: 60_000 });
    await expect(page.getByRole('button', { name: 'Screenshot', exact: true })).toBeInViewport();
    await expect(page.getByRole('button', { name: 'Copy image' })).toBeInViewport();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow).toBeLessThanOrEqual(0);
  });

  // Short medium-width windows (a phone on its side, a small laptop window), the 760px boundary, a desktop and a phone.
  for (const [width, height] of [[844, 390], [900, 500], [1000, 600], [760, 390], [1280, 800], [390, 844]] as const) {
    test(`the 3D view keeps a usable height at ${width}x${height}`, async ({ page }) => {
      await page.setViewportSize({ width, height });
      await page.goto('/');
      await expect(page.locator('canvas')).toBeVisible({ timeout: 60_000 });
      await expect(page.locator('.stage')).toBeVisible();
      const stage = (await page.locator('.stage').boundingBox())!;
      // At least 60% of the window or 240px, whichever is smaller; the page scrolls when that does not fit.
      expect(stage.height).toBeGreaterThanOrEqual(Math.min(0.6 * height, 240) - 1);
      // The canvas fills it once the renderer has sized itself.
      await expect.poll(async () => (await page.locator('.stage canvas').boundingBox())?.height ?? 0).toBeGreaterThanOrEqual(stage.height - 1);
      // The tips box stays inside the stage and "Got it" can be tapped.
      await expect(page.locator('.first-visit')).toBeVisible();
      const tips = (await page.locator('.first-visit').boundingBox())!;
      expect(tips.y).toBeGreaterThanOrEqual(stage.y - 1);
      expect(tips.y + tips.height).toBeLessThanOrEqual(stage.y + stage.height + 1);
      await page.locator('.first-visit').getByRole('button', { name: 'Got it' }).click({ timeout: 5_000 });
      await expect(page.locator('.first-visit')).toHaveCount(0);
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      expect(overflow).toBeLessThanOrEqual(0);
      // The whole stage can be scrolled into the window.
      const inView = await page.locator('.stage').evaluate((el) => {
        el.scrollIntoView({ block: 'end' });
        const r = el.getBoundingClientRect();
        return r.top >= -1 && r.bottom <= window.innerHeight + 1;
      });
      expect(inView).toBe(true);
    });
  }

  test('the 3D view keeps a usable height in a short embed', async ({ page }) => {
    await page.setViewportSize({ width: 844, height: 390 });
    await page.goto('/?embed=1');
    await expect(page.locator('canvas')).toBeVisible({ timeout: 60_000 });
    await expect(page.locator('.stage')).toBeVisible();
    const stage = (await page.locator('.stage').boundingBox())!;
    expect(stage.height).toBeGreaterThanOrEqual(0.6 * 390 - 1);
  });

  for (const which of ['sources', 'changes'] as const) {
    for (const [width, height] of [[761, 390], [844, 390]] as const) {
      test(`the ${which} page can be read and scrolled at ${width}x${height}`, async ({ page }) => {
        await page.setViewportSize({ width, height });
        await page.goto(`/?page=${which}`);
        const main = page.locator('.layout-page');
        await expect(main).toBeVisible();
        const box = (await main.boundingBox())!;
        expect(box.height).toBeGreaterThanOrEqual(0.6 * height - 1);
        // The page scrolls it into the window, and it scrolls to its own end.
        const reached = await main.evaluate((el) => {
          el.scrollIntoView({ block: 'end' });
          el.scrollTop = el.scrollHeight;
          const r = el.getBoundingClientRect();
          const atEnd = el.scrollTop + el.clientHeight >= el.scrollHeight - 1;
          return atEnd && el.scrollTop > 0 && r.top >= -1 && r.bottom <= window.innerHeight + 1;
        });
        expect(reached).toBe(true);
      });
    }
  }

  test('the tour card stays above the tips box and "?" waits for the tour to end', async ({ page }) => {
    await page.goto('/');
    await rackReady(page);
    await page.getByRole('button', { name: 'Start here' }).click();
    const tour = page.getByRole('region', { name: 'Guided tour' });
    await expect(tour).toBeVisible();
    await page.getByRole('button', { name: 'Show tips' }).click();
    await expect(page.locator('.first-visit')).toHaveCount(0);
    await tour.getByRole('button', { name: 'Next', exact: true }).click({ timeout: 5_000 });
    await expect(tour.getByRole('heading')).toContainText('step 2 of');
    const z = (sel: string) => page.evaluate((s) => Number(getComputedStyle(document.querySelector(s)!).zIndex), sel);
    await page.keyboard.press('Escape');
    await expect(tour).toHaveCount(0);
    await page.getByRole('button', { name: 'Show tips' }).click();
    await expect(page.locator('.first-visit')).toBeVisible();
    await page.goto('/?tour=1');
    await expect(tour).toBeVisible();
    expect(await z('.tour-box')).toBeGreaterThan(35);
    expect(await z('.tour-box')).toBeLessThan(100);
  });

  test('the desktop page does not scroll past the footer', async ({ page }) => {
    await page.goto('/');
    await rackReady(page);
    const extra = await page.evaluate(() => document.documentElement.scrollHeight - window.innerHeight);
    expect(extra).toBeLessThanOrEqual(0);
    await page.goto('/?select=compute-tray.7');
    await expect(page.locator('.panel-body')).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollHeight - window.innerHeight)).toBeLessThanOrEqual(0);
  });

  // A short phone, three common phones and a phone on its side.
  for (const [width, height] of [[320, 568], [360, 740], [390, 844], [430, 932], [667, 375]] as const) {
    test(`the legend stays clear of the network bar and stage controls at ${width}x${height}`, async ({ page }) => {
      await page.setViewportSize({ width, height });
      const legend = page.locator('.legend');
      /** What the legend overlaps; throws when a control that should be on screen is missing or empty. */
      const clashes = () =>
        page.evaluate(() => {
          const box = (sel: string, required: boolean) => {
            const r = document.querySelector(sel)?.getBoundingClientRect();
            if (r && r.width > 0 && r.height > 0) return r;
            if (required) throw new Error(`${sel} is missing or has no size`);
            return null;
          };
          const own = box('.legend', true)!;
          const stage = box('.stage', true)!;
          const hit = ['.network-bar', '.stage-actions', '.camera-presets', '.hint', '.first-visit'].filter((sel) => {
            const r = box(sel, sel !== '.first-visit');
            return !!r && own.left < r.right && r.left < own.right && own.top < r.bottom && r.top < own.bottom;
          });
          if (own.top < stage.top || own.bottom > stage.bottom || own.left < stage.left || own.right > stage.right) hit.push('outside the stage');
          return hit;
        });
      /** The legend takes keyboard focus exactly when it is long enough to scroll. */
      const focusMatchesScroll = () =>
        legend.evaluate((el) => (el.getAttribute('tabindex') === '0') === el.scrollHeight > el.clientHeight + 1);

      // On a first visit the tips box fills the width, so the legend waits for it to close.
      await page.goto('/');
      await expect(page.locator('canvas')).toBeVisible({ timeout: 60_000 });
      await expect(page.locator('.first-visit')).toBeVisible();
      await expect(legend).toBeHidden();
      // A real tap: Playwright refuses if anything (such as the stage buttons) covers "Got it".
      await page.locator('.first-visit').getByRole('button', { name: 'Got it' }).click({ timeout: 5_000 });
      await expect(page.locator('.first-visit')).toHaveCount(0);

      // The long rack legend, the language with the longest labels, a network, and a tray.
      for (const url of ['/', '/?lang=ru', '/?net=ipminet', '/?net=ipminet&lang=ru', '/?view=tray&select=compute-tray.7']) {
        await page.goto(url);
        await expect(page.locator('canvas')).toBeVisible({ timeout: 60_000 });
        await expect(legend).toBeVisible();
        expect(await clashes(), url).toEqual([]);
        await expect.poll(focusMatchesScroll, url).toBe(true);
      }
      // The long legend scrolls here, so the keyboard can reach it.
      await page.goto('/?lang=ru');
      await expect(legend).toHaveAttribute('tabindex', '0');
    });
  }

  test('the rack totals chart opens a part and fits a phone', async ({ page }) => {
    await page.setViewportSize({ width: 400, height: 860 });
    await page.goto('/');
    const chart = page.getByRole('table').filter({ has: page.getByRole('columnheader', { name: 'In the rack' }) });
    await expect(chart.getByRole('row', { name: /Rubin GPU/ })).toContainText('72');
    await expect(chart.getByText('not stated').first()).toBeAttached();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow).toBeLessThanOrEqual(0);
    await chart.getByRole('button', { name: 'Rubin GPU', exact: true }).click();
    await expect.poll(() => new URL(page.url()).searchParams.get('select')).toBe('compute-tray/rubin-gpu');
  });

  test('the empty panel prompt starts from a unit and goes away, at phone width', async ({ page }) => {
    await page.setViewportSize({ width: 400, height: 860 });
    await page.goto('/');
    const prompt = page.getByRole('region', { name: 'Getting started' });
    await expect(prompt).toContainText('Select a part in the rack, or pick one below');
    await expect(page.getByRole('heading', { name: 'How many in the rack' })).toBeVisible();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow).toBeLessThanOrEqual(0);
    await prompt.getByRole('button', { name: 'Compute tray 1', exact: true }).click();
    await expect.poll(() => new URL(page.url()).searchParams.get('select')).toBe('compute-tray.1');
    await expect(prompt).toHaveCount(0);
    await expect(page.getByRole('heading', { level: 2 })).toContainText('Compute tray 1');
  });

  test('compares two parts from a shared link, by keyboard and at phone width, without WebGL', async ({ browser }) => {
    const context = await browser.newContext({ viewport: { width: 400, height: 860 } });
    await context.addInitScript(() => {
      const original = HTMLCanvasElement.prototype.getContext;
      HTMLCanvasElement.prototype.getContext = function (this: HTMLCanvasElement, type: string, ...rest: unknown[]) {
        if (type === 'webgl' || type === 'webgl2') return null;
        return (original as (...a: unknown[]) => unknown).call(this, type, ...rest);
      } as typeof original;
    });
    const page = await context.newPage();
    // An invalid cmp is dropped from the address bar.
    await page.goto('/?select=compute-tray.3&cmp=compute-tray.99');
    await expect.poll(() => new URL(page.url()).searchParams.get('cmp')).toBeNull();
    const compare = page.getByRole('button', { name: 'Compare', exact: true });
    await compare.focus();
    await page.keyboard.press('Enter');
    await expect(page.getByText(/is pinned/)).toBeVisible();
    await page.getByRole('button', { name: /^NVLink 6 switch tray 1 / }).click();
    await expect.poll(() => new URL(page.url()).searchParams.get('cmp')).toBe('compute-tray.3');
    const region = page.getByRole('region', { name: /^Comparison of Compute tray 3 and / });
    await expect(region.getByRole('table')).toBeVisible();
    await expect(region.locator('tr.differs').first()).toBeVisible();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow).toBeLessThanOrEqual(0);
    await region.getByRole('button', { name: 'Swap' }).click();
    await expect.poll(() => new URL(page.url()).searchParams.get('select')).toBe('compute-tray.3');
    // Now the switch tray is pinned on the left.
    await expect(page.getByRole('region', { name: /^Comparison of NVLink 6 switch tray 1 and Compute tray 3$/ })).toBeVisible();
    await page.getByRole('button', { name: 'Stop comparing' }).click();
    await expect.poll(() => new URL(page.url()).searchParams.get('cmp')).toBeNull();
    await context.close();
  });

  test('copies a clean link to the selected part from next to its heading', async ({ browser, baseURL }) => {
    const context = await browser.newContext({ permissions: ['clipboard-read', 'clipboard-write'] });
    const page = await context.newPage();
    await page.goto('/?select=compute-tray.3&net=ipminet&list=1&utm=x');
    await rackReady(page);
    await page.getByRole('button', { name: 'Copy link to Compute tray 3' }).click();
    await expect(page.getByRole('status').filter({ hasText: 'Link copied.' })).toBeVisible();
    const copied = await page.evaluate(() => navigator.clipboard.readText());
    expect(copied).toBe(`${new URL(baseURL!).origin}/?select=compute-tray.3`);
    await context.close();
  });

  test('a glossary term opens its definition on tap at phone width and closes on Escape', async ({ page }) => {
    await page.setViewportSize({ width: 400, height: 860 });
    await page.goto('/?select=compute-tray.2');
    const term = page.locator('.panel-body .gloss-term').first();
    await term.scrollIntoViewIfNeeded();
    await term.click();
    await expect(term).toHaveAttribute('aria-expanded', 'true');
    const pop = page.getByRole('dialog', { name: /^Definition of / });
    await expect(pop).toBeVisible();
    await expect(pop.getByRole('link')).toHaveAttribute('href', /^https:\/\/docs\.nvidia\.com\/dgx\/dgxvr-/);
    const box = (await pop.boundingBox())!;
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width).toBeLessThanOrEqual(400);
    await page.keyboard.press('Escape');
    await expect(pop).toBeHidden();
    await expect(term).toBeFocused();
  });

  test('embed mode hides the header and footer', async ({ page }) => {
    await page.goto('/?embed=1');
    await expect(page.locator('.topbar')).toBeHidden();
    await expect(page.locator('.footer')).toBeHidden();
  });
});

test.describe('languages', () => {
  test('switches to Turkish and Chinese and keeps the choice in the URL', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.goto('/?select=compute-tray.7');
    await rackReady(page);
    await page.getByRole('button', { name: 'TR', exact: true }).click();
    await expect.poll(() => param(page, 'lang')).toBe('tr');
    await expect(page.locator('html')).toHaveAttribute('lang', 'tr');
    await expect(page.getByText('Bu metin NVIDIA')).toBeVisible();
    await page.getByRole('button', { name: '中文', exact: true }).click();
    await expect.poll(() => param(page, 'lang')).toBe('zh');
    await expect(page.locator('html')).toHaveAttribute('lang', 'zh');
    await page.getByRole('button', { name: 'EN', exact: true }).click();
    await expect.poll(() => param(page, 'lang')).toBeNull();
    expect(param(page, 'select')).toBe('compute-tray.7');
    expect(errors).toEqual([]);
  });

  test('opens straight into Chinese from a shared link', async ({ page }) => {
    await page.goto('/?lang=zh');
    await rackReady(page);
    await expect(page.locator('html')).toHaveAttribute('lang', 'zh');
    await expect(page.getByRole('button', { name: '中文', exact: true })).toHaveAttribute('aria-pressed', 'true');
  });
});

test.describe('themes', () => {
  test('System follows the OS colour scheme live', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'light' });
    await page.goto('/');
    await rackReady(page);
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
    await page.emulateMedia({ colorScheme: 'dark' });
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  });

  test('Light and Dark override the OS, are remembered, and raise no errors', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
    await page.emulateMedia({ colorScheme: 'dark' });
    await page.goto('/?select=compute-tray.7');
    await rackReady(page);
    await page.getByRole('button', { name: 'Light', exact: true }).click();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
    const bg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
    expect(bg).toBe('rgb(246, 247, 249)');
    await page.reload();
    await rackReady(page);
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
    await page.getByRole('button', { name: 'Dark', exact: true }).click();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
    expect(errors).toEqual([]);
  });
});

test.describe('Russian and Spanish', () => {
  for (const [lang, label, notice] of [
    ['ru', 'RU', 'Этот текст переведён'],
    ['es', 'ES', 'Este texto está traducido'],
  ] as const) {
    test(`opens in ${lang} from a shared link`, async ({ page }) => {
      const errors: string[] = [];
      page.on('pageerror', (e) => errors.push(e.message));
      await page.goto(`/?lang=${lang}&select=compute-tray.7`);
      await rackReady(page);
      await expect(page.locator('html')).toHaveAttribute('lang', lang);
      await expect(page.getByRole('button', { name: label, exact: true })).toHaveAttribute('aria-pressed', 'true');
      await expect(page.getByText(notice)).toBeVisible();
      expect(errors).toEqual([]);
    });
  }
});
