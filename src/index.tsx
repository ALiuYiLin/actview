import { App } from "@actview/core";
import { Router } from "@actview/router";
import { Home } from "./pages/home";
import { Demo } from "./pages/demo";
import { Guide } from "./pages/guide";
import { SlotDemo } from "./pages/slot-demo";
import { App as Root } from "./App";

const routes = [
  { path: "/", component: Home },
  { path: "/home", component: Home },
  { path: "/demo", component: Demo },
  { path: "/guide", component: Guide },
  { path: "/slot-demo", component: SlotDemo },
];
new Router({ routes });

const app = new App();
app.mount("#app", () => <Root />);
