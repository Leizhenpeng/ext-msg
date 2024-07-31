import uuid from 'tiny-uid'
import { serializeError } from 'serialize-error'
import type { Destination, Endpoint, RuntimeContext } from '../common'
import type { MsgHandler, Packet, Socket, SocketLayer } from './interface'

export abstract class SocketRuntime<Protocol extends Record<string, any>> implements Socket<Protocol>, SocketLayer {
  protected handlers: Map<string, MsgHandler<Protocol, any>> = new Map()
  protected openTransactions: Map<string, { resolve: (value: any) => void, reject: (reason?: any) => void }> = new Map()
  protected runtimeId = this.generateUUName()

  constructor() { }

  send<Name extends keyof Protocol>(id: Name, options: { destination: Destination, data: Protocol[Name] }): void {
    const { destination = 'background', data } = options

    const packet: Packet = {
      name: id as string,
      destination: this.parseEndpoint(destination),
      transactionId: this.genTransactionId(),
      messageType: 'message',
      origin: { context: this.getOrigin(), tabId: null },
      timestamp: Date.now(),
      history: [],
      data,
    }

    this.handleMessage(packet)
  }

  on<Name extends keyof Protocol>(id: Name, handler: MsgHandler<Protocol, Name>): () => void {
    const key = id as string
    this.handlers.set(key, handler)
    return () => this.handlers.delete(key)
  }

  off<Name extends keyof Protocol>(id: Name): void {
    const key = id as string
    this.handlers.delete(key)
  }

  // todo: 缩短传递次数 us0-cs-bg-cs-[us1-cs]-us0
  protected handleMessage(packet: Packet): void {
    // 判断是否是当前上下文 应该处理
    if (this.isNowContextTask(packet)) {
      if (packet.messageType === 'reply')
        this.handleReply(packet)
      else
        this.handleNewMessage(packet)
    }
    else {
      this.addHistory(packet)
      this.routeMessage(packet)
    }
  }

  protected handleReply(packet: Packet): void {
    const transaction = this.openTransactions.get(packet.transactionId)
    if (transaction) {
      if (packet.err) {
        const error = this.hydrateError(packet.err as any) // 假设你有一个错误反序列化方法
        transaction.reject(error)
      }
      else { transaction.resolve(packet.data) }

      this.openTransactions.delete(packet.transactionId)
    }
    else {
      this.firstProcessRoute(packet)
    }
  }

  protected async handleNewMessage(packet: Packet): Promise<void> {
    let response: any = null
    let err: Error | null = null
    let noHandlerFoundError = false

    try {
      const handler = this.handlers.get(packet.name)
      if (handler) {
        response = await handler(packet.data as any)
      }
      else {
        noHandlerFoundError = true
        this.firstProcessRoute(packet)
        throw new Error(`[ext-message] No handler registered in '${this.getContext}' to accept messages with name '${packet.name}'`)
      }
    }
    catch (error) {
      err = error as Error
    }
    finally {
      if (err && !noHandlerFoundError) {
        console.error('Error occurred:', err)
        packet.err = serializeError(err) as any
      }
      // 有响应的，不可能有错误...
      if (response) {
        const replyPacket: Packet = {
          ...packet,
          data: response,
          destination: packet.origin,
          messageType: 'reply',
          origin: { context: this.getContext, tabId: null },
        }
        await this.routeMessage(replyPacket)
      }
    }
  }

  isNowContextTask(packet: Packet) {
    // todo: 后面两个为啥？？
    return packet.destination.context === this.getContext && !packet.destination.tabId && packet.destination.frameId
  }

  addHistory(packet: Packet) {
    packet.history.push(this.contextUUName)
  }

  // 检查并路由消息，如果需要
  firstProcessRoute = (message: Packet) => {
    if (!message.history.includes(this.contextUUName)) {
      this.addHistory(message)
      this.routeMessage(message)
    }
  }

  parseEndpoint(destination: Destination): Endpoint {
    const ENDPOINT_RE
      = /^(background$|devtools|popup|options|content-script|window)(?:@(\d+)(?:\.(\d+))?)?$/

    if (typeof destination === 'string') {
      const [, context, tabId, frameId] = destination.match(ENDPOINT_RE) || []
      return {
        context: context as RuntimeContext,
        frameId: frameId ? +frameId : undefined,
        tabId: +tabId,
      }
    }
    else { return destination }
  }

  formatEndpoint(endpoint: Endpoint): string {
    if (['background', 'popup', 'options'].includes(endpoint.context))
      return endpoint.context
    return `${endpoint.context}@${endpoint.tabId}${endpoint.frameId ? `.${endpoint.frameId}` : ''}`
  }

  get getContext() {
    return this.getOrigin()
  }

  get contextUUName() {
    return `${this.getOrigin()}::${this.runtimeId}`
  }

  genTransactionId() {
    return this.generateUUName()
  }

  generateUUName() {
    return uuid()
  }

  // 序列化错误
  private hydrateError = (err: Record<string, string>): Error => {
    const errCtr = (globalThis as { [key: string]: any })[err.name]
    const hydratedErr = new (typeof errCtr === 'function' ? errCtr : Error)(err.message)
    for (const prop in err) hydratedErr[prop] = err[prop]
    return hydratedErr
  }

  abstract routeMessage(packet: Packet): void
  protected abstract receiveMessage(packet: Packet): void
  protected abstract getOrigin(): RuntimeContext
}
