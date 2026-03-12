/**
 * ActionButtonManager
 * Manages action buttons for data tables with responsive rendering.
 * Provides a unified interface for rendering context-aware action buttons that adapt
 * between desktop (inline buttons with dropdown) and mobile (offcanvas menu) layouts.
 *
 * Features:
 * - Responsive button rendering based on viewport width
 * - State-based button visibility and configuration
 * - Permission-based access control
 * - Desktop: Inline buttons with overflow dropdown menu
 * - Mobile: Single button or offcanvas trigger for multiple actions
 * - XSS protection through HTML escaping
 * - Bootstrap 5 integration (tooltips, dropdowns, offcanvas)
 *
 * (c) 2025 Network Economic Services Ventures Philippines, Inc.
 * Date: 01/09/2026
 * All rights reserved.
 */

export class ActionButtonManager {
	/**
	 * Creates a new ActionButtonManager instance
	 * @param {Object} config - Configuration options
	 * @param {Number} config.breakpoint - Viewport width breakpoint for mobile/desktop (default: 992)
	 * @param {String} config.offcanvasSelector - jQuery selector for offcanvas element (default: "#dv-actions-offcanvas")
	 * @param {Object} config.permissionManager - Optional permission manager with hasPermission(permission) method
	 */
	constructor(config = {}) {
		// Responsive breakpoint for mobile/desktop detection (pixels)
		this.breakpoint = config.breakpoint || 992;

		// Selector for the offcanvas element used in mobile view
		this.offcanvasSelector =
			config.offcanvasSelector || "#dv-actions-offcanvas";

		// Map of button ID -> button configuration objects
		this.buttonRegistry = new Map();

		// Map of state name -> array of button IDs to show in that state
		this.stateRegistry = new Map();

		// Optional permission manager for access control
		this.permissionManager = config.permissionManager || null;

		// Tracks whether event handlers have been attached (prevents duplicate handlers)
		this._handlersAttached = false;

		// Tracks whether instance has been disposed (prevents use after cleanup)
		this._isDisposed = false;

		// Validate required dependencies (jQuery, Bootstrap)
		this._validateDependencies();

		this._initializeDefaultButtons();
	}

	/**
	 * Validates that required dependencies (jQuery and Bootstrap) are loaded
	 * Logs warnings if dependencies are missing but does not throw errors
	 * @private
	 */
	_validateDependencies() {
		if (typeof $ === "undefined") {
			console.warn(
				"ActionButtonManager: jQuery is not loaded. This component requires jQuery.",
			);
		}
		if (typeof bootstrap === "undefined") {
			console.warn(
				"ActionButtonManager: Bootstrap is not loaded. This component requires Bootstrap 5.",
			);
		}
	}

	/**
	 * Escapes HTML special characters to prevent XSS attacks
	 * Converts &, <, >, ", and ' to their HTML entity equivalents
	 * @private
	 * @param {*} unsafe - Value to escape (converted to string)
	 * @returns {String} HTML-safe escaped string
	 */
	_escapeHtml(unsafe) {
		if (unsafe === null || unsafe === undefined) return "";
		const str = String(unsafe);
		return str
			.replace(/&/g, "&amp;")
			.replace(/</g, "&lt;")
			.replace(/>/g, "&gt;")
			.replace(/"/g, "&quot;")
			.replace(/'/g, "&#039;");
	}

	/**
	 * Registers a button action with its configuration
	 * Buttons must be registered before they can be rendered
	 * @param {String} id - Unique identifier for the button
	 * @param {Object} config - Button configuration
	 * @param {String} config.label - Display label for the button
	 * @param {String} config.icon - Icon class name or SVG code
	 * @param {String} config.cssClass - Additional CSS classes for the button
	 * @param {Function} config.handler - Click handler function(context, $button)
	 * @param {Function} config.visibilityCondition - Function(context) returning boolean for visibility
	 * @param {Object|Function} config.dataAttributes - Data attributes object or function(context) returning object
	 * @param {String} config.permission - Permission key required to view this button
	 * @param {Number} config.order - Display order (lower numbers appear first)
	 * @returns {ActionButtonManager} This instance for method chaining
	 */
	registerButton(id, config) {
		this.buttonRegistry.set(id, {
			id,
			label: config.label,
			icon: config.icon || "",
			cssClass: config.cssClass || "",
			handler: config.handler,
			visibilityCondition: config.visibilityCondition || (() => true),
			dataAttributes: config.dataAttributes || {},
			permission: config.permission || null,
			order: config.order || 999,
		});
		return this;
	}

	/**
	 * Registers a state with its associated button IDs
	 * States define which buttons should be visible in different contexts
	 * @param {String} stateName - Unique state identifier (e.g., "active", "pending")
	 * @param {Array<String>} buttonIds - Array of button IDs to show in this state
	 * @returns {ActionButtonManager} This instance for method chaining
	 */
	registerState(stateName, buttonIds) {
		this.stateRegistry.set(stateName, buttonIds);
		return this;
	}

	/**
	 * Checks if the user has permission to view a button
	 * Returns true if no permission is required or no permission manager is configured
	 * @private
	 * @param {Object} button - Button configuration object
	 * @returns {Boolean} True if user has permission or permission check not applicable
	 */
	_hasPermission(button) {
		if (!button.permission || !this.permissionManager) return true;
		return this.permissionManager.hasPermission(button.permission);
	}

	/**
	 * Retrieves visible buttons for a given state and context
	 * Filters by permission and visibility conditions, then sorts by order
	 * @param {String} state - State name to get buttons for
	 * @param {Object} context - Contextual data for visibility conditions (default: {})
	 * @returns {Array<Object>} Array of visible button configurations sorted by order
	 */
	getVisibleButtons(state, context = {}) {
		const buttonIds = this.stateRegistry.get(state) || [];

		return buttonIds
			.map((id) => this.buttonRegistry.get(id))
			.filter((button) => button && this._hasPermission(button))
			.filter((button) => button.visibilityCondition(context))
			.sort((a, b) => a.order - b.order);
	}

	/**
	 * Renders buttons responsively based on current viewport width
	 * Automatically attaches event handlers on first render
	 * Desktop: Shows inline button group with optional dropdown for overflow
	 * Mobile: Shows single button directly or offcanvas trigger for multiple buttons
	 * @param {String} state - State name to determine which buttons to show
	 * @param {Object} context - Contextual data passed to buttons (default: {})
	 * @param {Object} options - Rendering options
	 * @param {Number} options.maxInline - Max buttons to show inline on desktop before dropdown (default: 3)
	 * @param {String} options.label - Label for mobile offcanvas trigger button
	 * @param {String} options.title - Title for offcanvas menu
	 * @returns {String} HTML string for the button group
	 */
	render(state, context = {}, options = {}) {
		if (this._isDisposed) {
			console.warn(
				"ActionButtonManager: Cannot render - instance has been disposed",
			);
			return "";
		}

		// Auto-attach handlers on first render
		this._ensureHandlersAttached();

		// Dynamically check viewport width for real-time responsiveness
		// This ensures correct rendering even if viewport changes between renders
		const currentViewport = window.innerWidth;
		const isMobile = currentViewport <= this.breakpoint;

		// Get all buttons that should be visible in this state with current context
		const buttons = this.getVisibleButtons(state, context);

		if (buttons.length === 0) return "";

		// Pass state through options
		const renderOptions = { ...options, state };

		return isMobile
			? this._renderMobile(buttons, context, renderOptions)
			: this._renderDesktop(buttons, context, renderOptions);
	}

	/**
	 * Renders buttons for desktop viewport as an inline button group
	 * Shows buttons inline up to maxInline, then uses a dropdown menu for overflow
	 * Strategy: If total > maxInline, show (maxInline - 1) inline + 1 dropdown
	 * @private
	 * @param {Array<Object>} buttons - Array of button configurations to render
	 * @param {Object} context - Contextual data for button data attributes
	 * @param {Object} options - Rendering options
	 * @param {Number} options.maxInline - Maximum buttons to show inline (default: 3)
	 * @returns {String} HTML string for desktop button group
	 */
	_renderDesktop(buttons, context, options) {
		const maxInline = options.maxInline || 3;

		// If total buttons exceed maxInline, show (maxInline - 1) buttons + dropdown
		// Otherwise show all buttons inline
		const shouldShowDropdown = buttons.length > maxInline;
		const inlineCount = shouldShowDropdown ? maxInline - 1 : buttons.length;

		const inlineButtons = buttons.slice(0, inlineCount);
		const dropdownButtons = buttons.slice(inlineCount);

		// Use array for efficient HTML building
		const htmlParts = ['<div class="btn-group" role="group">'];

		// Render inline buttons
		inlineButtons.forEach((button) => {
			htmlParts.push(this._createButtonHTML(button, context, "desktop"));
		});

		// Render dropdown for additional buttons
		if (dropdownButtons.length > 0) {
			htmlParts.push(this._createDropdown(dropdownButtons, context));
		}

		htmlParts.push("</div>");
		return htmlParts.join("");
	}

	/**
	 * Renders buttons for mobile viewport
	 * Single button: Rendered directly with desktop styling
	 * Multiple buttons: Rendered as offcanvas trigger that opens side menu
	 * @private
	 * @param {Array<Object>} buttons - Array of button configurations to render
	 * @param {Object} context - Contextual data for button attributes
	 * @param {Object} options - Rendering options (passed to offcanvas trigger)
	 * @returns {String} HTML string for mobile button
	 */
	_renderMobile(buttons, context, options) {
		if (buttons.length === 1) {
			// Single button - render directly with desktop style (btn btn-outline-secondary)
			return this._createButtonHTML(buttons[0], context, "desktop");
		}

		// Multiple buttons - render offcanvas trigger
		return this._createOffcanvasTrigger(buttons, context, options);
	}

	/**
	 * Renders an icon as either SVG code or CSS class name
	 * If icon starts with "<svg", treats it as raw SVG markup
	 * Otherwise, treats it as a CSS class name
	 * @private
	 * @param {String} icon - SVG code or CSS class name
	 * @returns {String} HTML string for the icon or empty string if no icon
	 */
	_renderIcon(icon) {
		if (!icon) return "";

		// Check if icon is SVG code (starts with <svg)
		const isSVG = icon.trim().toLowerCase().startsWith("<svg");

		if (isSVG) {
			// Return SVG code directly (assumes SVG is from trusted source)
			// Note: Only use trusted SVG sources to prevent XSS
			return icon;
		} else {
			// Return as CSS class (escaped to prevent XSS)
			return `<span class="${this._escapeHtml(icon)}"></span>`;
		}
	}

	/**
	 * Creates HTML markup for a single button element
	 * Applies different styling based on layout mode:
	 * - desktop: Standard button with outline styling
	 * - mobile: Dropdown item styling with full label visible
	 * - mobile-single: Single mobile button with desktop styling
	 * @private
	 * @param {Object} button - Button configuration object
	 * @param {Object} context - Contextual data for data attributes
	 * @param {String} layout - Layout mode ("desktop", "mobile", "mobile-single")
	 * @returns {String} HTML string for the button element
	 */
	_createButtonHTML(button, context, layout = "desktop") {
		const baseClass = button.cssClass ? this._escapeHtml(button.cssClass) : "";
		const cssClass =
			layout === "mobile" || layout === "mobile-single"
				? `${baseClass} dropdown-item hstack gap-4 py-4`
				: `${baseClass} btn btn-outline-secondary`;

		// Extract button-specific data attributes
		// Supports both static objects and dynamic functions that receive context
		// This ensures only registered data is included, not all context properties
		const buttonData =
			typeof button.dataAttributes === "function"
				? button.dataAttributes(context)
				: button.dataAttributes || {};

		const dataAttrs = this._buildDataAttributes(buttonData);

		const iconHTML = this._renderIcon(button.icon);

		const labelHTML = layout === "mobile" ? this._escapeHtml(button.label) : "";

		return `
            <button 
                type="button" 
                class="${cssClass}" 
                ${dataAttrs}
                data-action="${this._escapeHtml(button.id)}"
                data-toggle="tooltip"
                data-bs-placement="top"
                title="${this._escapeHtml(button.label)}"
            >
                ${iconHTML}
                ${labelHTML ? `<span>${labelHTML}</span>` : ""}
            </button>
        `;
	}

	/**
	 * Creates a dropdown menu for overflow buttons that don't fit inline
	 * Generates a three-dot menu button with dropdown items for each button
	 * @private
	 * @param {Array<Object>} buttons - Array of button configurations for dropdown
	 * @param {Object} context - Contextual data for button data attributes
	 * @returns {String} HTML string for dropdown button and menu
	 */
	_createDropdown(buttons, context) {
		const items = buttons
			.map((button) => {
				const dataAttrs = this._buildDataAttributes(
					typeof button.dataAttributes === "function"
						? button.dataAttributes(context)
						: button.dataAttributes,
				);

				const iconHTML = this._renderIcon(button.icon);

				// Include custom cssClass if provided
				const customClass = button.cssClass
					? ` ${this._escapeHtml(button.cssClass)}`
					: "";

				return `
                    <li>
                        <button type="button" 
                                class="dropdown-item hstack gap-3${customClass}" 
                                ${dataAttrs}
                                data-action="${this._escapeHtml(button.id)}">
                            ${iconHTML}${this._escapeHtml(button.label)}
                        </button>
                    </li>
                `;
			})
			.join("");

		return `
            <button 
                type="button" 
                class="btn btn-outline-secondary px-0 w-auto" 
                data-bs-toggle="dropdown" 
                data-bs-auto-close="true" 
                aria-expanded="false"
                aria-label="More actions"
            >
            	<span class="vi-solid vi-more-vertical" data-toggle="tooltip" data-bs-placement="top" title="More Actions"></span> 
            </button>
            <ul class="dropdown-menu">
                ${items}
            </ul>
        `;
	}

	/**
	 * Creates a trigger button that opens the offcanvas menu (mobile view)
	 * Button stores state and context as data attributes for later retrieval
	 * @private
	 * @param {Array<Object>} buttons - Buttons that will be shown in offcanvas (not used in trigger)
	 * @param {Object} context - Contextual data attached as data attributes
	 * @param {Object} options - Options for trigger appearance
	 * @param {String} options.label - Optional label text to show next to icon
	 * @param {String} options.title - Title for the offcanvas menu
	 * @param {String} options.state - State name to pass to offcanvas
	 * @returns {String} HTML string for offcanvas trigger button
	 */
	_createOffcanvasTrigger(buttons, context, options) {
		const label = options.label;
		const hasLabel = label !== null && label !== undefined && label !== "";
		const state = options.state || "";
		const title = options.title || "";

		return `
            <button 
                type="button" 
                class="btn btn-outline-secondary btn-open-action-offcanvas" 
                data-bs-toggle="offcanvas"
                data-bs-target="${this._escapeHtml(this.offcanvasSelector)}"
                data-offcanvas-state="${this._escapeHtml(state)}"
                data-offcanvas-title="${this._escapeHtml(title)}"
                ${this._buildDataAttributes(context)}
                aria-label="Open actions menu"
            >
                <span class="vi-solid vi-more-vertical"></span>
                ${hasLabel ? `<span>${this._escapeHtml(label)}</span>` : ""}
            </button>
        `;
	}

	/**
	 * Populates the offcanvas menu with buttons for the given state
	 * Updates both the title and body content of the offcanvas element
	 * @param {String} state - State name to determine which buttons to show
	 * @param {Object} context - Contextual data with optional title property (default: {})
	 * @returns {ActionButtonManager} This instance for method chaining
	 */
	populateOffcanvas(state, context = {}) {
		if (this._isDisposed) {
			console.warn(
				"ActionButtonManager: Cannot populate offcanvas - instance has been disposed",
			);
			return this;
		}

		// Auto-attach handlers on first populate
		this._ensureHandlersAttached();

		const offcanvas = $(this.offcanvasSelector);

		// Validate offcanvas element exists
		if (!offcanvas.length) {
			console.warn(
				`ActionButtonManager: Offcanvas element "${this.offcanvasSelector}" not found in DOM`,
			);
			return this;
		}

		const buttons = this.getVisibleButtons(state, context);

		const title = context.title || "Actions";
		const content = buttons
			.map((button) => this._createButtonHTML(button, context, "mobile"))
			.join("");

		offcanvas.find(".offcanvas-title").text(title);
		offcanvas.find(".offcanvas-body").html(content);

		return this;
	}

	/**
	 * Ensures event handlers are attached exactly once
	 * Called automatically on first render or populate operation
	 * Prevents duplicate handler attachment on subsequent operations
	 * @private
	 */
	_ensureHandlersAttached() {
		if (!this._handlersAttached) {
			this.attachHandlers();
			this._handlersAttached = true;
		}
	}

	/**
	 * Attaches delegated event handlers for button clicks and offcanvas events
	 * Uses event delegation for efficiency with dynamically rendered buttons
	 * Automatically called on first render/populate - manual calling usually not needed
	 *
	 * Handles:
	 * - Button click events (both in-page and offcanvas)
	 * - Dropdown menu closing after action
	 * - Offcanvas population from trigger button data
	 * - Offcanvas closing after action execution
	 *
	 * @param {Element} container - DOM element to attach handlers to (default: document)
	 * @returns {ActionButtonManager} This instance for method chaining
	 */
	attachHandlers(container = document) {
		// Attach delegated click handler for all buttons with data-action attribute
		// Delegation allows handling dynamically added buttons without re-attaching
		$(container).off("click.actionButtons");
		$(container).on("click.actionButtons", "[data-action]", (e) => {
			const $btn = $(e.currentTarget);
			const actionId = $btn.data("action") || $btn.attr("data-action");

			// Get the button configuration
			const button = this.buttonRegistry.get(actionId);
			if (!button) return;

			// Only intercept event if button has a registered handler
			// If no handler, event bubbles normally to allow external handlers
			if (button.handler) {
				e.preventDefault();
				e.stopPropagation();

				// Extract context data from button's data attributes
				const context = this._extractDataAttributes($btn);

				// Auto-close dropdown menu if button is inside one (desktop overflow menu)
				const $dropdown = $btn.closest(".dropdown-menu");
				if ($dropdown.length) {
					const $dropdownToggle = $dropdown.prev(".dropdown-toggle");
					if ($dropdownToggle.length && typeof bootstrap !== "undefined") {
						const dropdownInstance = bootstrap.Dropdown.getInstance(
							$dropdownToggle[0],
						);
						if (dropdownInstance) {
							dropdownInstance.hide();
						}
					}
				}

				// Execute handler with error handling
				try {
					button.handler(context, $btn);
				} catch (error) {
					console.error(
						`ActionButtonManager: Error executing handler for "${actionId}":`,
						error,
					);
				}
			}
			// If no handler, event bubbles normally to external listeners
		});

		// Separate handler for offcanvas buttons (since offcanvas is typically in body, not container)
		// This ensures buttons in the offcanvas menu work correctly
		$(this.offcanvasSelector).off("click.actionButtons");
		$(this.offcanvasSelector).on(
			"click.actionButtons",
			"[data-action]",
			(e) => {
				const $btn = $(e.currentTarget);
				const actionId = $btn.data("action") || $btn.attr("data-action");

				// Get the button configuration
				const button = this.buttonRegistry.get(actionId);
				if (!button) return;

				// Only prevent default and stop propagation if this button has a handler
				// Otherwise, let the event bubble to external handlers
				if (button.handler) {
					e.preventDefault();
					e.stopPropagation();

					const context = this._extractDataAttributes($btn);

					// Auto-close offcanvas after action execution for better UX
					const $offcanvas = $(this.offcanvasSelector);
					if ($offcanvas.length && typeof bootstrap !== "undefined") {
						const offcanvasElement = $offcanvas[0];
						const offcanvasInstance =
							bootstrap.Offcanvas.getOrCreateInstance(offcanvasElement);
						if (offcanvasInstance) {
							offcanvasInstance.hide();
						}
					}

					// Execute handler with error handling
					try {
						button.handler(context, $btn);
					} catch (error) {
						console.error(
							`ActionButtonManager: Error executing handler for "${actionId}":`,
							error,
						);
					}
				} else {
					// No handler defined - close offcanvas and let event bubble to external handlers
					const $offcanvas = $(this.offcanvasSelector);
					if ($offcanvas.length && typeof bootstrap !== "undefined") {
						const offcanvasElement = $offcanvas[0];
						const offcanvasInstance =
							bootstrap.Offcanvas.getOrCreateInstance(offcanvasElement);
						if (offcanvasInstance) {
							offcanvasInstance.hide();
						}
					}
				}
			},
		);

		// Listen to Bootstrap's show event to populate offcanvas with correct buttons
		// Bootstrap 5 provides e.relatedTarget (the trigger button) automatically
		// This approach is cleaner than separate click handlers
		$(this.offcanvasSelector).off("show.bs.offcanvas");
		$(this.offcanvasSelector).on("show.bs.offcanvas", (e) => {
			const triggerButton = $(e.relatedTarget);
			if (triggerButton.length) {
				const state =
					triggerButton.data("offcanvasState") ||
					triggerButton.attr("data-offcanvas-state");
				const title =
					triggerButton.data("offcanvasTitle") ||
					triggerButton.attr("data-offcanvas-title");
				const context = this._extractDataAttributes(triggerButton);

				if (state) {
					// Add title to context if provided
					if (title) {
						context.title = title;
					}
					this.populateOffcanvas(state, context);
				}
			}
		});

		return this;
	}

	/**
	 * Builds a data attributes string from an object for HTML insertion
	 * Converts camelCase keys to kebab-case data attributes
	 * Filters out null/undefined values and reserved keys
	 * @private
	 * @param {Object} data - Object with key-value pairs to convert
	 * @returns {String} Space-separated data attributes string (e.g., 'data-user-id="123"')
	 */
	_buildDataAttributes(data) {
		if (!data) return "";

		// Reserved keys that should not be converted to data attributes
		// These are used internally by the manager and would cause conflicts
		// Note: "title" is allowed so it can be used for offcanvas titles
		const reservedKeys = ["state", "label", "offcanvasState"];

		return Object.entries(data)
			.filter(([key, value]) => value !== null && value !== undefined)
			.filter(([key]) => !reservedKeys.includes(key)) // Exclude reserved keys
			.map(([key, value]) => {
				const attrKey = key
					.replace(/([A-Z])/g, "-$1")
					.toLowerCase()
					.replace(/^-/, ""); // Remove leading dash
				return `data-${attrKey}="${this._escapeHtml(value)}"`;
			})
			.join(" ");
	}

	/**
	 * Extracts data attributes from a DOM element into a context object
	 * Converts data attribute values to appropriate types (string, number, boolean)
	 * Filters out reserved keys used for internal functionality
	 * Converts keys to PascalCase for consistency across the application
	 * @private
	 * @param {jQuery} $element - jQuery element to extract data from
	 * @returns {Object} Object with PascalCase keys and type-coerced values
	 */
	_extractDataAttributes($element) {
		const data = {};
		const dataset = $element.get(0)?.dataset || {};

		// Reserved keys that should not be included in extracted context
		// These are Bootstrap and internal attributes that aren't business data
		const reservedKeys = [
			"offcanvasState", // Manager internal state tracking
			"offcanvasTitle", // Manager internal title
			"bsToggle", // Bootstrap toggle attribute
			"bsTarget", // Bootstrap target attribute
			"bsPlacement", // Bootstrap placement attribute
			"toggle", // Tooltip toggle
			"placement", // Tooltip placement
			"action", // Manager action identifier
		];

		Object.entries(dataset).forEach(([key, value]) => {
			if (!reservedKeys.includes(key)) {
				// Intelligently convert string values to appropriate JavaScript types
				let typedValue = value;

				// Improved number parsing with support for negatives and decimals
				if (/^-?\d+$/.test(value)) {
					// Integer (including negative)
					typedValue = parseInt(value, 10);
				} else if (/^-?\d*\.\d+$/.test(value)) {
					// Float (including negative and .5 format)
					typedValue = parseFloat(value);
				} else if (value === "true") {
					typedValue = true;
				} else if (value === "false") {
					typedValue = false;
				}

				// Convert to PascalCase for consistency
				// All data attributes are stored with PascalCase keys
				const pascalKey = key.charAt(0).toUpperCase() + key.slice(1);
				data[pascalKey] = typedValue;
			}
		});

		return data;
	}

	/**
	 * Updates the viewport size (deprecated - no longer needed)
	 * Viewport is now checked dynamically on each render for real-time responsiveness
	 * This method is kept for backwards compatibility and does nothing
	 * @deprecated Use dynamic viewport checking instead (automatic in render())
	 * @param {Number} width - Viewport width in pixels (ignored)
	 * @returns {ActionButtonManager} This instance for method chaining
	 */
	updateViewport(width = window.innerWidth) {
		// No-op: viewport is now checked dynamically in render()
		return this;
	}

	/**
	 * Initializes Bootstrap 5 tooltips for all buttons with data-toggle="tooltip"
	 * Should be called after buttons are rendered to the DOM
	 * @param {Element} container - DOM element to search for tooltip elements (default: document)
	 * @returns {ActionButtonManager} This instance for method chaining
	 */
	initializeTooltips(container = document) {
		if (typeof bootstrap === "undefined") {
			console.warn(
				"ActionButtonManager: Bootstrap is not available for tooltip initialization",
			);
			return this;
		}

		const tooltipTriggerList = $(container).find('[data-toggle="tooltip"]');
		tooltipTriggerList.each(function () {
			try {
				new bootstrap.Tooltip(this);
			} catch (error) {
				console.error(
					"ActionButtonManager: Error initializing tooltip:",
					error,
				);
			}
		});
		return this;
	}

	/**
	 * Disposes of the manager instance and cleans up all resources
	 * Removes event handlers, clears registries, and marks instance as disposed
	 * Prevents memory leaks and ensures instance cannot be used after disposal
	 * @returns {ActionButtonManager} This instance for method chaining (though unusable after)
	 */
	dispose() {
		if (this._isDisposed) {
			return;
		}

		// Remove all delegated event handlers to prevent memory leaks
		$(document).off("click.actionButtons");
		$(this.offcanvasSelector).off("click.actionButtons");
		$(this.offcanvasSelector).off("show.bs.offcanvas");

		// Clear all button and state registrations
		this.buttonRegistry.clear();
		this.stateRegistry.clear();

		// Mark instance as disposed to prevent further use
		this._isDisposed = true;
		this._handlersAttached = false;

		return this;
	}

	/**
	 * Hook for subclasses to initialize default button configurations
	 * Override this method in specialized manager classes to register standard buttons
	 * Called automatically during constructor
	 * @private
	 */
	_initializeDefaultButtons() {
		// Override in specific implementations
	}

	/**
	 * Factory method to create ActionButtonManager instances
	 * Supports creating either base managers or specialized subclass instances
	 * @static
	 * @param {Function|Object} type - Manager class constructor or config object
	 * @param {Object} config - Configuration options (used when type is a class)
	 * @returns {ActionButtonManager} New manager instance
	 *
	 * @example
	 * // Create base manager
	 * const manager = ActionButtonManager.create({ breakpoint: 768 });
	 *
	 * // Create specialized manager
	 * const specialized = ActionButtonManager.create(MyCustomManager, { ... });
	 */
	static create(type, config) {
		if (typeof type === "function") {
			// If a class is passed, instantiate it
			return new type(config);
		}
		// Otherwise, treat as config and return base manager
		return new ActionButtonManager(type || {});
	}
}
