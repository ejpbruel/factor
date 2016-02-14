/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */
"use strict";

import { link } from "./action";
import Actor from "./actor";
import { MonitoredTransport } from "./transport";

export default class Router {
  constructor(prefix = "", transport = null) {
    this._prefix = prefix;
    this._transport = transport;
    this._actorIdToActorMap = new Map();
    this._prefixToTransportMap = new Map();
    this._onMessage = this._onMessage.bind(this);
    if (this._transport !== null) {
      this._transport.addListener("message", this._onMessage);
      this._transport.start();
    }
  }

  spawn(callback) {
    // TODO: allocateId
    let actorId = this._prefix + "/actor" + Math.random().toString(16).slice(2);
    let actor = new Actor(this, actorId);
    this._actorIdToActorMap.set(actorId, actor);
    setImmediate(() => {
      actor.run(callback).then(() => {
        this._actorIdToActorMap.delete(actorId);
        if (this._actorIdToActorMap.size > 0) {
          return;
        }
        if (this._transport !== null) {
          this._transport.removeListener("message", this._onMessage);
          this._transport.close();
        }
      });
    });
    return actorId;
  }

  spawnLinked(toId, callback) {
    return this.spawn(function* () {
      yield link(toId);
      return callback();
    });
  }

  spawnRemote(toId, transport) {
    // TODO: allocateId
    let prefix = this._prefix + "/child" + Math.random().toString(16).slice(2);
    transport.postMessage({
      // TODO: type?
      prefix: prefix,
      toId: toId
    });
    transport = new MonitoredTransport(transport);
    return new Promise((resolve, reject) => {
      // TODO: Cleanup?
      let onMessage1 = (message) => {
        transport.removeListener("message", onMessage1);
        transport.removeListener("close", onClose1);
        this.postMessage(message);
        let onMessage2 = (message) => {
          this.postMessage(message);
        };
        let onClose2 = () => {
          transport.removeListener("message", onMessage2);
          transport.removeListener("close", onClose2);
          this._prefixToTransportMap.delete(prefix);
        };
        transport.addListener("message", onMessage2);
        transport.addListener("close", onClose2);
        this._prefixToTransportMap.set(prefix, transport);
        resolve(message.fromId);
      };
      let onClose1 = () => {
        transport.removeListener("message", onMessage1);
        transport.removeListener("close", onClose1);
        reject(new Error("Connection failed."));
      };
      transport.addListener("message", onMessage1);
      transport.addListener("close", onClose1);
      transport.start();
    });
  }

  // TODO: Set error handler

  postMessage(message) {
    let { toId } = message;
    let actor = this._actorIdToActorMap.get(toId);
    if (actor !== undefined) {
      actor.postMessage(message);
      return;
    }
    let longestPrefix = "";
    if (this._prefix === toId.slice(0, this._prefix.length)) {
      longestPrefix = this._prefix;
    }
    for (let prefix of this._prefixToTransportMap.keys()) {
      if (prefix !== toId.slice(0, prefix.length)) {
        continue;
      }
      if (longestPrefix.length < prefix.length) {
        longestPrefix = prefix;
      }
    }
    if (longestPrefix !== this._prefix) {
      if (longestPrefix.length > 0) {
        this._prefixToTransportMap.get(longestPrefix).postMessage(message);
        return;
      }
      else if (this._transport !== null) {
        this._transport.postMessage(message);
        return;
      }
    }
  }

  discardMessage(message) {
    let { toId } = message;
    switch (message.type) {
    case "link":
      this.postMessage({
        toId: message.fromId,
        type: "error",
        fromId: toId,
        error: new Error("Actor is dead.")
      });
      break;
    case "message":
      this._reportError(new Error("Discarding message to " + toId + "."));
      break;
    }
  }

  reportError(error) {
    // TODO: Error messages
    console.log(error.stack);
  }

  _onMessage(message) {
    this.postMessage(message);
  }
};

// TODO: Creation helper
