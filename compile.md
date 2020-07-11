# 模板编译原理

> 写在前面，最近打算学习vue3.0 相关知识，本着学习一个东西，最好方法就是模仿写一个，所以自己动手写了一个简化版vue3.0. 感觉对vue3.0 或者 vue2.x核心原理的理解有很大帮助，所以分享出来。mini-vue3.0主要包括：模板编译、响应式、组件渲染过程等, 仓库地址[mini-vue3.0](https://github.com/zyyrabbit/mini-vue3.0)，欢迎star

先简单介绍一下编译原理的基本知识。众所周知，基本所有的现代编译器，整个编译过程可以分为三个阶段：Parsing(解析)、 Transformation(转换)、Code Generation(代码生成)

1. 第一阶段：解析字符模板生成tokens，根据tokens生成AST语法树
2. 第二阶段：遍历AST语法树，进行语法树节点处理，修改原有的AST语法树或者生成一棵全新的AST语法树
3. 第三阶段：遍历转换后的AST语法树，生成目标字符串代码

简单介绍了编译器的基本知识后，接下来我们编写一个简单的Html字符串模板编译器，用于模板编译。为了更直观，本文会结合一个简单的例子，来说明模板编译的整个过程

## 模板解析生成AST语法树

假如有如下的Html字符串：

```html
  <div class="app">
    <div class="content">mini-vue</div>
    <input :value="model"/>
  </div>
```

首先需要生成一个tokens数组，token相关的定义如下：

```js

// token 类型
enum TYPE {
  START = 'start', // 开始标签
  ATTR = 'attr', // 标签属性
  CLOSE = 'close', // 自闭合标签
  END = 'end', // 闭合标签
  TEXT = 'text', // 文本标签
  FRAGMENT = 'Fragment',
  EXPRESS = 'express' // 表达式属性
}

interface Token {
  tag: string;
  type: TYPE;
  value: string;
  name?: string; // 标签属性名称
}

// token匹配的正则表达式

// 匹配结束标签 例如 <div class="app">
const EAD_TAG_REG = /^<\s*\/\s*([a-z-_]+)\s*>/i
// 匹配开始标签 例如 </div>
const START_TAG_REG = /^<\s*([a-z-_]+)\s*([^>]*)>/i
// 判断是否为自闭和标签 例如  <input :value="model"/>
const CLOSE_TAG_REG = /\/\s*$/
// 匹配属性 例如 class="app"
const ATTR_REG = /([\w:]+)\s*(=\s*"([^"]+)")?/ig
// 判断是否为动态属性 例如 :value="model"
const EXPRESS = /^:/
// 提取文本节点 mini-vue
const TEXT_REG = /^[^<>]+/

```

tokens解析的步骤如下：

1. 利用正则，去除字符串的换行符，得到如下字符串

```js
 let input = `<div class="app">      <div class="content">mini-vue</div>      <input :value="model"/>    </div>`
```

2. 利用正则不断的提取token, 生成tokens数组

  首先匹配到开始标签，并提取标签属性，得到token如下

   ```js
    {
      tag: "div",
      type: "start",
      attrs: {
        type:"attr",
        name: "class",
        value:"app",
      }
    }
   ```
  同时得到剩余的未解析的字符串为:

  ```js
   input = `<div class="content">mini-vue</div>      <input :value="model"/>    </div>`
  ```
  不断从字符串开始处匹配token，同时截取剩余的字符串赋值为input，直到input 长度为空则表示解析完成

  具体代码实现过程，因为代码有点多，具体见代码仓库[mini-vue3.0](https://github.com/zyyrabbit/mini-vue3.0)，关于编译的部分

  最终生成tokens数组如下：

  ```js
   [{
    "type": "start",
    "tag": "div",
    "attrs": [{
        "type": "attr",
        "name": "class",
        "value": "app"
     }]
    }, {
        "type": "start",
        "tag": "div",
        "attrs": [{
            "type": "attr",
            "name": "class",
            "value": "content"
        }]
    }, {
        "type": "text",
        "value": "mini-vue"
    }, {
        "type": "end",
        "tag": "div"
    }, {
        "type": "close",
        "tag": "input",
        "attrs": [{
            "type": "express",
            "name": "value",
            "value": "model"
        }]
    }, {
        "type": "end",
        "tag": "div"
    }]
  ```


根据得到的tokens，遍历tokens数组，构建一颗AST语法树：

```js
{
  "type": "Fragment",
    "children": [{
      "type": "start",
      "tag": "div",
      "attrs": [{
        "type": "attr",
        "name": "class",
        "value": "app"
      }],
      "children": [{
        "type": "start",
        "tag": "div",
        "attrs": [{
          "type": "attr",
          "name": "class",
          "value": "content"
        }],
        "children": [{
          "type": "text",
          "value": "mini-vue"
        }]
      }, {
        "type": "close",
        "tag": "input",
        "attrs": [{
          "type": "express",
          "name": "value",
          "value": "model"
        }]
      }],
    }]
}
```

## 转换AST语法树

转换原理：其实就是遍历一颗树的节点，进行节点相应操作，从而完成相应的转换

本文的模板编译器暂时不需要转换，所以这里省略，具体代码实现过程:

```js
/**
 * 深度优先遍历AST语法树
 * @param {*} ast 
 * @param {*} visitor 
 */
const traverser = (ast, visitor) => {
  function traverseArray(array, parent) {
    array.forEach(child => {
      traverseNode(child, parent)
    })
  }
  function traverseNode(node, parent) {
    let methods = visitor[node.type]
    // 调用节点，进入钩子函数
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
```

## AST语法树生成render函数

代码生成的原理其实也是遍历一颗树，从而生成代码，实现代码如下所示:

```js

/**
 * 转换后抽象语法树，生成转换后的代码
 * @param {AST抽象语法树根节点} node 
 */
const codeGenerator = (node) => {
  switch (node.type) {
    case TYPE.FRAGMENT: // 抽象语法的根节点
      return `return function () { return ${codeGenerator(node.children[0])} }`
    case TYPE.START:
      // _c 函数为创建VNode的函数
      return (
        `_c('${node.tag}', 
          {${node.attrs.map(codeGenerator)}},
          [${node.children.map(codeGenerator)}]
        )`
       );
    case TYPE.CLOSE: // 自闭合标签
      return (`_c('${node.tag}', {${node.attrs.map(codeGenerator)}})`);
    case TYPE.TEXT:
      return (`_c('${TYPE.TEXT}', {value: '${node.value}'})`);
    case TYPE.ATTR: // 属性
      return (`${node.name}: "${node.value}"`);
    case TYPE.EXPRESS: // 表达式
      return (`${node.name}: this.${node.value}`);
    default:
      throw new TypeError(node.type);
  }
}

根据上面得到的AST抽象语法树，生成代码如下：

```js
let code = `
return function () { return _c('div', 
          {class: "app"},
          [_c('div', 
          {class: "content"},
          [_c('text', {value: 'mini-vue'})]
        ),_c('input', {value: this.model})]
        ) }`
```

将字符串转换为可执行代码，得到最终生成的render函数：

```js
let render = new Function(code)();

```

