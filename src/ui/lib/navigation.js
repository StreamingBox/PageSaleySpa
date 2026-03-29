import {
    ChartColumnBig,
    CalendarDays,
    Boxes,
    CircleDollarSign,
    FileText,
    LayoutDashboard,
    Package2,
    ReceiptText,
    UserRound,
    Users2
} from 'lucide-react';
import { matchPath } from 'react-router-dom';

export function getSessionUser() {
    return window.__APP_STATE__?.user || {};
}

function isAdminUser() {
    return getSessionUser().role === 'admin';
}

const adminNavigationItems = [
    {
        to: '/',
        label: 'Dashboard',
        icon: LayoutDashboard
    },
    {
        to: '/clients',
        label: 'Clientes',
        icon: Users2
    },
    {
        to: '/appointments',
        label: 'Citas',
        icon: CalendarDays
    },
    {
        to: '/products',
        label: 'Productos',
        icon: Package2
    },
    {
        to: '/invoices',
        label: 'Facturas',
        icon: FileText
    },
    {
        to: '/sales',
        label: 'Ventas',
        icon: CircleDollarSign
    },
    {
        to: '/analytics',
        label: 'Estadisticas',
        icon: ChartColumnBig
    },
    {
        to: '/movements',
        label: 'Movimientos',
        icon: ReceiptText
    },
    {
        to: '/categories',
        label: 'Categorias',
        icon: Boxes
    }
];

const userNavigationItems = [
    {
        to: '/appointments',
        label: 'Citas',
        icon: CalendarDays
    },
    {
        to: '/profile',
        label: 'Mi perfil',
        icon: UserRound
    }
];

export const navigationItems = isAdminUser() ? adminNavigationItems : userNavigationItems;
export const mobileNavigationItems = navigationItems;

const adminRouteMeta = [
    {
        pattern: '/',
        exact: true,
        title: 'Dashboard',
        description: 'Resumen de ventas, clientes y movimientos del spa.'
    },
    {
        pattern: '/clients/:hash',
        exact: true,
        title: 'Perfil de cliente',
        description: 'Resumen de contacto, compras y facturacion del cliente.'
    },
    {
        pattern: '/clients/*',
        title: 'Clientes',
        description: 'Gestion rapida de clientes, busqueda y edicion contextual.'
    },
    {
        pattern: '/appointments',
        exact: true,
        title: 'Citas',
        description: 'Agenda, bloqueos, reservas y accesos directos a Google Calendar y Maps.'
    },
    {
        pattern: '/products/*',
        title: 'Productos',
        description: 'Servicios y productos con un catalogo mas claro y editable.'
    },
    {
        pattern: '/invoices/new',
        exact: true,
        title: 'Nueva factura',
        description: 'Agrupa ventas pendientes de un mismo cliente y genera un PDF numerado.'
    },
    {
        pattern: '/invoices/:publicId',
        exact: true,
        title: 'Detalle de factura',
        description: 'Consulta, descarga y marca pagos sobre la factura emitida.'
    },
    {
        pattern: '/invoices',
        exact: true,
        title: 'Facturas',
        description: 'Archivo de facturas con filtros, consulta y descarga del PDF.'
    },
    {
        pattern: '/sales/new',
        exact: true,
        title: 'Editor de ventas',
        description: 'Formulario con calculo en vivo y validacion clara.'
    },
    {
        pattern: '/sales/:id/edit',
        exact: true,
        title: 'Editor de ventas',
        description: 'Formulario con calculo en vivo y validacion clara.'
    },
    {
        pattern: '/movements/new',
        exact: true,
        title: 'Editor de movimientos',
        description: 'Registra ingresos y gastos con adjuntos y categorias dinamicas.'
    },
    {
        pattern: '/movements/:id/edit',
        exact: true,
        title: 'Editor de movimientos',
        description: 'Registra ingresos y gastos con adjuntos y categorias dinamicas.'
    },
    {
        pattern: '/sales',
        exact: true,
        title: 'Ventas',
        description: 'Filtros persistentes, exportacion y control de estado de pago.'
    },
    {
        pattern: '/analytics',
        exact: true,
        title: 'Estadisticas',
        description: 'Analitica visual de ventas, comparativas y top servicios.'
    },
    {
        pattern: '/movements',
        exact: true,
        title: 'Movimientos',
        description: 'Movimientos del spa con paginacion, adjuntos y lectura inmediata.'
    },
    {
        pattern: '/categories/*',
        title: 'Categorias',
        description: 'Organiza el catalogo sin salir del flujo principal.'
    }
];

const userRouteMeta = [
    {
        pattern: '/appointments',
        exact: true,
        title: 'Mis citas',
        description: 'Agenda una cita nueva y consulta el estado de tus reservas.'
    },
    {
        pattern: '/profile',
        exact: true,
        title: 'Mi perfil',
        description: 'Consulta y actualiza tus datos personales.'
    },
    {
        pattern: '/profile/edit',
        exact: true,
        title: 'Editar perfil',
        description: 'Actualiza tus datos personales registrados.'
    }
];

export function getRouteMeta(pathname) {
    const routeMeta = isAdminUser() ? adminRouteMeta : userRouteMeta;
    const match = routeMeta.find(item =>
        matchPath({ path: item.pattern, end: Boolean(item.exact) }, pathname)
    );

    return (
        match || {
            title: 'SaleySpa',
            description: 'Gestion diaria del spa.'
        }
    );
}
