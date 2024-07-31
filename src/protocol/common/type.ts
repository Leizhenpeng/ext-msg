export type RuntimeContext =
  | 'devtools'
  | 'background'
  | 'popup'
  | 'options'
  | 'content-script'
  | 'window'

export type Destination = Endpoint | RuntimeContext | string

export interface Endpoint {
  context: RuntimeContext
  tabId: number | null
  frameId?: number
}

/**
 * Call to ensure an active listener has been removed.
 */
export type RemoveListenerCallback = () => void

/**
 * 获取函数的参数类型，如果是函数类型，返回参数类型的联合类型；如果不是函数类型，则返回原类型。
 * type Example1 = ParamType<() => void>; // undefined
 * type Example2 = ParamType<(arg: string) => void>; // string
 * type Example3 = ParamType<(arg1: string, arg2: number) => void>; // string | number
 * type Example4 = ParamType<string>; // string
 * type Example5 = ParamType<{ name: string }>; // { name: string }
 */
export type ParamType<T> = T extends (
  ...args: infer Args
) =>
any
  ? Args['length'] extends 0 | 1
    ? Args[0]
    : never
  :
  T extends any
    ? T
    : never

/**
 * 获取函数的返回类型，如果不是函数，则返回原类型。
 * type Example1 = ReturnType<() => number>; // number
 * type Example2 = ReturnType<string>; // string
 * type Example3 = ReturnType<(x: string) => boolean>; // boolean
 * type Example4 = ReturnType<{ name: string }>; // { name: string }
 */
export type ReturnType<T> = T extends (...args: any[]) => infer R ? R : T

/**
 * Promisify<T> returns Promise<T> if it is not a promise, otherwise it returns T.
 */
export type Promisify<T> = T extends Promise<unknown> ? T : Promise<T>
