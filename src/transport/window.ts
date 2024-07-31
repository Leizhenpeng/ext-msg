import { createMessageRuntime } from '../message-bus/runtime'
import { createBroadcastEventRuntime } from '../event-bus/runtime'
import { usePostMessaging } from '../post-message'
import { isInternalBroadcastEvent, isInternalMessage } from '../utils/internal-packet-type-guards'
import { initTransportAPI } from './core'

interface Props {
  namespace?: string
}

export function init_win_transport({ namespace }: Props = {}): void {
  const win = usePostMessaging('window')

  const messageRuntime = createMessageRuntime('window', message =>
    win.postMessage(message))
  const eventRuntime = createBroadcastEventRuntime('window', event =>
    win.postMessage(event))

  win.onMessage((msg) => {
    // console.log('msg', msg)
    if ('type' in msg && 'transactionID' in msg)
      messageRuntime.endTransaction(msg.transactionID)

    else if (isInternalBroadcastEvent(msg))
      eventRuntime.handleEvent(msg)

    else if (isInternalMessage(msg))
      messageRuntime.handleMessage(msg)

    else
      throw new TypeError('Unknown message type')
  })

  if (namespace) {
    win.setNamespace(namespace)
    win.enable()
  }

  initTransportAPI({
    browser: null,
    emitBroadcastEvent: eventRuntime.emitBroadcastEvent,
    onBroadcastEvent: eventRuntime.onBroadcastEvent,
    onMessage: messageRuntime.onMessage,
    sendMessage: messageRuntime.sendMessage,
  })
}
