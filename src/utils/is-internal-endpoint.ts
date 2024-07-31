import type { Endpoint, RuntimeContext } from '../types'

const internalEndpoints: RuntimeContext[] = [
  'background',
  'devtools',
  'content-script',
  'options',
  'popup',
]

export function isInternalEndpoint({ context: ctx }: Endpoint): boolean {
  return internalEndpoints.includes(ctx)
}
