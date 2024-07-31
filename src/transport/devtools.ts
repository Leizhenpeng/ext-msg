import browser from 'webextension-polyfill'
import { createPersistentPort } from '../port-message'
import { internalPacketTypeRouter } from '../utils/internal-packet-type-router'
import { createBroadcastEventRuntime } from './event-bus/runtime'
import { createMessageRuntime } from './message-bus/runtime'
import { initTransportAPI } from './core'

export function init_dev_transport(): void {
  const port = createPersistentPort(
        `devtools@${browser.devtools.inspectedWindow.tabId}`,
  )

  const eventRuntime = createBroadcastEventRuntime(
    'devtools',
    async (event) => {
      port.postMessage(event)
    },
  )
  const messageRuntime = createMessageRuntime('devtools', async message =>
    port.postMessage(message))

  port.onMessage(packet =>
    internalPacketTypeRouter(packet, { eventRuntime, messageRuntime }),
  )

  initTransportAPI({
    browser,
    emit: eventRuntime.emit,
    receive: eventRuntime.receive,
    on: messageRuntime.on,
    send: messageRuntime.send,
  })
}
