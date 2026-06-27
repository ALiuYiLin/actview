

import { createElement } from '@local/jsx-factory/jsxFactory.js'

;(window as any).createElement = createElement
const a = 1
const app = <div>{a}</div>
console.log('app: ', app);