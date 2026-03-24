import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter, Route, Routes, useLocation } from 'react-router-dom';
import AppShell from './components/AppShell';
import { ToastProvider } from './components/Toast';
import DashboardPage from './pages/DashboardPage';
import ClientsPage from './pages/ClientsPage';
import ClientProfilePage from './pages/ClientProfilePage';
import AppointmentsPage from './pages/AppointmentsPage';
import ProductsPage from './pages/ProductsPage';
import CategoriesPage from './pages/CategoriesPage';
import InvoicesPage from './pages/InvoicesPage';
import InvoiceFormPage from './pages/InvoiceFormPage';
import InvoiceDetailPage from './pages/InvoiceDetailPage';
import SalesListPage from './pages/SalesListPage';
import SalesFormPage from './pages/SalesFormPage';
import MovementsPage from './pages/MovementsPage';
import MovementsFormPage from './pages/MovementsFormPage';
import NotFoundPage from './pages/NotFoundPage';
import { getRouteMeta } from './lib/navigation';

const queryClient = new QueryClient({
    defaultOptions: {
        queries: {
            retry: 1,
            refetchOnWindowFocus: false
        }
    }
});

function RoutedApp() {
    const location = useLocation();
    const meta = getRouteMeta(location.pathname);

    return (
        <AppShell meta={meta}>
            <Routes>
                <Route path="/" element={<DashboardPage />} />
                <Route path="/clients" element={<ClientsPage />} />
                <Route path="/clients/new" element={<ClientsPage />} />
                <Route path="/clients/:hash" element={<ClientProfilePage />} />
                <Route path="/clients/:hash/edit" element={<ClientsPage />} />
                <Route path="/appointments" element={<AppointmentsPage />} />
                <Route path="/products" element={<ProductsPage />} />
                <Route path="/products/new" element={<ProductsPage />} />
                <Route path="/products/:hash/edit" element={<ProductsPage />} />
                <Route path="/invoices" element={<InvoicesPage />} />
                <Route path="/invoices/new" element={<InvoiceFormPage />} />
                <Route path="/invoices/:publicId" element={<InvoiceDetailPage />} />
                <Route path="/categories" element={<CategoriesPage />} />
                <Route path="/categories/new" element={<CategoriesPage />} />
                <Route path="/categories/:id/edit" element={<CategoriesPage />} />
                <Route path="/sales" element={<SalesListPage />} />
                <Route path="/sales/new" element={<SalesFormPage />} />
                <Route path="/sales/:id/edit" element={<SalesFormPage />} />
                <Route path="/movements" element={<MovementsPage />} />
                <Route path="/movements/new" element={<MovementsFormPage />} />
                <Route path="/movements/:id/edit" element={<MovementsFormPage />} />
                <Route path="*" element={<NotFoundPage />} />
            </Routes>
        </AppShell>
    );
}

export default function App() {
    return (
        <QueryClientProvider client={queryClient}>
            <ToastProvider>
                <BrowserRouter>
                    <RoutedApp />
                </BrowserRouter>
            </ToastProvider>
        </QueryClientProvider>
    );
}
