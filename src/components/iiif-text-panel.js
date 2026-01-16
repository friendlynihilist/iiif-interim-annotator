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
    this.currentSelection = null;
    this.currentSelectionElement = null;
    this.confirmedElements = []; // Store all confirmed (green) text elements
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

        .text-selected {
          background: #FFEB3B;
          cursor: pointer;
          transition: background 0.3s;
          padding: 0.1rem 0.2rem;
          border-radius: 2px;
        }

        .text-selected:hover {
          background: #FDD835;
        }

        .text-confirmed {
          background: #81C784;
          color: white;
          cursor: pointer;
          transition: background 0.3s;
          padding: 0.1rem 0.2rem;
          border-radius: 2px;
        }

        .text-confirmed:hover {
          background: #66BB6A;
        }

        button {
          padding: 0.4rem 0.8rem;
          border: 1px solid #ddd;
          border-radius: 4px;
          background: white;
          cursor: pointer;
          font-size: 0.9rem;
        }

        button:hover:not(:disabled) {
          background: #f5f5f5;
        }

        button:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        #confirm-selection-btn:not(:disabled) {
          background: #FFF9C4;
          border-color: #FBC02D;
        }

        #confirm-selection-btn:not(:disabled):hover {
          background: #FFF59D;
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
          <button id="confirm-selection-btn" disabled>Confirm Text Selection</button>
          <button id="clear-selection-btn">Clear Selection</button>
          <button id="clear-btn">Clear Text</button>
          <span class="info" id="info">No text loaded</span>
        </div>
        <div class="text-area" id="text-display"></div>
      </div>
    `;
  }

  setupEventListeners() {
    const fileInput = this.shadowRoot.getElementById('file-input');
    const clearBtn = this.shadowRoot.getElementById('clear-btn');
    const confirmSelectionBtn = this.shadowRoot.getElementById('confirm-selection-btn');
    const clearSelectionBtn = this.shadowRoot.getElementById('clear-selection-btn');
    const textDisplay = this.shadowRoot.getElementById('text-display');

    fileInput.addEventListener('change', (e) => this.handleFileUpload(e));
    clearBtn.addEventListener('click', () => this.clearText());
    confirmSelectionBtn.addEventListener('click', () => this.confirmTextSelection());
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

    // Remove previous YELLOW selection if exists (but keep green confirmed ones)
    if (this.currentSelectionElement && this.currentSelectionElement.className === 'text-selected') {
      const parent = this.currentSelectionElement.parentNode;
      const textNode = document.createTextNode(this.currentSelectionElement.textContent);
      parent.replaceChild(textNode, this.currentSelectionElement);
      parent.normalize(); // Merge adjacent text nodes
    }

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

    // Save current selection
    this.currentSelection = selectionData;

    // Wrap selected text in a mark element with yellow highlight
    const mark = document.createElement('mark');
    mark.className = 'text-selected';
    mark.textContent = selectedText;

    try {
      range.deleteContents();
      range.insertNode(mark);
      this.currentSelectionElement = mark;
    } catch (error) {
      console.error('Error highlighting text:', error);
    }

    // Clear the browser selection
    selection.removeAllRanges();

    // Enable confirm button
    const confirmBtn = this.shadowRoot.getElementById('confirm-selection-btn');
    confirmBtn.disabled = false;

    this.updateInfo(`Selected (yellow): "${selectedText.substring(0, 30)}${selectedText.length > 30 ? '...' : ''}"`);
  }

  confirmTextSelection() {
    if (!this.currentSelection || !this.currentSelectionElement) {
      return;
    }

    // Change highlight color from yellow to green
    this.currentSelectionElement.className = 'text-confirmed';

    // Add to confirmed elements list (these will persist)
    this.confirmedElements.push({
      element: this.currentSelectionElement,
      selection: this.currentSelection
    });

    // Dispatch event to parent annotator (now the selection is confirmed)
    this.dispatchEvent(new CustomEvent('text-selected', {
      detail: this.currentSelection,
      bubbles: true,
      composed: true
    }));

    // Reset current selection (ready for next annotation)
    this.currentSelection = null;
    this.currentSelectionElement = null;

    // Disable confirm button
    const confirmBtn = this.shadowRoot.getElementById('confirm-selection-btn');
    confirmBtn.disabled = true;

    this.updateInfo(`Confirmed (green) - Ready for next selection`);
  }

  clearSelection() {
    // Remove ONLY the current yellow highlight from DOM (keep green confirmed ones)
    if (this.currentSelectionElement && this.currentSelectionElement.className === 'text-selected') {
      const parent = this.currentSelectionElement.parentNode;
      const textNode = document.createTextNode(this.currentSelectionElement.textContent);
      parent.replaceChild(textNode, this.currentSelectionElement);
      parent.normalize();
    }

    // Clear browser selection
    const selection = this.shadowRoot.getSelection();
    if (selection) {
      selection.removeAllRanges();
    }

    // Reset current state only
    this.currentSelection = null;
    this.currentSelectionElement = null;

    // Disable confirm button
    const confirmBtn = this.shadowRoot.getElementById('confirm-selection-btn');
    confirmBtn.disabled = true;

    this.updateInfo('Current selection cleared');
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
