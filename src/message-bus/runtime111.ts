import type { JsonValue } from 'type-fest'

import { serializeError } from 'serialize-error'
import uuid from 'tiny-uid'
import type { InternalMessage, TransportMessagingAPI } from '../types-internal'
import type { OnMessageCallback, RuntimeContext } from '../types'
import { deserializeEndpoint } from '../utils/endpoint-utils'

// 创建消息运行时(createMessageRuntime)：这个函数创建并返回一个消息运行时对象，它有一些方法可以处理消息传递和接收。

// 发送消息(sendMessage)：这个方法让你可以发送消息到指定的目的地（比如后台脚本或者其他标签页）。你只需要提供消息ID、消息数据和目的地。

// 处理消息(handleMessage)：这个方法是消息的核心处理器。它决定如何处理收到的消息，有两种情况：

// 如果消息是对之前发送的消息的回复，它会处理这个回复。
// 如果消息是新的消息，它会查找相应的处理函数，并调用这个函数来处理消息。
// 结束事务(endTransaction)：这个方法可以结束一个正在进行的事务（消息传递过程），并触发相应的错误处理。

export interface MessageRuntime extends TransportMessagingAPI {
  /**
   * @internal
   */
  handleMessage: (message: InternalMessage) => void
  endTransaction: (transactionID: string) => void
}

export function createMessageRuntime(thisContext: RuntimeContext, routeMessage: (msg: InternalMessage) => Promise<void>, localMessage?: (msg: InternalMessage) => Promise<void>): MessageRuntime {
  const runtimeId = uuid()
  const openTransactions = new Map<
        string,
        { resolve: (v: any) => void, reject: (e: any) => void }
    >()
  const onMessageListeners = new Map<string, OnMessageCallback>()

  const handleMessage = (message: InternalMessage) => {
    if (
      message.destination.context === thisContext
      && !message.destination.frameId
      && !message.destination.tabId
    ) {
      localMessage?.(message)

      const { transactionId, id: messageID, messageType } = message
      console.log('message:', message)

      const handleReply = () => {
        const transactionP = openTransactions.get(transactionId)
        console.log('context', thisContext)
        console.log('transactionP:', transactionP)
        if (transactionP) {
          const { err, data } = message
          if (err) {
            const dehydratedErr = err as Record<string, string>
            const errCtr = (globalThis as { [ky: string]: any })[dehydratedErr.name]
            const hydratedErr = new (
              typeof errCtr === 'function' ? errCtr : Error
            )(dehydratedErr.message)

            for (const prop in dehydratedErr)
              hydratedErr[prop] = dehydratedErr[prop]

            transactionP.reject(hydratedErr)
          }
          else {
            transactionP.resolve(data)
          }
          openTransactions.delete(transactionId)
        }
        else {
          // window 之间处理消息
          if (!message.hops.includes(`${thisContext}::${runtimeId}`)) {
            console.log('route: 3', thisContext, runtimeId)
            message.hops.push(`${thisContext}::${runtimeId}`)
            console.log('message 3', message)
            return routeMessage(message)
          }
        }
      }

      const handleNewMessage = async () => {
        let reply: JsonValue | void = null
        let err: Error | null = null
        let noHandlerFoundError = false
        try {
          const cb = onMessageListeners.get(messageID)
          if (typeof cb === 'function') {
            reply = (await cb({
              data: message.data as never,
              id: messageID,
              sender: message.origin,
              timestamp: message.timestamp,
            })) as JsonValue
          }
          else {
            // 首次处理，如果没有找到处理函数，路由出去
            if (!message.hops.includes(`${thisContext}::${runtimeId}`)) {
              console.log('route: 1', thisContext, runtimeId)
              message.hops.push(`${thisContext}::${runtimeId}`)
              return routeMessage(message)
            }
            noHandlerFoundError = true
            throw new Error(`[ext-message] No handler registered in '${thisContext}' to accept messages with id '${messageID}'`)
          }
        }
        catch (error) {
          err = error as Error
        }
        finally {
          if (err)
            message.err = serializeError(err) as any

          console.log('message:relay？？')
          if (reply) {
            handleMessage({
              ...message,
              data: reply,
              destination: message.origin,
              messageType: 'reply',
              origin: { context: thisContext, tabId: null },
            })
          }

          if (err && !noHandlerFoundError) {
            // eslint-disable-next-line no-unsafe-finally
            throw reply
          }
        }
      }

      switch (messageType) {
        case 'reply':
          return handleReply()
        case 'message':
          return handleNewMessage()
      }
    }

    console.log('route: 2', thisContext, runtimeId)
    message.hops.push(`${thisContext}::${runtimeId}`)

    return routeMessage(message)
  }

  return {
    endTransaction: (transactionID) => {
      const transactionP = openTransactions.get(transactionID)
      transactionP?.reject('Transaction was ended before it could complete')
      openTransactions.delete(transactionID)
    },
    handleMessage,
    onMessage: (messageID, callback) => {
      onMessageListeners.set(messageID, callback)

      return () => onMessageListeners.delete(messageID)
    },
    sendMessage: (messageID, data, destination = 'background') => {
      const endpoint
                = typeof destination === 'string'
                  ? deserializeEndpoint(destination)
                  : destination
      const errFn = 'Bridge#sendMessage ->'

      if (!endpoint.context)
        throw new TypeError(`${errFn} Destination must be any one of known destinations`)

      return new Promise((resolve, reject) => {
        const payload: InternalMessage = {
          data,
          destination: endpoint,
          hops: [],
          id: messageID,
          messageType: 'message',
          origin: { context: thisContext, tabId: null },
          timestamp: Date.now(),
          transactionId: uuid(),
        }

        openTransactions.set(payload.transactionId, { reject, resolve })

        try {
          handleMessage(payload)
        }
        catch (error) {
          openTransactions.delete(payload.transactionId)
          reject(error)
        }
      })
    },
  }
}
