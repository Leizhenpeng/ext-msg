import type { JsonValue, Promisable } from 'type-fest'

/**
 * Call to ensure an active listener has been removed.
 */
export type RemoveListenerCallback = () => void

/**
 * 获取函数的参数类型，如果是函数类型，返回参数类型的联合类型；如果不是函数类型，则返回原类型。
 * type Example1 = ParamType<() => void>; // undefined
 * type Example2 = ParamType<(arg: string) => void>; // string
 * type Example3 = ParamType<(arg1: string, arg2: number) => void>; // string | number
 * type Example4 = ParamType<string>; // string
 * type Example5 = ParamType<{ name: string }>; // { name: string }
 */
export type ParamType<T> = T extends (
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
 * 获取函数的返回类型，如果不是函数，则返回原类型。
 * type Example1 = ReturnType<() => number>; // number
 * type Example2 = ReturnType<string>; // string
 * type Example3 = ReturnType<(x: string) => boolean>; // boolean
 * type Example4 = ReturnType<{ name: string }>; // { name: string }
 */
export type ReturnType<T> = T extends (...args: any[]) => infer R ? R : T

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

export interface Message<TData extends JsonValue> {
  data: TData
  id: string
  timestamp: number
  sender: Endpoint
}

/**
 * interface ProtocolMap {
 *   foo: (arg: string) => number;
 *   bar: (arg: number) => Promise<boolean>;
 * }
 * const onFooMessage: OnMessageCallback<ProtocolMap, 'foo'> = async (message) => {
 *   // message.data 的类型是 string
 *   console.log(message.data); // 打印消息数据
 *   // 返回类型是 number
 *   return message.data.length;
 * };
 *
 * const onBarMessage: OnMessageCallback<ProtocolMap, 'bar'> = async (message) => {
 *   // message.data 的类型是 number
 *   console.log(message.data); // 打印消息数据
 *   // 返回类型是 Promise<boolean>
 *   return message.data > 0;
 * };
 *
 */
export type OnMessageCallback<Protocol extends Record<string, any> = Record<string, any>, ID extends keyof Protocol = never> = (
  message: Message<ParamType<Protocol[ID]>>,
) => Promisable<ReturnType<Protocol[ID]>>

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
