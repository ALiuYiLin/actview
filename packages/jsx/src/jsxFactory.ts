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
 *   import { initJsxFactory } from './jsxFactory';
 *   initJsxFactory({ devMode: true });
 *
 *   // Automatic JSX transform:
 *   { "jsxImportSource": "@local/jsx-factory" }
 *
 *   // Classic createElement:
 *   import { createElement } from '@local/jsx-factory';
 */

// =============================================================================
// Configuration (set via initJsxFactory() before first use)
// =============================================================================

let __DEV__ = false;
let enableOptimisticKey = false;
let enableViewTransition = true;
let enableTransitionTracing = false;

interface Dispatcher {
  getOwner?: () => any;
  recentlyCreatedOwnerStacks?: number;
}

let dispatcher: Dispatcher = {
  getOwner: () => null,
  recentlyCreatedOwnerStacks: 0,
};

export function initJsxFactory(options?: {
  devMode?: boolean;
  enableOptimisticKey?: boolean;
  enableViewTransition?: boolean;
  enableTransitionTracing?: boolean;
  dispatcher?: Dispatcher;
}) {
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
  if (__DEV__) {
    initDevGlobals();
  }
}

export function setDispatcher(d: Dispatcher) {
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

function checkKeyStringCoercion(value: any) {
  if (__DEV__) {
    if (willCoercionThrow(value)) {
      console.error(
        'The provided key is an unsupported type %s.' +
          ' This value must be coerced to a string before using it here.',
        typeName(value),
      );
      testStringCoercion(value);
    }
  }
}

function typeName(value: any): string | undefined {
  if (__DEV__) {
    const hasToStringTag = typeof Symbol === 'function' && Symbol.toStringTag;
    const type =
      (hasToStringTag && value[Symbol.toStringTag]) ||
      value.constructor?.name ||
      'Object';
    return type;
  }
}

function willCoercionThrow(value: any): boolean | undefined {
  if (__DEV__) {
    try {
      testStringCoercion(value);
      return false;
    } catch (e) {
      return true;
    }
  }
}

function testStringCoercion(value: any): string | undefined {
  if (__DEV__) {
    return '' + value;
  }
}

// =============================================================================
// getComponentNameFromType — adapted from React
// =============================================================================

function getWrappedName(outerType: any, innerType: any, wrapperName: string) {
  const displayName = outerType.displayName;
  if (displayName) {
    return displayName;
  }
  const functionName = innerType.displayName || innerType.name || '';
  return functionName !== ''
    ? wrapperName + '(' + functionName + ')'
    : wrapperName;
}

function getContextName(type: any) {
  return type.displayName || 'Context';
}

export function getComponentNameFromType(type: any): string | null {
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
      break;
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

const createTaskFn =
  typeof console !== 'undefined' && (console as any).createTask
    ? (console as any).createTask
    : () => null;

function getTaskName(type: any): string {
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

function UnknownOwner() {
  return (() => Error('react-stack-top-frame'))();
}

const createFakeCallStack = {
  react_stack_bottom_frame: function (callStackForError: () => Error) {
    return callStackForError();
  },
};

let _devInitialized = false;
let specialPropKeyWarningShown: boolean | undefined;
let didWarnAboutElementRef: Record<string, boolean> | undefined;
let didWarnAboutOldJSXRuntime: boolean | undefined;
let unknownOwnerDebugStack: Error | undefined;
let unknownOwnerDebugTask: any;

function initDevGlobals() {
  if (_devInitialized) return;
  _devInitialized = true;

  didWarnAboutElementRef = {};
  unknownOwnerDebugStack = createFakeCallStack.react_stack_bottom_frame.bind(
    createFakeCallStack,
    UnknownOwner,
  )();
  unknownOwnerDebugTask = createTaskFn(getTaskName(UnknownOwner));
}

function hasValidRef(config: any) {
  if (__DEV__) {
    if (hasOwnProperty.call(config, 'ref')) {
      const getter = Object.getOwnPropertyDescriptor(config, 'ref')?.get;
      if (getter && (getter as any).isReactWarning) {
        return false;
      }
    }
  }
  return config.ref !== undefined;
}

function hasValidKey(config: any) {
  if (__DEV__) {
    if (hasOwnProperty.call(config, 'key')) {
      const getter = Object.getOwnPropertyDescriptor(config, 'key')?.get;
      if (getter && (getter as any).isReactWarning) {
        return false;
      }
    }
  }
  return config.key !== undefined;
}

function defineKeyPropWarningGetter(props: any, displayName: string) {
  if (__DEV__) {
    const warnAboutAccessingKey = function (this: any) {
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
    (warnAboutAccessingKey as any).isReactWarning = true;
    Object.defineProperty(props, 'key', {
      get: warnAboutAccessingKey,
      configurable: true,
    });
  }
}

function elementRefGetterWithDeprecationWarning(this: any) {
  if (__DEV__) {
    const componentName = getComponentNameFromType(this.type);
    if (didWarnAboutElementRef && componentName && !didWarnAboutElementRef[componentName]) {
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

interface ReactElement {
  $$typeof: symbol;
  type: any;
  key: any;
  ref?: any;
  props: any;
  _owner?: any;
  _store?: any;
  _debugInfo?: any;
  _debugStack?: any;
  _debugTask?: any;
}

function ReactElement(type: any, key: any, props: any, owner: any, debugStack: any, debugTask: any): ReactElement {
  const refProp = props.ref;
  const ref = refProp !== undefined ? refProp : null;

  let element: ReactElement;
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
const resolveChild = (c: any) => c?.[LAZY_VNODE] ? c() : c;

// =============================================================================
// JSX Runtime API (automatic transform target)
// =============================================================================

export function jsx(type: any, config: any, maybeKey?: any) {
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

  let props: any;
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
      props.children = props.children.map((c: any) => resolveChild(c));
    } else {
      props.children = resolveChild(props.children);
    }
  }

  const _el = ReactElement(type, key, props, getOwner(), undefined, undefined);
  const lazy = () => _el;
  (lazy as any)[LAZY_VNODE] = true;
  return lazy;
}

export function jsxs(type: any, config: any, maybeKey?: any) {
  if (__DEV__) {
    const isStaticChildren = true;
    return jsxDEVImpl(
      type,
      config,
      maybeKey,
      isStaticChildren,
      getDebugStack(),
      __DEV__ ? createTaskFn(getTaskName(type)) : undefined,
    );
  }
  return jsx(type, config, maybeKey);
}

// --- DEV-only helpers ---

export function jsxProdSignatureRunningInDevWithDynamicChildren(type: any, config: any, maybeKey?: any) {
  if (__DEV__) {
    const isStaticChildren = false;
    const trackActualOwner =
      __DEV__ && dispatcher.recentlyCreatedOwnerStacks!++ < 1e4;
    let debugStackDEV: any = false;
    if (__DEV__) {
      if (trackActualOwner) {
        const previousStackTraceLimit = (Error as any).stackTraceLimit;
        (Error as any).stackTraceLimit = ownerStackTraceLimit;
        debugStackDEV = Error('react-stack-top-frame');
        (Error as any).stackTraceLimit = previousStackTraceLimit;
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
          ? createTaskFn(getTaskName(type))
          : unknownOwnerDebugTask),
    );
  }
}

export function jsxProdSignatureRunningInDevWithStaticChildren(type: any, config: any, maybeKey?: any) {
  if (__DEV__) {
    const isStaticChildren = true;
    const trackActualOwner =
      __DEV__ && dispatcher.recentlyCreatedOwnerStacks!++ < 1e4;
    let debugStackDEV: any = false;
    if (__DEV__) {
      if (trackActualOwner) {
        const previousStackTraceLimit = (Error as any).stackTraceLimit;
        (Error as any).stackTraceLimit = ownerStackTraceLimit;
        debugStackDEV = Error('react-stack-top-frame');
        (Error as any).stackTraceLimit = previousStackTraceLimit;
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
          ? createTaskFn(getTaskName(type))
          : unknownOwnerDebugTask),
    );
  }
}

export function jsxDEV(type: any, config: any, maybeKey?: any, isStaticChildren?: any) {
  const trackActualOwner =
    __DEV__ && dispatcher.recentlyCreatedOwnerStacks!++ < 1e4;
  let debugStackDEV: any = false;
  if (__DEV__) {
    if (trackActualOwner) {
      const previousStackTraceLimit = (Error as any).stackTraceLimit;
      (Error as any).stackTraceLimit = ownerStackTraceLimit;
      debugStackDEV = Error('react-stack-top-frame');
      (Error as any).stackTraceLimit = previousStackTraceLimit;
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
        ? createTaskFn(getTaskName(type))
        : unknownOwnerDebugTask),
  );
}

// --- Internal DEV implementation ---

const didWarnAboutKeySpread: Record<string, boolean> = {};

function getDebugStack() {
  const trackActualOwner =
    __DEV__ && dispatcher.recentlyCreatedOwnerStacks!++ < 1e4;
  if (__DEV__) {
    if (trackActualOwner) {
      const previousStackTraceLimit = (Error as any).stackTraceLimit;
      (Error as any).stackTraceLimit = ownerStackTraceLimit;
      const stack = Error('react-stack-top-frame');
      (Error as any).stackTraceLimit = previousStackTraceLimit;
      return stack;
    } else {
      return unknownOwnerDebugStack;
    }
  }
}

function jsxDEVImpl(type: any, config: any, maybeKey: any, isStaticChildren: any, debugStack: any, debugTask: any) {
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

    if (hasOwnProperty.call(config, 'key')) {
      const componentName = getComponentNameFromType(type);
      const keys = Object.keys(config).filter(k => k !== 'key');
      const beforeExample =
        keys.length > 0
          ? '{key: someKey, ' + keys.join(': ..., ') + ': ...}'
          : '{key: someKey}';
      if (componentName && !didWarnAboutKeySpread[componentName + beforeExample]) {
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
  let key: any = null;

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

  let props: any;
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
      props.children = props.children.map((c: any) => resolveChild(c));
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
  (lazy as any)[LAZY_VNODE] = true;
  return lazy;
}

// =============================================================================
// Classic API: createElement / cloneElement
// =============================================================================

export function createElement(type: any, config: any, children?: any) {
  if (__DEV__) {
    for (let i = 2; i < arguments.length; i++) {
      validateChildKeys(arguments[i]);
    }
  }

  let propName: string | undefined;
  const props: Record<string, any> = {};
  let key: any = null;

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
    __DEV__ && dispatcher.recentlyCreatedOwnerStacks!++ < 1e4;
  let debugStackDEV: any = false;
  if (__DEV__) {
    if (trackActualOwner) {
      const previousStackTraceLimit = (Error as any).stackTraceLimit;
      (Error as any).stackTraceLimit = ownerStackTraceLimit;
      debugStackDEV = Error('react-stack-top-frame');
      (Error as any).stackTraceLimit = previousStackTraceLimit;
    } else {
      debugStackDEV = unknownOwnerDebugStack;
    }
  }

  const _el = ReactElement(
    type,
    key,
    props,
    getOwner(),
    debugStackDEV,
    __DEV__ &&
      (trackActualOwner
        ? createTaskFn(getTaskName(type))
        : unknownOwnerDebugTask),
  );
  const lazy = () => _el;
  (lazy as any)[LAZY_VNODE] = true;
  return lazy;
}

export function cloneAndReplaceKey(oldElement: any, newKey: any) {
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
      clonedElement._store!.validated = oldElement._store.validated;
    }
  }
  return clonedElement;
}

export function cloneElement(element: any, config: any, children?: any) {
  if (element === null || element === undefined) {
    throw new Error(
      'The argument must be a React element, but you passed ' + element + '.',
    );
  }

  let propName: string | undefined;
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

function validateChildKeys(node: any) {
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

export function isValidElement(object: any) {
  return (
    typeof object === 'object' &&
    object !== null &&
    object.$$typeof === REACT_ELEMENT_TYPE
  );
}

export function isLazyType(object: any) {
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
