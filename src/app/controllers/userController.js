// app/controllers/userController.js
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const moment = require("moment");
const { getUserData } = require("../../model/repositories/userRepository");
const constMessages = (module.exports = require("../../config/messages.json"));

async function userLogin(req, res) {
  try {
    const { username, password } = req.body;

    const userdetails = await getUserData(username);
    if (!userdetails) {
      return res.status(200).json({
        success: false,
        message: constMessages.VALIDATION.INVALID_USERNAME,
      });
    }

    let checkPassword = await bcrypt.compare(password, userdetails.Password);
    if (checkPassword) {
      let accessToken = jwt.sign(
        { id: userdetails.UserId },
        process.env.JWT_SECRET,
        {}
      );
      delete userdetails.Password;
      return res.status(200).json({
        success: true,
        message: constMessages.SUCCESS.LOGIN_SUCCESS,
        data: userdetails,
        accessToken: accessToken,
      });
    } else {
      return res.status(200).json({
        success: false,
        message: constMessages.VALIDATION.INVALID_PASSWORD,
      });
    }
  } catch (err) {
    await sendSlackMessage(
      `An error occurred: ${err.message}\nStack Trace:\n${err.stack}`
    );
    return res.status(400).json({ success: false, message: err.message });
  }
}

module.exports = {
  userLogin,
};
