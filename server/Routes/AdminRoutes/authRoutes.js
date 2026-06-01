const express = require('express');
const router = express.Router();
const { login, logout } = require('../../controllers/AdminControllers/authControllers');

router.post('/login', login);   // Ruta para iniciar sesión
router.get('/logout', logout);  // Ruta para cerrar sesión

module.exports = router;