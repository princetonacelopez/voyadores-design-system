class Indicator {
    constructor(options = {}) {
        this.options = {
            name,
            features: [],
            ...options
        };

        this.positions = {
            'top-center': 'position: absolute; top: -12px; left: 50%; transform: translateX(-50%); margin: 0;',
            'top-right': 'position: absolute; inset: -12px -16px auto auto;',
            'top-left': 'position: absolute; inset: -12px auto auto -16px;',
            'bottom-center': 'position: absolute; bottom: -12px; left: 50%; transform: translateX(-50%); margin: 0;',
            'bottom-left': 'position: absolute; inset: auto auto -12px -16px;',
            'bottom-right': 'position: absolute; inset: auto -16px -12px auto;'
        };

        this.badgePositions = {
            'top-center': 'position: absolute; top: 3px; left: 50%; transform: translateX(-50%); margin: 0;',
            'top-right': 'position: absolute; inset: 3px 4px auto auto;',
            'top-left': 'position: absolute; inset: 3px auto auto 4px;',
            'bottom-center': 'position: absolute; bottom: 3px; left: 50%; transform: translateX(-50%); margin: 0;',
            'bottom-left': 'position: absolute; inset: auto auto 3px 4px;',
            'bottom-right': 'position: absolute; inset: auto 4px 3px auto;'
        };

        this.init();
    }

    init() {
        if (this.options.features && this.options.features.length > 0) {
            this.render(this.options.features);
        }
    }

    getPositionStyle(position) {
        return this.positions[position] || '';
    }

    createElement({ type = '', position = '', customClass = '' }) {
        if (!this.validateRequiredProperty(type, "Indicator type")) return null;
        if (!this.validateType(type)) return null;

        const indicatorPosition = type === 'badge' ? this.badgePositions[position] : this.positions[position];
        const indicatorClasses = `visual-indicator visual-indicator-${type} ${customClass}`.trim();
        const span = document.createElement('span');
        const indicatorText = type === 'badge' ? '' : type.toUpperCase();

        span.className = indicatorClasses;
        span.style.cssText = indicatorPosition;
        span.textContent = indicatorText;

        return span;
    }

    validateRequiredProperty(value, name) {
        if (!value) {
            console.warn(`Indicator: ${name} is required`);
            return false;
        }

        return true;
    }

    validateType(type) {
        const validTypes = ["new", "beta", "badge"];

        if (!validTypes.includes(type.toLowerCase())) {
            console.warn(`Indicator: Invalid type "${type}". Allowed types: ${validTypes.join(", ")}`);
            return false;
        }

        return true;
    }

    validatePosition(position) {
        return !!(position && this.positions[position]);
    }

    setRelativePosition(selector, position) {
        const hasValidPosition = this.validatePosition(position);

        if (hasValidPosition) {
            $(selector).addClass('position-relative');
        }
    }

    appendToTarget(selector, element) {
        const $elements = window.jQuery(selector);

        if ($elements.length === 0) {
            console.warn(`Indicator: Target elements not found for selector: ${selector}`);
            return false;
        }

        let appended = false;

        $elements.each((_, el) => {
            const $el = window.jQuery(el);

            if ($el.find('.visual-indicator').length > 0) {
                return;
            }

            if (this.appendToMobileMenu($el, element.cloneNode(true))) {
                appended = true;
                return;
            }

            $el.append(element.cloneNode(true));
            appended = true;
        });

        return appended;
    }

    renderElement(element) {
        if (!this.validateRequiredProperty(element.selector, "Element selector")) return false;

        const indicatorElement = this.createElement(element);

        if (indicatorElement) {
            this.setRelativePosition(element.selector, element.position);
            this.appendToTarget(element.selector, indicatorElement);
            return true;
        }

        return false;
    }

    renderFeature(feature) {
        if (!Array.isArray(feature.elements)) {
            console.warn('Indicator: Feature elements must be an array');
            return;
        }

        for (const element of feature.elements) {
            this.renderElement(element);
        }
    }

    render(features) {
        const currentUrl = this.getCurrentUrl();

        if (!Array.isArray(features)) {
            console.warn("Indicator: Features must be an array");
            return;
        }

        for (const feature of features) {
            for (const element of feature.elements || []) {

                if (element.url && element.url.replace(/\/+$/, "") !== currentUrl) {
                    continue;
                }

                this.renderElement(element);
            }
        }
    }

    appendToMobileMenu($el, element) {
        if ($el.hasClass("nav-mobile-menu-page")) {
            const $subIcon = $el.find(".nav-sub-icon");

            if ($subIcon.length) {
                $subIcon.append(element);
                return true;
            }
        }

        return false;
    }

    getCurrentUrl() {
        return window.location.pathname.replace(/\/+$/, "");
    }
}