import type { TransportBroadcastEventAPI } from '../transport/core'
import { getTransportAPI } from '../transport/core'

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
  const { onBroadcastEvent, emitBroadcastEvent } = getTransportAPI()
  return { emitBroadcastEvent, onBroadcastEvent } as PegasusMessagingReturnType<TProtocolMap>
}
