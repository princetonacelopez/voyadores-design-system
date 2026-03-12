/**
 * Generates the dynamic body HTML content with a pre-rendered table.
 * @param {Object} payload - Contains title, content, and items.
 * @param {string} payload.title - The title of the content.
 * @param {string} payload.content - The main content text.
 * @param {string} [payload.items] - A pre-rendered HTML table string (optional).
 * @param {boolean} hasItems - Indicates whether to include the items table.
 * @returns {string} - The generated body HTML.
 */
export function generateBodyContent(payload, hasItems = false) {
    const { title, content, items } = payload;

    if ((!title && !content)) {
        throw new Error("Invalid payload: Title and content are required.");
    }

    // If `hasItems` is true but no valid `items` is provided, throw an error
    if (hasItems && (!items || typeof items !== "string" || !items.trim())) {
        throw new Error("Invalid payload: `items` must be a valid non-empty string when hasItems is true.");
    }

    if (hasItems) {
        return `<h1>${title}</h1>
                <p>${content}</p>
                <div class="table-container">
                    ${items}
                </div> `;
    }

    return `
        <h1>${title}</h1>
        <p>${content}</p>
    `;
}

/**
 * Injects dynamic content into the static template.
 * @param {string} template - The static HTML template.
 * @param {string} title - The page title.
 * @param {string} bodyContent - The dynamic body HTML content.
 * @returns {string} - The final HTML with placeholders replaced.
 */
export function injectContentIntoTemplate(template, title, bodyContent) {
    return template
        .replace("{{title}}", title) // Replace title placeholder
        .replace("{{{body}}}", bodyContent); // Replace body content placeholder
}