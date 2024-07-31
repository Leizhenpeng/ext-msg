import type { Endpoint, RuntimeContext } from '../types'

const ENDPOINT_RE
    = /^(background$|devtools|popup|options|content-script|window)(?:@(\d+)(?:\.(\d+))?)?$/

export function deserializeEndpoint(endpoint: string): Endpoint {
  const [, context, tabId, frameId] = endpoint.match(ENDPOINT_RE) || []

  return {
    context: context as RuntimeContext,
    frameId: frameId ? +frameId : undefined,
    tabId: +tabId,
  }
}

export function serializeEndpoint({
  context,
  tabId,
  frameId,
}: Endpoint): string {
  if (['background', 'popup', 'options'].includes(context))
    return context

  return `${context}@${tabId}${frameId ? `.${frameId}` : ''}`
}
