/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */
"use strict";

function go(generator) {
  function next(value) {
    let result = iterator.next(value);
    let action = go(result.value);
    if (result.done) {
      return action;
    }
    else {
      return action.bind(next);
    }
  }

  let iterator = generator;
  if (typeof generator === "function") {
    iterator = generator();
  }
  let action = iterator;
  if (typeof iterator === "object" && iterator !== null &&
      typeof iterator.next === "function") {
    action = next();
  }
  return action;
}

function Action(callback) {
  this._callback = callback;
}

Action.return = function (value) {
  return new Action(function (actor) {
    return value;
  });
};

Action.prototype.bind = function (callback) {
  return new Action((actor) => {
    return this.run(actor).then((value) => {
      let action = go(callback(value));
      if (action !== undefined) {
        return action.run(actor);
      }
      else {
        return undefined;
      }
    });
  });
}

Action.prototype.run = function (actor) {
  return Promise.resolve().then(() => {
    return this._callback(actor);
  });
};

exports.Action = Action;

function spawn(callback) {
  return new Action(function (actor) {
    return actor.spawn(callback);
  });
}

exports.spawn = spawn;

function spawnRemote(name, callback) {
  return new Action(function (actor) {
    return actor.spawnRemote(name, callback);
  });
}

exports.spawnRemote = spawnRemote;

function link(actorId) {
  return new Action(function (actor) {
    return actor.link(actorId);
  });
}

exports.link = link;

function unlink(actorId) {
  return new Action(function (actor) {
    return actor.unlink(actorId);
  });
}

exports.unlink = unlink;

function kill(actorId, error) {
  return new Action(function (actor) {
    return actor.kill(actorId, error);
  });
}

exports.kill = kill;

function send(actorId, message) {
  return new Action(function (actor) {
    return actor.send(actorId, message);
  });
}

exports.send = send;

function sendSelf(message) {
  return new Action(function (actor) {
    return actor.sendSelf(message);
  });
}

exports.sendSelf = sendSelf;

function self() {
  return new Action(function (actor) {
    return actor.self();
  });
}

exports.self = self;

function sendSelf(actorId, message) {
  return new Action(function (actor) {
    return action.sendSelf(message);
  });
}

function trapExit(callback) {
  return new Action(function (actor) {
    return actor.trapExit(callback);
  });
}

exports.trapExit = trapExit;

function trapError(callback) {
  return new Action(function (actor) {
    return actor.trapError(callback);
  });
}

exports.trapError = trapError;

function receive() {
  let args = new Array(arguments.length);
  for (let index = 0; index < arguments.length; index += 1) {
    args[index] = arguments[index];
  }
  return new Action(function (actor) {
    return actor.receive.apply(actor, args);
  });
}

exports.receive = receive;

function wait(promise) {
  return new Action(function (actor) {
    return promise;
  });
}

exports.wait = wait;

function timeout(delay) {
  return new Promise(function (resolve) {
    setTimeout(resolve, delay);
  });
}

exports.timeout = timeout;
