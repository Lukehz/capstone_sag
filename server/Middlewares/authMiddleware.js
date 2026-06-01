const verificarAutenticacion = (roles) => {
    return (req, res, next) => {
        if (!req.session.usuario) {
            return res.redirect('/login?alert=login-required');
        }
        if (roles && !roles.includes(req.session.usuario.role)) {
            return res.status(403).json({ message: 'Acceso denegado' });
        }
        next();
    };
};

module.exports = {
    verificarAutenticacion,
};
