import type { Browser } from 'webextension-polyfill'
import type {
  Destination,
  GetMessageProtocolDataType,
  GetMessageProtocolReturnType,
  OnMessageCallback,
  PegasusMessage,
  Promisify,
  RemoveListenerCallback,
} from '../types'

export interface TransportBrowserAPI {
  browser: Browser | null
}

export interface TransportMessagingAPI<
  TProtocolMap extends Record<string, any> = Record<string, any>,
> {

  sendMessage: <TType extends keyof TProtocolMap>(
    messageID: TType,
    data: GetMessageProtocolDataType<TProtocolMap[TType]>,
    destination?: Destination,
  ) => Promisify<GetMessageProtocolReturnType<TProtocolMap[TType]>>

  onMessage: <TType extends keyof TProtocolMap>(
    messageID: TType,
    callback: OnMessageCallback<TProtocolMap, TType>,
  ) => RemoveListenerCallback
}

export interface TransportBroadcastEventAPI<
  TProtocolMap extends Record<string, any> = Record<string, any>,
> {

  onBroadcastEvent: <TType extends keyof TProtocolMap>(
    eventID: TType,
    callback: (event: PegasusMessage<TProtocolMap[TType]>) => void,
  ) => () => void

  emitBroadcastEvent: <TType extends keyof TProtocolMap>(
    eventID: TType,
    data: TProtocolMap[TType],
  ) => Promise<void>
}

export interface TransportAPI extends
  TransportMessagingAPI,
  TransportBroadcastEventAPI,
  TransportBrowserAPI { }

class TransportAPISingleton {
  private static instance: TransportAPI | null = null

  private constructor() { }

  /**
   * Initializes the TransportAPI instance. Should only be called once.
   * @param {TransportAPI} api - The TransportAPI instance to be set.
   * @throws {Error} If the API is already initialized.
   */
  public static init(api: TransportAPI): void {
    if (TransportAPISingleton.instance !== null)
      throw new Error('Messaging API already set. Avoid calling "init" multiple times.')

    TransportAPISingleton.instance = api
  }

  /**
   * Retrieves the initialized TransportAPI instance.
   * @returns {TransportAPI} The initialized TransportAPI instance.
   * @throws {Error} If the API is not yet initialized.
   */
  public static getInstance(): TransportAPI {
    if (TransportAPISingleton.instance === null)
      throw new Error('Messaging API wasn\'t set. Ensure "init" is called first.')

    return TransportAPISingleton.instance
  }

  /**
   * Optionally returns the Browser API if available in the TransportAPI.
   * @returns {Browser | null} The Browser API or null if not available.
   */
  public static getBrowserAPI(): Browser | null {
    const api = TransportAPISingleton.getInstance()
    return api.browser || null
  }
}

// Export functions to interact with the singleton
export function initTransportAPI(api: TransportAPI): void {
  TransportAPISingleton.init(api)
}

export function getTransportAPI(): TransportAPI {
  return TransportAPISingleton.getInstance()
}

export function definePegasusBrowserAPI(): Browser | null {
  return TransportAPISingleton.getBrowserAPI()
}