import type { TransportMessagingAPI } from '../core'
import { getTransportAPI } from '../core'

declare const MissingProtocolMap: unique symbol

type MissingProtocolMapType = typeof MissingProtocolMap

type MessageBusReturnType<TProtocolMap extends Record<string, any>> =
  [TProtocolMap] extends [never] ? MissingProtocolMapType : TransportMessagingAPI<TProtocolMap>

export function createMessageBus<
  TProtocolMap extends Record<string, any> = never,
  >(): MessageBusReturnType<TProtocolMap> {
  const { on, send } = getTransportAPI()
  return { on, send } as MessageBusReturnType<TProtocolMap>
}
