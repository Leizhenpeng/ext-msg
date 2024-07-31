import type { BroadcastEventRuntime } from '../event-bus/runtime'
import type { MessageRuntime } from '../message-bus/runtime'
import type { InternalPacket } from '../types'
import { isInternalBroadcastEvent, isInternalMessage } from './internal-packet-type-guards'

export function internalPacketTypeRouter(
  packet: InternalPacket,
  {
    eventRuntime,
    messageRuntime,
  }: { eventRuntime: BroadcastEventRuntime, messageRuntime: MessageRuntime },
) {
  if (isInternalBroadcastEvent(packet))
    eventRuntime.handleEvent(packet)
  else if (isInternalMessage(packet))
    messageRuntime.handleMessage(packet)
  else
    throw new TypeError('Unknown message type')
}
