/**
 * lint-staged configuration.
 */
export default {
  "*.{ts,js,mjs,cjs,json,md}": ["prettier --write"],
  "*.ts": ["eslint --fix"],
};
