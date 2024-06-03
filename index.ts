// @ts-check
const TelegramBot = require("node-telegram-bot-api");

const playwright = require("playwright");
const utils = require("./utils.ts");
const Ajv = require("ajv");
const fs = require("fs").promises;

const filePath = "data.json";
let enabled = false;

async function storeSet(key, value) {
  const current_data = await fs.readFile(filePath, "utf8");
  const data = JSON.parse(current_data);
  data[key] = value;

  await fs.writeFile(filePath, JSON.stringify(data));
}

async function storeGet(key) {
  const current_data = await fs.readFile(filePath, "utf8");
  const data = JSON.parse(current_data);
  return data[key];
}

let BARBERS_SHOP;
let BARBER;
let SELECTED_SERVICE;
let EMAIL;
let PASSWORD;
let NUMBER_OF_DAYS_AHEAD;
let DATE_FILTER;
let SCHEDULE_INTERVAL_MINUTES;

let TELEGRAM_TOKEN;
let TELEGRAM_ID;

const days = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
];

const delay = (ms) => new Promise((res) => setTimeout(res, ms));

async function login(page) {
  await page.goto(`https://${BARBERS_SHOP}.nearcut.com` + "/users/sign_in");
  // check if logout button is present
  let logoutButton = await page.$('[href="/users/sign_out"]');
  if (logoutButton) {
    return;
  }

  await page.click("text=Login");
  await page.fill('input[name="user[email]"]', EMAIL);
  await page.fill('input[name="user[password]"]', PASSWORD);
  await page.click('[type="submit"]');

  await delay(2000);

  logoutButton = await page.$('[href="/users/sign_out"]');

  if (logoutButton) {
    return;
  }
  throw new Error("Login failed");
}

async function findAppointment(page) {
  await page.goto(`https://${BARBERS_SHOP}.nearcut.com` + "/book");

  // select barber
  const element = await page.locator('text="Choose a barber"');
  if ((await element.count()) > 0) {
    const barbers = await page.locator(".barber-booking-header").all();
    const barberSelectionButtons = await page.locator("a.btn-success").all();

    let barber_found;

    for (let barber of barbers) {
      // get text of title element
      const barberText = await barber.textContent();

      if (barberText.trim() === BARBER) {
        await barberSelectionButtons[barbers.indexOf(barber)].click();

        barber_found = true;
        break;
      }
    }

    if (!barber_found) {
      console.log("Barber not found");
      const allBarbersButton = await page.locator("a.btn-success").last();
      await allBarbersButton.click();
    }

    await delay(1000);
  }

  // get list of elements that have the id service-option-*
  const services = await page.$$("[id^='service-option-']");
  let service_found;

  for (let service of services) {
    // get title element
    const serviceTitle = await service.$("b");
    // get text of title element
    const serviceText = await serviceTitle.textContent();

    if (serviceText === SELECTED_SERVICE) {
      await service.click();
      service_found = service;
      break;
    }
  }

  if (!service_found) throw new Error("Service not found");

  // book now
  const bookNowButton = await service_found.$(".btn-custom-book");
  await bookNowButton.click();

  const nextButton = await page.$(".btn-custom-next");
  await nextButton.click();

  // click next available day
  const firstDay = await page.locator("a.calendar-day").first();
  await firstDay.click();

  let availableAppointments = [];
  for (let i = 0; i < NUMBER_OF_DAYS_AHEAD; i++) {
    await delay(1000);
    const date = await page.locator("h2").first();
    const times = await page.locator("a.day-time").all();

    const dateString = await date.textContent();

    // get time string from span
    for (let time of times) {
      const timeString = await time.textContent();
      // console.log(timeString);

      availableAppointments.push(
        utils.parseTimeStringToDateTime(dateString, timeString)
      );
    }

    await page.getByText("+1", { exact: true }).click();
  }

  console.log("Available appointments: " + availableAppointments.length);

  // filter appointments by chosen days
  availableAppointments = availableAppointments.filter((appointment) => {
    const day = days[appointment.getDay() - 1];

    console.log("Day: " + day);
    console.log(DATE_FILTER[day]);

    if (DATE_FILTER[day] === false) return false;
    if (DATE_FILTER[day] === true) return true;

    return DATE_FILTER[day].some((timeRange) => {
      // check if appointment time is within range
      const start = new Date(appointment);
      start.setHours(timeRange[0].split(":")[0]);
      start.setMinutes(timeRange[0].split(":")[1]);

      const end = new Date(appointment);
      end.setHours(timeRange[1].split(":")[0]);
      end.setMinutes(timeRange[1].split(":")[1]);

      return appointment >= start && appointment <= end;
    });
  });

  console.log("Available appointments: " + availableAppointments.length);

  for (let appointment of availableAppointments) {
    console.log(appointment);
  }

  if (availableAppointments.length === 0)
    throw new Error("No free appointments available");

  await page.getByText("Back", { exact: true }).click();

  const firstDate = await page.locator("a.calendar-day").first();
  await firstDate.click();

  for (let i = 0; i < NUMBER_OF_DAYS_AHEAD; i++) {
    await delay(1000);
    const date = await page.locator("h2").first();
    const times = await page.locator("a.day-time").all();

    const dateString = await date.textContent();

    // get time string from span
    for (let time of times) {
      const timeString = await time.textContent();

      const date = utils.parseTimeStringToDateTime(dateString, timeString);

      if (utils.isDateInArray(availableAppointments, date)) {
        console.log("found");
        await time.click();
        return;
      }
    }

    await page.getByText("+1", { exact: true }).click();
  }
  throw new Error("No appointments available for criteria");
}

async function newAppointment() {
  // check all required fields are set
  if (
    !BARBERS_SHOP ||
    !BARBER ||
    !SELECTED_SERVICE ||
    !EMAIL ||
    !PASSWORD ||
    !NUMBER_OF_DAYS_AHEAD ||
    !DATE_FILTER ||
    !SCHEDULE_INTERVAL_MINUTES
  ) {
    return "Missing configuration";
  }

  const browser = await playwright.chromium.launch();
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto(`https://${BARBERS_SHOP}.nearcut.com`);

  // dismiss information modal
  const element = await page.$('[data-dismiss="modal"]');
  if (element) {
    await page.click('[data-dismiss="modal"]');
  }

  try {
    await login(page);
  } catch (e) {
    console.log(e.message);
    await browser.close();
    return e.message;
  }

  try {
    await findAppointment(page);
  } catch (e) {
    console.log(e.message);
    await browser.close();
    return e.message;
  }

  const summary = await page.locator("h3").first().textContent();
  await page.locator("[type='submit']").click();

  await browser.close();
  console.log("Appointment booked: " + summary);
  return "Appointment booked: " + summary;
}

async function validateData(data_string) {
  const ajv = new Ajv.default();

  // Read the schema file
  const raw_schema = await fs.readFile("date_filter_schema.json", "utf8");
  const schema = JSON.parse(raw_schema);

  // Parse the data string
  const data = JSON.parse(data_string);

  // Validate the data against the schema
  const validate = ajv.compile(schema);
  const valid = validate(data);

  if (valid) {
    console.log("Data is valid");
    return true;
  } else {
    console.log(validate.errors);
    return JSON.stringify(validate.errors);
  }
}

async function bot() {
  const bot = new TelegramBot(TELEGRAM_TOKEN, { polling: true });

  console.log("Bot started");

  bot.onText(/\/status/, async (msg) => {
    if (msg.from.id.toString() === TELEGRAM_ID) {
      await bot.sendMessage(
        msg.chat.id,
        `Bot is online. Scheduler running: ${enabled}`
      );
    }
  });

  bot.onText(/\/showconfig/, async (msg) => {
    if (msg.from.id.toString() === TELEGRAM_ID) {
      // show config
      await bot.sendMessage(msg.chat.id, `BARBERS_SHOP: ${BARBERS_SHOP}`);
      await bot.sendMessage(msg.chat.id, `BARBER: ${BARBER}`);
      await bot.sendMessage(
        msg.chat.id,
        `SELECTED_SERVICE: ${SELECTED_SERVICE}`
      );
      await bot.sendMessage(msg.chat.id, `EMAIL: ${EMAIL}`);
      await bot.sendMessage(
        msg.chat.id,
        `NUMBER_OF_DAYS_AHEAD: ${NUMBER_OF_DAYS_AHEAD}`
      );
      await bot.sendMessage(
        msg.chat.id,
        `DATE_FILTER: ${JSON.stringify(DATE_FILTER, null, 2)}`
      );
      await bot.sendMessage(
        msg.chat.id,
        `SCHEDULE_INTERVAL_MINUTES: ${SCHEDULE_INTERVAL_MINUTES}`
      );
    }
  });

  bot.onText(/\/editconfig/, async (msg) => {
    if (msg.from.id.toString() === TELEGRAM_ID) {
      const chatId = msg.chat.id;
      const configKeys = [
        "BARBERS_SHOP",
        "BARBER",
        "SELECTED_SERVICE",
        "EMAIL",
        "PASSWORD",
        "NUMBER_OF_DAYS_AHEAD",
        "DATE_FILTER",
        "SCHEDULE_INTERVAL_MINUTES",
      ];

      await bot.sendMessage(chatId, "What do you want to edit?", {
        reply_markup: {
          keyboard: [...configKeys.map((key) => [key]), ["exit"]],
        },
      });

      const response = await new Promise((resolve) => {
        bot.once("message", (msg) => {
          resolve(msg.text.trim());
        });
      });

      if (response === "exit") {
        await bot.sendMessage(chatId, "Exiting configuration mode.");
        return;
      }

      if (!configKeys.includes(response)) {
        await bot.sendMessage(chatId, "Invalid configuration key.");
        return;
      }

      const key = response;
      const currentValue = await storeGet(key);

      if (key === "PASSWORD") {
        await bot.sendMessage(chatId, `Current value for ${key}: ********`);
      } else if (key === "DATE_FILTER") {
        await bot.sendMessage(
          chatId,
          `Current value for ${key}: ${JSON.stringify(currentValue, null, 2)}`
        );
      } else {
        await bot.sendMessage(
          chatId,
          `Current value for ${key}: ${currentValue}\nEnter new value or type 'exit' to exit:`
        );
      }

      const response_2 = await new Promise((resolve) => {
        bot.once("message", (msg) => {
          resolve(msg.text);
        });
      });

      if (response_2.trim() === "exit") {
        await bot.sendMessage(chatId, "Exiting configuration mode.");
        return;
      }

      // Validate the new value
      let newValue = response_2.trim();

      if (
        key === "NUMBER_OF_DAYS_AHEAD" ||
        key === "SCHEDULE_INTERVAL_MINUTES"
      ) {
        const parsedValue = parseInt(newValue);
        if (isNaN(parsedValue) || parsedValue <= 0) {
          await bot.sendMessage(
            chatId,
            "Invalid value. Please enter a positive number."
          );
          return;
        }
        newValue = parsedValue.toString();
      } else if (key === "DATE_FILTER") {
        try {
          console.log(newValue);
          console.log(JSON.parse(newValue));
          const validation = await validateData(newValue);

          console.log("validation: " + validation);
          if (validation !== true) {
            throw new Error(validation);
          }
          newValue = JSON.parse(newValue);
        } catch (e) {
          console.log(e.message);
          await bot.sendMessage(
            chatId,
            "Invalid value. Please enter a valid JSON object." + e.message
          );
          return;
        }
      }

      // Update the value
      await storeSet(key, newValue);
      if (key === "PASSWORD") {
        await bot.sendMessage(chatId, `Value for ${key} updated to: ********`);
      } else if (key === "DATE_FILTER") {
        await bot.sendMessage(
          chatId,
          `Value for ${key} updated to: ${JSON.stringify(newValue, null, 2)}`
        );
      } else {
        await bot.sendMessage(
          chatId,
          `Value for ${key} updated to: ${newValue}`
        );
      }

      await updateConstants();
    }
  });

  bot.onText(/\/run/, async (msg) => {
    if (msg.from.id.toString() === TELEGRAM_ID) {
      if (enabled) {
        await bot.sendMessage(msg.chat.id, "Scheduler is already running.");
        return;
      }
      enabled = true;

      await bot.sendMessage(msg.chat.id, "Running scheduler...");
      await appointmentScheduler(async (message) => {
        await bot.sendMessage(msg.chat.id, "Scheduler: " + message);
      });
      await bot.sendMessage(msg.chat.id, "Scheduler stopped.");
    }
  });

  bot.onText(/\/stop/, async (msg) => {
    if (msg.from.id.toString() === TELEGRAM_ID) {
      enabled = false;
      await bot.sendMessage(msg.chat.id, "Stopping scheduler...");
      await bot.sendMessage(
        msg.chat.id,
        `Wait at least ${SCHEDULE_INTERVAL_MINUTES} minutes for scheduler to stop.`
      );
    }
  });

  bot.onText(/\/book/, async (msg) => {
    if (msg.from.id.toString() === TELEGRAM_ID) {
      await bot.sendMessage(msg.chat.id, "Booking appointment, please wait...");
      const result = await newAppointment();
      await bot.sendMessage(msg.chat.id, result);
    }
  });
}

async function appointmentScheduler(sendMessage) {
  while (enabled) {
    try {
      const result = await newAppointment();
      sendMessage(result);
      if (
        result.includes("Appointment booked") ||
        result.includes("Missing configuration")
      ) {
        enabled = false;
        return;
      }
    } catch (e) {
      console.log(e.message);
      sendMessage(e.message);
    }
    await delay(SCHEDULE_INTERVAL_MINUTES * 60 * 1000);
  }
  return;
}

async function updateConstants() {
  BARBERS_SHOP = await storeGet("BARBERS_SHOP");
  BARBER = await storeGet("BARBER");
  SELECTED_SERVICE = await storeGet("SELECTED_SERVICE");
  EMAIL = await storeGet("EMAIL");
  PASSWORD = await storeGet("PASSWORD");
  NUMBER_OF_DAYS_AHEAD = await storeGet("NUMBER_OF_DAYS_AHEAD");
  DATE_FILTER = await storeGet("DATE_FILTER");
  SCHEDULE_INTERVAL_MINUTES = await storeGet("SCHEDULE_INTERVAL_MINUTES");

  await storeSet("TELEGRAM_TOKEN", process.env.TELEGRAM_TOKEN);
  await storeSet("TELEGRAM_ID", process.env.TELEGRAM_ID);
  TELEGRAM_TOKEN = process.env.TELEGRAM_TOKEN;
  TELEGRAM_ID = process.env.TELEGRAM_ID;
}

async function main() {
  await updateConstants();

  await bot();
}

main();
