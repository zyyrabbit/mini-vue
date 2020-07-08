
// 以下为测试代码
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

const app = createApp({
  template: `<div class="parent">
          <child-comp :class="propsData.class"></child-comp>
      </div>`,
  setup() {
    const propsData = reactive({
      class: 'before'
    })

    setInterval(() => {
      propsData.class = propsData.class === 'after' ? 'before' :  'after'
    }, 1000)

    return {
      propsData
    }
  }
})

app.component('ChildComp', childComp)
app.mount('#app')