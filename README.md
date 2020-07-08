# mini-vue3.0

> 一个极简版本的vue3.0源码，利用几百行代码从零构建vue3.0库，快速掌握vue3.0核心原理

mini-vue3.0 主要涵盖三个主要功能点：模板编译、数据响应式、组件挂载和更新等，文章链接：

1. [模板编译原理](https://github.com/zyyrabbit/mini-vue3.0/compile.md)
2. [数据响应式原理](https://github.com/zyyrabbit/mini-vue3.0/reactive.md)
3. [组件更新原理](https://github.com/zyyrabbit/mini-vue3.0/component.md)

Todo-list

[ ] 指令编译

[ ] 组件异步更新

## Demo

在线demo地址: [mini-vue3.0 在线Demo演示](https://github.com/zyyrabbit/mini-vue3.0/demo.html)

本地调试接入：

html 页面代码

``` html
 <!--  模板代码， id=app 为元素挂载点 -->
  <div id="app"></div>
  <!--  引入mini-vue3.0 -->
  <script src="./mini-vue.js" type="text/javascript"></script>
  <!--  引入demo.js 代码 -->
  <script src="./demo.js" type="text/javascript"></script>
```

demo js 代码

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
                <child-comp :class="propsData.class"></child-comp>
              </div>`,
  setup() {
    // 响应式
    const propsData = reactive({
      class: 'before'
    })
    // 定时改变类名
    setInterval(() => {
      propsData.class = propsData.class === 'after' ? 'before' :  'after'
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




