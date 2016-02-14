/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */
"use strict";

import { EventEmitter } from "events";

export class MonitoredTransport extends EventEmitter {
  constructor(transport) {
    super();
    this._transport = transport;
    this._actorIdToLinkedIdSetMap = new Map();
    this._onMessage = this._onMessage.bind(this);
    this._onClose = this._onClose.bind(this);
    this._transport.addListener("message", this._onMessage);
    this._transport.addListener("close", this._onClose);
  }

  start() {
    this._transport.start();
  }

  postMessage(message) {
    switch (message.type) {
    case "link":
      this._link(message.toId, message.fromId);
      break;
    case "unlink":
    case "exit":
    case "error":
      this._unlink(message.toId, message.fromId);
      break;
    }
    this._transport.postMessage(message);
  }

  close() {
    this._transport.close();
  }

  _onMessage(message) {
    switch (message.type) {
    case "link":
      this._link(message.fromId, message.toId);
      break;
    case "unlink":
    case "exit":
    case "error":
      this._unlink(message.fromId, message.toId);
      break;
    }
    this.emit("message", message);
  }

  _onClose() {
    this._transport.removeListener("message", this._onMessage);
    this._transport.removeListener("close", this._onClose);
    for (let [actorId, linkedIdSet] of this._actorIdToLinkedIdSetMap) {
      for (let linkedId of linkedIdSet) {
        this.emit("message", {
          toId: linkedId,
          type: "error",
          fromId: actorId
        });
      }
    }
    this.emit("close");
  }

  _link(fromId, toId) {
    let linkedIdSet = this._actorIdToLinkedIdSetMap.get(fromId);
    if (linkedIdSet === undefined) {
      linkedIdSet = new Set();
      this._actorIdToLinkedIdSetMap.set(fromId, linkedIdSet);
    }
    linkedIdSet.add(toId);
  }

  _unlink(fromId, toId) {
    let linkedIdSet = this._actorIdToLinkedIdSetMap.get(fromId);
    if (linkedIdSet === undefined) {
      return;
    }
    linkedIdSet.delete(toId);
    if (linkedIdSet.size === 0) {
      this._actorIdToLinkedIdSetMap.delete(fromId);
    }
  }
};

export class LocalTransport extends EventEmitter {
  constructor() {
    super();
    this._onMessage = null;
    this._messageQueue = [];
    this._onClose = null;
    this._isClosed = false;
    this._other = null;
  }

  start() {
    this._onMessage = function (message) {
      this.emit("message", message);
    };
    while (this._messageQueue.length > 0) {
      this._onMessage(this._messageQueue.shift());
    }
    this._onClose = function () {
      this.emit("close");
    };
    if (this._isClosed) {
      this._onCLose();
    }
  }

  postMessage(message) {
    if (this._other._isClosed) {
      return;
    }
    setImmediate(() => {
      if (this._other._onMessage !== null) {
        this._other._onMessage(message);
      }
      else {
        this._other._messageQueue.push(message);
      }
    });
  }

  close() {
    if (this._other._isClosed) {
      return;
    }
    setImmediate(() => {
      if (this._other._onClose !== null) {
        this._other._onClose();
      }
      else {
        this._other.isClosed = true;
      }
    });
  }
};

LocalTransport.createPipe = function () {
  let transport1 = new LocalTransport();
  let transport2 = new LocalTransport();
  transport1._other = transport2;
  transport2._other = transport1;
  return [transport1, transport2];
};
