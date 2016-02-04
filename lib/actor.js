"use strict"

const action = require("./action");
const events = require("events");
const match = require("./match");
const util = require("util");

const Action = action.Action;
const EventEmitter = events.EventEmitter;

function Actor(router, actorId) {
  EventEmitter.call(this);
  this._router = router;
  this._actorId = actorId;
  this._linkedIds = {};
  this._trapExit = null;
  this._trapError = null;
  this._onMessage = null;
  this._pendingMessages = [];
  this._receivers = [];
  this._queuedMessages = [];
}

util.inherits(Actor, EventEmitter);

Actor.prototype.start = function (callback) {
  return Action.return().bind(callback).run(this).then(() => {
    let linkedIds = Object.keys(this._linkedIds);
    for (let index = 0; index < linkedIds.length; index += 1) {
      this.emit("message", {
        toId: linkedIds[index],
        type: "exit",
        fromId: this._actorId
      });
    }
  }, (error) => {
    let linkedIds = Object.keys(this._linkedIds);
    if (linkedIds.length === 0) {
      this.emit("message", {
        type: "error",
        error: error
      });
      return;
    }
    for (let index = 0; index < linkedIds.length; index += 1) {
      this.emit("message", {
        toId: linkedIds[index],
        type: "error",
        fromId: this._actorId,
        error: error
      });
    }
  }).then(() => {
    this._onMessage = function (message) {
      this._router.discardMessage(message);
    }.bind(this);
    while (this._pendingMessages.length > 0) {
      this._onMessage(this._pendingMessages.shift());
    }
  });
};

Actor.prototype.spawn = function (callback) {
  return this._router.spawn(callback);
};

Actor.prototype.spawnRemote = function (name, callback) {
  return this._router.spawnRemote(name, callback);
};

Actor.prototype.link = function (actorId) {
  if (this._actorId === actorId || this._linkedIds.hasOwnProperty(actorId)) {
    return;
  }
  this._link(actorId);
  this.emit("message", {
    toId: actorId,
    type: "link",
    fromId: this._actorId
  });
};

Actor.prototype.unlink = function (actorId) {
  if (this._actorId === actorId || this._linkedIds.hasOwnProperty(actorId)) {
    return;
  }
  this._unlink(actorId);
  this.emit("message", {
    toId: actorId,
    type: "unlink",
    fromId: this._actorId
  });
};

Actor.prototype.kill = function (actorId, error) {
  this.emit("message", {
    toId: actorId,
    type: "kill",
    error: error
  });
};

Actor.prototype.send = function (actorId, message) {
  this.emit("message", {
    toId: actorId,
    type: "send",
    message: message
  });
};

Actor.prototype.sendSelf = function (message) {
  this.postMessage({
    toId: this._actorId,
    type: "send",
    message: message
  });
};

Actor.prototype.self = function () {
  return this._actorId;
};

Actor.prototype.trapExit = function (callback) {
  if (callback === undefined) {
    callback = null;
  }
  this._trapExit = callback;
};

Actor.prototype.trapError = function (callback) {
  if (callback === undefined) {
    callback = null;
  }
  this._trapError = callback;
};

Actor.prototype.receive = function () {
  this._receivers = new Array(arguments.length);
  for (let index = 0; index < arguments.length; ++index) {
    let argument = arguments[index];
    this._receivers[index] = {
      match: match.compile(argument[0]),
      callback: argument[1]
    };
  }
  return Promise.resolve().then(() => {
    for (let index = 0; index < this._queuedMessages.length; index += 1) {
      let action = this._dispatchMessage(this._queuedMessages[index]);
      if (action !== null) {
        this._queuedMessages.splice(index, 1);
        return action;
      }
    }
    let loop = () => {
      return this._getMessage().then((message) => {
        let action = this._dispatchMessage(message);
        if (action !== null) {
          return action;
        }
        this._queuedMessages.push(message);
        return loop();
      });
    };
    return loop();
  }).then((action) => {
    return action.run(this);
  });
};

Actor.prototype.postMessage = function (message) {
  if (this._onMessage !== null) {
    this._onMessage(message);
  }
  else {
    this._pendingMessages.push(message);
  }
};

Actor.prototype._getMessage = function () {
  return new Promise((resolve, reject) => {
    this._onMessage = function (message) {
      switch (message.type) {
      case "link":
        this._link(message.fromId);
        break;
      case "unlink":
        this._unlink(message.fromId);
        break;
      case "exit":
        this._unlink(message.fromId);
        if (this._trapExit !== null) {
          this.sendSelf(this._trapExit(message.fromId));
          return;
        }
        break;
      case "error":
        this._unlink(message.fromId);
        if (this._trapError !== null) {
          this.sendSelf(this._trapError(message.fromId, message.error));
          return;
        }
      case "kill":
        this._onMessage = null;
        reject(message.error);
        break;
      case "send":
        this._onMessage = null;
        resolve(message.message);
        break;
      }
    }
    while (this._onMessage !== null && this._pendingMessages.length > 0) {
      this._onMessage(this._pendingMessages.shift());
    }
  });
};

Actor.prototype._dispatchMessage = function (message) {
  for (let index = 0; index < this._receivers.length; index += 1) {
    let receiver = this._receivers[index];
    let result = receiver.match(message);
    if (result !== null) {
      return Action.return().bind(() => {
        return receiver.callback.apply(undefined, result);
      });
    }
  }
  return null;
};

Actor.prototype._link = function (actorId) {
  this._linkedIds[actorId] = actorId;
};

Actor.prototype._unlink = function (actorId) {
  delete this._linkedIds[actorId];
};

exports.Actor = Actor;
