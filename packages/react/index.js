'use strict';

const React = require('react');

/**
 * Drop this in your root layout to load the fastui overlay in development:
 *   <FastUIOverlay />            // daemon on the default port
 *   <FastUIOverlay origin="http://localhost:4101" />
 * Renders nothing in production.
 */
function FastUIOverlay({ origin = 'http://localhost:4100' } = {}) {
  if (process.env.NODE_ENV === 'production') return null;
  return React.createElement('script', { src: `${origin}/overlay.js`, defer: true });
}

module.exports = { FastUIOverlay };
