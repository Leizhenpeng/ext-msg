import type { TransportMessagingAPI } from '../transport/core'
import { getTransportAPI } from '../transport/core'

declare const MissingProtocolMap: unique symbol

type MissingProtocolMapType = typeof MissingProtocolMap

type MessageBusReturnType<TProtocolMap extends Record<string, any>> =
  [TProtocolMap] extends [never] ? MissingProtocolMapType : TransportMessagingAPI<TProtocolMap>

export function createMessageBus<
  TProtocolMap extends Record<string, any> = never,
  >(): MessageBusReturnType<TProtocolMap> {
  const { onMessage, sendMessage } = getTransportAPI()

  return { onMessage, sendMessage } as MessageBusReturnType<TProtocolMap>
}
