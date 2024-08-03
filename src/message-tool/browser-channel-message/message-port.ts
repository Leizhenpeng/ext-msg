let promise: Promise<MessagePort>
let portsPromise: Promise<MessagePort[]>

/**
 * 返回一个用于一对一通信的 MessagePort
 *
 * @param thisContext 当前的上下文 ('window' 或 'content-script')
 * @param namespace 命名空间，用于区分不同的通信通道
 * @param onMessage 当接收到消息时调用的回调函数
 * @returns 返回一个 Promise，解决为 MessagePort
 */
export function getMessagePort(thisContext: 'window' | 'content-script', namespace: string, onMessage: (e: MessageEvent<any>) => void): Promise<MessagePort> {
  return promise ??= createMessagePortPromise(thisContext, namespace, onMessage)
}

/**
 * 返回一个用于多对一通信的 MessagePorts 数组
 *
 * @param thisContext 当前的上下文 ('content-script')
 * @param namespace 命名空间，用于区分不同的通信通道
 * @param onMessage 当接收到消息时调用的回调函数
 * @returns 返回一个 Promise，解决为 MessagePorts 数组
 */
export function getMessagePorts(thisContext: 'content-script', namespace: string, onMessage: (e: MessageEvent<any>) => void): Promise<MessagePort[]> {
  return portsPromise ??= createMessagePortsPromise(thisContext, namespace, onMessage)
}

/**
 * 创建一个用于一对一通信的 MessagePort 的 Promise
 *
 * @param thisContext 当前的上下文
 * @param namespace 命名空间
 * @param onMessage 当接收到消息时调用的回调函数
 * @returns 返回一个 Promise，解决为 MessagePort
 */
function createMessagePortPromise(thisContext: 'window' | 'content-script', namespace: string, onMessage: (e: MessageEvent<any>) => void): Promise<MessagePort> {
  return new Promise((resolve) => {
    window.addEventListener('message', acceptMessagingPort)

    if (thisContext === 'window')
      setTimeout(offerMessagingPort, 0)
    else
      offerMessagingPort()

    function acceptMessagingPort(event: MessageEvent) {
      const { data: { cmd, scope, context }, ports } = event
      console.log('acceptMessagingPort', event)
      if (cmd === 'webext-port-offer' && scope === namespace && context !== thisContext) {
        window.removeEventListener('message', acceptMessagingPort)
        ports[0].onmessage = onMessage
        ports[0].postMessage('port-accepted')
        resolve(ports[0])
      }
    }

    function offerMessagingPort() {
      const channel = new MessageChannel()
      channel.port1.onmessage = (event: MessageEvent) => {
        if (event.data === 'port-accepted') {
          window.removeEventListener('message', acceptMessagingPort)
          resolve(channel.port1)
        }
        else {
          onMessage(event)
        }
      }

      window.postMessage({
        cmd: 'webext-port-offer',
        context: thisContext,
        scope: namespace,
      }, '*', [channel.port2])
    }
  })
}

/**
 * 创建一个用于多对一通信的 MessagePorts 数组的 Promise
 *
 * @param thisContext 当前的上下文
 * @param namespace 命名空间
 * @param onMessage 当接收到消息时调用的回调函数
 * @returns 返回一个 Promise，解决为 MessagePorts 数组
 */
function createMessagePortsPromise(thisContext: 'content-script', namespace: string, onMessage: (e: MessageEvent<any>) => void): Promise<MessagePort[]> {
  const ports: MessagePort[] = []
  return new Promise((resolve) => {
    window.addEventListener('message', acceptMessagingPort)

    setTimeout(() => {
      window.removeEventListener('message', acceptMessagingPort)
      resolve(ports)
    }, 1000) // 根据需要调整超时时间

    function acceptMessagingPort(event: MessageEvent) {
      const { data: { cmd, scope, context }, ports: eventPorts } = event
      if (cmd === 'webext-port-offer' && scope === namespace && context !== thisContext) {
        const port = eventPorts[0]
        port.onmessage = onMessage
        port.postMessage('port-accepted')
        ports.push(port)
      }
    }
  })
}

/**
 * 这里的玩法是就是那个us windows主动去建立channel然后找content的js去通信 也就是说content这边起被动接收的作用
 * 要点 1： 如何避免 us 之间建立 channel 时的冲突,因为有 conetext ！== thisContext 的限制
 */
