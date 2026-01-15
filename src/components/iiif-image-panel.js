import OpenSeadragon from 'openseadragon';

/**
 * Image panel component with IIIF support via OpenSeadragon
 * Allows region selection for annotation
 */
export class IIIFImagePanel extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this.viewer = null;
    this.selectionOverlay = null;
    this.isDrawing = false;
    this.startPoint = null;
    this.currentRect = null;
  }

  static get observedAttributes() {
    return ['manifest', 'tileSources'];
  }

  connectedCallback() {
    this.render();
    this.initializeViewer();
  }

  disconnectedCallback() {
    if (this.viewer) {
      this.viewer.destroy();
    }
  }

  attributeChangedCallback(name, oldValue, newValue) {
    if (oldValue === newValue || !this.viewer) return;

    if (name === 'manifest') {
      this.loadManifest(newValue);
    } else if (name === 'tileSources') {
      this.loadTileSource(newValue);
    }
  }

  render() {
    this.shadowRoot.innerHTML = `
      <style>
        :host {
          display: block;
          height: 100%;
          position: relative;
        }

        .container {
          height: 100%;
          display: flex;
          flex-direction: column;
        }

        .controls {
          padding: 1rem;
          border-bottom: 1px solid #e0e0e0;
          display: flex;
          gap: 0.5rem;
          align-items: center;
          flex-wrap: wrap;
        }

        input {
          flex: 1;
          min-width: 200px;
          padding: 0.4rem;
          border: 1px solid #ddd;
          border-radius: 4px;
          font-size: 0.9rem;
        }

        button {
          padding: 0.4rem 0.8rem;
          border: 1px solid #ddd;
          border-radius: 4px;
          background: white;
          cursor: pointer;
          font-size: 0.9rem;
        }

        button:hover {
          background: #f5f5f5;
        }

        button.active {
          background: #4CAF50;
          color: white;
          border-color: #4CAF50;
        }

        .viewer-container {
          flex: 1;
          position: relative;
          background: #333;
        }

        #openseadragon {
          width: 100%;
          height: 100%;
        }

        .selection-overlay {
          position: absolute;
          border: 2px solid #4CAF50;
          background: rgba(76, 175, 80, 0.2);
          pointer-events: none;
          z-index: 100;
        }

        .info {
          font-size: 0.85rem;
          color: #666;
          margin-left: auto;
        }

        .help {
          font-size: 0.8rem;
          color: #999;
          padding: 0.5rem 1rem;
          background: #f9f9f9;
        }
      </style>

      <div class="container">
        <div class="controls">
          <input
            type="text"
            id="manifest-input"
            placeholder="IIIF Manifest URL or Image URL"
          />
          <button id="load-btn">Load</button>
          <button id="select-btn">Select Region</button>
          <button id="clear-selection-btn">Clear Selection</button>
          <span class="info" id="info">No image loaded</span>
        </div>
        <div class="help">
          💡 Click "Select Region" then drag on the image to select an area
        </div>
        <div class="viewer-container">
          <div id="openseadragon"></div>
        </div>
      </div>
    `;
  }

  initializeViewer() {
    const container = this.shadowRoot.getElementById('openseadragon');

    this.viewer = OpenSeadragon({
      element: container,
      prefixUrl: 'https://cdn.jsdelivr.net/npm/openseadragon@4.1/build/openseadragon/images/',
      showNavigationControl: true,
      showNavigator: true,
      navigatorPosition: 'BOTTOM_RIGHT',
      sequenceMode: false,
      showReferenceStrip: false,
      debugMode: false,
      minZoomLevel: 0.5,
      maxZoomLevel: 10,
      visibilityRatio: 0.8,
      constrainDuringPan: false,
      gestureSettingsMouse: {
        clickToZoom: false
      }
    });

    this.setupEventListeners();

    // Load from attribute if provided
    if (this.hasAttribute('manifest')) {
      this.loadManifest(this.getAttribute('manifest'));
    } else if (this.hasAttribute('tileSources')) {
      this.loadTileSource(this.getAttribute('tileSources'));
    }
  }

  setupEventListeners() {
    const loadBtn = this.shadowRoot.getElementById('load-btn');
    const selectBtn = this.shadowRoot.getElementById('select-btn');
    const clearSelectionBtn = this.shadowRoot.getElementById('clear-selection-btn');
    const manifestInput = this.shadowRoot.getElementById('manifest-input');

    loadBtn.addEventListener('click', () => {
      const url = manifestInput.value.trim();
      if (url) {
        this.loadImageSource(url);
      }
    });

    manifestInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        const url = manifestInput.value.trim();
        if (url) {
          this.loadImageSource(url);
        }
      }
    });

    selectBtn.addEventListener('click', () => this.toggleSelectionMode());
    clearSelectionBtn.addEventListener('click', () => this.clearSelection());

    // OpenSeadragon canvas events for region selection
    this.viewer.addHandler('canvas-click', (event) => {
      if (this.isDrawing && event.quick) {
        this.handleCanvasClick(event);
      }
    });

    this.viewer.addHandler('canvas-drag', (event) => {
      if (this.isDrawing) {
        this.handleCanvasDrag(event);
      }
    });

    this.viewer.addHandler('canvas-drag-end', (event) => {
      if (this.isDrawing) {
        this.handleCanvasDragEnd(event);
      }
    });
  }

  toggleSelectionMode() {
    this.isDrawing = !this.isDrawing;
    const selectBtn = this.shadowRoot.getElementById('select-btn');

    if (this.isDrawing) {
      selectBtn.classList.add('active');
      selectBtn.textContent = 'Selection Active';
      this.viewer.setMouseNavEnabled(false);
      this.updateInfo('Click and drag to select a region');
    } else {
      selectBtn.classList.remove('active');
      selectBtn.textContent = 'Select Region';
      this.viewer.setMouseNavEnabled(true);
      this.updateInfo('Selection mode disabled');
    }
  }

  handleCanvasClick(event) {
    const webPoint = event.position;
    const viewportPoint = this.viewer.viewport.pointFromPixel(webPoint);
    this.startPoint = viewportPoint;
  }

  handleCanvasDrag(event) {
    if (!this.startPoint) return;

    const webPoint = event.position;
    const viewportPoint = this.viewer.viewport.pointFromPixel(webPoint);

    // Clear previous overlay
    this.clearSelectionOverlay();

    // Create new overlay
    const rect = new OpenSeadragon.Rect(
      Math.min(this.startPoint.x, viewportPoint.x),
      Math.min(this.startPoint.y, viewportPoint.y),
      Math.abs(viewportPoint.x - this.startPoint.x),
      Math.abs(viewportPoint.y - this.startPoint.y)
    );

    this.currentRect = rect;
    this.drawSelectionOverlay(rect);
  }

  handleCanvasDragEnd(event) {
    if (!this.currentRect || !this.startPoint) return;

    const rect = this.currentRect;

    // Convert to IIIF Image API fragment selector format (xywh)
    // Assuming image dimensions are available from tileSources
    const imageWidth = this.viewer.world.getItemAt(0)?.source.dimensions?.x || 1000;
    const imageHeight = this.viewer.world.getItemAt(0)?.source.dimensions?.y || 1000;

    const x = Math.round(rect.x * imageWidth);
    const y = Math.round(rect.y * imageHeight);
    const w = Math.round(rect.width * imageWidth);
    const h = Math.round(rect.height * imageHeight);

    // Create IIIF fragment selector
    const selector = {
      type: 'FragmentSelector',
      conformsTo: 'http://www.w3.org/TR/media-frags/',
      value: `xywh=${x},${y},${w},${h}`
    };

    // Get the current image source
    const source = this.viewer.world.getItemAt(0)?.source;
    const imageUrl = source?.['@id'] || source?.id || this.getAttribute('tileSources') || '';

    const selectionData = {
      source: imageUrl,
      selector: selector,
      region: { x, y, w, h },
      viewport: {
        x: rect.x,
        y: rect.y,
        width: rect.width,
        height: rect.height
      }
    };

    // Dispatch event
    this.dispatchEvent(new CustomEvent('image-region-selected', {
      detail: selectionData,
      bubbles: true,
      composed: true
    }));

    this.updateInfo(`Region selected: ${w}x${h} at (${x}, ${y})`);

    // Optionally disable selection mode after selection
    // this.toggleSelectionMode();
  }

  drawSelectionOverlay(rect) {
    const overlay = document.createElement('div');
    overlay.className = 'selection-overlay';

    this.viewer.addOverlay({
      element: overlay,
      location: rect
    });

    this.selectionOverlay = overlay;
  }

  clearSelectionOverlay() {
    if (this.selectionOverlay) {
      this.viewer.removeOverlay(this.selectionOverlay);
      this.selectionOverlay = null;
    }
  }

  clearSelection() {
    this.clearSelectionOverlay();
    this.startPoint = null;
    this.currentRect = null;
    this.updateInfo('Selection cleared');
  }

  async loadImageSource(url) {
    try {
      // Try to detect if it's a manifest or direct image
      if (url.includes('manifest') || url.endsWith('.json')) {
        await this.loadManifest(url);
      } else {
        this.loadTileSource(url);
      }
    } catch (error) {
      console.error('Error loading image source:', error);
      this.updateInfo('Error loading image');
    }
  }

  async loadManifest(manifestUrl) {
    try {
      const response = await fetch(manifestUrl);
      const manifest = await response.json();

      // IIIF Presentation API 2.x or 3.x
      let tileSource;

      if (manifest.sequences && manifest.sequences[0]) {
        // IIIF 2.x
        const canvas = manifest.sequences[0].canvases[0];
        tileSource = canvas.images[0].resource.service['@id'] || canvas.images[0].resource.service.id;
      } else if (manifest.items && manifest.items[0]) {
        // IIIF 3.x
        const canvas = manifest.items[0];
        const anno = canvas.items[0].items[0];
        tileSource = anno.body.service[0].id || anno.body.service[0]['@id'];
      }

      if (tileSource) {
        this.loadTileSource(tileSource);
        this.updateInfo('IIIF Manifest loaded');
      } else {
        throw new Error('Could not parse manifest');
      }
    } catch (error) {
      console.error('Error loading manifest:', error);
      this.updateInfo('Error loading manifest');
    }
  }

  loadTileSource(tileSource) {
    this.viewer.open(tileSource);
    this.updateInfo('Image loaded');
  }

  updateInfo(message) {
    const info = this.shadowRoot.getElementById('info');
    info.textContent = message;
  }
}

customElements.define('iiif-image-panel', IIIFImagePanel);
