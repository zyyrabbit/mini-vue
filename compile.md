# 模板编译原理

首先简单介绍一下编译器的基本知识。总所周知，基本所有的编译器都可以分为三个阶段：Parsing、 Transformation、Code Generation

[模板编译的过程图]()

1. 第一阶段，解析字符模板生成tokens，根据tokens生成AST语法树
2. 第二阶段，遍历AST语法树，进行语法树节点处理，修改原来的AST语法树或者生成一棵全新的AST语法树
3. 第三阶段，遍历转换后的AST语法树，生成目标字符串代码

简单介绍编译器基本知识后，接下来我们编写一个简单Html字符串模板编译器，用于模板编译。为了更直观，
本文会结合一个例子，来简单说明模板编译的整个过程

## 模板解析生成AST语法树

```js
'use strict'
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
// 定义的AST语法树节点类型
const TYPE = {
  START: 'start',
  ATTR: 'attr',
  CLOSE: 'close', // 自闭和标签节点
  END: 'end',
  TEXT: 'text',
  FRAGMENT: 'Fragment',
  EXPRESS: 'express' // 表达式属性
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
  // 用于判断是否开、闭标签匹配的栈
  const stack = []
  // 清除所有换行符，并复制输入的字符模板
  let input = originInput.replace(/\n|\r/g, '')
  /**
   * 通过不断的匹配标签、属性等，每次匹配后去截取剩余的字符串
   * 当最终字符串长度为零时，则完成模板解析
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
        // 开始标签，需要提取标签属性
        if (attrs) {
          let rst = ''
          // 不断的提取属性
          while ((rst = ATTR_REG.exec(attrs)) !== null) {
            const [str, attrName, _, attrValue] = rst
            // 判断是否为表达式属性
            if (EXPRESS.test(attrName)) {
              attrsVal.push({ type: TYPE.EXPRESS, name: attrName.slice(1), value: attrValue, })
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
 * 根据tokens生成 AST抽象语法树
 *
 * @export
 * @param {*} tokens
 * @returns
 */
const parser = tokens => {
  // 根节点
  const ast = {
    type: 'Fragment',
    children: []
  }
  const stack = [ast]
  let current = 0, // 当前token的索引
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
    // 如果为自闭合节点 或者 文本节点，则直接放入父节点children 属性中
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

```

简单概括一下：

1. 输入字符串模板后，利用正则不断的提取定义的token, 生成tokens数组
2. 遍历tokens数组，构建一颗AST语法树

例如我们有如下的Html字符串：

```html
  <div class="app">
    <div class="content">mini-vue</div>
    <input :value="model"/>
  </div>
```
生成tokens数组如下：

```
```
根据得到的tokens，得到的AST语法树如下：

```
```


## 转换AST语法树

```js
/**
 * 深度遍历AST语法树
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
    // 调用对应节点，遍历节点钩子函数
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

```js
// _c 函数为创建VNode的函数
let _c = () => {}

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
```