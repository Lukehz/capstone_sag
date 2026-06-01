const express = require('express');
const compression = require('compression');
const bodyParser = require('body-parser');
const cors = require('cors');
const path = require('path');
const expressLayouts = require('express-ejs-layouts')

// Importar las rutas
const parcelacionRoutes = require('./Routes/AdminRoutes/parcelacionRoutes');
const cuarentenaRoutes = require('./Routes/AdminRoutes/cuarentenaRoutes');
const regionRoutes = require('./Routes/AdminRoutes/regionRoutes');
const provinciaRoutes = require('./Routes/AdminRoutes/provinciaRoutes');
const sectorRoutes = require('./Routes/AdminRoutes/sectorRoutes');
const faseRoutes = require('./Routes/AdminRoutes/faseRoutes');
const cultivoRoutes = require('./Routes/AdminRoutes/cultivoRoutes');
const usuarioRoutes = require('./Routes/AdminRoutes/usuarioRoutes');
const rolRoutes = require('./Routes/AdminRoutes/rolRoutes');
const bitacoraRoutes = require('./Routes/AdminRoutes/bitacoraRoutes');
const historialRoutes = require('./Routes/AdminRoutes/historialRoutes');
const authRoutes = require('./Routes/AdminRoutes/authRoutes'); // Importar rutas de autenticación
const { verificarAutenticacion } = require('./Middlewares/authMiddleware');
const { GetUserId } = require('./controllers/AdminControllers/usuarioController'); // Ajusta la ruta si es necesario
//Rutas nicol
const parcelasRoutes = require('./Routes/parcelasRoutes');
const quarantineRoutes = require('./Routes/quarantineRoutes');
//Rutas perfil
const perfilRoutes = require('./Routes/AdminRoutes/perfilRoutes');
// Rutas de predicción
const prediccionRoutes = require('./Routes/prediccionRoutes'); // Nueva ruta de predicción
const dashboardRoutes = require('./Routes/dashboardRoutes'); // Datos del dashboard
// Inicializar la aplicación Express
const app = express();

// Middleware
app.use(compression()); // Comprime las respuestas (HTML/CSS/JS) -> menos bytes
app.use(cors()); // Habilitar CORS
app.use(bodyParser.json()); // Parsear JSON
app.use(express.json());
app.use(bodyParser.urlencoded({ extended: true })); // Parsear URL-encoded

console.log('EN APP.JS');

const session = require('express-session');

// Configuración de la sesión
app.use(session({
    secret: process.env.SESSION_SECRET || 'mi_clave_secreta',
    resave: false,
    saveUninitialized: true,
    cookie: { secure: process.env.COOKIE_SECURE === 'true' } // true cuando se sirve por HTTPS
}));

// Carga los permisos del usuario en la sesión y los expone a las vistas
const { asegurarPermisos, requiereVer, requiereVerAlguno } = require('./Middlewares/permisos');
app.use(asegurarPermisos);


app.use(expressLayouts)
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.set('layout', 'layout');
app.use(expressLayouts);

// Token público de Mapbox disponible en todas las vistas (se inyecta en layout.ejs)
app.locals.mapboxToken = process.env.MAPBOX_TOKEN || '';


// Servir archivos estáticos
app.use(express.static(path.join(__dirname, 'public')));

// Rutas protegidas (CRUD dinámico)
app.get('/crud', requiereVerAlguno(['parcelaciones','cuarentenas','datos_maestros','usuarios']), (req, res) => {
  // Extrae el parámetro 'table' y asigna 'parcelacion' como valor por defecto si no existe
  const table = req.query.table || 'parcelacion';

  // Aquí puedes agregar lógica adicional si es necesario para cambiar el valor de 'table'
  // dependiendo de otras condiciones de la aplicación.

  // Renderizar la vista del CRUD
  res.render('crud', {
      title: `Gestión de ${table}`,
      usuario: req.session.usuario // Pasar datos del usuario para personalizar la vista
  });
});

// Redirigir la ruta raíz al login
app.get('/', (req, res) => {
    res.redirect('/login'); // Redirige a la página de login
});

app.get('/index', requiereVer('mapa'), (req, res) => {
  res.render('index', {
      title: 'Mapa de Cuarentenas',
      script: '',
      usuario: req.session.usuario  // Pasar datos del usuario a la vista
  });
});

app.get('/dashboard', requiereVer('dashboard'), (req, res) => {
  res.render('dashboard', {
      title: 'Dashboard',
      script: '',
      usuario: req.session.usuario  // Pasar datos del usuario a la vista
  });
});

app.get('/roles', requiereVer('roles'), (req, res) => {
  res.render('roles', {
      title: 'Gestión de Roles',
      usuario: req.session.usuario
  });
});

app.get('/bitacora', requiereVer('bitacora'), (req, res) => {
  res.render('bitacora', {
      title: 'Bitácora de Accesos',
      usuario: req.session.usuario
  });
});

app.use((req, res, next) => {
  if (req.session.usuario) {
      res.locals.usuario = {
          id_usuario: req.session.usuario.userId, // Cambia 'userId' a 'id_usuario'
          nombre: req.session.usuario.nombre || req.session.usuario.username, // nombre real, respaldo al usuario de login
          rol: req.session.usuario.role          // Cambia 'role' a 'rol'
      };
  } else {
      res.locals.usuario = null;
  }
  console.log('Middleware global: usuario en sesión:', res.locals.usuario);
  next();
});

app.get('/perfil', verificarAutenticacion(), async (req, res) => {
  try {
      const userId = req.session.usuario && req.session.usuario.userId;
      if (!userId) {
          return res.redirect('/login?alert=login-required');
      }

      // Recupera los datos del usuario
      const user = await GetUserId(userId);

      if (!user) {
          return res.status(404).render('error', {
              title: 'Error',
              message: 'Usuario no encontrado',
          });
      }

      // Actualiza la sesión con los datos actualizados si es necesario
      req.session.usuario = {
          userId: user.id_usuario,
          username: (req.session.usuario && req.session.usuario.username) || user.usuario,
          nombre: user.nombre,
          apellido: user.apellido,
          role: user.rol,
          rolCodigo: (req.session.usuario && req.session.usuario.rolCodigo) || null,
          tema: (req.session.usuario && req.session.usuario.tema) || user.tema || 'light',
          permisos: (req.session.usuario && req.session.usuario.permisos) || null
      };

      // Combina los datos de la sesión con los del usuario recuperado
      const usuarioCompleto = {
          ...req.session.usuario, // Información de la sesión
          ...user                 // Información del usuario desde la base de datos
      };

      // Renderiza la vista del perfil
      res.render('perfil', {
          title: 'Perfil de Usuario',
          usuario: usuarioCompleto // Pasa el usuario combinado a la vista
      });
  } catch (error) {
      console.error('Error al obtener datos del usuario:', error);
      res.status(500).render('error', {
          title: 'Error',
          message: 'Error interno del servidor',
      });
  }
});

// Compatibilidad: enlaces antiguos /perfil/:id redirigen al perfil propio (sin exponer el id)
app.get('/perfil/:userId', verificarAutenticacion(), (req, res) => {
  res.redirect('/perfil');
});

// Middleware para servir archivos estáticos
// Estáticos: en producción se cachean 1 día; en desarrollo no, para ver los cambios al instante.
const _staticOpts = process.env.NODE_ENV === 'production'
  ? { maxAge: '1d', etag: true }
  : { maxAge: 0, etag: true };
app.use(express.static(path.join(__dirname, '../public'), _staticOpts));

// Ruta para servir login.html
app.get('/login', (req, res) => {
    res.sendFile(path.join(__dirname, '../public', 'login.html'));
});

app.use((req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    next();
});

// Página de predicciones
app.get('/prediccion', requiereVer('prediccion'), (req, res) => {
  res.render('prediccion', { title: 'Predicción de Imágenes', usuario: req.session.usuario });
});

const multer = require('multer');
const { exec } = require('child_process');
const fs = require('fs');

// Ajuste de `multer` para mantener la extensión del archivo
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
      cb(null, 'uploads/');
  },
  filename: (req, file, cb) => {
      cb(null, file.fieldname + '-' + Date.now() + path.extname(file.originalname));
  }
});

const upload = multer({ storage: storage });

app.post('/prediccion', upload.single('image'), (req, res) => {
  if (!req.file) {
      return res.status(400).send('No se ha cargado ninguna imagen.');
  }

  // Verificar la información del archivo subido
  console.log('Archivo subido:', req.file);

  const rutaImagen = path.resolve(req.file.path);

  // Verificar si el archivo existe antes de continuar
  if (!fs.existsSync(rutaImagen)) {
      console.error(`Archivo no encontrado en la ruta: ${rutaImagen}`);
      return res.status(404).send('Archivo no encontrado.');
  }

  const scriptPrediccion = path.join(__dirname, 'scriptsPy', 'prediccionYOLO.py');
  const comandoPython = `python3 "${scriptPrediccion}" "${rutaImagen}"`;

  // Ejecutar el script de Python para hacer la predicción
  exec(comandoPython, (error, stdout, stderr) => {
      if (error) {
          console.error(`Error durante la ejecución: ${stderr}`);
          return res.status(500).send('Error durante la predicción.');
      }

      try {
          const resultados = JSON.parse(stdout);
          if (resultados.error) {
              // Si hay un error en la predicción, muestra el error
              return res.status(500).send(`Error en la predicción: ${resultados.error}`);
          }
          

          // Renderizar la vista de resultados con la imagen inferida
          res.render('prediccionResultados', { 
              title: 'Resultado de la Predicción', 
              rutaImagenInferida: resultados.ruta_salida 
          });
      } catch (parseError) {
          console.error('Error al parsear la salida JSON:', parseError);
          return res.status(500).send('Error al procesar los resultados de la predicción.');
      }
  });
});

// Asegurarte de tener esto en tu app.js para que los archivos de 'uploads/' sean accesibles.
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));
// Añadir rutas de predicción
app.use('/prediccion', prediccionRoutes); // Nueva ruta para manejar predicciones

// Rutas Crud
app.use('/api/parcelacion', parcelacionRoutes);
app.use('/api/cuarentena', cuarentenaRoutes);
app.use('/api/region', regionRoutes);
app.use('/api/provincia', provinciaRoutes);
app.use('/api/sector', sectorRoutes);
app.use('/api/fase', faseRoutes);
app.use('/api/cultivo', cultivoRoutes);
app.use('/api/usuario', usuarioRoutes);
app.use('/api/rol', rolRoutes);
app.use('/api/bitacora', bitacoraRoutes);
app.use('/api/historial', historialRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/auth', authRoutes);
//app.use('/api/crud', crudRoutes); // Aquí añades tus rutas de CRUD
// Exportar la aplicación para su uso en server.js
app.use('/perfil', perfilRoutes);

// Rutas Nicole
app.use('/api', parcelasRoutes);
app.use('/parcelas', parcelasRoutes);
app.use('/api', quarantineRoutes);
app.use('/quarantines', quarantineRoutes);

// Middleware para manejar errores
const errorHandler = (err, req, res, next) => {
    console.error('Error:', err);
    res.status(500).json({
      error: 'Ha ocurrido un error en el servidor',
      details: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  };

// Manejo de ruta no encontrada (paraz cualquier ruta no especificada)
app.use((req, res) => {
    res.status(404).json({ error: 'Ruta no encontrada' });
  });
  
  // Usar el middleware de manejo de errores
  app.use(errorHandler);
  
  // Manejo de errores no capturados
  process.on('uncaughtException', (err) => {
    console.error('Error no capturado:', err);
    process.exit(1);
  });
  
  process.on('unhandledRejection', (reason, promise) => {
    console.error('Promesa rechazada no manejada:', reason);
    process.exit(1);
  });
  
module.exports = app;