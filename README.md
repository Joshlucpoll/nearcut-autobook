# Nearcut Auto-Booking

A simple telegram bot that allows you to auto-book barbers appointments using the Nearcut booking system.
This application was primarily developed as a way of auto-booking cancellations when wait times are long for appointments.

The bot will look ahead a specified number of days for available appointments that meet a defined 'availability filter' and then automatically book the appointment. 
A scheduler can also be set up to continuously look for new/cancelled appointments until one is found that matches the criteria, at which point the scheduler will automatically stop.

## Setup

### Telegram Bot and Configuration
Create a new bot by messaging [`@BotFather`](https://telegram.me/botfather) with `/newbot` on Telegram and follow the prompts. Save the `TELEGRAM_TOKEN` for later use.

> You can also customise the bot with a profile picture with `/setuserpic`
>
> Setting bot commands will also make interacting with the bot must easier:
> 1) `/mybots`
> 2) Select your bot
> 3) Edit Bot > Edit Commmands
> 4) Send this:
> ```
> status - Get bot status
> showconfig - Displays running configuration
> editconfig - Edit running configuration
> run - Start scheduler
> stop - Stop scheduler
> book - Try and book an appointment
> ```

#### Getting Telegram ID
You will also need to get your TelegramID, this is so only you have access to the bot.
Message [`@userinfobot`](https://telegram.me/userinfobot) `/start` to get your 'TELEGRAM_ID'

### Installation
The script can be run on any stand-alone system with `node` installed or as a Docker container


#### Environment Variables
The script requires `TELEGRAM_TOKEN` and `TELEGRAM_ID` as environment variables for the bot to run. Other enviornment variables are set using the `/editconfig` Telegram bot command or can be added by running the `set-store.ts` script.

| **Environment Variable**    | **Description**                                                                                                                                                | **Required to Run** |
|-----------------------------|----------------------------------------------------------------------------------------------------------------------------------------------------------------|:-------------------:|
| `TELEGRAM_TOKEN`            | The Telegram token obtained from BotFather                                                                                                                     | ✅                  |
| `TELEGRAM_ID`               | Your Telegram User ID obtained from UserInfoBot                                                                                                                | ✅                  |
| `BARBERS_SHOP`              | The barber shop subdomain (https://<BARBERS_SHOP>.nearcut.com)                                                                                                 | ❌                  |
| `BARBER`                    | The name of the barber you want to book with (user `*` for any barber)                                                                                         | ❌                  |
| `SELECTED_SERVICE`          | The name of the service you would like to book                                                                                                                 | ❌                  |
| `NUMBER_OF_DAYS_AHEAD`      | How many days to look ahead for booking                                                                                                                        | ❌                  |
| `DATE_FILTER`               | A JSON object describing what days and times you are free [see](#date_filter-object)                                                                           | ❌                  | 
| `SCHEDULE_INTERVAL_MINUTES` | How often in minutes the scheduler should check for appointments                                                                                               | ❌                  |
| `EMAIL`                     | Your Nearcut email                                                                                                                                             | ❌                  |
| `PASSWORD`                  | Your Nearcut password                                                                                                                                          | ❌                  |

#### Standalone
1) Clone the repo : `git clone https://github.com/joshlucpoll/nearcut-autobook`
2) `npm i`
3) `npx playwright install` if this is the first time using playwright on your system
4) `node index.ts`

#### Docker
```
docker run --name=nearcut-autobooking -d \
  --restart=always \
  -e 'TELEGRAM_TOKEN=<telegram_token>' \
  -e 'TELEGRAM_ID=<telegram_id>' \
joshlucpoll/nearcut-autobook
```

### `DATE_FILTER` Object
The `DATE_FILTER` object defines what days and times you are avalible, here is an example configuration:

```json
{
    "Monday": true,
    "Tuesday": [
        ["8:00", "8:30"],
        ["17:00", "19:00"]
    ],
    "Wednesday": false,
    "Thursday": [
        ["8:15", "10:30"],
        ["13:00", "15:45"],
        ["17:10", "18:00"]
    ],
    "Friday": true,
    "Saturday": true,
    "Sunday": false
}
```
It must contain every day of the week as a key, the value can be either:
- `true` - Free all day
- `false` - Not avalible all day
- List of 'from' and 'to' times that define what periods in that day are free

For the example above:
- Tuesday is available to book 8:00am-8:30am OR 5:00pm-7:00pm
- Thurday is avaliable to book 8:10am-10:30am OR 1:00pm-1:45pm OR 5:10pm-6:00pm

> **NOTE**
> - All times must be in 24h format
> - An appointment will match *any* time period specified
> - You can have an unlimited amount of time periods
> Test and validate your `DATE_FILTER` [here](https://www.jsonschemavalidator.net/s/eNh6nABX)
