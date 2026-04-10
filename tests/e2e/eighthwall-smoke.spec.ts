import { expect, test } from '@playwright/test';

test('8th-wall route loads without constructor crash', async ({ page }) => {
  const hardFailures: string[] = [];

  page.on('pageerror', (error) => {
    hardFailures.push(`pageerror: ${error.message}`);
  });

  page.on('console', (message) => {
    const type = message.type();
    const text = message.text();

    if (type === 'error') {
      hardFailures.push(`console-error: ${text}`);
    }

    if (/a\[e\] is not a constructor/i.test(text)) {
      hardFailures.push(`constructor-crash: ${text}`);
    }
  });

  await page.goto('/#/image-target-demo-8thwall', { waitUntil: 'domcontentloaded' });

  await page.waitForTimeout(8000);

  await expect(page.locator('#x8-scene')).toHaveCount(1);

  const joined = hardFailures.join('\n');
  expect(joined).not.toMatch(/a\[e\] is not a constructor/i);

  const nonWhitelistedErrors = hardFailures.filter((entry) => {
    return !/Deprecation Warning: XR has been renamed to XR8/i.test(entry)
      && !/useLegacyLights has been deprecated/i.test(entry)
      && !/core:schema:warn Default value `0` does not match type `color`/i.test(entry);
  });

  expect(nonWhitelistedErrors, nonWhitelistedErrors.join('\n')).toEqual([]);
});
