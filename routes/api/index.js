const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const slugify = require('slugify');
const { subDays } = require('date-fns');
const { fileTypeFromFile } = require('file-type');
const { asyncHandler } = require('../../utils/asyncHandler');
const { sendData, sendError } = require('../../utils/apiResponse');
const { isApiAuth, requireApiRoles } = require('../../middleware/apiAuth');
const { isAdminSession } = require('../../middleware/authorization');
const { parseIsoDate, toIsoDate } = require('../../utils/dateRange');
const { renderInvoicePdf } = require('../../utils/invoicePdf');
const {
    cancelAppointment,
    confirmAppointment,
    createAppointment,
    createAppointmentBlock,
    deleteAppointmentBlock,
    getAppointmentById,
    getAppointmentSettings,
    getAppointmentSummary,
    listAppointmentAvailability,
    listAppointments,
    updateAppointment,
    updateAppointmentSettings
} = require('../../services/appointmentsService');
const { getSalesAnalytics } = require('../../services/analyticsService');
const {
    createCategory,
    deleteCategory,
    getCategoryById,
    listCategories,
    updateCategory
} = require('../../services/categoriesService');
const {
    getClientById,
    createClient,
    getClientByHash,
    getClientProfileById,
    getClientProfileByHash,
    listClients,
    updateClientById,
    updateClient,
    updateClientAvatarById,
    updateClientAvatar
} = require('../../services/clientsService');
const { getDashboardSummary } = require('../../services/dashboardService');
const {
    createMovement,
    deleteMovement,
    getMovementById,
    listMovements,
    updateMovement
} = require('../../services/movementsService');
const {
    createProduct,
    getProductByHash,
    listProducts,
    updateProduct
} = require('../../services/productsService');
const {
    createSale,
    deactivateSale,
    getSaleById,
    listSales,
    updateSale
} = require('../../services/salesService');
const {
    createInvoice,
    getInvoiceById,
    listInvoiceCandidates,
    listInvoices,
    mergeInvoices,
    markInvoicePaid
} = require('../../services/invoicesService');

const router = express.Router();

const uploadsDir = path.join(__dirname, '..', '..', 'public', 'uploads');
fs.mkdirSync(uploadsDir, { recursive: true });

const allowedMimeTypes = new Set([
    'application/pdf',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'image/jpeg',
    'image/png',
    'image/webp'
]);

const ALLOWED_EXTENSIONS = new Set([
    '.pdf', '.xls', '.xlsx', '.doc', '.docx',
    '.jpg', '.jpeg', '.png', '.webp'
]);

async function verifyFileType(filePath) {
    try {
        const result = await fileTypeFromFile(filePath);
        if (!result || !allowedMimeTypes.has(result.mime)) {
            try { fs.unlinkSync(filePath); } catch (_e) {}
            return false;
        }
        return true;
    } catch (_err) {
        try { fs.unlinkSync(filePath); } catch (_e) {}
        return false;
    }
}

const storage = multer.diskStorage({
    destination: uploadsDir,
    filename: (_req, file, cb) => {
        const extension = path.extname(file.originalname);
        const basename = path.basename(file.originalname, extension);
        const safeName =
            slugify(basename, { lower: true, strict: true }) || 'adjunto';

        cb(null, `${Date.now()}-${safeName}${extension}`);
    }
});

const upload = multer({
    storage,
    limits: {
        fileSize: 10 * 1024 * 1024
    },
    fileFilter: (_req, file, cb) => {
        const ext = path.extname(file.originalname).toLowerCase();

        if (!ALLOWED_EXTENSIONS.has(ext)) {
            cb(new Error('Tipo de archivo no permitido'));
            return;
        }

        cb(null, true);
    }
});

function requireOwnClient(req, res) {
    const clientId = Number(req.session?.user?.client_id || 0);

    if (!clientId) {
        sendError(res, 403, 'Tu usuario no tiene un perfil de cliente asociado');
        return null;
    }

    return clientId;
}

function validateSaleDate(soldAt) {
    const parsedSaleDate = parseIsoDate(soldAt);

    if (!parsedSaleDate) {
        return 'La fecha de venta no es valida';
    }

    const today = parseIsoDate(toIsoDate(new Date()));
    const minDate = subDays(today, 30);

    if (parsedSaleDate < minDate || parsedSaleDate > today) {
        return `La fecha de venta debe estar entre ${toIsoDate(minDate)} y ${toIsoDate(today)}`;
    }

    return '';
}

function hasBlankValue(value) {
    return value === undefined || value === null || String(value).trim() === '';
}

function validateSalePayload(body = {}) {
    const required = ['client_id', 'product_id', 'quantity', 'unit_price', 'sold_at'];
    const missing = required.find(field => hasBlankValue(body[field]));
    if (missing) return `Falta el campo ${missing}`;

    if (!Number.isInteger(Number(body.client_id)) || Number(body.client_id) <= 0) {
        return 'Selecciona un cliente valido';
    }

    if (!Number.isInteger(Number(body.product_id)) || Number(body.product_id) <= 0) {
        return 'Selecciona un producto valido';
    }

    if (!Number.isInteger(Number(body.quantity)) || Number(body.quantity) <= 0) {
        return 'La cantidad debe ser mayor a cero';
    }

    if (!Number.isFinite(Number(body.unit_price)) || Number(body.unit_price) <= 0) {
        return 'El precio unitario debe ser mayor a cero';
    }

    return validateSaleDate(body.sold_at);
}

function validateMovementPayload(body = {}) {
    const required = ['date', 'type', 'amount', 'payment_type', 'category'];
    const missing = required.find(field => hasBlankValue(body[field]));
    if (missing) return 'Completa los campos obligatorios';

    if (!['gasto', 'ingreso'].includes(String(body.type))) {
        return 'El tipo de movimiento no es valido';
    }

    if (!Number.isFinite(Number(body.amount)) || Number(body.amount) <= 0) {
        return 'El monto debe ser mayor a cero';
    }

    if (!parseIsoDate(body.date)) {
        return 'La fecha del movimiento no es valida';
    }

    return '';
}

router.use(isApiAuth);

router.get(
    '/session',
    asyncHandler(async (req, res) => {
        sendData(res, req.session.user);
    })
);

router.get(
    '/dashboard',
    requireApiRoles('admin'),
    asyncHandler(async (req, res) => {
        const data = await getDashboardSummary({
            start: req.query.start,
            end: req.query.end,
            clientId: req.query.client_id || '',
            paid: req.query.paid || ''
        });

        sendData(res, data);
    })
);

router.get(
    '/analytics/sales',
    requireApiRoles('admin'),
    asyncHandler(async (req, res) => {
        const data = await getSalesAnalytics(req.query.year || '');
        sendData(res, data);
    })
);

router.get(
    '/clients',
    requireApiRoles('admin'),
    asyncHandler(async (req, res) => {
        const data = await listClients({ search: req.query.search || '' });
        sendData(res, data);
    })
);

router.get(
    '/clients/:hash',
    requireApiRoles('admin'),
    asyncHandler(async (req, res) => {
        const client = await getClientByHash(req.params.hash);
        if (!client) return sendError(res, 404, 'Cliente no encontrado');

        sendData(res, client);
    })
);

router.get(
    '/clients/:hash/profile',
    requireApiRoles('admin'),
    asyncHandler(async (req, res) => {
        const profile = await getClientProfileByHash(req.params.hash);
        if (!profile) return sendError(res, 404, 'Cliente no encontrado');

        sendData(res, profile);
    })
);

router.post(
    '/clients',
    requireApiRoles('admin'),
    asyncHandler(async (req, res) => {
        const { name, phone, address, complemento } = req.body || {};
        if (!name || !String(name).trim()) {
            return sendError(res, 400, 'El nombre es obligatorio');
        }

        const client = await createClient({
            name: String(name).trim(),
            phone: phone || '',
            address: address || '',
            complemento: complemento || ''
        });

        res.status(201);
        sendData(res, client);
    })
);

router.put(
    '/clients/:hash',
    requireApiRoles('admin'),
    asyncHandler(async (req, res) => {
        const { name, phone, address, complemento } = req.body || {};
        if (!name || !String(name).trim()) {
            return sendError(res, 400, 'El nombre es obligatorio');
        }

        const client = await updateClient(req.params.hash, {
            name: String(name).trim(),
            phone: phone || '',
            address: address || '',
            complemento: complemento || ''
        });

        if (!client) return sendError(res, 404, 'Cliente no encontrado');
        sendData(res, client);
    })
);

router.put(
    '/clients/:hash/avatar',
    requireApiRoles('admin'),
    asyncHandler(async (req, res) => {
        const client = await updateClientAvatar(
            req.params.hash,
            String(req.body?.avatar_emoji || '').trim()
        );

        if (!client) return sendError(res, 404, 'Cliente no encontrado');
        sendData(res, client);
    })
);

router.get(
    '/me/profile',
    asyncHandler(async (req, res) => {
        const clientId = requireOwnClient(req, res);
        if (!clientId) return;

        const profile = await getClientProfileById(clientId);
        if (!profile) return sendError(res, 404, 'Perfil no encontrado');

        sendData(res, profile);
    })
);

router.get(
    '/me/client',
    asyncHandler(async (req, res) => {
        const clientId = requireOwnClient(req, res);
        if (!clientId) return;

        const client = await getClientById(clientId);
        if (!client) return sendError(res, 404, 'Perfil no encontrado');

        sendData(res, client);
    })
);

router.put(
    '/me/client',
    asyncHandler(async (req, res) => {
        const clientId = requireOwnClient(req, res);
        if (!clientId) return;

        const { name, phone, address, complemento } = req.body || {};
        if (!name || !String(name).trim()) {
            return sendError(res, 400, 'El nombre es obligatorio');
        }

        const client = await updateClientById(clientId, {
            name: String(name).trim(),
            phone: phone || '',
            address: address || '',
            complemento: complemento || ''
        });

        req.session.user.username = client.name;
        sendData(res, client);
    })
);

router.put(
    '/me/avatar',
    asyncHandler(async (req, res) => {
        const clientId = requireOwnClient(req, res);
        if (!clientId) return;

        const client = await updateClientAvatarById(
            clientId,
            String(req.body?.avatar_emoji || '').trim()
        );

        sendData(res, client);
    })
);

router.get(
    '/appointments/settings',
    asyncHandler(async (_req, res) => {
        const data = await getAppointmentSettings();
        sendData(res, data);
    })
);

router.put(
    '/appointments/settings',
    requireApiRoles('admin'),
    asyncHandler(async (req, res) => {
        const data = await updateAppointmentSettings(req.body || {});
        sendData(res, data);
    })
);

router.get(
    '/appointments/summary',
    asyncHandler(async (req, res) => {
        const data = await getAppointmentSummary(
            req.query.date || '',
            isAdminSession(req) ? '' : req.session.user.client_id || ''
        );
        sendData(res, data);
    })
);

router.get(
    '/appointments/availability',
    asyncHandler(async (req, res) => {
        const data = await listAppointmentAvailability(
            req.query.date || '',
            req.query.product_id || '',
            req.query.duration_minutes || '',
            req.query.exclude_appointment_id || ''
        );
        sendData(res, data);
    })
);

router.get(
    '/appointments',
    asyncHandler(async (req, res) => {
        const data = await listAppointments({
            date: req.query.date || '',
            status: req.query.status || '',
            startDate: req.query.start_date || '',
            limit: req.query.limit || '',
            clientId: isAdminSession(req) ? '' : req.session.user.client_id || ''
        });
        sendData(res, data);
    })
);

router.post(
    '/appointments',
    asyncHandler(async (req, res) => {
        const payload = { ...(req.body || {}) };

        if (!isAdminSession(req)) {
            const clientId = requireOwnClient(req, res);
            if (!clientId) return;
            payload.client_id = clientId;
        }

        const appointment = await createAppointment(payload);
        res.status(201);
        sendData(res, appointment);
    })
);

router.patch(
    '/appointments/:id/confirm',
    requireApiRoles('admin'),
    asyncHandler(async (req, res) => {
        const appointment = await confirmAppointment(req.params.id);
        if (!appointment) return sendError(res, 404, 'Cita no encontrada');
        sendData(res, appointment);
    })
);

router.put(
    '/appointments/:id',
    asyncHandler(async (req, res) => {
        const clientId = isAdminSession(req)
            ? ''
            : requireOwnClient(req, res);

        if (!isAdminSession(req) && !clientId) {
            return;
        }

        const existingAppointment = await getAppointmentById(req.params.id, {
            clientId
        });

        if (!existingAppointment) {
            return sendError(res, 404, 'Cita no encontrada');
        }

        const payload = { ...(req.body || {}) };

        if (!isAdminSession(req)) {
            payload.client_id = clientId;
        }

        const appointment = await updateAppointment(req.params.id, payload);
        sendData(res, appointment);
    })
);

router.patch(
    '/appointments/:id/cancel',
    requireApiRoles('admin'),
    asyncHandler(async (req, res) => {
        const appointment = await cancelAppointment(
            req.params.id,
            req.body?.reason || ''
        );

        if (!appointment) return sendError(res, 404, 'Cita no encontrada');
        sendData(res, appointment);
    })
);

router.post(
    '/appointments/blocks',
    requireApiRoles('admin'),
    asyncHandler(async (req, res) => {
        const data = await createAppointmentBlock(req.body || {});
        res.status(201);
        sendData(res, data);
    })
);

router.delete(
    '/appointments/blocks/:id',
    requireApiRoles('admin'),
    asyncHandler(async (req, res) => {
        const data = await deleteAppointmentBlock(req.params.id, req.query.date || '');
        sendData(res, data);
    })
);

router.get(
    '/products',
    asyncHandler(async (req, res) => {
        const data = await listProducts({ search: req.query.search || '' });
        sendData(res, data);
    })
);

router.get(
    '/products/:hash',
    requireApiRoles('admin'),
    asyncHandler(async (req, res) => {
        const product = await getProductByHash(req.params.hash);
        if (!product) return sendError(res, 404, 'Producto no encontrado');

        sendData(res, product);
    })
);

router.post(
    '/products',
    requireApiRoles('admin'),
    asyncHandler(async (req, res) => {
        const { name, price, duration_minutes } = req.body || {};
        if (!name || !String(name).trim()) {
            return sendError(res, 400, 'El nombre es obligatorio');
        }

        if (!Number.isFinite(Number(price)) || Number(price) <= 0) {
            return sendError(res, 400, 'El precio debe ser mayor a cero');
        }

        if (!Number.isFinite(Number(duration_minutes)) || Number(duration_minutes) <= 0) {
            return sendError(res, 400, 'La duracion debe ser mayor a cero');
        }

        const product = await createProduct({
            name: String(name).trim(),
            price: Number(price),
            duration_minutes: Number(duration_minutes)
        });

        res.status(201);
        sendData(res, product);
    })
);

router.put(
    '/products/:hash',
    requireApiRoles('admin'),
    asyncHandler(async (req, res) => {
        const { name, price, duration_minutes } = req.body || {};
        if (!name || !String(name).trim()) {
            return sendError(res, 400, 'El nombre es obligatorio');
        }

        if (!Number.isFinite(Number(price)) || Number(price) <= 0) {
            return sendError(res, 400, 'El precio debe ser mayor a cero');
        }

        if (!Number.isFinite(Number(duration_minutes)) || Number(duration_minutes) <= 0) {
            return sendError(res, 400, 'La duracion debe ser mayor a cero');
        }

        const product = await updateProduct(req.params.hash, {
            name: String(name).trim(),
            price: Number(price),
            duration_minutes: Number(duration_minutes)
        });

        if (!product) return sendError(res, 404, 'Producto no encontrado');
        sendData(res, product);
    })
);

router.get(
    '/categories',
    requireApiRoles('admin'),
    asyncHandler(async (req, res) => {
        const data = await listCategories({ search: req.query.search || '' });
        sendData(res, data);
    })
);

router.get(
    '/categories/:id',
    requireApiRoles('admin'),
    asyncHandler(async (req, res) => {
        const category = await getCategoryById(req.params.id);
        if (!category) return sendError(res, 404, 'Categoria no encontrada');

        sendData(res, category);
    })
);

router.post(
    '/categories',
    requireApiRoles('admin'),
    asyncHandler(async (req, res) => {
        const { name } = req.body || {};
        if (!name || !String(name).trim()) {
            return sendError(res, 400, 'El nombre es obligatorio');
        }

        const category = await createCategory({ name: String(name).trim() });
        res.status(201);
        sendData(res, category);
    })
);

router.put(
    '/categories/:id',
    requireApiRoles('admin'),
    asyncHandler(async (req, res) => {
        const { name } = req.body || {};
        if (!name || !String(name).trim()) {
            return sendError(res, 400, 'El nombre es obligatorio');
        }

        const category = await updateCategory(req.params.id, {
            name: String(name).trim()
        });

        if (!category) return sendError(res, 404, 'Categoria no encontrada');
        sendData(res, category);
    })
);

router.delete(
    '/categories/:id',
    requireApiRoles('admin'),
    asyncHandler(async (req, res) => {
        await deleteCategory(req.params.id);
        res.status(204).end();
    })
);

router.get(
    '/sales',
    requireApiRoles('admin'),
    asyncHandler(async (req, res) => {
        const data = await listSales({
            start: req.query.start,
            end: req.query.end,
            clientId: req.query.client_id || '',
            paid: req.query.paid || ''
        });

        sendData(res, data);
    })
);

router.get(
    '/sales/:id',
    requireApiRoles('admin'),
    asyncHandler(async (req, res) => {
        const sale = await getSaleById(req.params.id);
        if (!sale) return sendError(res, 404, 'Venta no encontrada');

        sendData(res, sale);
    })
);

router.get(
    '/invoices',
    requireApiRoles('admin'),
    asyncHandler(async (req, res) => {
        const data = await listInvoices({
            start: req.query.start,
            end: req.query.end,
            clientId: req.query.client_id || '',
            status: req.query.status || '',
            search: req.query.search || ''
        });

        sendData(res, data);
    })
);

router.get(
    '/invoices/candidates',
    requireApiRoles('admin'),
    asyncHandler(async (req, res) => {
        const data = await listInvoiceCandidates(req.query.client_id);
        sendData(res, data);
    })
);

router.post(
    '/invoices',
    requireApiRoles('admin'),
    asyncHandler(async (req, res) => {
        const invoice = await createInvoice(req.body || {});
        res.status(201);
        sendData(res, invoice);
    })
);

router.post(
    '/invoices/merge',
    requireApiRoles('admin'),
    asyncHandler(async (req, res) => {
        const invoice = await mergeInvoices(req.body || {});
        sendData(res, invoice);
    })
);

router.patch(
    '/invoices/:publicId/pay',
    requireApiRoles('admin'),
    asyncHandler(async (req, res) => {
        const invoice = await markInvoicePaid(req.params.publicId, req.body || {});
        sendData(res, invoice);
    })
);

router.get(
    '/invoices/:publicId/pdf',
    requireApiRoles('admin'),
    asyncHandler(async (req, res) => {
        const invoice = await getInvoiceById(req.params.publicId);
        if (!invoice) return sendError(res, 404, 'Cuenta de cobro no encontrada');

        const download = req.query.download === '1';
        const safeFileName = `${invoice.invoice_number || 'cuenta-de-cobro'}.pdf`;

        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader(
            'Content-Disposition',
            `${download ? 'attachment' : 'inline'}; filename="${safeFileName}"`
        );

        renderInvoicePdf(invoice, res);
    })
);

router.get(
    '/invoices/:publicId',
    requireApiRoles('admin'),
    asyncHandler(async (req, res) => {
        const invoice = await getInvoiceById(req.params.publicId);
        if (!invoice) return sendError(res, 404, 'Cuenta de cobro no encontrada');

        sendData(res, invoice);
    })
);

router.post(
    '/sales',
    requireApiRoles('admin'),
    asyncHandler(async (req, res) => {
        const validationError = validateSalePayload(req.body);
        if (validationError) return sendError(res, 400, validationError);

        const sale = await createSale(req.body);
        res.status(201);
        sendData(res, sale);
    })
);

router.put(
    '/sales/:id',
    requireApiRoles('admin'),
    asyncHandler(async (req, res) => {
        const validationError = validateSalePayload(req.body);
        if (validationError) return sendError(res, 400, validationError);

        const sale = await updateSale(req.params.id, req.body);
        if (!sale) return sendError(res, 404, 'Venta no encontrada');

        sendData(res, sale);
    })
);

router.delete(
    '/sales/:id',
    requireApiRoles('admin'),
    asyncHandler(async (req, res) => {
        await deactivateSale(req.params.id);
        res.status(204).end();
    })
);

router.get(
    '/movements',
    requireApiRoles('admin'),
    asyncHandler(async (req, res) => {
        const { rows, meta } = await listMovements({
            start: req.query.start,
            end: req.query.end,
            page: req.query.page,
            pageSize: req.query.pageSize,
            sort: req.query.sort || 'date-desc'
        });

        sendData(res, rows, meta);
    })
);

router.get(
    '/movements/:id',
    requireApiRoles('admin'),
    asyncHandler(async (req, res) => {
        const movement = await getMovementById(req.params.id);
        if (!movement) return sendError(res, 404, 'Movimiento no encontrado');

        sendData(res, movement);
    })
);

router.post(
    '/movements',
    requireApiRoles('admin'),
    upload.single('attachment'),
    asyncHandler(async (req, res) => {
        const { date, type, amount, payment_type, category, description, account } =
            req.body || {};

        const validationError = validateMovementPayload(req.body);
        if (validationError) return sendError(res, 400, validationError);

        if (req.file) {
            const filePath = path.join(uploadsDir, req.file.filename);
            const valid = await verifyFileType(filePath);
            if (!valid) {
                return sendError(res, 400, 'El archivo no coincide con su tipo declarado');
            }
        }

        const movement = await createMovement({
            date,
            type,
            amount: Number(amount),
            payment_type,
            category,
            description,
            account,
            attachment: req.file ? req.file.filename : ''
        });

        res.status(201);
        sendData(res, movement);
    })
);

router.put(
    '/movements/:id',
    requireApiRoles('admin'),
    upload.single('attachment'),
    asyncHandler(async (req, res) => {
        const { date, type, amount, payment_type, category, description, account } =
            req.body || {};

        const validationError = validateMovementPayload(req.body);
        if (validationError) return sendError(res, 400, validationError);

        if (req.file) {
            const filePath = path.join(uploadsDir, req.file.filename);
            const valid = await verifyFileType(filePath);
            if (!valid) {
                return sendError(res, 400, 'El archivo no coincide con su tipo declarado');
            }
        }

        const movement = await updateMovement(req.params.id, {
            date,
            type,
            amount: Number(amount),
            payment_type,
            category,
            description,
            account,
            currentAttachment: req.body.currentAttachment,
            attachment: req.file ? req.file.filename : ''
        });

        if (!movement) return sendError(res, 404, 'Movimiento no encontrado');
        sendData(res, movement);
    })
);

router.delete(
    '/movements/:id',
    requireApiRoles('admin'),
    asyncHandler(async (req, res) => {
        await deleteMovement(req.params.id);
        res.status(204).end();
    })
);

module.exports = router;
