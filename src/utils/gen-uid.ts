import uid from 'tiny-uid'

export type UID = `uid::${string}`

// 输出示例：uid:: abc1234
export const createUID = (): UID => `uid::${uid(7)}`
