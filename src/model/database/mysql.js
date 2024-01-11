// model/database/mysql.js
const Sequelize = require("sequelize");
const dbConfig = require('../../config/dbConfig');
const { sendSlackMessage } = require('../../config/common')

const createConnection = () => {
  const sequelize = new Sequelize(dbConfig.database, dbConfig.user, dbConfig.password, {
    host: dbConfig.host,
    dialect: "mysql",
    pool: {
      max: 10,
      min: 0,
      acquire: 30000,
      idle: 10000
    },
    port: dbConfig.port
  });

  return sequelize;
};

const closeConnection = (sequelize) => {
  sequelize.close()
    .then(() => {
      console.log("Closed db connection.");
    })
    .catch((err) => {
      console.log("Failed to close db connection: " + err.message);
    });
};

// const sequelize = new Sequelize(dbConfig.database, dbConfig.user, dbConfig.password, {
//     host: dbConfig.host,
//     dialect: "mysql",
//     pool: {
//       max: 10,
//       min: 0,
//       acquire: 30000,
//       idle: 10000
//     },
//     port: dbConfig.port
//   });

let sequelize = createConnection();
const db = {};
db.Sequelize = Sequelize;
db.createConnection = createConnection;
db.closeConnection = closeConnection;


// sequelize.authenticate().then(() => {
//   console.log('Connection has been established successfully.');
// }).catch((error) => {
//   console.error('Unable to connect to the database: ', error);
// });

sequelize.sync()
  .then(() => {
    closeConnection(sequelize);
    console.log("Synced db.");
  })
  .catch((err) => {
    closeConnection(sequelize);
    console.log("Failed to sync db: " + err.message);
    sendSlackMessage(`An error occurred: ${err.message}\nStack Trace:\n${err.stack}`);
  });

module.exports = db;