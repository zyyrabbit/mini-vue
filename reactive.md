# 响应式原理

## Proxy

众所周知，vue2.x响应式是基于Object.defineProperty的数据劫持来实现的，而在vue3.0 中则采用新的ES6 API Proxy来做数据劫持。

具体的Proxy用法本文就不做详述了，具体可以参考[Proxy](https://es6.ruanyifeng.com/#docs/proxy)，这里简单介绍一下Proxy 优缺点。

 优点：

 - 可以劫持对象新加属性
   ```js
    const obj = {
       a: 1
    }
    const proObj = new Proxy(obj, ...)
    proObj[b] = 2 // Object.defineProperty 是不能劫持的，而Proxy 可以劫持
   ```
 - 可以劫持数组的push、shift等相关操作
   ```js
    const ary = [1]
    const proObj = new Proxy(ary, ...)
    proObj[1] = 2 // Object.defineProperty 是不能劫持的，而Proxy 可以劫持
    ```

 缺点：
  
  - 不能深度劫持对象属性
  - 可能会触发多次的数据劫持调用
   ```js
    const ary = [1, 2, 3]
    const proObj = new Proxy(ary, ...)
    proObj.slice(1, 0, 4) // 插入一个数字4 ，会触发多次proObj 数据劫持更新
    ```
## vue3.0 响应式原理解析

在分析vue 响应式原理时，需要时刻牢记观察者模式（发布/订阅模式）。很简单理解，就是一个对象存储回调，然后在适当时机触发回调。
本质的思想还是比较简单。接下来，我们简单实现一个数据响应式功能。


### 数据劫持

这里主要是做数据拦截，当渲染模板时候，访问响应式数据时，会做依赖收集。简单实现如下，代码都有详细注释

```js
// 一些辅助工具函数
const isObject = (val) => val !== null && typeof val === 'object'
const hasOwnProperty = Object.prototype.hasOwnProperty
const hasOwn = (obj, key) => hasOwnProperty.call(obj, key)

const toRaw = new WeakMap() // raw -> proxy 对象映射
const toProxy = new WeakMap() // proxy -> raw 对象映射
const targetMap = new Map() // 回调收集Map

// 设置响应式
const reactive = (obj) => {
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
      track(target, key) // 这里是依赖收集，具体逻辑见下文
      const value = Reflect.get(target, key, receiver)
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
        // 设置对象回调函数Map
        targetMap.set(target, new Map())
      }
      return observed
    }
  })
  toRaw.set(proxy, obj)
  toProxy.set(obj, proxy)
  return proxy
}
```

### 依赖收集

```js
// 依赖收集
const track = (target, key) => {
  // 获取对象回调函数Map
  let depsMap = targetMap.get(target)
  if (!depsMap) {
    targetMap.set(target, (depsMap = new Map()))
  }
  // 获取对象，对应属性的回调函数Set
  let dep = depsMap.get(key)
  if (!dep) {
    depsMap.set(key, (dep = new Set()))
  }
  // 这里的 activeEffect 其实就是渲染函数，你可以认为就是 render 函数
  if (!dep.has(activeEffect)) {
    dep.add(activeEffect)
  }
}

```

### 触发执行

```js
// 这里触发执行触发执行
const trigger = (target, key) => {
  const depsMap = targetMap.get(target)
  if (!depsMap) {
    return
  }
  const effects = depsMap.get(key)
  effects.forEach(effect => effect())
}
```

简单举个例子说明一下：

```js
// 例如将如下数据设置响应式
const data = {
  a: 1
}
// 设置数据响应式
const proxyData = reactive(data);

// 此时

toProxy = {
  data: proxyData
}

toRaw = {
  proxyData: data
}

// 当我们访问数据属性时候

activeEffect = () => {
  console.log(proxyData.a)
}
activeEffect()

// 会收集回调函数 activeEffect
targetMap = {
  data: {
    a: [activeEffect]
  }
}

// 我们改变响应数据
proxyData.a = 2

// 则会触发执行，开始重新收集依赖
targetMap[data][a].forEach(cb => cb())

```

以上只是简单说明vue3.0 响应式核心原理，vue 3.0数据源代码实现复杂的多，有兴趣同学可以自行了解。有了上面基础，想必会更加容易了

### ref、computed实现原理

介绍一个数据响应式原理，这里再简单介绍一下ref、computed的原理

#### ref实现原理

##### 为什么会需要ref函数？

> 因为reactive 和 ref满足两种代码风格

 1. reactive 风格

 ```js
 const reac = reactive({
   a: 1,
   b: 2
 })

 ```

 2. ref 风格

 ```js
  const a = ref(1)
  const b = ref(2)
 ```
 一个典型实际应用例子，比如我们经常在页面设置各种loading，控制加载。

 ```js

 // 风格1
 const loading = {
   a: false,
   b: false
 }
// 风格2
 let loadingA = false
 let loadingB = false

 ```

##### ref 源码分析

```js
  function ref(raw) {
    // 判断是否已经经过ref 处理
    if (isRef(raw)) {
      return raw
    }
    // 如果值为对象，设置数据响应式
    raw = reactive(raw)
    const r = {
      _isRef: true,
      get value() {
        // 依赖收集
        track(r, TrackOpTypes.GET, 'value')
        return raw
      },
      set value(newVal) {
        raw = reactive(newVal)
        // 触发响应式回调
        trigger(
          r,
          TriggerOpTypes.SET,
          'value',
        )
      }
    }
    return r
  }
```

其实ref实现原理比较简单，就是在原始数据外面再包一层代理，实现响应式

##### computed实现原理

以下为 computed 简单实现代码

```js
function computed(getterOrOptions)
  let getter
  let setter
  // 参数如果为函数的话，默认为getter 函数
  if (isFunction(getterOrOptions)) {
    getter = getterOrOptions
    setter = () => {
        console.warn('Write operation failed: computed value is readonly')
      }
     
  } else {
    getter = getterOrOptions.get
    setter = getterOrOptions.set
  }

  let dirty = true
  let value
  // effect 等价于 vue2.x 中 watcher
  const runner = effect(getter, {
    lazy: true, // 不会立即执行，所以computed 可以起到缓存的作用
    computed: true,
    scheduler: () => {
      dirty = true
    }
  })
  return {
    _isRef: true,
    get value() {
      // 为dirty时候才会重新求值
      if (dirty) {
        value = runner()
        dirty = false
      }
      // 具体作用见下文分析
      trackChildRun(runner)
      return value
    },
    set value(newValue: T) {
      setter(newValue)
    }
  }
}
```

1. 举例分析：

```js

const b = reactive({ a: 1})
const c = computed(() => b.a)

```

当改变b的值时候，如 b.a = 2。此时只会触发computed的scheduler，设置dirty =true

只有当访问 c.value 值时，才会触发computed的get代理，执行runner函数，重新计算求值

2. trackChildRun作用：实现链式计算属性，父effect会记录computed的runner记录的dep回调函数，从而实现链式计算属性

这里举个例子说明，会更清晰一些

```js
const obj = {a: 1}
const objProxy = reactive(obj)
const comp = computed(() =>  { console.log(objProxy.a)} )

// 当我们访问 comp
comp.value

// obj1 响应式依赖收集时，获得计算属性的 runner函数，作为回调
targetMap[obj].a = [runner]

// 渲染模板
//<div>{{comp.value}}</div>

// 调用render 函数后
targetMap[obj].a = [runner, render]

objProxy.a = 2

同时触发计算属性表达式重新求值、模板更新，达到链式调用

```

