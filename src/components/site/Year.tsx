'use client'

import { useSyncExternalStore } from 'react'

const subscribe = () => () => {}

/** Current year. Uses the build year on the server, the visitor's clock in the browser. */
export default function Year({ initial }: { initial: number }) {
  const year = useSyncExternalStore(
    subscribe,
    () => new Date().getFullYear(),
    () => initial
  )
  return <>{year}</>
}
