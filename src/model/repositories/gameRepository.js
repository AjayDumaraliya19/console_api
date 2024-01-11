const db = require("../database/mysql");
const { sendSlackMessage } = require("../../config/common");

async function getGames() {
  try {
    const sequelize = db.createConnection();
    const query = `SELECT * FROM game inner join gamedetail on gamedetail.gameId = game.gameId where IsActive = 1 and IsDelete = 0`;

    const result = await sequelize.query(query, {
      type: sequelize.QueryTypes.SELECT,
    });
    db.closeConnection(sequelize);
    return result;
  } catch (error) {
    db.closeConnection(sequelize);
    console.error("Error connecting to the MySQL server:", error);
    await sendSlackMessage(
      `An error occurred: ${error.message}\nStack Trace:\n${error.stack}`
    );
  }
}

async function getGameData(gameCode) {
  try {
    const sequelize = db.createConnection();
    const query = `SELECT * FROM game inner join gamedetail on gamedetail.gameId = game.gameId  WHERE Code = ?`;

    const result = await sequelize.query(query, {
      replacements: [gameCode],
      type: sequelize.QueryTypes.SELECT,
    });
    db.closeConnection(sequelize);
    return result[0];
  } catch (error) {
    db.closeConnection(sequelize);
    console.error("Error connecting to the MySQL server:", error);
    await sendSlackMessage(
      `An error occurred: ${error.message}\nStack Trace:\n${error.stack}`
    );
  }
}

async function getGameDataById(gameId) {
  try {
    const sequelize = db.createConnection();
    const query = `SELECT * FROM game  inner join gamedetail on gamedetail.gameId = game.gameId  WHERE game.gameId = ? AND IsActive = ? AND Status = ?`;

    const result = await sequelize.query(query, {
      replacements: [gameId, 1, 1],
      type: sequelize.QueryTypes.SELECT,
    });
    db.closeConnection(sequelize);
    return result[0];
  } catch (error) {
    db.closeConnection(sequelize);
    console.error("Error connecting to the MySQL server:", error);
    await sendSlackMessage(
      `An error occurred: ${error.message}\nStack Trace:\n${error.stack}`
    );
  }
}

async function getRoundData(GameId) {
  try {
    const sequelize = db.createConnection();
    const query = `SELECT * FROM round WHERE GameId = ? AND IsActive = ? AND Status = ?`;

    const result = await sequelize.query(query, {
      replacements: [GameId, 1, 4],
      type: sequelize.QueryTypes.SELECT,
    });

    if (result.length === 0) {
      return null;
    }
    db.closeConnection(sequelize);
    return result[0];
  } catch (error) {
    db.closeConnection(sequelize);
    console.error("Error connecting to the MySQL server:", error);
    await sendSlackMessage(
      `An error occurred: ${error.message}\nStack Trace:\n${error.stack}`
    );
  }
}

async function getRoundDataByRoundId(RoundId) {
  try {
    const sequelize = db.createConnection();
    const query = `SELECT * FROM round WHERE RoundId = ? AND IsActive = ? AND Status = ?`;

    const result = await sequelize.query(query, {
      replacements: [RoundId, 1, 4],
      type: sequelize.QueryTypes.SELECT,
    });
    db.closeConnection(sequelize);
    return result[0];
  } catch (error) {
    db.closeConnection(sequelize);
    console.error("Error connecting to the MySQL server:", error);
    await sendSlackMessage(
      `An error occurred: ${error.message}\nStack Trace:\n${error.stack}`
    );
  }
}

async function checkRoundDataByRoundId(RoundId) {
  try {
    const sequelize = db.createConnection();
    const query = `SELECT * FROM round WHERE RoundId = ? AND IsActive = ? AND (Status = ? OR Status = ?)`;

    const result = await sequelize.query(query, {
      replacements: [RoundId, 1, 3, 5],
      type: sequelize.QueryTypes.SELECT,
    });
    db.closeConnection(sequelize);
    return result[0];
  } catch (error) {
    db.closeConnection(sequelize);
    console.error("Error connecting to the MySQL server:", error);
    await sendSlackMessage(
      `An error occurred: ${error.message}\nStack Trace:\n${error.stack}`
    );
  }
}

async function getCardDetailsByRoundId(RoundId) {
  try {
    const sequelize = db.createConnection();
    const query = `SELECT * FROM rounddetail WHERE RoundId = ?`;

    const result = await sequelize.query(query, {
      replacements: [RoundId],
      type: sequelize.QueryTypes.SELECT,
    });
    db.closeConnection(sequelize);
    return result;
  } catch (error) {
    db.closeConnection(sequelize);
    console.error("Error connecting to the MySQL server:", error);
    await sendSlackMessage(
      `An error occurred: ${error.message}\nStack Trace:\n${error.stack}`
    );
  }
}

async function createRound(gameDetails) {
  try {
    const sequelize = db.createConnection();
    const query = `INSERT INTO round (${Object.keys(gameDetails).join(", ")})
		VALUES (${Object.values(gameDetails)
      .map((value) => sequelize.escape(value))
      .join(", ")})`;

    const result = await sequelize.query(query, {
      type: sequelize.QueryTypes.INSERT,
    });
    db.closeConnection(sequelize);
    return result;
  } catch (error) {
    db.closeConnection(sequelize);
    console.error("Error connecting to the MySQL server:", error);
    await sendSlackMessage(
      `An error occurred: ${error.message}\nStack Trace:\n${error.stack}`
    );
  }
}

async function createRoundDetails(roundDetails) {
  try {
    const sequelize = db.createConnection();
    const query = `INSERT INTO rounddetail (${Object.keys(roundDetails).join(
      ", "
    )})
		VALUES (${Object.values(roundDetails)
      .map((value) => sequelize.escape(value))
      .join(", ")})`;

    const result = await sequelize.query(query, {
      type: sequelize.QueryTypes.INSERT,
    });
    db.closeConnection(sequelize);
    return result;
  } catch (error) {
    db.closeConnection(sequelize);
    console.error("Error connecting to the MySQL server:", error);
    await sendSlackMessage(
      `An error occurred: ${error.message}\nStack Trace:\n${error.stack}`
    );
  }
}

async function checkRoundCardAlready(RoundId, Card) {
  try {
    const sequelize = db.createConnection();
    const query = `SELECT * FROM rounddetail WHERE RoundId = ? AND CurrentScannedCard = ?`;

    const result = await sequelize.query(query, {
      replacements: [RoundId, Card],
      type: sequelize.QueryTypes.SELECT,
    });
    db.closeConnection(sequelize);
    return result;
  } catch (error) {
    db.closeConnection(sequelize);
    console.error("Error connecting to the MySQL server:", error);
    await sendSlackMessage(
      `An error occurred: ${error.message}\nStack Trace:\n${error.stack}`
    );
  }
}

async function updateRunner(GameId, Name, data) {
  try {
    const sequelize = db.createConnection();
    const score = data.Score ? data.Score : null;
    const status = data.Status ? data.Status : null;
    const LayOdd = data.LayOdd || data.LayOdd == 0 ? data.LayOdd : null;
    const query = `CALL UpdateRunnerInfo(?,?,?,?,?,?,?,?, @g_StatusCode)`;
    const result = await sequelize.query(query, {
      replacements: [
        GameId,
        Name,
        data.BackOdd,
        LayOdd,
        data.Cards,
        data.ModifiedBy,
        score,
        status,
      ],
    });
    db.closeConnection(sequelize);
    return result;
  } catch (error) {
    db.closeConnection(sequelize);
    console.error("Error connecting to the MySQL server:", error);
    await sendSlackMessage(
      `An error occurred: ${error.message}\nStack Trace:\n${error.stack}`
    );
  }
}

async function updateRunnerByCode(GameId, RCode, data) {
  try {
    const sequelize = db.createConnection();
    const score = data.Score ? data.Score : null;
    const status = data.Status ? data.Status : null;
    const LayOdd = data.LayOdd || data.LayOdd == 0 ? data.LayOdd : null;
    const ExternalKey =
      data.ExternalKey || data.ExternalKey == 0 ? data.ExternalKey : null;
    const query = `CALL UpdateRunnerByRCodeInfo(?,?,?,?,?,?,?,?,?, @g_StatusCode)`;
    const result = await sequelize.query(query, {
      replacements: [
        GameId,
        RCode,
        data.BackOdd,
        LayOdd,
        data.Cards,
        data.ModifiedBy,
        score,
        status,
        ExternalKey,
      ],
    });
    db.closeConnection(sequelize);
    return result;
  } catch (error) {
    db.closeConnection(sequelize);
    console.error("Error connecting to the MySQL server:", error);
    await sendSlackMessage(
      `An error occurred: ${error.message}\nStack Trace:\n${error.stack}`
    );
  }
}

async function updateRound(RoundId, gameDetails) {
  const sequelize = db.createConnection();
  const query = `UPDATE round SET ${Object.keys(gameDetails)
    .map((key) => `${key} = ${sequelize.escape(gameDetails[key])}`)
    .join(", ")}
		WHERE RoundId = ?`;

  try {
    // const query = `UPDATE round SET ${Object.keys(gameDetails).map(key => `${key} = ${sequelize.escape(gameDetails[key])}`).join(', ')}
    // WHERE RoundId = ?`;

    const result = await sequelize.query(query, {
      replacements: [RoundId],
      type: sequelize.QueryTypes.UPDATE,
    });
    db.closeConnection(sequelize);
    return result;
  } catch (error) {
    db.closeConnection(sequelize);
    console.error("Error connecting to the MySQL server:", error);
    await sendSlackMessage(
      `An error occurred: ${error.message}\nStack Trace:\n${error.stack}\nQuery:\n${query}`
    );
  }
}

async function getLiveRunnerForResult(GameId, Name) {
  try {
    const sequelize = db.createConnection();
    const query = `SELECT * FROM runner WHERE Name = ? AND GameId = ?`;

    const result = await sequelize.query(query, {
      replacements: [Name, GameId],
      type: sequelize.QueryTypes.SELECT,
    });
    db.closeConnection(sequelize);
    return result[0];
  } catch (error) {
    db.closeConnection(sequelize);
    console.error("Error connecting to the MySQL server:", error);
    await sendSlackMessage(
      `An error occurred: ${error.message}\nStack Trace:\n${error.stack}`
    );
  }
}

async function getLiveRunnerAll(GameId) {
  try {
    const sequelize = db.createConnection();
    const query = `SELECT * FROM runner WHERE GameId = ?`;

    const result = await sequelize.query(query, {
      replacements: [GameId],
      type: sequelize.QueryTypes.SELECT,
    });
    db.closeConnection(sequelize);
    return result;
  } catch (error) {
    db.closeConnection(sequelize);
    console.error("Error connecting to the MySQL server:", error);
    await sendSlackMessage(
      `An error occurred: ${error.message}\nStack Trace:\n${error.stack}`
    );
  }
}

async function getLiveRunnerAllOpen(GameId) {
  try {
    const sequelize = db.createConnection();
    const query = `SELECT * FROM runner WHERE GameId = ? AND ExternalKey = ? AND GroupId = ?`;

    const result = await sequelize.query(query, {
      replacements: [GameId, 1, 1],
      type: sequelize.QueryTypes.SELECT,
    });
    db.closeConnection(sequelize);
    return result;
  } catch (error) {
    db.closeConnection(sequelize);
    console.error("Error connecting to the MySQL server:", error);
    await sendSlackMessage(
      `An error occurred: ${error.message}\nStack Trace:\n${error.stack}`
    );
  }
}

async function getCurrenRoundDataInRound(GameId) {
  try {
    const sequelize = db.createConnection();
    const query = `SELECT * FROM round WHERE GameId = ? AND IsActive = ? AND (Status = ? OR Status = ?)`;

    const result = await sequelize.query(query, {
      replacements: [GameId, 1, 4, 1],
      type: sequelize.QueryTypes.SELECT,
    });

    if (result.length === 0) {
      return null;
    }
    db.closeConnection(sequelize);
    return result[0];
  } catch (error) {
    db.closeConnection(sequelize);
    console.error("Error connecting to the MySQL server:", error);
    await sendSlackMessage(
      `An error occurred: ${error.message}\nStack Trace:\n${error.stack}`
    );
  }
}

module.exports = {
  getGames,
  getGameData,
  getGameDataById,
  getRoundData,
  getRoundDataByRoundId,
  checkRoundDataByRoundId,
  getCardDetailsByRoundId,
  createRound,
  createRoundDetails,
  checkRoundCardAlready,
  updateRunner,
  updateRunnerByCode,
  updateRound,
  getLiveRunnerForResult,
  getLiveRunnerAll,
  getLiveRunnerAllOpen,
  getCurrenRoundDataInRound,
};
