// message-port.ts
import { createNanoEvents } from 'nanoevents'

export const portEmitter = createNanoEvents<{
  portAccepted: (port: MessagePort) => void
}>()

/*

/**
 * 创建一个用于一对一通信的 MessagePort 的 Promise
 *
 * @param thisContext 当前的上下文
 * @param namespace 命名空间
 * @param onMessage 当接收到消息时调用的回调函数
 * @returns 返回一个 Promise，解决为 MessagePort
 */
export function getMessagePort(thisContext: 'window', namespace: string, onMessage: (e: MessageEvent<any>) => void) {
  function acceptMessagingPort(event: MessageEvent) {
    const { data: { cmd, scope, context }, ports } = event
    if (cmd === 'webext-port-offer' && scope === namespace && context !== thisContext) {
      window.removeEventListener('message', acceptMessagingPort)
      ports[0].onmessage = onMessage
      ports[0].postMessage('port-accepted')
      portEmitter.emit('portAccepted', ports[0])
    }
  }

  function offerMessagingPort() {
    const channel = new MessageChannel()
    channel.port1.onmessage = (event: MessageEvent) => {
      if (event.data === 'port-accepted') {
        portEmitter.emit('portAccepted', channel.port1)
        window.removeEventListener('message', acceptMessagingPort)
      }
      else { onMessage(event) }
    }

    window.postMessage({
      cmd: 'webext-port-offer',
      context: thisContext,
      scope: namespace,
    }, '*', [channel.port2])
  }

  window.addEventListener('message', acceptMessagingPort)

  let attemptCount = 0
  const intervalId = setInterval(() => {
    if (attemptCount >= 200) {
      clearInterval(intervalId)
      console.error('Reached maximum attempt limit for messaging port offer.')
    }
    else {
      offerMessagingPort()
      attemptCount += 1
    }
  }, 100)
  portEmitter.on('portAccepted', () => clearInterval(intervalId))
}

export function getMessagePorts(thisContext: 'content-script', namespace: string, onMessage: (e: MessageEvent<any>) => void) {
  function acceptMessagingPort(event: MessageEvent) {
    const { data: { cmd, scope, context }, ports: eventPorts } = event
    if (cmd === 'webext-port-offer' && scope === namespace && context !== thisContext) {
      const port = eventPorts[0]
      port.onmessage = onMessage
      port.postMessage('port-accepted')
      portEmitter.emit('portAccepted', port)
    }
  }

  window.addEventListener('message', acceptMessagingPort)
}

/**
 * 这里的玩法是就是那个us windows主动去建立channel然后找content的js去通信 也就是说content这边起被动接收的作用
 * 要点 1： 如何避免 us 之间建立 channel 时的冲突,因为有 conetext ！== thisContext 的限制
 */

/**
 * 干掉setTimeOut
 * cs 没有加载完成 ,us的握手请求不能发送 *第一个延时 ->解决办法: 小步多尝试,直到成功
 * cs 和 us 握手之前, us-io 不能发送任何消息 *第二个延时  最小是700ms,
 */
