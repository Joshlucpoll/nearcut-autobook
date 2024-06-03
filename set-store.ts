const fs = require("fs");

const filePath = "data.json";

function storeSet(key, value) {
  const data = JSON.parse(fs.readFileSync(filePath, "utf8"));
  data[key] = value;
  fs.writeFileSync(filePath, JSON.stringify(data));
}

let dateFilter = process.env.DATE_FILTER;
if (dateFilter) {
  dateFilter = JSON.parse(dateFilter);
} else {
  dateFilter = undefined;
}

storeSet("BARBERS_SHOP", process.env.BARBERS_SHOP);
storeSet("BARBER", process.env.BARBER);
storeSet("SELECTED_SERVICE", process.env.SELECTED_SERVICE);
storeSet("EMAIL", process.env.EMAIL);
storeSet("PASSWORD", process.env.PASSWORD);
storeSet("NUMBER_OF_DAYS_AHEAD", process.env.NUMBER_OF_DAYS_AHEAD);
storeSet("DATE_FILTER", dateFilter);
storeSet("SCHEDULE_INTERVAL_MINUTES", process.env.SCHEDULE_INTERVAL_MINUTES);

storeSet("TELEGRAM_TOKEN", process.env.TELEGRAM_TOKEN);
storeSet("TELEGRAM_ID", process.env.TELEGRAM_ID);

console.log("Store set successfully");
