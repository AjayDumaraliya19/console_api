// model/repositories/userRepository.js
const db = require('../database/mysql');
const { sendSlackMessage } = require('../../config/common')

async function getUserData(username) {
  try {
    const sequelize = db.createConnection();
    const query = 'SELECT * FROM bousers WHERE Username = ?';
    const result = await sequelize.query(query, {
			replacements: [username],
			type: sequelize.QueryTypes.SELECT,
		});
    db.closeConnection(sequelize);
    return result[0];

  } catch (error) {
    db.closeConnection(sequelize);
    console.error('Error connecting to the MySQL server:', error);
    await sendSlackMessage(`An error occurred: ${error.message}\nStack Trace:\n${error.stack}`);
  }
}

module.exports = {
  getUserData
};
