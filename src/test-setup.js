import '@testing-library/jest-dom/vitest';

// JSDOM doesn't implement layout APIs we use in some components.
if (typeof Element !== 'undefined' && !Element.prototype.scrollIntoView) {
  Element.prototype.scrollIntoView = () => {};
}
