class TourManager {
    static STORAGE_PREFIX = 'tour:';
    static SHOWS_PREFIX = 'tourshows:';
    static LAST_SHOWN_PREFIX = 'tourlast:';

    constructor(options = {}) {
        this.defaultDriverConfig = {
            allowClose: false,
            showProgress: true,
            showButtons: ['next', 'previous'],
            overlayClickNext: false,
            animate: true,
            opacity: 0.75,
            ...options.defaultDriverConfig
        };

        this.dialogId = options.dialogId || 'dlg-feature-onboarding';
        this.skipButtonId = options.skipButtonId || 'btn-feature-onboarding-skip';
        this.startButtonId = options.startButtonId || 'btn-feature-onboarding-start';
        this.closeButtonId = options.closeButtonId || 'btn-feature-onboarding-close';

        this.currentTourDef = null;
        this.driverInstance = null;

        this.initializeDialog();
    }

    // ========== Storage Management ==========

    static storageKey(id) {
        return TourManager.STORAGE_PREFIX + id;
    }

    static showsKey(id) {
        return TourManager.SHOWS_PREFIX + id;
    }

    static lastShownKey(id) {
        return TourManager.LAST_SHOWN_PREFIX + id;
    }

    readJSON(key) {
        try {
            return JSON.parse(localStorage.getItem(key) || 'null');
        } catch (e) {
            console.warn('TourManager: Error reading JSON from localStorage:', e);
            return null;
        }
    }

    writeJSON(key, value) {
        try {
            localStorage.setItem(key, JSON.stringify(value));
        } catch (e) {
            console.warn('TourManager: Error writing JSON to localStorage:', e);
        }
    }

    markComplete(id) {
        this.writeJSON(TourManager.storageKey(id), {
            completed: true,
            completedAt: new Date().toISOString()
        });
    }

    isCompleted(id) {
        const data = this.readJSON(TourManager.storageKey(id));
        return !!(data?.completed);
    }

    getShows(id) {
        return parseInt(localStorage.getItem(TourManager.showsKey(id)) || '0', 10);
    }

    incShows(id) {
        const count = this.getShows(id) + 1;
        localStorage.setItem(TourManager.showsKey(id), String(count));
        localStorage.setItem(TourManager.lastShownKey(id), new Date().toISOString());
        return count;
    }

    // ========== Tour Definition Validation ==========

    normalizePath(path) {
        if (!path) return '';
        return path.length > 1 && path.endsWith('/') ? path.slice(0, -1) : path;
    }

    isWithinTimeWindow(tourDef) {
        if (!tourDef.releaseAt || !tourDef.ttlDays) return true;

        const releaseTime = Date.parse(tourDef.releaseAt);
        if (isNaN(releaseTime)) return true;

        const endTime = releaseTime + tourDef.ttlDays * 24 * 60 * 60 * 1000;
        return Date.now() <= endTime;
    }

    isAllowed(tourDef, context = {}) {
        // Page check
        if (tourDef.page) {
            const expectedPage = this.normalizePath(tourDef.page);
            const currentPage = this.normalizePath(location.pathname);
            if (expectedPage !== currentPage) return false;
        }

        // Feature flag check
        if (tourDef.flag) {
            const flags = context.flags || {};
            if (!flags[tourDef.flag]) return false;
        }

        // Custom validation function
        if (typeof tourDef.validate === 'function') {
            try {
                return tourDef.validate(context);
            } catch (e) {
                console.warn('TourManager: Error in custom validation:', e);
                return false;
            }
        }

        return true;
    }

    hasAllTargets(steps) {
        return steps.every(step => {
            if (!step?.element) return true; // Skip steps without elements

            const element = document.querySelector(step.element);
            if (!element) {
                return false;
            }
            return true;
        });
    }

    // ========== Driver.js Management ==========

    isDriverAvailable() {
        return !!(window.driver?.js?.driver && typeof window.driver.js.driver === 'function');
    }

    createDriverInstance(tourDef, onComplete) {
        if (!this.isDriverAvailable()) {
            console.error('TourManager: Driver.js not available');
            return null;
        }

        const config = {
            ...this.defaultDriverConfig,
            ...tourDef.driverConfig,
            steps: tourDef.steps || [],
            onHighlighted: (element, step, options) => {
                tourDef.onStepHighlighted?.(element, step, options);
            },
            onDestroyed: (element, step, options) => {
                this.driverInstance = null;
                onComplete?.();
            },
            onDeselected: (element, step, options) => {
                if (options?.isLast || options?.wasClosed) {
                    onComplete?.();
                }
            }
        };

        try {
            const driverInstance = window.driver.js.driver(config);
            return driverInstance;
        } catch (e) {
            console.error('TourManager: Error creating driver instance:', e);
            return null;
        }
    }

    // ========== Dialog Management ==========

    initializeDialog() {
        // Wait for DOM to be ready
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => this.setupDialogEvents());
        } else {
            this.setupDialogEvents();
        }
    }

    setupDialogEvents() {
        const dialog = document.getElementById(this.dialogId);
        const skipBtn = document.getElementById(this.skipButtonId);
        const startBtn = document.getElementById(this.startButtonId);
        const closeBtn = document.getElementById(this.closeButtonId);

        if (!dialog) {
            console.warn('TourManager: Feature onboarding dialog not found');
            return;
        }

        // Start tour button
        startBtn?.addEventListener('click', () => {
            dialog.close();
            this.startTour();
        });

        // Skip tour button
        skipBtn?.addEventListener('click', () => {
            dialog.close();
            this.skipTour();
        });

        // Close button
        closeBtn?.addEventListener('click', () => {
            dialog.close();
        });

        // Close on backdrop click (optional)
        dialog.addEventListener('click', (e) => {
            if (e.target === dialog) {
                dialog.close();
            }
        });
    }

    showDialog(tourDef) {
        const dialog = document.getElementById(this.dialogId);
        if (!dialog) {
            console.warn('TourManager: Dialog not found, starting tour directly');
            this.startTourDirectly(tourDef);
            return;
        }

        // Update dialog content if needed
        const body = dialog.querySelector('.feature-onboarding-dialog-body');
        if (body && tourDef.dialogContent) {
            if (typeof tourDef.dialogContent === 'string') {
                body.innerHTML = tourDef.dialogContent;
            } else if (tourDef.dialogContent instanceof HTMLElement) {
                body.innerHTML = '';
                body.appendChild(tourDef.dialogContent);
            }
        }

        this.currentTourDef = tourDef;
        dialog.showModal();
    }

    startTour() {
        if (!this.currentTourDef) {
            console.warn('TourManager: No current tour definition');
            return;
        }

        this.startTourDirectly(this.currentTourDef);
    }

    skipTour() {
        if (!this.currentTourDef) return;

        this.markComplete(this.currentTourDef.id);
        this.currentTourDef.onSkipped?.(this.currentTourDef);
        this.currentTourDef = null;
    }

    startTourDirectly(tourDef) {
        this.driverInstance = this.createDriverInstance(tourDef, () => {
            this.markComplete(tourDef.id);
            tourDef.onCompleted?.(tourDef);
        });

        if (this.driverInstance?.drive) {
            this.incShows(tourDef.id);
            this.driverInstance.drive();
            tourDef.onStarted?.(tourDef);
        } else {
            console.error('TourManager: Failed to start driver instance');
        }
    }

    // ========== Public API ==========

    /**
     * Register and potentially start a tour
     * @param {Object} tourDef - Tour definition object
     * @param {Object} context - Context object with flags, callbacks, etc.
     */
    registerTour(tourDef, context = {}) {
        // Validation
        if (!tourDef?.id || !Array.isArray(tourDef.steps)) {
            console.warn('TourManager: Invalid tour definition');
            return false;
        }

        if (!this.isDriverAvailable()) {
            return false;
        }

        // Check conditions
        if (!this.isWithinTimeWindow(tourDef)) {
            return false;
        }

        if (this.isCompleted(tourDef.id)) {
            return false;
        }

        const maxShows = tourDef.maxShows ?? 1;
        if (maxShows > 0 && this.getShows(tourDef.id) >= maxShows) {
            return false;
        }

        if (!this.isAllowed(tourDef, context)) {
            return false;
        }

        if (!this.hasAllTargets(tourDef.steps)) {
            return false;
        }

        // Show dialog or start tour directly
        if (tourDef.useDialog !== false) {
            this.showDialog(tourDef);
        } else {
            this.startTourDirectly(tourDef);
        }

        return true;
    }

    /**
     * Force start a tour (bypassing most checks)
     * @param {Object} tourDef - Tour definition
     */
    forceTour(tourDef) {
        if (!tourDef?.id || !Array.isArray(tourDef.steps)) {
            console.warn('TourManager: Invalid tour definition for force start');
            return false;
        }

        if (!this.isDriverAvailable()) {
            console.error('TourManager: Driver.js not available');
            return false;
        }

        this.startTourDirectly(tourDef);
        return true;
    }

    /**
     * Reset tour data for a specific tour ID
     * @param {string} id - Tour ID
     */
    resetTour(id) {
        localStorage.removeItem(TourManager.storageKey(id));
        localStorage.removeItem(TourManager.showsKey(id));
        localStorage.removeItem(TourManager.lastShownKey(id));
    }

    /**
     * Get debug information for a tour
     * @param {string} id - Tour ID
     */
    getDebugInfo(id) {
        return {
            completed: this.isCompleted(id),
            shows: this.getShows(id),
            driverAvailable: this.isDriverAvailable(),
            currentPath: location.pathname,
            hasActiveInstance: !!this.driverInstance
        };
    }

    /**
     * Destroy current driver instance
     */
    destroyCurrentTour() {
        if (this.driverInstance) {
            try {
                this.driverInstance.destroy();
            } catch (e) {
                console.warn('TourManager: Error destroying driver instance:', e);
            }
            this.driverInstance = null;
        }
    }
}

// Export for module systems or attach to window
if (typeof module !== 'undefined' && module.exports) {
    module.exports = TourManager;
} else if (typeof define === 'function' && define.amd) {
    define([], () => TourManager);
} else {
    window.TourManager = TourManager;
}