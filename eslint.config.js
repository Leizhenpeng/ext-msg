// @ts-check
import antfu from '@antfu/eslint-config'

export default antfu(
  {
    ignores: [
      // eslint ignore globs here、
      // console off

    ],
  },
  {
    rules: {
      // overrides
      'no-console': 'off', // 关闭 console 错误

    },
  },
)
