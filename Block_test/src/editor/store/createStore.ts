import { useSyncExternalStore } from 'react';
import type { Store } from '../../engine/store';

export { createStore, type Store } from '../../engine/store';

export function useStore<T, S>(store: Store<T>, selector: (state: T) => S): S {
  return useSyncExternalStore(store.subscribe, () => selector(store.getState()));
}
