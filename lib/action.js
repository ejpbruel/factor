/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */
"use strict";

export class Action {
  constructor(callback) {
    this._callback = callback;
  }

  run(actor) {
    return Promise.resolve().then(() => {
      return this._callback(actor);
    });
  }

  bind(callback) {
    return new Action((actor) => {
      return this.run(actor).then((value) => {
        let action = callback(value);
        if (action === undefined) {
          return;
        }
        if (action && typeof action.next === "function") {
          action = Action.fromIterator(action);
        }
        return action.run(actor);
      });
    });
  }
};

Action.return = function (value) {
  return new Action(function () {
    return Promise.resolve(value);
  });
};

Action.fromIterator = function (iterator) {
  function next(value) {
    let result = iterator.next(value);
    let action = result.value;
    return result.done ? action : action.bind(next);
  }

  return Action.return().bind(next);
};

export function spawn(callback) {
  return new Action(function (actor) {
    return actor.spawn(callback);
  });
};

export function spawnLinked(callback) {
  return new Action(function (actor) {
    return actor.spawnLinked(callback);
  });
};

export function spawnRemote(transport) {
  return new Action(function (actor) {
    return actor.spawnRemote(transport);
  });
};

export function self() {
  return new Action(function (actor) {
    return actor.self();
  });
};

export function link(toId) {
  return new Action(function (actor) {
    actor.link(toId);
  });
};

export function unlink(toId) {
  return new Action(function (actor) {
    actor.unlink(toId);
  });
};

export function kill(toId, error) {
  return new Action(function (actor) {
    actor.kill(toId, error);
  });
};

export function send(toId, message) {
  return new Action(function (actor) {
    actor.send(toId, message);
  });
};

export function sendSelf(message) {
  return new Action(function (actor) {
    actor.sendSelf(message);
  });
};

export function trapPromise(promise, onFulfill, onReject) {
  return new Action(function () {
    actor.trapPromise(promise, onFulfill, onReject);
  });
};

export function trapExit(callback) {
  return new Action(function () {
    actor.trapExit(callback);
  });
};

export function trapError(callback) {
  return new Action(function () {
    actor.trapError(callback);
  });
};

export function receive(callback) {
  return new Action(function (actor) {
    return actor.receive(callback);
  });
};
