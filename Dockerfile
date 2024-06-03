# Base image
FROM node:14

# Playwright dependencies
RUN apt-get update && apt-get install -y \
  wget \
  libgbm-dev \
  libgtk-3-0 \
  libnss3 \
  libatk1.0-0 \
  libatk-bridge2.0-0 \
  libx11-xcb1 \
  libdrm2 \
  libxcomposite1 \
  libxdamage1 \
  libxfixes3 \
  libxrandr2 \
  libxshmfence1 \
  libgbm1 \
  libpangocairo-1.0-0 \
  libpango-1.0-0 \
  libcairo2 \
  libcups2 \
  libdbus-glib-1-2 \
  libasound2

# Create app directory
WORKDIR /usr/src/app

# Install app dependencies
COPY package*.json ./
RUN npm install

# If building for production
RUN npm ci --only=production

RUN npx playwright install

# Bundle app source
COPY . .

# create data.json as an empty JSON object
RUN echo "{}" > data.json

# Start application
CMD node index.ts

