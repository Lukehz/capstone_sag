const { sql, query } = require('../../config/db'); // Importar la configuración de SQL Server

const getPerfil = async (req, res) => {
  const { id } = req.params; // Obtiene el ID del usuario desde los parámetros de la URL
  console.log("ID del usuario recibido:", id);

  // Valida que el ID sea un número
  if (!id || isNaN(id)) {
      return res.status(400).render('error', { 
          title: 'Error', 
          message: 'ID inválido o no proporcionado',
          layout: false
      });
  }

  const sqlQuery = `
      SELECT nombre, apellido, usuario, correo, rut, dv_rut, rol 
      FROM usuario 
      WHERE id_usuario = @id
  `;

  try {
      // Ejecutar la consulta con el parámetro proporcionado
      const result = await query(sqlQuery, [
          { name: 'id', type: sql.Int, value: parseInt(id) } // Convertir el ID a entero antes de pasarlo a la consulta
      ]);

      console.log('Resultado de la consulta:', result);

      // Verificar si se encontró algún usuario
      if (result && result.length > 0) {
          // Renderizar la vista perfil.ejs con los datos del usuario
          res.render('perfil', {
              title: 'Perfil de Usuario',
              usuario: result[0], // Pasar el primer resultado como datos del usuario
          });
      } else {
          res.status(404).render('error', { 
              title: 'Error', 
              message: 'Usuario no encontrado',
              layout: false
          });
      }
  } catch (err) {
      console.error('Error al obtener los datos del usuario:', err);
      res.status(500).render('error', { 
          title: 'Error', 
          message: 'Error en el servidor',
          layout: false
      });
  }
};

module.exports = {
  getPerfil
};
