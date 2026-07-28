import { createRouter, createWebHistory, type RouteRecordRaw } from "vue-router";
import HelloWorld from "../components/HelloWorld.vue";

/**
 * Route table. Role-based guards (ADR 0003 / TDD §6) are not wired yet — they
 * need the auth store, which arrives with POST /login.
 */
const routes: RouteRecordRaw[] = [
  { path: "/", name: "home", component: HelloWorld },
];

export const router = createRouter({
  history: createWebHistory(),
  routes,
});
