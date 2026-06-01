const express = require('express');
const router = express.Router();
const multer = require('multer');
const { getPerfil } = require('../../controllers/AdminControllers/perfilController');

const upload = multer(); // Configurar multer para manejo de archivos

// Definir las rutas
// Ruta para obtener el perfil de un usuario
router.get('/:id', getPerfil);

router.get('/', (req, res) => {
    if (req.session.usuario && req.session.usuario.id_usuario) {
        return res.redirect(`/perfil/${req.session.usuario.id_usuario}`);
    }
    res.render('perfil', { 
        title: 'Perfil', 
        message: 'Bienvenido a tu perfil' 
    });
});

module.exports = router;
