/**
 * Copyright (c) Facebook, Inc. and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @flow
 */

import type {ReactElement, Source} from 'shared/ReactElementType';
import type {
  ReactFragment,
  ReactPortal,
  RefObject,
  ReactEventResponder,
  ReactEventResponderInstance,
  ReactFundamentalComponent,
  ReactScope,
} from 'shared/ReactTypes';
import type {RootTag} from 'shared/ReactRootTags';
import type {WorkTag} from 'shared/ReactWorkTags';
import type {TypeOfMode} from './ReactTypeOfMode';
import type {SideEffectTag} from 'shared/ReactSideEffectTags';
import type {ExpirationTime} from './ReactFiberExpirationTime';
import type {UpdateQueue} from './ReactUpdateQueue';
import type {ContextDependency} from './ReactFiberNewContext';
import type {HookType} from './ReactFiberHooks';
import type {SuspenseInstance} from './ReactFiberHostConfig';

import invariant from 'shared/invariant';
import {
  enableProfilerTimer,
  enableFundamentalAPI,
  enableUserTimingAPI,
  enableScopeAPI,
  enableBlocksAPI,
} from 'shared/ReactFeatureFlags';
import {NoEffect, Placement} from 'shared/ReactSideEffectTags';
import {ConcurrentRoot, BlockingRoot} from 'shared/ReactRootTags';
import {
  IndeterminateComponent,
  ClassComponent,
  HostRoot,
  HostComponent,
  HostText,
  HostPortal,
  ForwardRef,
  Fragment,
  Mode,
  ContextProvider,
  ContextConsumer,
  Profiler,
  SuspenseComponent,
  SuspenseListComponent,
  DehydratedFragment,
  FunctionComponent,
  MemoComponent,
  SimpleMemoComponent,
  LazyComponent,
  FundamentalComponent,
  ScopeComponent,
  Block,
} from 'shared/ReactWorkTags';
import getComponentName from 'shared/getComponentName';

import {isDevToolsPresent} from './ReactFiberDevToolsHook';
import {
  resolveClassForHotReloading,
  resolveFunctionForHotReloading,
  resolveForwardRefForHotReloading,
} from './ReactFiberHotReloading';
import {NoWork} from './ReactFiberExpirationTime';
import {
  NoMode,
  ConcurrentMode,
  ProfileMode,
  StrictMode,
  BlockingMode,
} from './ReactTypeOfMode';
import {
  REACT_FORWARD_REF_TYPE,
  REACT_FRAGMENT_TYPE,
  REACT_STRICT_MODE_TYPE,
  REACT_PROFILER_TYPE,
  REACT_PROVIDER_TYPE,
  REACT_CONTEXT_TYPE,
  REACT_CONCURRENT_MODE_TYPE,
  REACT_SUSPENSE_TYPE,
  REACT_SUSPENSE_LIST_TYPE,
  REACT_MEMO_TYPE,
  REACT_LAZY_TYPE,
  REACT_FUNDAMENTAL_TYPE,
  REACT_SCOPE_TYPE,
  REACT_BLOCK_TYPE,
} from 'shared/ReactSymbols';

let hasBadMapPolyfill;

if (__DEV__) {
  hasBadMapPolyfill = false;
  try {
    const nonExtensibleObject = Object.preventExtensions({});
    const testMap = new Map([[nonExtensibleObject, null]]);
    const testSet = new Set([nonExtensibleObject]);
    // This is necessary for Rollup to not consider these unused.
    // https://github.com/rollup/rollup/issues/1771
    // TODO: we can remove these if Rollup fixes the bug.
    testMap.set(0, 0);
    testSet.add(0);
  } catch (e) {
    // TODO: Consider warning about bad polyfills
    hasBadMapPolyfill = true;
  }
}

export type Dependencies = {
  expirationTime: ExpirationTime,
  firstContext: ContextDependency<mixed> | null,
  responders: Map<
    ReactEventResponder<any, any>,
    ReactEventResponderInstance<any, any>,
  > | null,
  ...
};

// A Fiber is work on a Component that needs to be done or was done. There can
// be more than one per component.
export type Fiber = {|
  // These first fields are conceptually members of an Instance. This used to
  // be split into a separate type and intersected with the other Fiber fields,
  // but until Flow fixes its intersection bugs, we've merged them into a
  // single type.

  // An Instance is shared between all versions of a component. We can easily
  // break this out into a separate object to avoid copying so much to the
  // alternate versions of the tree. We put this on a single object for now to
  // minimize the number of objects created during the initial render.

  // Tag identifying the type of fiber.
  tag: WorkTag,

  // Unique identifier of this child.
  key: null | string,

  // The value of element.type which is used to preserve the identity during
  // reconciliation of this child.
  elementType: any,

  // The resolved function/class/ associated with this fiber.
  type: any,

  // The local state associated with this fiber.
  stateNode: any,

  // Conceptual aliases
  // parent : Instance -> return The parent happens to be the same as the
  // return fiber since we've merged the fiber and instance.

  // Remaining fields belong to Fiber

  // The Fiber to return to after finishing processing this one.
  // This is effectively the parent, but there can be multiple parents (two)
  // so this is only the parent of the thing we're currently processing.
  // It is conceptually the same as the return address of a stack frame.
  return: Fiber | null,

  // Singly Linked List Tree Structure.
  child: Fiber | null,
  sibling: Fiber | null,
  index: number,

  // The ref last used to attach this node.
  // I'll avoid adding an owner field for prod and model that as functions.
  ref:
    | null
    | (((handle: mixed) => void) & {_stringRef: ?string, ...})
    | RefObject,

  // Input is the data coming into process this fiber. Arguments. Props.
  pendingProps: any, // This type will be more specific once we overload the tag.
  memoizedProps: any, // The props used to create the output.

  // A queue of state updates and callbacks.
  updateQueue: UpdateQueue<any> | null,

  // The state used to create the output
  memoizedState: any,

  // Dependencies (contexts, events) for this fiber, if it has any
  dependencies: Dependencies | null,

  // Bitfield that describes properties about the fiber and its subtree. E.g.
  // the ConcurrentMode flag indicates whether the subtree should be async-by-
  // default. When a fiber is created, it inherits the mode of its
  // parent. Additional flags can be set at creation time, but after that the
  // value should remain unchanged throughout the fiber's lifetime, particularly
  // before its child fibers are created.
  mode: TypeOfMode,

  // Effect
  effectTag: SideEffectTag,

  // Singly linked list fast path to the next fiber with side-effects.
  nextEffect: Fiber | null,

  // The first and last fiber with side-effect within this subtree. This allows
  // us to reuse a slice of the linked list when we reuse the work done within
  // this fiber.
  firstEffect: Fiber | null,
  lastEffect: Fiber | null,

  // Represents a time in the future by which this work should be completed.
  // Does not include work found in its subtree.
  expirationTime: ExpirationTime,

  // This is used to quickly determine if a subtree has no pending changes.
  childExpirationTime: ExpirationTime,

  // This is a pooled version of a Fiber. Every fiber that gets updated will
  // eventually have a pair. There are cases when we can clean up pairs to save
  // memory if we need to.
  alternate: Fiber | null,

  // Time spent rendering this Fiber and its descendants for the current update.
  // This tells us how well the tree makes use of sCU for memoization.
  // It is reset to 0 each time we render and only updated when we don't bailout.
  // This field is only set when the enableProfilerTimer flag is enabled.
  actualDuration?: number,

  // If the Fiber is currently active in the "render" phase,
  // This marks the time at which the work began.
  // This field is only set when the enableProfilerTimer flag is enabled.
  actualStartTime?: number,

  // Duration of the most recent render time for this Fiber.
  // This value is not updated when we bailout for memoization purposes.
  // This field is only set when the enableProfilerTimer flag is enabled.
  selfBaseDuration?: number,

  // Sum of base times for all descendants of this Fiber.
  // This value bubbles up during the "complete" phase.
  // This field is only set when the enableProfilerTimer flag is enabled.
  treeBaseDuration?: number,

  // Conceptual aliases
  // workInProgress : Fiber ->  alternate The alternate used for reuse happens
  // to be the same as work in progress.
  // __DEV__ only
  _debugID?: number,
  _debugSource?: Source | null,
  _debugOwner?: Fiber | null,
  _debugIsCurrentlyTiming?: boolean,
  _debugNeedsRemount?: boolean,

  // Used to verify that the order of hooks does not change between renders.
  _debugHookTypes?: Array<HookType> | null,
|};

let debugCounter = 1;

function FiberNode(
  tag: WorkTag,
  pendingProps: mixed,
  key: null | string,
  mode: TypeOfMode,
) {
    this.tag = tag; // 标记不同组件类型 如classComponent表示class类组件 functionComponent表示函数类型组件 还有其他类型的在 ReactWorkTag.js 文件红可以看到
    this.key = key; // react元素上的key 就是jsx上写的那个key
    this.elementType = null; // 表示fiber的真实类型 比如当前fiber对应的jsx是div 那这个属性就是 'div' 如果这个属性对应一个叫做 Test 的class类 那么这个属性就是 Test 本身
    this.type = null; // 表示fiber的真实类型 这个和elementType大部分情况下是一样的 在使用了懒加载之类的功能时可能会不一样
    this.stateNode = null; // 当前Fiber对应的实例 比如class组件 new完之后就挂在这个属性上
    this.return = null; // 父级Fiber 用来指向当前fiber的父fiber
    this.child = null; // 子级Fiber 指向自己的第一个子Fiber节点 也就是firstChildFiber
    this.sibling = null; // 兄弟节点 指向右边的兄弟节点
    /*
        可能您已经注意到了，fiber上有个属性叫child 但是却没有一个属性叫children
        但是我们的组件中肯定会存在一个父节点下有多个子节点的情况
        那为啥fiber中没有children属性呢~
        其实react中，采用的是“树”还有“链表”这两种数据结构
        这两种数据结构被合在一起使用了
        每个节点 有且仅有一个child属性指向他的firstChild
        每个节点 有且仅有一个sibling属性指向他的右边的兄弟节点
        比如说:
            <div>
                <h1></h1>
                <MyComponent />
                <span>
                    <h2>6666</h2>
                </span>
            </div>
        想上面这个jsx结构 就会形成一颗树和链表的树
        div
         ┃
         ┃ (child)
         ▼
        h1 ————————→ MyComponent ————————→ span
           (sibling)             (sibling)   ┃
                                             ┃ (child)
                                             ▼
                                             h2
        div.child → h1
        h1.sibling → MyComponent
        MyComponent.sibling → span
        span.child → h2
    */


    this.index = 0; // 一般如果没有兄弟节点的话是0 当某个父节点下的子节点是数组类型的时候会给每个子节点一个index index和key要一起做diff
    this.ref = null; // 这个就是react元素上也就是jsx上写的ref
    this.pendingProps = pendingProps; // 新传进来的props
    this.memoizedProps = null; // 上次渲染完后的旧的props
    this.updateQueue = null; // 该fiber上的更新队列 执行一次setState就会忘这个属性上挂一个新的更新 这些更新以链表的形式存在
    this.memoizedState = null; // 旧的state 也表示当前页面上的你能看到的状态 不只是class组件有 function类型组件也可能有
    this.dependencies = null;
    /*
      这里的mode要用二进制表示 ReactTypeOfMode.js 文件中可以看到
      mode目前有4中 用来表示当前组件下的所有子组件要用处于一种什么状态
      比如concurrentMode就表示当前子节点们要异步进行更新
      strictMode就表示当前子节点们要处于严格模式
     */
    this.mode = mode;
    // Effects
    this.effectTag = NoEffect; // 表示当前fiber要进行何种更新 ReactSideEffectTag.js 文件中可以看到全部更新类型 比如placement表示是新创建的节点 update表示属性可能有变化或者有生命周期之类的
    this.nextEffect = null; // 一条链表 指向下一个有更新的fiber
    this.firstEffect = null; // 子节点中所有有更新的节点中的第一个fiber
    this.lastEffect = null; // 子节点中所有有更新的节点中的最后一个fiber
    /*
        这个effect有必要好好解释一下
        effectTag表示当前这个fiber节点本身有何种更新 没有更新的话就是 NoEffect
        firstEffect是链表
        lastEffect当前fiber的所有子fiber中的最后一个有更新的fiber
        firstEffec这条链表上的fiber从first指向last
        表示的是当前节点的子节点们！注意是子节点不包括自身
        并且是所有有更新的子节点的链表
        也就是说 如果当前fiber下的某个子节点的effectTag是NoEffect的话
        那么这个子节点就不会被包括在这条链表上
        不好理解的话直接看例子!

        <div id="root">                     <div id="root">
            <div class="origin">                <div class="target">
                <h1>123</h1>                        <h1>456</h1>
                <h2>text</h2>    setState           <h2>text</h2>
                <span>          ——————————→         <span class="haschange">
                    <a>888</a>                         <a>888</a>
                    <p></p>                         </span>
                </span>                             <h3>333</h3>
            </div>                              </div>
        </div>                              </div>


        比如说上面这种情况
        最外层的div的id为root
        它的直接子元素的 div 的 class 从origin变为了target 所以这个 div.origin 的 effectTag 就是Update
        h1的子节点 也就是这个文本从123变成了456 所以h1的effectTag也是Update
        h2没有发生任何改变 所以h2的effectTag是NoEffect
        span的class发生了改变 所以effectTag是Update
        a标签也没改变 effectTag也是NoEffect
        但是p标签被删除了 所以p节点对应的fiber的effectTag是Deletion
        最后还新插如了一个h3标签 由于是新插入的 所以h3的effectTag是Placement

        这样的话 我们来看一看每个节点的fiber的effect链表是个什么样的状态

        首先最外层的 div#root，它的子节点一共有6个，分别是 div.origin、h1、h2、span、a、p(孙子节点也算div#root的子节点)
        其中有更新的是 div.origin、h1、p、span、h3(h3 是新插入的)，一共这五个有更新（包括一个新插入的h3）
        这五个有更新的fiber要本着深度优先的规则 形成链表挂，依次递归把更新往他们自己的父节点身上挂，最终会挂载到最外层的 div#root 的 fiber 上

        什么是“深度递归，依次把更新往父节点上挂”呢？
        首先“深度递归”指的是react在处理这些节点对应的fiber的时候，是从子节点开始处理的。
        也就是按照 h1 -> h2 -> a -> p -> span -> h3 -> div.origin -> div#root 的顺序处理。
        至于“依次把更新往父节点上挂”，
        首先react依照深度递归的原则，每处理到一个节点，都先看这个节点的子节点们是否有更新，如果子节点有更新，就把子节点挂到当前fiber上，然后再看当前fiber本身是否有更新，如果有更新，就把当前
        fiber挂到它的父节点身上。举个🌰：
        比如第一个处理的节点是 h1 的fiber，然后会看 h1 的子节点是否有更新，由于 h1 是个叶子节点，没有子元素了(文本类型不算)，所以他也就没有要更新的子节点，下一步看 h1 本身是否有更新，
        会发现 h1 有更新，因为他的文本发生改变，所以会把 h1 对应的fiber挂载到 h1 的父节点 也就是 div.origin 对应 fiber 的 effectList 上，
        此时 div.origin 的 effectList(也就是firstEffect)是：h1的fiber（暂时只有它一个）
        然后处理 h2，h2 和 h1 一样没有子节点，从这个demo来看，h2 自己本身也没有更新，所以 react 不会对 h2 做处理
        第三个处理的是 a 标签（由于深度优先，所以会先处理 a 而不是 span），a 标签和 h2 标签一样没有子节点本身也没有更新，所以react不做任何处理
        第四个处理的，按理说应该是 p 标签，但是 p 标签是一个删除标签，所以处理的流程稍微有点不一样，p 标签是在 react 对数组类型的子节点做diff算法的时候进行处理的，
        这里暂时可以理解成 p 标签的 fiber 已经被挂在到了它的父节点也就是 span 的fiber上了，所以此时的 span 的 effectList 是：p的fiber
        接下来第四个真正处理的就是 span 标签了，这里会发现 span 标签诚如上面说的，已经有一个子节点是 p 标签，要被删除，
        所以会先把这个 p 标签的 fiber 挂到当前节点的父节点的effectList上，也就是 span 的父节点 div.origin 的 effectList 上
        此时 div.origin 的 effectList 是：h1的fiber -> p的fiber
        接下来 span 会看自己本身是否有更新，这个例子中 span 是有更新的，所以把 span 自己的 fiber 挂载到它的父节点上
        此时 div.origin 的 effectList 是：h1的fiber -> p的fiber -> span的fiber
        第五个要处理的是 h3 ，同样第一步先看 h3 是否有要更新的子节点，发现 h3 没有要更新的子节点，于是进行第二步，看 h3 自己是否要进行更新，
        这里的 h3 是一个新插入的节点，所以是有更新的，所以要把 h3 自己挂载到它的父节点，也就是 div.origin 上，
        此时 div.origin 的 effectList 是：h1的fiber -> p的fiber -> span的fiber -> h3的fiber
        第六个要处理的，是 div.origin，还是一样，先看 div.origin 下是否有要更新的子节点，
        发现 div.origin 身上有一串要更新的子节点，也就是h1的fiber -> p的fiber -> span的fiber -> h3的fiber
        所以先把 h1的fiber -> p的fiber -> span的fiber -> h3的fiber 这一串挂载到 div.origin 的父节点也就是 div#root 上
        此时 div#root 的 effectList 是：h1的fiber -> p的fiber -> span的fiber -> h3的fiber
        最后看 div.origin 自己本身是否有更新，发现 div.origin 是一个有更新的节点，于是把自己挂载到它的父节点 div#root 上
        此时 div#root 的 effectList 是：h1的fiber -> p的fiber -> span的fiber -> h3的fiber -> div.origin

        之后以此类推，最终会形成一条链表，链表上的每个节点都表示一个要更新的子节点，这条链表最终会挂载到整个 fiber树 的 root 上

        有了这个例子应该就可以明白，任何节点的子节点如果有更新 都会按照深度优先的原则把它的子节点做成链表挂载在它身上
        而如果这个节点自身也有更新，那这个节点会被挂到它的父节点的effect链表上

    */

    this.expirationTime = NoWork; // 当前fiber的优先级 也可以说是过期时间
    this.childExpirationTime = NoWork; // 当前节点的所有子节点中的那个最大的优先级
    /*
        expirationTime 比较复杂 以后慢慢说 同步状态下几乎用不到
        也就是说如果不给组件包裹concurrent组件的话 几乎没太大用
    */

    this.alternate = null; // 指向当前fiber的上一个状态
    /*
        alternate指向当前fiber的上一个fiber
        啥意思呢，就是说
        初次渲染 当前jsx节点会有个fiber 假设名字叫 ding1
        然后setState一次会生成一个新的fiber 假设名字叫ding2
        那么ding1.alternate 就可能指向ding2 然后ding2.alternate就可能指向ding1
        他们是双向的
    */
        if (enableProfilerTimer) {
          // Note: The following is done to avoid a v8 performance cliff.
          //
          // Initializing the fields below to smis and later updating them with
          // double values will cause Fibers to end up having separate shapes.
          // This behavior/bug has something to do with Object.preventExtension().
          // Fortunately this only impacts DEV builds.
          // Unfortunately it makes React unusably slow for some applications.
          // To work around this, initialize the fields below with doubles.
          //
          // Learn more about this here:
          // https://github.com/facebook/react/issues/14365
          // https://bugs.chromium.org/p/v8/issues/detail?id=8538
          this.actualDuration = Number.NaN;
          this.actualStartTime = Number.NaN;
          this.selfBaseDuration = Number.NaN;
          this.treeBaseDuration = Number.NaN;

          // It's okay to replace the initial doubles with smis after initialization.
          // This won't trigger the performance cliff mentioned above,
          // and it simplifies other profiler code (including DevTools).
          this.actualDuration = 0;
          this.actualStartTime = -1;
          this.selfBaseDuration = 0;
          this.treeBaseDuration = 0;
        }

        // This is normally DEV-only except www when it adds listeners.
        // TODO: remove the User Timing integration in favor of Root Events.
        if (enableUserTimingAPI) {
          this._debugID = debugCounter++;
          this._debugIsCurrentlyTiming = false;
        }

        if (__DEV__) {
          this._debugSource = null;
          this._debugOwner = null;
          this._debugNeedsRemount = false;
          this._debugHookTypes = null;
          if (!hasBadMapPolyfill && typeof Object.preventExtensions === 'function') {
            Object.preventExtensions(this);
          }
        }
}

// This is a constructor function, rather than a POJO constructor, still
// please ensure we do the following:
// 1) Nobody should add any instance methods on this. Instance methods can be
//    more difficult to predict when they get optimized and they are almost
//    never inlined properly in static compilers.
// 2) Nobody should rely on `instanceof Fiber` for type testing. We should
//    always know when it is a fiber.
// 3) We might want to experiment with using numeric keys since they are easier
//    to optimize in a non-JIT environment.
// 4) We can easily go from a constructor to a createFiber object literal if that
//    is faster.
// 5) It should be easy to port this to a C struct and keep a C implementation
//    compatible.
const createFiber = function (
  tag: WorkTag,
  pendingProps: mixed,
  key: null | string,
  mode: TypeOfMode,
): Fiber {
  // $FlowFixMe: the shapes are exact here but Flow doesn't like constructors
  return new FiberNode(tag, pendingProps, key, mode);
};

function shouldConstruct(Component: Function) {
  const prototype = Component.prototype;
  return !!(prototype && prototype.isReactComponent);
}

export function isSimpleFunctionComponent(type: any) {
  return (
    typeof type === 'function' &&
    !shouldConstruct(type) &&
    type.defaultProps === undefined
  );
}

export function resolveLazyComponentTag(Component: Function): WorkTag {
  if (typeof Component === 'function') {
    return shouldConstruct(Component) ? ClassComponent : FunctionComponent;
  } else if (Component !== undefined && Component !== null) {
    const $$typeof = Component.$$typeof;
    if ($$typeof === REACT_FORWARD_REF_TYPE) {
      return ForwardRef;
    }
    if ($$typeof === REACT_MEMO_TYPE) {
      return MemoComponent;
    }
    if (enableBlocksAPI) {
      if ($$typeof === REACT_BLOCK_TYPE) {
        return Block;
      }
    }
  }
  return IndeterminateComponent;
}

// 构建 workInProgress Fiber 树中的 rootFiber
// 构建完成后会替换 current fiber
// 初始渲染 pendingProps 为 null
export function createWorkInProgress(current: Fiber, pendingProps: any): Fiber {
  // current: current Fiber 中的 rootFiber
  // 获取 current Fiber 对应的 workInProgress Fiber
  let workInProgress = current.alternate;
  // 如果 workInProgress 不存在
  if (workInProgress === null) {
    // 创建 fiber 对象
    workInProgress = createFiber(
      current.tag,
      pendingProps,
      current.key,
      current.mode,
    );
    // 属性复用
    workInProgress.elementType = current.elementType;
    workInProgress.type = current.type;
    workInProgress.stateNode = current.stateNode;

    if (__DEV__) {
      // DEV-only fields
      if (enableUserTimingAPI) {
        workInProgress._debugID = current._debugID;
      }
      workInProgress._debugSource = current._debugSource;
      workInProgress._debugOwner = current._debugOwner;
      workInProgress._debugHookTypes = current._debugHookTypes;
    }
    // 使用 alternate 存储 current
    workInProgress.alternate = current;
    // 使用 alternate 存储 workInProgress
    current.alternate = workInProgress;
  } else {
    workInProgress.pendingProps = pendingProps;

    // We already have an alternate.
    // Reset the effect tag.
    workInProgress.effectTag = NoEffect;

    // The effect list is no longer valid.
    workInProgress.nextEffect = null;
    workInProgress.firstEffect = null;
    workInProgress.lastEffect = null;

    if (enableProfilerTimer) {
      // We intentionally reset, rather than copy, actualDuration & actualStartTime.
      // This prevents time from endlessly accumulating in new commits.
      // This has the downside of resetting values for different priority renders,
      // But works for yielding (the common case) and should support resuming.
      workInProgress.actualDuration = 0;
      workInProgress.actualStartTime = -1;
    }
  }

  workInProgress.childExpirationTime = current.childExpirationTime;
  workInProgress.expirationTime = current.expirationTime;
  workInProgress.child = current.child;
  workInProgress.memoizedProps = current.memoizedProps;
  workInProgress.memoizedState = current.memoizedState;
  workInProgress.updateQueue = current.updateQueue;

  // Clone the dependencies object. This is mutated during the render phase, so
  // it cannot be shared with the current fiber.
  const currentDependencies = current.dependencies;
  workInProgress.dependencies =
    currentDependencies === null
      ? null
      : {
          expirationTime: currentDependencies.expirationTime,
          firstContext: currentDependencies.firstContext,
          responders: currentDependencies.responders,
        };

  // These will be overridden during the parent's reconciliation
  workInProgress.sibling = current.sibling;
  workInProgress.index = current.index;
  workInProgress.ref = current.ref;

  if (enableProfilerTimer) {
    workInProgress.selfBaseDuration = current.selfBaseDuration;
    workInProgress.treeBaseDuration = current.treeBaseDuration;
  }

  if (__DEV__) {
    workInProgress._debugNeedsRemount = current._debugNeedsRemount;
    switch (workInProgress.tag) {
      case IndeterminateComponent:
      case FunctionComponent:
      case SimpleMemoComponent:
        workInProgress.type = resolveFunctionForHotReloading(current.type);
        break;
      case ClassComponent:
        workInProgress.type = resolveClassForHotReloading(current.type);
        break;
      case ForwardRef:
        workInProgress.type = resolveForwardRefForHotReloading(current.type);
        break;
      default:
        break;
    }
  }

  return workInProgress;
}

// Used to reuse a Fiber for a second pass.
export function resetWorkInProgress(
  workInProgress: Fiber,
  renderExpirationTime: ExpirationTime,
) {
  // This resets the Fiber to what createFiber or createWorkInProgress would
  // have set the values to before during the first pass. Ideally this wouldn't
  // be necessary but unfortunately many code paths reads from the workInProgress
  // when they should be reading from current and writing to workInProgress.

  // We assume pendingProps, index, key, ref, return are still untouched to
  // avoid doing another reconciliation.

  // Reset the effect tag but keep any Placement tags, since that's something
  // that child fiber is setting, not the reconciliation.
  workInProgress.effectTag &= Placement;

  // The effect list is no longer valid.
  workInProgress.nextEffect = null;
  workInProgress.firstEffect = null;
  workInProgress.lastEffect = null;

  let current = workInProgress.alternate;
  if (current === null) {
    // Reset to createFiber's initial values.
    workInProgress.childExpirationTime = NoWork;
    workInProgress.expirationTime = renderExpirationTime;

    workInProgress.child = null;
    workInProgress.memoizedProps = null;
    workInProgress.memoizedState = null;
    workInProgress.updateQueue = null;

    workInProgress.dependencies = null;

    if (enableProfilerTimer) {
      // Note: We don't reset the actualTime counts. It's useful to accumulate
      // actual time across multiple render passes.
      workInProgress.selfBaseDuration = 0;
      workInProgress.treeBaseDuration = 0;
    }
  } else {
    // Reset to the cloned values that createWorkInProgress would've.
    workInProgress.childExpirationTime = current.childExpirationTime;
    workInProgress.expirationTime = current.expirationTime;

    workInProgress.child = current.child;
    workInProgress.memoizedProps = current.memoizedProps;
    workInProgress.memoizedState = current.memoizedState;
    workInProgress.updateQueue = current.updateQueue;

    // Clone the dependencies object. This is mutated during the render phase, so
    // it cannot be shared with the current fiber.
    const currentDependencies = current.dependencies;
    workInProgress.dependencies =
      currentDependencies === null
        ? null
        : {
            expirationTime: currentDependencies.expirationTime,
            firstContext: currentDependencies.firstContext,
            responders: currentDependencies.responders,
          };

    if (enableProfilerTimer) {
      // Note: We don't reset the actualTime counts. It's useful to accumulate
      // actual time across multiple render passes.
      workInProgress.selfBaseDuration = current.selfBaseDuration;
      workInProgress.treeBaseDuration = current.treeBaseDuration;
    }
  }

  return workInProgress;
}

export function createHostRootFiber(tag: RootTag): Fiber {
  // 根据 tag 值设置 mode
  let mode;
  if (tag === ConcurrentRoot) {
    mode = ConcurrentMode | BlockingMode | StrictMode;
  } else if (tag === BlockingRoot) {
    mode = BlockingMode | StrictMode;
  } else {
    mode = NoMode;
  }

  if (enableProfilerTimer && isDevToolsPresent) {
    // Always collect profile timings when DevTools are present.
    // This enables DevTools to start capturing timing at any point–
    // Without some nodes in the tree having empty base times.
    mode |= ProfileMode;
  }

  return createFiber(HostRoot, null, null, mode);
}

export function createFiberFromTypeAndProps(
  type: any, // React$ElementType
  key: null | string,
  pendingProps: any,
  owner: null | Fiber,
  mode: TypeOfMode,
  expirationTime: ExpirationTime,
): Fiber {
  let fiber;

  let fiberTag = IndeterminateComponent;
  // The resolved type is set if we know what the final type will be. I.e. it's not lazy.
  let resolvedType = type;
  if (typeof type === 'function') {
    if (shouldConstruct(type)) {
      fiberTag = ClassComponent;
      if (__DEV__) {
        resolvedType = resolveClassForHotReloading(resolvedType);
      }
    } else {
      if (__DEV__) {
        resolvedType = resolveFunctionForHotReloading(resolvedType);
      }
    }
  } else if (typeof type === 'string') {
    fiberTag = HostComponent;
  } else {
    getTag: switch (type) {
      case REACT_FRAGMENT_TYPE:
        return createFiberFromFragment(
          pendingProps.children,
          mode,
          expirationTime,
          key,
        );
      case REACT_CONCURRENT_MODE_TYPE:
        fiberTag = Mode;
        mode |= ConcurrentMode | BlockingMode | StrictMode;
        break;
      case REACT_STRICT_MODE_TYPE:
        fiberTag = Mode;
        mode |= StrictMode;
        break;
      case REACT_PROFILER_TYPE:
        return createFiberFromProfiler(pendingProps, mode, expirationTime, key);
      case REACT_SUSPENSE_TYPE:
        return createFiberFromSuspense(pendingProps, mode, expirationTime, key);
      case REACT_SUSPENSE_LIST_TYPE:
        return createFiberFromSuspenseList(
          pendingProps,
          mode,
          expirationTime,
          key,
        );
      default: {
        if (typeof type === 'object' && type !== null) {
          switch (type.$$typeof) {
            case REACT_PROVIDER_TYPE:
              fiberTag = ContextProvider;
              break getTag;
            case REACT_CONTEXT_TYPE:
              // This is a consumer
              fiberTag = ContextConsumer;
              break getTag;
            case REACT_FORWARD_REF_TYPE:
              fiberTag = ForwardRef;
              if (__DEV__) {
                resolvedType = resolveForwardRefForHotReloading(resolvedType);
              }
              break getTag;
            case REACT_MEMO_TYPE:
              fiberTag = MemoComponent;
              break getTag;
            case REACT_LAZY_TYPE:
              fiberTag = LazyComponent;
              resolvedType = null;
              break getTag;
            case REACT_BLOCK_TYPE:
              fiberTag = Block;
              break getTag;
            case REACT_FUNDAMENTAL_TYPE:
              if (enableFundamentalAPI) {
                return createFiberFromFundamental(
                  type,
                  pendingProps,
                  mode,
                  expirationTime,
                  key,
                );
              }
              break;
            case REACT_SCOPE_TYPE:
              if (enableScopeAPI) {
                return createFiberFromScope(
                  type,
                  pendingProps,
                  mode,
                  expirationTime,
                  key,
                );
              }
          }
        }
        let info = '';
        if (__DEV__) {
          if (
            type === undefined ||
            (typeof type === 'object' &&
              type !== null &&
              Object.keys(type).length === 0)
          ) {
            info +=
              ' You likely forgot to export your component from the file ' +
              "it's defined in, or you might have mixed up default and " +
              'named imports.';
          }
          const ownerName = owner ? getComponentName(owner.type) : null;
          if (ownerName) {
            info += '\n\nCheck the render method of `' + ownerName + '`.';
          }
        }
        invariant(
          false,
          'Element type is invalid: expected a string (for built-in ' +
            'components) or a class/function (for composite components) ' +
            'but got: %s.%s',
          type == null ? type : typeof type,
          info,
        );
      }
    }
  }

  fiber = createFiber(fiberTag, pendingProps, key, mode);
  fiber.elementType = type;
  fiber.type = resolvedType;
  fiber.expirationTime = expirationTime;

  return fiber;
}

// 根据 React Element 创建 Fiber 对象
export function createFiberFromElement(
  element: ReactElement,
  // 父级Fiber mode 子级需要继承
  mode: TypeOfMode,
  expirationTime: ExpirationTime,
): Fiber {
  let owner = null;
  if (__DEV__) {
    owner = element._owner;
  }
  const type = element.type;
  const key = element.key;
  const pendingProps = element.props;
  const fiber = createFiberFromTypeAndProps(
    type,
    key,
    pendingProps,
    owner,
    mode,
    expirationTime,
  );
  if (__DEV__) {
    fiber._debugSource = element._source;
    fiber._debugOwner = element._owner;
  }
  return fiber;
}

export function createFiberFromFragment(
  elements: ReactFragment,
  mode: TypeOfMode,
  expirationTime: ExpirationTime,
  key: null | string,
): Fiber {
  const fiber = createFiber(Fragment, elements, key, mode);
  fiber.expirationTime = expirationTime;
  return fiber;
}

export function createFiberFromFundamental(
  fundamentalComponent: ReactFundamentalComponent<any, any>,
  pendingProps: any,
  mode: TypeOfMode,
  expirationTime: ExpirationTime,
  key: null | string,
): Fiber {
  const fiber = createFiber(FundamentalComponent, pendingProps, key, mode);
  fiber.elementType = fundamentalComponent;
  fiber.type = fundamentalComponent;
  fiber.expirationTime = expirationTime;
  return fiber;
}

function createFiberFromScope(
  scope: ReactScope,
  pendingProps: any,
  mode: TypeOfMode,
  expirationTime: ExpirationTime,
  key: null | string,
) {
  const fiber = createFiber(ScopeComponent, pendingProps, key, mode);
  fiber.type = scope;
  fiber.elementType = scope;
  fiber.expirationTime = expirationTime;
  return fiber;
}

function createFiberFromProfiler(
  pendingProps: any,
  mode: TypeOfMode,
  expirationTime: ExpirationTime,
  key: null | string,
): Fiber {
  if (__DEV__) {
    if (
      typeof pendingProps.id !== 'string' ||
      typeof pendingProps.onRender !== 'function'
    ) {
      console.error(
        'Profiler must specify an "id" string and "onRender" function as props',
      );
    }
  }

  const fiber = createFiber(Profiler, pendingProps, key, mode | ProfileMode);
  // TODO: The Profiler fiber shouldn't have a type. It has a tag.
  fiber.elementType = REACT_PROFILER_TYPE;
  fiber.type = REACT_PROFILER_TYPE;
  fiber.expirationTime = expirationTime;

  return fiber;
}

export function createFiberFromSuspense(
  pendingProps: any,
  mode: TypeOfMode,
  expirationTime: ExpirationTime,
  key: null | string,
) {
  const fiber = createFiber(SuspenseComponent, pendingProps, key, mode);

  // TODO: The SuspenseComponent fiber shouldn't have a type. It has a tag.
  // This needs to be fixed in getComponentName so that it relies on the tag
  // instead.
  fiber.type = REACT_SUSPENSE_TYPE;
  fiber.elementType = REACT_SUSPENSE_TYPE;

  fiber.expirationTime = expirationTime;
  return fiber;
}

export function createFiberFromSuspenseList(
  pendingProps: any,
  mode: TypeOfMode,
  expirationTime: ExpirationTime,
  key: null | string,
) {
  const fiber = createFiber(SuspenseListComponent, pendingProps, key, mode);
  if (__DEV__) {
    // TODO: The SuspenseListComponent fiber shouldn't have a type. It has a tag.
    // This needs to be fixed in getComponentName so that it relies on the tag
    // instead.
    fiber.type = REACT_SUSPENSE_LIST_TYPE;
  }
  fiber.elementType = REACT_SUSPENSE_LIST_TYPE;
  fiber.expirationTime = expirationTime;
  return fiber;
}

export function createFiberFromText(
  content: string,
  mode: TypeOfMode,
  expirationTime: ExpirationTime,
): Fiber {
  const fiber = createFiber(HostText, content, null, mode);
  fiber.expirationTime = expirationTime;
  return fiber;
}

export function createFiberFromHostInstanceForDeletion(): Fiber {
  const fiber = createFiber(HostComponent, null, null, NoMode);
  // TODO: These should not need a type.
  fiber.elementType = 'DELETED';
  fiber.type = 'DELETED';
  return fiber;
}

export function createFiberFromDehydratedFragment(
  dehydratedNode: SuspenseInstance,
): Fiber {
  const fiber = createFiber(DehydratedFragment, null, null, NoMode);
  fiber.stateNode = dehydratedNode;
  return fiber;
}

export function createFiberFromPortal(
  portal: ReactPortal,
  mode: TypeOfMode,
  expirationTime: ExpirationTime,
): Fiber {
  const pendingProps = portal.children !== null ? portal.children : [];
  const fiber = createFiber(HostPortal, pendingProps, portal.key, mode);
  fiber.expirationTime = expirationTime;
  fiber.stateNode = {
    containerInfo: portal.containerInfo,
    pendingChildren: null, // Used by persistent updates
    implementation: portal.implementation,
  };
  return fiber;
}

// Used for stashing WIP properties to replay failed work in DEV.
export function assignFiberPropertiesInDEV(
  target: Fiber | null,
  source: Fiber,
): Fiber {
  if (target === null) {
    // This Fiber's initial properties will always be overwritten.
    // We only use a Fiber to ensure the same hidden class so DEV isn't slow.
    target = createFiber(IndeterminateComponent, null, null, NoMode);
  }

  // This is intentionally written as a list of all properties.
  // We tried to use Object.assign() instead but this is called in
  // the hottest path, and Object.assign() was too slow:
  // https://github.com/facebook/react/issues/12502
  // This code is DEV-only so size is not a concern.

  target.tag = source.tag;
  target.key = source.key;
  target.elementType = source.elementType;
  target.type = source.type;
  target.stateNode = source.stateNode;
  target.return = source.return;
  target.child = source.child;
  target.sibling = source.sibling;
  target.index = source.index;
  target.ref = source.ref;
  target.pendingProps = source.pendingProps;
  target.memoizedProps = source.memoizedProps;
  target.updateQueue = source.updateQueue;
  target.memoizedState = source.memoizedState;
  target.dependencies = source.dependencies;
  target.mode = source.mode;
  target.effectTag = source.effectTag;
  target.nextEffect = source.nextEffect;
  target.firstEffect = source.firstEffect;
  target.lastEffect = source.lastEffect;
  target.expirationTime = source.expirationTime;
  target.childExpirationTime = source.childExpirationTime;
  target.alternate = source.alternate;
  if (enableProfilerTimer) {
    target.actualDuration = source.actualDuration;
    target.actualStartTime = source.actualStartTime;
    target.selfBaseDuration = source.selfBaseDuration;
    target.treeBaseDuration = source.treeBaseDuration;
  }
  if (enableUserTimingAPI) {
    target._debugID = source._debugID;
  }
  target._debugSource = source._debugSource;
  target._debugOwner = source._debugOwner;
  target._debugIsCurrentlyTiming = source._debugIsCurrentlyTiming;
  target._debugNeedsRemount = source._debugNeedsRemount;
  target._debugHookTypes = source._debugHookTypes;
  return target;
}
