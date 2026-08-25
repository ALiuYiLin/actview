export interface Post {
  id: number
  title: string
  excerpt: string
}

/** 模拟服务端数据获取（真实场景：DB / API 调用） */
export async function fetchPosts(): Promise<Post[]> {
  await new Promise((r) => setTimeout(r, 30)) // 模拟网络延迟
  return [
    {
      id: 1,
      title: 'SSR 首屏：服务端渲染 + 客户端水合',
      excerpt: 'renderToStringAsync 输出 HTML，hydrate 复用 DOM（无闪烁、无重建）',
    },
    {
      id: 2,
      title: 'useId 两端一致',
      excerpt: '遍历序 id 对齐，SSR 与 hydrate 输出相同，属性幂等写入',
    },
    {
      id: 3,
      title: '事件水合即用',
      excerpt: 'patchProps 全量 setProp 绑定事件，页面加载完成即可交互',
    },
    {
      id: 4,
      title: '预取数据注入（__INITIAL_DATA__）',
      excerpt: '服务端 await 数据 → 注入 window → 客户端 hydrate 传 props，两端首帧一致',
    },
  ]
}
