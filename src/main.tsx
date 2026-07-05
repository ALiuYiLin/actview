


import { reactive } from '@local/core'
import { runEffect } from '../packages/core/src/runtime/reactive-system'

const state = reactive({ count: 0, ok: false })


runEffect(()=>{
  if(!state.ok){
    console.log('count', state.count);
  }
})
state.count++
state.ok = true
state.count++


