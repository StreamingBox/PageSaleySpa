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
import ConversationsAdminPage from './pages/ConversationsAdminPage';
import MovementsPage from './pages/MovementsPage';
import MovementsFormPage from './pages/MovementsFormPage';
import AnalyticsPage from './pages/AnalyticsPage';
import NotFoundPage from './pages/NotFoundPage';
import { getRouteMeta, getSessionUser } from './lib/navigation';

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
    const user = getSessionUser();
    const isAdmin = user.role === 'admin';

    return (
        <AppShell meta={meta}>
            <Routes>
                <Route path="/appointments" element={<AppointmentsPage />} />
                <Route path="/profile" element={<ClientProfilePage />} />
                <Route path="/profile/edit" element={<ClientsPage />} />
                {isAdmin ? <Route path="/" element={<DashboardPage />} /> : null}
                {isAdmin ? <Route path="/clients" element={<ClientsPage />} /> : null}
                {isAdmin ? <Route path="/clients/new" element={<ClientsPage />} /> : null}
                {isAdmin ? <Route path="/clients/:hash" element={<ClientProfilePage />} /> : null}
                {isAdmin ? <Route path="/clients/:hash/edit" element={<ClientsPage />} /> : null}
                {isAdmin ? <Route path="/products" element={<ProductsPage />} /> : null}
                {isAdmin ? <Route path="/products/new" element={<ProductsPage />} /> : null}
                {isAdmin ? <Route path="/products/:hash/edit" element={<ProductsPage />} /> : null}
                {isAdmin ? <Route path="/invoices" element={<InvoicesPage />} /> : null}
                {isAdmin ? <Route path="/invoices/new" element={<InvoiceFormPage />} /> : null}
                {isAdmin ? <Route path="/invoices/:publicId" element={<InvoiceDetailPage />} /> : null}
                {isAdmin ? <Route path="/categories" element={<CategoriesPage />} /> : null}
                {isAdmin ? <Route path="/categories/new" element={<CategoriesPage />} /> : null}
                {isAdmin ? <Route path="/categories/:id/edit" element={<CategoriesPage />} /> : null}
                {isAdmin ? <Route path="/sales" element={<SalesListPage />} /> : null}
                {isAdmin ? <Route path="/sales/new" element={<SalesFormPage />} /> : null}
                {isAdmin ? <Route path="/sales/:id/edit" element={<SalesFormPage />} /> : null}
                {isAdmin ? <Route path="/conversations" element={<ConversationsAdminPage />} /> : null}
                {isAdmin ? <Route path="/conversations/new" element={<ConversationsAdminPage />} /> : null}
                {isAdmin ? <Route path="/conversations/:id/edit" element={<ConversationsAdminPage />} /> : null}
                {isAdmin ? <Route path="/analytics" element={<AnalyticsPage />} /> : null}
                {isAdmin ? <Route path="/movements" element={<MovementsPage />} /> : null}
                {isAdmin ? <Route path="/movements/new" element={<MovementsFormPage />} /> : null}
                {isAdmin ? <Route path="/movements/:id/edit" element={<MovementsFormPage />} /> : null}
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
