const { sql, query } = require('../../config/db');
const bcrypt = require('bcryptjs');
const { cargarPermisos, puedeVer } = require('../../Middlewares/permisos');
const { registrarAcceso } = require('../../utils/registroAcceso');

const login = async (req, res) => {
    console.log('Datos recibidos en /login:', req.body);
    try {
        const { username, password } = req.body;

        if (!username || !password) {
            return res.status(400).json({ message: 'El nombre de usuario y la contraseña son obligatorios' });
        }
        // 1. Consultar la base de datos para obtener el usuario
        const sqlQuery = 'SELECT * FROM usuario WHERE usuario = @username';

        const result = await query(sqlQuery, [
            { name: 'username', type: sql.VarChar, value: username }
        ]);

        if (result.length === 0) {
            registrarAcceso(req, { usuario: username, evento: 'login_fallido', exito: false });
            return res.status(401).json({ message: 'Usuario no encontrado o contraseña incorrecta' });
        }
        
        const usuario = result[0];

         // 2. Comparar la contraseña proporcionada con el hash almacenado
         const isMatch = await bcrypt.compare(password, usuario.password); // Aquí se compara con el hash almacenado

         if (!isMatch) {
             registrarAcceso(req, { idUsuario: usuario.id_usuario, usuario: usuario.usuario, nombre: usuario.nombre + ' ' + usuario.apellido, rol: usuario.rol, evento: 'login_fallido', exito: false });
             return res.status(401).json({ message: 'Contraseña incorrecta' });
         }
 
          // 3. Si la contraseña es correcta, crear la sesión

        // Cargar los permisos del rol (matriz + capacidades) desde la BDD
        const permisos = await cargarPermisos(usuario.rol);

        req.session.usuario = {
            username: usuario.usuario,
            nombre: usuario.nombre,
            apellido: usuario.apellido,
            role: usuario.rol,
            rolCodigo: permisos.rol,
            userId: usuario.id_usuario,
            tema: usuario.tema || 'light',
            permisos: permisos
        };

        // 4. Redirección: cualquier rol con acceso al mapa entra al index
        let redirect;
        if (puedeVer(permisos, 'mapa')) {
            redirect = '/index';
        } else {
            return res.status(403).json({ message: 'Rol de usuario no autorizado' });
        }

        // Registrar el ingreso exitoso en la bitácora
        registrarAcceso(req, {
            idUsuario: usuario.id_usuario,
            usuario: usuario.usuario,
            nombre: usuario.nombre + ' ' + usuario.apellido,
            rol: usuario.rol,
            evento: 'login',
            exito: true
        });

        // 5. Responder con la información necesaria
        return res.json({
            message: 'Sesión iniciada correctamente',
            redirect: redirect,
            userId: usuario.id_usuario, // Añadir el ID del usuario a la respuesta
            rol: usuario.rol // Opcional: también puedes enviar el rol si lo necesitas en el frontend
        });

    } catch (err) {
        console.error('Error en el inicio de sesión:', err);
        return res.status(500).json({ message: 'Error en el inicio de sesión' });
    }
};

const logout = (req, res) => {
    const u = (req.session && req.session.usuario) || null;
    if (u) {
        registrarAcceso(req, {
            idUsuario: u.userId,
            usuario: u.username,
            nombre: (u.nombre || '') + (u.apellido ? ' ' + u.apellido : ''),
            rol: u.role,
            evento: 'logout',
            exito: true
        });
    }
    req.session.destroy();
    res.status(200).json({ message: 'Sesión cerrada correctamente' });
};

module.exports = {
    login,
    logout
};