import type { UID } from './gen-uid'

export interface ConnectionArgs {
  endpointName: string
  fingerprint: UID
}

function isValidConnectionArgs(args: unknown, requiredKeys: (keyof ConnectionArgs)[] = ['endpointName', 'fingerprint']): args is ConnectionArgs {
  return typeof args === 'object'
    && args !== null
    && requiredKeys.every(k => k in args)
}

/**
 * Used within "persistent-port" to encode connection args for the background script
 */
export function encodeConnectionArgs(args: ConnectionArgs) {
  if (!isValidConnectionArgs(args))
    throw new TypeError('Invalid connection args')

  return JSON.stringify(args)
}

/**
 * Used by background script to decode connection args passed by other extension contexts
 */
export function decodeConnectionArgs(encodedArgs: string): ConnectionArgs | null {
  try {
    const args = JSON.parse(encodedArgs)

    return isValidConnectionArgs(args) ? args : null
  }
  catch (error) {
    return null
  }
}
