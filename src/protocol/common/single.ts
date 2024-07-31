export class Singleton {
  // 修改静态成员变量类型为非泛型类型
  private static instance: Singleton | null = null

  protected constructor() {
    if ((this.constructor as any).instance)
      throw new Error('Singleton class can\'t be instantiated more than once.')
  }

  public static getInstance<T>(this: new () => T): T {
    if (!(this as any).instance)
      (this as any).instance = new this()

    return (this as any).instance
  }
}
