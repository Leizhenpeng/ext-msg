import browser from 'webextension-polyfill'
import { createPersistentPort } from '../message-tool/extenison-port-message'
import { usePostMessaging } from '../message-tool/browser-channel-message'
import { internalPacketTypeRouter } from '../utils/internal-packet-type-router'
import { createBroadcastEventRuntime } from './event-bus/runtime'
import { createMessageRuntime } from './message-bus/runtime'
import { initTransportAPI } from './core'

interface Props {
  namespace?: string
}

export function init_cs_transport({
  namespace,
}: Props = {}): void {
  const win = usePostMessaging('content-script')
  console.log('content win init ', win)
  const port = createPersistentPort()
  const messageRuntime = createMessageRuntime(
    'content-script',
    async (message) => {
      if (
        message.destination.context === 'window'
        // if the message is addressed to the window, we need to make sure
        // that current content script is the top level script
        && window.top === window
        // If the message is addressed to the specific tab, we need to pass it to background script
        // first to forward it to the correct tab / frame
        && !message.destination.tabId
        && !message.destination.frameId
      )
        await win.postMessage(message)
      else
        port.postMessage(message)
    },
  )
  const eventRuntime = createBroadcastEventRuntime(
    'content-script',
    async (event) => {
      port.postMessage(event)
    },
    async event => win.postMessage(event),
  )

  win.onMessage((message) => {
    console.log('message', message)

    if ('type' in message && 'transactionID' in message) {
      // msg is instance of EndpointWontRespondError
      messageRuntime.endTransaction(message.transactionID)
    }
    else {
      const payload = Object.assign({}, message, {
        origin: {
          // a message receive inside `content-script` means a script inside `window` dispatched it to be forwarded
          // so we're making sure that the origin is not tampered (i.e script is not masquerading it's true identity)
          context: 'window',
          tabId: null,
        },
      })

      internalPacketTypeRouter(payload, { eventRuntime, messageRuntime })
    }
  })

  port.onMessage(packet =>
    internalPacketTypeRouter(packet, { eventRuntime, messageRuntime }),
  )

  port.onFailure((message) => {
    if (message.origin.context === 'window') {
      win.postMessage({
        transactionID: message.transactionId,
        type: 'error',
      })

      return
    }

    messageRuntime.endTransaction(message.transactionId)
  })

  if (namespace) {
    console.log('namespace', namespace)
    win.setNamespace(namespace)
    win.enable()
  }

  initTransportAPI({
    browser,
    emit: eventRuntime.emit,
    receive: eventRuntime.receive,
    on: messageRuntime.on,
    send: messageRuntime.send,
    off: messageRuntime.off,
  })
}
