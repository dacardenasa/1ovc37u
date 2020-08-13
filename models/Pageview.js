'use strict'
const mongoose = require("mongoose");

const schema = new mongoose.Schema({
  path: { type: String },
  date: { type: Date, default: new Date() },
  userAgent: { type: String },
}, { collection: "pageView" });

module.exports = mongoose.model("Pageview", schema);