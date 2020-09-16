'use strict'
// 匹配结束标签
const EAD_TAG_REG = /^<\s*\/\s*([a-z-_]+)\s*>/i
// 匹配开始标签
const START_TAG_REG = /^<\s*([a-z-_]+)\s*([^>]*)>/i
// 判断是否为自闭和标签
const CLOSE_TAG_REG = /\/\s*$/
// 匹配属性
const ATTR_REG = /([\w-:]+)\s*(=\s*"([^"]+)")?/ig
// 判断是否为动态属性
const EXPRESS = /^:/
// 判断是否为指令
const DIRECTIVE = /^v-/
// 提取文本节点
const TEXT_REG = /^[^<>]+/

const TYPE = {
  START: 'start',
  ATTR: 'attr',
  CLOSE: 'close',
  END: 'end',
  TEXT: 'text',
  FRAGMENT: 'Fragment',
  EXPRESS: 'express',
  DIRECTIVE: 'directive'
}
/**
 *
 * 词法分析
 * @export
 * @param {*} originInput
 * @returns
 */
const tokenizer = (originInput) => {
  // 存储解析的token
  const tokens = []
  // 用于判断是否开、闭标签的栈
  const stack = []
  // 清除所有换行符，并复制输入的字符模板
  let input = originInput.replace(/\n|\r/g, '')
  /**
   * 通过不断其匹配标签、属性等，不断的去截取匹配后的字符串
   * 当最总字符串长度为零，表示全部完成模板的解析
   */
  while (input.length) {
    // 清除首尾的空格
    input = input.trim()
    // 开始标签
    if (START_TAG_REG.test(input)) {
      const match = input.match(START_TAG_REG)
      if (match) {
        const [str, tagName, attrs] = match
        // 截取剩余模板字符串
        input = input.slice(str.length)
        const attrsVal = []
        // 判断是否为自闭合标签
        if (!CLOSE_TAG_REG.test(attrs)) {
          stack.push(tagName)
          tokens.push({ type: TYPE.START, tag: tagName, attrs: attrsVal, })
        } else {
          attrs.replace(CLOSE_TAG_REG, '')
          tokens.push({ type: TYPE.CLOSE, tag: tagName, attrs: attrsVal, })
        }
        // 开始标签中，需要提取标签属性
        if (attrs) {
          let rst = ''
          while ((rst = ATTR_REG.exec(attrs)) !== null) {
            const [str, attrName, _, attrValue] = rst
            // 判断是否为表达式属性
            if (EXPRESS.test(attrName)) {
              attrsVal.push({ type: TYPE.EXPRESS, name: attrName.slice(1), value: attrValue })
              continue
            }
            // 指令类型
            if (DIRECTIVE.test(attrName)) {
              attrsVal.push({ type: TYPE.DIRECTIVE, name: `_${attrName.slice(2)}`, value: attrValue })
              continue
            }
            // 普通属性
            attrsVal.push({ type: TYPE.ATTR, name: attrName, value: attrValue, })
          }
        }
      }
      continue
    }
    // 文本内容
    if (TEXT_REG.test(input)) {
      const match = input.match(TEXT_REG)
      if (match) {
        const [str] = match
        input = input.slice(str.length)
        tokens.push({ type: TYPE.TEXT, value: str.trim(), })
      }
      continue
    }
    // 结束标签
    if (EAD_TAG_REG.test(input)) {
      const match = input.match(EAD_TAG_REG)
      if (match) {
        const [str, tagName] = match
        input = input.slice(str.length)
        const startTagName = stack.pop()
        // 判断是否和开始标签匹配
        if (startTagName !== tagName) {
          throw new Error(`标签不匹配: ${tagName}`)
        }
        tokens.push({ type: TYPE.END, tag: tagName, })
      }
      continue
    }
    throw new Error(`解析模板出错: ${input}`)
  }
  if (stack.length > 0) {
    throw new Error(`标签不匹配: ${stack.toString()}`)
  }
  return tokens
}

/**
 * 语法解析生成 AST抽象语法树
 *
 * @export
 * @param {*} tokens
 * @returns
 */
const parser = tokens => {
  const ast = {
    type: 'Fragment',
    children: []
  }
  const stack = [ast]
  let current = 0, // 当前tokenn索引
    token = null,
    len = tokens.length

  while (current < len) {
    token = tokens[current++]
    if (token.type === TYPE.START) {
      // 这里简单复制token 并加入children属性
      const node = Object.assign({
        children: []
      }, token)
      // 压入堆栈
      stack.push(node)
      continue
    }
    /**
     * 如果为结束标签的类型，则弹出栈当前节点 childNode
     * 我们可知它的父节点为当前栈的头部节点
     */
    if (token.type === TYPE.END) {
      const node = stack.pop()
      // 获取弹出节点的父节点
      const parent = stack[stack.length - 1]
      parent.children.push(node)
      continue
    }
    // 如果为自闭和节点 或者 文本节点，则直接放入父节点children 属性中
    if (token.type === TYPE.CLOSE || token.type === TYPE.TEXT) {
      // 获取弹出节点的父节点
      const parent = stack[stack.length - 1]
      parent.children.push(token)
      continue
    }
    throw new TypeError(token.type)
  }
  return ast
}

/**
 * 深度遍历AST语法树
 * @param {*} ast 
 * @param {*} visitor 
 */
const traverser = (ast, visitor) => {
  const traverseArray = (array, parent) => {
    array.forEach(child => {
      traverseNode(child, parent)
    })
  }
  const traverseNode = (node, parent) => {
    let methods = visitor[node.type]
    // 调用对应节点，遍历节点钩子函数
    if (methods && methods.enter) {
      methods.enter(node, parent)
    }
    switch (node.type) {
      case TYPE.FRAGMENT:
      case TYPE.START:
        traverseArray(node.children, node)
        break
      case TYPE.CLOSE:
      case TYPE.TEXT:
        break
      default:
        throw new TypeError(node.type)
    }
    if (methods && methods.exit) {
      methods.exit(node, parent)
    }
  }
  traverseNode(ast, null)
}

/**
 *
 * AST 树转换
 * @export
 * @param {*} ast
 * @returns
 */
const transformer = (ast) => {
  traverser(ast, {
    [TYPE.START]: {
      enter(node, parent) {
        if (node.attrs.length >= 0) {
          const directives = node.attrs.filter(item => item.type === TYPE.DIRECTIVE);
          node.directives = directives;
          node.attrs = node.attrs.filter(item => item.type !== TYPE.DIRECTIVE);
        }
      }
    },
    [TYPE.CLOSE]: {}
  })
  return ast
}
// _c 函数为创建VNode的函数 helper 函数
let _c = () => {}
const _show = {
  beforeMount(el, { value }) {
    el._vod = el.style.display === 'none' ? '' : el.style.display
    el.style.display = value ? el._vod : 'none'
  },
  updated(el, { value }) {
    // 实际还有新旧值比对才会更新
    el.style.display = value ? el._vod : 'none'
  },
}
// 模板编译函数
const _wDirective = (vnode, directives) => {
  if (!currentRenderingInstance) {
    return vnode
  }
  const instance = currentRenderingInstance.proxy
  vnode.dirs = directives.map(directive => {
    return {
      dir: directive.name,
      instance,
      value: directive.value
    }
  })
  return vnode
}
// 在特定时机触发指令钩子执行相关的逻辑
const invokeDirectiveHook = (vnode, prevVNode, instance, name) => {
  const bindings = vnode.dirs
  for (let i = 0; i < bindings.length; i++) {
    const binding = bindings[i]
    const hook = binding.dir[name]
    if (hook) {
      hook(vnode.el, binding, vnode)
    }
  }
}

/**
 * 转换后抽象语法树，生成转换后的代码
 * @param {*} node 
 */
const codeGenerator = (node) => {
  switch (node.type) {
    case TYPE.FRAGMENT: // 抽象语法的根节点
      return `return function () { return ${codeGenerator(node.children[0])} }`
    case TYPE.START:
      // _c 函数为创建VNode的函数
      const code = (
          `_c('${node.tag}', 
            {${node.attrs.map(codeGenerator)}},
            [${node.children.map(codeGenerator)}]
          )`
        );
      // 处理指令的情况
      if (node.directives && node.directives.length > 0) {
        return (`_wDirective(${code}, [${node.directives.map(codeGenerator)}])`)
      }
      return code;
    case TYPE.CLOSE: // 自闭合标签
      return (`_c('${node.tag}', {${node.attrs.map(codeGenerator)}})`)
    case TYPE.TEXT:
      return (`_c('${TYPE.TEXT}', {value: '${node.value}'})`)
    case TYPE.ATTR: // 属性
      return (`${node.name}: "${node.value}"`)
    case TYPE.EXPRESS: // 表达式
      return (`${node.name}: this.${node.value}`)
    case TYPE.DIRECTIVE: // 表达式
      return (`{ name: ${node.name}, value: this.${node.value}}`)
    default:
      throw new TypeError(node.type)
  }
}

/**
 * 编译模板，生成render 渲染函数
 * @param {*} input 
 */
const compile = input => {
  let tokens = tokenizer(input)
  let ast = parser(tokens)
  let newAst = transformer(ast)
  let code = codeGenerator(newAst)
  return new Function(code)()
}

// 基本 DOM 操作
const HostElement = {
  createElement: tag => document.createElement(tag),
  createTextNode: value => document.createTextNode(value),
  appendChild(parent, child, anchor) {
    if (anchor) {
      parent.insertBefore(child, anchor)
    } else {
      parent.appendChild(child)
    }
  },
  parentNode: node => node.parentNode,
  getNextNode: node => node.nextSibling,
  remove: child => {
    const parent = child.parentNode
    if (parent) {
      parent.removeChild(child)
    }
  }
}

/**
 * reactivity 数据响应式相关代码
 */
const isObject = (val) => val !== null && typeof val === 'object'
const hasOwnProperty = Object.prototype.hasOwnProperty
const hasOwn = (obj, key) => hasOwnProperty.call(obj, key)

const toRaw = new WeakMap()
const toProxy = new WeakMap()
const targetMap = new Map()

let activeEffect
let shouldTrack = true
const trackStack = []
// 依赖收集
const effectStack = []
// 暂停依赖收集
const pauseTracking = () => {
  trackStack.push(shouldTrack)
  shouldTrack = false
}
// 重置依赖收集
const resetTracking = () => {
  const last = trackStack.pop()
  shouldTrack = last === undefined ? true : last
}
// 清除依赖
const cleanup = (effect) => {
  const { deps } = effect
  if (deps.length) {
    for (let i = 0; i < deps.length; i++) {
      deps[i].delete(effect)
    }
    deps.length = 0
  }
}

// 调度执行
const run = (effect, fn) => {
  if (!effectStack.includes(effect)) {
    cleanup(effect)
    try {
      effectStack.push(effect)
      activeEffect = effect
      return fn()
    } finally {
      effectStack.pop()
      activeEffect = effectStack[effectStack.length - 1]
    }
  }
}

// 依赖收集
const track = (target, key) => {
  if (!shouldTrack || activeEffect === undefined) {
    return
  }
  let depsMap = targetMap.get(target)
  if (!depsMap) {
    targetMap.set(target, (depsMap = new Map()))
  }
  let dep = depsMap.get(key)
  if (!dep) {
    depsMap.set(key, (dep = new Set()))
  }
  if (!dep.has(activeEffect)) {
    dep.add(activeEffect)
    activeEffect.deps.push(dep)
  }
}

// 触发执行
const trigger = (target, key) => {
  const depsMap = targetMap.get(target)
  if (!depsMap) {
    return
  }
  const effectsToAdd = depsMap.get(key)
  const effects = new Set()
  // 必须这样复制，否则在cleanup的时候会导致set forEach异常
  effectsToAdd.forEach(effect => {
    effects.add(effect)
  })
  effects.forEach(effect => {
    if (effect.option.scheduler) {
      effect.option.scheduler(effect)
    } else {
      effect()
    }
  })
}

let uuid = 0

// 创建响应式
const createEffect = (fn, option) => {
  const effect = function () {
    run(effect, fn)
  }
  effect.uuid = uuid++
  effect.deps = []
  effect.option = option
  return effect
}

const effect = (fn, option = {}) => {
  const effect = createEffect(fn, option)
  if (!option.lazy) {
    effect()
  }
  return effect
}

// 设置响应式
const reactive = (obj, shallow = false) => {
  // 如果已经是代理过的对象，直接返回代理对象
  if (toProxy.has(obj)) {
    return toProxy.get(obj)
  }
  // 如果已经是代理对象，直接返回代理对象
  if (toRaw.has(obj)) {
    return obj
  }
  // 注意Proxy 只能代理到一层
  const proxy = new Proxy(obj, {
    get(target, key, receiver) {
      track(target, key)
      const value = Reflect.get(target, key, receiver)
      if (shallow) return value
      return isObject(value) ? reactive(value) : value
    },
    set(target, key, value, receiver) {
      const oldValue = Reflect.get(target, key, receiver)
      value = toRaw.get(value) || value
      const observed = Reflect.set(target, key, value, receiver)
      // 解决数组多次触发问题
      if (!hasOwn(target, key)) {
        trigger(target, key)
      } else if (value !== oldValue) {
        trigger(target, key)
      }
      if (!targetMap.has(target)) {
        targetMap.set(target, new Map())
      }
      return observed
    }
  })
  toRaw.set(proxy, obj)
  toProxy.set(obj, proxy)
  return proxy
}
// 浅响应式
const shallowReactive = (obj) => {
  return reactive(obj, true)
}

// 组件调度 - 目前没处理无线递归处理
const queue = []
let flushIndex = 0

const pendingPostFlushCbs = []
let activePostFlushCbs = null
let postFlushIndex = 0

let isFlushPending = false
let isFlushing = false
const resolvedPromise = Promise.resolve()
const getId = (job) => job.id == null ? Infinity : job.id

const flushPostFlushCbs = () => {
  if (pendingPostFlushCbs.length) {
    const deduped = [...new Set(pendingPostFlushCbs)]
    pendingPostFlushCbs.length = 0
    // #1947 already has active queue, nested flushPostFlushCbs call
    if (activePostFlushCbs) {
      activePostFlushCbs.push(...deduped)
      return
    }
    activePostFlushCbs = deduped
    activePostFlushCbs.sort((a, b) => getId(a) - getId(b))
    for (postFlushIndex = 0; postFlushIndex < activePostFlushCbs.length; postFlushIndex++) {
      activePostFlushCbs[postFlushIndex]()
    }
    activePostFlushCbs = null
    postFlushIndex = 0
  }
}

const flushJobs =  () => {
  isFlushPending = false
  isFlushing = true
  // 排序job
  queue.sort((a, b) => getId(a) - getId(b))
  try {
    for (flushIndex = 0; flushIndex < queue.length; flushIndex++) {
      const job = queue[flushIndex]
      job && job()
    }
  } finally {
    flushIndex = 0
    queue.length = 0
    flushPostFlushCbs()
    isFlushing = false
    if (queue.length || pendingPostFlushCbs.length) {
      flushJobs()
    }
  }
}

// 异步更新
const queueFlush = () => {
  if (!isFlushing && !isFlushPending) {
    isFlushPending = true
    resolvedPromise.then(flushJobs)
  }
}

const queueCb = (cb, activeQueue, pendingQueue, index) => {
  if (!activeQueue || !activeQueue.includes(cb, index)) {
    pendingQueue.push(cb)
  }
  queueFlush()
}

const queuePostFlushCb = (cb) => {
  queueCb(cb, activePostFlushCbs, pendingPostFlushCbs, postFlushIndex)
}

// 异步调度
const queueJob = (job) => {
  if (!queue.includes(job, flushIndex)) {
    queue.push(job)
    queueFlush()
  }
}

// 当前渲染组件实例
let currentRenderingInstance
/**
 * 将组件实例作为render函数的渲染上下文，生成组件VNode树
 * @param {组件实例} instance 
 */
const renderComponentRoot = (instance) => {
  // 这里proxy 属性，其实代理的正是instance实例自身的实例
  const proxyToUse = instance.proxy
  currentRenderingInstance = instance
  const subTree = instance.render.call(proxyToUse, proxyToUse)
  currentRenderingInstance = null
  return subTree
}
/**
 * 更新组件之前，利用新的VNode节点，更新组件的props、attrs,做一些初始化操作
 * @param {组件实例} instance 
 * @param {组件新的VNode节点} nextVNode 
 */
const updateComponentPreRender = (instance, nextVNode) => {
  nextVNode.component = instance
  instance.vnode = nextVNode
  instance.next = null
  const { type, props, attrs } = instance
  // 获取组件定义的props
  const optionsProps = type.props
  // 获取元素的所有的props
  const rawProps = nextVNode.props
  if (rawProps) {
    for (const key in rawProps) {
      const value = rawProps[key]
      // 判断是否为组件定义的Props
      if (hasOwn(optionsProps, key)) {
        props[key] = value
      } else {
        attrs[key] = value
      }
    }
  }
}
/**
 * 渲染组件子树，并进行依赖收集
 * @param {*} instance 
 * @param {*} initialVNode 
 * @param {*} anchor 
 * @param {*} container 
 */
const setupRenderEffect = (instance, initialVNode, anchor, container) => {
  instance.update = effect(function componentEffect() {
    // 判断是否挂载
    if (!instance.isMounted) {
      const subTree = (instance.subTree = renderComponentRoot(instance))
      // 根据组件子VNode 树，渲染组件
      patch(null, subTree, container, anchor, instance)
      initialVNode.el = subTree.el
      instance.isMounted = true
    } else {
      let { next, vnode } = instance
      // next存在，表明更新是由父组件更新，触发子组件更新
      if (next) {
        updateComponentPreRender(instance, next)
      } else {
        // 组件内部数据变化引起的组件更新
        next = vnode
      }
      // 渲染生成新的子树
      const nextTree = renderComponentRoot(instance)
      const prevTree = instance.subTree
      // 更新引用
      instance.subTree = nextTree
      next.el = vnode.el
      patch(
        prevTree,
        nextTree,
        HostElement.parentNode(prevTree.el),
        HostElement.getNextNode(prevTree),
        instance,
      )
      next.el = nextTree.el
    }
  }, { scheduler: (effect) => queueJob(effect) } )
}

const EMPTY_OBJ = {}
/**
 * 根据组件Vnode 节点生成组件实例
 * @param {*} vnode 
 * @param {*} parent 
 */
const createComponentInstance = (vnode, parent) => {
  const appContext = (parent ? parent.appContext : vnode.appContext) || EMPTY_OBJ
  const instance = {
    vnode,
    parent,
    appContext,
    type: vnode.type,
    root: null,
    subTree: null,
    update: null,
    render: null,
    proxy: null,
    // state
    ctx: EMPTY_OBJ,
    data: EMPTY_OBJ,
    props: EMPTY_OBJ,
    attrs: EMPTY_OBJ,
    setupState: EMPTY_OBJ,
    setupContext: null,
    // 全局组件和指令的继承
    components: Object.create(appContext.components),
    directives: Object.create(appContext.directives),
    emit: null
  }
  // 这里ctx 属性，是为了渲染模板的时候，将instance自身作为上下文
  instance.ctx = { _: instance }
  return instance
}
// 跟新DOM Prop属性
const hostPatchProp = (el, key, prevValue, nextValue, parentComponent) => {
  if (prevValue !== nextValue) {
    el.setAttribute(key, nextValue)
  }
}
// 挂载children -- 优化 diff 算法
const mountChildren = (children, container, anchor, parentComponent, start = 0) => {
  for (let i = start; i < children.length; i++) {
    const child = children[i]
    patch(null, child, container, anchor, parentComponent)
  }
}
// 挂载元素
const mountElement = (vnode, container, anchor, parentComponent) => {
  const { type, props, children, dirs } = vnode
  let el
  // 文本节点特殊处理
  if (type === 'text') {
    el = vnode.el = HostElement.createTextNode(props.value)
  } else {
    el = vnode.el = HostElement.createElement(type)
    if (children) {
      mountChildren(vnode.children, el, null, parentComponent)
    }
    if (props) {
      for (const key in props) {
        hostPatchProp(el, key, null, props[key], vnode.children, parentComponent)
      }
    }
  }
  // 指令处理
  if (dirs) {
    invokeDirectiveHook(vnode, null, parentComponent, 'beforeMount')
  }
  // 插入DOM
  HostElement.appendChild(container, el, anchor)
}
// 更新组件Props
const patchProps = (el, vnode, oldProps, newProps, parentComponent) => {
  if (oldProps !== newProps) {
    for (const key in newProps) {
      const next = newProps[key]
      const prev = oldProps[key]
      if (next !== prev) {
        hostPatchProp(el, key, prev, next, parentComponent)
      }
    }
    if (oldProps !== EMPTY_OBJ) {
      for (const key in oldProps) {
        if (!(key in newProps)) {
          hostPatchProp(el, key, oldProps[key], null, parentComponent)
        }
      }
    }
  }
}
// 组件初次挂载时候，props初始化
const initProps = (instance, rawProps) => {
  const props = {}
  const attrs = {}
  const { type } = instance
  const optionsProps = type.props
  if (rawProps) {
    for (const key in rawProps) {
      const value = rawProps[key]
      if (hasOwn(optionsProps, key)) {
        props[key] = value
      } else {
        attrs[key] = value
      }
    }
  }
  // 浅响应
  instance.props = shallowReactive(props)
  instance.attrs = attrs
}
// 移除Dom元素
const unmount = (vnode, parentComponent, doRemove = false) => {
  const { type, props, children } = vnode
  if (doRemove) {
    HostElement.remove(vnode)
  }
}

const unmountChildren = (children, parentComponent, doRemove = false, start = 0) => {
  for (let i = start; i < children.length; i++) {
    unmount(children[i], parentComponent, doRemove)
  }
}

const EMPTY_ARR = []
/**
 * VNode 子节点比对函数，这里简单逐个比对，Vue 3.0源码中实际采用更优的算法复杂度比对
 * @param {*} n1 
 * @param {*} n2 
 * @param {*} container 
 * @param {*} anchor 
 * @param {*} parentComponent 
 */
const patchChildren = (n1, n2, container, anchor, parentComponent) => {
  let c1 = n1 && n1.children
  let c2 = n2.children
  c1 = c1 || EMPTY_ARR
  c2 = c2 || EMPTY_ARR
  const oldLength = c1.length
  const newLength = c2.length
  const commonLength = Math.min(oldLength, newLength)
  for (let i = 0; i < commonLength; i++) {
    patch(c1[i], c2[i], container, null, parentComponent)
  }
  if (oldLength > newLength) {
    // 移除老的节点
    unmountChildren(c1, parentComponent, true, commonLength)
  } else {
    // 挂载新的节点
    mountChildren(c2, container, anchor, parentComponent, commonLength)
  }
  return
}
// 更新元素
const patchElement = (n1, n2, parentComponent) => {
  const el = (n2.el = n1.el)
  const { dirs } = n2
  const oldProps = (n1 && n1.props) || EMPTY_OBJ
  const newProps = n2.props || EMPTY_OBJ
  patchProps(el, n2, oldProps, newProps, parentComponent)
  patchChildren(n1, n2, el, null, parentComponent)
  queuePostFlushCb(() => {
    dirs && invokeDirectiveHook(n2, n1, parentComponent, 'updated')
  })
}

const processElement = (n1, n2, container, anchor, parentComponent) => {
  // n1 为null表示为挂载元素
  if (n1 === null) {
    mountElement(n2, container, anchor, parentComponent)
  } else {
    patchElement(n1, n2, parentComponent)
  }
}
/**
 * 在生成组件实例之后，render函数渲染之前，组件实例进行初始化设置
 * @param {*} instance 
 */
const setupComponent = (instance) => {
  // 设置组件 props
  const { props } = instance.vnode
  initProps(instance, props)
  // 设置模板渲染render函数
  const Component = instance.type
  if (!Component.render && Component.template && compile) {
    Component.render = compile(Component.template)
  }
  if (!Component.render) {
    throw Error('请检查模板是否正确')
  }
  instance.render = Component.render
  // render  函数调用时的渲染上下文
  instance.proxy = new Proxy(instance.ctx, {
    get({ _: instance }, key) {
      const { data, setupState, props } = instance
      // setupState 优先
      if (setupState[key] && hasOwn(setupState, key)) {
        return setupState[key]
      } else if (setupState[key] && hasOwn(setupState, key)) {
        return data[key]
      } else if (props[key] && hasOwn(props, key)) {
        return props[key]
      }
    },
    set({ _: instance }, key, val) {
      const { data, setupState } = instance
      if (setupState[key] && hasOwn(setupState, key)) {
        setupState[key] = val
      } else if (setupState[key] && hasOwn(setupState, key)) {
        data[key] = val
      } else if (props[key] && hasOwn(props, key)) {
        console.error(`can't modify the props`)
      }
    },
  })
  const { setup, data } = Component
  if (setup) {
    pauseTracking()
    const setupResult = setup()
    resetTracking()
    instance.setupState = reactive(setupResult)
  }
  if (data) {
    const publicThis = instance.proxy
    if (typeof data !== 'function') {
      console.error('data must be funtion')
      return
    }
    const dataValue = data.call(publicThis, publicThis)
    instance.data = reactive(dataValue)
  }
}
// 挂载组件
const mountComponent = (initialVNode, container, anchor, parentComponent) => {
  // 生成组件实例
  const instance = (initialVNode.component = createComponentInstance(initialVNode, parentComponent))
  // 组件实例初始化，主要为 render render函数的proxy
  setupComponent(instance, initialVNode)
  // 渲染组件
  setupRenderEffect(instance, initialVNode, anchor, container)
}

const updateComponent = (n1, n2) => {
  // component 组件实例
  const instance = (n2.component = n1.component)
  instance.next = n2
  instance.update()
}

const processComponent = (n1, n2, container, ancher, parentComponent) => {
  // n1  为null 表示挂载组件
  if (n1 === null) {
    mountComponent(n2, container, ancher, parentComponent)
  } else {
    updateComponent(n1, n2)
  }
}

const patch = (n1, n2, container, ancher, parentComponent) => {
  const { type } = n2
  // 这里简单判断是否为组件节点
  if (typeof type === 'object') {
    processComponent(n1, n2, container, ancher, parentComponent)
  } else {
    processElement(n1, n2, container, ancher, parentComponent)
  }
}
// 渲染函数
const render = (vnode, container, parentComponent) => {
  patch(container._vnode || null, vnode, container, null, parentComponent)
  container._vnode = vnode
}

const camelizeRE = /-(\w)/g
const camelize = str => str.replace(camelizeRE, (_, c) => (c ? c.toUpperCase() : ''))
const capitalize = str => str.charAt(0).toUpperCase() + str.slice(1)
// 用于渲染函数中，解析组件、同理指令也是在render渲染函数进行处理
const resolveComponnet = (name) => {
  if (typeof name !== 'string') return
  if (currentRenderingInstance) {
    const components = currentRenderingInstance.components
    return components[name]
      || components[(name = camelize(name))]
      || components[capitalize(name)]
  }
}
// 创建Vnode
const createVNode = (type, props, children) => {
  // 解析组件
  type = resolveComponnet(type) || type;
  if (props) {
    props = Object.assign({}, props)
  }
  const vnode = {
    type,
    props,
    children: children,
    component: null, // 组件实例
    appContext: null
  }
  return vnode
}
// 创建Vue App 上下文，主要为全局组件、指令、mixins等
const createAppContext = () => {
  return {
    mixins: [],
    components: {},
    directives: {},
  }
}

_c = createVNode

const createApp = (rootComponent, rootProps = null) => {
  // 创建App上下文
  const context = createAppContext()
  const app = {
    _component: rootComponent,
    _props: rootProps,
    _container: null,
    _context: context,
    component(name, component) {
      if (!component) {
        return context.components[name]
      }
      context.components[name] = component
      return app
    },
    mount(rootContainer) {
      if (typeof rootContainer === 'string') {
        rootContainer = document.querySelector(rootContainer)
      }
      if (!rootContainer) {
        throw Error('App container element is undefined')
      }
      rootContainer.innerHTML = ''
      // 创建根组件的Vnode
      const vnode = createVNode(rootComponent, rootProps)
      vnode.appContext = context
      // 渲染App
      render(vnode, rootContainer, null)
      return vnode.component.proxy
    }
  }
  return app
}

