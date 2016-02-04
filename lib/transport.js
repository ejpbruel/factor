/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */
"use strict";

const EventEmitter = require("events").EventEmitter;
const util = require("util");

function Transport() {
  if (this.constructor === Transport) {
    throw new Error("Can't construct abstract class.");
  }
  EventEmitter.call(this);
}

util.inherits(Transport, EventEmitter);

Transport.prototype.postMessage = function (message) {
  throw new Error("Can't call abstract function.");
};

Transport.prototype.start = function () {
  throw new Error("Can't call abstract function.");
};

Transport.prototype.close = function () {
  throw new Error("Can't call abstract function.");
};

function LocalTransport() {
  Transport.call(this);
  this._other = null;
}

util.inherits(LocalTransport, Transport);

LocalTransport.createPipe = function () {
  var transport1 = new LocalTransport();
  var transport2 = new LocalTransport();
  transport1._other = transport2;
  transport2._other = transport1;
  return [transport1, transport2];
};

util.inherits(LocalTransport, EventEmitter);

LocalTransport.prototype.postMessage = function (message) {
  setImmediate(() => {
    this._other.emit("message", message);
  });
};

LocalTransport.prototype.start = function () {};

LocalTransport.prototype.close = function () {
  this._other.emit("close");
};

exports.LocalTransport = LocalTransport;

function ProcessTransport(process) {
  EventEmitter.call(this);
  this._process = process;
  this._onMessage = this._onMessage.bind(this);
  this._onClose = this._onClose.bind(this);
}

util.inherits(ProcessTransport, EventEmitter);

ProcessTransport.prototype.start = function () {
  this._process.addListener("message", this._onMessage);
  this._process.addListener("close", this._onClose);
};

ProcessTransport.prototype.close = function () {};

ProcessTransport.prototype.postMessage = function (message) {
  this._process.send(message);
};

ProcessTransport.prototype._onMessage = function (message) {
  this.emit("message", message);
};

ProcessTransport.prototype._onClose = function () {
  this._process.removeListener("close", this._onClose);
  this._process.removeListener("message", this._onMessage);
  this.emit("close");
};

exports.ProcessTransport = ProcessTransport;
