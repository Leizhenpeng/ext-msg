import browser from 'webextension-polyfill'
import { createPersistentPort } from '../port-message'
import { createMessageRuntime } from '../message-bus/runtime'
import { internalPacketTypeRouter } from '../utils/internal-packet-type-router'
import { createBroadcastEventRuntime } from '../event-bus/runtime'
import { initTransportAPI } from './core'

export function init_opt_transport(): void {
  const port = createPersistentPort('options')

  const messageRuntime = createMessageRuntime('options', async message =>
    port.postMessage(message))

  const eventRuntime = createBroadcastEventRuntime('options', async (event) => {
    port.postMessage(event)
  })

  port.onMessage(packet =>
    internalPacketTypeRouter(packet, { eventRuntime, messageRuntime }),
  )

  initTransportAPI({
    browser,
    emitBroadcastEvent: eventRuntime.emitBroadcastEvent,
    onBroadcastEvent: eventRuntime.onBroadcastEvent,
    onMessage: messageRuntime.onMessage,
    sendMessage: messageRuntime.sendMessage,
  })
}
