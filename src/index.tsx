import { App } from "@actview/core";
import { Router } from "@actview/router";
import { Home } from "./pages/home";
import { NotFound } from "./pages/notfound";
import { Bugs } from "./pages/bugs";
import { Demo } from "./pages/demo";
import { Guide } from "./pages/guide";
import { ComponentsLayout } from "./pages/components-layout";
import { TestA } from "./pages/test-a";
import { TestB } from "./pages/test-b";
import { Button } from "./pages/components/button";
import { Switch } from "./pages/components/switch";
import { Input } from "./pages/components/input";
import { App as Root } from "./App";

const routes = [
  { path: "/home", component: Home },
  { path: "/", component: Home },
  { path: "/not-found", component: NotFound },
  { path: "/component", component: ComponentsLayout, children: [
    { path: "/component/button", component: Button },
    { path: "/component/switch", component: Switch },
    { path: "/component/input", component: Input },
  ]},
  { path: "/bugs", component: Bugs },
  { path: "/demo", component: Demo },
  { path: "/guide", component: Guide },
  { path: "/test-a", component: TestA },
  { path: "/test-b", component: TestB },
];
new Router({ routes });

const app = new App();
app.mount("#app", () => <Root />);
