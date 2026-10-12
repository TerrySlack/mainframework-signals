import { globalSignalStore, routeSignalStore } from "../../shared/store";

const defaultPath = "/";

export const resetAllStores = () => {
  globalSignalStore.clear();
  routeSignalStore.clear();
  window.history.replaceState({}, "", defaultPath);
};
