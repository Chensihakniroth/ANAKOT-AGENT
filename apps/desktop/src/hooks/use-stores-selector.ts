// useStoresSelector — multi-store form of useStoreSelector.
// Subscribes to every store the selector reads, so the derived scalar recomputes
// when any of them notifies. The single-store form lives in use-session-slice.ts.

import { useCallback, useRef, useEffect, useSyncExternalStore, type ReactNode } from 'react'

interface ReadableStore<T> {
  get(): T
  listen(listener: () => void): () => void
}

export function useStoresSelector<S>(stores: readonly ReadableStore<unknown>[], select: () => S): S {
  const selectRef = useRef(select)
  selectRef.current = select

  const storesRef = useRef(stores)
  if (storesRef.current.length !== stores.length || storesRef.current.some((store, i) => store !== stores[i])) {
    storesRef.current = stores
  }

  const stable = storesRef.current

  const subscribe = useCallback(
    (onChange: () => void) => {
      const stops = stable.map(store => store.listen(onChange))
      return () => { for (const stop of stops) stop() }
    },
    [stable]
  )

  return useSyncExternalStore(subscribe, () => selectRef.current())
}

export function useStoresSelectorDebug<S>(stores: readonly ReadableStore<unknown>[], select: () => S, name?: string): S {
  const value = useStoresSelector(stores, select)
  useEffect(() => {
    if ((window as any).anakotDesktop?.debugInspector) {
      console.log(`[stores-selector:${name ?? 'unnamed'}]`, value)
    }
  }, [value, name])
  return value
}
