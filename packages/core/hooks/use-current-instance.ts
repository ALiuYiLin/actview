export function useCurrentInstance() {
  let currentInstance: any = null;
  const getCurrentInstance = () => currentInstance;
  const setCurrentInstance = (inst: any) => { currentInstance = inst; };
  return { getCurrentInstance, setCurrentInstance };
}
