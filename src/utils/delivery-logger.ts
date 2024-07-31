import type { InternalPacket } from '../types'
import type { UID } from './gen-uid'

export interface DeliveryReceipt {
  message: InternalPacket
  to: UID
  from: {
    endpointId: string
    fingerprint: UID
  }
}

export function createDeliveryLogger() {
  let logs: ReadonlyArray<DeliveryReceipt> = []

  return {
    add: (...receipts: DeliveryReceipt[]) => {
      logs = [...logs, ...receipts]
    },
    entries: () => logs,
    remove: (message: string | DeliveryReceipt[]) => {
      logs = typeof message === 'string'
        ? logs.filter(receipt => receipt.message.transactionId !== message)
        : logs.filter(receipt => !message.includes(receipt))
    },
  }
}
