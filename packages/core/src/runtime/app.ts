import type { LazyVNode, VNode } from '@local/jsx-factory'
import { runEffect } from './reactive-system'
import { ActViewComponent } from '../types'
import { patch } from './patch'

class App {
  private rootComponent: ActViewComponent | null
  constructor(){
    this.rootComponent = null
  }
  public createApp(rootComponent: ActViewComponent){
    this.rootComponent = rootComponent
    return this
  }
  public mount(selector: string) {
    const container = document.querySelector(selector)
    if(!container) return
    if(!this.rootComponent) return
    const render = this.rootComponent()
    let oldVnode: VNode | null = null
    runEffect(()=>{
      const newVnode = render()
      patch(oldVnode, newVnode, container)
    })
  }
}