/**
 * Standalone JSX Factory
 *
 * Adapted from React's ReactJSXElement (React 19).
 *
 * A dependency-free JSX factory that can be used as the runtime import for
 * the automatic JSX transform (jsx, jsxs, jsxDEV) or the classic transform
 * (createElement).
 *
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * Usage:
 *   // Configure at app startup (BEFORE any JSX calls):
 *   import { initJsxFactory } from './jsxFactory.js';
 *   initJsxFactory({ devMode: true });
 *
 *   // Automatic JSX transform (configure in tsconfig / Babel):
 *   { "jsxImportSource": "your-framework" }  // → imports jsx, jsxs, jsxDEV
 *
 *   // Classic createElement:
 *   import { createElement } from './jsxFactory.js';
 */

// =============================================================================
// Configuration (set via initJsxFactory() before first use)
// =============================================================================

/** @type {boolean} */
let __DEV__ = false;

/** @type {boolean} */
let enableOptimisticKey = false;

/** @type {boolean} */
let enableViewTransition = true;

/** @type {boolean} */
let enableTransitionTracing = false;

/** @type {{ getOwner?: () => any, recentlyCreatedOwnerStacks?: number }} */
let dispatcher = {
  getOwner: () => null,
  recentlyCreatedOwnerStacks: 0,
};

/**
 * Initialize the JSX factory. Call this once at app startup before any
 * JSX calls. This is the only way to reliably set DEV mode and other flags.
 */
export function initJsxFactory(options) {
  if (options) {
    __DEV__ = !!options.devMode;
    enableOptimisticKey = !!options.enableOptimisticKey;
    if (options.enableViewTransition !== undefined) {
      enableViewTransition = !!options.enableViewTransition;
    }
    if (options.enableTransitionTracing !== undefined) {
      enableTransitionTracing = !!options.enableTransitionTracing;
    }
    if (options.dispatcher) {
      dispatcher = options.dispatcher;
    }
  }
  // Lazily initialize DEV-only globals if we're in DEV mode now.
  if (__DEV__) {
    initDevGlobals();
  }
}

export function setDispatcher(d) {
  dispatcher = d;
}

export function getDispatcher() {
  return dispatcher;
}

// =============================================================================
// ReactSymbols — Symbol.for keys for React element types
// =============================================================================

const REACT_ELEMENT_TYPE = Symbol.for('react.transitional.element');
const REACT_FRAGMENT_TYPE = Symbol.for('react.fragment');
const REACT_LAZY_TYPE = Symbol.for('react.lazy');
const REACT_OPTIMISTIC_KEY = Symbol.for('react.optimistic_key');

// Additional symbols used by getComponentNameFromType
const REACT_PORTAL_TYPE = Symbol.for('react.portal');
const REACT_CONTEXT_TYPE = Symbol.for('react.context');
const REACT_CONSUMER_TYPE = Symbol.for('react.consumer');
const REACT_FORWARD_REF_TYPE = Symbol.for('react.forward_ref');
const REACT_MEMO_TYPE = Symbol.for('react.memo');
const REACT_PROFILER_TYPE = Symbol.for('react.profiler');
const REACT_STRICT_MODE_TYPE = Symbol.for('react.strict_mode');
const REACT_SUSPENSE_TYPE = Symbol.for('react.suspense');
const REACT_SUSPENSE_LIST_TYPE = Symbol.for('react.suspense_list');
const REACT_TRACING_MARKER_TYPE = Symbol.for('react.tracing_marker');
const REACT_VIEW_TRANSITION_TYPE = Symbol.for('react.view_transition');
const REACT_ACTIVITY_TYPE = Symbol.for('react.activity');
const REACT_CLIENT_REFERENCE = Symbol.for('react.client.reference');

// =============================================================================
// Shared utilities
// =============================================================================

const hasOwnProperty = Object.prototype.hasOwnProperty;
const assign = Object.assign;
const isArray = Array.isArray;

/**
 * DEV-only: check that a value being coerced to string won't throw.
 * In production this is a no-op.
 */
function checkKeyStringCoercion(value) {
  if (__DEV__) {
    if (willCoercionThrow(value)) {
      console.error(
        'The provided key is an unsupported type %s.' +
          ' This value must be coerced to a string before using it here.',
        typeName(value),
      );
      // throw to help callers find troubleshooting comments
      testStringCoercion(value);
    }
  }
}

function typeName(value) {
  if (__DEV__) {
    const hasToStringTag = typeof Symbol === 'function' && Symbol.toStringTag;
    const type =
      (hasToStringTag && value[Symbol.toStringTag]) ||
      value.constructor.name ||
      'Object';
    return type;
  }
}

function willCoercionThrow(value) {
  if (__DEV__) {
    try {
      testStringCoercion(value);
      return false;
    } catch (e) {
      return true;
    }
  }
}

/** @noinline */
function testStringCoercion(value) {
  if (__DEV__) {
    return '' + value;
  }
}

// =============================================================================
// getComponentNameFromType — adapted from React
// =============================================================================

function getWrappedName(outerType, innerType, wrapperName) {
  const displayName = outerType.displayName;
  if (displayName) {
    return displayName;
  }
  const functionName = innerType.displayName || innerType.name || '';
  return functionName !== ''
    ? wrapperName + '(' + functionName + ')'
    : wrapperName;
}

function getContextName(type) {
  return type.displayName || 'Context';
}

export function getComponentNameFromType(type) {
  if (type == null) {
    return null;
  }
  if (typeof type === 'function') {
    if (type.$$typeof === REACT_CLIENT_REFERENCE) {
      return null;
    }
    return type.displayName || type.name || null;
  }
  if (typeof type === 'string') {
    return type;
  }
  switch (type) {
    case REACT_FRAGMENT_TYPE:
      return 'Fragment';
    case REACT_PROFILER_TYPE:
      return 'Profiler';
    case REACT_STRICT_MODE_TYPE:
      return 'StrictMode';
    case REACT_SUSPENSE_TYPE:
      return 'Suspense';
    case REACT_SUSPENSE_LIST_TYPE:
      return 'SuspenseList';
    case REACT_ACTIVITY_TYPE:
      return 'Activity';
    case REACT_VIEW_TRANSITION_TYPE:
      if (enableViewTransition) {
        return 'ViewTransition';
      }
    // Fall through
    case REACT_TRACING_MARKER_TYPE:
      if (enableTransitionTracing) {
        return 'TracingMarker';
      }
  }
  if (typeof type === 'object') {
    switch (type.$$typeof) {
      case REACT_PORTAL_TYPE:
        return 'Portal';
      case REACT_CONTEXT_TYPE:
        return getContextName(type);
      case REACT_CONSUMER_TYPE:
        return getContextName(type._context) + '.Consumer';
      case REACT_FORWARD_REF_TYPE:
        return getWrappedName(type, type.render, 'ForwardRef');
      case REACT_MEMO_TYPE: {
        const outerName = type.displayName || null;
        if (outerName !== null) {
          return outerName;
        }
        return getComponentNameFromType(type.type) || 'Memo';
      }
      case REACT_LAZY_TYPE: {
        const payload = type._payload;
        const init = type._init;
        try {
          return getComponentNameFromType(init(payload));
        } catch (x) {
          return null;
        }
      }
    }
  }
  return null;
}

// =============================================================================
// Owner / Debug utilities (DEV only)
// =============================================================================

const createTask =
  typeof console !== 'undefined' && console.createTask
    ? console.createTask
    : () => null;

function getTaskName(type) {
  if (type === REACT_FRAGMENT_TYPE) {
    return '<>';
  }
  if (typeof type === 'object' && type !== null && type.$$typeof === REACT_LAZY_TYPE) {
    return '<...>';
  }
  try {
    const name = getComponentNameFromType(type);
    return name ? '<' + name + '>' : '<...>';
  } catch (x) {
    return '<...>';
  }
}

function getOwner() {
  if (__DEV__) {
    if (dispatcher === null) {
      return null;
    }
    return dispatcher.getOwner ? dispatcher.getOwner() : null;
  }
  return null;
}

const ownerStackTraceLimit = 10;

/** @noinline */
function UnknownOwner() {
  return (() => Error('react-stack-top-frame'))();
}

const createFakeCallStack = {
  react_stack_bottom_frame: function (callStackForError) {
    return callStackForError();
  },
};

let _devInitialized = false;
let specialPropKeyWarningShown;
let didWarnAboutElementRef;
let didWarnAboutOldJSXRuntime;
let unknownOwnerDebugStack;
let unknownOwnerDebugTask;

/**
 * Lazily initialize DEV-only globals. Safe to call multiple times.
 * Must only be called when __DEV__ is true.
 */
function initDevGlobals() {
  if (_devInitialized) return;
  _devInitialized = true;

  didWarnAboutElementRef = {};
  unknownOwnerDebugStack = createFakeCallStack.react_stack_bottom_frame.bind(
    createFakeCallStack,
    UnknownOwner,
  )();
  unknownOwnerDebugTask = createTask(getTaskName(UnknownOwner));
}

function hasValidRef(config) {
  if (__DEV__) {
    if (hasOwnProperty.call(config, 'ref')) {
      const getter = Object.getOwnPropertyDescriptor(config, 'ref').get;
      if (getter && getter.isReactWarning) {
        return false;
      }
    }
  }
  return config.ref !== undefined;
}

function hasValidKey(config) {
  if (__DEV__) {
    if (hasOwnProperty.call(config, 'key')) {
      const getter = Object.getOwnPropertyDescriptor(config, 'key').get;
      if (getter && getter.isReactWarning) {
        return false;
      }
    }
  }
  return config.key !== undefined;
}

function defineKeyPropWarningGetter(props, displayName) {
  if (__DEV__) {
    const warnAboutAccessingKey = function () {
      if (!specialPropKeyWarningShown) {
        specialPropKeyWarningShown = true;
        console.error(
          '%s: `key` is not a prop. Trying to access it will result ' +
            'in `undefined` being returned. If you need to access the same ' +
            'value within the child component, you should pass it as a different ' +
            'prop. (https://react.dev/link/special-props)',
          displayName,
        );
      }
    };
    warnAboutAccessingKey.isReactWarning = true;
    Object.defineProperty(props, 'key', {
      get: warnAboutAccessingKey,
      configurable: true,
    });
  }
}

function elementRefGetterWithDeprecationWarning() {
  if (__DEV__) {
    const componentName = getComponentNameFromType(this.type);
    if (!didWarnAboutElementRef[componentName]) {
      didWarnAboutElementRef[componentName] = true;
      console.error(
        'Accessing element.ref was removed in React 19. ref is now a ' +
          'regular prop. It will be removed from the JSX Element ' +
          'type in a future release.',
      );
    }
    const refProp = this.props.ref;
    return refProp !== undefined ? refProp : null;
  }
}

// =============================================================================
// Core: ReactElement
// =============================================================================

/**
 * Factory method to create a new React element.
 * @internal
 */
function ReactElement(type, key, props, owner, debugStack, debugTask) {
  const refProp = props.ref;
  const ref = refProp !== undefined ? refProp : null;

  let element;
  if (__DEV__) {
    element = {
      $$typeof: REACT_ELEMENT_TYPE,
      type,
      key,
      props,
      _owner: owner,
    };
    if (ref !== null) {
      Object.defineProperty(element, 'ref', {
        enumerable: false,
        get: elementRefGetterWithDeprecationWarning,
      });
    } else {
      Object.defineProperty(element, 'ref', {
        enumerable: false,
        value: null,
      });
    }
  } else {
    element = {
      $$typeof: REACT_ELEMENT_TYPE,
      type,
      key,
      ref,
      props,
    };
  }

  if (__DEV__) {
    element._store = {};
    Object.defineProperty(element._store, 'validated', {
      configurable: false,
      enumerable: false,
      writable: true,
      value: 0,
    });
    Object.defineProperty(element, '_debugInfo', {
      configurable: false,
      enumerable: false,
      writable: true,
      value: null,
    });
    Object.defineProperty(element, '_debugStack', {
      configurable: false,
      enumerable: false,
      writable: true,
      value: debugStack,
    });
    Object.defineProperty(element, '_debugTask', {
      configurable: false,
      enumerable: false,
      writable: true,
      value: debugTask,
    });
    if (Object.freeze) {
      Object.freeze(element.props);
      Object.freeze(element);
    }
  }

  return element;
}

// ── Lazy VNode marker & helpers ──
const LAZY_VNODE = Symbol('lazy.vnode');
const resolveChild = c => c?.[LAZY_VNODE] ? c() : c;

// =============================================================================
// JSX Runtime API (automatic transform target)
// =============================================================================

/**
 * Production JSX factory — also used in DEV for the hot path.
 * Signature matches what the automatic JSX transform calls.
 */
export function jsx(type, config, maybeKey) {
  let key = null;

  if (maybeKey !== undefined) {
    if (enableOptimisticKey && maybeKey === REACT_OPTIMISTIC_KEY) {
      key = REACT_OPTIMISTIC_KEY;
    } else {
      if (__DEV__) {
        checkKeyStringCoercion(maybeKey);
      }
      key = '' + maybeKey;
    }
  }

  if (hasValidKey(config)) {
    if (enableOptimisticKey && maybeKey === REACT_OPTIMISTIC_KEY) {
      key = REACT_OPTIMISTIC_KEY;
    } else {
      if (__DEV__) {
        checkKeyStringCoercion(config.key);
      }
      key = '' + config.key;
    }
  }

  let props;
  if (!('key' in config)) {
    props = config;
  } else {
    props = {};
    for (const propName in config) {
      if (propName !== 'key') {
        props[propName] = config[propName];
      }
    }
  }

  // Resolve lazy children
  if (props) {
    if (Array.isArray(props.children)) {
      props.children = props.children.map(c => resolveChild(c));
    } else {
      props.children = resolveChild(props.children);
    }
  }

  const _el = ReactElement(type, key, props, getOwner(), undefined, undefined);
  const lazy = () => _el;
  lazy[LAZY_VNODE] = true;
  return lazy;
}

/**
 * Alias for the dynamic-children variant (jsxs).
 * In the original code, `jsxs` is `jsxProdSignatureRunningInDevWithStaticChildren`
 * or just `jsxProd` — here `jsxs` is identical to `jsx` except in DEV mode
 * where it validates that children are in an array.
 */
export function jsxs(type, config, maybeKey) {
  // In production, jsxs is identical to jsx.
  if (__DEV__) {
    const isStaticChildren = true;
    return jsxDEVImpl(
      type,
      config,
      maybeKey,
      isStaticChildren,
      getDebugStack(),
      __DEV__ ? createTask(getTaskName(type)) : undefined,
    );
  }
  return jsx(type, config, maybeKey);
}

// --- DEV-only helpers ---

export function jsxProdSignatureRunningInDevWithDynamicChildren(type, config, maybeKey) {
  if (__DEV__) {
    const isStaticChildren = false;
    const trackActualOwner =
      __DEV__ && dispatcher.recentlyCreatedOwnerStacks++ < 1e4;
    let debugStackDEV = false;
    if (__DEV__) {
      if (trackActualOwner) {
        const previousStackTraceLimit = Error.stackTraceLimit;
        Error.stackTraceLimit = ownerStackTraceLimit;
        debugStackDEV = Error('react-stack-top-frame');
        Error.stackTraceLimit = previousStackTraceLimit;
      } else {
        debugStackDEV = unknownOwnerDebugStack;
      }
    }
    return jsxDEVImpl(
      type,
      config,
      maybeKey,
      isStaticChildren,
      debugStackDEV,
      __DEV__ &&
        (trackActualOwner
          ? createTask(getTaskName(type))
          : unknownOwnerDebugTask),
    );
  }
}

export function jsxProdSignatureRunningInDevWithStaticChildren(type, config, maybeKey) {
  if (__DEV__) {
    const isStaticChildren = true;
    const trackActualOwner =
      __DEV__ && dispatcher.recentlyCreatedOwnerStacks++ < 1e4;
    let debugStackDEV = false;
    if (__DEV__) {
      if (trackActualOwner) {
        const previousStackTraceLimit = Error.stackTraceLimit;
        Error.stackTraceLimit = ownerStackTraceLimit;
        debugStackDEV = Error('react-stack-top-frame');
        Error.stackTraceLimit = previousStackTraceLimit;
      } else {
        debugStackDEV = unknownOwnerDebugStack;
      }
    }
    return jsxDEVImpl(
      type,
      config,
      maybeKey,
      isStaticChildren,
      debugStackDEV,
      __DEV__ &&
        (trackActualOwner
          ? createTask(getTaskName(type))
          : unknownOwnerDebugTask),
    );
  }
}

/**
 * Development-only JSX factory entry point.
 */
export function jsxDEV(type, config, maybeKey, isStaticChildren) {
  const trackActualOwner =
    __DEV__ && dispatcher.recentlyCreatedOwnerStacks++ < 1e4;
  let debugStackDEV = false;
  if (__DEV__) {
    if (trackActualOwner) {
      const previousStackTraceLimit = Error.stackTraceLimit;
      Error.stackTraceLimit = ownerStackTraceLimit;
      debugStackDEV = Error('react-stack-top-frame');
      Error.stackTraceLimit = previousStackTraceLimit;
    } else {
      debugStackDEV = unknownOwnerDebugStack;
    }
  }
  return jsxDEVImpl(
    type,
    config,
    maybeKey,
    isStaticChildren,
    debugStackDEV,
    __DEV__ &&
      (trackActualOwner
        ? createTask(getTaskName(type))
        : unknownOwnerDebugTask),
  );
}

// --- Internal DEV implementation ---

const didWarnAboutKeySpread = {};

function getDebugStack() {
  const trackActualOwner =
    __DEV__ && dispatcher.recentlyCreatedOwnerStacks++ < 1e4;
  if (__DEV__) {
    if (trackActualOwner) {
      const previousStackTraceLimit = Error.stackTraceLimit;
      Error.stackTraceLimit = ownerStackTraceLimit;
      const stack = Error('react-stack-top-frame');
      Error.stackTraceLimit = previousStackTraceLimit;
      return stack;
    } else {
      return unknownOwnerDebugStack;
    }
  }
}

function jsxDEVImpl(type, config, maybeKey, isStaticChildren, debugStack, debugTask) {
  // ── DEV validation ──
  if (__DEV__) {
    const children = config.children;
    if (children !== undefined) {
      if (isStaticChildren) {
        if (isArray(children)) {
          for (let i = 0; i < children.length; i++) {
            validateChildKeys(children[i]);
          }
          if (Object.freeze) {
            Object.freeze(children);
          }
        } else {
          console.error(
            'React.jsx: Static children should always be an array. ' +
              'You are likely explicitly calling React.jsxs or React.jsxDEV. ' +
              'Use the Babel transform instead.',
          );
        }
      } else {
        validateChildKeys(children);
      }
    }

    // Warn about key spread
    if (hasOwnProperty.call(config, 'key')) {
      const componentName = getComponentNameFromType(type);
      const keys = Object.keys(config).filter(k => k !== 'key');
      const beforeExample =
        keys.length > 0
          ? '{key: someKey, ' + keys.join(': ..., ') + ': ...}'
          : '{key: someKey}';
      if (!didWarnAboutKeySpread[componentName + beforeExample]) {
        const afterExample =
          keys.length > 0 ? '{' + keys.join(': ..., ') + ': ...}' : '{}';
        console.error(
          'A props object containing a "key" prop is being spread into JSX:\n' +
            '  let props = %s;\n' +
            '  <%s {...props} />\n' +
            'React keys must be passed directly to JSX without using spread:\n' +
            '  let props = %s;\n' +
            '  <%s key={someKey} {...props} />',
          beforeExample,
          componentName,
          afterExample,
          componentName,
        );
        didWarnAboutKeySpread[componentName + beforeExample] = true;
      }
    }
  }

  // ── Core element creation (always runs) ──
  let key = null;

  if (maybeKey !== undefined) {
    if (enableOptimisticKey && maybeKey === REACT_OPTIMISTIC_KEY) {
      key = REACT_OPTIMISTIC_KEY;
    } else {
      if (__DEV__) {
        checkKeyStringCoercion(maybeKey);
      }
      key = '' + maybeKey;
    }
  }

  if (hasValidKey(config)) {
    if (enableOptimisticKey && config.key === REACT_OPTIMISTIC_KEY) {
      key = REACT_OPTIMISTIC_KEY;
    } else {
      if (__DEV__) {
        checkKeyStringCoercion(config.key);
      }
      key = '' + config.key;
    }
  }

  let props;
  if (!('key' in config)) {
    props = config;
  } else {
    props = {};
    for (const propName in config) {
      if (propName !== 'key') {
        props[propName] = config[propName];
      }
    }
  }

  // Resolve lazy children
  if (props) {
    if (Array.isArray(props.children)) {
      props.children = props.children.map(c => resolveChild(c));
    } else {
      props.children = resolveChild(props.children);
    }
  }

  if (__DEV__ && key) {
    const displayName =
      typeof type === 'function'
        ? type.displayName || type.name || 'Unknown'
        : type;
    defineKeyPropWarningGetter(props, displayName);
  }

  const _el = ReactElement(type, key, props, getOwner(), debugStack, debugTask);
  const lazy = () => _el;
  lazy[LAZY_VNODE] = true;
  return lazy;
}

// =============================================================================
// Classic API: createElement / cloneElement
// =============================================================================

/**
 * Create and return a new ReactElement of the given type.
 * See https://reactjs.org/docs/react-api.html#createelement
 */
export function createElement(type, config, children) {
  if (__DEV__) {
    for (let i = 2; i < arguments.length; i++) {
      validateChildKeys(arguments[i]);
    }
  }

  let propName;
  const props = {};
  let key = null;

  if (config != null) {
    if (__DEV__) {
      if (
        !didWarnAboutOldJSXRuntime &&
        '__self' in config &&
        !('key' in config)
      ) {
        didWarnAboutOldJSXRuntime = true;
        console.warn(
          'Your app (or one of its dependencies) is using an outdated JSX ' +
            'transform. Update to the modern JSX transform for ' +
            'faster performance: https://react.dev/link/new-jsx-transform',
        );
      }
    }

    if (hasValidKey(config)) {
      if (enableOptimisticKey && config.key === REACT_OPTIMISTIC_KEY) {
        key = REACT_OPTIMISTIC_KEY;
      } else {
        if (__DEV__) {
          checkKeyStringCoercion(config.key);
        }
        key = '' + config.key;
      }
    }

    for (propName in config) {
      if (
        hasOwnProperty.call(config, propName) &&
        propName !== 'key' &&
        propName !== '__self' &&
        propName !== '__source'
      ) {
        props[propName] = config[propName];
      }
    }
  }

  const childrenLength = arguments.length - 2;
  if (childrenLength === 1) {
    props.children = children;
  } else if (childrenLength > 1) {
    const childArray = Array(childrenLength);
    for (let i = 0; i < childrenLength; i++) {
      childArray[i] = arguments[i + 2];
    }
    if (__DEV__) {
      if (Object.freeze) {
        Object.freeze(childArray);
      }
    }
    props.children = childArray;
  }

  // Resolve default props
  if (type && type.defaultProps) {
    const defaultProps = type.defaultProps;
    for (propName in defaultProps) {
      if (props[propName] === undefined) {
        props[propName] = defaultProps[propName];
      }
    }
  }
  if (__DEV__) {
    if (key) {
      const displayName =
        typeof type === 'function'
          ? type.displayName || type.name || 'Unknown'
          : type;
      defineKeyPropWarningGetter(props, displayName);
    }
  }

  const trackActualOwner =
    __DEV__ && dispatcher.recentlyCreatedOwnerStacks++ < 1e4;
  let debugStackDEV = false;
  if (__DEV__) {
    if (trackActualOwner) {
      const previousStackTraceLimit = Error.stackTraceLimit;
      Error.stackTraceLimit = ownerStackTraceLimit;
      debugStackDEV = Error('react-stack-top-frame');
      Error.stackTraceLimit = previousStackTraceLimit;
    } else {
      debugStackDEV = unknownOwnerDebugStack;
    }
  }

  return ReactElement(
    type,
    key,
    props,
    getOwner(),
    debugStackDEV,
    __DEV__ &&
      (trackActualOwner
        ? createTask(getTaskName(type))
        : unknownOwnerDebugTask),
  );
}

export function cloneAndReplaceKey(oldElement, newKey) {
  const clonedElement = ReactElement(
    oldElement.type,
    newKey,
    oldElement.props,
    !__DEV__ ? undefined : oldElement._owner,
    __DEV__ && oldElement._debugStack,
    __DEV__ && oldElement._debugTask,
  );
  if (__DEV__) {
    if (oldElement._store) {
      clonedElement._store.validated = oldElement._store.validated;
    }
  }
  return clonedElement;
}

/**
 * Clone and return a new ReactElement using element as the starting point.
 * See https://reactjs.org/docs/react-api.html#cloneelement
 */
export function cloneElement(element, config, children) {
  if (element === null || element === undefined) {
    throw new Error(
      'The argument must be a React element, but you passed ' + element + '.',
    );
  }

  let propName;
  const props = assign({}, element.props);
  let key = element.key;
  let owner = !__DEV__ ? undefined : element._owner;

  if (config != null) {
    if (hasValidRef(config)) {
      owner = __DEV__ ? getOwner() : undefined;
    }
    if (hasValidKey(config)) {
      if (enableOptimisticKey && config.key === REACT_OPTIMISTIC_KEY) {
        key = REACT_OPTIMISTIC_KEY;
      } else {
        if (__DEV__) {
          checkKeyStringCoercion(config.key);
        }
        key = '' + config.key;
      }
    }

    for (propName in config) {
      if (
        hasOwnProperty.call(config, propName) &&
        propName !== 'key' &&
        propName !== '__self' &&
        propName !== '__source' &&
        !(propName === 'ref' && config.ref === undefined)
      ) {
        props[propName] = config[propName];
      }
    }
  }

  const childrenLength = arguments.length - 2;
  if (childrenLength === 1) {
    props.children = children;
  } else if (childrenLength > 1) {
    const childArray = Array(childrenLength);
    for (let i = 0; i < childrenLength; i++) {
      childArray[i] = arguments[i + 2];
    }
    props.children = childArray;
  }

  const clonedElement = ReactElement(
    element.type,
    key,
    props,
    owner,
    __DEV__ && element._debugStack,
    __DEV__ && element._debugTask,
  );

  for (let i = 2; i < arguments.length; i++) {
    validateChildKeys(arguments[i]);
  }

  return clonedElement;
}

// =============================================================================
// Validation
// =============================================================================

function validateChildKeys(node) {
  if (__DEV__) {
    if (isValidElement(node)) {
      if (node._store) {
        node._store.validated = 1;
      }
    } else if (isLazyType(node)) {
      if (node._payload.status === 'fulfilled') {
        if (isValidElement(node._payload.value) && node._payload.value._store) {
          node._payload.value._store.validated = 1;
        }
      } else if (node._store) {
        node._store.validated = 1;
      }
    }
  }
}

/**
 * Verifies the object is a ReactElement.
 * See https://reactjs.org/docs/react-api.html#isvalidelement
 */
export function isValidElement(object) {
  return (
    typeof object === 'object' &&
    object !== null &&
    object.$$typeof === REACT_ELEMENT_TYPE
  );
}

export function isLazyType(object) {
  return (
    typeof object === 'object' &&
    object !== null &&
    object.$$typeof === REACT_LAZY_TYPE
  );
}

// =============================================================================
// Re-exports for convenience
// =============================================================================

export { REACT_FRAGMENT_TYPE as Fragment };
export { REACT_ELEMENT_TYPE as ElementType };
