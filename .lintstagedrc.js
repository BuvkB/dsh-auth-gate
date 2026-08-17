/**
 * lint-staged configuration.
 */
export default {
  "*.{ts,tsx,js,mjs,cjs,json,md}": ["prettier --write"],
  "*.{ts,tsx}": ["eslint --fix"],
};
