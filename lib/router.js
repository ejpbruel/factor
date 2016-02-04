/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */
"use strict";

const action = require("./action");
const actor = require("./actor");
const gateway = require("./gateway");

const Actor = actor.Actor;
const Gateway = gateway.Gateway;
const link = action.link;

function Router(prefix, transport) {
  if (prefix === undefined) {
    prefix = "";
  }
  if (transport === undefined) {
    transport = null;
  }
  this._prefix = prefix;
  this._transport = transport;
  this._countersByName = {};
  this._actorsByActorId = {};
  this._gatewaysByPrefix = {};
  this._errorHandler = null;
  this._onMessage = this._onMessage.bind(this);
  if (this._transport !== null) {
    this._transport.addListener("message", this._onMessage);
    this._transport.start();
  }
}

Router.prototype.spawn = function (callback) {
  let name = callback.name;
  if (name === undefined) {
    name = "actor";
  }
  let actorId = this._allocateId(name);
  let actor = new Actor(this, actorId);
  let onMessage = this.postMessage.bind(this);
  actor.addListener("message", onMessage);
  this._actorsByActorId[actorId] = actor;
  actor.once("close", () => {
    actor.removeListener("message", onMessage);
    delete this._actorsByActorId[actorId];
  });
  setImmediate(() => {
    actor.start(callback).then(() => {
      delete this._actorsByActorId[actorId];
    });
  });
  return actorId;
};

Router.prototype.spawnRemote = function (name, callback) {
  let prefix = this._allocateId(name);
  return callback(prefix).then((value) => {
    let gateway = new Gateway(value[1]);
    gateway.addListener("message", this._onMessage);
    this._gatewaysByPrefix[prefix] = gateway;
    gateway.once("close", () => {
      gateway.removeListener("message", this._onMessage);
      delete this._gatewaysByPrefix[prefix];
    });
    return value[0];
  });
};

Router.prototype.discardMessage = function (message) {
  switch (message.type) {
  case "link":
    this.postMessage({
      toId: message.fromId,
      type: "error",
      fromId: message.toId,
      error: new Error("Actor is dead.")
    });
    break;
  case "message":
    this._onError(new Error("Discarding message to " + message.toId + "."));
    break;
  }
};

Router.prototype.postMessage = function (message) {
  setImmediate(() => {
    this._onMessage(message);
  });
};

Router.prototype.setErrorHandler = function (callback) {
  if (callback === undefined) {
    callback = null;
  }
  this._errorHandler = callback;
};

Router.prototype._allocateId = function (name) {
  let counter = this._countersByName[name];
  if (counter === undefined) {
    counter = 1;
  }
  this._countersByName[name] = counter + 1;
  return this._prefix + "/" + name + counter;
};

Router.prototype._onMessage = function (message) {
  let toId = message.toId;
  if (toId === undefined && message.type === "error") {
    this._onError(message.error);
    return;
  }
  let actor = this._actorsByActorId[toId];
  if (actor !== undefined) {
    actor.postMessage(message);
    return;
  }
  let longestPrefix = "";
  if (this._prefix === toId.slice(0, this._prefix.length)) {
    longestPrefix = this._prefix;
  }
  let prefixes = Object.keys(this._gatewaysByPrefix);
  for (let index = 0; index < prefixes.length; index += 1) {
    let prefix = prefixes[index];
    if (prefix !== toId.slice(0, prefix.length)) {
      continue;
    }
    if (longestPrefix.length < prefix.length) {
      longestPrefix = prefix;
    }
  }
  if (longestPrefix.length === 0) {
    if (this._transport !== null) {
      this._transport.postMessage(message);
      return;
    }
  }
  else if (longestPrefix !== this._prefix) {
    this._gatewaysByPrefix[longestPrefix].postMessage(message);
    return;
  }
  this.discardMessage(message);
};

Router.prototype._onError = function (error) {
  if (this._errorHandler !== null) {
    this._errorHandler(error);
    return;
  }
  if (this._transport !== null) {
    this._transport.postMessage({
      type: "error",
      error: error
    });
  }
  else {
    console.log(error);
  }
};

exports.Router = Router;
