/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */
"use strict";

const events = require("events");
const util = require("util");

const EventEmitter = events.EventEmitter;

function Gateway(transport) {
  EventEmitter.call(this);
  this._transport = transport;
  this._linkedIdsByActorId = {};
  this._onMessage = this._onMessage.bind(this);
  this._onClose = this._onClose.bind(this);
  this._transport.addListener("message", this._onMessage);
  this._transport.once("close", this._onClose);
  this._transport.start();
}

util.inherits(Gateway, EventEmitter);

Gateway.prototype.postMessage = function (message) {
  switch (message.type) {
  case "link":
    this._link(message.toId, message.fromId);
    break;
  case "unlink":
    this._unlink(message.toId, message.fromId);
    break;
  }
  this._transport.postMessage(message);
};

Gateway.prototype._onMessage = function (message) {
  switch (message.type) {
  case "link":
    this._link(message.fromId, message.toId);
    break;
  case "exit":
  case "error":
  case "unlink":
    this._unlink(message.fromId, message.toId);
    break;
  }
  this.emit("message", message);
};

Gateway.prototype._onClose = function () {
  let actorIds = Object.keys(this._linkedIdsByActorId);
  for (let index = 0; index < actorIds.length; index += 1) {
    let actorId = actorIds[index];
    let linkedIds = Object.keys(this._linkedIdsByActorId[actorId]);
    for (let index = 0; index < linkedIds.length; index += 1) {
      this.emit("message", {
        toId: linkedIds[index],
        type: "error",
        fromId: actorId,
        error: new Error("Actor is dead.")
      });
    }
  }
  this.removeListener("message", this._onMessage);
  this.emit("close");
};

Gateway.prototype._link = function (actorId1, actorId2) {
  let linkedIds = this._linkedIdsByActorId[actorId1];
  if (linkedIds === undefined) {
    linkedIds = {};
    this._linkedIdsByActorId[actorId1] = linkedIds;
  }
  linkedIds[actorId2] = actorId2;
};

Gateway.prototype._unlink = function (actorId1, actorId2) {
  let linkedIds = this._linkedIdsByActorId[actorId1];
  if (linkedIds === undefined) {
    return;
  }
  delete linkedIds[actorId2];
  if (Object.keys(linkedIds).length === 0) {
    delete this._linkedIdsByActorId[actorId1];
  }
};

exports.Gateway = Gateway;
