'use strict'
const EAD_TAG_REG = /^<\s*\/\s*([a-z-_]+)\s*>/i
const START_TAG_REG = /^<\s*([a-z-_]+)\s*([^>]*)>/i
const CLOSE_TAG_REG = /\/\s*$/
const ATTR_REG = /([\w:]+)\s*(=\s*"([^"]+)")?/ig
const EXPRESS = /^:/
const TEXT_REG = /^[^<>]+/

const TYPE = {
  START: 'start',
  ATTR: 'attr',
  CLOSE: 'close',
  END: 'end',
  TEXT: 'text',
  FRAGMENT: 'Fragment',
  EXPRESS: 'express'
}
/**
 *
 * 词法分析
 * @export
 * @param {*} originInput
 * @returns
 */
const tokenizer = (originInput) => {
  // 字符串解析时的字符索引
  const tokens = []
  const stack = []
  // 清楚所有换行符
  let input = originInput.replace(/\n|\r/g, '')
  while (input.length) {
    input = input.trim()
    // 开始标签
    if (START_TAG_REG.test(input)) {
      const match = input.match(START_TAG_REG)
      if (match) {
        const [str, tagName, attrs] = match
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
        if (attrs) {
          let rst = ''
          while ((rst = ATTR_REG.exec(attrs)) !== null) {
            const [str, attrName, _, attrValue] = rst
            // 判断是否为表达式属性
            if (EXPRESS.test(attrName)) {
              attrsVal.push({ type: TYPE.EXPRESS, name: attrName.slice(1), value: attrValue, })
              continue
            }
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
    // 结束标签标签
    if (EAD_TAG_REG.test(input)) {
      const match = input.match(EAD_TAG_REG)
      if (match) {
        const [str, tagName] = match
        input = input.slice(str.length)
        const startTagName = stack.pop()
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
 * 语法解析生成 AST
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
  let current = 0,
    token = null
  while (current < tokens.length) {
    token = tokens[current++]
    if (token.type === TYPE.START) {
      const node = Object.assign({
        children: []
      }, token)
      stack.push(node)
      continue
    }
    if (token.type === TYPE.END) {
      const node = stack.pop()
      const parent = stack[stack.length - 1]
      parent.children.push(node)
      continue
    }
    if (token.type === TYPE.CLOSE || token.type === TYPE.TEXT) {
      const parent = stack[stack.length - 1]
      parent.children.push(token)
      continue
    }
    throw new TypeError(token.type)
  }
  return ast
}

const traverser = (ast, visitor) => {
  function traverseArray(array, parent) {
    array.forEach(child => {
      traverseNode(child, parent)
    })
  }
  function traverseNode(node, parent) {
    let methods = visitor[node.type]
    if (methods && methods.enter) {
      methods.enter(node, parent)
    }
    switch (node.type) {
      case TYPE.START:
        traverseNode(node, parent)
        traverseArray(node.children, node)
        break
      case TYPE.CLOSE:
        traverseNode(node, parent)
        break
      case TYPE.FRAGMENT:
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
    [TYPE.START]: {},
    [TYPE.CLOSE]: {}
  })
  return ast
}

const codeGenerator = (node) => {
  switch (node.type) {
    case TYPE.FRAGMENT:
      // return node.children.map(codeGenerator).join('\n');
      return `return function () { return ${codeGenerator(node.children[0])} }`
    case TYPE.START:
      return (
        `_c('${node.tag}', 
          {${node.attrs.map(codeGenerator)}},
          [${node.children.map(codeGenerator)}]
        )`
       );
    case TYPE.CLOSE:
      return (`_c('${node.tag}', {${node.attrs.map(codeGenerator)}})`);
    case TYPE.TEXT:
      return (`_c('${TYPE.TEXT}', {value: '${node.value}'})`);
    case TYPE.ATTR:
      return (`${node.name}: "${node.value}"`);
    case TYPE.EXPRESS:
      return (`${node.name}: this.${node.value}`);
    default:
      throw new TypeError(node.type);
  }
}

let _c = () => {}

const compile = input => {
  let tokens = tokenizer(input)
  let ast    = parser(tokens)
  let newAst = transformer(ast)
  let code = codeGenerator(newAst)
  return new Function(code)()
}

// DOM 操作
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

// reactivity 数据响应式
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

const pauseTracking =  () => {
  trackStack.push(shouldTrack)
  shouldTrack = false
}

const resetTracking =  () => {
  const last = trackStack.pop()
  shouldTrack = last === undefined ? true : last
}

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
  if (!shouldTrack  || activeEffect === undefined) {
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
  // 必须这样复制，否则咋cleaup时候 会导致set forEach异常
  effectsToAdd.forEach(effect => {
    effects.add(effect)
  })
  effects.forEach(effect => effect())
}

let uuid = 0

// 创建响应式
const createEffect = (fn) => {
  const effect = function() {
    run(effect, fn)
  }
  effect.uuid = uuid++
  effect.deps = []
  return effect
}

const effect = (fn, option = {}) => {
  const effect = createEffect(fn)
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
    get (target, key, receiver) {
      track(target, key)
      const value = Reflect.get(target, key, receiver)
      if (shallow) return value
      return isObject(value) ? reactive(value) : value
    },
    set (target, key, value, receiver) {
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

const shallowReactive = (obj) => {
  return reactive(obj, true)
}

let currentRenderingInstance

const renderComponentRoot = (instance) => {
  const proxyToUse = instance.proxy
  currentRenderingInstance = instance
  const subTree = instance.render.call(proxyToUse, proxyToUse)
  currentRenderingInstance = null
  return subTree
}

const updateComponentPreRender = (instance, nextVNode) => {
  nextVNode.component = instance
  instance.vnode = nextVNode
  instance.next = null
  const { type, props, attrs } = instance
  const optionsProps = type.props
  const rawProps = nextVNode.props
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
}

const setupRenderEffect = (instance, initialVNode, anchor, container) => {
  instance.update = effect(function componentEffect() {
    if (!instance.isMounted) {
      const subTree = (instance.subTree = renderComponentRoot(instance))
      patch(null, subTree, container, anchor, instance)
      initialVNode.el = subTree.el
      instance.isMounted = true
    } else {
      let { next, vnode } = instance
       // 父组件更新
      if (next) {
        updateComponentPreRender(instance, next)
      } else {
        // 组件内部更新
        next = vnode
      }
      const nextTree = renderComponentRoot(instance)
      const prevTree = instance.subTree
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
  })
}

const EMPTY_OBJ = {}

const createComponentInstance = (vnode, parent) => {
  const appContext = (parent ? parent.appContext : vnode.appContext) || EMPTY_OBJ
  const instance = {
    vnode,
    parent,
    appContext,
    type: vnode.type,
    root: null, // to be immediately set
    subTree: null, // will be set synchronously right after creation
    update: null, // will be set synchronously right after creation
    render: null,
    proxy: null,
    // state
    ctx: EMPTY_OBJ,
    data: EMPTY_OBJ,
    props: EMPTY_OBJ,
    attrs: EMPTY_OBJ,
    setupState: EMPTY_OBJ,
    setupContext: null,
    // per-instance asset storage (mutable during options resolution)
    components: Object.create(appContext.components),
    directives: Object.create(appContext.directives),
    emit: null// to be set immediately
  }
  instance.ctx = { _: instance }
  return instance
}

const hostPatchProp = (el, key, prevValue, nextValue, parentComponent) => {
  if (prevValue !== nextValue) {
    el.setAttribute(key, nextValue)
  }
}

const mountChildren = (children, container, anchor, parentComponent, start = 0) => {
  for (let i = start; i < children.length; i++) {
    const child = children[i]
    patch(null, child, container, anchor, parentComponent)
  }
}

const mountElement = (vnode, container, anchor, parentComponent) => {
  const { type, props, children } = vnode
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
  // 插入DOM
  HostElement.appendChild(container, el, anchor)
}

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

const unmount = (vnode, parentComponent, doRemove = false) => {
  const {type, props, children} = vnode
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

const patchElement = (n1, n2, parentComponent) => {
  const el = (n2.el = n1.el)
  const oldProps = (n1 && n1.props) || EMPTY_OBJ
  const newProps = n2.props || EMPTY_OBJ
  patchProps(el, n2, oldProps, newProps, parentComponent)
  patchChildren(n1, n2, el, null, parentComponent)
}

const processElement = (n1, n2, container, anchor, parentComponent) => {
  if (n1 === null) {
    mountElement(n2, container, anchor, parentComponent)
  } else {
    patchElement(n1, n2, parentComponent)
  }
}

const setupComponent = (instance) => {
  // 设置组件 props
  const { props } = instance.vnode
  initProps(instance, props)
  // 设置渲染代理功能
  const Component = instance.type
  if (!Component.render && Component.template && compile) {
    Component.render = compile(Component.template)
  }
  if (!Component.render) {
    throw Error('请检查模板是否正确')
  }
  instance.render = Component.render
  instance.proxy = new Proxy(instance.ctx, {
    get({ _: instance }, key) {
      const { data, setupState, props } = instance
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

const mountComponent = (initialVNode, container, anchor, parentComponent) => {
  const instance = (initialVNode.component = createComponentInstance(initialVNode,  parentComponent))
  setupComponent(instance, initialVNode)
  setupRenderEffect(instance, initialVNode, anchor, container)
}

const updateComponent = (n1, n2) => {
  // component 组件实例
  const instance = (n2.component = n1.component)
  instance.next = n2
  instance.update()
}

const processComponent = (n1, n2, container, ancher, parentComponent) => {
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

const render = (vnode, container, parentComponent) => {
  patch(container._vnode || null, vnode, container, null, parentComponent)
  container._vnode = vnode
}

const camelizeRE = /-(\w)/g
const camelize = str => str.replace(camelizeRE, (_, c) => (c ? c.toUpperCase() : ''))
const capitalize = str => str.charAt(0).toUpperCase() + str.slice(1)
// 用于渲染函数中，解析组件，指令也是在render 函数中渲染
const resolveComponnet = (name) => {
  if (typeof name !== 'string') return
  if (currentRenderingInstance) {
    const components = currentRenderingInstance.components
    return components[name]
      || components[(name = camelize(name))]
      || components[capitalize(name)]
  }
}

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
      const vnode = createVNode(rootComponent, rootProps)
      vnode.appContext = context
      render(vnode, rootContainer, null)
      return vnode.component.proxy
    }
  }
  return app
}
