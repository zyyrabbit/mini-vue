# 响应式原理

## Proxy

总所周知，vue2.x响应式是基于Object.defineProperty的数据劫持来实现，而在vue3.0 中则采用新的API Proxy来做数据劫持。

具体的Proxy 用法本文就不做详述了，具体可以参考[Proxy](https://es6.ruanyifeng.com/#docs/proxy)，这里简单介绍一下Proxy 优缺点。

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
    proObj.slice(1, 0, 4) // 插入一个数字4 ，会触发多次ary 数据劫持更新
    ```
## vue3.0 响应式原理解析

观察者模式（发布/订阅模式）


### 数据劫持

### 观察者

### 依赖收集

### ref、computed实现原理

#### ref实现原理

#### computed实现原理
