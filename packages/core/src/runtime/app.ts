import type { LazyVNode } from '@local/jsx-factory'
import { runEffect } from './reactive-system'
import { ActViewComponent } from '../types'

class App {
  private rootComponent: ActViewComponent | null
  constructor(){
    this.rootComponent = null
  }
  public createApp(rootComponent: ActViewComponent){
    this.rootComponent = rootComponent
    return this
  }
  public mount(rootContainer: string) {
    const container = document.querySelector('#app')
    if(!this.rootComponent) return
    const render = this.rootComponent()
    runEffect(()=>{
      let vnode = render()
      
    })
  }
}