const { test, expect } = require('@playwright/test');

async function login(page) {
    await page.goto('/login');
    await page.getByLabel(/Correo/i).fill(process.env.E2E_USER_EMAIL);
    await page.getByLabel(/Contra/i).fill(process.env.E2E_USER_PASSWORD);
    await page.getByRole('button', { name: /Iniciar/i }).click();
    await expect(page).toHaveURL(/\/$/);
}

test('redirige rutas privadas al login sin sesion', async ({ page }) => {
    await page.goto('/clients');
    await expect(page).toHaveURL(/\/login$/);
});

test('renderiza la experiencia actual de autenticacion', async ({ page }) => {
    await page.goto('/login');
    await expect(page.getByRole('heading', { name: /Iniciar/i })).toBeVisible();
    await expect(page.getByText(/Accede con tus credenciales de SaleySpa/i)).toBeVisible();
});

test.describe('smoke autenticado', () => {
    test.skip(
        !process.env.E2E_USER_EMAIL || !process.env.E2E_USER_PASSWORD,
        'Configura E2E_USER_EMAIL y E2E_USER_PASSWORD para ejecutar flujos autenticados.'
    );

    test('navega dashboard y modulos principales', async ({ page }) => {
        await login(page);

        await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();

        await page.getByRole('link', { name: 'Clientes' }).click();
        await expect(page).toHaveURL(/\/clients$/);
        await expect(page.getByRole('button', { name: 'Nuevo cliente' })).toBeVisible();

        await page.getByRole('link', { name: 'Productos' }).click();
        await expect(page).toHaveURL(/\/products$/);

        await page.getByRole('link', { name: 'Ventas' }).click();
        await expect(page).toHaveURL(/\/sales$/);

        await page.getByRole('link', { name: 'Facturas' }).click();
        await expect(page).toHaveURL(/\/invoices$/);
        await expect(page.getByRole('link', { name: 'Nueva factura' })).toBeVisible();

        await page.getByRole('link', { name: 'Movimientos' }).click();
        await expect(page).toHaveURL(/\/movements$/);
    });
});
