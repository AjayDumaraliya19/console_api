const { check, validationResult } = module.exports = require("express-validator");

async function validateHandler(req, res, next) {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ success: false, message: errors.errors[0].msg });
    } else {
        next();
    }
}
module.exports = {
    validateHandler
};