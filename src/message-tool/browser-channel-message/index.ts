import type { Packet } from '../../protocol/socket-protocol/interface'
import type { EndpointWontRespondError, InternalPacket } from '../../types'
import { getMessagePort, getMessagePorts } from './message-port'

/**
 * 用于在 content-script 和 window 上下文之间的通信
 *
 * @param thisContext 当前的上下文 ('window' 或 'content-script')
 * @returns 返回一个对象，包含启用、设置回调、发送消息和设置命名空间的方法
 */
export function usePostMessaging(thisContext: 'window' | 'content-script') {
  let allocatedNamespace: string
  let messagingEnabled = false
  let onMessageCallback: (msg: InternalPacket | EndpointWontRespondError | Packet) => void
  let portP: Promise<MessagePort[] | MessagePort>

  return {
    enable,
    onMessage,
    postMessage,
    setNamespace,
    getPort,
  }
  function getPort() {
    return portP
  }
  /**
   * 启用消息传递
   */
  function enable() {
    messagingEnabled = true
  }

  /**
   * 设置消息接收回调函数
   *
   * @param cb 回调函数
   */
  function onMessage(cb: typeof onMessageCallback) {
    onMessageCallback = cb
  }

  /**
   * 发送消息
   *
   * @param msg 消息对象
   * @throws 如果上下文无效或通信未启用，抛出错误
   */
  async function postMessage(msg: InternalPacket | EndpointWontRespondError | Packet) {
    validateContext()
    ensureMessagingEnabled()
    ensureNamespaceSet(allocatedNamespace)
    const ports = await portP
    if (Array.isArray(ports))
      ports.forEach(port => port.postMessage(msg))
    else
      ports.postMessage(msg)
  }

  /**
   * 设置命名空间并初始化消息端口
   *
   * @param nsps 命名空间
   * @throws 如果命名空间已设置，抛出错误
   */
  function setNamespace(nsps: string) {
    if (allocatedNamespace)
      throw new Error('Namespace once set cannot be changed')

    allocatedNamespace = nsps

    if (thisContext === 'content-script') {
      portP = getMessagePorts(thisContext, nsps, (event: any) => {
        onMessageCallback?.(event.data)
      })
    }
    else {
      portP = getMessagePort(thisContext, nsps, (event) => {
        onMessageCallback?.(event.data)
      })
    }
  }

  /**
   * 验证当前上下文
   *
   * @throws 如果上下文无效，抛出错误
   */
  function validateContext() {
    if (thisContext !== 'content-script' && thisContext !== 'window')
      throw new Error('Invalid context. Must be "content-script" or "window".')
  }

  /**
   * 确保消息传递已启用
   *
   * @throws 如果消息传递未启用，抛出错误
   */
  function ensureMessagingEnabled() {
    if (!messagingEnabled)
      throw new Error('Communication has not been enabled.')
  }

  /**
   * 确保命名空间已设置
   *
   * @param namespace 命名空间
   * @throws 如果命名空间无效，抛出错误
   */
  function ensureNamespaceSet(namespace: string) {
    if (typeof namespace !== 'string' || namespace.trim().length === 0)
      throw new Error('Namespace must be a non-empty string.')
  }
}
