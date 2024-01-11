const moment = require("moment");
const axios = require("axios");
const constMessages = require("./messages.json");
const logger = require("../lib/logger");
const config = require("./config.json");
const slackWebhookUrl = process.env.SLACK_WEBHOOK_URL;

async function validateCardCode(card_code) {
  const cardcodes = {
    CA_: "AC",
    C2_: "2C",
    C3_: "3C",
    C4_: "4C",
    C5_: "5C",
    C6_: "6C",
    C7_: "7C",
    C8_: "8C",
    C9_: "9C",
    C10_: "TC",
    CJ_: "JC",
    CQ_: "QC",
    CK_: "KC",
    HA_: "AH",
    H2_: "2H",
    H3_: "3H",
    H4_: "4H",
    H5_: "5H",
    H6_: "6H",
    H7_: "7H",
    H8_: "8H",
    H9_: "9H",
    H10_: "TH",
    HJ_: "JH",
    HQ_: "QH",
    HK_: "KH",
    SA_: "AS",
    S2_: "2S",
    S3_: "3S",
    S4_: "4S",
    S5_: "5S",
    S6_: "6S",
    S7_: "7S",
    S8_: "8S",
    S9_: "9S",
    S10_: "TS",
    SJ_: "JS",
    SQ_: "QS",
    SK_: "KS",
    DA_: "AD",
    D2_: "2D",
    D3_: "3D",
    D4_: "4D",
    D5_: "5D",
    D6_: "6D",
    D7_: "7D",
    D8_: "8D",
    D9_: "9D",
    D10_: "TD",
    DJ_: "JD",
    DQ_: "QD",
    DK_: "KD",
  };
  let checkValid = cardcodes[card_code];
  if (checkValid) {
    return checkValid;
  } else {
    return false;
  }
}

async function getCardFirstForAndarBahar(card_code) {
  const cardcodes = {
    AC: "A",
    "2C": "2",
    "3C": "3",
    "4C": "4",
    "5C": "5",
    "6C": "6",
    "7C": "7",
    "8C": "8",
    "9C": "9",
    TC: "T",
    JC: "J",
    QC: "Q",
    KC: "K",
    AH: "A",
    "2H": "2",
    "3H": "3",
    "4H": "4",
    "5H": "5",
    "6H": "6",
    "7H": "7",
    "8H": "8",
    "9H": "9",
    TH: "T",
    JH: "J",
    QH: "Q",
    KH: "K",
    AS: "A",
    "2S": "2",
    "3S": "3",
    "4S": "4",
    "5S": "5",
    "6S": "6",
    "7S": "7",
    "8S": "8",
    "9S": "9",
    TS: "T",
    JS: "J",
    QS: "Q",
    KS: "K",
    AD: "A",
    "2D": "2",
    "3D": "3",
    "4D": "4",
    "5D": "5",
    "6D": "6",
    "7D": "7",
    "8D": "8",
    "9D": "9",
    TD: "T",
    JD: "J",
    QD: "Q",
    KD: "K",
  };
  let checkValid = cardcodes[card_code];
  if (checkValid) {
    return checkValid;
  } else {
    return false;
  }
}
async function getCardFirstForAndarBaharValue(card_code) {
  const cardcodes = {
    AC: 1,
    "2C": 2,
    "3C": 3,
    "4C": 4,
    "5C": 5,
    "6C": 6,
    "7C": 7,
    "8C": 8,
    "9C": 9,
    TC: 10,
    JC: 11,
    QC: 12,
    KC: 13,
    AH: 1,
    "2H": 2,
    "3H": 3,
    "4H": 4,
    "5H": 5,
    "6H": 6,
    "7H": 7,
    "8H": 8,
    "9H": 9,
    TH: 10,
    JH: 11,
    QH: 12,
    KH: 13,
    AS: 1,
    "2S": 2,
    "3S": 3,
    "4S": 4,
    "5S": 5,
    "6S": 6,
    "7S": 7,
    "8S": 8,
    "9S": 9,
    TS: 10,
    JS: 11,
    QS: 12,
    KS: 13,
    AD: 1,
    "2D": 2,
    "3D": 3,
    "4D": 4,
    "5D": 5,
    "6D": 6,
    "7D": 7,
    "8D": 8,
    "9D": 9,
    TD: 10,
    JD: 11,
    QD: 12,
    KD: 13,
  };
  let checkValid = cardcodes[card_code];
  if (checkValid) {
    return checkValid;
  } else {
    return false;
  }
}
async function getCardColor(scannedCard) {
  const getCard = scannedCard.split("");
  if (getCard[1] == "S" || getCard[1] == "C") {
    return "ARW_BK";
  } else {
    return "ARW_RD";
  }
}
async function getCardColorAndarBaharJokar(scannedCard) {
  const getCard = scannedCard.split("");
  if (getCard[1] == "S" || getCard[1] == "C") {
    return "AB_JSB";
  } else {
    return "AB_JSR";
  }
}
async function getCardColorAndarBaharSuite(scannedCard) {
  const getCard = scannedCard.split("");
  if (getCard[1] == "S" || getCard[1] == "C") {
    return "AB_WSB";
  } else {
    return "AB_WSR";
  }
}
async function callPythonAPI(request, callback) {
  try {
    let data = JSON.stringify(request);
    let rconfig = {
      method: "post",
      maxBodyLength: Infinity,
      url: config.PYTHON_API_URL, //TODO Make this url from env file
      headers: {
        "Content-Type": "application/json",
      },
      data: data,
    };
    let response = await axios.request(rconfig);
    return response.data;
  } catch (error) {
    if (error.response) {
      await sendSlackMessage(
        `Python Response error:${error.response.status}\nStack Trace:\n${
          error.stack
        }\nResponse:\n${JSON.stringify(error)}`
      );
    } else if (error.request) {
      await sendSlackMessage(`Python Request error: ${error.request}`);
    } else {
      await sendSlackMessage(
        `An error occurred: ${error.message}\nStack Trace:\n${error.stack}`
      );
    }
  }
}
async function getBackAndLay(back) {
  let X = back - 1;
  let Y = 0;
  if (X >= 0.01 && X <= 0.29) {
    Y = 0.02;
  } else if (X >= 0.3 && X <= 0.79) {
    Y = 0.03;
  } else if (X >= 0.8 && X <= 0.89) {
    Y = 0.04;
  } else {
    Y = 0.07;
  }
  let Lay = X + Y + 1;
  return Lay;
}
async function sendDataToDatabase(
  queue_name,
  newData,
  sockets,
  delay,
  uniqueNumber
) {
  try {
    await logger.info(
      uniqueNumber +
        ":[" +
        queue_name +
        "]: Before-sendDataToDatabase : " +
        JSON.stringify(newData)
    );
    // console.log("Hub:", newData);
    sockets.emit(queue_name, { data: newData, delayInSeconds: delay });
    await logger.info(
      uniqueNumber +
        ":[" +
        queue_name +
        "]: After-sendDataToDatabase : " +
        JSON.stringify(newData)
    );
    return true;
  } catch (error) {
    await sendSlackMessage(
      `An error occurred: ${error.message}\nStack Trace:\n${error.stack}`
    );
  }
}
async function sendDataToHub(newData, socket, uniqueNumber) {
  try {
    console.log("Hub:", newData);
    await logger.info(
      uniqueNumber + " : Before-sendDataToHub : " + JSON.stringify(newData)
    );
    socket.emit("sendRoundData", newData);
    await logger.info(
      uniqueNumber + " : After-sendDataToHub : " + JSON.stringify(newData)
    );
    // const serverUrl = config.HUB_URL; // Replace with the remote server URL
    // const socket = ioClient.connect(serverUrl, { transports: ['websocket'] });
    // socket.on('connect', async () => {
    //     console.log('Connected to remote server');
    //     socket.emit('sendRoundData', newData);
    //     socket.disconnect();
    // });
    // socket.on('disconnect', () => {
    //     console.log('Disconnected from remote server');
    // });
    return true;
  } catch (error) {
    await sendSlackMessage(
      `An error occurred: ${error.message}\nStack Trace:\n${error.stack}`
    );
  }
}
async function sendSlackMessage(message) {
  try {
    // const response = await axios.post(slackWebhookUrl, { text: message });
    console.log("Message sent to Slack:", message);
    // console.log('Message sent to Slack:', response.data);
  } catch (error) {
    console.error("Error sending message to Slack:", error);
  }
}

module.exports = {
  validateCardCode,
  getCardFirstForAndarBahar,
  getCardFirstForAndarBaharValue,
  getCardColor,
  getCardColorAndarBaharJokar,
  getCardColorAndarBaharSuite,
  getBackAndLay,
  sendDataToHub,
  sendSlackMessage,
  callPythonAPI,
  sendDataToDatabase,
};
