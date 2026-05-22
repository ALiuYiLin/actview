import { Router } from "@actview/router";
import "./menu.css";

export type MenuItem = {
  path: string;
  label: string;
  icon?: string;
};

export type MenuGroup = {
  group: string;
  path?: string;
  items: MenuItem[];
};

export type MenuProps = {
  menus: MenuGroup[];
  router: Router;
};

/** 当前路由是否匹配菜单项（精确匹配或子路由匹配） */
function isActive(currentPath: string | undefined, itemPath: string): boolean {
  if (!currentPath) return false;
  if (currentPath === itemPath) return true;
  // 嵌套路由：父路由匹配子路径（如 /component 匹配 /component/button）
  if (currentPath.startsWith(itemPath + "/")) return true;
  return false;
}

export const Menu = (props: MenuProps) => {
  const { menus, router } = props;
  return (
    <ul class="sidebar-menu">
      {menus.map((group) => (
        <li>
          {group.path ? (
            <a
              class={"menu-group-link" + (isActive(router.route.value?.path, group.path) ? " active" : "")}
              href={group.path}
              onClick={(e: MouseEvent) => {
                e.preventDefault();
                router.push(group.path!);
              }}
            >
              {group.group}
            </a>
          ) : (
            <span class="menu-group-label">{group.group}</span>
          )}
          <ul class="menu-sub">
            {group.items.map((item) => (
              <li>
                <a
                  href={item.path}
                  class={router.route.value?.path === item.path ? "active" : ""}
                  onClick={(e: MouseEvent) => {
                    e.preventDefault();
                    router.push(item.path);
                  }}
                >
                  {item.icon && <span class="icon">{item.icon}</span>}
                  {item.label}
                </a>
              </li>
            ))}
          </ul>
        </li>
      ))}
    </ul>
  );
};
