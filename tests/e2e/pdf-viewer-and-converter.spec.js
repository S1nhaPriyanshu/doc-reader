import { test, expect } from '@playwright/test';

test.describe('PDF Viewing & Conversion Full Flow', () => {
  test('should render UTU Syllabus.pdf with proper visibility in dark mode and convert without detached buffer error', async ({ page }) => {
    const consoleErrors = [];
    page.on('console', msg => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });

    // 1. Load app
    await page.goto('/');

    // Ensure dark mode is active
    await page.evaluate(() => document.documentElement.setAttribute('data-theme', 'dark'));

    // 2. Navigate to Open and upload UTU Syllabus.pdf
    await page.locator('.nav-item').nth(1).click();
    const fileInput = page.locator('#file-input');
    await fileInput.setInputFiles('/home/priyanshu/Downloads/UTU Syllabus.pdf');

    // 3. Verify PDF viewer mounts and renders
    const firstPage = page.locator('.pdf-page').first();
    await expect(firstPage).toBeVisible({ timeout: 10000 });

    // Verify first page height is positive and not collapsed to 0px
    const pageBox = await firstPage.boundingBox();
    expect(pageBox).not.toBeNull();
    expect(pageBox.height).toBeGreaterThan(100);

    // Verify canvas exists and is visible
    const firstCanvas = page.locator('.pdf-page canvas').first();
    await expect(firstCanvas).toBeVisible();

    // Verify page label
    await expect(page.locator('.pdf-page-label').first()).toHaveText('Page 1');

    // Take screenshot of viewer in dark mode
    await page.screenshot({ path: '/home/priyanshu/.gemini/antigravity-ide/brain/aa7b127c-975c-4978-b724-2e22ec7b79b0/scratch/dark_mode_pdf_fixed.png' });

    // 4. Click Convert button in toolbar
    const convertBtn = page.locator('#viewer-convert-btn');
    await expect(convertBtn).toBeVisible();
    await convertBtn.click();

    // 5. Verify converter view loaded
    await expect(page.locator('.section-title')).toHaveText('Available Target Formats');

    // 6. Test conversion to TXT - listen for download
    const downloadPromise = page.waitForEvent('download');
    const txtCard = page.locator('.convert-target-card[data-format="txt"]');
    await expect(txtCard).toBeVisible();
    await txtCard.click();

    const download = await downloadPromise;
    expect(download.suggestedFilename()).toBe('UTU Syllabus.txt');

    // 7. Verify no detached ArrayBuffer errors occurred
    const detachedErrors = consoleErrors.filter(e => e.includes('detached ArrayBuffer'));
    expect(detachedErrors).toHaveLength(0);
  });
});
