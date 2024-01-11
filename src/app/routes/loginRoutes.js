// app/routes/userRoutes.js
const express = require('express');
const userController = require('../controllers/userController');
const {validateHandler} = require('../middleware/middleware');
let Validater = require('../../config/Validater');
let ValidaterClass = new Validater();

const router = express.Router();

router.post('/login', ValidaterClass.loginValidate(), validateHandler, userController.userLogin);

module.exports = router;