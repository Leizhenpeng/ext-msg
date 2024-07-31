import type { TransportBroadcastEventAPI } from '../core'
import { getTransportAPI } from '../core'

declare const MissingProtocolMap: unique symbol
type MissingProtocolMapType = typeof MissingProtocolMap

type PegasusMessagingReturnType<TProtocolMap extends Record<string, any>> = [
  TProtocolMap,
] extends [never]
  ? MissingProtocolMapType
  : TransportBroadcastEventAPI<TProtocolMap>

export function createEventBus<
    TProtocolMap extends Record<string, any> = never,
  >(): PegasusMessagingReturnType<TProtocolMap> {
  const { receive, emit } = getTransportAPI()
  return { emit, receive } as PegasusMessagingReturnType<TProtocolMap>
}
