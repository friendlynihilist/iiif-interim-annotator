/**
 * IIIF INTERIM Annotator
 * Web Components-based semantic annotator for intermedial phenomena
 *
 * @author Carlo Teo Pedretti
 * @license MIT
 */

// Import and register all components
import './components/iiif-interim-annotator.js';
import './components/iiif-text-panel.js';
import './components/iiif-image-panel.js';

// Export components for programmatic use
export { IIIFInterimAnnotator } from './components/iiif-interim-annotator.js';
export { IIIFTextPanel } from './components/iiif-text-panel.js';
export { IIIFImagePanel } from './components/iiif-image-panel.js';

// Version
export const version = '0.1.0';

console.log('IIIF INTERIM Annotator loaded - v' + version);
