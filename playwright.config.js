// @ts-check
const { defineConfig } = require('@playwright/test');
require('dotenv').config();

module.exports = defineConfig({
  testDir: './tests',
  use: {
    baseURL: process.env.WP_URL,
    extraHTTPHeaders: {
      'Accept': 'application/json',
    },
  },
});
