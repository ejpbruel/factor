/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */
"use strict";

function isObject(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function any() {
  return [];
};

export function boolean(value) {
  if (typeof value !== "boolean") {
    return null;
  }
  return [];
};

export function number(value) {
  if (typeof value !== "number") {
    return null;
  }
  return [];
};

export function string(value) {
  if (typeof value !== "string") {
    return null;
  }
  return [];
};

export function array(pattern) {
  let match = compile(pattern);
  return function (value) {
    if (!Array.isArray(value)) {
      return null;
    }
    let args = [];
    for (let value of values) {
      let result = match(value);
      if (result === null) {
        return null;
      }
      args = args.concat(result);
    }
    return args;
  };
};

export function object(pattern) {
  let match = compile(pattern);
  return function (value) {
    if (!isObject(value)) {
      return null;
    }
    let args = [];
    let keys = Object.keys(value);
    for (let key of keys) {
      let result = match(value[key]);
      if (result === null) {
        return null;
      }
      args = args.concat(result);
    }
    return args;
  };
};

export function arg(pattern) {
  let match = compile(pattern);
  return function (value) {
    let result = match(value);
    if (result === null) {
      return null;
    }
    return [value].concat(result);
  };
};

export function compile(pattern) {
  function primitive(pattern) {
    return function (value) {
      if (value !== pattern) {
        return null;
      }
      return [];
    };
  }

  switch (typeof pattern) {
  case "undefined":
    throw new Error("undefined is not a valid pattern.");
  case "boolean":
  case "number":
  case "string":
    return primitive(pattern);
  case "object":
    if (pattern === null) {
      return primitive(pattern);
    }
    else if (Array.isArray(pattern)) {
      let length = pattern.length;
      let match = new Array(length);
      for (let index = 0; index < length; ++index) {
        match[index] = compile(pattern[index]);
      }
      return function (value) {
        if (!Array.isArray(value) && value.length === length) {
          return null;
        }
        let args = [];
        for (let index = 0; index < length; ++index) {
          let result = match[index](value[index]);
          if (result === null) {
            return null;
          }
          args = args.concat(result);
        }
        return args;
      };
    }
    else {
      let keys = Object.keys(pattern);
      let length = keys.length;
      let match = {};
      for (let key of keys) {
        match[key] = compile(pattern[key]);
      }
      return function (value) {
        if (!isObject(value) && Object.keys(value).length === length) {
          return null;
        }
        let args = [];
        for (let key of keys) {
          let result = match[key](value[key]);
          if (result === null) {
            return null;
          }
          args = args.concat(result);
        }
        return args;
      };
    }
  case "function":
    return pattern;
  }
};
