/**
 * Main container component for IIIF INTERIM Annotator
 * Manages text and image panels with annotation synchronization
 */
export class IIIFInterimAnnotator extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this.annotations = [];
    this.selectedTextRange = null;
    this.selectedImageRegion = null;
  }

  connectedCallback() {
    this.render();
    this.setupEventListeners();
  }

  render() {
    this.shadowRoot.innerHTML = `
      <style>
        :host {
          display: flex;
          width: 100%;
          height: 100vh;
          font-family: system-ui, -apple-system, sans-serif;
          background: #f5f5f5;
        }

        .container {
          display: flex;
          width: 100%;
          height: 100%;
          gap: 1rem;
          padding: 1rem;
        }

        .panel {
          flex: 1;
          background: white;
          border-radius: 8px;
          box-shadow: 0 2px 8px rgba(0,0,0,0.1);
          overflow: hidden;
          display: flex;
          flex-direction: column;
        }

        .panel-header {
          padding: 1rem;
          border-bottom: 1px solid #e0e0e0;
          font-weight: 600;
          background: #fafafa;
        }

        .panel-content {
          flex: 1;
          overflow: auto;
        }

        .toolbar {
          position: fixed;
          bottom: 2rem;
          left: 50%;
          transform: translateX(-50%);
          background: white;
          padding: 1rem 2rem;
          border-radius: 8px;
          box-shadow: 0 4px 16px rgba(0,0,0,0.2);
          display: flex;
          gap: 1rem;
          align-items: center;
          z-index: 1000;
        }

        button {
          padding: 0.5rem 1rem;
          border: none;
          border-radius: 4px;
          background: #2196F3;
          color: white;
          cursor: pointer;
          font-weight: 500;
          transition: background 0.2s;
        }

        button:hover {
          background: #1976D2;
        }

        button:disabled {
          background: #ccc;
          cursor: not-allowed;
        }

        .status {
          color: #666;
          font-size: 0.9rem;
        }

        #connection-overlay {
          position: fixed;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          pointer-events: none;
          z-index: 500;
        }

        .connection-line {
          fill: none;
          stroke: #66BB6A;
          stroke-width: 2;
          opacity: 0.8;
          filter: drop-shadow(0 2px 4px rgba(0,0,0,0.2));
        }
      </style>

      <svg id="connection-overlay"></svg>

      <div class="container">
        <div class="panel">
          <div class="panel-header">Text Panel</div>
          <div class="panel-content">
            <slot name="text-panel">
              <iiif-text-panel></iiif-text-panel>
            </slot>
          </div>
        </div>

        <div class="panel">
          <div class="panel-header">Image Panel (IIIF)</div>
          <div class="panel-content">
            <slot name="image-panel">
              <iiif-image-panel></iiif-image-panel>
            </slot>
          </div>
        </div>
      </div>

      <div class="toolbar">
        <button id="link-btn" disabled>Link Text to Image</button>
        <button id="export-btn">Export Annotations</button>
        <span class="status" id="status">Ready</span>
      </div>
    `;
  }

  setupEventListeners() {
    const linkBtn = this.shadowRoot.getElementById('link-btn');
    const exportBtn = this.shadowRoot.getElementById('export-btn');

    // Listen for text selection events
    this.addEventListener('text-selected', (e) => {
      this.selectedTextRange = e.detail;
      this.updateLinkButton();
      this.updateStatus('Text selected');
    });

    // Listen for image region selection events
    this.addEventListener('image-region-selected', (e) => {
      this.selectedImageRegion = e.detail;
      this.updateLinkButton();
      this.updateStatus('Image region selected');
    });

    linkBtn.addEventListener('click', () => this.createAnnotation());
    exportBtn.addEventListener('click', () => this.exportAnnotations());
  }

  updateLinkButton() {
    const linkBtn = this.shadowRoot.getElementById('link-btn');
    linkBtn.disabled = !(this.selectedTextRange && this.selectedImageRegion);
  }

  updateStatus(message) {
    const status = this.shadowRoot.getElementById('status');
    status.textContent = message;
  }

  createAnnotation() {
    if (!this.selectedTextRange || !this.selectedImageRegion) return;

    const annotation = {
      '@context': 'http://www.w3.org/ns/anno.jsonld',
      type: 'Annotation',
      id: `annotation-${Date.now()}`,
      motivation: 'linking',
      body: {
        type: 'TextualBody',
        value: this.selectedTextRange.text,
        format: 'text/plain',
        selector: this.selectedTextRange.selector
      },
      target: {
        type: 'Image',
        source: this.selectedImageRegion.source,
        selector: this.selectedImageRegion.selector
      },
      created: new Date().toISOString()
    };

    this.annotations.push(annotation);
    this.dispatchEvent(new CustomEvent('annotation-created', {
      detail: annotation,
      bubbles: true,
      composed: true
    }));

    // Confirm/persist the image rectangle
    const imagePanel = this.querySelector('iiif-image-panel') ||
                       this.shadowRoot.querySelector('slot[name="image-panel"]')?.assignedElements()[0];
    if (imagePanel && typeof imagePanel.confirmCurrentRect === 'function') {
      imagePanel.confirmCurrentRect();
    }

    // Draw connection line
    this.drawConnectionLine();

    this.updateStatus(`Annotation created (${this.annotations.length} total)`);
    this.selectedTextRange = null;
    this.selectedImageRegion = null;
    this.updateLinkButton();
  }

  drawConnectionLine() {
    // Get text panel and image panel components
    const textPanel = this.querySelector('iiif-text-panel') ||
                      this.shadowRoot.querySelector('slot[name="text-panel"]')?.assignedElements()[0];
    const imagePanel = this.querySelector('iiif-image-panel') ||
                       this.shadowRoot.querySelector('slot[name="image-panel"]')?.assignedElements()[0];

    if (!textPanel || !imagePanel) return;

    // Find the LAST confirmed text element (the one just created)
    const allConfirmedTexts = textPanel.shadowRoot?.querySelectorAll('.text-confirmed');
    if (!allConfirmedTexts || allConfirmedTexts.length === 0) return;
    const textElement = allConfirmedTexts[allConfirmedTexts.length - 1];

    // Find the LAST confirmed image rectangle (the one just created)
    const allConfirmedRects = imagePanel.shadowRoot?.querySelectorAll('.selection-rect.confirmed');
    if (!allConfirmedRects || allConfirmedRects.length === 0) return;
    const imageRect = allConfirmedRects[allConfirmedRects.length - 1];

    // Get bounding rectangles relative to viewport
    const textBounds = textElement.getBoundingClientRect();

    // For image, we need to get the selection canvas position
    const selectionCanvas = imagePanel.shadowRoot?.querySelector('#selection-canvas');
    if (!selectionCanvas) return;

    const canvasBounds = selectionCanvas.getBoundingClientRect();

    // Calculate image region position from the confirmed rectangle
    const rectStyle = imageRect.style;
    const imageBounds = {
      left: canvasBounds.left + parseFloat(rectStyle.left),
      top: canvasBounds.top + parseFloat(rectStyle.top),
      width: parseFloat(rectStyle.width),
      height: parseFloat(rectStyle.height)
    };
    imageBounds.right = imageBounds.left + imageBounds.width;
    imageBounds.bottom = imageBounds.top + imageBounds.height;

    // Calculate connection points
    // Start: right edge, middle of text
    const startX = textBounds.right;
    const startY = textBounds.top + textBounds.height / 2;

    // End: left edge, middle of image region
    const endX = imageBounds.left;
    const endY = imageBounds.top + imageBounds.height / 2;

    // Control points for Bezier curve
    const controlX1 = startX + (endX - startX) * 0.5;
    const controlY1 = startY;
    const controlX2 = startX + (endX - startX) * 0.5;
    const controlY2 = endY;

    // Create SVG path
    const svg = this.shadowRoot.getElementById('connection-overlay');
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');

    const pathData = `M ${startX} ${startY} C ${controlX1} ${controlY1}, ${controlX2} ${controlY2}, ${endX} ${endY}`;
    path.setAttribute('d', pathData);
    path.setAttribute('class', 'connection-line');
    path.setAttribute('data-annotation', this.annotations.length - 1);

    svg.appendChild(path);
  }

  exportAnnotations() {
    const annotationList = {
      '@context': 'http://www.w3.org/ns/anno.jsonld',
      type: 'AnnotationCollection',
      label: 'INTERIM Annotations',
      created: new Date().toISOString(),
      items: this.annotations
    };

    const blob = new Blob([JSON.stringify(annotationList, null, 2)], {
      type: 'application/json'
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `interim-annotations-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);

    this.updateStatus('Annotations exported');
  }

  getAnnotations() {
    return this.annotations;
  }

  loadAnnotations(annotations) {
    this.annotations = Array.isArray(annotations) ? annotations : [];
    this.updateStatus(`Loaded ${this.annotations.length} annotations`);
  }
}

customElements.define('iiif-interim-annotator', IIIFInterimAnnotator);
