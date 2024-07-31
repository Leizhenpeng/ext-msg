import { usePostMessaging } from '../message-tool/brower-channel-message'
import { isInternalBroadcastEvent, isInternalMessage } from '../utils/internal-packet-type-guards'
import { createMessageRuntime } from './message-bus/runtime'
import { createBroadcastEventRuntime } from './event-bus/runtime'
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
    emit: eventRuntime.emit,
    receive: eventRuntime.receive,
    on: messageRuntime.on,
    send: messageRuntime.send,
  })
}
