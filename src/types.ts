import type { JsonValue } from 'type-fest'

/**
 * Call to ensure an active listener has been removed.
 */
export type RemoveListenerCallback = () => void

/**
 * Either a Promise of a type, or that type directly. Used to indicate that a method can by sync or async.
 */
export type MaybePromise<T> = Promise<T> | T

/**
 * Given a function declaration, `ProtocolWithReturn`, or a value, return the message's data type.
 */
export type GetMessageProtocolDataType<T> = T extends (
  ...args: infer Args
) =>
any
  ? Args['length'] extends 0 | 1
    ? Args[0]
    : never
  :
  T extends any
    ? T
    : never

/**
 * Given a function declaration, `ProtocolWithReturn`, or a value, return the message's return type.
 */
export type GetMessageProtocolReturnType<T> = T extends (
  ...args: any[]
) => infer R
  ? R
  : void

/**
 * Promisify<T> returns Promise<T> if it is not a promise, otherwise it returns T.
 */
export type Promisify<T> = T extends Promise<unknown> ? T : Promise<T>

export type RuntimeContext =
  | 'devtools'
  | 'background'
  | 'popup'
  | 'options'
  | 'content-script'
  | 'window'

export interface Endpoint {
  context: RuntimeContext
  tabId: number | null
  frameId?: number
}

export type Destination = Endpoint | RuntimeContext | string

export interface PegasusMessage<TData extends JsonValue> {
  data: TData
  id: string
  timestamp: number
  sender: Endpoint
}

export type OnMessageCallback<
    TProtocolMap extends Record<string, any> = Record<string, any>,
    TType extends keyof TProtocolMap = never,
> = (
  message: PegasusMessage<GetMessageProtocolDataType<TProtocolMap[TType]>>,
) => MaybePromise<GetMessageProtocolReturnType<TProtocolMap[TType]>>

export interface InternalPacket {
  origin: Endpoint
  messageType: 'message' | 'reply' | 'broadcastEvent'
  timestamp: number
  hops: string[]
  id: string
  transactionId: string
}

export interface InternalBroadcastEvent extends InternalPacket {
  messageType: 'broadcastEvent'
  data: JsonValue
}

export interface InternalMessage extends InternalPacket {
  destination: Endpoint
  messageType: 'message' | 'reply'
  err?: JsonValue
  data?: JsonValue | void
}

export interface EndpointWontRespondError {
  type: 'error'
  transactionID: string
}
