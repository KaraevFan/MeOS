import { dirname } from 'path'
import { fileURLToPath } from 'url'
import { FlatCompat } from '@eslint/eslintrc'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const compat = new FlatCompat({
  baseDirectory: __dirname,
})

const eslintConfig = [
  ...compat.extends('next/core-web-vitals', 'next/typescript'),
  {
    rules: {
      'no-restricted-syntax': [
        'error',
        {
          selector: "CallExpression[callee.property.name='toLocaleDateString'][arguments.0.value='en-CA']",
          message: "Use getLocalDateString(timezone) from @/lib/dates instead of toLocaleDateString('en-CA'). See: lib/dates.ts",
        },
        {
          selector: "CallExpression[callee.name='todayLocalDate']",
          message: "todayLocalDate() is removed. Use getLocalDateString(timezone) from @/lib/dates.",
        },
        {
          selector: "CallExpression[callee.property.name='toISOString'] ~ CallExpression[callee.property.name='split'][arguments.0.value='T']",
          message: "Avoid toISOString().split('T')[0] for dates — it returns UTC. Use getLocalDateString(timezone) from @/lib/dates.",
        },
      ],
    },
  },
]

export default eslintConfig
