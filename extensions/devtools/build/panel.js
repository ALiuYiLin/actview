var __defProp = Object.defineProperty;
var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
var __publicField = (obj, key, value) => __defNormalProp(obj, typeof key !== "symbol" ? key + "" : key, value);
const Fragment = Symbol.for("actview.fragment");
const Text = Symbol.for("actview.text");
function createTextVNode(text) {
  return {
    __v_isVNode: true,
    type: Text,
    key: null,
    ref: null,
    props: { text },
    el: null,
    component: null
  };
}
function createVNode(type, props = null, key = null) {
  return {
    __v_isVNode: true,
    type,
    key,
    ref: null,
    props,
    el: null,
    component: null
  };
}
function isVNode(value) {
  return typeof value === "object" && value !== null && value.__v_isVNode === true;
}
function createElement$1(type, props = null, key = null) {
  return createVNode(type, props, key);
}
function isModel(value) {
  return typeof value === "function" && value.__actview_model === true;
}
function isClassComponent(value) {
  return typeof value === "function" && value.__actview_class_component === true;
}
function isComponent(value) {
  return isClassComponent(value);
}
// @__NO_SIDE_EFFECTS__
function makeMap(str) {
  const map = /* @__PURE__ */ Object.create(null);
  for (const key of str.split(",")) map[key] = 1;
  return (val) => val in map;
}
const EMPTY_OBJ = {};
const NOOP = () => {
};
const extend = Object.assign;
const remove = (arr, el) => {
  const i = arr.indexOf(el);
  if (i > -1) {
    arr.splice(i, 1);
  }
};
const hasOwnProperty$2 = Object.prototype.hasOwnProperty;
const hasOwn = (val, key) => hasOwnProperty$2.call(val, key);
const isArray = Array.isArray;
const isMap = (val) => toTypeString(val) === "[object Map]";
const isSet = (val) => toTypeString(val) === "[object Set]";
const isFunction = (val) => typeof val === "function";
const isString = (val) => typeof val === "string";
const isSymbol = (val) => typeof val === "symbol";
const isObject = (val) => val !== null && typeof val === "object";
const objectToString = Object.prototype.toString;
const toTypeString = (value) => objectToString.call(value);
const toRawType = (value) => {
  return toTypeString(value).slice(8, -1);
};
const isPlainObject = (val) => toTypeString(val) === "[object Object]";
const isIntegerKey = (key) => isString(key) && key !== "NaN" && key[0] !== "-" && "" + parseInt(key, 10) === key;
const hasChanged = (value, oldValue) => !Object.is(value, oldValue);
var TrackOpTypes = /* @__PURE__ */ ((TrackOpTypes2) => {
  TrackOpTypes2["GET"] = "get";
  TrackOpTypes2["HAS"] = "has";
  TrackOpTypes2["ITERATE"] = "iterate";
  return TrackOpTypes2;
})(TrackOpTypes || {});
var TriggerOpTypes = /* @__PURE__ */ ((TriggerOpTypes2) => {
  TriggerOpTypes2["SET"] = "set";
  TriggerOpTypes2["ADD"] = "add";
  TriggerOpTypes2["DELETE"] = "delete";
  TriggerOpTypes2["CLEAR"] = "clear";
  return TriggerOpTypes2;
})(TriggerOpTypes || {});
var ReactiveFlags = /* @__PURE__ */ ((ReactiveFlags2) => {
  ReactiveFlags2["SKIP"] = "__v_skip";
  ReactiveFlags2["IS_REACTIVE"] = "__v_isReactive";
  ReactiveFlags2["IS_READONLY"] = "__v_isReadonly";
  ReactiveFlags2["IS_SHALLOW"] = "__v_isShallow";
  ReactiveFlags2["RAW"] = "__v_raw";
  ReactiveFlags2["IS_REF"] = "__v_isRef";
  return ReactiveFlags2;
})(ReactiveFlags || {});
let activeEffectScope;
class EffectScope {
  // TODO isolatedDeclarations ReactiveFlags.SKIP
  constructor(detached = false) {
    this.detached = detached;
    this._active = true;
    this._on = 0;
    this.effects = [];
    this.cleanups = [];
    this._isPaused = false;
    this._warnOnRun = true;
    this.__v_skip = true;
    if (!detached && activeEffectScope) {
      if (activeEffectScope.active) {
        this.parent = activeEffectScope;
        this.index = (activeEffectScope.scopes || (activeEffectScope.scopes = [])).push(
          this
        ) - 1;
      } else {
        this._active = false;
        this._warnOnRun = false;
      }
    }
  }
  get active() {
    return this._active;
  }
  pause() {
    if (this._active) {
      this._isPaused = true;
      let i, l;
      if (this.scopes) {
        for (i = 0, l = this.scopes.length; i < l; i++) {
          this.scopes[i].pause();
        }
      }
      for (i = 0, l = this.effects.length; i < l; i++) {
        this.effects[i].pause();
      }
    }
  }
  /**
   * Resumes the effect scope, including all child scopes and effects.
   */
  resume() {
    if (this._active) {
      if (this._isPaused) {
        this._isPaused = false;
        let i, l;
        if (this.scopes) {
          for (i = 0, l = this.scopes.length; i < l; i++) {
            this.scopes[i].resume();
          }
        }
        for (i = 0, l = this.effects.length; i < l; i++) {
          this.effects[i].resume();
        }
      }
    }
  }
  run(fn) {
    if (this._active) {
      const currentEffectScope = activeEffectScope;
      try {
        activeEffectScope = this;
        return fn();
      } finally {
        activeEffectScope = currentEffectScope;
      }
    }
  }
  /**
   * This should only be called on non-detached scopes
   * @internal
   */
  on() {
    if (++this._on === 1) {
      this.prevScope = activeEffectScope;
      activeEffectScope = this;
    }
  }
  /**
   * This should only be called on non-detached scopes
   * @internal
   */
  off() {
    if (this._on > 0 && --this._on === 0) {
      if (activeEffectScope === this) {
        activeEffectScope = this.prevScope;
      } else {
        let current = activeEffectScope;
        while (current) {
          if (current.prevScope === this) {
            current.prevScope = this.prevScope;
            break;
          }
          current = current.prevScope;
        }
      }
      this.prevScope = void 0;
    }
  }
  stop(fromParent) {
    if (this._active) {
      this._active = false;
      let i, l;
      for (i = 0, l = this.effects.length; i < l; i++) {
        this.effects[i].stop();
      }
      this.effects.length = 0;
      for (i = 0, l = this.cleanups.length; i < l; i++) {
        this.cleanups[i]();
      }
      this.cleanups.length = 0;
      if (this.scopes) {
        for (i = 0, l = this.scopes.length; i < l; i++) {
          this.scopes[i].stop(true);
        }
        this.scopes.length = 0;
      }
      if (!this.detached && this.parent && !fromParent) {
        const last = this.parent.scopes.pop();
        if (last && last !== this) {
          this.parent.scopes[this.index] = last;
          last.index = this.index;
        }
      }
      this.parent = void 0;
    }
  }
}
function getCurrentScope() {
  return activeEffectScope;
}
let activeSub;
var EffectFlags = /* @__PURE__ */ ((EffectFlags2) => {
  EffectFlags2[EffectFlags2["ACTIVE"] = 1] = "ACTIVE";
  EffectFlags2[EffectFlags2["RUNNING"] = 2] = "RUNNING";
  EffectFlags2[EffectFlags2["TRACKING"] = 4] = "TRACKING";
  EffectFlags2[EffectFlags2["NOTIFIED"] = 8] = "NOTIFIED";
  EffectFlags2[EffectFlags2["DIRTY"] = 16] = "DIRTY";
  EffectFlags2[EffectFlags2["ALLOW_RECURSE"] = 32] = "ALLOW_RECURSE";
  EffectFlags2[EffectFlags2["PAUSED"] = 64] = "PAUSED";
  EffectFlags2[EffectFlags2["EVALUATED"] = 128] = "EVALUATED";
  return EffectFlags2;
})(EffectFlags || {});
const pausedQueueEffects = /* @__PURE__ */ new WeakSet();
class ReactiveEffect {
  constructor(fn) {
    this.fn = fn;
    this.deps = void 0;
    this.depsTail = void 0;
    this.flags = 1 | 4;
    this.next = void 0;
    this.cleanup = void 0;
    this.scheduler = void 0;
    if (activeEffectScope) {
      if (activeEffectScope.active) {
        activeEffectScope.effects.push(this);
      } else {
        this.flags &= -2;
      }
    }
  }
  pause() {
    this.flags |= 64;
  }
  resume() {
    if (this.flags & 64) {
      this.flags &= -65;
      if (pausedQueueEffects.has(this)) {
        pausedQueueEffects.delete(this);
        this.trigger();
      }
    }
  }
  /**
   * @internal
   */
  notify() {
    if (this.flags & 2 && !(this.flags & 32)) {
      return;
    }
    if (!(this.flags & 8)) {
      batch(this);
    }
  }
  run() {
    if (!(this.flags & 1)) {
      return this.fn();
    }
    this.flags |= 2;
    cleanupEffect(this);
    prepareDeps(this);
    const prevEffect = activeSub;
    const prevShouldTrack = shouldTrack;
    activeSub = this;
    shouldTrack = true;
    try {
      return this.fn();
    } finally {
      cleanupDeps(this);
      activeSub = prevEffect;
      shouldTrack = prevShouldTrack;
      this.flags &= -3;
    }
  }
  stop() {
    if (this.flags & 1) {
      for (let link = this.deps; link; link = link.nextDep) {
        removeSub(link);
      }
      this.deps = this.depsTail = void 0;
      cleanupEffect(this);
      this.onStop && this.onStop();
      this.flags &= -2;
    }
  }
  trigger() {
    if (this.flags & 64) {
      pausedQueueEffects.add(this);
    } else if (this.scheduler) {
      this.scheduler();
    } else {
      this.runIfDirty();
    }
  }
  /**
   * @internal
   */
  runIfDirty() {
    if (isDirty(this)) {
      this.run();
    }
  }
  get dirty() {
    return isDirty(this);
  }
}
let batchDepth = 0;
let batchedSub;
let batchedComputed;
function batch(sub, isComputed = false) {
  sub.flags |= 8;
  if (isComputed) {
    sub.next = batchedComputed;
    batchedComputed = sub;
    return;
  }
  sub.next = batchedSub;
  batchedSub = sub;
}
function startBatch() {
  batchDepth++;
}
function endBatch() {
  if (--batchDepth > 0) {
    return;
  }
  if (batchedComputed) {
    let e = batchedComputed;
    batchedComputed = void 0;
    while (e) {
      const next = e.next;
      e.next = void 0;
      e.flags &= -9;
      e = next;
    }
  }
  let error;
  while (batchedSub) {
    let e = batchedSub;
    batchedSub = void 0;
    while (e) {
      const next = e.next;
      e.next = void 0;
      e.flags &= -9;
      if (e.flags & 1) {
        try {
          ;
          e.trigger();
        } catch (err) {
          if (!error) error = err;
        }
      }
      e = next;
    }
  }
  if (error) throw error;
}
function prepareDeps(sub) {
  for (let link = sub.deps; link; link = link.nextDep) {
    link.version = -1;
    link.prevActiveLink = link.dep.activeLink;
    link.dep.activeLink = link;
  }
}
function cleanupDeps(sub) {
  let head;
  let tail = sub.depsTail;
  let link = tail;
  while (link) {
    const prev = link.prevDep;
    if (link.version === -1) {
      if (link === tail) tail = prev;
      removeSub(link);
      removeDep(link);
    } else {
      head = link;
    }
    link.dep.activeLink = link.prevActiveLink;
    link.prevActiveLink = void 0;
    link = prev;
  }
  sub.deps = head;
  sub.depsTail = tail;
}
function isDirty(sub) {
  for (let link = sub.deps; link; link = link.nextDep) {
    if (link.dep.version !== link.version || link.dep.computed && (refreshComputed(link.dep.computed) || link.dep.version !== link.version)) {
      return true;
    }
  }
  if (sub._dirty) {
    return true;
  }
  return false;
}
function refreshComputed(computed2) {
  if (computed2.flags & 4 && !(computed2.flags & 16)) {
    return;
  }
  computed2.flags &= -17;
  if (computed2.globalVersion === globalVersion) {
    return;
  }
  computed2.globalVersion = globalVersion;
  if (!computed2.isSSR && computed2.flags & 128 && (!computed2.deps && !computed2._dirty || !isDirty(computed2))) {
    return;
  }
  computed2.flags |= 2;
  const dep = computed2.dep;
  const prevSub = activeSub;
  const prevShouldTrack = shouldTrack;
  activeSub = computed2;
  shouldTrack = true;
  try {
    prepareDeps(computed2);
    const value = computed2.fn(computed2._value);
    if (dep.version === 0 || hasChanged(value, computed2._value)) {
      computed2.flags |= 128;
      computed2._value = value;
      dep.version++;
    }
  } catch (err) {
    dep.version++;
    throw err;
  } finally {
    activeSub = prevSub;
    shouldTrack = prevShouldTrack;
    cleanupDeps(computed2);
    computed2.flags &= -3;
  }
}
function removeSub(link, soft = false) {
  const { dep, prevSub, nextSub } = link;
  if (prevSub) {
    prevSub.nextSub = nextSub;
    link.prevSub = void 0;
  }
  if (nextSub) {
    nextSub.prevSub = prevSub;
    link.nextSub = void 0;
  }
  if (dep.subs === link) {
    dep.subs = prevSub;
    if (!prevSub && dep.computed) {
      dep.computed.flags &= -5;
      for (let l = dep.computed.deps; l; l = l.nextDep) {
        removeSub(l, true);
      }
    }
  }
  if (!soft && !--dep.sc && dep.map) {
    dep.map.delete(dep.key);
  }
}
function removeDep(link) {
  const { prevDep, nextDep } = link;
  if (prevDep) {
    prevDep.nextDep = nextDep;
    link.prevDep = void 0;
  }
  if (nextDep) {
    nextDep.prevDep = prevDep;
    link.nextDep = void 0;
  }
}
let shouldTrack = true;
const trackStack = [];
function pauseTracking() {
  trackStack.push(shouldTrack);
  shouldTrack = false;
}
function resetTracking() {
  const last = trackStack.pop();
  shouldTrack = last === void 0 ? true : last;
}
function cleanupEffect(e) {
  const { cleanup } = e;
  e.cleanup = void 0;
  if (cleanup) {
    const prevSub = activeSub;
    activeSub = void 0;
    try {
      cleanup();
    } finally {
      activeSub = prevSub;
    }
  }
}
let globalVersion = 0;
class Link {
  constructor(sub, dep) {
    this.sub = sub;
    this.dep = dep;
    this.version = dep.version;
    this.nextDep = this.prevDep = this.nextSub = this.prevSub = this.prevActiveLink = void 0;
  }
}
class Dep {
  // TODO isolatedDeclarations ReactiveFlags.SKIP
  constructor(computed2) {
    this.computed = computed2;
    this.version = 0;
    this.activeLink = void 0;
    this.subs = void 0;
    this.map = void 0;
    this.key = void 0;
    this.sc = 0;
    this.__v_skip = true;
  }
  track(debugInfo) {
    if (!activeSub || !shouldTrack || activeSub === this.computed) {
      return;
    }
    let link = this.activeLink;
    if (link === void 0 || link.sub !== activeSub) {
      link = this.activeLink = new Link(activeSub, this);
      if (!activeSub.deps) {
        activeSub.deps = activeSub.depsTail = link;
      } else {
        link.prevDep = activeSub.depsTail;
        activeSub.depsTail.nextDep = link;
        activeSub.depsTail = link;
      }
      addSub(link);
    } else if (link.version === -1) {
      link.version = this.version;
      if (link.nextDep) {
        const next = link.nextDep;
        next.prevDep = link.prevDep;
        if (link.prevDep) {
          link.prevDep.nextDep = next;
        }
        link.prevDep = activeSub.depsTail;
        link.nextDep = void 0;
        activeSub.depsTail.nextDep = link;
        activeSub.depsTail = link;
        if (activeSub.deps === link) {
          activeSub.deps = next;
        }
      }
    }
    return link;
  }
  trigger(debugInfo) {
    this.version++;
    globalVersion++;
    this.notify(debugInfo);
  }
  notify(debugInfo) {
    startBatch();
    try {
      if (false) ;
      for (let link = this.subs; link; link = link.prevSub) {
        if (link.sub.notify()) {
          ;
          link.sub.dep.notify();
        }
      }
    } finally {
      endBatch();
    }
  }
}
function addSub(link) {
  link.dep.sc++;
  if (link.sub.flags & EffectFlags.TRACKING) {
    const computed2 = link.dep.computed;
    if (computed2 && !link.dep.subs) {
      computed2.flags |= EffectFlags.TRACKING | EffectFlags.DIRTY;
      for (let l = computed2.deps; l; l = l.nextDep) {
        addSub(l);
      }
    }
    const currentTail = link.dep.subs;
    if (currentTail !== link) {
      link.prevSub = currentTail;
      if (currentTail) currentTail.nextSub = link;
    }
    link.dep.subs = link;
  }
}
const targetMap = /* @__PURE__ */ new WeakMap();
const ITERATE_KEY = Symbol(
  ""
);
const MAP_KEY_ITERATE_KEY = Symbol(
  ""
);
const ARRAY_ITERATE_KEY = Symbol(
  ""
);
function track(target, type, key) {
  if (shouldTrack && activeSub) {
    let depsMap = targetMap.get(target);
    if (!depsMap) {
      targetMap.set(target, depsMap = /* @__PURE__ */ new Map());
    }
    let dep = depsMap.get(key);
    if (!dep) {
      depsMap.set(key, dep = new Dep());
      dep.map = depsMap;
      dep.key = key;
    }
    {
      dep.track();
    }
  }
}
function trigger(target, type, key, newValue, oldValue, oldTarget) {
  const depsMap = targetMap.get(target);
  if (!depsMap) {
    globalVersion++;
    return;
  }
  const run = (dep) => {
    if (dep) {
      {
        dep.trigger();
      }
    }
  };
  startBatch();
  if (type === TriggerOpTypes.CLEAR) {
    depsMap.forEach(run);
  } else {
    const targetIsArray = isArray(target);
    const isArrayIndex = targetIsArray && isIntegerKey(key);
    if (targetIsArray && key === "length") {
      const newLength = Number(newValue);
      depsMap.forEach((dep, key2) => {
        if (key2 === "length" || key2 === ARRAY_ITERATE_KEY || !isSymbol(key2) && key2 >= newLength) {
          run(dep);
        }
      });
    } else {
      if (key !== void 0 || depsMap.has(void 0)) {
        run(depsMap.get(key));
      }
      if (isArrayIndex) {
        run(depsMap.get(ARRAY_ITERATE_KEY));
      }
      switch (type) {
        case TriggerOpTypes.ADD:
          if (!targetIsArray) {
            run(depsMap.get(ITERATE_KEY));
            if (isMap(target)) {
              run(depsMap.get(MAP_KEY_ITERATE_KEY));
            }
          } else if (isArrayIndex) {
            run(depsMap.get("length"));
          }
          break;
        case TriggerOpTypes.DELETE:
          if (!targetIsArray) {
            run(depsMap.get(ITERATE_KEY));
            if (isMap(target)) {
              run(depsMap.get(MAP_KEY_ITERATE_KEY));
            }
          }
          break;
        case TriggerOpTypes.SET:
          if (isMap(target)) {
            run(depsMap.get(ITERATE_KEY));
          }
          break;
      }
    }
  }
  endBatch();
}
function reactiveReadArray(array) {
  const raw = /* @__PURE__ */ toRaw(array);
  if (raw === array) return raw;
  track(raw, TrackOpTypes.ITERATE, ARRAY_ITERATE_KEY);
  return /* @__PURE__ */ isShallow(array) ? raw : raw.map(toReactive$1);
}
function shallowReadArray(arr) {
  track(arr = /* @__PURE__ */ toRaw(arr), TrackOpTypes.ITERATE, ARRAY_ITERATE_KEY);
  return arr;
}
function toWrapped(target, item) {
  if (/* @__PURE__ */ isReadonly(target)) {
    return /* @__PURE__ */ isReactive(target) ? toReadonly(toReactive$1(item)) : toReadonly(item);
  }
  return toReactive$1(item);
}
const arrayInstrumentations = {
  __proto__: null,
  [Symbol.iterator]() {
    return iterator(this, Symbol.iterator, (item) => toWrapped(this, item));
  },
  concat(...args) {
    return reactiveReadArray(this).concat(
      ...args.map((x) => isArray(x) ? reactiveReadArray(x) : x)
    );
  },
  entries() {
    return iterator(this, "entries", (value) => {
      value[1] = toWrapped(this, value[1]);
      return value;
    });
  },
  every(fn, thisArg) {
    return apply(this, "every", fn, thisArg, void 0, arguments);
  },
  filter(fn, thisArg) {
    return apply(
      this,
      "filter",
      fn,
      thisArg,
      (v) => v.map((item) => toWrapped(this, item)),
      arguments
    );
  },
  find(fn, thisArg) {
    return apply(
      this,
      "find",
      fn,
      thisArg,
      (item) => toWrapped(this, item),
      arguments
    );
  },
  findIndex(fn, thisArg) {
    return apply(this, "findIndex", fn, thisArg, void 0, arguments);
  },
  findLast(fn, thisArg) {
    return apply(
      this,
      "findLast",
      fn,
      thisArg,
      (item) => toWrapped(this, item),
      arguments
    );
  },
  findLastIndex(fn, thisArg) {
    return apply(this, "findLastIndex", fn, thisArg, void 0, arguments);
  },
  // flat, flatMap could benefit from ARRAY_ITERATE but are not straight-forward to implement
  forEach(fn, thisArg) {
    return apply(this, "forEach", fn, thisArg, void 0, arguments);
  },
  includes(...args) {
    return searchProxy(this, "includes", args);
  },
  indexOf(...args) {
    return searchProxy(this, "indexOf", args);
  },
  join(separator) {
    return reactiveReadArray(this).join(separator);
  },
  // keys() iterator only reads `length`, no optimization required
  lastIndexOf(...args) {
    return searchProxy(this, "lastIndexOf", args);
  },
  map(fn, thisArg) {
    return apply(this, "map", fn, thisArg, void 0, arguments);
  },
  pop() {
    return noTracking(this, "pop");
  },
  push(...args) {
    return noTracking(this, "push", args);
  },
  reduce(fn, ...args) {
    return reduce(this, "reduce", fn, args);
  },
  reduceRight(fn, ...args) {
    return reduce(this, "reduceRight", fn, args);
  },
  shift() {
    return noTracking(this, "shift");
  },
  // slice could use ARRAY_ITERATE but also seems to beg for range tracking
  some(fn, thisArg) {
    return apply(this, "some", fn, thisArg, void 0, arguments);
  },
  splice(...args) {
    return noTracking(this, "splice", args);
  },
  toReversed() {
    return reactiveReadArray(this).toReversed();
  },
  toSorted(comparer) {
    return reactiveReadArray(this).toSorted(comparer);
  },
  toSpliced(...args) {
    return reactiveReadArray(this).toSpliced(...args);
  },
  unshift(...args) {
    return noTracking(this, "unshift", args);
  },
  values() {
    return iterator(this, "values", (item) => toWrapped(this, item));
  }
};
function iterator(self, method, wrapValue) {
  const arr = shallowReadArray(self);
  const iter = arr[method]();
  if (arr !== self && !/* @__PURE__ */ isShallow(self)) {
    iter._next = iter.next;
    iter.next = () => {
      const result = iter._next();
      if (!result.done) {
        result.value = wrapValue(result.value);
      }
      return result;
    };
  }
  return iter;
}
const arrayProto = Array.prototype;
function apply(self, method, fn, thisArg, wrappedRetFn, args) {
  const arr = shallowReadArray(self);
  const needsWrap = arr !== self && !/* @__PURE__ */ isShallow(self);
  const methodFn = arr[method];
  if (methodFn !== arrayProto[method]) {
    const result2 = methodFn.apply(self, args);
    return needsWrap ? toReactive$1(result2) : result2;
  }
  let wrappedFn = fn;
  if (arr !== self) {
    if (needsWrap) {
      wrappedFn = function(item, index) {
        return fn.call(this, toWrapped(self, item), index, self);
      };
    } else if (fn.length > 2) {
      wrappedFn = function(item, index) {
        return fn.call(this, item, index, self);
      };
    }
  }
  const result = methodFn.call(arr, wrappedFn, thisArg);
  return needsWrap && wrappedRetFn ? wrappedRetFn(result) : result;
}
function reduce(self, method, fn, args) {
  const arr = shallowReadArray(self);
  const needsWrap = arr !== self && !/* @__PURE__ */ isShallow(self);
  let wrappedFn = fn;
  let wrapInitialAccumulator = false;
  if (arr !== self) {
    if (needsWrap) {
      wrapInitialAccumulator = args.length === 0;
      wrappedFn = function(acc, item, index) {
        if (wrapInitialAccumulator) {
          wrapInitialAccumulator = false;
          acc = toWrapped(self, acc);
        }
        return fn.call(this, acc, toWrapped(self, item), index, self);
      };
    } else if (fn.length > 3) {
      wrappedFn = function(acc, item, index) {
        return fn.call(this, acc, item, index, self);
      };
    }
  }
  const result = arr[method](wrappedFn, ...args);
  return wrapInitialAccumulator ? toWrapped(self, result) : result;
}
function searchProxy(self, method, args) {
  const arr = /* @__PURE__ */ toRaw(self);
  track(arr, TrackOpTypes.ITERATE, ARRAY_ITERATE_KEY);
  const res = arr[method](...args);
  if ((res === -1 || res === false) && /* @__PURE__ */ isProxy(args[0])) {
    args[0] = /* @__PURE__ */ toRaw(args[0]);
    return arr[method](...args);
  }
  return res;
}
function noTracking(self, method, args = []) {
  pauseTracking();
  startBatch();
  const res = (/* @__PURE__ */ toRaw(self))[method].apply(self, args);
  endBatch();
  resetTracking();
  return res;
}
const isNonTrackableKeys = /* @__PURE__ */ makeMap(`__proto__,__v_isRef,__isVue`);
const builtInSymbols = new Set(
  /* @__PURE__ */ Object.getOwnPropertyNames(Symbol).filter((key) => key !== "arguments" && key !== "caller").map((key) => Symbol[key]).filter(isSymbol)
);
function hasOwnProperty$1(key) {
  if (!isSymbol(key)) key = String(key);
  const obj = /* @__PURE__ */ toRaw(this);
  track(obj, TrackOpTypes.HAS, key);
  return obj.hasOwnProperty(key);
}
class BaseReactiveHandler {
  constructor(_isReadonly = false, _isShallow = false) {
    this._isReadonly = _isReadonly;
    this._isShallow = _isShallow;
  }
  get(target, key, receiver) {
    if (key === ReactiveFlags.SKIP) return target[ReactiveFlags.SKIP];
    const isReadonly2 = this._isReadonly, isShallow2 = this._isShallow;
    if (key === ReactiveFlags.IS_REACTIVE) {
      return !isReadonly2;
    } else if (key === ReactiveFlags.IS_READONLY) {
      return isReadonly2;
    } else if (key === ReactiveFlags.IS_SHALLOW) {
      return isShallow2;
    } else if (key === ReactiveFlags.RAW) {
      if (receiver === (isReadonly2 ? isShallow2 ? shallowReadonlyMap : readonlyMap : isShallow2 ? shallowReactiveMap : reactiveMap).get(target) || // receiver is not the reactive proxy, but has the same prototype
      // this means the receiver is a user proxy of the reactive proxy
      Object.getPrototypeOf(target) === Object.getPrototypeOf(receiver)) {
        return target;
      }
      return;
    }
    const targetIsArray = isArray(target);
    if (!isReadonly2) {
      let fn;
      if (targetIsArray && (fn = arrayInstrumentations[key])) {
        return fn;
      }
      if (key === "hasOwnProperty") {
        return hasOwnProperty$1;
      }
    }
    const res = Reflect.get(
      target,
      key,
      // if this is a proxy wrapping a ref, return methods using the raw ref
      // as receiver so that we don't have to call `toRaw` on the ref in all
      // its class methods
      /* @__PURE__ */ isRef(target) ? target : receiver
    );
    if (isSymbol(key) ? builtInSymbols.has(key) : isNonTrackableKeys(key)) {
      return res;
    }
    if (!isReadonly2) {
      track(target, TrackOpTypes.GET, key);
    }
    if (isShallow2) {
      return res;
    }
    if (/* @__PURE__ */ isRef(res)) {
      const value = targetIsArray && isIntegerKey(key) ? res : res.value;
      return isReadonly2 && isObject(value) ? /* @__PURE__ */ readonly(value) : value;
    }
    if (isObject(res)) {
      return isReadonly2 ? /* @__PURE__ */ readonly(res) : /* @__PURE__ */ reactive(res);
    }
    return res;
  }
}
class MutableReactiveHandler extends BaseReactiveHandler {
  constructor(isShallow2 = false) {
    super(false, isShallow2);
  }
  set(target, key, value, receiver) {
    let oldValue = target[key];
    const isArrayWithIntegerKey = isArray(target) && isIntegerKey(key);
    if (!this._isShallow) {
      const isOldValueReadonly = /* @__PURE__ */ isReadonly(oldValue);
      if (!/* @__PURE__ */ isShallow(value) && !/* @__PURE__ */ isReadonly(value)) {
        oldValue = /* @__PURE__ */ toRaw(oldValue);
        value = /* @__PURE__ */ toRaw(value);
      }
      if (!isArrayWithIntegerKey && /* @__PURE__ */ isRef(oldValue) && !/* @__PURE__ */ isRef(value)) {
        if (isOldValueReadonly) {
          return true;
        } else {
          oldValue.value = value;
          return true;
        }
      }
    }
    const hadKey = isArrayWithIntegerKey ? Number(key) < target.length : hasOwn(target, key);
    const result = Reflect.set(
      target,
      key,
      value,
      /* @__PURE__ */ isRef(target) ? target : receiver
    );
    if (target === /* @__PURE__ */ toRaw(receiver) && result) {
      if (!hadKey) {
        trigger(target, TriggerOpTypes.ADD, key, value);
      } else if (hasChanged(value, oldValue)) {
        trigger(target, TriggerOpTypes.SET, key, value);
      }
    }
    return result;
  }
  deleteProperty(target, key) {
    const hadKey = hasOwn(target, key);
    target[key];
    const result = Reflect.deleteProperty(target, key);
    if (result && hadKey) {
      trigger(target, TriggerOpTypes.DELETE, key, void 0);
    }
    return result;
  }
  has(target, key) {
    const result = Reflect.has(target, key);
    if (!isSymbol(key) || !builtInSymbols.has(key)) {
      track(target, TrackOpTypes.HAS, key);
    }
    return result;
  }
  ownKeys(target) {
    track(
      target,
      TrackOpTypes.ITERATE,
      isArray(target) ? "length" : ITERATE_KEY
    );
    return Reflect.ownKeys(target);
  }
}
class ReadonlyReactiveHandler extends BaseReactiveHandler {
  constructor(isShallow2 = false) {
    super(true, isShallow2);
  }
  set(target, key) {
    return true;
  }
  deleteProperty(target, key) {
    return true;
  }
}
const mutableHandlers = /* @__PURE__ */ new MutableReactiveHandler();
const readonlyHandlers = /* @__PURE__ */ new ReadonlyReactiveHandler();
const shallowReactiveHandlers = /* @__PURE__ */ new MutableReactiveHandler(true);
const toShallow = (value) => value;
const getProto = (v) => Reflect.getPrototypeOf(v);
function createIterableMethod(method, isReadonly2, isShallow2) {
  return function(...args) {
    const target = this[ReactiveFlags.RAW];
    const rawTarget = /* @__PURE__ */ toRaw(target);
    const targetIsMap = isMap(rawTarget);
    const isPair = method === "entries" || method === Symbol.iterator && targetIsMap;
    const isKeyOnly = method === "keys" && targetIsMap;
    const innerIterator = target[method](...args);
    const wrap = isShallow2 ? toShallow : isReadonly2 ? toReadonly : toReactive$1;
    !isReadonly2 && track(
      rawTarget,
      TrackOpTypes.ITERATE,
      isKeyOnly ? MAP_KEY_ITERATE_KEY : ITERATE_KEY
    );
    return extend(
      // inheriting all iterator properties
      Object.create(innerIterator),
      {
        // iterator protocol
        next() {
          const { value, done } = innerIterator.next();
          return done ? { value, done } : {
            value: isPair ? [wrap(value[0]), wrap(value[1])] : wrap(value),
            done
          };
        }
      }
    );
  };
}
function createReadonlyMethod(type) {
  return function(...args) {
    return type === TriggerOpTypes.DELETE ? false : type === TriggerOpTypes.CLEAR ? void 0 : this;
  };
}
function createInstrumentations(readonly2, shallow) {
  const instrumentations = {
    get(key) {
      const target = this[ReactiveFlags.RAW];
      const rawTarget = /* @__PURE__ */ toRaw(target);
      const rawKey = /* @__PURE__ */ toRaw(key);
      if (!readonly2) {
        if (hasChanged(key, rawKey)) {
          track(rawTarget, TrackOpTypes.GET, key);
        }
        track(rawTarget, TrackOpTypes.GET, rawKey);
      }
      const { has } = getProto(rawTarget);
      const wrap = shallow ? toShallow : readonly2 ? toReadonly : toReactive$1;
      if (has.call(rawTarget, key)) {
        return wrap(target.get(key));
      } else if (has.call(rawTarget, rawKey)) {
        return wrap(target.get(rawKey));
      } else if (target !== rawTarget) {
        target.get(key);
      }
    },
    get size() {
      const target = this[ReactiveFlags.RAW];
      !readonly2 && track(/* @__PURE__ */ toRaw(target), TrackOpTypes.ITERATE, ITERATE_KEY);
      return target.size;
    },
    has(key) {
      const target = this[ReactiveFlags.RAW];
      const rawTarget = /* @__PURE__ */ toRaw(target);
      const rawKey = /* @__PURE__ */ toRaw(key);
      if (!readonly2) {
        if (hasChanged(key, rawKey)) {
          track(rawTarget, TrackOpTypes.HAS, key);
        }
        track(rawTarget, TrackOpTypes.HAS, rawKey);
      }
      return key === rawKey ? target.has(key) : target.has(key) || target.has(rawKey);
    },
    forEach(callback, thisArg) {
      const observed = this;
      const target = observed[ReactiveFlags.RAW];
      const rawTarget = /* @__PURE__ */ toRaw(target);
      const wrap = shallow ? toShallow : readonly2 ? toReadonly : toReactive$1;
      !readonly2 && track(rawTarget, TrackOpTypes.ITERATE, ITERATE_KEY);
      return target.forEach((value, key) => {
        return callback.call(thisArg, wrap(value), wrap(key), observed);
      });
    }
  };
  extend(
    instrumentations,
    readonly2 ? {
      add: createReadonlyMethod(TriggerOpTypes.ADD),
      set: createReadonlyMethod(TriggerOpTypes.SET),
      delete: createReadonlyMethod(TriggerOpTypes.DELETE),
      clear: createReadonlyMethod(TriggerOpTypes.CLEAR)
    } : {
      add(value) {
        const target = /* @__PURE__ */ toRaw(this);
        const proto = getProto(target);
        const rawValue = /* @__PURE__ */ toRaw(value);
        const valueToAdd = !shallow && !/* @__PURE__ */ isShallow(value) && !/* @__PURE__ */ isReadonly(value) ? rawValue : value;
        const hadKey = proto.has.call(target, valueToAdd) || hasChanged(value, valueToAdd) && proto.has.call(target, value) || hasChanged(rawValue, valueToAdd) && proto.has.call(target, rawValue);
        if (!hadKey) {
          target.add(valueToAdd);
          trigger(target, TriggerOpTypes.ADD, valueToAdd, valueToAdd);
        }
        return this;
      },
      set(key, value) {
        if (!shallow && !/* @__PURE__ */ isShallow(value) && !/* @__PURE__ */ isReadonly(value)) {
          value = /* @__PURE__ */ toRaw(value);
        }
        const target = /* @__PURE__ */ toRaw(this);
        const { has, get } = getProto(target);
        let hadKey = has.call(target, key);
        if (!hadKey) {
          key = /* @__PURE__ */ toRaw(key);
          hadKey = has.call(target, key);
        }
        const oldValue = get.call(target, key);
        target.set(key, value);
        if (!hadKey) {
          trigger(target, TriggerOpTypes.ADD, key, value);
        } else if (hasChanged(value, oldValue)) {
          trigger(target, TriggerOpTypes.SET, key, value);
        }
        return this;
      },
      delete(key) {
        const target = /* @__PURE__ */ toRaw(this);
        const { has, get } = getProto(target);
        let hadKey = has.call(target, key);
        if (!hadKey) {
          key = /* @__PURE__ */ toRaw(key);
          hadKey = has.call(target, key);
        }
        get ? get.call(target, key) : void 0;
        const result = target.delete(key);
        if (hadKey) {
          trigger(target, TriggerOpTypes.DELETE, key, void 0);
        }
        return result;
      },
      clear() {
        const target = /* @__PURE__ */ toRaw(this);
        const hadItems = target.size !== 0;
        const result = target.clear();
        if (hadItems) {
          trigger(
            target,
            TriggerOpTypes.CLEAR,
            void 0,
            void 0
          );
        }
        return result;
      }
    }
  );
  const iteratorMethods = [
    "keys",
    "values",
    "entries",
    Symbol.iterator
  ];
  iteratorMethods.forEach((method) => {
    instrumentations[method] = createIterableMethod(method, readonly2, shallow);
  });
  return instrumentations;
}
function createInstrumentationGetter(isReadonly2, shallow) {
  const instrumentations = createInstrumentations(isReadonly2, shallow);
  return (target, key, receiver) => {
    if (key === ReactiveFlags.IS_REACTIVE) {
      return !isReadonly2;
    } else if (key === ReactiveFlags.IS_READONLY) {
      return isReadonly2;
    } else if (key === ReactiveFlags.RAW) {
      return target;
    }
    return Reflect.get(
      hasOwn(instrumentations, key) && key in target ? instrumentations : target,
      key,
      receiver
    );
  };
}
const mutableCollectionHandlers = {
  get: /* @__PURE__ */ createInstrumentationGetter(false, false)
};
const shallowCollectionHandlers = {
  get: /* @__PURE__ */ createInstrumentationGetter(false, true)
};
const readonlyCollectionHandlers = {
  get: /* @__PURE__ */ createInstrumentationGetter(true, false)
};
const reactiveMap = /* @__PURE__ */ new WeakMap();
const shallowReactiveMap = /* @__PURE__ */ new WeakMap();
const readonlyMap = /* @__PURE__ */ new WeakMap();
const shallowReadonlyMap = /* @__PURE__ */ new WeakMap();
function targetTypeMap(rawType) {
  switch (rawType) {
    case "Object":
    case "Array":
      return 1;
    case "Map":
    case "Set":
    case "WeakMap":
    case "WeakSet":
      return 2;
    default:
      return 0;
  }
}
// @__NO_SIDE_EFFECTS__
function reactive(target) {
  if (/* @__PURE__ */ isReadonly(target)) {
    return target;
  }
  return createReactiveObject(
    target,
    false,
    mutableHandlers,
    mutableCollectionHandlers,
    reactiveMap
  );
}
// @__NO_SIDE_EFFECTS__
function shallowReactive(target) {
  return createReactiveObject(
    target,
    false,
    shallowReactiveHandlers,
    shallowCollectionHandlers,
    shallowReactiveMap
  );
}
// @__NO_SIDE_EFFECTS__
function readonly(target) {
  return createReactiveObject(
    target,
    true,
    readonlyHandlers,
    readonlyCollectionHandlers,
    readonlyMap
  );
}
function createReactiveObject(target, isReadonly2, baseHandlers, collectionHandlers, proxyMap) {
  if (!isObject(target)) {
    return target;
  }
  if (target[ReactiveFlags.RAW] && !(isReadonly2 && target[ReactiveFlags.IS_REACTIVE])) {
    return target;
  }
  if (target[ReactiveFlags.SKIP] || !Object.isExtensible(target)) {
    return target;
  }
  const existingProxy = proxyMap.get(target);
  if (existingProxy) {
    return existingProxy;
  }
  const targetType = targetTypeMap(toRawType(target));
  if (targetType === 0) {
    return target;
  }
  const proxy = new Proxy(
    target,
    targetType === 2 ? collectionHandlers : baseHandlers
  );
  proxyMap.set(target, proxy);
  return proxy;
}
// @__NO_SIDE_EFFECTS__
function isReactive(value) {
  if (/* @__PURE__ */ isReadonly(value)) {
    return /* @__PURE__ */ isReactive(value[ReactiveFlags.RAW]);
  }
  return !!(value && value[ReactiveFlags.IS_REACTIVE]);
}
// @__NO_SIDE_EFFECTS__
function isReadonly(value) {
  return !!(value && value[ReactiveFlags.IS_READONLY]);
}
// @__NO_SIDE_EFFECTS__
function isShallow(value) {
  return !!(value && value[ReactiveFlags.IS_SHALLOW]);
}
// @__NO_SIDE_EFFECTS__
function isProxy(value) {
  return value ? !!value[ReactiveFlags.RAW] : false;
}
// @__NO_SIDE_EFFECTS__
function toRaw(observed) {
  const raw = observed && observed[ReactiveFlags.RAW];
  return raw ? /* @__PURE__ */ toRaw(raw) : observed;
}
const toReactive$1 = (value) => isObject(value) ? /* @__PURE__ */ reactive(value) : value;
const toReadonly = (value) => isObject(value) ? /* @__PURE__ */ readonly(value) : value;
var _a, _b;
// @__NO_SIDE_EFFECTS__
function isRef(r) {
  return r ? r[ReactiveFlags.IS_REF] === true : false;
}
// @__NO_SIDE_EFFECTS__
function ref(value) {
  return createRef(value, false);
}
function createRef(rawValue, shallow) {
  if (/* @__PURE__ */ isRef(rawValue)) {
    return rawValue;
  }
  return new RefImpl(rawValue, shallow);
}
_b = ReactiveFlags.IS_REF, _a = ReactiveFlags.IS_SHALLOW;
class RefImpl {
  constructor(value, isShallow2) {
    this.dep = new Dep();
    this[_b] = true;
    this[_a] = false;
    this._rawValue = isShallow2 ? value : /* @__PURE__ */ toRaw(value);
    this._value = isShallow2 ? value : toReactive$1(value);
    this[ReactiveFlags.IS_SHALLOW] = isShallow2;
  }
  get value() {
    {
      this.dep.track();
    }
    return this._value;
  }
  set value(newValue) {
    const oldValue = this._rawValue;
    const useDirectValue = this[ReactiveFlags.IS_SHALLOW] || /* @__PURE__ */ isShallow(newValue) || /* @__PURE__ */ isReadonly(newValue);
    newValue = useDirectValue ? newValue : /* @__PURE__ */ toRaw(newValue);
    if (hasChanged(newValue, oldValue)) {
      this._rawValue = newValue;
      this._value = useDirectValue ? newValue : toReactive$1(newValue);
      {
        this.dep.trigger();
      }
    }
  }
}
ReactiveFlags.IS_REF;
ReactiveFlags.IS_REF;
ReactiveFlags.IS_REF, ReactiveFlags.IS_READONLY;
class ComputedRefImpl {
  constructor(fn, setter, isSSR) {
    this.fn = fn;
    this.setter = setter;
    this._value = void 0;
    this.dep = new Dep(this);
    this.__v_isRef = true;
    this.deps = void 0;
    this.depsTail = void 0;
    this.flags = EffectFlags.DIRTY;
    this.globalVersion = globalVersion - 1;
    this.next = void 0;
    this.effect = this;
    this[ReactiveFlags.IS_READONLY] = !setter;
    this.isSSR = isSSR;
  }
  /**
   * @internal
   */
  notify() {
    this.flags |= EffectFlags.DIRTY;
    if (!(this.flags & EffectFlags.NOTIFIED) && // avoid infinite self recursion
    activeSub !== this) {
      batch(this, true);
      return true;
    }
  }
  get value() {
    const link = this.dep.track();
    refreshComputed(this);
    if (link) {
      link.version = this.dep.version;
    }
    return this._value;
  }
  set value(newValue) {
    if (this.setter) {
      this.setter(newValue);
    }
  }
}
// @__NO_SIDE_EFFECTS__
function computed(getterOrOptions, debugOptions, isSSR = false) {
  let getter;
  let setter;
  if (isFunction(getterOrOptions)) {
    getter = getterOrOptions;
  } else {
    getter = getterOrOptions.get;
    setter = getterOrOptions.set;
  }
  const cRef = new ComputedRefImpl(getter, setter, isSSR);
  return cRef;
}
const INITIAL_WATCHER_VALUE = {};
const cleanupMap = /* @__PURE__ */ new WeakMap();
let activeWatcher = void 0;
function onWatcherCleanup(cleanupFn, failSilently = false, owner = activeWatcher) {
  if (owner) {
    let cleanups = cleanupMap.get(owner);
    if (!cleanups) cleanupMap.set(owner, cleanups = []);
    cleanups.push(cleanupFn);
  }
}
function watch(source, cb, options = EMPTY_OBJ) {
  const { immediate, deep, once, scheduler, augmentJob, call } = options;
  const reactiveGetter = (source2) => {
    if (deep) return source2;
    if (/* @__PURE__ */ isShallow(source2) || deep === false || deep === 0)
      return traverse(source2, 1);
    return traverse(source2);
  };
  let effect;
  let getter;
  let cleanup;
  let boundCleanup;
  let forceTrigger = false;
  let isMultiSource = false;
  if (/* @__PURE__ */ isRef(source)) {
    getter = () => source.value;
    forceTrigger = /* @__PURE__ */ isShallow(source);
  } else if (/* @__PURE__ */ isReactive(source)) {
    getter = () => reactiveGetter(source);
    forceTrigger = true;
  } else if (isArray(source)) {
    isMultiSource = true;
    forceTrigger = source.some((s) => /* @__PURE__ */ isReactive(s) || /* @__PURE__ */ isShallow(s));
    getter = () => source.map((s) => {
      if (/* @__PURE__ */ isRef(s)) {
        return s.value;
      } else if (/* @__PURE__ */ isReactive(s)) {
        return reactiveGetter(s);
      } else if (isFunction(s)) {
        return call ? call(
          s,
          2
          /* WATCH_GETTER */
        ) : s();
      } else ;
    });
  } else if (isFunction(source)) {
    if (cb) {
      getter = call ? () => call(
        source,
        2
        /* WATCH_GETTER */
      ) : source;
    } else {
      getter = () => {
        if (cleanup) {
          pauseTracking();
          try {
            cleanup();
          } finally {
            resetTracking();
          }
        }
        const currentEffect = activeWatcher;
        activeWatcher = effect;
        try {
          return call ? call(source, 3, [boundCleanup]) : source(boundCleanup);
        } finally {
          activeWatcher = currentEffect;
        }
      };
    }
  } else {
    getter = NOOP;
  }
  if (cb && deep) {
    const baseGetter = getter;
    const depth = deep === true ? Infinity : deep;
    getter = () => traverse(baseGetter(), depth);
  }
  const scope = getCurrentScope();
  const watchHandle = () => {
    effect.stop();
    if (scope && scope.active) {
      remove(scope.effects, effect);
    }
  };
  if (once && cb) {
    const _cb = cb;
    cb = (...args) => {
      const res = _cb(...args);
      watchHandle();
      return res;
    };
  }
  let oldValue = isMultiSource ? new Array(source.length).fill(INITIAL_WATCHER_VALUE) : INITIAL_WATCHER_VALUE;
  const job = (immediateFirstRun) => {
    if (!(effect.flags & EffectFlags.ACTIVE) || !effect.dirty && !immediateFirstRun) {
      return;
    }
    if (cb) {
      const newValue = effect.run();
      if (immediateFirstRun || deep || forceTrigger || (isMultiSource ? newValue.some((v, i) => hasChanged(v, oldValue[i])) : hasChanged(newValue, oldValue))) {
        if (cleanup) {
          cleanup();
        }
        const currentWatcher = activeWatcher;
        activeWatcher = effect;
        try {
          const args = [
            newValue,
            // pass undefined as the old value when it's changed for the first time
            oldValue === INITIAL_WATCHER_VALUE ? void 0 : isMultiSource && oldValue[0] === INITIAL_WATCHER_VALUE ? [] : oldValue,
            boundCleanup
          ];
          oldValue = newValue;
          call ? call(cb, 3, args) : (
            // @ts-expect-error
            cb(...args)
          );
        } finally {
          activeWatcher = currentWatcher;
        }
      }
    } else {
      effect.run();
    }
  };
  if (augmentJob) {
    augmentJob(job);
  }
  effect = new ReactiveEffect(getter);
  effect.scheduler = scheduler ? () => scheduler(job, false) : job;
  boundCleanup = (fn) => onWatcherCleanup(fn, false, effect);
  cleanup = effect.onStop = () => {
    const cleanups = cleanupMap.get(effect);
    if (cleanups) {
      if (call) {
        call(
          cleanups,
          4
          /* WATCH_CLEANUP */
        );
      } else {
        for (const cleanup2 of cleanups) cleanup2();
      }
      cleanupMap.delete(effect);
    }
  };
  if (cb) {
    if (immediate) {
      job(true);
    } else {
      oldValue = effect.run();
    }
  } else if (scheduler) {
    scheduler(job.bind(null, true), true);
  } else {
    effect.run();
  }
  watchHandle.pause = effect.pause.bind(effect);
  watchHandle.resume = effect.resume.bind(effect);
  watchHandle.stop = watchHandle;
  return watchHandle;
}
function traverse(value, depth = Infinity, seen) {
  if (depth <= 0 || !isObject(value) || value[ReactiveFlags.SKIP]) {
    return value;
  }
  seen = seen || /* @__PURE__ */ new Map();
  if ((seen.get(value) || 0) >= depth) {
    return value;
  }
  seen.set(value, depth);
  depth--;
  if (/* @__PURE__ */ isRef(value)) {
    traverse(value.value, depth, seen);
  } else if (isArray(value)) {
    for (let i = 0; i < value.length; i++) {
      traverse(value[i], depth, seen);
    }
  } else if (isSet(value) || isMap(value)) {
    value.forEach((v) => {
      traverse(v, depth, seen);
    });
  } else if (isPlainObject(value)) {
    for (const key in value) {
      traverse(value[key], depth, seen);
    }
    for (const key of Object.getOwnPropertySymbols(value)) {
      if (Object.prototype.propertyIsEnumerable.call(value, key)) {
        traverse(value[key], depth, seen);
      }
    }
  }
  return value;
}
const queue = [];
let flushIndex = -1;
const pendingPostFlushCbs = [];
let isFlushing = false;
let isFlushPending = false;
let currentFlushPromise = null;
const getId = (job) => job.id == null ? Infinity : job.id;
function findInsertionIndex(id) {
  let start = isFlushing && flushIndex >= 0 ? flushIndex + 1 : 0;
  let end = queue.length;
  if (start > end) start = end;
  while (start < end) {
    const middle = start + end >>> 1;
    if (getId(queue[middle]) <= id) {
      start = middle + 1;
    } else {
      end = middle;
    }
  }
  return start;
}
function queueFlush() {
  if (!isFlushing && !isFlushPending) {
    isFlushPending = true;
    currentFlushPromise = Promise.resolve().then(flushJobs);
  }
}
function queueJob(job) {
  if (!queue.length) {
    queue.push(job);
  } else {
    const searchFrom = isFlushing && flushIndex >= 0 ? job.allowRecurse ? flushIndex + 1 : flushIndex : Math.max(flushIndex, 0);
    if (!queue.includes(job, searchFrom)) {
      if (job.id == null) {
        queue.push(job);
      } else {
        queue.splice(findInsertionIndex(job.id), 0, job);
      }
    }
  }
  queueFlush();
}
function queuePostFlushCb(cb) {
  pendingPostFlushCbs.push(typeof cb === "function" ? { run: cb } : cb);
  queueFlush();
}
function flushPostFlushCbs() {
  if (pendingPostFlushCbs.length === 0) return;
  const cbs = pendingPostFlushCbs.slice();
  pendingPostFlushCbs.length = 0;
  let error;
  let hasError = false;
  for (const cb of cbs) {
    if (cb.active === false) continue;
    try {
      cb.run();
    } catch (err) {
      if (!hasError) {
        hasError = true;
        error = err;
      }
    }
  }
  if (hasError) throw error;
}
function flushJobs() {
  isFlushPending = false;
  isFlushing = true;
  let error;
  let hasError = false;
  const captureError = (err) => {
    if (!hasError) {
      hasError = true;
      error = err;
    }
  };
  try {
    for (flushIndex = 0; flushIndex < queue.length; flushIndex++) {
      const job = queue[flushIndex];
      if (!job || job.active === false) continue;
      try {
        job.run();
      } catch (err) {
        captureError(err);
      }
    }
  } finally {
    flushIndex = -1;
    queue.length = 0;
    try {
      flushPostFlushCbs();
    } catch (err) {
      captureError(err);
    }
    isFlushing = false;
    currentFlushPromise = null;
    if (queue.length || pendingPostFlushCbs.length) {
      queueFlush();
    }
  }
  if (hasError) throw error;
}
function nextTick(fn) {
  const p = currentFlushPromise ?? Promise.resolve();
  return fn ? p.then(fn) : p;
}
const META_KEY = "__actview_component_meta__";
function createComponentMeta() {
  return {
    refs: /* @__PURE__ */ new Map(),
    props: /* @__PURE__ */ new Map(),
    reactive: /* @__PURE__ */ new Map(),
    computed: /* @__PURE__ */ new Map(),
    watch: [],
    provides: [],
    injects: [],
    models: /* @__PURE__ */ new Map(),
    hooks: {}
  };
}
function ownMeta(target) {
  const ctor = target;
  const existing = ctor[META_KEY];
  if (existing) return existing;
  const meta = createComponentMeta();
  Object.defineProperty(ctor, META_KEY, {
    value: meta,
    configurable: true,
    writable: false,
    enumerable: false
  });
  return meta;
}
function metaOf(target) {
  const ctor = target.constructor;
  if (typeof ctor !== "function") {
    throw new Error("[actview] 装饰器只能用于类成员");
  }
  return ownMeta(ctor);
}
function mergeMeta(parent, own) {
  if (!parent) return own;
  const hooks = { ...parent.hooks };
  for (const [name, methods] of Object.entries(own.hooks)) {
    hooks[name] = [...hooks[name] ?? [], ...methods];
  }
  return {
    name: own.name ?? parent.name,
    refs: new Map([...parent.refs, ...own.refs]),
    props: new Map([...parent.props, ...own.props]),
    reactive: new Map([...parent.reactive, ...own.reactive]),
    computed: new Map([...parent.computed, ...own.computed]),
    watch: [...parent.watch, ...own.watch],
    provides: [...parent.provides, ...own.provides],
    injects: [...parent.injects, ...own.injects],
    models: new Map([...parent.models, ...own.models]),
    hooks,
    setup: own.setup ?? parent.setup,
    setupMode: own.setupMode ?? parent.setupMode,
    render: own.render ?? parent.render
  };
}
function getComponentMeta(ctor) {
  const own = ctor[META_KEY];
  if (own) return own;
  const parent = Object.getPrototypeOf(ctor);
  const inherited = parent == null ? void 0 : parent[META_KEY];
  return inherited ?? createComponentMeta();
}
function Component(options = {}) {
  return function(target) {
    var _a2;
    if (typeof ((_a2 = target.prototype) == null ? void 0 : _a2.render) !== "function") {
      throw new Error(
        `[actview] 类组件 "${target.name || "Anonymous"}" 必须实现 render() 方法`
      );
    }
    const parentCtor = Object.getPrototypeOf(target);
    const parentMeta = parentCtor == null ? void 0 : parentCtor[META_KEY];
    const own = ownMeta(target);
    if (own.setupMode) {
      throw new Error(
        `[actview] @Component "${target.name || "Anonymous"}" 的 @Setup 不能带 pre/after；pre/after 只用于 @Model，组件 @Setup 是基准点`
      );
    }
    own.name = options.name ?? own.name;
    own.render = "render";
    const merged = mergeMeta(parentMeta, own);
    Object.defineProperty(target, META_KEY, {
      value: merged,
      configurable: true,
      writable: false,
      enumerable: false
    });
    Object.defineProperty(target, "__actview_class_component", {
      value: true,
      configurable: true,
      writable: false,
      enumerable: false
    });
    if (options.name) {
      Object.defineProperty(target, "name", {
        value: options.name,
        configurable: true,
        writable: false,
        enumerable: false
      });
    }
    return target;
  };
}
class ActViewComponent {
  /**
   * props 构造参数：让子类 JSX 标签类型能推导 props（无显式 constructor 时
   * 继承该签名）；运行时渲染器也会把 instance.props 传进来。
   */
  constructor(_props) {
  }
}
function Prop(targetOrOptions, key) {
  if (key !== void 0) {
    metaOf(targetOrOptions).props.set(String(key), {});
    return;
  }
  const options = targetOrOptions ?? {};
  return (target, propertyKey) => {
    metaOf(target).props.set(String(propertyKey), options);
  };
}
function Ref(targetOrOptions, key) {
  if (key !== void 0) {
    metaOf(targetOrOptions).refs.set(String(key), {});
    return;
  }
  const options = targetOrOptions ?? {};
  return (target, propertyKey) => {
    metaOf(target).refs.set(String(propertyKey), options);
  };
}
function Setup(targetOrMode, key, _descriptor) {
  if (typeof targetOrMode === "string") {
    const mode = targetOrMode;
    return (target, propertyKey) => {
      const meta = metaOf(target);
      meta.setup = String(propertyKey);
      meta.setupMode = mode;
    };
  }
  if (targetOrMode && key !== void 0) {
    metaOf(targetOrMode).setup = key;
  }
}
function lifecycleHook(name) {
  return function(target, key, _descriptor) {
    var _a2;
    const meta = metaOf(target);
    ((_a2 = meta.hooks)[name] ?? (_a2[name] = [])).push(key);
  };
}
const BeforeUnmount = lifecycleHook("beforeUnmount");
const Unmounted = lifecycleHook("unmounted");
let currentInstance = null;
function getCurrentInstance() {
  return currentInstance;
}
function setCurrentInstance(instance) {
  const prev = currentInstance;
  currentInstance = instance;
  return prev;
}
function injectHook(type, hook, target = currentInstance) {
  if (!target) {
    console.warn(
      `[actview] ${type} 生命周期钩子只能在组件 setup 中注册，已忽略。`
    );
    return;
  }
  target[type].push(hook);
}
function invokeHooks(hooks, instance) {
  if (!hooks || hooks.length === 0) return;
  const target = instance === void 0 ? currentInstance : instance;
  const prev = setCurrentInstance(target);
  pauseTracking();
  try {
    for (const hook of hooks) hook();
  } finally {
    resetTracking();
    setCurrentInstance(prev);
  }
}
function onErrorCaptured(hook, target = getCurrentInstance()) {
  if (!target) {
    console.warn(
      "[actview] onErrorCaptured 只能在组件 setup 中注册，已忽略。"
    );
    return;
  }
  target.errorCaptured.push(hook);
}
const onBeforeUnmount = (hook, target) => injectHook("beforeUnmount", hook, target);
const hasOwnProperty = Object.prototype.hasOwnProperty;
function currentInstanceFor(api) {
  const instance = getCurrentInstance();
  if (!instance) {
    throw new Error(
      `[actview] ${api} 只能在组件 setup() 中调用（当前没有正在执行的组件实例）`
    );
  }
  return instance;
}
function provide(key, value) {
  const instance = currentInstanceFor("provide()");
  const inherited = instance.parent !== null && instance.injects === instance.parent.injects || instance.injects === instance.appContext.provides;
  if (inherited) {
    instance.injects = { ...instance.injects };
  }
  instance.injects[key] = value;
}
function inject(key, defaultValue) {
  const instance = currentInstanceFor("inject()");
  const injects = instance.injects;
  return hasOwnProperty.call(injects, key) ? injects[key] : defaultValue;
}
function notifyDevtoolsApp(context, event, root) {
  return;
}
function notifyDevtoolsPerformance(instance, kind, duration) {
  return;
}
function installDeclaredFields(ctx, instance, meta, options = {}) {
  const props = instance.props;
  if (options.bindProps !== false) {
    for (const key of meta.props.keys()) {
      const own = Object.getOwnPropertyDescriptor(ctx, key);
      const fallback = own == null ? void 0 : own.value;
      if (own) delete ctx[key];
      Object.defineProperty(ctx, key, {
        configurable: true,
        enumerable: true,
        get: () => key in props ? props[key] : fallback,
        set: () => {
          throw new Error(
            `[actview] prop "${String(key)}" 是只读的（由父组件传入）`
          );
        }
      });
    }
  }
  for (const key of meta.refs.keys()) {
    const own = Object.getOwnPropertyDescriptor(ctx, key);
    const initial = own == null ? void 0 : own.value;
    if (own) delete ctx[key];
    const r = /* @__PURE__ */ ref(initial);
    Object.defineProperty(ctx, key, {
      configurable: true,
      enumerable: true,
      get: () => r.value,
      set: (value) => {
        r.value = value;
      }
    });
  }
  for (const [key, options2] of meta.reactive) {
    const own = Object.getOwnPropertyDescriptor(ctx, key);
    const initial = own == null ? void 0 : own.value;
    if (own) delete ctx[key];
    let state = toReactive(initial, options2);
    Object.defineProperty(ctx, key, {
      configurable: true,
      enumerable: true,
      get: () => state,
      set: (value) => {
        state = toReactive(value, options2);
      }
    });
  }
  for (const entry of meta.injects) {
    const own = Object.getOwnPropertyDescriptor(ctx, entry.property);
    const fallback = entry.default !== void 0 ? entry.default : own == null ? void 0 : own.value;
    if (own) delete ctx[entry.property];
    const value = inject(entry.key, fallback);
    Object.defineProperty(ctx, entry.property, {
      configurable: true,
      enumerable: true,
      writable: true,
      value
    });
  }
}
function toReactive(value, options) {
  if (value !== null && typeof value === "object") {
    return options.shallow ? /* @__PURE__ */ shallowReactive(value) : /* @__PURE__ */ reactive(value);
  }
  return value;
}
function installComputed(ctx, meta, instance) {
  for (const [key, getter] of meta.computed) {
    const cache = /* @__PURE__ */ computed(() => getter.call(ctx));
    Object.defineProperty(ctx, key, {
      configurable: true,
      enumerable: false,
      get: () => cache.value
    });
  }
}
function installProvides(ctx, meta) {
  for (const entry of meta.provides) {
    provide(entry.key, ctx[entry.property]);
  }
}
function installWatches(ctx, meta) {
  for (const entry of meta.watch) {
    const getter = buildWatchGetter(ctx, entry.source);
    watch(
      getter,
      (value, oldValue, onCleanup) => {
        const handler = ctx[entry.method];
        if (typeof handler === "function") {
          handler.call(ctx, value, oldValue, onCleanup);
        }
      },
      entry.options
    );
  }
}
function buildWatchGetter(ctx, source) {
  const toGetter = (item) => typeof item === "function" ? () => item.call(ctx) : () => ctx[item];
  return Array.isArray(source) ? source.map((item) => toGetter(item)) : toGetter(source);
}
function registerClassLifecycle(instance, ctx, meta) {
  for (const name of Object.keys(meta.hooks)) {
    const methods = meta.hooks[name];
    if (!methods) continue;
    const hooks = instance[name];
    if (!hooks) continue;
    for (const method of methods) {
      hooks.push(() => {
        var _a2;
        (_a2 = ctx[method]) == null ? void 0 : _a2.call(ctx);
      });
    }
  }
}
const MODEL_FIRST_PHASES = [
  "beforeMount",
  "mounted",
  "beforeUpdate",
  "updated",
  "activated"
];
const OWNER_FIRST_PHASES = [
  "deactivated",
  "beforeUnmount",
  "unmounted"
];
class ComponentScope {
  constructor(owner) {
    this.instances = /* @__PURE__ */ new Map();
    this.entries = /* @__PURE__ */ new Map();
    this.resolving = [];
    this.order = [];
    this.dataHooks = {};
    this.owner = owner;
  }
  /**
   * 解析 Model：构造 + 递归依赖 + 安装字段/computed + 收集生命周期。
   * @Setup 不在这里执行，由 runPhase('pre'|'after') 按组件基准执行。
   */
  resolve(token) {
    if (!isModel(token)) {
      throw new Error(
        `[actview] @UseModel token 不是 @Model 类：${String(token)}`
      );
    }
    const cached = this.instances.get(token);
    if (cached) return cached;
    const cyclic = this.resolving.find((entry2) => entry2.token === token);
    if (cyclic) {
      const chain = [...this.resolving.map((e) => e.token), token].map((ctor) => ctor.name || "Anonymous").join(" -> ");
      throw new Error(`[actview] Model 循环依赖：${chain}`);
    }
    const Ctor = token;
    const data = new Ctor();
    const meta = getComponentMeta(token);
    const entry = {
      token,
      data,
      meta,
      phase: resolvePhase(meta),
      deps: /* @__PURE__ */ new Set(),
      setupDone: false,
      runtimeDone: false
    };
    const parent = this.resolving[this.resolving.length - 1];
    parent == null ? void 0 : parent.deps.add(token);
    this.resolving.push(entry);
    try {
      installUseModels(this, data, meta);
      this.installModelProps(entry);
      installDeclaredFields(data, this.owner, meta, { bindProps: false });
      installComputed(data, meta, this.owner);
      this.collectModelHooks(data, meta);
      this.entries.set(token, entry);
      this.order.push(entry);
      this.instances.set(token, data);
      return data;
    } finally {
      this.resolving.pop();
    }
  }
  /** 校验阶段约束：pre Model 不能依赖 after Model（否则 setup 顺序不可能同时成立） */
  validatePhases() {
    for (const entry of this.order) {
      for (const depToken of entry.deps) {
        const dep = this.entries.get(depToken);
        if (!dep) continue;
        if (entry.phase === "pre" && dep.phase === "after") {
          throw new Error(
            `[actview] Model 阶段冲突：${entry.token.name || "Anonymous"} (@Setup pre) 依赖 ${dep.token.name || "Anonymous"} (@Setup after)`
          );
        }
      }
    }
  }
  /**
   * 执行某阶段所有 Model 的 @Setup 并安装 @Provide/@Watch。
   * 返回 Promise 表示该阶段包含异步 setup；否则同步完成返回 null。
   */
  runPhase(phase) {
    const list = this.order.filter((entry) => entry.phase === phase);
    let chain = null;
    for (const entry of list) {
      if (chain) {
        chain = chain.then(() => this.executeEntry(entry));
      } else {
        const result = this.executeEntry(entry);
        if (result) chain = result;
      }
    }
    return chain;
  }
  /**
   * 在 owner 组件生命周期 hooks 注册完成后调用：
   * - 初始化 / 挂载类阶段：Model hooks 在 owner 之前；
   * - 失活 / 卸载类阶段：owner hooks 在 Model 之前（逆序）。
   */
  applyLifecycleOrder() {
    for (const phase of MODEL_FIRST_PHASES) {
      const hooks = this.dataHooks[phase];
      if (!hooks || hooks.length === 0) continue;
      const target = this.owner[phase];
      target.unshift(...hooks);
    }
    for (const phase of OWNER_FIRST_PHASES) {
      const hooks = this.dataHooks[phase];
      if (!hooks || hooks.length === 0) continue;
      const target = this.owner[phase];
      target.push(...hooks);
    }
  }
  /** Model @Prop：只读投影 owner 组件的同名 @Prop；组件必须声明。 */
  installModelProps(entry) {
    if (entry.meta.props.size === 0) return;
    const ownerMeta = getComponentMeta(
      this.owner.type
    );
    const ownerCtx = this.owner.ctx;
    for (const key of entry.meta.props.keys()) {
      if (!ownerMeta.props.has(key)) {
        throw new Error(
          `[actview] Model "${entry.token.name || "Anonymous"}" 的 @Prop "${key}" 未在组件 "${ownerMeta.name || "Anonymous"}" 声明；请在 owner 组件上声明同名 @Prop`
        );
      }
      const own = Object.getOwnPropertyDescriptor(entry.data, key);
      if (own) delete entry.data[key];
      Object.defineProperty(entry.data, key, {
        configurable: true,
        enumerable: true,
        get: () => ownerCtx == null ? void 0 : ownerCtx[key],
        set: () => {
          throw new Error(
            `[actview] Model prop "${key}" 是只读的（由 owner 组件 @Prop 传入）`
          );
        }
      });
    }
  }
  executeEntry(entry) {
    if (entry.runtimeDone) return;
    if (entry.setupDone) return;
    entry.setupDone = true;
    return this.withOwner(() => {
      var _a2, _b2;
      const setupName = entry.meta.setup;
      const result = setupName ? (_b2 = (_a2 = entry.data)[setupName]) == null ? void 0 : _b2.call(_a2) : void 0;
      if (isThenable$1(result)) {
        return Promise.resolve(result).then(
          () => this.withOwner(() => this.installRuntime(entry))
        );
      }
      this.installRuntime(entry);
    });
  }
  installRuntime(entry) {
    if (entry.runtimeDone) return;
    installProvides(entry.data, entry.meta);
    installWatches(entry.data, entry.meta);
    entry.runtimeDone = true;
  }
  withOwner(fn) {
    const prev = setCurrentInstance(this.owner);
    pauseTracking();
    try {
      return this.owner.scope.run(fn);
    } finally {
      resetTracking();
      setCurrentInstance(prev);
    }
  }
  /** 收集 Model 的生命周期方法，等 owner 组件 hooks 注册后按顺序合并 */
  collectModelHooks(data, meta) {
    var _a2;
    for (const [phase, methods] of Object.entries(meta.hooks)) {
      if (!methods || methods.length === 0) continue;
      const list = (_a2 = this.dataHooks)[phase] ?? (_a2[phase] = []);
      for (const method of methods) {
        list.push(() => {
          var _a3;
          (_a3 = data[method]) == null ? void 0 : _a3.call(data);
        });
      }
    }
  }
}
function installUseModels(scope, target, meta) {
  for (const [key, token] of meta.models) {
    const model = scope.resolve(token);
    Object.defineProperty(target, key, {
      configurable: true,
      enumerable: true,
      writable: true,
      value: model
    });
  }
}
function resolvePhase(meta) {
  return meta.setupMode ?? "pre";
}
function isThenable$1(value) {
  return value != null && (typeof value === "object" || typeof value === "function") && typeof value.then === "function";
}
function mountClassComponent(instance) {
  const Ctor = instance.type;
  const meta = getComponentMeta(Ctor);
  const ctx = new Ctor(instance.props);
  instance.ctx = ctx;
  instance.proxy = ctx;
  installClassPublicInstance(ctx, instance);
  const modelScope = new ComponentScope(instance);
  instance.modelScope = modelScope;
  const withOwner = (fn) => {
    const prev = setCurrentInstance(instance);
    pauseTracking();
    try {
      return instance.scope.run(fn);
    } finally {
      resetTracking();
      setCurrentInstance(prev);
    }
  };
  const finalize = () => withOwner(() => {
    installProvides(ctx, meta);
    installWatches(ctx, meta);
    instance.render = () => ctx.render();
    return instance.render;
  });
  const finishAfterSetups = () => {
    const afterPending = modelScope.runPhase("after");
    return afterPending ? afterPending.then(finalize) : finalize();
  };
  const runComponentSetup = () => withOwner(() => {
    var _a2;
    const setupName = meta.setup;
    const result2 = setupName ? (_a2 = ctx[setupName]) == null ? void 0 : _a2.call(ctx) : void 0;
    if (isThenable(result2)) {
      return Promise.resolve(result2).then(finishAfterSetups);
    }
    return finishAfterSetups();
  });
  const start = () => withOwner(() => {
    installDeclaredFields(ctx, instance, meta);
    installComputed(ctx, meta);
    installUseModels(modelScope, ctx, meta);
    modelScope.validatePhases();
    registerClassLifecycle(instance, ctx, meta);
    modelScope.applyLifecycleOrder();
    const prePending = modelScope.runPhase("pre");
    return prePending ? prePending.then(runComponentSetup) : runComponentSetup();
  });
  const result = start();
  if (isThenable(result)) {
    instance.render = () => null;
    return Promise.resolve(result).then((render2) => {
      instance.render = render2;
      return render2;
    });
  }
  instance.render = result;
  return null;
}
function installClassPublicInstance(ctx, instance) {
  const defineValue = (key, value) => {
    Object.defineProperty(ctx, key, {
      configurable: true,
      enumerable: false,
      value
    });
  };
  const defineGetter = (key, get) => {
    Object.defineProperty(ctx, key, {
      configurable: true,
      enumerable: false,
      get
    });
  };
  defineValue("$", instance);
  defineGetter("$props", () => instance.props);
  defineGetter("$el", () => instance.vnode.el ?? null);
  defineGetter("$parent", () => {
    var _a2;
    return ((_a2 = instance.parent) == null ? void 0 : _a2.proxy) ?? null;
  });
  defineGetter("$root", () => {
    let root = instance;
    while (root.parent) root = root.parent;
    return root.proxy;
  });
  defineValue("$forceUpdate", () => instance.update());
  defineValue("$nextTick", nextTick);
  defineValue("$refs", {});
}
function isThenable(value) {
  return value != null && (typeof value === "object" || typeof value === "function") && typeof value.then === "function";
}
let uid = 0;
function createComponentInstance(vnode, parent, appContext) {
  const instance = {
    uid: uid++,
    type: vnode.type,
    parent,
    appContext,
    vnode,
    // 占位：真正 props 在 setupComponent → initProps 中创建
    props: {},
    // setup 执行后才有 render（setupComponent 写入）
    render: null,
    subTree: null,
    // renderer 填（setupRenderEffect）
    effect: null,
    job: null,
    scope: new EffectScope(true),
    renderCount: 0,
    isMounted: false,
    container: null,
    // 注入表继承：子组件共享父实例的引用（零拷贝），首次 provide 时
    // 由 apiProvide 做 copy-on-write；根组件继承 app.provide 的根注入表。
    injects: parent ? parent.injects : appContext.provides,
    // 先占位，下面用 createComponentPublicInstance 创建（需要 instance 本身）
    proxy: null,
    update: () => {
    },
    beforeMount: [],
    mounted: [],
    beforeUpdate: [],
    updated: [],
    beforeUnmount: [],
    unmounted: [],
    activated: [],
    deactivated: [],
    errorCaptured: []
  };
  vnode.component = instance;
  instance.proxy = createComponentPublicInstance(instance);
  return instance;
}
function createComponentPublicInstance(instance) {
  return {
    // 内部实例逃生口（调试 / 进阶用法）
    $: instance,
    get $props() {
      return instance.props;
    },
    get $el() {
      return instance.vnode.el ?? null;
    },
    get $parent() {
      var _a2;
      return ((_a2 = instance.parent) == null ? void 0 : _a2.proxy) ?? null;
    },
    get $root() {
      let root = instance;
      while (root.parent) root = root.parent;
      return root.proxy;
    },
    // 强制更新：直接入队组件 job，跳过 shouldUpdateComponent 的 props 比较
    $forceUpdate: () => instance.update(),
    $nextTick: nextTick
  };
}
function setupComponent(instance) {
  initProps(instance, instance.vnode.props ?? null);
  return mountClassComponent(instance);
}
function initProps(instance, props) {
  const raw = props ? { ...props } : {};
  delete raw.key;
  instance.props = /* @__PURE__ */ shallowReactive(raw);
}
function updateProps(instance, nextProps, prevProps) {
  const props = instance.props;
  const next = nextProps ?? {};
  const prev = prevProps ?? {};
  if (next === prev) return;
  for (const key of Object.keys(next)) {
    if (key === "key") continue;
    if (hasChanged(next[key], props[key])) {
      props[key] = next[key];
    }
  }
  for (const key of Object.keys(prev)) {
    if (key === "key") continue;
    if (!hasOwn(next, key)) {
      delete props[key];
    }
  }
}
function renderComponentRoot(instance) {
  const render2 = instance.render;
  const result = render2();
  if (result === null || result === void 0 || typeof result === "boolean") {
    return null;
  }
  if (typeof result === "string" || typeof result === "number") {
    return createTextVNode(String(result));
  }
  if (Array.isArray(result)) {
    return createVNode(Fragment, { children: result });
  }
  if (isVNode(result)) {
    return result;
  }
  throw new Error(
    `[actview] 组件 "${getComponentName$1(instance)}" 的 render 返回值非法：期望 VNode / 数组 / string / number / null，当前为 ${describeValue(result)}`
  );
}
function shouldUpdateComponent(n1, n2) {
  const prevProps = n1.props ?? {};
  const nextProps = n2.props ?? {};
  if (prevProps === nextProps) return false;
  const prevKeys = Object.keys(prevProps);
  const nextKeys = Object.keys(nextProps);
  if (prevKeys.length !== nextKeys.length) return true;
  for (const key of nextKeys) {
    if (!hasOwn(prevProps, key) || hasChanged(nextProps[key], prevProps[key])) {
      return true;
    }
  }
  return false;
}
function getComponentName$1(instance) {
  const name = instance.type.name;
  return typeof name === "string" && name.length > 0 ? name : "Anonymous";
}
function describeValue(value) {
  if (typeof value === "function") return "function";
  if (Array.isArray(value)) return "array";
  return typeof value === "object" ? "object" : typeof value;
}
const SVG_NS = "http://www.w3.org/2000/svg";
const SVG_TAGS = new Set(
  "svg,animate,animateMotion,animateTransform,circle,clipPath,defs,desc,ellipse,feBlend,feColorMatrix,feComponentTransfer,feComposite,feConvolveMatrix,feDiffuseLighting,feDisplacementMap,feDistantLight,feDropShadow,feFlood,feFuncA,feFuncB,feFuncG,feFuncR,feGaussianBlur,feImage,feMerge,feMergeNode,feMorphology,feOffset,fePointLight,feSpecularLighting,feSpotLight,feTile,feTurbulence,filter,foreignObject,g,image,line,linearGradient,marker,mask,metadata,mpath,path,pattern,polygon,polyline,radialGradient,rect,set,stop,symbol,switch,text,textPath,tspan,use,view".split(",")
);
function createElement(tag) {
  return SVG_TAGS.has(tag) ? document.createElementNS(SVG_NS, tag) : document.createElement(tag);
}
const SKIP_KEYS = /* @__PURE__ */ new Set(["children", "key", "ref"]);
const STRING_ATTRIBUTE_KEYS = /* @__PURE__ */ new Set(["spellcheck", "draggable", "translate"]);
function isEventKey(key) {
  return /^on[A-Z]/.test(key);
}
function parseEventKey(key) {
  let name = key.slice(2);
  let capture = false;
  let once = false;
  let passive = false;
  for (; ; ) {
    if (name.endsWith("Capture")) {
      capture = true;
      name = name.slice(0, -"Capture".length);
      continue;
    }
    if (name.endsWith("Once")) {
      once = true;
      name = name.slice(0, -"Once".length);
      continue;
    }
    if (name.endsWith("Passive")) {
      passive = true;
      name = name.slice(0, -"Passive".length);
      continue;
    }
    break;
  }
  if (!name) return null;
  return { eventName: name.toLowerCase(), capture, once, passive };
}
function normalizeEventHandler(value) {
  if (typeof value === "function") {
    return { fn: value, options: {} };
  }
  if (value && typeof value === "object") {
    const obj = value;
    if (typeof obj.handler === "function") {
      return { fn: obj.handler, options: obj };
    }
  }
  return null;
}
function patchEvent(el, key, prev, next) {
  const parsed = parseEventKey(key);
  if (!parsed) return;
  const prevHandler = normalizeEventHandler(prev);
  if (prevHandler) {
    el.removeEventListener(
      parsed.eventName,
      prevHandler.fn,
      parsed.capture || !!prevHandler.options.capture
    );
  }
  const nextHandler = normalizeEventHandler(next);
  if (nextHandler) {
    el.addEventListener(parsed.eventName, nextHandler.fn, {
      capture: parsed.capture || !!nextHandler.options.capture,
      once: parsed.once || !!nextHandler.options.once,
      passive: parsed.passive || !!nextHandler.options.passive
    });
  }
}
function normalizeClass(value) {
  if (value == null || value === true || value === false) return "";
  if (typeof value === "string") return value;
  if (typeof value === "number") return String(value);
  if (Array.isArray(value)) {
    let out = "";
    for (const item of value) {
      if (!item) continue;
      const cls = normalizeClass(item);
      if (cls) out = out ? `${out} ${cls}` : cls;
    }
    return out;
  }
  if (typeof value === "object") {
    let out = "";
    for (const key in value) {
      if (value[key]) {
        out = out ? `${out} ${key}` : key;
      }
    }
    return out;
  }
  return "";
}
function patchClass(el, next) {
  const cls = normalizeClass(next);
  if (!cls) {
    el.removeAttribute("class");
  } else {
    el.setAttribute("class", cls);
  }
}
function patchStyle(el, prev, next) {
  const style = el.style;
  if (!style) return;
  if (next == null || next === "") {
    style.cssText = "";
    return;
  }
  if (typeof next === "string") {
    style.cssText = next;
    return;
  }
  if (typeof next === "object") {
    if (prev && typeof prev === "object") {
      const prevObj = prev;
      const nextObj = next;
      for (const key in prevObj) {
        if (!(key in nextObj) || nextObj[key] == null) {
          removeStyle(style, key);
        }
      }
    } else {
      style.cssText = "";
    }
    for (const key in next) {
      setStyle(style, key, next[key]);
    }
    return;
  }
  style.cssText = String(next);
}
function setStyle(style, key, value) {
  if (value == null || value === "") {
    removeStyle(style, key);
    return;
  }
  const str = String(value);
  if (key.startsWith("--") || key.includes("-")) {
    style.setProperty(key, str);
  } else {
    style[key] = str;
  }
}
function removeStyle(style, key) {
  if (key.startsWith("--") || key.includes("-")) {
    style.removeProperty(key);
  } else {
    style[key] = "";
  }
}
function shouldSetAsProp(el, key) {
  if (!(key in el)) return false;
  if (el.namespaceURI === SVG_NS) return false;
  if (key === "form" || key === "list") return false;
  if (key === "type") return false;
  return true;
}
function isBooleanProp(el, key) {
  return shouldSetAsProp(el, key) && typeof el[key] === "boolean";
}
function patchValueProp(el, next) {
  if (next == null) {
    if ("value" in el) {
      el.value = "";
    }
    el.removeAttribute("value");
    return;
  }
  const str = String(next);
  if ("value" in el) {
    el.value = str;
  } else {
    el.setAttribute("value", str);
  }
}
function patchProp(el, key, prev, next) {
  if (SKIP_KEYS.has(key)) return;
  if (prev === next) return;
  if (isEventKey(key)) {
    patchEvent(el, key, prev, next);
    return;
  }
  if (key === "class") {
    patchClass(el, next);
    return;
  }
  if (key === "style") {
    patchStyle(el, prev, next);
    return;
  }
  if (key === "innerHTML") {
    el.innerHTML = next == null ? "" : String(next);
    return;
  }
  if (key === "textContent") {
    el.textContent = next == null ? "" : String(next);
    return;
  }
  if (STRING_ATTRIBUTE_KEYS.has(key)) {
    if (next == null) {
      el.removeAttribute(key);
    } else {
      el.setAttribute(key, String(next));
    }
    return;
  }
  if (key === "value") {
    patchValueProp(el, next);
    return;
  }
  if (next === true) {
    if (isBooleanProp(el, key)) {
      el[key] = true;
    }
    el.setAttribute(key, "");
    return;
  }
  if (next === false || next == null) {
    if (isBooleanProp(el, key)) {
      el[key] = false;
    }
    el.removeAttribute(key);
    return;
  }
  if (shouldSetAsProp(el, key)) {
    el[key] = next;
    return;
  }
  el.setAttribute(key, String(next));
}
function patchProps(el, prevProps, nextProps) {
  const prev = prevProps || {};
  const next = nextProps || {};
  for (const key in next) {
    patchProp(el, key, prev[key], next[key]);
  }
  for (const key in prev) {
    if (!(key in next)) {
      patchProp(el, key, prev[key], null);
    }
  }
}
function handleError(err, instance, info) {
  pauseTracking();
  try {
    let current = instance;
    while (current) {
      const hooks = current.errorCaptured;
      if (hooks && hooks.length > 0) {
        for (const hook of hooks) {
          try {
            const captured = hook(err, current, info);
            if (captured === false) return true;
          } catch (hookError) {
            console.error("[actview] errorCaptured 钩子执行出错：", hookError);
          }
        }
      }
      current = current.parent;
    }
    const errorHandler = instance == null ? void 0 : instance.appContext.config.errorHandler;
    if (errorHandler) {
      try {
        errorHandler(err, instance, info);
      } catch (handlerError) {
        console.error("[actview] app.config.errorHandler 执行出错：", handlerError);
      }
      return true;
    }
    console.error(`[actview] ${info} 阶段发生未捕获错误：`, err);
    return false;
  } finally {
    resetTracking();
  }
}
function collectHostNodes(vnode) {
  const out = [];
  collect(vnode, out);
  return out;
}
function firstHostNode(vnode) {
  const nodes = collectHostNodes(vnode);
  return nodes.length > 0 ? nodes[0] : null;
}
function lastHostNode(vnode) {
  const nodes = collectHostNodes(vnode);
  return nodes.length > 0 ? nodes[nodes.length - 1] : null;
}
function getBuiltinKind$1(type) {
  const builtin = type == null ? void 0 : type.__builtin;
  return builtin === "teleport" || builtin === "transition" ? builtin : null;
}
function collect(vnode, out) {
  const { type } = vnode;
  const builtin = getBuiltinKind$1(type);
  if (builtin === "teleport") {
    pushNode(vnode.el, out);
    return;
  }
  if (builtin === "transition") {
    collectChildren(vnode, out);
    return;
  }
  if (type === Fragment) {
    collectChildren(vnode, out);
    return;
  }
  if (isComponent(type)) {
    const instance = vnode.component;
    if (instance == null ? void 0 : instance.subTree) collect(instance.subTree, out);
    else pushNode(vnode.el, out);
    return;
  }
  pushNode(vnode.el, out);
}
function collectChildren(vnode, out) {
  collectChildrenValue(vnode.children, out);
}
function collectChildrenValue(value, out) {
  if (Array.isArray(value)) {
    for (const item of value) collectChildrenValue(item, out);
    return;
  }
  if (isVNode(value)) collect(value, out);
}
function pushNode(el, out) {
  if (el) out.push(el);
}
function setRef(ref2, value) {
  if (ref2 == null) return;
  if (typeof ref2 === "function") {
    ref2(value);
    return;
  }
  if (typeof ref2 === "object" && "value" in ref2) {
    ref2.value = value;
    return;
  }
  console.warn("[actview] 无效的 ref：期望函数或 Ref 对象。", ref2);
}
var __defProp$d = Object.defineProperty;
var __getOwnPropDesc$d = Object.getOwnPropertyDescriptor;
var __decorateClass$d = (decorators, target, key, kind) => {
  var result = kind > 1 ? void 0 : kind ? __getOwnPropDesc$d(target, key) : target;
  for (var i = decorators.length - 1, decorator; i >= 0; i--)
    if (decorator = decorators[i])
      result = (kind ? decorator(target, key, result) : decorator(result)) || result;
  if (kind && result) __defProp$d(target, key, result);
  return result;
};
const suspenseStack = [];
function pushSuspense(instance) {
  suspenseStack.push(instance);
}
function popSuspense(instance) {
  const index = suspenseStack.indexOf(instance);
  if (index >= 0) suspenseStack.splice(index, 1);
}
function getCurrentSuspense() {
  const instance = suspenseStack[suspenseStack.length - 1];
  return (instance == null ? void 0 : instance.suspenseCtx) ?? null;
}
let Suspense = class extends ActViewComponent {
  constructor() {
    super(...arguments);
    this.pending = false;
  }
  setup() {
    const self = getCurrentInstance();
    if (!self) return;
    self.suspenseCtx = {
      register: () => {
        this.pending = true;
        self.update();
      },
      resolve: () => {
        this.pending = false;
        self.update();
      }
    };
    pushSuspense(self);
    onBeforeUnmount(() => popSuspense(self));
  }
  render() {
    const props = this.$props;
    const children = props.children;
    const content = createVNode("div", {
      style: this.pending ? { display: "none" } : null,
      children
    });
    const nodes = [content];
    if (this.pending) nodes.push(props.fallback ?? null);
    return createVNode(Fragment, { children: nodes });
  }
};
__decorateClass$d([
  Ref
], Suspense.prototype, "pending", 2);
__decorateClass$d([
  Setup
], Suspense.prototype, "setup", 1);
Suspense = __decorateClass$d([
  Component({ name: "Suspense" })
], Suspense);
function resolveTeleportTarget(to) {
  if (typeof to === "string") {
    const target = document.querySelector(to);
    if (!target) {
      throw new Error(
        `[actview] Teleport 目标选择器未匹配到元素: "${to}"`
      );
    }
    return target;
  }
  if (isElement(to)) return to;
  throw new Error(
    "[actview] Teleport 的 to 必须是 CSS 选择器字符串或 Element 节点"
  );
}
function isElement(value) {
  if (value == null || typeof value !== "object") return false;
  if (typeof Element !== "undefined" && value instanceof Element) return true;
  return value.nodeType === 1;
}
const Transition = {
  __builtin: "transition"
};
const DEFAULT_DURATION = 300;
const FRAME_FALLBACK_DELAY = 16;
const PHASES = ["enter", "leave"];
const SUFFIXES = ["from", "active", "to"];
function getState(el) {
  let state = el._transitionTimer;
  if (!state) {
    state = {
      token: 0,
      name: "",
      frameId: null,
      frameIsRaf: false,
      endTimer: null
    };
    el._transitionTimer = state;
  }
  return state;
}
function resetTransition(el) {
  const state = getState(el);
  if (state.frameId != null) {
    if (state.frameIsRaf && typeof cancelAnimationFrame === "function") {
      cancelAnimationFrame(state.frameId);
    } else {
      clearTimeout(state.frameId);
    }
    state.frameId = null;
  }
  if (state.endTimer != null) {
    clearTimeout(state.endTimer);
    state.endTimer = null;
  }
  if (state.name) stripTransitionClasses(el, state.name);
  state.token++;
  return { state, token: state.token };
}
function stripTransitionClasses(el, name) {
  const classList = el.classList;
  for (const phase of PHASES) {
    for (const suffix of SUFFIXES) {
      classList.remove(`${name}-${phase}-${suffix}`);
    }
  }
}
function nextFrame(cb) {
  if (typeof requestAnimationFrame === "function") {
    return { id: requestAnimationFrame(() => cb()), isRaf: true };
  }
  return { id: setTimeout(cb, FRAME_FALLBACK_DELAY), isRaf: false };
}
function resolveDuration(props) {
  const raw = props == null ? void 0 : props.duration;
  if (typeof raw === "number" && Number.isFinite(raw) && raw >= 0) return raw;
  return DEFAULT_DURATION;
}
function resolveName(props) {
  const name = props == null ? void 0 : props.name;
  if (typeof name === "string" && name.length > 0) return name;
  return "v";
}
function finishTransition(el, name) {
  stripTransitionClasses(el, name);
  const state = el._transitionTimer;
  if (state) {
    state.frameId = null;
    state.endTimer = null;
  }
  el._transitionTimer = void 0;
}
function applyTransitionEnter(el, props) {
  const { state, token } = resetTransition(el);
  const name = resolveName(props);
  state.name = name;
  const classList = el.classList;
  classList.add(`${name}-enter-from`, `${name}-enter-active`);
  const frame = nextFrame(() => {
    if (state.token !== token) return;
    state.frameId = null;
    classList.remove(`${name}-enter-from`);
    classList.add(`${name}-enter-to`);
    state.endTimer = setTimeout(() => {
      var _a2;
      if (state.token !== token) return;
      finishTransition(el, name);
      (_a2 = props == null ? void 0 : props.onEnter) == null ? void 0 : _a2.call(props, el);
    }, resolveDuration(props));
  });
  state.frameId = frame.id;
  state.frameIsRaf = frame.isRaf;
}
function applyTransitionLeave(el, props, done) {
  const { state, token } = resetTransition(el);
  const name = resolveName(props);
  state.name = name;
  const classList = el.classList;
  classList.add(`${name}-leave-from`, `${name}-leave-active`);
  const frame = nextFrame(() => {
    if (state.token !== token) return;
    state.frameId = null;
    classList.remove(`${name}-leave-from`);
    classList.add(`${name}-leave-to`);
    state.endTimer = setTimeout(() => {
      var _a2;
      if (state.token !== token) return;
      finishTransition(el, name);
      (_a2 = props == null ? void 0 : props.onLeave) == null ? void 0 : _a2.call(props, el);
      done();
    }, resolveDuration(props));
  });
  state.frameId = frame.id;
  state.frameIsRaf = frame.isRaf;
}
const fallbackAppContext = {
  app: null,
  appId: 0,
  config: {},
  provides: {},
  root: null
};
function render(vnode, container) {
  const host = container;
  const prevVNode = host._vnode ?? null;
  if (vnode == null) {
    if (prevVNode) unmount(prevVNode);
    host._vnode = null;
    return;
  }
  patch(prevVNode, vnode, container, null, null);
  host._vnode = vnode;
}
function patch(n1, n2, container, anchor, parent) {
  if (n1 === n2) return;
  if (n1 && !isSameVNodeType$1(n1, n2)) {
    unmount(n1);
    n1 = null;
  }
  const { type } = n2;
  if (type === Text) {
    patchText(n1, n2, container, anchor);
  } else if (type === Fragment) {
    processFragment(n1, n2, container, anchor, parent);
  } else if (typeof type === "string") {
    processElement(n1, n2, container, anchor, parent);
  } else if (getBuiltinKind(type) === "teleport") {
    if (n1) patchTeleport(n1, n2, parent);
    else mountTeleport(n2, container, anchor, parent);
  } else if (getBuiltinKind(type) === "transition") {
    processTransition(n1, n2, container, anchor, parent);
  } else if (isComponent(type)) {
    if (n1) updateComponent(n1, n2);
    else mountComponent(n2, container, anchor, parent);
  } else {
    throw new Error(`[actview] 无效的 VNode type：${String(type)}`);
  }
}
function getBuiltinKind(type) {
  const builtin = type == null ? void 0 : type.__builtin;
  return builtin === "teleport" || builtin === "transition" ? builtin : null;
}
function isSameVNodeType$1(n1, n2) {
  return n1.type === n2.type && n1.key === n2.key;
}
function patchText(n1, n2, container, anchor) {
  var _a2;
  const text = String(((_a2 = n2.props) == null ? void 0 : _a2.text) ?? "");
  if (n1) {
    const el2 = n1.el;
    if (el2) el2.nodeValue = text;
    n2.el = el2;
    return;
  }
  const el = document.createTextNode(text);
  n2.el = el;
  container.insertBefore(el, anchor);
}
function processElement(n1, n2, container, anchor, parent) {
  if (n1 == null) {
    mountElement(n2, container, anchor, parent);
  } else {
    patchElement(n1, n2, parent);
  }
}
function mountElement(vnode, container, anchor, parent) {
  var _a2;
  const el = createElement(vnode.type);
  vnode.el = el;
  const children = normalizeChildren((_a2 = vnode.props) == null ? void 0 : _a2.children);
  vnode.children = children;
  for (const child of children) patch(null, child, el, null, parent);
  patchProps(el, null, vnode.props);
  const ref2 = resolveRef(vnode);
  if (ref2 != null) setRef(ref2, el);
  container.insertBefore(el, anchor);
}
function patchElement(n1, n2, parent) {
  const el = n1.el;
  n2.el = el;
  patchProps(el, n1.props, n2.props);
  patchChildren(n1, n2, el, null, parent);
  const prevRef = resolveRef(n1);
  const nextRef = resolveRef(n2);
  if (prevRef !== nextRef) {
    setRef(prevRef, null);
    setRef(nextRef, el);
  }
}
function unmountElement(vnode, parent) {
  for (const child of getChildren(vnode)) unmount(child);
  const ref2 = resolveRef(vnode);
  if (ref2 != null) setRef(ref2, null);
  const el = vnode.el;
  if (el) removeNode(el);
  vnode.el = null;
}
function processFragment(n1, n2, container, anchor, parent) {
  var _a2;
  const children = normalizeChildren((_a2 = n2.props) == null ? void 0 : _a2.children);
  n2.children = children;
  if (n1 == null) {
    for (const child of children) patch(null, child, container, anchor, parent);
  } else {
    patchChildren(n1, n2, container, getNextHostNode(n1) ?? anchor, parent);
  }
  n2.el = firstHostNodeIn(children);
}
function firstHostNodeIn(children) {
  for (const child of children) {
    const node = firstHostNode(child);
    if (node) return node;
  }
  return null;
}
function getTeleportTargetAnchor(vnode) {
  return vnode.__teleportTargetAnchor ?? null;
}
function mountTeleport(vnode, container, anchor, parent) {
  var _a2, _b2;
  const target = resolveTeleportTarget((_a2 = vnode.props) == null ? void 0 : _a2.to);
  const parentAnchor = document.createComment("teleport");
  vnode.el = parentAnchor;
  container.insertBefore(parentAnchor, anchor);
  const targetAnchor = document.createComment("teleport");
  target.appendChild(targetAnchor);
  vnode.__teleportTargetAnchor = targetAnchor;
  const children = normalizeChildren((_b2 = vnode.props) == null ? void 0 : _b2.children);
  vnode.children = children;
  for (const child of children) patch(null, child, target, targetAnchor, parent);
}
function patchTeleport(n1, n2, parent) {
  var _a2, _b2, _c;
  const nextChildren = normalizeChildren((_a2 = n2.props) == null ? void 0 : _a2.children);
  n2.children = nextChildren;
  n2.el = n1.el;
  const prevTarget = resolveTeleportTarget((_b2 = n1.props) == null ? void 0 : _b2.to);
  const nextTarget = resolveTeleportTarget((_c = n2.props) == null ? void 0 : _c.to);
  const prevAnchor = getTeleportTargetAnchor(n1);
  if (prevTarget === nextTarget && prevAnchor) {
    n2.__teleportTargetAnchor = prevAnchor;
    patchChildren(n1, n2, nextTarget, prevAnchor, parent);
    return;
  }
  const nextAnchor = document.createComment("teleport");
  nextTarget.appendChild(nextAnchor);
  for (const child of getChildren(n1)) {
    for (const node of collectHostNodes(child)) {
      nextTarget.insertBefore(node, nextAnchor);
    }
  }
  if (prevAnchor) removeNode(prevAnchor);
  n2.__teleportTargetAnchor = nextAnchor;
  patchChildren(n1, n2, nextTarget, nextAnchor, parent);
}
function unmountTeleport(vnode, parent) {
  for (const child of getChildren(vnode)) unmount(child);
  const targetAnchor = getTeleportTargetAnchor(vnode);
  if (targetAnchor) removeNode(targetAnchor);
  const parentAnchor = vnode.el;
  if (parentAnchor) removeNode(parentAnchor);
  vnode.__teleportTargetAnchor = null;
  vnode.el = null;
}
function processTransition(n1, n2, container, anchor, parent) {
  const prevChild = n1 ? transitionChild(n1) : null;
  const nextChild = transitionChild(n2);
  const props = n2.props ?? {};
  if (!prevChild) {
    if (!nextChild) {
      n2.el = null;
      return;
    }
    patch(null, nextChild, container, anchor, parent);
    n2.el = nextChild.el;
    transitionEnter(nextChild, props);
    return;
  }
  if (!nextChild) {
    transitionLeave(prevChild, (n1 == null ? void 0 : n1.props) ?? props, () => unmount(prevChild));
    n2.el = null;
    return;
  }
  if (!isSameVNodeType$1(prevChild, nextChild)) {
    transitionLeave(prevChild, (n1 == null ? void 0 : n1.props) ?? props, () => {
      unmount(prevChild);
      patch(null, nextChild, container, anchor, parent);
      n2.el = nextChild.el;
      transitionEnter(nextChild, props);
    });
    n2.el = prevChild.el;
    return;
  }
  patch(prevChild, nextChild, container, anchor, parent);
  n2.el = nextChild.el;
}
function transitionChild(vnode) {
  var _a2;
  if (Array.isArray(vnode.children)) {
    const cached = vnode.children;
    if (cached.length === 0) return null;
    if (cached.length === 1) return cached[0];
  }
  const children = normalizeChildren((_a2 = vnode.props) == null ? void 0 : _a2.children);
  if (children.length === 0) {
    vnode.children = [];
    return null;
  }
  const child = children.length === 1 ? children[0] : createVNode(Fragment, { children });
  vnode.children = [child];
  return child;
}
function transitionElements(vnode) {
  const elements = [];
  for (const node of collectHostNodes(vnode)) {
    if (node.nodeType === 1) elements.push(node);
  }
  return elements;
}
function transitionEnter(child, props) {
  for (const el of transitionElements(child)) applyTransitionEnter(el, props);
}
function transitionLeave(child, props, done) {
  const elements = transitionElements(child);
  if (elements.length === 0) {
    done();
    return;
  }
  const leaveProps = props ?? {};
  let remaining = elements.length;
  const finish = () => {
    if (--remaining === 0) done();
  };
  for (const el of elements) applyTransitionLeave(el, leaveProps, finish);
}
function unmountTransition(vnode, parent) {
  const child = transitionChild(vnode);
  if (!child) {
    vnode.el = null;
    return;
  }
  transitionLeave(child, vnode.props, () => unmount(child));
}
function patchChildren(n1, n2, container, anchor, parent) {
  var _a2;
  const prevChildren = getChildren(n1);
  const nextChildren = normalizeChildren((_a2 = n2.props) == null ? void 0 : _a2.children);
  n2.children = nextChildren;
  const hasKey = prevChildren.some((child) => child.key != null) || nextChildren.some((child) => child.key != null);
  if (hasKey) {
    patchKeyedChildren(prevChildren, nextChildren, container, anchor, parent);
  } else {
    patchUnkeyedChildren(prevChildren, nextChildren, container, anchor, parent);
  }
}
function patchUnkeyedChildren(prevChildren, nextChildren, container, anchor, parent) {
  const commonLength = Math.min(prevChildren.length, nextChildren.length);
  for (let i = 0; i < commonLength; i++) {
    patch(
      prevChildren[i],
      nextChildren[i],
      container,
      nextHostNodeAfter(prevChildren, i, anchor),
      parent
    );
  }
  for (let i = prevChildren.length - 1; i >= commonLength; i--) {
    unmount(prevChildren[i]);
  }
  for (let i = commonLength; i < nextChildren.length; i++) {
    patch(null, nextChildren[i], container, anchor, parent);
  }
}
function patchKeyedChildren(prevChildren, nextChildren, container, anchor, parent) {
  const prevLength = prevChildren.length;
  const nextLength = nextChildren.length;
  let start = 0;
  let prevEnd = prevLength - 1;
  let nextEnd = nextLength - 1;
  while (start <= prevEnd && start <= nextEnd && isSameVNodeType$1(prevChildren[start], nextChildren[start])) {
    patch(
      prevChildren[start],
      nextChildren[start],
      container,
      nextHostNodeAfter(prevChildren, start, anchor),
      parent
    );
    start++;
  }
  while (start <= prevEnd && start <= nextEnd && isSameVNodeType$1(prevChildren[prevEnd], nextChildren[nextEnd])) {
    patch(
      prevChildren[prevEnd],
      nextChildren[nextEnd],
      container,
      nextHostNodeAfter(prevChildren, prevEnd, anchor),
      parent
    );
    prevEnd--;
    nextEnd--;
  }
  if (start > prevEnd) {
    if (start <= nextEnd) {
      const nextAnchor2 = anchorFromIndex(nextChildren, nextEnd + 1, anchor);
      for (let i = start; i <= nextEnd; i++) {
        patch(null, nextChildren[i], container, nextAnchor2, parent);
      }
    }
    return;
  }
  if (start > nextEnd) {
    for (let i = start; i <= prevEnd; i++) unmount(prevChildren[i]);
    return;
  }
  const oldKeyToIndex = /* @__PURE__ */ new Map();
  const oldUnkeyedIndexes = [];
  for (let i = start; i <= prevEnd; i++) {
    const { key } = prevChildren[i];
    if (key != null) oldKeyToIndex.set(key, i);
    else oldUnkeyedIndexes.push(i);
  }
  const reusedOldIndexes = /* @__PURE__ */ new Set();
  const reusedNewIndexes = /* @__PURE__ */ new Set();
  const newIndexToOldIndex = [];
  let unkeyedCursor = 0;
  for (let i = start; i <= nextEnd; i++) {
    const nextChild = nextChildren[i];
    let oldIndex = -1;
    if (nextChild.key != null) {
      const found = oldKeyToIndex.get(nextChild.key);
      if (found !== void 0 && !reusedOldIndexes.has(found)) oldIndex = found;
    } else if (unkeyedCursor < oldUnkeyedIndexes.length) {
      oldIndex = oldUnkeyedIndexes[unkeyedCursor++];
    }
    if (oldIndex < 0) {
      newIndexToOldIndex.push(0);
      continue;
    }
    reusedOldIndexes.add(oldIndex);
    reusedNewIndexes.add(i);
    const domReused = isSameVNodeType$1(prevChildren[oldIndex], nextChild);
    patch(prevChildren[oldIndex], nextChild, container, anchor, parent);
    newIndexToOldIndex.push(domReused ? oldIndex + 1 : 0);
  }
  for (let i = start; i <= prevEnd; i++) {
    if (!reusedOldIndexes.has(i)) unmount(prevChildren[i]);
  }
  const stableIndexes = /* @__PURE__ */ new Set();
  for (const index of getSequence(newIndexToOldIndex)) {
    stableIndexes.add(index + start);
  }
  let nextAnchor = anchorFromIndex(nextChildren, nextEnd + 1, anchor);
  for (let i = nextEnd; i >= start; i--) {
    const nextChild = nextChildren[i];
    if (!reusedNewIndexes.has(i)) {
      patch(null, nextChild, container, nextAnchor, parent);
    } else if (!stableIndexes.has(i)) {
      moveHostNodes(nextChild, container, nextAnchor);
    }
    const firstHost = firstHostNode(nextChild);
    if (firstHost) nextAnchor = firstHost;
  }
}
function mountComponent(vnode, container, anchor, parent) {
  if (vnode.component) {
    activateKeptAlive(vnode, container, anchor);
    return;
  }
  const instance = createComponentInstance(
    vnode,
    parent,
    resolveAppContext(vnode, parent)
  );
  vnode.component = instance;
  instance.vnode = vnode;
  instance.container = container;
  let pending = null;
  try {
    pending = setupComponent(instance);
  } catch (err) {
    if (!handleError(err, instance, "setup")) throw err;
    instance.render = () => null;
  }
  if (pending) {
    const suspense = currentSuspense();
    suspense == null ? void 0 : suspense.register();
    pending.then(
      (render2) => {
        instance.render = render2;
        suspense == null ? void 0 : suspense.resolve();
        queueJob(instance.job);
      },
      (err) => {
        suspense == null ? void 0 : suspense.resolve();
        if (!handleError(err, instance, "setup")) throw err;
      }
    );
  }
  setupRenderEffect(instance, container, anchor);
  const ref2 = resolveRef(vnode);
  if (ref2 != null) setRef(ref2, instance.proxy);
}
function patchWithRecurse(instance, patchFn) {
  const effect = instance.effect;
  effect.flags |= EffectFlags.ALLOW_RECURSE;
  try {
    return patchFn();
  } finally {
    effect.flags &= ~EffectFlags.ALLOW_RECURSE;
  }
}
function setupRenderEffect(instance, container, anchor) {
  const componentUpdateFn = () => {
    instance.renderCount++;
    const perfStart = instance.appContext.config.performance ? now() : 0;
    if (!instance.isMounted) {
      invokeHooks(instance.beforeMount, instance);
      try {
        const subTree = renderComponentRoot(instance);
        instance.subTree = subTree;
        patchWithRecurse(instance, () => {
          if (subTree) patch(null, subTree, container, anchor, instance);
        });
        instance.vnode.el = subTree ? subTree.el : null;
      } catch (err) {
        if (!handleError(err, instance, "render")) throw err;
        instance.subTree = null;
        instance.vnode.el = null;
        instance.isMounted = true;
        return;
      }
      instance.isMounted = true;
      if (perfStart) {
        notifyDevtoolsPerformance(instance, "mount", now() - perfStart);
      }
      queuePostFlushCb(() => invokeHooks(instance.mounted, instance));
      return;
    }
    invokeHooks(instance.beforeUpdate, instance);
    const prevTree = instance.subTree;
    const hostContainer = instanceContainer(instance);
    try {
      const nextTree = renderComponentRoot(instance);
      instance.subTree = nextTree;
      patchWithRecurse(instance, () => {
        if (prevTree && nextTree) {
          patch(prevTree, nextTree, hostContainer, getNextHostNode(prevTree), instance);
          instance.vnode.el = nextTree.el;
        } else if (nextTree) {
          patch(null, nextTree, hostContainer, null, instance);
          instance.vnode.el = nextTree.el;
        } else {
          if (prevTree) unmount(prevTree, instance);
          instance.vnode.el = null;
        }
      });
    } catch (err) {
      instance.subTree = prevTree;
      if (!handleError(err, instance, "render")) throw err;
      return;
    }
    if (perfStart) {
      notifyDevtoolsPerformance(instance, "update", now() - perfStart);
    }
    queuePostFlushCb(() => invokeHooks(instance.updated, instance));
  };
  instance.job = {
    id: instance.uid,
    active: true,
    run: () => instance.effect.run()
  };
  instance.update = () => queueJob(instance.job);
  instance.scope.run(() => {
    const effect = new ReactiveEffect(componentUpdateFn);
    effect.scheduler = () => queueJob(instance.job);
    instance.effect = effect;
    effect.run();
  });
}
function updateComponent(n1, n2) {
  const instance = n2.component = n1.component;
  instance.vnode = n2;
  n2.el = n1.el;
  updateProps(instance, n2.props, n1.props);
  const prevRef = resolveRef(n1);
  const nextRef = resolveRef(n2);
  if (prevRef !== nextRef) {
    setRef(prevRef, null);
    setRef(nextRef, instance.proxy);
  }
  if (shouldUpdateComponent(n1, n2)) queueJob(instance.job);
}
function unmountComponent(vnode) {
  const instance = vnode.component;
  if (!instance) return;
  invokeHooks(instance.beforeUnmount, instance);
  instance.scope.stop();
  instance.job.active = false;
  const subTree = instance.subTree;
  if (subTree) {
    try {
      unmount(subTree, instance);
    } catch (err) {
      if (!handleError(err, instance, "unmount")) throw err;
    } finally {
      instance.subTree = null;
    }
  }
  queuePostFlushCb(() => invokeHooks(instance.unmounted, instance));
  setRef(resolveRef(instance.vnode), null);
  instance.isMounted = false;
  vnode.el = null;
}
function getKeepAliveMarker(vnode) {
  return vnode.__keepAlive ?? null;
}
function componentHostNodes(instance) {
  return instance.subTree ? collectHostNodes(instance.subTree) : [];
}
function deactivateKeptAlive(vnode, marker) {
  const instance = vnode.component;
  if (!instance) return;
  for (const node of componentHostNodes(instance)) {
    marker.storage.appendChild(node);
  }
  marker.cache.set(marker.key, vnode);
  if (instance.isMounted) invokeHooks(instance.deactivated, instance);
}
function activateKeptAlive(vnode, container, anchor) {
  const instance = vnode.component;
  if (!instance) return;
  for (const node of componentHostNodes(instance)) {
    container.insertBefore(node, anchor);
  }
  instance.vnode = vnode;
  instance.container = container;
  vnode.el = instance.subTree ? instance.subTree.el : null;
  instance.update();
  invokeHooks(instance.activated, instance);
}
function unmount(vnode, parent) {
  const { type } = vnode;
  if (type === Text) {
    const el = vnode.el;
    if (el) removeNode(el);
    vnode.el = null;
    return;
  }
  if (type === Fragment) {
    for (const child of getChildren(vnode)) unmount(child);
    vnode.el = null;
    return;
  }
  if (typeof type === "string") {
    unmountElement(vnode);
    return;
  }
  const builtin = getBuiltinKind(type);
  if (builtin === "teleport") {
    unmountTeleport(vnode);
    return;
  }
  if (builtin === "transition") {
    unmountTransition(vnode);
    return;
  }
  if (isComponent(type)) {
    const marker = getKeepAliveMarker(vnode);
    if (vnode.component && marker) {
      deactivateKeptAlive(vnode, marker);
      return;
    }
    unmountComponent(vnode);
  }
}
function getNextHostNode(vnode) {
  const last = lastHostNode(vnode);
  return last ? last.nextSibling : null;
}
function moveHostNodes(vnode, container, anchor) {
  const nodes = collectHostNodes(vnode);
  if (nodes.length === 0) return;
  const last = nodes[nodes.length - 1];
  if (last.parentNode === container && last.nextSibling === anchor) return;
  for (const node of nodes) container.insertBefore(node, anchor);
}
function nextHostNodeAfter(children, index, fallback) {
  const next = getNextHostNode(children[index]);
  if (next) return next;
  for (let i = index + 1; i < children.length; i++) {
    const first = firstHostNode(children[i]);
    if (first) return first;
  }
  return fallback;
}
function anchorFromIndex(children, from, fallback) {
  for (let i = from; i < children.length; i++) {
    const first = firstHostNode(children[i]);
    if (first) return first;
  }
  return fallback;
}
function getSequence(arr) {
  const predecessors = arr.slice();
  const tails = [];
  for (let i = 0; i < arr.length; i++) {
    const value = arr[i];
    if (value === 0) continue;
    let low = 0;
    let high = tails.length;
    while (low < high) {
      const middle = low + high >> 1;
      if (arr[tails[middle]] < value) low = middle + 1;
      else high = middle;
    }
    if (low > 0) predecessors[i] = tails[low - 1];
    tails[low] = i;
  }
  let length = tails.length;
  let cursor = tails[length - 1];
  while (length-- > 0) {
    tails[length] = cursor;
    cursor = predecessors[cursor];
  }
  return tails;
}
function currentSuspense() {
  const suspense = getCurrentSuspense();
  if (suspense == null) return null;
  const ctx = suspense.suspenseCtx ?? suspense;
  return ctx != null && typeof ctx.register === "function" && typeof ctx.resolve === "function" ? ctx : null;
}
function now() {
  return typeof performance !== "undefined" ? performance.now() : Date.now();
}
function getChildren(vnode) {
  var _a2;
  if (Array.isArray(vnode.children)) return vnode.children;
  return normalizeChildren((_a2 = vnode.props) == null ? void 0 : _a2.children);
}
function normalizeChildren(children) {
  if (children == null || typeof children === "boolean") return [];
  const flat = [];
  flattenInto(children, flat);
  const result = [];
  for (const child of flat) {
    if (child == null || typeof child === "boolean") continue;
    if (typeof child === "string" || typeof child === "number") {
      result.push(createTextVNode(String(child)));
      continue;
    }
    if (isVNode(child)) {
      result.push(child);
      continue;
    }
    throw new Error(
      `[actview] 无效的子节点：期望 VNode / string / number / null，当前为 ${typeof child}`
    );
  }
  return result;
}
function flattenInto(value, out) {
  if (Array.isArray(value)) {
    for (const item of value) flattenInto(item, out);
    return;
  }
  out.push(value);
}
function resolveRef(vnode) {
  var _a2;
  return ((_a2 = vnode.props) == null ? void 0 : _a2.ref) ?? vnode.ref;
}
function resolveAppContext(vnode, parent) {
  if (parent) return parent.appContext;
  const appContext = vnode.appContext;
  return appContext ?? fallbackAppContext;
}
function instanceContainer(instance) {
  return instance.container;
}
function removeNode(node) {
  const parent = node.parentNode;
  if (parent) parent.removeChild(node);
}
let appUid = 0;
function createApp(rootComponent, rootProps = null) {
  assertRootComponent(rootComponent);
  const context = {
    app: null,
    appId: ++appUid,
    name: rootComponent.name,
    config: { devtools: false, performance: false },
    provides: {},
    root: null
  };
  const installedPlugins = /* @__PURE__ */ new Set();
  const unmountHooks = [];
  const app = {
    _context: context,
    _container: null,
    config: context.config,
    component: rootComponent,
    provide(key, value) {
      context.provides[key] = value;
      return app;
    },
    use(plugin, options) {
      if (installedPlugins.has(plugin)) return app;
      if (app._container) {
        throw new Error("[actview] app.use() 必须在 mount() 之前调用");
      }
      installedPlugins.add(plugin);
      try {
        if (typeof plugin === "function") {
          plugin(app, options);
        } else if (plugin && typeof plugin.install === "function") {
          plugin.install(app, options);
        } else {
          throw new Error("[actview] 无效的插件：需要 install(app, options) 或函数");
        }
      } catch (err) {
        installedPlugins.delete(plugin);
        throw err;
      }
      return app;
    },
    onUnmount(fn) {
      unmountHooks.push(fn);
      return app;
    },
    mount(rootContainer) {
      assertRootComponent(app.component);
      const container = resolveContainer(rootContainer);
      const mounted = container;
      if (mounted.__actview_app__) {
        console.warn(
          "[actview] 容器已挂载过 ActView 应用：重复 mount 会覆盖容器上的 app 标记，旧应用不会被自动卸载。"
        );
      }
      const vnode = createVNode(app.component, rootProps ?? null);
      vnode.appContext = context;
      render(vnode, container);
      mounted.__actview_app__ = app;
      app._container = container;
      const instance = vnode.component ?? null;
      context.root = instance;
      return (instance == null ? void 0 : instance.proxy) ?? null;
    },
    unmount() {
      const container = app._container;
      if (!container) return;
      try {
        render(null, container);
      } finally {
        delete container.__actview_app__;
        app._container = null;
        notifyDevtoolsApp(context, "unmount", context.root);
        context.root = null;
        for (const hook of unmountHooks.splice(0)) {
          try {
            hook();
          } catch (err) {
            console.error("[actview] app.onUnmount 回调出错：", err);
          }
        }
      }
    }
  };
  context.app = app;
  return app;
}
function assertRootComponent(component) {
  if (!isComponent(component)) {
    throw new Error(
      `[actview] 根组件无效：需要 @Component 类组件（必须实现 render）（当前为 ${typeof component}）`
    );
  }
}
function resolveContainer(rootContainer) {
  if (typeof rootContainer === "string") {
    const container = document.querySelector(rootContainer);
    if (!container) {
      throw new Error(`[actview] mount 失败：未找到容器 "${rootContainer}"`);
    }
    return container;
  }
  if (!rootContainer) {
    throw new Error("[actview] mount 失败：容器不能为空");
  }
  return rootContainer;
}
var __defProp$c = Object.defineProperty;
var __getOwnPropDesc$c = Object.getOwnPropertyDescriptor;
var __decorateClass$c = (decorators, target, key, kind) => {
  var result = kind > 1 ? void 0 : kind ? __getOwnPropDesc$c(target, key) : target;
  for (var i = decorators.length - 1, decorator; i >= 0; i--)
    if (decorator = decorators[i])
      result = (kind ? decorator(target, key, result) : decorator(result)) || result;
  if (kind && result) __defProp$c(target, key, result);
  return result;
};
let ErrorBoundary = class extends ActViewComponent {
  constructor() {
    super(...arguments);
    this.error = null;
  }
  setup() {
    const self = getCurrentInstance();
    onErrorCaptured((err) => {
      if (this.error == null) {
        this.error = err;
        self == null ? void 0 : self.update();
      }
      return false;
    });
  }
  render() {
    const props = this.$props;
    if (this.error != null) {
      const fallback = props.fallback;
      return typeof fallback === "function" ? fallback(this.error) : fallback ?? null;
    }
    return props.children;
  }
};
__decorateClass$c([
  Ref
], ErrorBoundary.prototype, "error", 2);
__decorateClass$c([
  Setup
], ErrorBoundary.prototype, "setup", 1);
ErrorBoundary = __decorateClass$c([
  Component({ name: "ErrorBoundary" })
], ErrorBoundary);
var __defProp$b = Object.defineProperty;
var __getOwnPropDesc$b = Object.getOwnPropertyDescriptor;
var __decorateClass$b = (decorators, target, key, kind) => {
  var result = kind > 1 ? void 0 : kind ? __getOwnPropDesc$b(target, key) : target;
  for (var i = decorators.length - 1, decorator; i >= 0; i--)
    if (decorator = decorators[i])
      result = (kind ? decorator(target, key, result) : decorator(result)) || result;
  if (kind && result) __defProp$b(target, key, result);
  return result;
};
function flattenChildren(children) {
  if (children == null || typeof children === "boolean") return [];
  const list = Array.isArray(children) ? children.flat(Infinity) : [children];
  return list.filter(
    (child) => child != null && typeof child !== "boolean"
  );
}
let TransitionGroup = class extends ActViewComponent {
  constructor() {
    super(...arguments);
    this.tag = "div";
    this.name = "v";
    this.duration = 300;
    this.class = null;
    this.style = null;
  }
  render() {
    const children = flattenChildren(this.$props.children);
    const wrapped = children.map((child, index) => {
      const key = (child == null ? void 0 : child.key) ?? index;
      return createVNode(
        Transition,
        {
          name: this.name,
          duration: this.duration,
          onEnter: this.$props.onEnter,
          onLeave: this.$props.onLeave,
          children: child
        },
        key
      );
    });
    return createVNode(this.tag, {
      class: this.class,
      style: this.style,
      children: wrapped
    });
  }
};
__decorateClass$b([
  Prop
], TransitionGroup.prototype, "tag", 2);
__decorateClass$b([
  Prop
], TransitionGroup.prototype, "name", 2);
__decorateClass$b([
  Prop
], TransitionGroup.prototype, "duration", 2);
__decorateClass$b([
  Prop
], TransitionGroup.prototype, "class", 2);
__decorateClass$b([
  Prop
], TransitionGroup.prototype, "style", 2);
TransitionGroup = __decorateClass$b([
  Component({ name: "TransitionGroup" })
], TransitionGroup);
let Dynamic = class extends ActViewComponent {
  render() {
    const { is, key, ...props } = this.$props;
    if (!is) return null;
    return createVNode(is, props, key ?? null);
  }
};
__decorateClass$b([
  Prop
], Dynamic.prototype, "is", 2);
Dynamic = __decorateClass$b([
  Component({ name: "Dynamic" })
], Dynamic);
var __defProp$a = Object.defineProperty;
var __getOwnPropDesc$a = Object.getOwnPropertyDescriptor;
var __decorateClass$a = (decorators, target, key, kind) => {
  var result = kind > 1 ? void 0 : kind ? __getOwnPropDesc$a(target, key) : target;
  for (var i = decorators.length - 1, decorator; i >= 0; i--)
    if (decorator = decorators[i])
      result = (kind ? decorator(target, key, result) : decorator(result)) || result;
  if (kind && result) __defProp$a(target, key, result);
  return result;
};
function matches(pattern, name) {
  if (pattern == null) return false;
  if (Array.isArray(pattern)) return pattern.some((p) => matches(p, name));
  if (pattern instanceof RegExp) return pattern.test(name);
  if (typeof pattern === "string") {
    return pattern.split(",").map((part) => part.trim()).filter(Boolean).includes(name);
  }
  return false;
}
function getComponentName(child) {
  const type = child.type;
  return typeof type === "function" && typeof type.name === "string" ? type.name : "";
}
function isSameVNodeType(a, b) {
  return a.type === b.type && a.key === b.key;
}
function normalizeChild(children) {
  if (children == null || typeof children === "boolean") return null;
  const list = Array.isArray(children) ? children.flat(Infinity) : [children];
  for (const item of list) {
    if (item != null && typeof item !== "boolean") return item;
  }
  return null;
}
let KeepAlive = class extends ActViewComponent {
  constructor() {
    super(...arguments);
    this.cache = /* @__PURE__ */ new Map();
    this.storage = document.createElement("div");
    this.self = null;
    this.lastChild = null;
    this.lastKey = void 0;
  }
  setup() {
    this.storage.style.display = "none";
    this.storage.setAttribute("aria-hidden", "true");
    const self = getCurrentInstance();
    this.self = self;
    if (self) {
      self.__keepAliveCache = this.cache;
    }
  }
  createMeta(key) {
    return {
      cache: this.cache,
      storage: this.storage,
      key,
      max: this.$props.max
    };
  }
  /**
   * 真正销毁一个缓存实例（不经过 renderer 的 unmount 路径，避免 import
   * renderer 造成循环依赖）：停 scope/更新任务 → 移除全部宿主 DOM → 卸载钩子。
   */
  destroyCached(cached) {
    var _a2;
    delete cached.__keepAlive;
    const instance = cached.component;
    if (!instance) return;
    (_a2 = instance.scope) == null ? void 0 : _a2.stop();
    if (instance.job) instance.job.active = false;
    for (const node of collectHostNodes(instance.subTree ?? cached)) {
      if (node.parentNode) node.parentNode.removeChild(node);
    }
    instance.isMounted = false;
    instance.container = null;
    invokeHooks(instance.unmounted, instance);
  }
  /**
   * max LRU：缓存超过上限时淘汰最旧项（Map 插入序）。
   *
   * 注意：命中缓存时活动 vnode 仍留在 cache 里（Vue 同语义），因此它也可能
   * 成为「最旧项」被淘汰 —— 若淘汰的正是当前活动项，**不能销毁**（它还在
   * 页面上）：只摘掉缓存标记，之后它卸载时由 renderer 走正常 unmount 路径。
   */
  pruneCache() {
    const max = this.$props.max;
    if (typeof max !== "number" || !Number.isFinite(max)) return;
    while (this.cache.size > max) {
      const oldestKey = this.cache.keys().next().value;
      const oldest = this.cache.get(oldestKey);
      this.cache.delete(oldestKey);
      if (!oldest) continue;
      if (this.lastChild && isSameVNodeType(oldest, this.lastChild)) {
        delete oldest.__keepAlive;
        continue;
      }
      this.destroyCached(oldest);
    }
  }
  cleanup() {
    if (this.lastChild && this.lastChild.__keepAlive) {
      delete this.lastChild.__keepAlive;
    }
    if (this.lastKey !== void 0) this.cache.delete(this.lastKey);
    for (const cached of this.cache.values()) this.destroyCached(cached);
    this.cache.clear();
    while (this.storage.firstChild) {
      this.storage.removeChild(this.storage.firstChild);
    }
  }
  render() {
    const props = this.$props;
    this.pruneCache();
    const child = normalizeChild(props.children);
    this.lastChild = isVNode(child) ? child : null;
    this.lastKey = void 0;
    if (!isVNode(child)) return child;
    const type = child.type;
    if (!isComponent(type)) return child;
    const name = getComponentName(child);
    if (props.include != null && !matches(props.include, name)) return child;
    if (props.exclude != null && matches(props.exclude, name)) return child;
    const key = child.key != null ? child.key : type;
    this.lastKey = key;
    const cached = this.cache.get(key);
    if (cached && cached.component) {
      this.cache.delete(key);
      this.cache.set(key, cached);
      const instance = cached.component;
      updateProps(instance, child.props, cached.props);
      cached.props = child.props;
      cached.ref = child.ref;
      cached.__keepAlive = this.createMeta(key);
      this.lastChild = cached;
      return cached;
    }
    child.__keepAlive = this.createMeta(key);
    return child;
  }
};
__decorateClass$a([
  Setup
], KeepAlive.prototype, "setup", 1);
__decorateClass$a([
  BeforeUnmount
], KeepAlive.prototype, "cleanup", 1);
KeepAlive = __decorateClass$a([
  Component({ name: "KeepAlive" })
], KeepAlive);
function normalizeConfig(config) {
  if (!config) return { props: null, key: null };
  if (!("key" in config)) return { props: config, key: null };
  const { key, ...rest } = config;
  return { props: rest, key: key ?? null };
}
function jsxImpl(type, config, maybeKey) {
  const normalized = normalizeConfig(config);
  return createElement$1(type, normalized.props, maybeKey ?? normalized.key);
}
const jsx = jsxImpl;
const jsxs = jsxImpl;
function formatValue(value) {
  if (value === void 0) return "undefined";
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}
var __defProp$9 = Object.defineProperty;
var __getOwnPropDesc$9 = Object.getOwnPropertyDescriptor;
var __decorateClass$9 = (decorators, target, key, kind) => {
  var result = kind > 1 ? void 0 : kind ? __getOwnPropDesc$9(target, key) : target;
  for (var i = decorators.length - 1, decorator; i >= 0; i--)
    if (decorator = decorators[i])
      result = (kind ? decorator(target, key, result) : decorator(result)) || result;
  if (kind && result) __defProp$9(target, key, result);
  return result;
};
let ComponentDetails = class extends ActViewComponent {
  constructor() {
    super(...arguments);
    __publicField(this, "component", null);
    __publicField(this, "state", null);
  }
  render() {
    var _a2;
    const component = this.component;
    if (!component) {
      return /* @__PURE__ */ jsx("div", { class: "details empty", children: "Select a component from the tree." });
    }
    const data = this.state;
    return /* @__PURE__ */ jsxs("div", { class: "details", children: [
      /* @__PURE__ */ jsx("h2", { children: component.name || "Anonymous" }),
      /* @__PURE__ */ jsxs("div", { class: "meta", children: [
        "id ",
        component.id,
        " · app ",
        component.appId,
        " · renders",
        " ",
        component.renderCount,
        " · ",
        component.elTag || "no host",
        component.elId ? `#${component.elId}` : ""
      ] }),
      !data ? /* @__PURE__ */ jsx("div", { class: "panel-hint", children: "Loading state…" }) : /* @__PURE__ */ jsxs(Fragment, { children: [
        this.renderValueSection("Props", data.props),
        this.renderValueSection("State", data.state),
        this.renderValueSection("Computed", data.computed),
        /* @__PURE__ */ jsxs("div", { class: "section-title", children: [
          "Models (",
          ((_a2 = data.models) == null ? void 0 : _a2.length) ?? 0,
          ")"
        ] }),
        !data.models || data.models.length === 0 ? /* @__PURE__ */ jsx("div", { class: "panel-hint", children: "No @Model in this component." }) : data.models.map((model) => /* @__PURE__ */ jsxs("div", { class: "model", children: [
          /* @__PURE__ */ jsx("div", { class: "model-head", children: model.token }),
          /* @__PURE__ */ jsx("pre", { class: "value", children: formatValue({
            state: model.state,
            computed: model.computed
          }) })
        ] }, model.token))
      ] })
    ] });
  }
  renderValueSection(title, value) {
    return /* @__PURE__ */ jsxs(Fragment, { children: [
      /* @__PURE__ */ jsx("div", { class: "section-title", children: title }),
      /* @__PURE__ */ jsx("pre", { class: "value", children: formatValue(value) })
    ] });
  }
};
__decorateClass$9([
  Prop
], ComponentDetails.prototype, "component", 2);
__decorateClass$9([
  Prop
], ComponentDetails.prototype, "state", 2);
ComponentDetails = __decorateClass$9([
  Component({ name: "ComponentDetails" })
], ComponentDetails);
var __defProp$8 = Object.defineProperty;
var __getOwnPropDesc$8 = Object.getOwnPropertyDescriptor;
var __decorateClass$8 = (decorators, target, key, kind) => {
  var result = kind > 1 ? void 0 : kind ? __getOwnPropDesc$8(target, key) : target;
  for (var i = decorators.length - 1, decorator; i >= 0; i--)
    if (decorator = decorators[i])
      result = (kind ? decorator(target, key, result) : decorator(result)) || result;
  if (kind && result) __defProp$8(target, key, result);
  return result;
};
let ComponentsTab = class extends ActViewComponent {
  constructor() {
    super(...arguments);
    __publicField(this, "component", null);
    __publicField(this, "state", null);
  }
  render() {
    return /* @__PURE__ */ jsx("section", { class: "tab-panel", children: /* @__PURE__ */ jsx(ComponentDetails, { component: this.component, state: this.state }) });
  }
};
__decorateClass$8([
  Prop
], ComponentsTab.prototype, "component", 2);
__decorateClass$8([
  Prop
], ComponentsTab.prototype, "state", 2);
ComponentsTab = __decorateClass$8([
  Component({ name: "ComponentsTab" })
], ComponentsTab);
var __defProp$7 = Object.defineProperty;
var __getOwnPropDesc$7 = Object.getOwnPropertyDescriptor;
var __decorateClass$7 = (decorators, target, key, kind) => {
  var result = kind > 1 ? void 0 : kind ? __getOwnPropDesc$7(target, key) : target;
  for (var i = decorators.length - 1, decorator; i >= 0; i--)
    if (decorator = decorators[i])
      result = (kind ? decorator(target, key, result) : decorator(result)) || result;
  if (kind && result) __defProp$7(target, key, result);
  return result;
};
let EventsTab = class extends ActViewComponent {
  constructor() {
    super(...arguments);
    __publicField(this, "events", []);
  }
  render() {
    const events = this.events.slice(-200).reverse();
    return /* @__PURE__ */ jsxs("section", { class: "tab-panel", children: [
      /* @__PURE__ */ jsx("div", { class: "panel-hint", children: "Recent mount / update / track / trigger events." }),
      /* @__PURE__ */ jsx("div", { class: "table-wrap", children: events.length === 0 ? /* @__PURE__ */ jsx("div", { class: "tree-empty", children: "No events yet." }) : /* @__PURE__ */ jsxs("table", { children: [
        /* @__PURE__ */ jsx("thead", { children: /* @__PURE__ */ jsxs("tr", { children: [
          /* @__PURE__ */ jsx("th", { children: "time" }),
          /* @__PURE__ */ jsx("th", { children: "type" }),
          /* @__PURE__ */ jsx("th", { children: "component" }),
          /* @__PURE__ */ jsx("th", { children: "key" })
        ] }) }),
        /* @__PURE__ */ jsx("tbody", { children: events.map((event) => {
          var _a2;
          return /* @__PURE__ */ jsxs("tr", { children: [
            /* @__PURE__ */ jsx("td", { children: new Date(event.timestamp).toLocaleTimeString() }),
            /* @__PURE__ */ jsx("td", { class: `event-${event.type}`, children: event.type }),
            /* @__PURE__ */ jsx("td", { children: event.name || (event.componentId != null ? `#${event.componentId}` : "—") }),
            /* @__PURE__ */ jsx("td", { children: ((_a2 = event.payload) == null ? void 0 : _a2.key) == null ? "—" : String(event.payload.key) })
          ] }, event.seq);
        }) })
      ] }) })
    ] });
  }
};
__decorateClass$7([
  Prop
], EventsTab.prototype, "events", 2);
EventsTab = __decorateClass$7([
  Component({ name: "EventsTab" })
], EventsTab);
var __defProp$6 = Object.defineProperty;
var __getOwnPropDesc$6 = Object.getOwnPropertyDescriptor;
var __decorateClass$6 = (decorators, target, key, kind) => {
  var result = kind > 1 ? void 0 : kind ? __getOwnPropDesc$6(target, key) : target;
  for (var i = decorators.length - 1, decorator; i >= 0; i--)
    if (decorator = decorators[i])
      result = (kind ? decorator(target, key, result) : decorator(result)) || result;
  if (kind && result) __defProp$6(target, key, result);
  return result;
};
let PanelTabs = class extends ActViewComponent {
  constructor() {
    super(...arguments);
    __publicField(this, "tab", "components");
    __publicField(this, "paused", false);
    __publicField(this, "onSwitch", () => {
    });
    __publicField(this, "onTogglePause", () => {
    });
  }
  render() {
    return /* @__PURE__ */ jsxs("nav", { class: "tabs", children: [
      /* @__PURE__ */ jsx(
        "button",
        {
          "data-tab": "components",
          class: `tab${this.tab === "components" ? " active" : ""}`,
          onClick: () => this.onSwitch("components"),
          children: "Components"
        }
      ),
      /* @__PURE__ */ jsx(
        "button",
        {
          "data-tab": "events",
          class: `tab${this.tab === "events" ? " active" : ""}`,
          onClick: () => this.onSwitch("events"),
          children: "Events"
        }
      ),
      /* @__PURE__ */ jsx(
        "button",
        {
          "data-tab": "performance",
          class: `tab${this.tab === "performance" ? " active" : ""}`,
          onClick: () => this.onSwitch("performance"),
          children: "Performance"
        }
      ),
      /* @__PURE__ */ jsx("button", { class: "tab right", onClick: this.onTogglePause, children: this.paused ? "Resume events" : "Pause events" })
    ] });
  }
};
__decorateClass$6([
  Prop
], PanelTabs.prototype, "tab", 2);
__decorateClass$6([
  Prop
], PanelTabs.prototype, "paused", 2);
__decorateClass$6([
  Prop
], PanelTabs.prototype, "onSwitch", 2);
__decorateClass$6([
  Prop
], PanelTabs.prototype, "onTogglePause", 2);
PanelTabs = __decorateClass$6([
  Component({ name: "PanelTabs" })
], PanelTabs);
var __defProp$5 = Object.defineProperty;
var __getOwnPropDesc$5 = Object.getOwnPropertyDescriptor;
var __decorateClass$5 = (decorators, target, key, kind) => {
  var result = kind > 1 ? void 0 : kind ? __getOwnPropDesc$5(target, key) : target;
  for (var i = decorators.length - 1, decorator; i >= 0; i--)
    if (decorator = decorators[i])
      result = (kind ? decorator(target, key, result) : decorator(result)) || result;
  if (kind && result) __defProp$5(target, key, result);
  return result;
};
let PerformanceTab = class extends ActViewComponent {
  constructor() {
    super(...arguments);
    __publicField(this, "records", []);
  }
  render() {
    const records = this.records.slice().sort((a, b) => b.duration - a.duration).slice(0, 200);
    return /* @__PURE__ */ jsxs("section", { class: "tab-panel", children: [
      /* @__PURE__ */ jsx("div", { class: "panel-hint", children: "Render duration (mount / update)." }),
      /* @__PURE__ */ jsx("div", { class: "table-wrap", children: records.length === 0 ? /* @__PURE__ */ jsx("div", { class: "tree-empty", children: "No performance records. Set app.config.performance = true." }) : /* @__PURE__ */ jsxs("table", { children: [
        /* @__PURE__ */ jsx("thead", { children: /* @__PURE__ */ jsxs("tr", { children: [
          /* @__PURE__ */ jsx("th", { children: "component" }),
          /* @__PURE__ */ jsx("th", { children: "kind" }),
          /* @__PURE__ */ jsx("th", { children: "duration" }),
          /* @__PURE__ */ jsx("th", { children: "renders" })
        ] }) }),
        /* @__PURE__ */ jsx("tbody", { children: records.map((record) => /* @__PURE__ */ jsxs("tr", { children: [
          /* @__PURE__ */ jsx("td", { children: record.name || `#${record.componentId}` }),
          /* @__PURE__ */ jsx("td", { children: record.kind }),
          /* @__PURE__ */ jsxs("td", { children: [
            record.duration.toFixed(2),
            " ms"
          ] }),
          /* @__PURE__ */ jsx("td", { children: record.renderCount })
        ] }, `${record.componentId}-${record.timestamp}`)) })
      ] }) })
    ] });
  }
};
__decorateClass$5([
  Prop
], PerformanceTab.prototype, "records", 2);
PerformanceTab = __decorateClass$5([
  Component({ name: "PerformanceTab" })
], PerformanceTab);
var __defProp$4 = Object.defineProperty;
var __getOwnPropDesc$4 = Object.getOwnPropertyDescriptor;
var __decorateClass$4 = (decorators, target, key, kind) => {
  var result = kind > 1 ? void 0 : kind ? __getOwnPropDesc$4(target, key) : target;
  for (var i = decorators.length - 1, decorator; i >= 0; i--)
    if (decorator = decorators[i])
      result = (kind ? decorator(target, key, result) : decorator(result)) || result;
  if (kind && result) __defProp$4(target, key, result);
  return result;
};
let PanelContent = class extends ActViewComponent {
  constructor() {
    super(...arguments);
    __publicField(this, "tab", "components");
    __publicField(this, "paused", false);
    __publicField(this, "events", []);
    __publicField(this, "performance", []);
    __publicField(this, "component", null);
    __publicField(this, "state", null);
    __publicField(this, "onSwitch", () => {
    });
    __publicField(this, "onTogglePause", () => {
    });
  }
  render() {
    return /* @__PURE__ */ jsxs("main", { class: "main", children: [
      /* @__PURE__ */ jsx(
        PanelTabs,
        {
          tab: this.tab,
          paused: this.paused,
          onSwitch: this.onSwitch,
          onTogglePause: this.onTogglePause
        }
      ),
      this.tab === "components" ? /* @__PURE__ */ jsx(ComponentsTab, { component: this.component, state: this.state }) : null,
      this.tab === "events" ? /* @__PURE__ */ jsx(EventsTab, { events: this.events }) : null,
      this.tab === "performance" ? /* @__PURE__ */ jsx(PerformanceTab, { records: this.performance }) : null
    ] });
  }
};
__decorateClass$4([
  Prop
], PanelContent.prototype, "tab", 2);
__decorateClass$4([
  Prop
], PanelContent.prototype, "paused", 2);
__decorateClass$4([
  Prop
], PanelContent.prototype, "events", 2);
__decorateClass$4([
  Prop
], PanelContent.prototype, "performance", 2);
__decorateClass$4([
  Prop
], PanelContent.prototype, "component", 2);
__decorateClass$4([
  Prop
], PanelContent.prototype, "state", 2);
__decorateClass$4([
  Prop
], PanelContent.prototype, "onSwitch", 2);
__decorateClass$4([
  Prop
], PanelContent.prototype, "onTogglePause", 2);
PanelContent = __decorateClass$4([
  Component({ name: "PanelContent" })
], PanelContent);
var __defProp$3 = Object.defineProperty;
var __getOwnPropDesc$3 = Object.getOwnPropertyDescriptor;
var __decorateClass$3 = (decorators, target, key, kind) => {
  var result = kind > 1 ? void 0 : kind ? __getOwnPropDesc$3(target, key) : target;
  for (var i = decorators.length - 1, decorator; i >= 0; i--)
    if (decorator = decorators[i])
      result = (kind ? decorator(target, key, result) : decorator(result)) || result;
  if (kind && result) __defProp$3(target, key, result);
  return result;
};
let PanelHead = class extends ActViewComponent {
  constructor() {
    super(...arguments);
    __publicField(this, "apps", []);
    __publicField(this, "appId", null);
    __publicField(this, "connected", false);
    __publicField(this, "contentReady", false);
    __publicField(this, "statusHint", "");
    __publicField(this, "onAppChange", () => {
    });
    __publicField(this, "onRefresh", () => {
    });
    __publicField(this, "onPick", () => {
    });
  }
  render() {
    return /* @__PURE__ */ jsxs("header", { class: "topbar", children: [
      /* @__PURE__ */ jsxs("div", { class: "brand", children: [
        "ActView ",
        /* @__PURE__ */ jsx("span", { children: "DevTools" })
      ] }),
      /* @__PURE__ */ jsx("div", { class: this.statusClass(), children: this.statusText() }),
      /* @__PURE__ */ jsxs("div", { class: "topbar-actions", children: [
        /* @__PURE__ */ jsx(
          "select",
          {
            title: "Application",
            value: this.appId == null ? "" : String(this.appId),
            onChange: (event) => this.handleAppChange(event),
            children: this.apps.length === 0 ? /* @__PURE__ */ jsx("option", { value: "", children: "no app" }) : this.apps.map((app) => /* @__PURE__ */ jsx("option", { value: String(app.id), children: app.name || `App ${app.id}` }, app.id))
          }
        ),
        /* @__PURE__ */ jsx("button", { class: "btn", onClick: this.onRefresh, children: "Refresh" }),
        /* @__PURE__ */ jsx("button", { class: "btn", onClick: this.onPick, children: "Pick element" })
      ] })
    ] });
  }
  handleAppChange(event) {
    const value = Number(event.target.value);
    this.onAppChange(Number.isFinite(value) ? value : null);
  }
  statusText() {
    if (this.statusHint) return this.statusHint;
    if (this.connected) return "connected";
    if (this.contentReady) {
      return "extension injected; waiting for @actview/devtools";
    }
    return "no content script; reload the extension and page";
  }
  statusClass() {
    if (this.connected) return "status connected";
    if (this.contentReady) return "status";
    return "status disconnected";
  }
};
__decorateClass$3([
  Prop
], PanelHead.prototype, "apps", 2);
__decorateClass$3([
  Prop
], PanelHead.prototype, "appId", 2);
__decorateClass$3([
  Prop
], PanelHead.prototype, "connected", 2);
__decorateClass$3([
  Prop
], PanelHead.prototype, "contentReady", 2);
__decorateClass$3([
  Prop
], PanelHead.prototype, "statusHint", 2);
__decorateClass$3([
  Prop
], PanelHead.prototype, "onAppChange", 2);
__decorateClass$3([
  Prop
], PanelHead.prototype, "onRefresh", 2);
__decorateClass$3([
  Prop
], PanelHead.prototype, "onPick", 2);
PanelHead = __decorateClass$3([
  Component({ name: "PanelHead" })
], PanelHead);
var __defProp$2 = Object.defineProperty;
var __getOwnPropDesc$2 = Object.getOwnPropertyDescriptor;
var __decorateClass$2 = (decorators, target, key, kind) => {
  var result = kind > 1 ? void 0 : kind ? __getOwnPropDesc$2(target, key) : target;
  for (var i = decorators.length - 1, decorator; i >= 0; i--)
    if (decorator = decorators[i])
      result = (kind ? decorator(target, key, result) : decorator(result)) || result;
  if (kind && result) __defProp$2(target, key, result);
  return result;
};
let ComponentTree = class extends ActViewComponent {
  constructor() {
    super(...arguments);
    __publicField(this, "components", []);
    __publicField(this, "appId", null);
    __publicField(this, "selectedId", null);
    __publicField(this, "connected", false);
    __publicField(this, "onComponentSelect", () => {
    });
  }
  render() {
    const components = this.appId == null ? [] : this.components.filter((component) => component.appId === this.appId);
    if (components.length === 0) {
      return /* @__PURE__ */ jsx("div", { class: "tree-empty", children: this.connected ? "No components captured." : "Waiting for @actview/devtools…" });
    }
    const ids = new Set(components.map((component) => component.id));
    const roots = components.filter(
      (component) => component.parentId == null || !ids.has(component.parentId)
    );
    const rendered = /* @__PURE__ */ new Set();
    const walk = (component, depth) => {
      if (rendered.has(component.id)) return [];
      rendered.add(component.id);
      const children = components.filter(
        (child) => child.parentId === component.id
      );
      const row = /* @__PURE__ */ jsxs(
        "div",
        {
          class: `tree-node${component.id === this.selectedId ? " selected" : ""}`,
          style: { paddingLeft: `${10 + depth * 14}px` },
          onClick: () => this.onComponentSelect(component.id),
          children: [
            /* @__PURE__ */ jsx("span", { class: "caret", children: children.length > 0 ? "▾" : "·" }),
            /* @__PURE__ */ jsx("span", { class: "name", children: component.name || "Anonymous" }),
            /* @__PURE__ */ jsx("span", { class: "badge", title: "render count", children: component.renderCount ?? 0 })
          ]
        },
        component.id
      );
      return [row, ...children.flatMap((child) => walk(child, depth + 1))];
    };
    return /* @__PURE__ */ jsx(Fragment, { children: roots.flatMap((root) => walk(root, 0)) });
  }
};
__decorateClass$2([
  Prop
], ComponentTree.prototype, "components", 2);
__decorateClass$2([
  Prop
], ComponentTree.prototype, "appId", 2);
__decorateClass$2([
  Prop
], ComponentTree.prototype, "selectedId", 2);
__decorateClass$2([
  Prop
], ComponentTree.prototype, "connected", 2);
__decorateClass$2([
  Prop
], ComponentTree.prototype, "onComponentSelect", 2);
ComponentTree = __decorateClass$2([
  Component({ name: "ComponentTree" })
], ComponentTree);
var __defProp$1 = Object.defineProperty;
var __getOwnPropDesc$1 = Object.getOwnPropertyDescriptor;
var __decorateClass$1 = (decorators, target, key, kind) => {
  var result = kind > 1 ? void 0 : kind ? __getOwnPropDesc$1(target, key) : target;
  for (var i = decorators.length - 1, decorator; i >= 0; i--)
    if (decorator = decorators[i])
      result = (kind ? decorator(target, key, result) : decorator(result)) || result;
  if (kind && result) __defProp$1(target, key, result);
  return result;
};
let PanelSidebar = class extends ActViewComponent {
  constructor() {
    super(...arguments);
    __publicField(this, "components", []);
    __publicField(this, "appId", null);
    __publicField(this, "selectedId", null);
    __publicField(this, "connected", false);
    __publicField(this, "onComponentSelect", () => {
    });
    __publicField(this, "onClearHighlight", () => {
    });
  }
  render() {
    return /* @__PURE__ */ jsxs("aside", { class: "sidebar", children: [
      /* @__PURE__ */ jsxs("div", { class: "sidebar-title", children: [
        "Components",
        /* @__PURE__ */ jsx("button", { class: "link", onClick: this.onClearHighlight, children: "clear highlight" })
      ] }),
      /* @__PURE__ */ jsx("div", { class: "tree", children: /* @__PURE__ */ jsx(
        ComponentTree,
        {
          components: this.components,
          appId: this.appId,
          selectedId: this.selectedId,
          connected: this.connected,
          onComponentSelect: this.onComponentSelect
        }
      ) })
    ] });
  }
};
__decorateClass$1([
  Prop
], PanelSidebar.prototype, "components", 2);
__decorateClass$1([
  Prop
], PanelSidebar.prototype, "appId", 2);
__decorateClass$1([
  Prop
], PanelSidebar.prototype, "selectedId", 2);
__decorateClass$1([
  Prop
], PanelSidebar.prototype, "connected", 2);
__decorateClass$1([
  Prop
], PanelSidebar.prototype, "onComponentSelect", 2);
__decorateClass$1([
  Prop
], PanelSidebar.prototype, "onClearHighlight", 2);
PanelSidebar = __decorateClass$1([
  Component({ name: "PanelSidebar" })
], PanelSidebar);
var __defProp2 = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __decorateClass = (decorators, target, key, kind) => {
  var result = kind > 1 ? void 0 : kind ? __getOwnPropDesc(target, key) : target;
  for (var i = decorators.length - 1, decorator; i >= 0; i--)
    if (decorator = decorators[i])
      result = (kind ? decorator(target, key, result) : decorator(result)) || result;
  if (kind && result) __defProp2(target, key, result);
  return result;
};
const PAGE_SOURCE = "actview-devtools-page";
const PANEL_SOURCE = "actview-devtools-panel";
let DevtoolsPanel = class extends ActViewComponent {
  constructor() {
    super(...arguments);
    __publicField(this, "connected", false);
    __publicField(this, "contentReady", false);
    __publicField(this, "statusHint", "");
    __publicField(this, "apps", []);
    __publicField(this, "components", []);
    __publicField(this, "events", []);
    __publicField(this, "performance", []);
    __publicField(this, "appId", null);
    __publicField(this, "selectedId", null);
    __publicField(this, "selectedState", null);
    __publicField(this, "tab", "components");
    __publicField(this, "paused", false);
    __publicField(this, "tabId", chrome.devtools.inspectedWindow.tabId);
    __publicField(this, "reconnectTimer", null);
    __publicField(this, "onRuntimeMessage", (message, sender) => {
      var _a2, _b2;
      if (!message || message.source !== PAGE_SOURCE) return;
      if (sender.tab && sender.tab.id !== this.tabId) return;
      switch (message.type) {
        case "content-ready":
          this.contentReady = true;
          this.statusHint = "";
          break;
        case "snapshot":
          this.applySnapshot(message.payload || {});
          break;
        case "state":
          if (((_a2 = message.payload) == null ? void 0 : _a2.id) === this.selectedId) {
            this.selectedState = message.payload.state;
          }
          break;
        case "picked":
          if (((_b2 = message.payload) == null ? void 0 : _b2.id) != null) {
            this.connected = true;
            this.selectedId = message.payload.id;
            this.selectedState = null;
            this.tab = "components";
            this.requestState();
          }
          break;
        case "picker-started":
          this.statusHint = "pick an element (Esc to cancel)";
          break;
        case "picker-empty":
          this.statusHint = "no ActView component found";
          break;
        case "picker-cancelled":
          this.statusHint = "";
          break;
      }
    });
    __publicField(this, "onBeforeUnload", () => {
      this.send("clearHighlight");
      this.send("stopPicker");
    });
  }
  setup() {
    chrome.runtime.onMessage.addListener(this.onRuntimeMessage);
    window.addEventListener("beforeunload", this.onBeforeUnload);
    this.send("connect");
    this.reconnectTimer = setInterval(() => {
      if (!this.connected) this.send("connect");
    }, 2e3);
  }
  unmounted() {
    chrome.runtime.onMessage.removeListener(this.onRuntimeMessage);
    window.removeEventListener("beforeunload", this.onBeforeUnload);
    if (this.reconnectTimer) clearInterval(this.reconnectTimer);
    this.reconnectTimer = null;
  }
  send(type, payload) {
    chrome.tabs.sendMessage(
      this.tabId,
      { source: PANEL_SOURCE, type, payload },
      () => {
        if (chrome.runtime.lastError) {
          this.connected = false;
          this.contentReady = false;
        }
      }
    );
  }
  applySnapshot(payload) {
    var _a2;
    this.connected = true;
    this.contentReady = true;
    this.statusHint = "";
    this.apps = Array.isArray(payload.apps) ? payload.apps : [];
    this.components = Array.isArray(payload.components) ? payload.components : [];
    this.performance = Array.isArray(payload.performance) ? payload.performance : [];
    if (!this.paused) {
      this.events = Array.isArray(payload.events) ? payload.events : [];
    }
    if (this.appId == null && this.apps.length > 0) {
      this.appId = this.apps[0].id;
    }
    if (this.appId != null && !this.apps.some((app) => app.id === this.appId)) {
      this.appId = ((_a2 = this.apps[0]) == null ? void 0 : _a2.id) ?? null;
    }
    if (this.selectedId != null && !this.components.some((component) => component.id === this.selectedId)) {
      this.selectedId = null;
      this.selectedState = null;
      this.send("clearHighlight");
    }
    if (this.selectedId != null) this.requestState();
  }
  requestState() {
    if (this.selectedId == null) return;
    this.send("getState", { id: this.selectedId });
  }
  handleAppChange(id) {
    this.appId = id;
    this.selectedId = null;
    this.selectedState = null;
    this.send("clearHighlight");
  }
  handleSelect(id) {
    this.selectedId = id;
    this.selectedState = null;
    this.tab = "components";
    this.requestState();
    this.send("highlight", { id });
  }
  render() {
    const component = this.components.find(
      (item) => item.id === this.selectedId
    );
    return /* @__PURE__ */ jsxs("div", { class: "app-shell", children: [
      /* @__PURE__ */ jsx(
        PanelHead,
        {
          apps: this.apps,
          appId: this.appId,
          connected: this.connected,
          contentReady: this.contentReady,
          statusHint: this.statusHint,
          onAppChange: (id) => this.handleAppChange(id),
          onRefresh: () => this.send("refresh"),
          onPick: () => this.send("startPicker")
        }
      ),
      /* @__PURE__ */ jsxs("div", { class: "layout", children: [
        /* @__PURE__ */ jsx(
          PanelSidebar,
          {
            components: this.components,
            appId: this.appId,
            selectedId: this.selectedId,
            connected: this.connected,
            onComponentSelect: (id) => this.handleSelect(id),
            onClearHighlight: () => this.send("clearHighlight")
          }
        ),
        /* @__PURE__ */ jsx(
          PanelContent,
          {
            tab: this.tab,
            paused: this.paused,
            events: this.events,
            performance: this.performance,
            component: component ?? null,
            state: this.selectedState,
            onSwitch: (tab) => this.tab = tab,
            onTogglePause: () => this.paused = !this.paused
          }
        )
      ] })
    ] });
  }
};
__decorateClass([
  Ref
], DevtoolsPanel.prototype, "connected", 2);
__decorateClass([
  Ref
], DevtoolsPanel.prototype, "contentReady", 2);
__decorateClass([
  Ref
], DevtoolsPanel.prototype, "statusHint", 2);
__decorateClass([
  Ref
], DevtoolsPanel.prototype, "apps", 2);
__decorateClass([
  Ref
], DevtoolsPanel.prototype, "components", 2);
__decorateClass([
  Ref
], DevtoolsPanel.prototype, "events", 2);
__decorateClass([
  Ref
], DevtoolsPanel.prototype, "performance", 2);
__decorateClass([
  Ref
], DevtoolsPanel.prototype, "appId", 2);
__decorateClass([
  Ref
], DevtoolsPanel.prototype, "selectedId", 2);
__decorateClass([
  Ref
], DevtoolsPanel.prototype, "selectedState", 2);
__decorateClass([
  Ref
], DevtoolsPanel.prototype, "tab", 2);
__decorateClass([
  Ref
], DevtoolsPanel.prototype, "paused", 2);
__decorateClass([
  Setup
], DevtoolsPanel.prototype, "setup", 1);
__decorateClass([
  Unmounted
], DevtoolsPanel.prototype, "unmounted", 1);
DevtoolsPanel = __decorateClass([
  Component({ name: "DevtoolsPanel" })
], DevtoolsPanel);
createApp(DevtoolsPanel).mount("#app");
