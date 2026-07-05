import { LazyVNode } from "@local/jsx-factory";
import { ReactiveEffect } from "./runtime/reactive-system";

type Dep = Set<ReactiveEffect>

type ActViewComponent = () => LazyVNode