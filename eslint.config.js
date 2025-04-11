import { config } from '@douglasneuroinformatics/eslint-config';

export default config(
  {
    env: {
      browser: false,
      es2021: true,
      node: true
    },
    exclude: ['vendor/*'],
    typescript: {
      enabled: true
    }
  },
  {
    rules: {
      'no-console': 'off'
    }
  }
);
