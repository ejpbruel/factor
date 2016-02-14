import { Action, receive, self, send, spawn, spawnLinked, spawnRemote } from "./lib/action";
import { arg, match, string } from "./lib/match"
import Router from "./lib/router";
import { LocalTransport } from "./lib/transport";

function spawnLocal(callback) {
  let pipe = LocalTransport.createPipe();
  function onMessage(message) {
    pipe[1].removeListener("message", onMessage);
    let router = new Router(message.prefix, pipe[1]);
    router.spawnLinked(message.toId, callback);
  }
  pipe[1].addListener("message", onMessage);
  pipe[1].start();
  return spawnRemote(pipe[0]);
}

function* actor1() {
  let selfId = yield self();
  console.log(selfId);
  let toId = yield spawnLocal(actor2);
  yield send(toId, selfId);
  yield receive(["pong", function* () {
    console.log("EUTA");
  }]);
}

function* actor2() {
  let selfId = yield self();
  console.log(selfId);
  yield receive([arg(string), function* (fromId) {
    yield send(fromId, "pong");
  }]);
}

let router = new Router();
router.spawn(actor1);

