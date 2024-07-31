import type { JsonValue, Promisable } from 'type-fest'

import type { Endpoint, ParamType, RuntimeContext } from '../common'

// 定义类型别名
export type MsgHandler<Protocol extends Record<string, any>, Key extends keyof Protocol> = (
  data: ParamType<Protocol[Key]>
) => Promisable<ReturnType<Protocol[Key]>>

// 定义基础消息总线接口
export interface Socket<Protocol extends Record<string, any>> {
  send: <Key extends keyof Protocol>(id: Key, options: { destination: Endpoint, data: Protocol[Key] }) => void
  on: <Key extends keyof Protocol>(id: Key, handler: MsgHandler<Protocol, Key>) => void
  off: <Key extends keyof Protocol>(id: Key, handler: MsgHandler<Protocol, Key>) => void
}

// 定义传递消息的数据结构
export interface Packet {
  name: string
  transactionId: string
  messageType: 'message' | 'reply'
  origin: Endpoint
  destination: Endpoint
  timestamp: number
  history: string[]
  data?: JsonValue | void
  err?: JsonValue
}

export interface SocketLayer {
  routeMessage: (packet: Packet) => void
  // receiveMessage: (packet: Packet) => void
  // getOrigin: () => RuntimeContext
  // routeMessageIfNeeded: (packet: Packet) => void
  // initialize: () => void
}
