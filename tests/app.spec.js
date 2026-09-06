import { test, expect } from '@playwright/test';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

test.describe('DocReader Mobile App Tests', () => {
  
  test.beforeEach(async ({ page }) => {
    // Navigate to the app
    await page.goto('/');
  });

  test('should load the app shell and basic navigation', async ({ page }) => {
    // Check header
    await expect(page.locator('.header-title')).toHaveText('DocReader');
    
    // Check bottom navigation
    const navItems = page.locator('.nav-item');
    await expect(navItems).toHaveCount(3);
    await expect(navItems.nth(0)).toContainText('Home');
    await expect(navItems.nth(1)).toContainText('Open');
    await expect(navItems.nth(2)).toContainText('Convert');
    
    // Navigate to Open tab
    await navItems.nth(1).click();
    await expect(page.locator('.section-title')).toHaveText('Open Document');
  });

  test('should open a text file and switch to viewer mode', async ({ page }) => {
    // Create a temporary text file
    const tempFilePath = path.join(__dirname, 'test.txt');
    fs.writeFileSync(tempFilePath, 'Hello World Document');

    // Go to Open tab
    await page.locator('.nav-item').nth(1).click();

    // Set file input
    const fileInput = page.locator('#file-input');
    await fileInput.setInputFiles(tempFilePath);

    // Should navigate to viewer automatically
    await expect(page.locator('.toolbar-filename')).toHaveText('test.txt');
    await expect(page.locator('.text-content')).toContainText('Hello World Document');

    // Cleanup
    fs.unlinkSync(tempFilePath);
  });
  
  test('should switch to editor mode and back for text files', async ({ page }) => {
    const tempFilePath = path.join(__dirname, 'edit_test.txt');
    fs.writeFileSync(tempFilePath, 'Content to edit');

    await page.locator('.nav-item').nth(1).click();
    await page.locator('#file-input').setInputFiles(tempFilePath);

    // Wait for viewer
    await expect(page.locator('.text-content')).toBeVisible();

    // Click edit button (assuming there's an edit button in viewer toolbar)
    const editBtn = page.locator('#viewer-edit-btn');
    // If text file is editable, the button should be visible
    await expect(editBtn).toBeVisible();
    await editBtn.click();

    // Editor view should show up
    await expect(page.locator('.ql-editor')).toBeVisible();
    await expect(page.locator('.ql-editor')).toContainText('Content to edit');

    // Go back
    await page.locator('#editor-back-btn').click();
    await expect(page.locator('.text-content')).toBeVisible();

    fs.unlinkSync(tempFilePath);
  });
});
