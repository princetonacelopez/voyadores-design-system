export default class FileTemplateEditor {
    constructor(containerId, options = {}) {
        this.container = document.getElementById(containerId);
        if (!this.container) {
            throw new Error(`Container element with id "${containerId}" not found`);
        }

        this.options = {
            height: '100%',
            placeholder: 'Start typing here...',
            ...options
        };

        this.currentMode = 'preview';
        this.doc = null;
        this.body = null;
        this.iframe = null;
        this.codeView = null;
        this.selectedImage = null;

        // Store original CSHTML content and structure
        this.originalCshtml = '';
        this.razorBlocks = new Map();
        this.razorBlockCounter = 0;

        // Store complete document structure
        this.documentDoctype = '<!DOCTYPE html>'; // Default DOCTYPE
        this.documentHead = '';
        this.documentAttributes = '';
        this.preBodyContent = '';
        this.postBodyContent = '';
        this.preHtmlContent = '';
        this.postHtmlContent = '';

        this.init();
    }

    init() {
        this.createUI();
        this.initIframe();
        this.setupEventListeners();
        this.setupKeyboardShortcuts();
    }

    createUI() {
        const editorHTML = `
            <div class="file-template-editor">
                <div class="file-template-toolbar">
                    <div class="file-template-toolbar-group">
                        <button class="file-template-format-btn" data-command="bold" data-tooltip="Bold (Ctrl+B)">
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 384 512"><path d="M0 64C0 46.3 14.3 32 32 32l48 0 16 0 128 0c70.7 0 128 57.3 128 128c0 31.3-11.3 60.1-30 82.3c37.1 22.4 62 63.1 62 109.7c0 70.7-57.3 128-128 128L96 480l-16 0-48 0c-17.7 0-32-14.3-32-32s14.3-32 32-32l16 0 0-160L48 96 32 96C14.3 96 0 81.7 0 64zM224 224c35.3 0 64-28.7 64-64s-28.7-64-64-64L112 96l0 128 112 0zM112 288l0 128 144 0c35.3 0 64-28.7 64-64s-28.7-64-64-64l-32 0-112 0z"/></svg>
                        </button>
                        <button class="file-template-format-btn" data-command="italic" data-tooltip="Italic (Ctrl+I)">
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 384 512"><path d="M128 64c0-17.7 14.3-32 32-32l192 0c17.7 0 32 14.3 32 32s-14.3 32-32 32l-58.7 0L160 416l64 0c17.7 0 32 14.3 32 32s-14.3 32-32 32L32 480c-17.7 0-32-14.3-32-32s14.3-32 32-32l58.7 0L224 96l-64 0c-17.7 0-32-14.3-32-32z"/></svg>
                        </button>
                        <button class="file-template-format-btn" data-command="underline" data-tooltip="Underline (Ctrl+U)">
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 448 512"><path d="M16 64c0-17.7 14.3-32 32-32l96 0c17.7 0 32 14.3 32 32s-14.3 32-32 32l-16 0 0 128c0 53 43 96 96 96s96-43 96-96l0-128-16 0c-17.7 0-32-14.3-32-32s14.3-32 32-32l96 0c17.7 0 32 14.3 32 32s-14.3 32-32 32l-16 0 0 128c0 88.4-71.6 160-160 160s-160-71.6-160-160L64 96 48 96C30.3 96 16 81.7 16 64zM0 448c0-17.7 14.3-32 32-32l384 0c17.7 0 32 14.3 32 32s-14.3 32-32 32L32 480c-17.7 0-32-14.3-32-32z"/></svg>
                        </button>
                    </div>
                    
                    <div class="file-template-toolbar-separator"></div>
                    
                    <div class="file-template-toolbar-group">
                        <button class="file-template-format-btn" data-command="insertUnorderedList" data-tooltip="Bullet List">
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><path d="M64 144a48 48 0 1 0 0-96 48 48 0 1 0 0 96zM192 64c-17.7 0-32 14.3-32 32s14.3 32 32 32l288 0c17.7 0 32-14.3 32-32s-14.3-32-32-32L192 64zm0 160c-17.7 0-32 14.3-32 32s14.3 32 32 32l288 0c17.7 0 32-14.3 32-32s-14.3-32-32-32l-288 0zm0 160c-17.7 0-32 14.3-32 32s14.3 32 32 32l288 0c17.7 0 32-14.3 32-32s-14.3-32-32-32l-288 0zM64 464a48 48 0 1 0 0-96 48 48 0 1 0 0 96zm48-208a48 48 0 1 0 -96 0 48 48 0 1 0 96 0z"/></svg>
                        </button>
                        <button class="file-template-format-btn" data-command="insertOrderedList" data-tooltip="Numbered List">
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><path d="M24 56c0-13.3 10.7-24 24-24l32 0c13.3 0 24 10.7 24 24l0 120 16 0c13.3 0 24 10.7 24 24s-10.7 24-24 24l-80 0c-13.3 0-24-10.7-24-24s10.7-24 24-24l16 0 0-96-8 0C34.7 80 24 69.3 24 56zM86.7 341.2c-6.5-7.4-18.3-6.9-24 1.2L51.5 357.9c-7.7 10.8-22.7 13.3-33.5 5.6s-13.3-22.7-5.6-33.5l11.1-15.6c23.7-33.2 72.3-35.6 99.2-4.9c21.3 24.4 20.8 60.9-1.1 84.7L86.8 432l33.2 0c13.3 0 24 10.7 24 24s-10.7 24-24 24l-88 0c-9.5 0-18.2-5.6-22-14.4s-2.1-18.9 4.3-25.9l72-78c5.3-5.8 5.4-14.6 .3-20.5zM224 64l256 0c17.7 0 32 14.3 32 32s-14.3 32-32 32l-256 0c-17.7 0-32-14.3-32-32s14.3-32 32-32zm0 160l256 0c17.7 0 32 14.3 32 32s-14.3 32-32 32l-256 0c-17.7 0-32-14.3-32-32s14.3-32 32-32zm0 160l256 0c17.7 0 32 14.3 32 32s-14.3 32-32 32l-256 0c-17.7 0-32-14.3-32-32s14.3-32 32-32z"/></svg>
                        </button>
                    </div>
                    
                    <div class="file-template-toolbar-separator"></div>
                    
                    <div class="file-template-toolbar-group">
                        <button class="file-template-format-btn" data-command="justifyLeft" data-tooltip="Align Left (Ctrl+Shift+L)">
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 448 512"><path d="M288 64c0 17.7-14.3 32-32 32L32 96C14.3 96 0 81.7 0 64S14.3 32 32 32l224 0c17.7 0 32 14.3 32 32zm0 256c0 17.7-14.3 32-32 32L32 352c-17.7 0-32-14.3-32-32s14.3-32 32-32l224 0c17.7 0 32 14.3 32 32zM0 192c0-17.7 14.3-32 32-32l384 0c17.7 0 32 14.3 32 32s-14.3 32-32 32L32 224c-17.7 0-32-14.3-32-32zM4448 448c0 17.7-14.3 32-32 32L32 480c-17.7 0-32-14.3-32-32s14.3-32 32-32l384 0c17.7 0 32 14.3 32 32z"/></svg>
                        </button>
                        <button class="file-template-format-btn" data-command="justifyCenter" data-tooltip="Align Center (Ctrl+Shift+E)">
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 448 512"><path d="M352 64c0-17.7-14.3-32-32-32L128 32c-17.7 0-32 14.3-32 32s14.3 32 32 32l192 0c17.7 0 32-14.3 32-32zm96 128c0-17.7-14.3-32-32-32L32 160c-17.7 0-32 14.3-32 32s14.3 32 32 32l384 0c17.7 0 32-14.3 32-32zM0 448c0 17.7 14.3 32 32 32l384 0c17.7 0 32-14.3 32-32s-14.3-32-32-32L32 416c-17.7 0-32 14.3-32 32zM352 320c0-17.7-14.3-32-32-32l-192 0c-17.7 0-32 14.3-32 32s14.3 32 32 32l192 0c17.7 0 32-14.3 32-32z"/></svg>
                        </button>
                        <button class="file-template-format-btn" data-command="justifyRight" data-tooltip="Align Right (Ctrl+Shift+R)">
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 448 512"><path d="M448 64c0 17.7-14.3 32-32 32L192 96c-17.7 0-32-14.3-32-32s14.3-32 32-32l224 0c17.7 0 32 14.3 32 32zm0 256c0 17.7-14.3 32-32 32l-224 0c-17.7 0-32-14.3-32-32s14.3-32 32-32l224 0c17.7 0 32 14.3 32 32zM0 192c0-17.7 14.3-32 32-32l384 0c17.7 0 32 14.3 32 32s-14.3 32-32 32L32 224c-17.7 0-32-14.3-32-32zM448 448c0 17.7-14.3 32-32 32L32 480c-17.7 0-32-14.3-32-32s14.3-32 32-32l384 0c17.7 0 32 14.3 32 32z"/></svg>
                        </button>
                        <button class="file-template-format-btn" data-command="justifyFull" data-tooltip="Justify (Ctrl+Shift+J)">
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 448 512"><path d="M448 64c0-17.7-14.3-32-32-32L32 32C14.3 32 0 46.3 0 64S14.3 96 32 96l384 0c17.7 0 32-14.3 32-32zm0 256c0-17.7-14.3-32-32-32L32 288c-17.7 0-32 14.3-32 32s14.3 32 32 32l384 0c17.7 0 32-14.3 32-32zM0 192c0-17.7 14.3-32 32-32l384 0c17.7 0 32 14.3 32 32s-14.3 32-32 32L32 224c-17.7 0-32-14.3-32-32zM448 448c0 17.7-14.3 32-32 32L32 480c-17.7 0-32-14.3-32-32s14.3-32 32-32l384 0c17.7 0 32 14.3 32 32z"/></svg>
                        </button>
                    </div>
                    
                    <div class="file-template-toolbar-separator"></div>
                    
                    <div class="file-template-toolbar-group">
                        <select class="file-template-font-size" data-tooltip="Font Size">
                            <option value="10">10px</option>
                            <option value="11">11px</option>
                            <option value="12">12px</option>
                            <option value="13">13px</option>
                            <option value="14">14px</option>
                            <option value="15">15px</option>
                            <option value="16">16px</option>
                            <option value="20">20px</option>
                            <option value="24">24px</option>
                            <option value="32">32px</option>
                            <option value="36">36px</option>
                            <option value="40">40px</option>
                            <option value="48">48px</option>
                            <option value="56">56px</option>
                            <option value="64">64px</option>
                            <option value="72">72px</option>
                            <option value="80">80px</option>
                        </select>
                    </div>
                    
                    <div class="file-template-toolbar-separator"></div>
                    
                    <div class="file-template-toolbar-group">
                        <button class="file-template-image-btn" data-tooltip="Insert/Replace Image">
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><path d="M0 96C0 60.7 28.7 32 64 32l384 0c35.3 0 64 28.7 64 64l0 320c0 35.3-28.7 64-64 64L64 480c-35.3 0-64-28.7-64-64L0 96zM323.8 202.5c-4.5-6.6-11.9-10.5-19.8-10.5s-15.4 3.9-19.8 10.5l-87 127.6L170.7 297c-4.6-5.7-11.5-9-18.7-9s-14.2 3.3-18.7 9l-64 80c-5.8 7.2-6.9 17.1-2.9 25.4s12.4 13.6 21.6 13.6l96 0 32 0 208 0c8.9 0 17.1-4.9 21.2-12.8s3.6-17.4-1.4-24.7l-120-176zM112 192a48 48 0 1 0 0-96 48 48 0 1 0 0 96z"/></svg>
                        </button>
                        <input type="file" class="file-template-image-input" accept=".png, .jpg, .jpeg, .svg">
                    </div>
                    
                    <div class="file-template-mode-toggle">
                        <button class="file-template-mode-btn active" data-mode="preview" data-tooltip="Preview">
                            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                                <path d="M8 3C4.5 3 1.5 5.5 0.5 8C1.5 10.5 4.5 13 8 13C11.5 13 14.5 10.5 15.5 8C14.5 5.5 11.5 3 8 3Z" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
                                <path d="M8 10C9.10457 10 10 9.10457 10 8C10 6.89543 9.10457 6 8 6C6.89543 6 6 6.89543 6 8C6 9.10457 6.89543 10 8 10Z" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
                            </svg>
                        </button>
                        <button class="file-template-mode-btn" data-mode="code" data-tooltip="Code View">
                            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                                <path d="M5 12L1 8L5 4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
                                <path d="M11 4L15 8L11 12" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
                            </svg>
                        </button>
                    </div>
                </div>
                
                <div class="file-template-editor-area">
                    <iframe class="file-template-iframe" style="height: ${this.options.height}"></iframe>
                    <textarea class="file-template-code-view" style="height: ${this.options.height}; font-family: 'Courier New', monospace; font-size: 14px; line-height: 1.4; tab-size: 2;" spellcheck="false"></textarea>
                </div>
            </div>
        `;

        this.container.innerHTML = editorHTML;

        // Cache references
        this.iframe = this.container.querySelector('.file-template-iframe');
        this.codeView = this.container.querySelector('.file-template-code-view');
    }

    initIframe() {
        const iframeDoc = this.iframe.contentDocument || this.iframe.contentWindow.document;

        iframeDoc.open();
        iframeDoc.write(`
            <!DOCTYPE html>
            <html>
            <head>
                <style>
                    body {
                        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                        padding: 1rem;
                        line-height: 1.6;
                        color: #374151;
                        margin: 0;
                        min-height: 100%;
                    }
                    
                    /* Image container for proper positioning */
                    .image-container {
                        position: relative;
                        display: inline-block;
                        margin: 1rem 0;
                        max-width: 100%;
                    }
                    
                    .image-container img {
                        max-width: 100%;
                        height: auto;
                        display: block;
                        cursor: pointer;
                        transition: outline 0.2s ease;
                        margin: 0;
                    }
                    
                    .image-container:hover img {
                        outline: 1px solid #93c5fd;
                    }
                    
                    .image-container.selected img {
                        outline: 2px solid #3b82f6 !important;
                        outline-offset: 2px;
                    }
                    
                    .resize-handle {
                        position: absolute;
                        bottom: -5px;
                        right: -5px;
                        width: 12px;
                        height: 12px;
                        background: #3b82f6;
                        cursor: se-resize;
                        border-radius: 2px;
                        border: 2px solid white;
                        box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2);
                        z-index: 100;
                        opacity: 0;
                        transition: opacity 0.2s ease;
                        pointer-events: none;
                    }
                    
                    .image-container.selected .resize-handle {
                        opacity: 1;
                        pointer-events: auto;
                    }
                    
                    /* Fallback for any unwrapped images */
                    img:not(.image-container img) {
                        max-width: 100%;
                        height: auto;
                        display: block;
                        margin: 1rem 0;
                        cursor: pointer;
                        transition: outline 0.2s ease;
                    }
                    
                    ul, ol {
                        margin: 1rem 0;
                        padding-left: 2rem;
                    }
                    
                    p {
                        margin: 0.5rem 0;
                    }
                    
                    body > *:first-child {
                        margin-top: 0;
                    }
                    
                    body > *:last-child {
                        margin-bottom: 0;
                    }
                    
                    body:empty::before {
                        content: '${this.options.placeholder}';
                        color: #9ca3af;
                    }
                    
                    /* Styles for Razor placeholders */
                    .razor-placeholder {
                        display: inline-block;
                        background: #e5e7eb;
                        color: #6b7280;
                        padding: 2px 6px;
                        border-radius: 3px;
                        font-family: monospace;
                        font-size: 0.875em;
                        margin: 0 2px;
                        cursor: default;
                        user-select: none;
                        vertical-align: middle;
                    }
                </style>
            </head>
            <body contenteditable="true"></body>
            </html>
        `);
        iframeDoc.close();

        this.doc = iframeDoc;
        this.body = iframeDoc.body;

        this.doc.designMode = 'on';
    }

    parseDocumentStructure(cshtml) {
        // Reset stored document parts
        this.documentHead = '';
        this.documentAttributes = '';
        this.preBodyContent = '';
        this.postBodyContent = '';
        this.preHtmlContent = '';
        this.postHtmlContent = '';

        let content = cshtml;

        // Extract and normalize DOCTYPE
        const doctypeMatches = content.match(/<!DOCTYPE[^>]*>/gi);
        if (doctypeMatches && doctypeMatches.length > 0) {
            this.documentDoctype = doctypeMatches[0]; // Use first DOCTYPE
            // Remove all DOCTYPEs from content
            content = content.replace(/<!DOCTYPE[^>]*>\s*/gi, '');
        } else {
            this.documentDoctype = '<!DOCTYPE html>'; // Default if none found
        }

        // Extract content before HTML tag
        const htmlTagIndex = content.search(/<html[^>]*>/i);
        if (htmlTagIndex > 0) {
            this.preHtmlContent = content.substring(0, htmlTagIndex).trim();
            content = content.substring(htmlTagIndex);
        }

        // Extract content after HTML closing tag
        const htmlCloseIndex = content.lastIndexOf('</html>');
        if (htmlCloseIndex > -1 && htmlCloseIndex + 7 < content.length) {
            this.postHtmlContent = content.substring(htmlCloseIndex + 7).trim();
            content = content.substring(0, htmlCloseIndex + 7);
        }

        // Extract html tag with attributes
        const htmlMatch = content.match(/<html([^>]*)>/i);
        this.documentAttributes = htmlMatch ? htmlMatch[1] : '';

        // Extract head content
        const headMatch = content.match(/<head[^>]*>([\s\S]*?)<\/head>/i);
        if (headMatch) {
            this.documentHead = headMatch[1];
        }

        // Extract content between head and body
        const headEndIndex = content.search(/<\/head>/i);
        const bodyStartIndex = content.search(/<body[^>]*>/i);
        if (headEndIndex > -1 && bodyStartIndex > -1 && bodyStartIndex > headEndIndex) {
            const betweenHeadAndBody = content.substring(headEndIndex + 7, bodyStartIndex).trim();
            if (betweenHeadAndBody) {
                this.preBodyContent = betweenHeadAndBody;
            }
        }

        // Extract content between body end and html end
        const bodyEndIndex = content.search(/<\/body>/i);
        const htmlEndIndex = content.search(/<\/html>/i);
        if (bodyEndIndex > -1 && htmlEndIndex > -1 && htmlEndIndex > bodyEndIndex) {
            const betweenBodyAndHtml = content.substring(bodyEndIndex + 7, htmlEndIndex).trim();
            if (betweenBodyAndHtml) {
                this.postBodyContent = betweenBodyAndHtml;
            }
        }

        // Extract body content
        let bodyContent = '';
        const bodyMatch = content.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
        if (bodyMatch) {
            bodyContent = bodyMatch[1];
        } else {
            const htmlInnerMatch = content.match(/<html[^>]*>([\s\S]*)<\/html>/i);
            if (htmlInnerMatch) {
                let innerContent = htmlInnerMatch[1];
                if (headMatch) {
                    innerContent = innerContent.replace(/<head[^>]*>[\s\S]*?<\/head>/i, '');
                }
                bodyContent = innerContent.trim();
            } else {
                bodyContent = content;
            }
        }

        return {
            bodyContent: bodyContent.trim()
        };
    }

    processRazorForPreview(cshtml) {
        // Clear previous razor blocks for fresh processing
        this.razorBlocks.clear();
        this.razorBlockCounter = 0;

        // Parse document structure and extract body content
        const { bodyContent } = this.parseDocumentStructure(cshtml);

        // Extract and inject styles
        if (this.documentHead) {
            this.injectStylesIntoIframe(this.documentHead);
        }

        let processed = bodyContent;

        // Only process if content is not already processed
        if (!processed.includes('razor-placeholder') && !processed.includes('<!-- razor-')) {
            // Wrap Razor comments first
            processed = processed.replace(/@\*[\s\S]*?\*@/g, (match) => {
                // Check if already wrapped
                const startIndex = processed.indexOf(match);
                if (processed.substring(Math.max(0, startIndex - 50), startIndex).match(/<!-- razor-comment-/)) {
                    return match;
                }
                const id = `razor-comment-${this.razorBlockCounter++}`;
                this.razorBlocks.set(id, match);
                return `<!-- ${id} -->`;
            });

            // Wrap block-level Razor directives
            processed = processed.replace(/@model\s+[^\r\n]+/g, (match) => {
                if (processed.substring(Math.max(0, processed.indexOf(match) - 50), processed.indexOf(match)).match(/<!-- razor-/)) {
                    return match;
                }
                return `<!-- ${match} -->`;
            });
            processed = processed.replace(/@using\s+[^;\r\n]+;?/g, (match) => {
                if (processed.substring(Math.max(0, processed.indexOf(match) - 50), processed.indexOf(match)).match(/<!-- razor-/)) {
                    return match;
                }
                return `<!-- ${match} -->`;
            });
            processed = processed.replace(/@page\s+[^\r\n]*/g, (match) => {
                if (processed.substring(Math.max(0, processed.indexOf(match) - 50), processed.indexOf(match)).match(/<!-- razor-/)) {
                    return match;
                }
                return `<!-- ${match} -->`;
            });
            processed = processed.replace(/@addTagHelper\s+[^\r\n]*/g, (match) => {
                if (processed.substring(Math.max(0, processed.indexOf(match) - 50), processed.indexOf(match)).match(/<!-- razor-/)) {
                    return match;
                }
                return `<!-- ${match} -->`;
            });
            processed = processed.replace(/@inject\s+[^\r\n]+/g, (match) => {
                if (processed.substring(Math.max(0, processed.indexOf(match) - 50), processed.indexOf(match)).match(/<!-- razor-/)) {
                    return match;
                }
                return `<!-- ${match} -->`;
            });

            // Wrap code blocks
            processed = this.wrapCodeBlocksInComments(processed);

            // Wrap control structures (recursive for nested structures)
            processed = this.wrapControlStructuresInComments(processed, 'foreach');
            processed = this.wrapControlStructuresInComments(processed, 'if');
            processed = this.wrapControlStructuresInComments(processed, 'for');
            processed = this.wrapControlStructuresInComments(processed, 'while');
            processed = this.wrapControlStructuresInComments(processed, 'switch');
            processed = this.wrapSectionBlocksInComments(processed);

            // Process inline Razor expressions
            processed = this.processInlineRazorExpressions(processed);
        }

        return processed.trim();
    }

    wrapCodeBlocksInComments(content) {
        let processed = content;
        let codeBlockRegex = /@{/g;
        let match;

        while ((match = codeBlockRegex.exec(processed)) !== null) {
            const openBraceIndex = match.index + 1;
            const closeBraceIndex = this.findMatchingBrace(processed, openBraceIndex);

            if (closeBraceIndex !== -1) {
                const fullMatch = processed.substring(match.index, closeBraceIndex + 1);

                // Only wrap if not already wrapped
                if (!processed.substring(Math.max(0, match.index - 50), match.index).match(/<!-- razor-block-/)) {
                    const id = `razor-block-${this.razorBlockCounter++}`;
                    this.razorBlocks.set(id, fullMatch);
                    const wrappedBlock = `<!-- ${id} -->`;
                    processed = processed.substring(0, match.index) + wrappedBlock + processed.substring(closeBraceIndex + 1);
                    codeBlockRegex.lastIndex = match.index + wrappedBlock.length;
                }
            }
        }

        return processed;
    }

    wrapControlStructuresInComments(content, blockType) {
        const patterns = {
            'foreach': /@foreach\s*\(/,
            'if': /@if\s*\(/,
            'for': /@for\s*\(/,
            'while': /@while\s*\(/,
            'switch': /@switch\s*\(/
        };

        const pattern = patterns[blockType];
        if (!pattern) return content;

        let processed = content;
        let searchIndex = 0;

        while (true) {
            const match = processed.substring(searchIndex).match(pattern);
            if (!match) break;

            const matchIndex = searchIndex + match.index;

            // Check if already wrapped
            if (processed.substring(Math.max(0, matchIndex - 50), matchIndex).match(/<!-- razor-control-/)) {
                searchIndex = matchIndex + 1;
                continue;
            }

            const statementResult = this.findCompleteRazorStatement(processed, matchIndex);
            if (!statementResult) {
                searchIndex = matchIndex + 1;
                continue;
            }

            const { endIndex: statementEndIndex } = statementResult;

            // Find opening brace
            let braceIndex = -1;
            let searchStart = statementEndIndex;
            while (searchStart < processed.length) {
                const char = processed[searchStart];
                if (char === '{') {
                    braceIndex = searchStart;
                    break;
                } else if (!/[\s\r\n]/.test(char)) {
                    break;
                }
                searchStart++;
            }

            if (braceIndex === -1) {
                searchIndex = matchIndex + 1;
                continue;
            }

            const closeBraceIndex = this.findMatchingBrace(processed, braceIndex);
            if (closeBraceIndex === -1) {
                searchIndex = matchIndex + 1;
                continue;
            }

            // Extract the opening statement and inner content
            const statement = processed.substring(matchIndex, braceIndex + 1);
            const innerContent = processed.substring(braceIndex + 1, closeBraceIndex);
            const closingBrace = '}';
            const processedInner = this.processInnerContent(innerContent);

            // Store opening statement and closing brace
            const id = `razor-control-${this.razorBlockCounter++}`;
            this.razorBlocks.set(`${id}-start`, statement);
            this.razorBlocks.set(`${id}-end`, closingBrace);

            // Wrap the block, preserving inner content
            const wrappedBlock = `<!-- ${id}-start -->${processedInner}<!-- ${id}-end -->`;

            processed = processed.substring(0, matchIndex) + wrappedBlock + processed.substring(closeBraceIndex + 1);
            searchIndex = matchIndex + wrappedBlock.length;
        }

        return processed;
    }

    processInnerContent(content) {
        let processed = content;

        // Skip already-wrapped Razor comments
        if (processed.match(/<!-- razor-comment-/)) {
            return processed;
        }

        // Process nested @{ ... } blocks
        processed = this.wrapCodeBlocksInComments(processed);

        // Process nested control structures
        processed = this.wrapControlStructuresInComments(processed, 'foreach');
        processed = this.wrapControlStructuresInComments(processed, 'if');
        processed = this.wrapControlStructuresInComments(processed, 'for');
        processed = this.wrapControlStructuresInComments(processed, 'while');
        processed = this.wrapControlStructuresInComments(processed, 'switch');

        return processed;
    }

    wrapSectionBlocksInComments(content) {
        let processed = content;
        let sectionRegex = /@section\s+(\w+)\s*\{/g;
        let match;

        while ((match = sectionRegex.exec(processed)) !== null) {
            // Check if already wrapped
            if (processed.substring(Math.max(0, match.index - 50), match.index).match(/<!-- razor-section-/)) {
                continue;
            }

            const openBraceIndex = match.index + match[0].length - 1;
            const closeBraceIndex = this.findMatchingBrace(processed, openBraceIndex);

            if (closeBraceIndex !== -1) {
                const statement = processed.substring(match.index, openBraceIndex + 1);
                const innerContent = processed.substring(openBraceIndex + 1, closeBraceIndex);
                const closingBrace = '}';
                const processedInner = this.processInnerContent(innerContent);

                const id = `razor-section-${this.razorBlockCounter++}`;
                this.razorBlocks.set(`${id}-start`, statement);
                this.razorBlocks.set(`${id}-end`, closingBrace);

                const wrappedBlock = `<!-- ${id}-start -->${processedInner}<!-- ${id}-end -->`;
                processed = processed.substring(0, match.index) + wrappedBlock + processed.substring(closeBraceIndex + 1);
                sectionRegex.lastIndex = match.index + wrappedBlock.length;
            }
        }

        return processed;
    }

    processInlineRazorExpressions(content) {
        let processed = content;

        const controlKeywords = ['foreach', 'if', 'for', 'while', 'switch', 'section', 'model', 'using', 'page', 'addTagHelper', 'inject'];

        // Process @(...) expressions
        processed = processed.replace(/@\([^)]+\)/g, (match, offset) => {
            if (!this.isInsideHtmlTag(processed, offset) && !this.isAlreadyPlaceholder(processed, offset)) {
                const id = `razor-expr-${this.razorBlockCounter++}`;
                this.razorBlocks.set(id, match);
                return `<span class="razor-placeholder" data-razor-id="${id}" contenteditable="false">${match}</span>`;
            }
            return match;
        });

        // Process @Model expressions
        processed = processed.replace(/@(Model(?:\.\w+)*(?:\[\w+\])*(?:\([^)]*\))*)/g, (match, variable, offset) => {
            if (!this.isInsideHtmlTag(processed, offset) && !this.isAlreadyPlaceholder(processed, offset)) {
                const id = `razor-model-${this.razorBlockCounter++}`;
                this.razorBlocks.set(id, match);
                return `<span class="razor-placeholder" data-razor-id="${id}" contenteditable="false">${match}</span>`;
            }
            return match;
        });

        // Process @ViewBag and @ViewData
        processed = processed.replace(/@(ViewBag(?:\.\w+)*|ViewData\[\"[^\"]*\"\])/g, (match, variable, offset) => {
            if (!this.isInsideHtmlTag(processed, offset) && !this.isAlreadyPlaceholder(processed, offset)) {
                const id = `razor-viewdata-${this.razorBlockCounter++}`;
                this.razorBlocks.set(id, match);
                return `<span class="razor-placeholder" data-razor-id="${id}" contenteditable="false">${match}</span>`;
            }
            return match;
        });

        // Process @Html expressions
        processed = processed.replace(/@Html\.\w+(?:\([^)]*\))?/g, (match, offset) => {
            if (!this.isInsideHtmlTag(processed, offset) && !this.isAlreadyPlaceholder(processed, offset)) {
                const id = `razor-html-${this.razorBlockCounter++}`;
                this.razorBlocks.set(id, match);
                return `<span class="razor-placeholder" data-razor-id="${id}" contenteditable="false">${match}</span>`;
            }
            return match;
        });

        // Process other @variable expressions
        processed = processed.replace(/@(\w+(?:\.\w+)*(?:\[\w+\])*(?:\([^)]*\))*)/g, (match, variable, offset) => {
            if (this.isInsideHtmlTag(processed, offset) || this.isAlreadyPlaceholder(processed, offset)) return match;

            const firstWord = variable.split('.')[0].split('(')[0].split('[')[0];
            if (controlKeywords.includes(firstWord.toLowerCase())) return match;

            const id = `razor-var-${this.razorBlockCounter++}`;
            this.razorBlocks.set(id, match);
            return `<span class="razor-placeholder" data-razor-id="${id}" contenteditable="false">${match}</span>`;
        });

        return processed;
    }

    isAlreadyPlaceholder(content, offset) {
        // Check if we're inside a razor-placeholder span
        const beforeOffset = content.substring(Math.max(0, offset - 100), offset);
        const afterOffset = content.substring(offset, Math.min(content.length, offset + 100));

        return beforeOffset.includes('class="razor-placeholder"') && afterOffset.includes('</span>');
    }

    reconstructFullDocument(content) {
        let fullDocument = '';

        // Add pre-HTML content (remove any DOCTYPEs)
        if (this.preHtmlContent) {
            const cleanPreHtml = this.preHtmlContent.replace(/<!DOCTYPE[^>]*>\s*/gi, '');
            if (cleanPreHtml.trim()) {
                fullDocument += cleanPreHtml + '\n';
            }
        }

        // Add single DOCTYPE
        fullDocument += this.documentDoctype + '\n';
        fullDocument += `<html${this.documentAttributes}>`;

        // Add head if present
        if (this.documentHead) {
            fullDocument += '\n<head>\n' + this.documentHead + '\n</head>';
        }

        // Add pre-body content
        if (this.preBodyContent) {
            fullDocument += '\n' + this.preBodyContent;
        }

        // Add body content
        fullDocument += '\n<body>\n' + content + '\n</body>';

        // Add post-body content
        if (this.postBodyContent) {
            fullDocument += '\n' + this.postBodyContent;
        }

        fullDocument += '\n</html>';

        // Add post-HTML content
        if (this.postHtmlContent) {
            fullDocument += '\n' + this.postHtmlContent;
        }

        return fullDocument;
    }

    convertToCodeView() {
        const currentContent = this.body.innerHTML;
        // Store untruncated content first
        let fullContent = this.restoreInlineRazorExpressions(currentContent);
        fullContent = this.uncommentRazorBlocks(fullContent);
        this.originalCshtml = this.reconstructFullDocument(fullContent);

        // Create truncated version for display
        let displayContent = fullContent;
        // Truncate base64 image sources for display
        const regex = /(<img[^>]+src="data:image\/[^;]+;base64,)([^"]+)("[^>]*>)/gi;
        displayContent = displayContent.replace(regex, (match, prefix, base64Data, suffix) => {
            const preview = base64Data.slice(0, 30) + '...';
            return `${prefix}${preview}${suffix}`;
        });

        // Reconstruct display document
        let fullDisplayDocument = this.reconstructFullDocument(displayContent);

        return fullDisplayDocument;
    }

    convertToFullDocument() {
        const currentContent = this.body.innerHTML;
        let codeContent = this.restoreInlineRazorExpressions(currentContent);
        codeContent = this.uncommentRazorBlocks(codeContent);

        return this.reconstructFullDocument(codeContent);
    }

    restoreInlineRazorExpressions(html) {
        let restored = html;

        // Handle span placeholders using regex first
        restored = restored.replace(/<span class="razor-placeholder"[^>]+data-razor-id="([^"]+)"[^>]*>.*?<\/span>/g,
            (match, id) => {
                return this.razorBlocks.get(id) || match;
            }
        );

        // Handle any remaining placeholders using DOM
        const tempDiv = this.doc.createElement('div');
        tempDiv.innerHTML = restored;

        const placeholders = tempDiv.querySelectorAll('[data-razor-id]');
        placeholders.forEach(placeholder => {
            const id = placeholder.getAttribute('data-razor-id');
            const razorContent = this.razorBlocks.get(id);
            if (razorContent) {
                const textNode = this.doc.createTextNode(razorContent);
                placeholder.parentNode.replaceChild(textNode, placeholder);
            }
        });

        restored = tempDiv.innerHTML;

        // Clean up contenteditable attributes
        restored = restored.replace(/\s*contenteditable="[^"]*"/g, '');

        return restored;
    }

    uncommentRazorBlocks(html) {
        let uncommented = html;

        // Restore all stored Razor blocks by ID
        this.razorBlocks.forEach((value, id) => {
            uncommented = uncommented.replace(`<!-- ${id} -->`, value);
        });

        // Uncomment simple Razor directives
        uncommented = uncommented.replace(/<!-- (@(?:model|using|page|addTagHelper|inject)[^>]*?) -->/g, '$1');

        // Clean up empty comments
        uncommented = uncommented.replace(/<!--\s*-->\n?/g, '');

        return uncommented;
    }

    findMatchingBrace(text, startIndex) {
        let braceCount = 1;
        let index = startIndex + 1;
        let inString = false;
        let stringChar = '';
        let inComment = false;

        while (index < text.length && braceCount > 0) {
            const char = text[index];
            const prevChar = index > 0 ? text[index - 1] : '';

            if (!inString && !inComment) {
                if (char === '"' || char === "'") {
                    inString = true;
                    stringChar = char;
                } else if (char === '/' && prevChar === '/' && index > 1 && text[index - 2] !== ':') {
                    inComment = true; // Start of single-line comment
                } else if (char === '*' && prevChar === '/' && index > 1 && text[index - 2] !== ':') {
                    inComment = true; // Start of multi-line comment
                } else if (char === '{') {
                    braceCount++;
                } else if (char === '}') {
                    braceCount--;
                }
            } else if (inString) {
                if (char === stringChar && prevChar !== '\\') {
                    inString = false;
                    stringChar = '';
                }
            } else if (inComment) {
                if (prevChar === '*' && char === '/' && index > 1 && text[index - 2] !== ':') {
                    inComment = false; // End of multi-line comment
                } else if (char === '\n' && prevChar !== '\\') {
                    inComment = false; // End of single-line comment
                }
            }

            index++;
        }

        return braceCount === 0 ? index - 1 : -1;
    }

    findCompleteRazorStatement(content, startIndex) {
        let parenCount = 0;
        let index = startIndex;
        let foundOpenParen = false;

        while (index < content.length) {
            if (content[index] === '(') {
                foundOpenParen = true;
                parenCount = 1;
                index++;
                break;
            }
            index++;
        }

        if (!foundOpenParen) return null;

        let inString = false;
        let stringChar = '';

        while (index < content.length && parenCount > 0) {
            const char = content[index];

            if (!inString) {
                if (char === '"' || char === "'") {
                    inString = true;
                    stringChar = char;
                } else if (char === '(') {
                    parenCount++;
                } else if (char === ')') {
                    parenCount--;
                }
            } else {
                if (char === stringChar && content[index - 1] !== '\\') {
                    inString = false;
                    stringChar = '';
                }
            }

            index++;
        }

        if (parenCount === 0) {
            return {
                endIndex: index,
                statement: content.substring(startIndex, index)
            };
        }

        return null;
    }

    isInsideHtmlTag(fullText, matchIndex) {
        let lastOpenTag = fullText.lastIndexOf('<', matchIndex);
        let lastCloseTag = fullText.lastIndexOf('>', matchIndex);
        return lastOpenTag > lastCloseTag;
    }

    injectStylesIntoIframe(headContent) {
        if (!this.doc || !headContent) return;

        // Remove any existing injected styles
        const existingStyles = this.doc.head.querySelectorAll('style[data-template-style], link[data-template-style]');
        existingStyles.forEach(element => element.remove());

        // Extract and inject style tags
        const styleMatches = headContent.match(/<style[^>]*>[\s\S]*?<\/style>/gi);

        if (styleMatches) {
            styleMatches.forEach(styleTag => {
                const styleElement = this.doc.createElement('style');
                styleElement.setAttribute('data-template-style', 'true');

                // Extract content between <style> and </style>
                const content = styleTag.replace(/<style[^>]*>|<\/style>/gi, '').trim();
                styleElement.textContent = content;

                this.doc.head.appendChild(styleElement);
            });
        }

        // Extract and inject link tags (for external CSS)
        const linkMatches = headContent.match(/<link[^>]*rel=["']stylesheet["'][^>]*>/gi);
        if (linkMatches) {
            linkMatches.forEach(linkTag => {
                const linkElement = this.doc.createElement('link');
                linkElement.setAttribute('data-template-style', 'true');

                // Extract attributes
                const hrefMatch = linkTag.match(/href=["']([^"']+)["']/);
                if (hrefMatch) {
                    linkElement.href = hrefMatch[1];
                    linkElement.rel = 'stylesheet';
                    this.doc.head.appendChild(linkElement);
                }
            });
        }
    }

    setupEventListeners() {
        // Format buttons
        this.container.querySelectorAll('.file-template-format-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const command = btn.dataset.command;
                this.execCommand(command);
                this.updateButtonStates();
            });
        });

        // Font size dropdown
        const fontSizeSelect = this.container.querySelector('.file-template-font-size');
        fontSizeSelect.addEventListener('change', (e) => {
            const size = e.target.value;

            if (this.currentMode === 'preview') {
                this.applyFontSize(size);
                this.updateButtonStates();
            } else {
                this.codeView.style.fontSize = `${size}px`;
            }
        });

        // Image button and input
        const imageBtn = this.container.querySelector('.file-template-image-btn');
        const imageInput = this.container.querySelector('.file-template-image-input');

        imageBtn.addEventListener('click', () => {
            imageInput.click();
        });

        imageInput.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file && file.type.startsWith('image/')) {
                const reader = new FileReader();
                reader.onload = (e) => {
                    if (this.selectedImage) {
                        const img = this.selectedImage.querySelector('img');
                        if (img) {
                            const currentWidth = img.style.width || 'auto';
                            img.src = e.target.result;
                            img.style.width = currentWidth;
                        }
                        this.selectedImage.classList.remove('selected');
                        this.selectedImage = null;
                    } else {
                        const container = this.doc.createElement('div');
                        container.className = 'image-container';
                        container.contentEditable = false;
                        container.setAttribute('contenteditable', 'false');

                        const img = this.doc.createElement('img');
                        img.src = e.target.result;

                        const resizeHandle = this.doc.createElement('div');
                        resizeHandle.className = 'resize-handle';

                        container.appendChild(img);
                        container.appendChild(resizeHandle);

                        const selection = this.iframe.contentWindow.getSelection();
                        if (selection.rangeCount > 0) {
                            const range = selection.getRangeAt(0);
                            range.deleteContents();
                            range.insertNode(container);
                            range.setStartAfter(container);
                            range.collapse(true);
                            selection.removeAllRanges();
                            selection.addRange(range);
                        } else {
                            this.body.appendChild(container);
                        }
                    }
                    imageInput.value = '';

                    // Update originalCshtml with the new image
                    if (this.currentMode === 'preview') {
                        this.originalCshtml = this.convertToFullDocument();
                    }

                    setTimeout(() => {
                        this.setupImageHandlers();
                    }, 0);
                };
                reader.readAsDataURL(file);
            }
        });

        // Mode toggle
        this.container.querySelectorAll('.file-template-mode-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const mode = btn.dataset.mode;
                this.switchMode(mode);
            });
        });

        // Selection change
        this.iframe.contentWindow.addEventListener('selectionchange', () => {
            this.updateButtonStates();
        });

        // Code view changes
        this.codeView.addEventListener('input', () => {
            if (this.currentMode === 'code') {
                let content = this.codeView.value;
                // Restore full base64 data if truncated
                content = content.replace(
                    /(<img[^>]+src="data:image\/[^;]+;base64,)([^"]+?)(\.\.\.")([^>]*>)/gi,
                    (match, prefix, base64Data, dots, suffix) => {
                        // Find the original image source in originalCshtml
                        const originalMatch = this.originalCshtml.match(
                            new RegExp(`${prefix}([^"]+)${suffix}`)
                        );
                        return originalMatch ? `${prefix}${originalMatch[1]}${suffix}` : match;
                    }
                );
                this.originalCshtml = content;
            }
        });

        // Deselect image when clicking outside
        this.body.addEventListener('click', (e) => {
            if (this.selectedImage && !e.target.closest('.image-container')) {
                this.selectedImage.classList.remove('selected');
                this.selectedImage = null;
            }
        });

        // Prevent editing Razor placeholders
        this.body.addEventListener('keydown', (e) => {
            const selection = this.iframe.contentWindow.getSelection();
            if (selection.rangeCount > 0) {
                const range = selection.getRangeAt(0);
                const node = range.commonAncestorContainer;

                const placeholder = node.nodeType === 3 ?
                    node.parentElement.closest('.razor-placeholder') :
                    node.closest('.razor-placeholder');

                if (placeholder) {
                    e.preventDefault();

                    const newRange = this.doc.createRange();
                    newRange.setStartAfter(placeholder);
                    newRange.collapse(true);
                    selection.removeAllRanges();
                    selection.addRange(newRange);
                }
            }
        });

        this.setupImageHandlers();
    }

    setupImageHandlers() {
        // First, wrap any unwrapped images in containers
        const unwrappedImages = this.body.querySelectorAll('img:not(.image-container img)');
        unwrappedImages.forEach(img => {
            const container = this.doc.createElement('div');
            container.className = 'image-container';
            container.contentEditable = false;
            container.setAttribute('contenteditable', 'false');

            img.parentNode.insertBefore(container, img);
            container.appendChild(img);

            if (!container.querySelector('.resize-handle')) {
                const resizeHandle = this.doc.createElement('div');
                resizeHandle.className = 'resize-handle';
                container.appendChild(resizeHandle);
            }
        });

        // Ensure all image containers have resize handles
        const imageContainers = this.body.querySelectorAll('.image-container');
        imageContainers.forEach(container => {
            container.contentEditable = false;
            container.setAttribute('contenteditable', 'false');

            if (!container.querySelector('.resize-handle')) {
                const resizeHandle = this.doc.createElement('div');
                resizeHandle.className = 'resize-handle';
                container.appendChild(resizeHandle);
            }
        });

        // Remove existing event listeners to prevent duplicates
        imageContainers.forEach(container => {
            const img = container.querySelector('img');
            const resizeHandle = container.querySelector('.resize-handle');

            if (img) {
                const newImg = img.cloneNode(true);
                img.parentNode.replaceChild(newImg, img);
            }
            if (resizeHandle) {
                const newHandle = resizeHandle.cloneNode(true);
                resizeHandle.parentNode.replaceChild(newHandle, resizeHandle);
            }
        });

        // Re-query after potential replacements
        const updatedContainers = this.body.querySelectorAll('.image-container');

        // Add new event listeners
        updatedContainers.forEach(container => {
            const img = container.querySelector('img');
            const resizeHandle = container.querySelector('.resize-handle');

            if (img && resizeHandle) {
                container.contentEditable = false;
                container.setAttribute('contenteditable', 'false');

                img.addEventListener('click', (e) => this.handleImageClick(e, container));
                resizeHandle.addEventListener('mousedown', (e) => this.handleResizeStart(e, img, container));
                img.addEventListener('dragstart', (e) => e.preventDefault());
            }
        });
    }

    handleImageClick(e, container) {
        e.preventDefault();
        e.stopPropagation();

        if (this.selectedImage && this.selectedImage !== container) {
            this.selectedImage.classList.remove('selected');
        }

        this.selectedImage = this.selectedImage === container ? null : container;
        container.classList.toggle('selected', this.selectedImage === container);
    }

    handleResizeStart(e, img, container) {
        e.preventDefault();
        e.stopPropagation();

        if (this.selectedImage !== container) {
            if (this.selectedImage) {
                this.selectedImage.classList.remove('selected');
            }
            this.selectedImage = container;
            container.classList.add('selected');
        }

        const startX = e.clientX;
        const startY = e.clientY;
        const startWidth = img.getBoundingClientRect().width;
        const startHeight = img.getBoundingClientRect().height;
        const aspectRatio = img.naturalWidth / img.naturalHeight;

        container.style.transition = 'none';
        this.body.style.userSelect = 'none';
        this.body.style.pointerEvents = 'none';
        container.style.pointerEvents = 'auto';

        const onMouseMove = (moveEvent) => {
            const deltaX = moveEvent.clientX - startX;
            const deltaY = moveEvent.clientY - startY;

            const delta = Math.max(deltaX, deltaY);
            const newWidth = Math.max(50, Math.min(startWidth + delta, this.body.clientWidth - 40));
            const newHeight = newWidth / aspectRatio;

            img.style.width = `${newWidth}px`;
            img.style.height = `${newHeight}px`;
            container.style.width = `${newWidth}px`;
        };

        const onMouseUp = () => {
            container.style.transition = '';
            this.body.style.userSelect = '';
            this.body.style.pointerEvents = '';
            container.style.pointerEvents = '';

            this.iframe.contentWindow.removeEventListener('mousemove', onMouseMove);
            this.iframe.contentWindow.removeEventListener('mouseup', onMouseUp);
            document.removeEventListener('mousemove', onMouseMove);
            document.removeEventListener('mouseup', onMouseUp);
        };

        this.iframe.contentWindow.addEventListener('mousemove', onMouseMove);
        this.iframe.contentWindow.addEventListener('mouseup', onMouseUp);
        document.addEventListener('mousemove', onMouseMove);
        document.addEventListener('mouseup', onMouseUp);
    }

    setupKeyboardShortcuts() {
        this.iframe.contentWindow.addEventListener('keydown', (e) => {
            if (e.ctrlKey || e.metaKey) {
                switch (e.key.toLowerCase()) {
                    case 'b':
                        e.preventDefault();
                        this.execCommand('bold');
                        break;
                    case 'i':
                        e.preventDefault();
                        this.execCommand('italic');
                        break;
                    case 'u':
                        e.preventDefault();
                        this.execCommand('underline');
                        break;
                }

                if (e.shiftKey) {
                    switch (e.key.toLowerCase()) {
                        case 'l':
                            e.preventDefault();
                            this.execCommand('justifyLeft');
                            break;
                        case 'e':
                            e.preventDefault();
                            this.execCommand('justifyCenter');
                            break;
                        case 'r':
                            e.preventDefault();
                            this.execCommand('justifyRight');
                            break;
                        case 'j':
                            e.preventDefault();
                            this.execCommand('justifyFull');
                            break;
                    }
                }

                this.updateButtonStates();
            }
        });
    }

    execCommand(command, value = null) {
        this.iframe.contentWindow.focus();
        this.doc.execCommand(command, false, value);
        this.setupImageHandlers();
    }

    applyFontSize(size) {
        this.iframe.contentWindow.focus();
        const selection = this.iframe.contentWindow.getSelection();

        if (!selection.rangeCount || selection.isCollapsed) {
            return;
        }

        const range = selection.getRangeAt(0);
        const span = this.doc.createElement('span');
        span.style.fontSize = `${size}px`;

        try {
            range.surroundContents(span);
        } catch (e) {
            const fragment = range.extractContents();
            const nodes = fragment.childNodes;

            nodes.forEach(node => {
                if (node.nodeType === 3) {
                    const newSpan = this.doc.createElement('span');
                    newSpan.style.fontSize = `${size}px`;
                    newSpan.appendChild(node.cloneNode(true));
                    fragment.replaceChild(newSpan, node);
                } else if (node.nodeType === 1 && node.tagName === 'SPAN' && node.style.fontSize) {
                    node.style.fontSize = `${size}px`;
                }
            });

            range.insertNode(fragment);
        }

        const spans = this.body.querySelectorAll('span');
        spans.forEach(span => {
            if (span.parentNode.tagName === 'SPAN' && span.style.fontSize && span.parentNode.style.fontSize) {
                span.parentNode.style.fontSize = span.style.fontSize;
                while (span.firstChild) {
                    span.parentNode.insertBefore(span.firstChild, span);
                }
                span.remove();
            }
        });

        this.body.normalize();
        selection.removeAllRanges();
        selection.addRange(range);
    }

    updateButtonStates() {
        const commands = ['bold', 'italic', 'underline', 'insertUnorderedList', 'insertOrderedList',
            'justifyLeft', 'justifyCenter', 'justifyRight', 'justifyFull'];

        commands.forEach(command => {
            const btn = this.container.querySelector(`[data-command="${command}"]`);
            if (btn) {
                const isActive = this.doc.queryCommandState(command);
                btn.classList.toggle('active', isActive);
            }
        });

        const fontSizeSelect = this.container.querySelector('.file-template-font-size');

        if (this.currentMode === 'code') {
            const currentSize = parseInt(this.codeView.style.fontSize) || 14;
            fontSizeSelect.value = currentSize.toString();
        } else {
            const selection = this.iframe.contentWindow.getSelection();
            let currentSize = '12';
            if (selection.rangeCount && !selection.isCollapsed) {
                const range = selection.getRangeAt(0);
                let node = range.commonAncestorContainer;
                if (node.nodeType === 3) node = node.parentNode;
                const computedStyle = this.iframe.contentWindow.getComputedStyle(node);
                currentSize = computedStyle.fontSize.replace('px', '');
                if (!fontSizeSelect.querySelector(`option[value="${currentSize}"]`)) {
                    currentSize = '12';
                }
            }
            fontSizeSelect.value = currentSize;
        }
    }

    switchMode(mode) {
        this.currentMode = mode;

        this.container.querySelectorAll('.file-template-mode-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.mode === mode);
        });

        if (mode === 'code') {
            // Convert from preview and store full content
            const fullContent = this.convertToFullDocument();
            this.originalCshtml = fullContent;
            // Get display version with truncated base64
            const truncatedContent = this.convertToCodeView();
            this.iframe.style.display = 'none';
            this.codeView.style.display = 'block';
            this.codeView.value = this.formatCshtml(truncatedContent);

            if (this.selectedImage) {
                this.selectedImage.classList.remove('selected');
                this.selectedImage = null;
            }
        } else {
            // Switching to preview mode
            let codeContent = this.originalCshtml;
            if (this.currentMode === 'code') {
                // Update originalCshtml with user input
                codeContent = this.codeView.value;
                // Restore full base64 data if truncated
                codeContent = codeContent.replace(
                    /(<img[^>]+src="data:image\/[^;]+;base64,)([^"]+?)(\.\.\.")([^>]*>)/gi,
                    (match, prefix, base64Data, dots, suffix) => {
                        // Find the original image source in originalCshtml
                        const originalMatch = this.originalCshtml.match(
                            new RegExp(`${prefix}([^"]+)${suffix}`)
                        );
                        return originalMatch ? `${prefix}${originalMatch[1]}${suffix}` : match;
                    }
                );
                // Normalize DOCTYPE in code view input
                const doctypeMatches = codeContent.match(/<!DOCTYPE[^>]*>/gi);
                if (doctypeMatches && codeContent.length > 0) {
                    this.documentDoctype = doctypeMatches[0];
                    codeContent = codeContent.replace(/<!DOCTYPE[^>]*>\s*/gi, '');
                    codeContent = this.documentDoctype + '\n' + codeContent;
                }
                this.originalCshtml = codeContent;
            }

            const processedDoc = this.processRazorForPreview(this.originalCshtml || '');
            this.iframe.style.display = 'block';
            this.codeView.style.display = 'none';
            this.body.innerHTML = processedDoc;

            setTimeout(() => {
                this.setupImageHandlers();
                this.updateButtonStates();
            }, 0);
        }
    }

    formatCshtml(cshtml) {
        let formatted = cshtml;

        const razorBlocks = [];
        let blockIndex = 0;

        // Preserve Razor blocks during formatting
        formatted = formatted.replace(/@{[\s\S]*?}/g, (match) => {
            razorBlocks.push(match);
            return `__RAZOR_BLOCK_${blockIndex++}__`;
        });

        // Format HTML structure
        formatted = formatted
            .replace(/></g, '>\n<')
            .replace(/(<img[^>]*>)/g, '\n$1\n')
            .replace(/(<div class="image-container"[^>]*>)/g, '\n$1')
            .replace(/(<\/div>)/g, '$1\n')
            .replace(/(<\/?(ul|ol|li|div|p|h[1-6])[^>]*>)/g, '\n$1')
            .replace(/\n\s*\n/g, '\n');

        const lines = formatted.split('\n');
        let indentLevel = 0;
        const indentSize = 2;

        formatted = lines.map(line => {
            line = line.trim();
            if (!line) return '';

            if (line.startsWith('@') && !line.includes('__RAZOR_BLOCK_')) {
                return line;
            }

            if (line.startsWith('</')) {
                indentLevel = Math.max(0, indentLevel - 1);
            }

            const indented = ' '.repeat(indentLevel * indentSize) + line;

            if (line.startsWith('<') && !line.startsWith('</') && !line.endsWith('/>') &&
                !line.includes('img') && !line.includes('resize-handle')) {
                indentLevel++;
            }

            return indented;
        }).join('\n').trim();

        // Restore Razor blocks
        razorBlocks.forEach((block, index) => {
            formatted = formatted.replace(`__RAZOR_BLOCK_${index}__`, block);
        });

        return formatted;
    }

    loadCshtml(cshtml) {
        // Normalize DOCTYPE in input
        const doctypeMatches = cshtml.match(/<!DOCTYPE[^>]*>/gi);
        if (doctypeMatches && doctypeMatches.length > 0) {
            this.documentDoctype = doctypeMatches[0];
            cshtml = cshtml.replace(/<!DOCTYPE[^>]*>\s*/gi, '');
            cshtml = this.documentDoctype + '\n' + cshtml;
        } else {
            this.documentDoctype = '<!DOCTYPE html>';
            cshtml = this.documentDoctype + '\n' + cshtml;
        }

        this.originalCshtml = cshtml;

        if (this.currentMode === 'preview') {
            const processedHtml = this.processRazorForPreview(cshtml);
            this.body.innerHTML = processedHtml;
            setTimeout(() => {
                this.setupImageHandlers();
            }, 0);
        } else {
            this.codeView.value = this.formatCshtml(cshtml);
        }
    }

    loadHTML(html) {
        this.loadCshtml(html);
    }

    getCshtml() {
        if (this.currentMode === 'code') {
            // Return the untruncated content
            return this.originalCshtml || '<!DOCTYPE html><html><head></head><body></body></html>';
        } else {
            // Convert from preview to get current state with full base64 data
            return this.convertToFullDocument();
        }
    }

    getHTML() {
        return this.getCshtml();
    }

    getFormattedCshtml() {
        return this.formatCshtml(this.getCshtml());
    }

    getFormattedHTML() {
        return this.getFormattedCshtml();
    }

    getPreviewHTML() {
        if (this.currentMode === 'preview') {
            return this.body.innerHTML;
        } else {
            return this.processRazorForPreview(this.codeView.value);
        }
    }

    clear() {
        this.body.innerHTML = '';
        this.codeView.value = '';
        this.originalCshtml = '';
        this.razorBlocks.clear();

        if (this.selectedImage) {
            this.selectedImage.classList.remove('selected');
            this.selectedImage = null;
        }

        // Clear all document structure parts
        this.documentHead = '';
        this.documentAttributes = '';
        this.preBodyContent = '';
        this.postBodyContent = '';
        this.preHtmlContent = '';
        this.postHtmlContent = '';
    }

    focus() {
        if (this.currentMode === 'preview') {
            this.iframe.contentWindow.focus();
        } else {
            this.codeView.focus();
        }
    }

    destroy() {
        this.container.innerHTML = '';
        this.razorBlocks.clear();

        if (this.selectedImage) {
            this.selectedImage.classList.remove('selected');
            this.selectedImage = null;
        }

        // Clear all document structure parts
        this.documentHead = '';
        this.documentAttributes = '';
        this.preBodyContent = '';
        this.postBodyContent = '';
        this.preHtmlContent = '';
        this.postHtmlContent = '';
    }
}