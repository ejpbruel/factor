/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */
"use strict";

import { Action } from "./action";
import { compile } from "./match";

export default class Actor {
  constructor(router, actorId) {
    this._router = router;
    this._actorId = actorId;
    this._linkedIdSet = new Set();
    this._trapExit = null;
    this._trapError = null;
    this._mailbox = [];
    this._onMessage = null;
    this._messageQueue = [];
  }

  run(callback) {
    return Action.return().bind(callback).run(this).then(() => {
      for (let linkedId of this._linkedIdSet) {
        this._router.postMessage({
          toId: linkedId,
          type: "exit",
          fromId: this._actorId
        });
      }
    }, (error) => {
      if (this._linkedIdSet.size === 0) {
        this._router.reportError(error);
        return;
      }
      for (let linkedId of this._linkedIdSet) {
        this._router.postMessage({
          toId: linkedId,
          type: "error",
          fromId: this._actorId,
          error: error.toString()
        });
      }
    }).then(() => {
      this._onMessage = function (message) {
        this._router.discardMessage(message);
      };
      while (this._messageQueue.length > 0) {
        this._onMessage(this._messageQueue.shift());
      }
    });
  }

  spawn(callback) {
    return this._router.spawn(callback);
  }

  spawnLinked(callback) {
    return this._router.spawnLinked(this._actorId, callback);
  }

  spawnRemote(transport) {
    return this._router.spawnRemote(this._actorId, transport);
  }

  self() {
    return this._actorId;
  }

  link(toId) {
    if (this._actorId === toId || this._linkedIdSet.has(toId)) {
      return;
    }
    this._linkedIdSet.add(toId);
    this._router.postMessage({
      toId: toId,
      type: "link",
      fromId: this._actorId
    });
  }

  unlink(toId) {
    if (this._actorId === toId || !this._linkedIdSet.has(toId)) {
      return;
    }
    this._linkedIdSet.delete(toId);
    this._router.postMessage({
      toId: toId,
      type: "unlink",
      fromId: this._actorId
    });
  }

  kill(toId, error) {
    this._router.postMessage({
      toId: toId,
      type: "kill",
      error: error.toString()
    });
  }

  send(toId, message) {
    this._router.postMessage({
      toId: toId,
      type: "send",
      message: message.toString()
    });
  }

  sendSelf(message) {
    this.postMessage({
      toId: this._actorId,
      type: "send",
      message: message.toString()
    });
  }

  trapPromise(promise, onFulfill, onReject) {
    promise.then((value) => {
      this.sendSelf(onFulfill(value));
    }, (reason) => {
      this.sendSelf(onReject(reason));
    });
  }

  trapExit(callback = null) {
    this._trapExit = callback;
  }

  trapError(callback = null) {
    this._trapError = callback;
  }

  receive(...args) {
    let length = args.length;
    let handlers = new Array(length);
    for (let index = 0; index < args.length; ++index) {
      let arg = args[index];
      handlers[index] = {
        match: compile(arg[0]),
        callback: arg[1]
      };
    }
    let handleMessage = (message) => {
      for (let handler of handlers) {
        let result = handler.match(message);
        if (result !== null) {
          return Function.apply.bind(handler.callback, undefined, result);
        }
      }
      return null;
    };
    return Promise.resolve().then(() => {
      for (let index = 0; index < this._mailbox.length; ++index) {
        let callback = handleMessage(this._mailbox[index]);
        if (callback !== null) {
          this._mailbox.splice(index, 1);
          return callback;
        }
      }
      let loop = () => {
        return this._getMessage().then((message) => {
          let callback = handleMessage(message);
          if (callback !== null) {
            return callback;
          }
          this._mailbox.push(message);
          return loop();
        });
      };
      return loop();
    }).then((callback) => {
      return Action.return().bind(callback).run(this);
    });
  }

  postMessage(message) {
    setImmediate(() => {
      if (this._onMessage !== null) {
        this._onMessage(message);
      }
      else {
        this._messageQueue.push(message);
      }
    });
  }

  _getMessage() {
    return new Promise((resolve, reject) => {
      this._onMessage = function (message) {
        switch (message.type) {
        case "link":
          this._linkedIdSet.add(message.fromId);
          break;
        case "unlink":
          this._linkedIdSet.delete(message.fromId);
          break;
        case "exit": {
          let { fromId } = message;
          if (!this._linkedIdSet.has(fromId)) {
            return;
          }
          this._linkedIdSet.delete(fromId);
          if (this._trapExit !== null) {
            this.sendSelf(this._trapExit(fromId));
            return;
          }
          break;
        }
        case "error": {
          let { fromId, error } = message;
          if (!this._linkedIdSet.has(fromId)) {
            return;
          }
          this._linkedIdSet.delete(fromId);
          if (this._trapError !== null) {
            this.sendSelf(this._trapError(fromId, error));
            return;
          }
        }
        case "kill":
          this._onMessage = null;
          reject(message.error);
          break;
        case "send":
          this._onMessage = null;
          resolve(message.message);
          break;
        };
      };
      while (this._onMessage !== null && this._messageQueue.length > 0) {
        this._onMessage(this._messageQueue.shift());
      }
    });
  }
};
