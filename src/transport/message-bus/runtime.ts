/* eslint-disable no-unsafe-finally */
import type { JsonValue } from 'type-fest'
import { serializeError } from 'serialize-error'
import uuid from 'tiny-uid'
import type { InternalMessage, OnMessageCallback, RuntimeContext } from '../../types'
import { deserializeEndpoint } from '../../utils/endpoint-utils'
import type { TransportMessagingAPI } from '../core'

export interface MessageRuntime extends TransportMessagingAPI {
  handleMessage: (message: InternalMessage) => void
  endTransaction: (transactionID: string) => void
}

class MessageRuntimeClass implements MessageRuntime {
  private runtimeId: string
  private thisContext: RuntimeContext
  private routeMessage: (msg: InternalMessage) => Promise<void>
  private localMessage?: (msg: InternalMessage) => Promise<void>
  private openTransactions: Map<string, { resolve: (v: any) => void, reject: (e: any) => void }>
  private onMessageListeners: Map<string, OnMessageCallback>

  constructor(thisContext: RuntimeContext, routeMessage: (msg: InternalMessage) => Promise<void>, localMessage?: (msg: InternalMessage) => Promise<void>) {
    this.runtimeId = uuid()
    this.thisContext = thisContext
    this.routeMessage = routeMessage
    this.localMessage = localMessage
    this.openTransactions = new Map()
    this.onMessageListeners = new Map()
  }

  // 添加一个跳跃信息到消息的 hops 数组中
  private addHop = (message: InternalMessage) => {
    message.hops.push(`${this.thisContext}::${this.runtimeId}`)
  }

  // 处理回复消息
  private handleReply = (message: InternalMessage) => {
    const { transactionId } = message
    const transactionP = this.openTransactions.get(transactionId)
    if (transactionP) {
      const { err, data } = message
      if (err) {
        const hydratedErr = this.hydrateError(err as any)
        transactionP.reject(hydratedErr)
      }
      else {
        transactionP.resolve(data)
      }
      this.openTransactions.delete(transactionId)
    }
    else {
      this.firstRoute(message)
    }
  }

  // 处理新消息
  private handleNewMessage = async (message: InternalMessage) => {
    let reply: JsonValue | void = null
    let err: Error | null = null
    let noHandlerFoundError = false
    try {
      const cb = this.onMessageListeners.get(message.id)
      if (typeof cb === 'function') {
        reply = await cb({
          data: message.data as never,
          id: message.id,
          sender: message.origin,
          timestamp: message.timestamp,
        }) as JsonValue
      }
      else {
        this.firstRoute(message)
        noHandlerFoundError = true
        throw new Error(`[ext-message] No handler registered in '${this.thisContext}' to accept messages with id '${message.id}'`)
      }
    }
    catch (error) {
      err = error as Error
    }
    finally {
      if (err)
        message.err = serializeError(err) as any

      if (reply) {
        this.handleMessage({
          ...message,
          data: reply,
          destination: message.origin,
          messageType: 'reply',
          origin: { context: this.thisContext, tabId: null },
        })
      }

      if (err && !noHandlerFoundError)
        throw reply
    }
  }

  // 第一次处理消息，没有找到，路由出去
  private firstRoute = (message: InternalMessage) => {
    if (!message.hops.includes(`${this.thisContext}::${this.runtimeId}`)) {
      this.addHop(message)
      this.routeMessage(message)
    }
  }

  // 序列化错误
  private hydrateError = (err: Record<string, string>): Error => {
    const errCtr = (globalThis as { [key: string]: any })[err.name]
    const hydratedErr = new (typeof errCtr === 'function' ? errCtr : Error)(err.message)
    for (const prop in err) hydratedErr[prop] = err[prop]
    return hydratedErr
  }

  // 处理接收到的消息
  public handleMessage = (message: InternalMessage) => {
    console.log('context', this.thisContext)
    console.log('message', JSON.stringify(message, null, 2))
    if (message.destination.context === this.thisContext && !message.destination.frameId && !message.destination.tabId) {
      this.localMessage?.(message)

      switch (message.messageType) {
        case 'reply':
          this.handleReply(message)
          break
        case 'message':
          this.handleNewMessage(message)
          break
      }
    }
    else {
      this.addHop(message)
      this.routeMessage(message)
    }
  }

  // 结束事务
  public endTransaction = (transactionID: string) => {
    const transactionP = this.openTransactions.get(transactionID)
    if (transactionP) {
      transactionP.reject('Transaction was ended before it could complete')
      this.openTransactions.delete(transactionID)
    }
  }

  // 注册消息处理回调
  public on = (messageID: string, callback: OnMessageCallback) => {
    this.onMessageListeners.set(messageID, callback)
    return () => this.onMessageListeners.delete(messageID)
  }

  // 发送消息
  public send = (messageID: string, data: any, destination: string | InternalMessage['destination'] = 'background') => {
    const endpoint = typeof destination === 'string' ? deserializeEndpoint(destination) : destination
    const errFn = 'Bridge#sendMsg ->'

    if (!endpoint.context)
      throw new TypeError(`${errFn} Destination must be any one of known destinations`)

    return new Promise((resolve, reject) => {
      const payload: InternalMessage = {
        data,
        destination: endpoint,
        hops: [],
        id: messageID,
        messageType: 'message',
        origin: { context: this.thisContext, tabId: null },
        timestamp: Date.now(),
        transactionId: uuid(),
      }

      this.openTransactions.set(payload.transactionId, { reject, resolve })

      try {
        this.handleMessage(payload)
      }
      catch (error) {
        this.openTransactions.delete(payload.transactionId)
        reject(error)
      }
    })
  }
}

export function createMessageRuntime(
  thisContext: RuntimeContext,
  routeMessage: (msg: InternalMessage) => Promise<void>,
  localMessage?: (msg: InternalMessage) => Promise<void>,
): MessageRuntime {
  return new MessageRuntimeClass(thisContext, routeMessage, localMessage)
}
