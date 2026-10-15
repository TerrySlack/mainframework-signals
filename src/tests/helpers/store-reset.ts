import { globalSignalStore, routeSignalStore } from "../../shared/store";
import { resetPurgeRegistry } from "../../shared/store/purge-registry";

const defaultPath = "/";

export const resetAllStores = () => {
  globalSignalStore.clear();
  routeSignalStore.clear();
  resetPurgeRegistry();
  window.history.replaceState({}, "", defaultPath);
};
