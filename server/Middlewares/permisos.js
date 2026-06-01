/* permisos.js
   Módulo central del modelo de permisos (RBAC).
   Lee la matriz rol -> apartado -> nivel y las capacidades desde la BDD,
   las cachea en memoria, y expone helpers + middleware para usar en rutas. */

const { sql, query } = require('../config/db');

// Normaliza el rol al código del maestro 'rol' (en minúsculas).
function normalizarRol(rol) {
    return rol ? String(rol).toLowerCase() : null;
}

// Caché en memoria: rolCodigo -> { perms, ts }. Con TTL para que los cambios
// en la matriz (BDD) se reflejen solos, sin reiniciar el servidor.
const cache = new Map();
const CACHE_TTL_MS = 5 * 60 * 1000;   // 5 minutos
const ROL_RECHECK_MS = 30 * 1000;     // re-chequear el rol del usuario cada 30 s

async function cargarPermisos(rol) {
    const codigo = normalizarRol(rol);
    if (!codigo) return { rol: null, apartados: {}, capacidades: [] };
    const cached = cache.get(codigo);
    if (cached && (Date.now() - cached.ts) < CACHE_TTL_MS) return cached.perms;

    const apRows = await query(`
        SELECT a.codigo AS apartado, n.codigo AS nivel
        FROM rol_apartado_permiso rap
        JOIN rol r          ON r.id_rol      = rap.id_rol
        JOIN apartado a     ON a.id_apartado = rap.id_apartado
        JOIN nivel_acceso n ON n.id_nivel    = rap.id_nivel
        WHERE r.codigo = @rol`,
        [{ name: 'rol', type: sql.NVarChar, value: codigo }]);

    const capRows = await query(`
        SELECT c.codigo AS capacidad
        FROM rol_capacidad rc
        JOIN rol r       ON r.id_rol       = rc.id_rol
        JOIN capacidad c ON c.id_capacidad = rc.id_capacidad
        WHERE r.codigo = @rol`,
        [{ name: 'rol', type: sql.NVarChar, value: codigo }]);

    const apartados = {};
    (apRows || []).forEach((row) => { apartados[row.apartado] = row.nivel; });
    const capacidades = (capRows || []).map((row) => row.capacidad);

    const perms = { rol: codigo, apartados, capacidades };
    cache.set(codigo, { perms, ts: Date.now() });
    return perms;
}

// Lee el rol actual de un usuario desde la BDD (para reflejar cambios de rol)
async function rolActualDeUsuario(userId) {
    if (!userId) return null;
    const r = await query('SELECT rol FROM usuario WHERE id_usuario = @id', [
        { name: 'id', type: sql.Int, value: parseInt(userId) }
    ]);
    return (r && r.length) ? r[0].rol : null;
}

// Vaciar la caché (útil si se editan permisos en la BDD sin reiniciar)
function limpiarCache() { cache.clear(); }

/* ---------- Helpers sobre un objeto perms ---------- */
const RANK = { N: 0, L: 1, A: 2 };

function nivelDe(perms, apartado) {
    return (perms && perms.apartados && perms.apartados[apartado]) || 'N';
}
function puedeVer(perms, apartado)      { return RANK[nivelDe(perms, apartado)] >= RANK.L; }
function puedeAccionar(perms, apartado) { return RANK[nivelDe(perms, apartado)] >= RANK.A; }
function tieneCapacidad(perms, cap)     { return !!(perms && perms.capacidades && perms.capacidades.includes(cap)); }

/* ---------- Middleware ---------- */

// Carga los permisos en la sesión si faltan, y los expone en res.locals.
// Se monta una vez, después del middleware de sesión.
async function asegurarPermisos(req, res, next) {
    try {
        const u = req.session && req.session.usuario;
        if (u) {
            // Re-leer el rol desde la BDD cada cierto tiempo: refleja cambios de
            // rol hechos por un admin sin obligar a cerrar y abrir sesión.
            const ahora = Date.now();
            if (!u._rolChequeado || (ahora - u._rolChequeado) > ROL_RECHECK_MS) {
                const rolBD = await rolActualDeUsuario(u.userId);
                if (rolBD && rolBD !== u.role) u.role = rolBD;
                u._rolChequeado = ahora;
            }
            // Refrescar permisos desde la matriz (cacheada con TTL)
            u.permisos = await cargarPermisos(u.role);
            u.rolCodigo = u.permisos.rol;
        }
    } catch (err) {
        console.error('Error cargando permisos:', err);
    }
    const perms = (req.session && req.session.usuario && req.session.usuario.permisos) || null;
    res.locals.permisos       = perms;
    res.locals.puedeVer       = (apartado) => puedeVer(perms, apartado);
    res.locals.puedeAccionar  = (apartado) => puedeAccionar(perms, apartado);
    res.locals.tieneCapacidad = (cap) => tieneCapacidad(perms, cap);
    res.locals.esAdmin        = !!(perms && perms.rol === 'administrador');
    next();
}

function permisosSesion(req) {
    return (req.session && req.session.usuario && req.session.usuario.permisos) || null;
}

// Responde según el tipo de petición: API -> 403 JSON; página -> redirección.
function denegar(req, res) {
    const esApi = req.originalUrl.startsWith('/api') ||
        req.xhr ||
        (req.headers.accept || '').includes('application/json');
    if (esApi) return res.status(403).json({ message: 'Acceso denegado' });
    return res.redirect('/index?alert=sin-permiso');
}

function requiereLogin(req, res, next) {
    if (!req.session || !req.session.usuario) {
        const esApi = req.originalUrl.startsWith('/api') ||
            req.xhr || (req.headers.accept || '').includes('application/json');
        if (esApi) return res.status(401).json({ message: 'No autenticado' });
        return res.redirect('/login?alert=login-required');
    }
    next();
}

function requiereVer(apartado) {
    return (req, res, next) => {
        if (!req.session || !req.session.usuario) return res.redirect('/login?alert=login-required');
        if (puedeVer(permisosSesion(req), apartado)) return next();
        return denegar(req, res);
    };
}
function requiereVerAlguno(apartados) {
    return (req, res, next) => {
        if (!req.session || !req.session.usuario) return res.redirect('/login?alert=login-required');
        const perms = permisosSesion(req);
        if ((apartados || []).some((a) => puedeVer(perms, a))) return next();
        return denegar(req, res);
    };
}
function requiereAccion(apartado) {
    return (req, res, next) => {
        if (!req.session || !req.session.usuario) return res.redirect('/login?alert=login-required');
        if (puedeAccionar(permisosSesion(req), apartado)) return next();
        return denegar(req, res);
    };
}
function requiereCapacidad(cap) {
    return (req, res, next) => {
        if (!req.session || !req.session.usuario) return res.redirect('/login?alert=login-required');
        if (tieneCapacidad(permisosSesion(req), cap)) return next();
        return denegar(req, res);
    };
}

module.exports = {
    normalizarRol,
    cargarPermisos,
    limpiarCache,
    nivelDe,
    puedeVer,
    puedeAccionar,
    tieneCapacidad,
    asegurarPermisos,
    requiereLogin,
    requiereVer,
    requiereVerAlguno,
    requiereAccion,
    requiereCapacidad
};