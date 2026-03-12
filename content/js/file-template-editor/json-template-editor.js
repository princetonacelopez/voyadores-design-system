// JSON JSON Highlighter Module
export class JSONHighlighter {
    static highlight(text, theme = 'light') {
        if (!text.trim()) return '';

        // Escape HTML
        text = text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

        // Highlight JSON syntax
        return text.replace(
            /("(?:[^"\\]|\\.)*")\s*(:?)|(\btrue\b|\bfalse\b|\bnull\b)|(-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)|([{}[\],])/g,
            (match, string, colon, boolean, number, punctuation) => {
                if (string && colon) {
                    return `<span class="json-key">${string}</span><span class="json-punctuation">${colon}</span>`;
                } else if (string) {
                    return `<span class="json-string">${string}</span>`;
                } else if (boolean) {
                    return `<span class="json-boolean">${boolean}</span>`;
                } else if (number) {
                    return `<span class="json-number">${number}</span>`;
                } else if (punctuation) {
                    return `<span class="json-punctuation">${punctuation}</span>`;
                }
                return match;
            }
        );
    }
}

// JSON Formatter Module
export class JSONFormatter {
    static format(jsonString, indent = 2) {
        try {
            const parsed = this.validate(jsonString).data;
            let formatted = JSON.stringify(parsed, null, indent);
            // Add newline before closing curly braces and square brackets
            formatted = formatted.replace(/(\}|])/g, '\n$1');
            // Remove extra blank lines before commas, closing braces, or closing brackets
            formatted = formatted.replace(/\n\s*\n(\s*,|\s*[\]}])/g, '\n$1');
            // Ensure proper indentation after newlines
            formatted = formatted.replace(/\n(\s*)(\}|])/g, (match, spaces, bracket) => `\n${spaces}${bracket}`);
            return formatted.trim();
        } catch (error) {
            throw new Error(`Invalid JSON: ${error.message}`);
        }
    }

    static validate(jsonString) {
        try {
            let parsed = jsonString;
            // If the input is a quoted string, try to parse it as JSON
            if (typeof jsonString === 'string' && jsonString.startsWith('"') && jsonString.endsWith('"')) {
                try {
                    parsed = JSON.parse(jsonString); // Parse the outer string
                    if (typeof parsed === 'string') {
                        parsed = JSON.parse(parsed); // Parse the inner JSON
                    }
                } catch (innerError) {
                    // If inner parsing fails, proceed with outer parsed value
                }
            } else {
                parsed = JSON.parse(jsonString);
            }
            return { isValid: true, data: parsed, error: null };
        } catch (error) {
            return { isValid: false, data: null, error: error.message };
        }
    }
}

// Main JSON Editor Class
export default class JSONEditor {
    constructor(containerID, options = {}) {
        this.container = document.getElementById(containerID);
        if (!this.container) {
            throw new Error(`Container with ID '${containerID}' not found`);
        }

        this.options = {
            height: '600px',
            placeholder: 'Enter your JSON here...',
            showLineNumbers: false,
            editorTitle: 'JSON Editor',
            previewTitle: 'Formatted Preview',
            ...options
        };

        this.render();
        this.initializeElements();
        this.initializeEventListeners();
        this.loadSampleData();
        this.updatePreview();
    }

    render() {
        this.container.innerHTML = `
                    <div class="json-editor-container" style="min-height: ${this.options.height}">
                        <div class="json-editor-panel">
                            <div class="json-editor-panel-title">${this.options.editorTitle}</div>
                            <div class="json-editor-content">
                                <textarea class="json-editor-textarea" placeholder="${this.options.placeholder}" spellcheck="false"></textarea>
                            </div>
                        </div>
                        <div class="json-editor-panel">
                            <div class="json-editor-panel-title">${this.options.previewTitle}</div>
                            <div class="json-preview-content">
                                <div class="json-preview-empty">Preview will appear here...</div>
                            </div>
                        </div>
                    </div>
                `;
    }

    initializeElements() {
        this.editor = this.container.querySelector('.json-editor-textarea');
        this.previewContent = this.container.querySelector('.json-preview-content');
    }

    initializeEventListeners() {
        // Real-time syntax highlighting and preview update
        this.editor.addEventListener('input', () => {
            this.updatePreview();
        });

        // Update preview on paste
        this.editor.addEventListener('paste', () => {
            this.updatePreview();
        });
    }

    updatePreview() {
        const content = this.editor.value.trim();

        if (!content) {
            this.previewContent.innerHTML = '<div class="json-preview-empty">Preview will appear here...</div>';
            return;
        }

        const validation = JSONFormatter.validate(content);

        if (validation.isValid) {
            try {
                const formatted = JSONFormatter.format(content, 2);
                const highlighted = JSONHighlighter.highlight(formatted, 'light');
                this.previewContent.innerHTML = `<pre>${highlighted}</pre>`;
            } catch (error) {
                this.previewContent.innerHTML = `<div class="json-preview-error">Error: ${error.message}</div>`;
            }
        } else {
            this.previewContent.innerHTML = `<div class="json-preview-error">Invalid JSON: ${validation.error}</div>`;
        }
    }

    loadSampleData() {
        const sampleJSON = [];

        this.editor.value = JSON.stringify(sampleJSON, null, 2);
        this.updatePreview();
    }

    // Public methods
    getJSON() {
        const content = this.editor.value.trim();
        if (!content) return null;

        const validation = JSONFormatter.validate(content);
        return validation.isValid ? validation.data : null;
    }

    setJSON(jsonData) {
        try {
            this.editor.value = JSON.stringify(jsonData, null, 2);
            this.updatePreview();
        } catch (error) {
            console.error('Failed to set JSON data:', error);
        }
    }

    getValue() {
        return this.editor.value;
    }

    setValue(value) {
        this.editor.value = value;
        this.updatePreview();
    }

    clear() {
        this.editor.value = '';
        this.highlightLayer.innerHTML = '';
        this.previewContent.innerHTML = '<div class="json-preview-empty">Preview will appear here...</div>';
    }

    isValid() {
        const validation = JSONFormatter.validate(this.editor.value);
        return validation.isValid;
    }

    getValidationError() {
        const validation = JSONFormatter.validate(this.editor.value);
        return validation.error;
    }

    destroy() {
        this.container.innerHTML = '';
    }
}