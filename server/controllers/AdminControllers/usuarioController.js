const { sql, query } = require('../../config/db'); // Importa la funciónes pra consultas y sql para trabar con SQL Server
const bcrypt = require('bcryptjs');
const { camposFaltantes, esEnteroPositivo } = require('../../utils/validar');
const { registrarAuditoria } = require('../../utils/auditoria');

/************************   
***** USUARIO ******
 *************************/
const getUsuario = async (req, res) => {
    const sqlQuery = `SELECT id,[Nombre Completo], rut, correo, rol, usuario, password from vw_usuario`;
    try {
        const result = await query(sqlQuery);
        res.json(result);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// Crear un nuevo ítem
// Valida que el rol exista en el maestro 'rol'
async function rolEsValido(rol) {
    if (!rol) return false;
    const r = await query('SELECT 1 AS ok FROM rol WHERE codigo = @rol', [
        { name: 'rol', type: sql.NVarChar, value: rol }
    ]);
    return !!(r && r.length);
}
// Cuenta cuántos administradores hay
async function contarAdministradores() {
    const r = await query("SELECT COUNT(*) AS n FROM usuario WHERE rol = 'administrador'");
    return (r && r[0]) ? r[0].n : 0;
}
// Devuelve el rol actual de un usuario por id
async function rolDeUsuario(id) {
    const r = await query('SELECT rol FROM usuario WHERE id_usuario = @id', [
        { name: 'id', type: sql.Int, value: parseInt(id) }
    ]);
    return (r && r.length) ? r[0].rol : null;
}

const createUsuario = async (req, res) => {
    // Extraer datos del cuerpo de la solicitud
    const { correo, password, usuario, rut, dv_rut, nombre, apellido, rol } = req.body;

    // --- Validación de entrada (antes de hashear o tocar la BDD) ---
    const faltan = camposFaltantes(
        { password, usuario, rut, dv_rut, nombre, apellido, rol },
        ['password', 'usuario', 'rut', 'dv_rut', 'nombre', 'apellido', 'rol']
    );
    if (faltan.length) {
        return res.status(400).json({ error: 'Faltan campos obligatorios: ' + faltan.join(', ') + '.' });
    }
    if (!esEnteroPositivo(rut)) {
        return res.status(400).json({ error: 'El RUT debe ser numérico, sin puntos ni dígito verificador.' });
    }
    if (!/^[0-9kK]$/.test(String(dv_rut))) {
        return res.status(400).json({ error: 'El dígito verificador debe ser un número o la letra K.' });
    }

    // Primero, verificar si el RUT ya existe en la base de datos
    const checkRutQuery = `
        SELECT COUNT(*) AS count FROM USUARIO WHERE rut = @rut
    `;

    try {
        const checkResult = await query(checkRutQuery, [
            { name: 'rut', type: sql.Int, value: rut } // Asegúrate de convertirlo al tipo correcto
        ]);

        // Si el RUT ya existe, devolver un error
        if (checkResult[0].count > 0) {
            return res.status(400).json({ error: 'El RUT ya está registrado.' });
        }

        // Validar que el rol exista en el maestro de roles
        if (!(await rolEsValido(rol))) {
            return res.status(400).json({ error: 'Rol inválido.' });
        }

    // 2. Hashear la contraseña
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);
    const sqlQuery = `
        INSERT INTO USUARIO (correo, password, usuario, rut, dv_rut, nombre, apellido, rol) 
        OUTPUT INSERTED.id_usuario
        VALUES (@correo, @password, @usuario, @rut, @dv_rut, @nombre, @apellido, @rol)
    `;

        // Ejecutar la consulta SQL con los parámetros correspondientes
        const result = await query(sqlQuery, [
            { name: 'correo', type: sql.VarChar, value: correo },
            { name: 'password', type: sql.VarChar, value: hashedPassword }, // Usar la contraseña hasheada
            { name: 'usuario', type: sql.VarChar, value: usuario },
            { name: 'rut', type: sql.Int, value: rut }, // Asegúrate de convertirlo al tipo correcto
            { name: 'dv_rut', type: sql.Char, value: dv_rut },
            { name: 'nombre', type: sql.VarChar, value: nombre },
            { name: 'apellido', type: sql.VarChar, value: apellido },
            { name: 'rol', type: sql.VarChar, value: rol }
        ]);


        // Responder con el resultado de la inserción y código 201 (creado)
        const nuevoId = (result && result[0]) ? result[0].id_usuario : null;
        await registrarAuditoria(req, { entidad: 'usuario', accion: 'crear', idEntidad: nuevoId, detalle: 'usuario ' + usuario + ' (rol ' + rol + ')' });
        res.status(201).json(result);
    } catch (error) {
        console.error('Error al crear ítem:', error.message);
        res.status(500).json({ error: error.message });
    }
};

// Leer los datos de un ítem por ID para rellenar el formulario de edición

// Leer los datos de un ítem por ID para rellenar el formulario de edición
//SE UTILIZA EN EL CRUD
const getUsuarioById = async (req, res) => {
    // Extraer el ID del parámetro de la solicitud
    const { id } = req.params;

    try {
        const sqlQuery = `
            SELECT id_usuario, correo, password, usuario, rut, dv_rut, nombre, apellido, rol 
            FROM usuario 
            WHERE id_usuario = @id
        `;
        
        // Ejecutar la consulta pasando el ID como parámetro
        const result = await query(sqlQuery, [
            { name: 'id', type: sql.Int, value: id } // Convertir el ID a entero antes de pasarlo a la consulta
        ]);

        // Verificar si se encontró algún ítem
        if (result.length > 0) {
            // Si se encontró, devolver el primer ítem en formato JSON
            res.json(result[0]);
        } else {
            res.status(404).json({ error: 'Ítem no encontrado' });
        }
    } catch (error) {
        console.error('Error al obtener ítem:', error.message); // Registrar el error en la consola para depuración
        res.status(500).json({ error: error.message });
    }
};

const GetUserId = async (id) => {
    try {
        const sqlQuery = `
            SELECT id_usuario, correo, password, usuario, rut, dv_rut, nombre, apellido, rol 
            FROM usuario 
            WHERE id_usuario = @id
        `;

        const result = await query(sqlQuery, [
            { name: 'id', type: sql.Int, value: parseInt(id) } // Convertir el ID a entero antes de pasarlo a la consulta
        ]);

        return result[0] || null; // Devuelve el primer resultado o null si no se encuentra
    } catch (error) {
        console.error('Error al obtener el usuario por ID:', error.message);
        throw error;
    }
};


// Actualizar un ítem
const updateUsuario = async (req, res) => {
    const { id } = req.params; // Obtiene el ID del ítem desde la URL
    const { correo, password, usuario, rut, dv_rut, nombre, apellido, rol } = req.body;
    
    // --- Validación de entrada ---
    if (!esEnteroPositivo(id)) {
        return res.status(400).json({ error: 'ID inválido.' });
    }
    const faltan = camposFaltantes(
        { usuario, rut, dv_rut, nombre, apellido, rol },
        ['usuario', 'rut', 'dv_rut', 'nombre', 'apellido', 'rol']
    );
    if (faltan.length) {
        return res.status(400).json({ error: 'Faltan campos obligatorios: ' + faltan.join(', ') + '.' });
    }
    if (!esEnteroPositivo(rut)) {
        return res.status(400).json({ error: 'El RUT debe ser numérico, sin puntos ni dígito verificador.' });
    }
    if (!/^[0-9kK]$/.test(String(dv_rut))) {
        return res.status(400).json({ error: 'El dígito verificador debe ser un número o la letra K.' });
    }

    const sqlQuery = `
        UPDATE usuario 
        SET correo = @correo,
            usuario = @usuario,
            rut = @rut,
            dv_rut = @dv_rut,
            nombre = @nombre, 
            apellido = @apellido,
            rol = @rol
        WHERE id_usuario = @id
    `;

    try {
        // Validar rol y proteger al último administrador
        if (!(await rolEsValido(rol))) {
            return res.status(400).json({ error: 'Rol inválido.' });
        }
        const rolActual = await rolDeUsuario(id);
        if (rolActual === 'administrador' && rol !== 'administrador' && (await contarAdministradores()) <= 1) {
            return res.status(409).json({ error: 'No se puede quitar el rol de administrador al último administrador.' });
        }
        // Crea los parámetros para la consulta
        await query(sqlQuery, [
            { name: 'correo', type: sql.VarChar, value: correo },
            //{ name: 'password', type: sql.VarChar, value: password },
            { name: 'usuario', type: sql.VarChar, value: usuario },
            { name: 'rut', type: sql.Int, value: rut }, // Asegúrate de convertirlo al tipo correcto
            { name: 'dv_rut', type: sql.Char, value: dv_rut },
            { name: 'nombre', type: sql.VarChar, value: nombre },
            { name: 'apellido', type: sql.VarChar, value: apellido },
            { name: 'rol', type: sql.VarChar, value: rol },
            { name: 'id', type: sql.Int, value: id }
        ]);

        await registrarAuditoria(req, { entidad: 'usuario', accion: 'editar', idEntidad: id, detalle: 'usuario ' + usuario });
        res.sendStatus(204); // Responder con código 204 (sin contenido) si la actualización fue exitosa
    } catch (error) {
        console.error('Error al actualizar ítem:', error.message); // Log del error
        res.status(500).json({ error: error.message }); // Responder con error 500 en caso de fallo
    }
};

// Eliminar un ítem
const deleteUsuario = async (req, res) => {
    const { id } = req.params; // Obtiene el ID del ítem desde la URL
    if (!esEnteroPositivo(id)) {
        return res.status(400).json({ error: 'ID inválido.' });
    }
    const sqlQuery = 'DELETE FROM usuario WHERE id_usuario = @id'; 

    try {
        // Proteger al último administrador
        const rolActual = await rolDeUsuario(id);
        if (rolActual === 'administrador' && (await contarAdministradores()) <= 1) {
            return res.status(409).json({ error: 'No se puede eliminar al último administrador.' });
        }
        // Obtener el nombre de usuario antes de borrarlo (para el detalle de auditoría)
        const datosUsuario = await query('SELECT usuario FROM usuario WHERE id_usuario = @id',
            [{ name: 'id', type: sql.Int, value: id }]);
        const nombreUsuario = (datosUsuario && datosUsuario[0]) ? datosUsuario[0].usuario : null;
        // Ejecutar la consulta de eliminación con el ID proporcionado
        await query(sqlQuery, [
            { name: 'id', type: sql.Int, value: id } // Parámetro para la consulta
        ]);
        await registrarAuditoria(req, {
            entidad: 'usuario', accion: 'eliminar', idEntidad: id,
            detalle: nombreUsuario ? ('usuario ' + nombreUsuario) : null
        });
        res.sendStatus(204); // Responder con código 204 (sin contenido) si la eliminación fue exitosa
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

const getFilteredUsuario = async (req, res) => {
    const { roles } = req.query; // Obtener los roles desde la consulta

    let sqlQuery = `SELECT id, [Nombre Completo], rut, correo, rol, usuario, password FROM vw_usuario WHERE 1=1`;
    const params = [];

    // Filtrar por roles si se proporciona
    if (roles) {
        const roleArray = roles.split(',').map(role => role.trim());
        sqlQuery += ` AND rol IN (${roleArray.map((_, index) => `@role${index}`).join(', ')})`;
        roleArray.forEach((role, index) => {
            params.push({ name: `role${index}`, type: sql.VarChar, value: role });
        });
    }

    // Agregar logs para depuración
    console.log('SQL Query:', sqlQuery);
    console.log('Parameters:', params);

    try {
        const result = await query(sqlQuery, params); // Ejecuta la consulta
        res.json(result); // Devuelve el resultado
    } catch (error) {
        console.error('Error executing query:', error); // Log del error
        res.status(500).json({ error: error.message }); // Manejo de errores
    }
};

// Actualizar la preferencia de tema del usuario en sesión (claro/oscuro)
const updateTema = async (req, res) => {
    if (!req.session || !req.session.usuario) {
        return res.status(401).json({ error: 'No autenticado' });
    }
    const tema = (req.body && req.body.tema === 'dark') ? 'dark' : 'light';
    const userId = req.session.usuario.userId;

    try {
        await query('UPDATE usuario SET tema = @tema WHERE id_usuario = @id', [
            { name: 'tema', type: sql.NVarChar, value: tema },
            { name: 'id', type: sql.Int, value: userId }
        ]);
        req.session.usuario.tema = tema; // mantener la sesión sincronizada
        res.json({ success: true, tema });
    } catch (error) {
        console.error('Error al actualizar el tema:', error.message);
        res.status(500).json({ error: error.message });
    }
};

module.exports = {
    getUsuario,
    createUsuario,
    getUsuarioById,
    updateUsuario,
    deleteUsuario,
    getFilteredUsuario,
    updateTema,
    GetUserId
};