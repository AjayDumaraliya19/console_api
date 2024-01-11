// app/routes/userRoutes.js
const express = require('express');
const constMessages = module.exports = require("../../config/messages.json");
const gameController = require('../controllers/gameController');
const allgameController = require('../controllers/allgameController');
const {validateHandler} = require('../middleware/middleware');
let Validater = require('../../config/Validater');
let ValidaterClass = new Validater();


const router = express.Router();

router.post('/consolelogin', ValidaterClass.gameValidate(), validateHandler, gameController.userLogin);
router.post('/scancard', ValidaterClass.scanCardValidate(), validateHandler, gameController.scanCard);
router.post('/cancel_round', ValidaterClass.cancelRoundValidate(), validateHandler, gameController.cancelRound);
router.post('/scancard/tp', ValidaterClass.scanCardValidate(), validateHandler, allgameController.scanCardTP);
router.post('/scancard/ab', ValidaterClass.scanCardValidate(), validateHandler, allgameController.scanCardAB);
router.post('/scancard/ttc', ValidaterClass.scanCardValidate(), validateHandler, allgameController.scanCard32C);
router.post('/scancard/arw', ValidaterClass.scanCardValidate(), validateHandler, allgameController.scanCardARW);
router.post('/scancard/ls', ValidaterClass.scanCardValidate(), validateHandler, allgameController.scanCardLS);
router.post('/scancard/tpt', ValidaterClass.scanCardValidate(), validateHandler, allgameController.scanCardTP20);

module.exports = router;
