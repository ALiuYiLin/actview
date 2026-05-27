import { App } from "@actview/core";
import { App as Root } from "./App";



const app = new App();
app.mount("#app", () => <Root />);
