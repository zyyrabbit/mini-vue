# mini-vue3.0

> 一个极简版本的vue3.0源码学习库，通过学习vue3.0核心实现逻辑，从而快速掌握vue3.0核心原理。当别人还在蹒跚学步，你已健步如飞。

写在前面，作为一个有追求的前端工程师，我们当然不满足于**vue API调用工程师**。需要学习vue 源码来提高自己的逼格。
走上人生巅峰，赢取白富美。然而学习vue3.0 源码又无从下手，真是愁死了。不要担心，mini-vue3.0 大大简化了vue3.0 源码实现。
我们只专注**核心逻辑实现**，让你轻松入门。我相信，通过mini-vue3.0学习，你再去看源码, So Easy.

mini-vue3.0 主要涵盖5个功能点：模板编译、数据响应式、组件挂载和更新、指令编译、组件异步调度更新：

1. [模板编译原理](https://github.com/zyyrabbit/mini-vue3.0/blob/master/compile.md)
2. [数据响应式原理](https://github.com/zyyrabbit/mini-vue3.0/blob/master/reactive.md)
3. [组件更新原理](https://github.com/zyyrabbit/mini-vue3.0/blob/master/component.md)
4. 指令编译及执行
5. 组件调度更新

Todo-list

- [ ] vue3.0 组件模板动静分离优化原理


vue 架构图

![vue 架构图](https://raw.githubusercontent.com/zyyrabbit/MarkdownPhotos/master/Res/Vue%E6%9E%B6%E6%9E%84%E5%9B%BE.jpg)


简单一点渲染过程图

![component渲染过程图](https://raw.githubusercontent.com/zyyrabbit/MarkdownPhotos/master/Res/compnent%E7%BB%84%E4%BB%B6%E6%B8%B2%E6%9F%93%E8%BF%87%E7%A8%8B.jpg)

复杂一点渲染过程图

![vue3.0组件初始化流程](https://raw.githubusercontent.com/zyyrabbit/MarkdownPhotos/master/Res/vue3.0%E7%BB%84%E4%BB%B6%E5%88%9D%E5%A7%8B%E5%8C%96%E6%B5%81%E7%A8%8B.jpg)

## Demo

在线demo地址: [mini-vue3.0 在线Demo演示](https://zyyrabbit.github.io/mini-vue3.0/)

html 页面代码

``` html
 <!--  模板代码， id=app 为元素挂载点 -->
  <div id="app"></div>
  <!--  引入mini-vue3.0 -->
  <script src="./mini-vue.js" type="text/javascript"></script>
  <!--  引入demo.js 代码 -->
  <script src="./demo.js" type="text/javascript"></script>
```

demo.js 代码

```js

// 子组件
const childComp = {
  props: {
    class: String
  },
  render() {
    return {
      type: 'div',
      props: {
        class: this.class,
      },
      children: [
        {
          type: 'text',
          props: {
            value: 'Hello Wrold'
          }
        }
      ]
    }
  }
}
// 启动App
const app = createApp({
  template: ` <div class="parent">
                <div style="text-align: center;margin-bottom: 20px">
                  <span v-show="propsData.show">响应式定时改变元素样式名，从而改变背景色</span>
                </div>
                <child-comp :class="propsData.class"></child-comp>
              </div>`,
  setup() {
    // 响应式
    const propsData = reactive({
      class: 'before',
      show: true
    })
    // 定时改变类名
    setInterval(() => {
      propsData.class = propsData.class === 'after' ? 'before' :  'after'
      propsData.show = !propsData.show
    }, 1000)

    return {
      propsData
    }
  }
})
// 注册全局组件
app.component('ChildComp', childComp)

// 挂载App，渲染App
app.mount('#app')
```




