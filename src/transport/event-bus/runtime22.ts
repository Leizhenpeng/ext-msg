import type { JsonValue } from 'type-fest'

import { serializeError } from 'serialize-error'
import uuid from 'tiny-uid'
import { i } from 'vitest/dist/reporters-yx5ZTtEV.js'
import type { InternalBroadcastEvent, PegasusMessage, RuntimeContext } from '../../types'
import type { TransportBroadcastEventAPI } from '../core'

// us - cs- bg -cs -us1/2/3
export interface BroadcastEventRuntime extends TransportBroadcastEventAPI {
  /**
   * @internal
   */
  handleEvent: (message: InternalBroadcastEvent) => void
}

export function createBroadcastEventRuntime(thisContext: RuntimeContext, routeEvent: (event: InternalBroadcastEvent) => Promise<void>, localEvent?: (event: InternalBroadcastEvent) => Promise<void>): BroadcastEventRuntime {
  const runtimeId = uuid()
  const onEventListeners = new Map<
        string,
        Array<(event: PegasusMessage<JsonValue>) => void | Promise<void>>
    >()

  // 一会 data 一会 receive
  const handleEvent = async (event: InternalBroadcastEvent): Promise<void> => {
    console.log('context input ', thisContext, runtimeId)
    console.log(JSON.stringify(event))
    // 过了 bg 没有
    const relayedViaBackground
            = event.hops.findIndex(hop => hop.startsWith(`background::`)) !== -1
    // If receive was sent from background or it's already a relay from background
    // All broadcast events are relayed through background
    // 或判断有点绕，分开说明意图更清晰
    if (
      (thisContext === 'background' && event.origin.context === thisContext)
      || relayedViaBackground
    ) {
      // cs 会传播us
      localEvent?.(event)

      const { id: eventID } = event

      const errs: unknown[] = []

      const callbacks = onEventListeners.get(eventID) ?? []

      for (const cb of callbacks) {
        try {
          await cb({
            data: event.data,
            id: eventID,
            sender: event.origin,
            timestamp: event.timestamp,
          } as PegasusMessage<JsonValue>)
        }
        catch (error) {
          errs.push(error)
        }
      }

      if (errs.length > 0) {
        throw new Error(
                    `Error(s) occurred while handling broadcast event ${eventID}: ${errs
                        .map(err => serializeError(err))
                        .join(', ')}`,
        )
      }

      // If receive was sent from background and not relayed,
      // we still need to route it to other contexts
      // 到了 us 之后，bg 标记过，自己没有 local 的，就不会传播了
      if (relayedViaBackground)
        return
    }

    event.hops.push(`${thisContext}::${runtimeId}`)
    console.log('context output', thisContext, runtimeId)
    console.log(JSON.stringify(event))
    return routeEvent(event)
  }

  return {
    emit: async <Data extends JsonValue>(
      // eventName 更合适 or function name
      eventID: string,
      data: Data,
    ): Promise<void> => {
      const payload: InternalBroadcastEvent = {
        data,
        hops: [],
        id: eventID,
        messageType: 'broadcastEvent',
        origin: {
          context: thisContext,
          tabId: null,
        },
        timestamp: Date.now(),
        transactionId: uuid(),
      }

      console.log('payload', payload)
      return await handleEvent(payload)
    },
    handleEvent,
    receive: (eventID, callback) => {
      const currentListeners = onEventListeners.get(eventID) ?? []
      onEventListeners.set(eventID, [
        ...currentListeners,
        callback as (event: PegasusMessage<JsonValue>) => void,
      ])

      return () => {
        const oldListeners = onEventListeners.get(eventID) ?? []

        onEventListeners.set(
          eventID,
          oldListeners.filter(listener => listener !== callback),
        )
      }
    },
  }
}
