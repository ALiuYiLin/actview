// export const useUpdateFn = (fn:()=>void)=>{
//   const preUpdateFn = getCurrentUpdateFn()
//   setCurrentUpdateFn(fn)
//   fn()
//   setCurrentUpdateFn(preUpdateFn)
// }
const Updater = ()=>{
  let updateFn: (()=>void) | null = null
  function getCurrentUpdateFn(){
    return updateFn
  }
  function setCurrentUpdateFn(fn:(()=>void)|null){
    updateFn = fn
  }
  return {
    getCurrentUpdateFn,
    setCurrentUpdateFn
  }
}

export const {getCurrentUpdateFn, setCurrentUpdateFn} = Updater()