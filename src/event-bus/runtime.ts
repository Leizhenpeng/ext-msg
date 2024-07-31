import { json } from 'node:stream/consumers'
import type { JsonValue } from 'type-fest'
import { serializeError } from 'serialize-error'
import uuid from 'tiny-uid'
import type { InternalBroadcastEvent, PegasusMessage, RuntimeContext } from '../types'
import type { TransportBroadcastEventAPI } from '../transport/core'

export interface BroadcastEventRuntime extends TransportBroadcastEventAPI {
  handleEvent: (message: InternalBroadcastEvent) => void
}

class BroadcastEventRuntimeImpl implements BroadcastEventRuntime {
  private runtimeId: string
  private onEventListeners: Map<string, Array<(event: PegasusMessage<JsonValue>) => void | Promise<void>>>
  private thisContext: RuntimeContext
  private routeEvent: (event: InternalBroadcastEvent) => Promise<void>
  private localEvent?: (event: InternalBroadcastEvent) => Promise<void>

  constructor(thisContext: RuntimeContext, routeEvent: (event: InternalBroadcastEvent) => Promise<void>, localEvent?: (event: InternalBroadcastEvent) => Promise<void>) {
    this.runtimeId = uuid()
    this.onEventListeners = new Map()
    this.thisContext = thisContext
    this.routeEvent = routeEvent
    this.localEvent = localEvent
  }

  public emitBroadcastEvent = async <Data extends JsonValue>(eventID: string, data: Data): Promise<void> => {
    const payload: InternalBroadcastEvent = {
      data,
      hops: [],
      id: eventID,
      messageType: 'broadcastEvent',
      origin: {
        context: this.thisContext,
        tabId: null,
      },
      timestamp: Date.now(),
      transactionId: uuid(),
    }

    // console.log('payload', payload)
    await this.handleEvent(payload)
  }

  public handleEvent = async (event: InternalBroadcastEvent): Promise<void> => {
    // console.log('context input', this.thisContext, this.runtimeId)
    // console.log(JSON.stringify(event))

    const isRelayedViaBackground = event.hops.some(hop => hop.startsWith('background::'))
    const isBackgroundEvent = this.thisContext === 'background' && event.origin.context === this.thisContext

    if (isBackgroundEvent || isRelayedViaBackground) {
      this.localEvent?.(event)
      await this.processEvent(event)

      if (isRelayedViaBackground)
        return
    }

    event.hops.push(`${this.thisContext}::${this.runtimeId}`)
    // console.log('context output', this.thisContext, this.runtimeId)
    // console.log(JSON.stringify(event))

    await this.routeEvent(event)
  }

  private processEvent = async (event: InternalBroadcastEvent): Promise<void> => {
    const { id: eventID } = event
    const callbacks = this.onEventListeners.get(eventID) ?? []
    const errors: unknown[] = []

    for (const callback of callbacks) {
      try {
        await callback({
          data: event.data,
          id: eventID,
          sender: event.origin,
          timestamp: event.timestamp,
        } as PegasusMessage<JsonValue>)
      }
      catch (error) {
        errors.push(error)
      }
    }

    if (errors.length > 0) {
      throw new Error(
        `Error(s) occurred while handling broadcast event ${eventID}: ${errors
          .map(err => serializeError(err))
          .join(', ')}`,
      )
    }
  }

  public onBroadcastEvent = (eventID: string, callback: (event: PegasusMessage<JsonValue>) => void): () => void => {
    const currentListeners = this.onEventListeners.get(eventID) ?? []
    this.onEventListeners.set(eventID, [...currentListeners, callback])

    return () => {
      const updatedListeners = (this.onEventListeners.get(eventID) ?? []).filter(listener => listener !== callback)
      this.onEventListeners.set(eventID, updatedListeners)
    }
  }

  public offBoardcastEvent = (eventID: string, callback: (event: PegasusMessage<JsonValue>) => void): void => {
    const updatedListeners = (this.onEventListeners.get(eventID) ?? []).filter(listener => listener !== callback)
    this.onEventListeners.set(eventID, updatedListeners)
  }

  public on = this.onBroadcastEvent

  public emit = this.emitBroadcastEvent

  public off = this.offBoardcastEvent
}

export function createBroadcastEventRuntime(thisContext: RuntimeContext, routeEvent: (event: InternalBroadcastEvent) => Promise<void>, localEvent?: (event: InternalBroadcastEvent) => Promise<void>): BroadcastEventRuntime {
  return new BroadcastEventRuntimeImpl(thisContext, routeEvent, localEvent)
}
