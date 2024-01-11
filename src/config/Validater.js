const { check, validationResult } = module.exports = require("express-validator");
const constMessages = module.exports = require("./messages.json");
class Validater {

    constructor() {}
    loginValidate() {
        return [
            check('username', constMessages.VALIDATION.USERNAME).not().isEmpty(),
            check('password', constMessages.VALIDATION.PASSWORD).not().isEmpty()
        ];
    }

    gameValidate() {
        return [
            check('gamecode', constMessages.VALIDATION.GAMECODE).not().isEmpty(),
            check('password', constMessages.VALIDATION.PASSWORD).not().isEmpty()
        ];
    }

    scanCardValidate() {
        return [
            check('game_code', constMessages.VALIDATION.GAMECODE).not().isEmpty(),
            check('card_code', constMessages.VALIDATION.CARDCODE).not().isEmpty(),
            check('card_code', constMessages.VALIDATION.INVALID_CARDCODE).matches(/^[CDSHJKRcdshjkr]{1}[0-9KQJRBAkqjrba]{1,2}_.*$/),
            check('card_code', constMessages.VALIDATION.INVALID_CARDCODE).isLength({ min: 3, max:4 })
        ];
    }
    cancelRoundValidate() {
        return [
            check('game_code', constMessages.VALIDATION.GAMECODE).not().isEmpty(),
            check('user_id', constMessages.VALIDATION.USER_ID).not().isEmpty()
        ];
    }
}
module.exports = Validater;