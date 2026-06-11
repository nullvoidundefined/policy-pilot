import { expect, test } from '@playwright/test';
import path from 'path';

const TEST_EMAIL = 'e2e-user@integration-test.invalid';
const TEST_PASSWORD = 'testpassword123';
const POLICY_FIXTURE = path.resolve(
  process.cwd(),
  'apps/worker/src/__integration__/fixtures/policy.txt',
);
const READY_STATUS_LABEL = 'Cleared for takeoff';
const PROCESSING_TIMEOUT_MS = 120_000;

test('upload a policy document and receive a cited answer', async ({
  page,
}) => {
  // Login
  await page.goto('/login');
  await page.fill('input[type="email"]', TEST_EMAIL);
  await page.fill('input[type="password"]', TEST_PASSWORD);
  await page.click('button[type="submit"]');
  await expect(page).toHaveURL(/\/dashboard/, { timeout: 10_000 });

  // Get CSRF token (the browser session cookie is already set after login)
  const csrfRes = await page.request.get(
    'http://localhost:3001/api/csrf-token',
  );
  expect(csrfRes.ok()).toBeTruthy();
  const { token: csrfToken } = (await csrfRes.json()) as { token: string };

  // Create a user-owned collection via API (demo collections block uploads)
  const collectionName = `E2E RAG Test ${Date.now()}`;
  const colRes = await page.request.post('http://localhost:3001/collections', {
    headers: {
      'Content-Type': 'application/json',
      'X-CSRF-Token': csrfToken,
      'X-Requested-With': 'XMLHttpRequest',
    },
    data: JSON.stringify({ name: collectionName }),
  });
  expect(colRes.ok()).toBeTruthy();
  const { collection } = (await colRes.json()) as {
    collection: { id: string };
  };
  const collectionId = collection.id;
  expect(collectionId).toBeTruthy();

  // Navigate to the collection page and upload the policy document
  await page.goto(`/collections/${collectionId}`);
  await expect(page.locator('h1')).toContainText(collectionName, {
    timeout: 5_000,
  });

  const fileInput = page.locator('input[type="file"]');
  await fileInput.setInputFiles(POLICY_FIXTURE);

  // Wait for upload to complete (button re-enables)
  await expect(
    page.locator('button[aria-label="Upload a document"]'),
  ).not.toBeDisabled({
    timeout: 15_000,
  });

  // Poll via the page's built-in 5-second refetch until status is "Cleared for takeoff"
  await expect(page.locator(`text=${READY_STATUS_LABEL}`)).toBeVisible({
    timeout: PROCESSING_TIMEOUT_MS,
  });

  // Navigate to chat
  await page.click('button[aria-label="Start chatting about this collection"]');
  await expect(page).toHaveURL(new RegExp(`/chat/${collectionId}`), {
    timeout: 5_000,
  });

  // Ask a question and wait for a cited answer
  await page.fill(
    'input[placeholder="Ask a question about your policies..."]',
    'What is the eligibility requirement for remote work?',
  );
  await page.click('button[type="submit"]');

  await expect(page.locator('[class*="bubble"]').last()).toContainText('[1]', {
    timeout: 30_000,
  });
});
