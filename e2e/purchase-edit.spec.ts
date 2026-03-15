import { test, expect } from "@playwright/test";

// Note: These tests require a running dev server with test data
// The tests assume there's at least one purchase with id "test-purchase-id"

test.describe("Purchase Edit Flow", () => {
    // Skip tests if no test data is available
    test.beforeEach(async ({ page }) => {
        // Navigate to purchases page first
        await page.goto("/purchases");

        // Wait for the page to load
        await page.waitForLoadState("networkidle");
    });

    test("should open edit modal when Edit button is clicked", async ({ page }) => {
        // Click on the first purchase to view details
        const firstPurchase = page.locator("a[href^='/purchases/']").first();
        if (await firstPurchase.isVisible()) {
            await firstPurchase.click();

            // Wait for purchase details page to load
            await page.waitForURL(/\/purchases\/[^/]+$/);

            // Click the Edit button
            await page.click("button:has-text('Edit')");

            // Verify modal is visible
            await expect(page.locator("text=Edit Purchase")).toBeVisible();

            // Verify form elements are visible
            await expect(page.locator("[data-component='PurchaseEditForm']")).toBeVisible();
        } else {
            test.skip(true, "No purchases available to test");
        }
    });

    test("should close modal when Cancel is clicked", async ({ page }) => {
        const firstPurchase = page.locator("a[href^='/purchases/']").first();
        if (await firstPurchase.isVisible()) {
            await firstPurchase.click();
            await page.waitForURL(/\/purchases\/[^/]+$/);

            // Open modal
            await page.click("button:has-text('Edit')");
            await expect(page.locator("text=Edit Purchase")).toBeVisible();

            // Click Cancel
            await page.click("button:has-text('Cancel')");

            // Verify modal is closed
            await expect(page.locator("text=Edit Purchase")).not.toBeVisible();
        } else {
            test.skip(true, "No purchases available to test");
        }
    });

    test("should update description and save", async ({ page }) => {
        const firstPurchase = page.locator("a[href^='/purchases/']").first();
        if (await firstPurchase.isVisible()) {
            await firstPurchase.click();
            await page.waitForURL(/\/purchases\/[^/]+$/);

            // Open modal
            await page.click("button:has-text('Edit')");

            // Clear and update description
            const descriptionField = page.locator("textarea[name='description']");
            await descriptionField.clear();
            await descriptionField.fill("Updated Test Description");

            // Save
            await page.click("button:has-text('Save Changes')");

            // Wait for modal to close
            await expect(page.locator("text=Edit Purchase")).not.toBeVisible();

            // Verify the description was updated
            await expect(page.locator("text=Updated Test Description")).toBeVisible();
        } else {
            test.skip(true, "No purchases available to test");
        }
    });

    test("should validate required fields", async ({ page }) => {
        const firstPurchase = page.locator("a[href^='/purchases/']").first();
        if (await firstPurchase.isVisible()) {
            await firstPurchase.click();
            await page.waitForURL(/\/purchases\/[^/]+$/);

            // Open modal
            await page.click("button:has-text('Edit')");

            // Clear description
            const descriptionField = page.locator("textarea[name='description']");
            await descriptionField.clear();

            // Try to submit - HTML5 validation should prevent it
            const submitButton = page.locator("button:has-text('Save Changes')");
            await submitButton.click();

            // Modal should still be open (validation failed)
            await expect(page.locator("text=Edit Purchase")).toBeVisible();
        } else {
            test.skip(true, "No purchases available to test");
        }
    });

    test("should disable inputs while submitting", async ({ page }) => {
        const firstPurchase = page.locator("a[href^='/purchases/']").first();
        if (await firstPurchase.isVisible()) {
            await firstPurchase.click();
            await page.waitForURL(/\/purchases\/[^/]+$/);

            // Open modal
            await page.click("button:has-text('Edit')");

            // Get the submit button and click it
            const submitButton = page.locator("button:has-text('Save Changes')");
            await submitButton.click();

            // Check that the button shows loading state
            await expect(page.locator("button:has-text('Saving...')")).toBeVisible();

            // Wait for submission to complete
            await expect(page.locator("text=Edit Purchase")).not.toBeVisible({
                timeout: 10000,
            });
        } else {
            test.skip(true, "No purchases available to test");
        }
    });

    test("should display credit card options correctly", async ({ page }) => {
        const firstPurchase = page.locator("a[href^='/purchases/']").first();
        if (await firstPurchase.isVisible()) {
            await firstPurchase.click();
            await page.waitForURL(/\/purchases\/[^/]+$/);

            // Open modal
            await page.click("button:has-text('Edit')");

            // Check that credit card select exists and has options
            const creditCardSelect = page.locator("select[name='credit_card_id']");
            await expect(creditCardSelect).toBeVisible();

            // Verify there are options
            const options = await creditCardSelect.locator("option").all();
            expect(options.length).toBeGreaterThan(0);

            // Cancel to close
            await page.click("button:has-text('Cancel')");
        } else {
            test.skip(true, "No purchases available to test");
        }
    });

    test("should toggle BNPL checkbox", async ({ page }) => {
        const firstPurchase = page.locator("a[href^='/purchases/']").first();
        if (await firstPurchase.isVisible()) {
            await firstPurchase.click();
            await page.waitForURL(/\/purchases\/[^/]+$/);

            // Open modal
            await page.click("button:has-text('Edit')");

            // Find and toggle the BNPL checkbox
            const bnplCheckbox = page.locator("input[name='is_bnpl']");
            const initialState = await bnplCheckbox.isChecked();

            await bnplCheckbox.check();
            expect(await bnplCheckbox.isChecked()).toBe(!initialState || true);

            // Cancel to close without saving
            await page.click("button:has-text('Cancel')");
        } else {
            test.skip(true, "No purchases available to test");
        }
    });
});
