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

  test('a real click on the canvas selects a rack unit', async ({ page }) => {
    await page.goto('/');
    await rackReady(page);
    const box = (await page.locator('canvas').boundingBox())!;
    // The rack stands in the middle of the stage; its centre is a compute or switch tray.
    await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
    await expect.poll(() => param(page, 'select')).toMatch(/^(compute-tray|switch-tray|power-shelf|tor-switch)\.\d+$/);
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
});

test.describe('operator features', () => {
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

  test('search finds a cage by its RDMA device and shows its host names', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('combobox', { name: 'Search parts' }).fill('mlx5_4');
    await page.keyboard.press('Enter');
    await expect.poll(() => param(page, 'select')).toBe('compute-tray/ct-port-cx9-osfp.2');
    await expect(page.getByText('enP3p1s0f0np0').first()).toBeVisible();
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

  test('the rear view and the sources page open', async ({ page }) => {
    await page.goto('/');
    await rackReady(page);
    await page.getByRole('button', { name: 'Rear', exact: true }).click();
    await expect.poll(() => param(page, 'view')).toBe('rear');
    await page.getByRole('button', { name: 'Sources' }).click();
    await expect(page.getByRole('heading', { name: 'Sources and open questions' })).toBeVisible();
  });

  test('the dataset is published next to the app', async ({ request }) => {
    const res = await request.get('/data/nvl72-topology.json');
    expect(res.ok()).toBe(true);
    const data = await res.json();
    expect(data.components.every((c: { references: unknown[] }) => c.references.length > 0)).toBe(true);
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
    await page.getByRole('button', { name: 'Compute tray 5', exact: false }).first().click();
    await expect.poll(() => new URL(page.url()).searchParams.get('select')).toBe('compute-tray.5');
    await context.close();
  });

  test('works at phone width without horizontal scrolling', async ({ page }) => {
    await page.setViewportSize({ width: 400, height: 860 });
    await page.goto('/?select=compute-tray.2');
    await expect(page.locator('canvas')).toBeVisible({ timeout: 60_000 });
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow).toBeLessThanOrEqual(0);
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
