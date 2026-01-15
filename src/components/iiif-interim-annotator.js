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
      </style>

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

    this.updateStatus(`Annotation created (${this.annotations.length} total)`);
    this.selectedTextRange = null;
    this.selectedImageRegion = null;
    this.updateLinkButton();
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
