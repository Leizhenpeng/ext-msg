import { SocketRuntime } from '../runtime'
import type { Packet } from '../interface'
import { usePostMessaging } from '../../../message-tool/browser-channel-message'
import type { RuntimeContext } from '../../common'

interface Props {
  namespace?: string
}
export class ContentScriptSocket<Protocol extends Record<string, any>> extends SocketRuntime<Protocol> {
  private windowMessaging: ReturnType<typeof usePostMessaging>
  static instance: ContentScriptSocket<any>
  // private portMessage: (msg: Packet) => void

  constructor() {
    super()
    this.windowMessaging = usePostMessaging('content-script')
    this.windowMessaging.onMessage((msg) => {
      this.handleMessage(msg as Packet)
    })
  }

  setNamespace(namespace: string): void {
    this.windowMessaging.setNamespace(namespace)
    this.windowMessaging.enable()
  }

  static getSocket<Protocol extends Record<string, any>>(opt: Props): ContentScriptSocket<Protocol> {
    if (!ContentScriptSocket.instance) {
      ContentScriptSocket.instance = new ContentScriptSocket<Protocol>()
      if (opt.namespace)
        ContentScriptSocket.instance.setNamespace(opt.namespace)
    }
    return ContentScriptSocket.instance as ContentScriptSocket<Protocol>
  }

  routeMessage(packet: Packet): void {
    this.windowMessaging.postMessage(packet as any)
  }

  getOrigin(): RuntimeContext {
    return 'window' as RuntimeContext // 确保返回类型符合RuntimeContext定义
  }
}

export function createWindowSocket<Protocol extends Record<string, any>>(opt: Props): WindowSocket<Protocol> {
  return WindowSocket.getSocket(opt)
}

// export function createSocket
