import { test, expect } from '@playwright/test'

test.describe('Application Health', () => {
  test('frontend loads successfully', async ({ page }) => {
    await page.goto('/')
    await expect(page).toHaveTitle(/BoxTasks/)
  })

  test('login page is accessible', async ({ page }) => {
    await page.goto('/login')
    // Should show login form or redirect to auth
    await expect(page.locator('body')).toBeVisible()
  })
})
