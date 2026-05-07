import { lazy, Suspense } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter, Route, Routes, useLocation } from 'react-router-dom';
import AppShell from './components/AppShell';
import { ToastProvider } from './components/Toast';
import ErrorBoundary from './components/ErrorBoundary';
import { getRouteMeta, getSessionUser } from './lib/navigation';

const DashboardPage = lazy(() => import('./pages/DashboardPage'));
const ClientsPage = lazy(() => import('./pages/ClientsPage'));
const ClientProfilePage = lazy(() => import('./pages/ClientProfilePage'));
const AppointmentsPage = lazy(() => import('./pages/AppointmentsPage'));
const ProductsPage = lazy(() => import('./pages/ProductsPage'));
const CategoriesPage = lazy(() => import('./pages/CategoriesPage'));
const InvoicesPage = lazy(() => import('./pages/InvoicesPage'));
const InvoiceFormPage = lazy(() => import('./pages/InvoiceFormPage'));
const InvoiceDetailPage = lazy(() => import('./pages/InvoiceDetailPage'));
const SalesListPage = lazy(() => import('./pages/SalesListPage'));
const SalesFormPage = lazy(() => import('./pages/SalesFormPage'));
const MovementsPage = lazy(() => import('./pages/MovementsPage'));
const MovementsFormPage = lazy(() => import('./pages/MovementsFormPage'));
const AnalyticsPage = lazy(() => import('./pages/AnalyticsPage'));
const NotFoundPage = lazy(() => import('./pages/NotFoundPage'));

const queryClient = new QueryClient({
    defaultOptions: {
        queries: {
            staleTime: 30 * 1000,
            gcTime: 5 * 60 * 1000,
            retry: 2,
            refetchOnWindowFocus: false
        }
    }
});

function PageLoader() {
    return (
        <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            minHeight: '60vh',
            color: 'var(--muted)',
            fontFamily: 'Plus Jakarta Sans, sans-serif'
        }}>
            Cargando...
        </div>
    );
}

function AdminRoute({ children }) {
    const user = getSessionUser();
    if (user.role !== 'admin') return null;
    return children;
}

function RoutedApp() {
    const location = useLocation();
    const meta = getRouteMeta(location.pathname);

    return (
        <AppShell meta={meta}>
            <Suspense fallback={<PageLoader />}>
                <Routes>
                    <Route path="/appointments" element={<AppointmentsPage />} />
                    <Route path="/profile" element={<ClientProfilePage />} />
                    <Route path="/profile/edit" element={<ClientsPage />} />
                    <Route path="/" element={<AdminRoute><DashboardPage /></AdminRoute>} />
                    <Route path="/clients" element={<AdminRoute><ClientsPage /></AdminRoute>} />
                    <Route path="/clients/new" element={<AdminRoute><ClientsPage /></AdminRoute>} />
                    <Route path="/clients/:hash" element={<AdminRoute><ClientProfilePage /></AdminRoute>} />
                    <Route path="/clients/:hash/edit" element={<AdminRoute><ClientsPage /></AdminRoute>} />
                    <Route path="/products" element={<AdminRoute><ProductsPage /></AdminRoute>} />
                    <Route path="/products/new" element={<AdminRoute><ProductsPage /></AdminRoute>} />
                    <Route path="/products/:hash/edit" element={<AdminRoute><ProductsPage /></AdminRoute>} />
                    <Route path="/invoices" element={<AdminRoute><InvoicesPage /></AdminRoute>} />
                    <Route path="/invoices/new" element={<AdminRoute><InvoiceFormPage /></AdminRoute>} />
                    <Route path="/invoices/:publicId" element={<AdminRoute><InvoiceDetailPage /></AdminRoute>} />
                    <Route path="/categories" element={<AdminRoute><CategoriesPage /></AdminRoute>} />
                    <Route path="/categories/new" element={<AdminRoute><CategoriesPage /></AdminRoute>} />
                    <Route path="/categories/:id/edit" element={<AdminRoute><CategoriesPage /></AdminRoute>} />
                    <Route path="/sales" element={<AdminRoute><SalesListPage /></AdminRoute>} />
                    <Route path="/sales/new" element={<AdminRoute><SalesFormPage /></AdminRoute>} />
                    <Route path="/sales/:id/edit" element={<AdminRoute><SalesFormPage /></AdminRoute>} />
                    <Route path="/analytics" element={<AdminRoute><AnalyticsPage /></AdminRoute>} />
                    <Route path="/movements" element={<AdminRoute><MovementsPage /></AdminRoute>} />
                    <Route path="/movements/new" element={<AdminRoute><MovementsFormPage /></AdminRoute>} />
                    <Route path="/movements/:id/edit" element={<AdminRoute><MovementsFormPage /></AdminRoute>} />
                    <Route path="*" element={<NotFoundPage />} />
                </Routes>
            </Suspense>
        </AppShell>
    );
}

export default function App() {
    return (
        <ErrorBoundary>
            <QueryClientProvider client={queryClient}>
                <ToastProvider>
                    <BrowserRouter>
                        <RoutedApp />
                    </BrowserRouter>
                </ToastProvider>
            </QueryClientProvider>
        </ErrorBoundary>
    );
}
