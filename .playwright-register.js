await (async () => {
  await page.locator('#username').fill('codex0323160101');
  await page.locator('#email').fill('codex0323160101@example.com');
  await page.locator('#password').fill('Codex123!');
  await page.getByRole('button', { name: 'Guardar acceso' }).click();
  await page.waitForURL('**/login');
})();
