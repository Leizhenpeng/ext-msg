import type { Runtime } from 'webextension-polyfill'
import browser from 'webextension-polyfill'
import type { InternalPacket } from '../types'
import { type DeliveryReceipt, createDeliveryLogger } from '../utils/delivery-logger'
import { type UID, createUID } from '../utils/gen-uid'
import { encodeConnectionArgs } from '../utils/connection-args'

// 消息类型定义
export type StatusMessage =
  | {
    status: 'undeliverable'
    message: InternalPacket
    resolvedDestination: string
  }
  | {
    status: 'deliverable'
    deliverableTo: string
  }
  | {
    status: 'delivered'
    receipt: DeliveryReceipt
  }
  | {
    status: 'incoming'
    message: InternalPacket
  }
  | {
    status: 'terminated'
    fingerprint: UID
  }

export type RequestMessage =
  | {
    type: 'sync'
    pendingResponses: ReadonlyArray<DeliveryReceipt>
    pendingDeliveries: ReadonlyArray<string>
  }
  | {
    type: 'deliver'
    message: InternalPacket
  }

//
export class PortMessage {
  static toBackground(port: Runtime.Port, message: RequestMessage) {
    return port.postMessage(message)
  }

  static toExtensionContext(port: Runtime.Port, message: StatusMessage) {
    return port.postMessage(message)
  }
}

interface QueuedMessage {
  resolvedDestination: string
  message: InternalPacket
}

/**
 * Manfiest V3 extensions can have their service worker terminated at any point
 * by the browser. That termination of service worker also terminates any messaging
 * porta created by other parts of the extension. This class is a wrapper around the
 * built-in Port object that re-instantiates the port connection everytime it gets
 * suspended
 *
 * Used by extension contexts to communicate with the background script (service worker)
 */
export function createPersistentPort(name = '') {
  const fingerprint = createUID()
  let port: Runtime.Port

  // undeliveredQueue 是一个只读数组，用于存储所有不可送达的消息，等待重新发送。
  let undeliveredQueue: ReadonlyArray<QueuedMessage> = []
  const pendingResponses = createDeliveryLogger()
  const onMessageListeners = new Set<
        (message: InternalPacket, p: Runtime.Port) => void
    >()
  const onFailureListeners = new Set<(message: InternalPacket) => void>()

  const handleMessage = (msg: StatusMessage, msgPort: Runtime.Port) => {
    switch (msg.status) {
      // 当消息不可送达时，存储所有不可送达的消息，等待重新发送
      case 'undeliverable':
        if (!undeliveredQueue.some(m => m.message.id === msg.message.id)) {
          undeliveredQueue = [
            ...undeliveredQueue,
            {
              message: msg.message,
              resolvedDestination: msg.resolvedDestination,
            },
          ]
        }

        return

      case 'deliverable':
        undeliveredQueue = undeliveredQueue.reduce((acc, queuedMsg) => {
          if (queuedMsg.resolvedDestination === msg.deliverableTo) {
            PortMessage.toBackground(msgPort, {
              message: queuedMsg.message,
              type: 'deliver',
            })

            return acc
          }

          return [...acc, queuedMsg]
        }, [] as ReadonlyArray<QueuedMessage>)

        return

      // 如果消息类型是 message，则将其添加到 pendingResponses 中，表示该消息已成功送达并等待处理。
      case 'delivered':
        if (msg.receipt.message.messageType === 'message')
          pendingResponses.add(msg.receipt)

        return

        // 当收到新消息时，如果消息类型是 reply，则从 pendingResponses 中移除对应的消息
      case 'incoming':
        if (msg.message.messageType === 'reply')
          pendingResponses.remove(msg.message.id)

        onMessageListeners.forEach(cb => cb(msg.message, msgPort))

        return

      // 当连接终止时，找到所有与终止连接相关的消息（通过 fingerprint 匹配），并从 pendingResponses 中移除这些消息。
      case 'terminated': {
        const rogueMsgs = pendingResponses
          .entries()
          .filter(receipt => msg.fingerprint === receipt.to)
        pendingResponses.remove(rogueMsgs)
        rogueMsgs.forEach(({ message }) =>
          onFailureListeners.forEach(cb => cb(message)),
        )
      }
    }
  }

  const connect = () => {
    port = browser.runtime.connect({
      name: encodeConnectionArgs({
        endpointName: name,
        fingerprint,
      }),
    })

    port.onMessage.addListener(handleMessage)
    port.onDisconnect.addListener(connect)

    // 在重新连接时，内容脚本会发送一个同步消息，包含所有未处理的消息。

    PortMessage.toBackground(port, {
      pendingDeliveries: [
        ...new Set(
          undeliveredQueue.map(({ resolvedDestination }) => resolvedDestination),
        ),
      ],
      pendingResponses: pendingResponses.entries(),
      type: 'sync',
    })
  }

  connect()

  return {
    onFailure(cb: (message: InternalPacket) => void) {
      onFailureListeners.add(cb)
    },
    onMessage(cb: (message: InternalPacket) => void): void {
      onMessageListeners.add(cb)
    },
    postMessage(message: InternalPacket): void {
      PortMessage.toBackground(port, {
        message,
        type: 'deliver',
      })
    },
  }
}
