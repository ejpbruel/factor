/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */
"use strict";

const Router = require("../lib/router").Router;
const action = require("../lib/action");
const match = require("../lib/match");

const Action = action.Action;
const any = match.any;
const arg = match.arg;
const receive = action.receive;
const self = action.self;
const send = action.send;
const spawn = action.spawn;
const string = match.string;

/*
 * Proof-of-concept of integrating the devtools protocol with the actor protocol.
 */

function ThreadActor(router) {
  this._router = router;
  this._actorId = this._router.spawn(function* threadActor() {
    yield respond(this._requestTypes);
  }.bind(this));
  this._isAttached = false;
}

ThreadActor.prototype.onAttach = function (request) {
  if (this._isAttached) {
    throw new Error("Wrong state!");
  }
  this._isAttached = true;
  return {
    type: "attached"
  };
};

ThreadActor.prototype.onDetach = function (request) {
  if (!this._isAttached) {
    throw new Error("Wrong state!");
  }
  this._isAttached = false;
  return {
    type: "detached"
  };
};

ThreadActor.prototype._requestTypes = {
  "attach": ThreadActor.prototype.onAttach,
  "detach": ThreadActor.prototype.onDetach
};

function* respond(requestTypes) {
  for (;;) {
    let selfId = yield self();
    yield receive([{
      type: "request",
      fromId: arg(string),
      request: arg(any)
    }, function* (fromId, request) {
      try {
        let response = requestTypes[request.type](request);
        yield send(fromId, {
          type: "response",
          from: selfId,
          response: response
        });
      }
      catch (error) {
        yield send(fromId, {
          type: "response",
          response: {
            type: "error",
            from: selfId,
            message: error.message
          }
        });
      }
    }]);
  }
}

function request(router, request) {
  return new Promise(function (resolve) {
    router.spawn(function* () {
      let selfId = yield self();
      yield send(request.to, {
        type: "request",
        fromId: selfId,
        request: request
      });
      yield receive([{
        type: "response",
        response: arg(any)
      }, resolve]);
    });
  });
}

let router = new Router();
let threadActor = new ThreadActor(router);
request(router, {
  to: threadActor._actorId,
  type: "attach"
}).then(function (response) {
  console.log(response);

  return request(router, {
    to: threadActor._actorId,
    type: "detach"
  });
}).then(function (response) {
  console.log(response);

  return request(router, {
    to: threadActor._actorId,
    type: "detach"
  })
}).then(function (response) {
  console.log(response);
});
