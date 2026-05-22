import { App } from "@actview/core";
import { Router } from "@actview/router";
import { SlotDemo } from "./pages/slot-demo";
import { ReactiveDemo } from "./pages/reactive-demo";
import { ComputedDemo } from "./pages/computed-demo";
import { JsxDemo } from "./pages/jsx-demo";
import { ComponentsDemo } from "./pages/components-demo";
import { App as Root } from "./App";

const routes = [
  { path: "/", component: ReactiveDemo },
  { path: "/slot-demo", component: SlotDemo },
  { path: "/reactive-demo", component: ReactiveDemo },
  { path: "/computed-demo", component: ComputedDemo },
  { path: "/jsx-demo", component: JsxDemo },
  { path: "/components-demo", component: ComponentsDemo },
];
new Router({ routes });

const app = new App();
app.mount("#app", () => <Root />);
