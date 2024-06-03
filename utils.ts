function parseTimeStringToDateTime(dateString, timeString) {
  // Remove ordinal indicator from dateString
  const normalizedDateString = dateString.replace(/(\d+)(st|nd|rd|th)/, "$1");

  // Parse normalized date string
  const date = new Date(normalizedDateString);

  // Split time into components
  const timeComponents = timeString.match(/(\d+):(\d+)/);

  if (timeComponents === null) throw new Error("Invalid time format!");

  // Parse the hour and minute
  const hour = parseInt(timeComponents[1], 10);
  const minute = parseInt(timeComponents[2], 10);

  // Update the date object with the new time
  date.setHours(hour, minute);

  return date;
}

function isDateInArray(dateArray, date) {
  const dateString = date.toISOString();
  return dateArray.some((d) => d.toISOString() === dateString);
}

module.exports = { parseTimeStringToDateTime, isDateInArray };
