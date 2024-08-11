import browser from 'webextension-polyfill'
import { createPersistentPort } from '../message-tool/extenison-port-message'
import { internalPacketTypeRouter } from '../utils/internal-packet-type-router'
import { createMessageRuntime } from './message-bus/runtime'
import { createBroadcastEventRuntime } from './event-bus/runtime'
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
    emit: eventRuntime.emit,
    receive: eventRuntime.receive,
    on: messageRuntime.on,
    send: messageRuntime.send,
    off: messageRuntime.off,
  })
}
