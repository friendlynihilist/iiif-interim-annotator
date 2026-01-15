/**
 * Text panel component for displaying and selecting text portions
 * Supports word-level and character-level selection
 */
export class IIIFTextPanel extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this.textContent = '';
    this.annotations = [];
  }

  static get observedAttributes() {
    return ['src', 'text'];
  }

  connectedCallback() {
    this.render();
    this.setupEventListeners();

    // Load text if src attribute is provided
    if (this.hasAttribute('src')) {
      this.loadTextFromUrl(this.getAttribute('src'));
    } else if (this.hasAttribute('text')) {
      this.setTextContent(this.getAttribute('text'));
    }
  }

  attributeChangedCallback(name, oldValue, newValue) {
    if (oldValue === newValue) return;

    if (name === 'src') {
      this.loadTextFromUrl(newValue);
    } else if (name === 'text') {
      this.setTextContent(newValue);
    }
  }

  render() {
    this.shadowRoot.innerHTML = `
      <style>
        :host {
          display: block;
          height: 100%;
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
        }

        input[type="file"] {
          font-size: 0.9rem;
        }

        .text-area {
          flex: 1;
          padding: 2rem;
          overflow-y: auto;
          line-height: 1.8;
          font-size: 1rem;
          user-select: text;
        }

        .text-area::selection {
          background: #B3D4FC;
        }

        .highlighted {
          background: #FFEB3B;
          cursor: pointer;
          transition: background 0.2s;
        }

        .highlighted:hover {
          background: #FDD835;
        }

        .selection-active {
          background: #4CAF50;
          color: white;
          padding: 0.2rem 0.4rem;
          border-radius: 3px;
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

        .info {
          font-size: 0.85rem;
          color: #666;
          margin-left: auto;
        }
      </style>

      <div class="container">
        <div class="controls">
          <input type="file" id="file-input" accept=".txt,.xml,.html" />
          <button id="clear-btn">Clear Text</button>
          <button id="clear-selection-btn">Clear Selection</button>
          <span class="info" id="info">No text loaded</span>
        </div>
        <div class="text-area" id="text-display"></div>
      </div>
    `;
  }

  setupEventListeners() {
    const fileInput = this.shadowRoot.getElementById('file-input');
    const clearBtn = this.shadowRoot.getElementById('clear-btn');
    const clearSelectionBtn = this.shadowRoot.getElementById('clear-selection-btn');
    const textDisplay = this.shadowRoot.getElementById('text-display');

    fileInput.addEventListener('change', (e) => this.handleFileUpload(e));
    clearBtn.addEventListener('click', () => this.clearText());
    clearSelectionBtn.addEventListener('click', () => this.clearSelection());

    // Handle text selection
    textDisplay.addEventListener('mouseup', () => this.handleTextSelection());
  }

  async loadTextFromUrl(url) {
    try {
      const response = await fetch(url);
      const text = await response.text();
      this.setTextContent(text);
    } catch (error) {
      console.error('Error loading text:', error);
      this.updateInfo('Error loading text file');
    }
  }

  handleFileUpload(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      this.setTextContent(e.target.result);
    };
    reader.readAsText(file);
  }

  setTextContent(text) {
    this.textContent = text;
    const textDisplay = this.shadowRoot.getElementById('text-display');
    textDisplay.textContent = text;
    this.updateInfo(`Loaded ${text.length} characters`);
  }

  handleTextSelection() {
    const selection = this.shadowRoot.getSelection();
    if (!selection || selection.isCollapsed) {
      return;
    }

    const selectedText = selection.toString().trim();
    if (!selectedText) return;

    // Get the range of the selection
    const range = selection.getRangeAt(0);
    const textDisplay = this.shadowRoot.getElementById('text-display');

    // Calculate character offset within the full text
    const preSelectionRange = range.cloneRange();
    preSelectionRange.selectNodeContents(textDisplay);
    preSelectionRange.setEnd(range.startContainer, range.startOffset);
    const start = preSelectionRange.toString().length;
    const end = start + selectedText.length;

    // Create a text position selector (Web Annotation standard)
    const selector = {
      type: 'TextPositionSelector',
      start: start,
      end: end
    };

    // Also create a TextQuoteSelector for robustness
    const quoteSelector = {
      type: 'TextQuoteSelector',
      exact: selectedText,
      prefix: this.textContent.substring(Math.max(0, start - 50), start),
      suffix: this.textContent.substring(end, Math.min(this.textContent.length, end + 50))
    };

    const selectionData = {
      text: selectedText,
      selector: {
        type: 'Choice',
        items: [selector, quoteSelector]
      },
      start: start,
      end: end
    };

    // Dispatch event to parent annotator
    this.dispatchEvent(new CustomEvent('text-selected', {
      detail: selectionData,
      bubbles: true,
      composed: true
    }));

    this.updateInfo(`Selected: "${selectedText.substring(0, 30)}${selectedText.length > 30 ? '...' : ''}"`);
  }

  clearSelection() {
    const selection = this.shadowRoot.getSelection();
    if (selection) {
      selection.removeAllRanges();
    }
    this.updateInfo('Selection cleared');
  }

  clearText() {
    this.textContent = '';
    const textDisplay = this.shadowRoot.getElementById('text-display');
    textDisplay.textContent = '';
    this.updateInfo('Text cleared');
  }

  updateInfo(message) {
    const info = this.shadowRoot.getElementById('info');
    info.textContent = message;
  }

  highlightAnnotation(annotation) {
    // TODO: Implement highlighting of existing annotations
    // This will wrap text segments in <mark> elements
  }
}

customElements.define('iiif-text-panel', IIIFTextPanel);
