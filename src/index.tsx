import { App } from "@actview/core";
import { Router } from "@actview/router";
import { Home } from "./pages/home";
import { NotFound } from "./pages/notfound";
import { Bugs } from "./pages/bugs";
import { Demo } from "./pages/demo";
import { Guide } from "./pages/guide";
import { App as Root } from "./App";

const routes = [
  { path: "/", component: Home },
  { path: "/home", component: Home },
  { path: "/not-found", component: NotFound },
  { path: "/bugs", component: Bugs },
  { path: "/demo", component: Demo },
  { path: "/guide", component: Guide },
];
new Router({ routes });

const app = new App();
app.mount("#app", () => <Root />);
