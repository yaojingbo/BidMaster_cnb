const { FlatCompat } = require('@eslint/eslintrc');
const path = require('node:path');

const compat = new FlatCompat({ baseDirectory: __dirname });

module.exports = [
  ...compat.extends('next/core-web-vitals'),
  {
    ignores: ['.next/**', 'node_modules/**', 'coverage/**', 'playwright-report/**', 'test-results/**', 'src/backend/**'],
  },
];
