const cron = require("node-cron");
const axios = require("axios");
const { sendSlackMessage } = require("../../config/common");
const fs = require("fs");
const path = require("path");
const logDirectory = "logs";

const suits = ["H", "D", "C", "S"];
const values = [
  "2",
  "3",
  "4",
  "5",
  "6",
  "7",
  "8",
  "9",
  "10",
  "J",
  "Q",
  "K",
  "A",
];

function getRandomCard() {
  const randomSuit = suits[Math.floor(Math.random() * suits.length)];
  const randomValue = values[Math.floor(Math.random() * values.length)];
  return `${randomSuit}${randomValue}_`;
}

// cron.schedule('0 0 * * *', async () => {
cron.schedule("*/5 * * * *", async () => {
  try {
    const twoDaysAgo = new Date();
    twoDaysAgo.setDate(twoDaysAgo.getDate() - 1);
    fs.readdirSync(logDirectory).forEach(async (file) => {
      // await sendSlackMessage(`Two Days Ago: ${twoDaysAgo}`);
      const filePath = path.join(logDirectory, file);
      const fileStat = fs.statSync(filePath);
      // await sendSlackMessage(`isFile: ${fileStat.isFile()}`);
      // await sendSlackMessage(`startsWith: ${file.startsWith('error')}`);
      // await sendSlackMessage(`birthtime: ${fileStat.birthtime}`);
      // await sendSlackMessage(`twoDaysAgo: ${twoDaysAgo}`);
      if (
        fileStat.isFile() &&
        file.startsWith("error") &&
        fileStat.birthtime < twoDaysAgo
      ) {
        await sendSlackMessage(`Remove Log filePath: ${filePath}`);
        fs.unlinkSync(filePath);
      }
    });
  } catch (error) {
    if (error.response) {
      await sendSlackMessage(
        `Response corn error:${error.response.status}\nStack Trace:\n${
          error.stack
        }\nResponse:\n${JSON.stringify(error)}`
      );
    } else if (error.request) {
      await sendSlackMessage(
        `Request corn error: ${error.message}\nStack Trace:\n${error.stack}`
      );
    } else {
      await sendSlackMessage(
        `An error occurred: ${error.message}\nStack Trace:\n${error.stack}`
      );
    }
  }
});

// cron.schedule('*/10 * * * * *', async () => {
//   const randomCard = getRandomCard();
//   console.log(`Generated random card: ${randomCard}`);

//   try {
//     let data = JSON.stringify({
//       "game_code": "TP",
//       "card_code": randomCard
//     });
//     rconfig = {
//       method: 'post',
//       maxBodyLength: Infinity,
//       url: process.env.BASE_URL + "/scancard", //TODO Make this url from env file
//       headers: {
//         'Content-Type': 'application/json'
//       },
//       data: data
//     };
//     let res = await axios.request(rconfig);
//     if (!(res && res.data && res.data.success))
//       console.log("Result :", res.data);

// } catch (error) {
//   if (error.response) {
//     await sendSlackMessage(`TP Response corn error:${error.response.status}\nStack Trace:\n${error.stack}\nResponse:\n${JSON.stringify(error)}`);
//   } else if (error.request) {
//     await sendSlackMessage(`TP Request corn error: ${error.message}\nStack Trace:\n${error.stack}`);
//   } else {
//     await sendSlackMessage(`TP An error occurred: ${error.message}\nStack Trace:\n${error.stack}`);
//   }

// }
// });

// cron.schedule('*/10 * * * * *', async () => {
//   const randomCard = getRandomCard();
//   console.log(`Generated random card: ${randomCard}`);

//   try {
//     let data = JSON.stringify({
//       "game_code": "AB",
//       "card_code": randomCard
//     });
//     rconfig = {
//       method: 'post',
//       maxBodyLength: Infinity,
//       url: process.env.BASE_URL + "/scancard", //TODO Make this url from env file
//       headers: {
//         'Content-Type': 'application/json'
//       },
//       data: data
//     };
//     let res = await axios.request(rconfig);
//     if (!(res && res.data && res.data.success))
//       console.log("Result :", res.data);

//   } catch (error) {
//     if (error.response) {
//       await sendSlackMessage(`AB Response corn error:${error.response.status}\nStack Trace:\n${error.stack}\nResponse:\n${JSON.stringify(error)}`);
//     } else if (error.request) {
//       await sendSlackMessage(`AB Request corn error: ${error.message}\nStack Trace:\n${error.stack}`);
//     } else {
//       await sendSlackMessage(`AB An error occurred: ${error.message}\nStack Trace:\n${error.stack}`);
//     }

//   }
// });

// cron.schedule('*/10 * * * * *', async () => {
//   const randomCard = getRandomCard();
//   console.log(`Generated random card: ${randomCard}`);

//   try {
//     let data = JSON.stringify({
//       "game_code": "32C",
//       "card_code": randomCard
//     });
//     rconfig = {
//       method: 'post',
//       maxBodyLength: Infinity,
//       url: process.env.BASE_URL + "/scancard", //TODO Make this url from env file
//       headers: {
//         'Content-Type': 'application/json'
//       },
//       data: data
//     };
//     let res = await axios.request(rconfig);
//     if (!(res && res.data && res.data.success))
//       console.log("Result :", res.data);

//   } catch (error) {
//     if (error.response) {
//       await sendSlackMessage(`TTC Response corn error:${error.response.status}\nStack Trace:\n${error.stack}\nResponse:\n${JSON.stringify(error)}`);
//     } else if (error.request) {
//       await sendSlackMessage(`TTC Request corn error: ${error.message}\nStack Trace:\n${error.stack}`);
//     } else {
//       await sendSlackMessage(`TTC An error occurred: ${error.message}\nStack Trace:\n${error.stack}`);
//     }

//   }
// });

// cron.schedule('*/10 * * * * *', async () => {
//   const randomCard = getRandomCard();
//   console.log(`Generated random card: ${randomCard}`);

//   try {
//     let data = JSON.stringify({
//       "game_code": "ARW",
//       "card_code": randomCard
//     });
//     rconfig = {
//       method: 'post',
//       maxBodyLength: Infinity,
//       url: process.env.BASE_URL + "/scancard", //TODO Make this url from env file
//       headers: {
//         'Content-Type': 'application/json'
//       },
//       data: data
//     };
//     let res = await axios.request(rconfig);
//     if (!(res && res.data && res.data.success))
//       console.log("Result :", res.data);

//   } catch (error) {
//     if (error.response) {
//       await sendSlackMessage(`ARW Response corn error:${error.response.status}\nStack Trace:\n${error.stack}\nResponse:\n${JSON.stringify(error)}`);
//     } else if (error.request) {
//       await sendSlackMessage(`ARW Request corn error: ${error.message}\nStack Trace:\n${error.stack}`);
//     } else {
//       await sendSlackMessage(`ARW An error occurred: ${error.message}\nStack Trace:\n${error.stack}`);
//     }

//   }
// });

// cron.schedule('*/10 * * * * *', async () => {
//   const randomCard = getRandomCard();
//   console.log(`Generated random card: ${randomCard}`);

//   try {
//     let data = JSON.stringify({
//       "game_code": "LS",
//       "card_code": randomCard
//     });
//     rconfig = {
//       method: 'post',
//       maxBodyLength: Infinity,
//       url: process.env.BASE_URL + "/scancard", //TODO Make this url from env file
//       headers: {
//         'Content-Type': 'application/json'
//       },
//       data: data
//     };
//     let res = await axios.request(rconfig);
//     if (!(res && res.data && res.data.success))
//       console.log("Result :", res.data);

//   } catch (error) {
//     if (error.response) {
//       await sendSlackMessage(`LS Response corn error:${error.response.status}\nStack Trace:\n${error.stack}\nResponse:\n${JSON.stringify(error)}`);
//     } else if (error.request) {
//       await sendSlackMessage(`LS Request corn error: ${error.message}\nStack Trace:\n${error.stack}`);
//     } else {
//       await sendSlackMessage(`LS An error occurred: ${error.message}\nStack Trace:\n${error.stack}`);
//     }

//   }
// });

// cron.schedule('*/10 * * * * *', async () => {
//   const randomCard = getRandomCard();
//   console.log(`Generated random card: ${randomCard}`);

//   try {
//     let data = JSON.stringify({
//       "game_code": "TP20",
//       "card_code": randomCard
//     });
//     rconfig = {
//       method: 'post',
//       maxBodyLength: Infinity,
//       url: process.env.BASE_URL + "/scancard", //TODO Make this url from env file
//       headers: {
//         'Content-Type': 'application/json'
//       },
//       data: data
//     };
//     let res = await axios.request(rconfig);
//     if (!(res && res.data && res.data.success))
//       console.log("Result :", res.data);

//   } catch (error) {
//     if (error.response) {
//       await sendSlackMessage(`TP20 Response corn error:${error.response.status}\nStack Trace:\n${error.stack}\nResponse:\n${JSON.stringify(error)}`);
//     } else if (error.request) {
//       await sendSlackMessage(`TP20 Request corn error: ${error.message}\nStack Trace:\n${error.stack}`);
//     } else {
//       await sendSlackMessage(`TP20 An error occurred: ${error.message}\nStack Trace:\n${error.stack}`);
//     }

//   }
// });
