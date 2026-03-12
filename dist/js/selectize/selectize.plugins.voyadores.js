/**
 * Plugin: Counter Items (Enhanced with Best Fit Algorithm)
 * 
 * This enhanced plugin displays items that can fit in available space using a best-fit
 * algorithm, rather than just showing items sequentially. This maximizes the number of
 * visible items and makes better use of available space.
 * 
 * Features:
 * - Best-fit algorithm to maximize visible items
 * - Responsive design that adapts to container resizing
 * - Customizable counter text format
 * - Tooltip showing hidden item names
 * - Proper accessibility attributes
 * - Precise width calculations including margins, padding, and borders
 * - Option to prioritize recent items or use sequential order
 * 
 * Options:
 * @param {string} counterText - Format string for counter display (default: '+{count}')
 * @param {number} paddingAdjustment - Additional padding adjustment in pixels (default: 10)
 * @param {string} fitStrategy - Strategy for item selection: 'best-fit', 'sequential', 'recent-first' (default: 'best-fit')
 * @param {number} maxIterations - Maximum iterations for best-fit algorithm to prevent performance issues (default: 100)
 */
Selectize.define('counter_items', function (options) {
    var self = this;

    // Merge default settings with user options
    var settings = $.extend({
        counterText: '+{count}',      // Format: {count} will be replaced with actual number
        paddingAdjustment: 10,        // Additional spacing adjustment for better visual appearance
        fitStrategy: 'best-fit',      // 'best-fit', 'sequential', 'recent-first'
        maxIterations: 100            // Prevent infinite loops in best-fit algorithm
    }, options);

    /**
     * Best-fit algorithm to select items that maximize space utilization
     * @param {Array} itemWidths - Array of {index, width, value} objects
     * @param {number} availableWidth - Available width for items
     * @returns {Array} Array of indices of items that should be visible
     */
    function selectBestFitItems(itemWidths, availableWidth) {
        if (itemWidths.length === 0) return [];

        var bestCombination = [];
        var bestCount = 0;
        var bestWidth = 0;

        // For small numbers of items, try all combinations
        if (itemWidths.length <= 10) {
            // Generate all possible combinations using bit manipulation
            var totalCombinations = Math.pow(2, itemWidths.length);

            for (var i = 1; i < totalCombinations && i < settings.maxIterations; i++) {
                var combination = [];
                var totalWidth = 0;
                var valid = true;

                // Check each bit to see if item should be included
                for (var j = 0; j < itemWidths.length; j++) {
                    if (i & (1 << j)) {
                        totalWidth += itemWidths[j].width;
                        if (totalWidth > availableWidth) {
                            valid = false;
                            break;
                        }
                        combination.push(itemWidths[j].index);
                    }
                }

                // Update best combination if this one is better
                if (valid && (combination.length > bestCount ||
                    (combination.length === bestCount && totalWidth > bestWidth))) {
                    bestCombination = combination;
                    bestCount = combination.length;
                    bestWidth = totalWidth;
                }
            }
        } else {
            // For larger sets, use a greedy approach with optimization
            // Start with greedy selection (smallest items first)
            var sortedItems = itemWidths.slice().sort(function (a, b) {
                return a.width - b.width;
            });

            var greedyCombination = [];
            var greedyWidth = 0;

            for (var k = 0; k < sortedItems.length; k++) {
                if (greedyWidth + sortedItems[k].width <= availableWidth) {
                    greedyCombination.push(sortedItems[k].index);
                    greedyWidth += sortedItems[k].width;
                }
            }

            bestCombination = greedyCombination;
            bestCount = greedyCombination.length;
            bestWidth = greedyWidth;

            // Try to improve by swapping items
            var iterations = 0;
            var improved = true;

            while (improved && iterations < settings.maxIterations) {
                improved = false;
                iterations++;

                // Try to replace items in current combination with unused items
                var unusedItems = itemWidths.filter(function (item) {
                    return bestCombination.indexOf(item.index) === -1;
                });

                for (var m = 0; m < bestCombination.length && !improved; m++) {
                    var currentItem = itemWidths.find(function (item) {
                        return item.index === bestCombination[m];
                    });

                    for (var n = 0; n < unusedItems.length; n++) {
                        var widthDiff = unusedItems[n].width - currentItem.width;
                        if (bestWidth + widthDiff <= availableWidth) {
                            // Try adding more items with the space saved/gained
                            var newCombination = bestCombination.slice();
                            newCombination[m] = unusedItems[n].index;
                            var newWidth = bestWidth + widthDiff;

                            // Try to add more items
                            var remainingItems = itemWidths.filter(function (item) {
                                return newCombination.indexOf(item.index) === -1;
                            });

                            for (var p = 0; p < remainingItems.length; p++) {
                                if (newWidth + remainingItems[p].width <= availableWidth) {
                                    newCombination.push(remainingItems[p].index);
                                    newWidth += remainingItems[p].width;
                                }
                            }

                            if (newCombination.length > bestCount) {
                                bestCombination = newCombination;
                                bestCount = newCombination.length;
                                bestWidth = newWidth;
                                improved = true;
                                break;
                            }
                        }
                    }
                }
            }
        }

        return bestCombination;
    }

    /**
     * Sequential selection strategy (original behavior)
     * @param {Array} itemWidths - Array of {index, width, value} objects
     * @param {number} availableWidth - Available width for items
     * @returns {Array} Array of indices of items that should be visible
     */
    function selectSequentialItems(itemWidths, availableWidth) {
        var selectedIndices = [];
        var cumulativeWidth = 0;

        for (var i = 0; i < itemWidths.length; i++) {
            if (cumulativeWidth + itemWidths[i].width <= availableWidth) {
                selectedIndices.push(itemWidths[i].index);
                cumulativeWidth += itemWidths[i].width;
            } else {
                break;
            }
        }

        return selectedIndices;
    }

    /**
     * Recent-first selection strategy
     * @param {Array} itemWidths - Array of {index, width, value} objects
     * @param {number} availableWidth - Available width for items
     * @returns {Array} Array of indices of items that should be visible
     */
    function selectRecentFirstItems(itemWidths, availableWidth) {
        var selectedIndices = [];
        var cumulativeWidth = 0;

        // Start from the end (most recent items)
        for (var i = itemWidths.length - 1; i >= 0; i--) {
            if (cumulativeWidth + itemWidths[i].width <= availableWidth) {
                selectedIndices.unshift(itemWidths[i].index); // Add to beginning to maintain order
                cumulativeWidth += itemWidths[i].width;
            }
        }

        return selectedIndices;
    }

    /**
     * Override the original setup method to add counter functionality
     */
    this.setup = (function () {
        var original = self.setup;
        return function () {
            // Call the original setup method first
            original.apply(this, arguments);

            // Store reference to updateItemDisplay for external access
            self.updateItemDisplay = updateItemDisplay;

            /**
             * Core function that handles the display logic for items and counter
             * Uses configurable strategy to determine which items to show
             */
            function updateItemDisplay() {
                // Add safety check to prevent running before DOM is ready
                if (!self.$control || !self.$control.length) {
                    setTimeout(updateItemDisplay, 10);
                    return;
                }

                // Get current selected items
                var items = self.items || [];
                var totalItems = items.length;

                // Clean up any existing counter buttons
                self.$control.find('.counter').remove();

                // Cache jQuery selectors for performance
                var $control = self.$control;
                var $allItems = $control.find('.item:not(.counter)'); // Exclude counter items
                var $input = $control.find('input');

                // Safety check for required elements
                if (!$allItems.length && totalItems > 0) {
                    // Items haven't been rendered yet, try again later
                    setTimeout(updateItemDisplay, 10);
                    return;
                }

                // Calculate precise container dimensions
                var containerWidth = $control.innerWidth();
                var containerPaddingLeft = parseFloat($control.css('padding-left')) || 0;
                var containerPaddingRight = parseFloat($control.css('padding-right')) || 0;
                var containerBorderLeft = parseFloat($control.css('border-left-width')) || 0;
                var containerBorderRight = parseFloat($control.css('border-right-width')) || 0;

                // Calculate input field dimensions
                var inputOuterWidth = $input.outerWidth(true);
                var inputMarginRight = parseFloat($input.css('margin-right')) || 0;

                // Calculate total available width for items (without counter initially)
                var availableWidth = containerWidth - containerPaddingLeft - containerPaddingRight -
                    containerBorderLeft - containerBorderRight - inputOuterWidth -
                    settings.paddingAdjustment - inputMarginRight;

                // Collect item width information
                var itemWidths = [];
                $allItems.each(function (index) {
                    var $item = $(this);
                    // Make sure item is visible to get accurate width
                    var wasHidden = $item.is(':hidden');
                    if (wasHidden) $item.show();

                    itemWidths.push({
                        index: index,
                        width: $item.outerWidth(true),
                        value: items[index],
                        element: $item
                    });

                    if (wasHidden) $item.hide();
                });
                
                // If only 1 item is selected, always show it
                if (totalItems === 1) {
                    $allItems.show();
                    return;
                }
                
                // First, check if all items fit without needing a counter
                var totalItemsWidth = itemWidths.reduce(function (sum, item) {
                    return sum + item.width;
                }, 0);
                
                // If all items fit, show them all and exit
                if (totalItemsWidth <= availableWidth || totalItems === 0) {
                    $allItems.show();
                    return;
                }

                // Items don't fit - calculate counter space
                var counterText = settings.counterText.replace('{count}', totalItems);
                var counterHtml = `<button class="item counter" type="button" aria-label="Show item count">
                                        ${counterText}
                                   </button>`;
                var $counter = $(counterHtml);
                $control.append($counter);
                var counterOuterWidth = $counter.outerWidth(true);
                var counterMarginLeft = parseFloat($counter.css('margin-left')) || 0;
                var counterMarginRight = parseFloat($counter.css('margin-right')) || 0;
                $counter.remove();

                // Calculate available width for items (with counter space reserved)
                var availableWidthWithCounter = availableWidth - counterOuterWidth - counterMarginLeft - counterMarginRight;

                var visibleIndices = [];

                // Handle edge case: counter alone doesn't fit
                if (counterOuterWidth > availableWidth && totalItems > 0) {
                    visibleIndices = [];
                } else {
                    // Select items based on chosen strategy
                    switch (settings.fitStrategy) {
                        case 'best-fit':
                            visibleIndices = selectBestFitItems(itemWidths, availableWidthWithCounter);
                            break;
                        case 'recent-first':
                            visibleIndices = selectRecentFirstItems(itemWidths, availableWidthWithCounter);
                            break;
                        case 'sequential':
                        default:
                            visibleIndices = selectSequentialItems(itemWidths, availableWidthWithCounter);
                            break;
                    }
                }

                // Hide all items first
                $allItems.hide();

                // Show selected items
                visibleIndices.forEach(function (index) {
                    $allItems.eq(index).show();
                });

                // Create and display counter if there are hidden items
                if (totalItems > 0 && visibleIndices.length < totalItems) {
                    var hiddenCount = totalItems - visibleIndices.length;
                    counterText = settings.counterText.replace('{count}', hiddenCount);

                    // Create tooltip with hidden item names
                    var hiddenIndices = [];
                    for (var i = 0; i < totalItems; i++) {
                        if (visibleIndices.indexOf(i) === -1) {
                            hiddenIndices.push(i);
                        }
                    }

                    var titleItems = hiddenIndices.map(function (index) {
                        return items[index];
                    });

                    var labelField = self.settings.labelField || 'title';
                    var titleItemLabels = titleItems.map(function (value) {
                        var option = self.options[value];
                        return option ? (option[labelField] || value) : value;
                    });


                    var titleText = titleItemLabels.length > 0 ?
                        titleItemLabels.join(', ') : 'No hidden items';

                    // Create final counter button
                    counterHtml = `<button class="item counter" type="button" 
                                   aria-label="Show hidden item count" 
                                   title="${titleText}" 
                                   data-toggle="tooltip">
                                        ${counterText}
                                   </button>`;
                    $counter = $(counterHtml);

                    // Add click handler
                    $counter.on('click', function (e) {
                        e.stopPropagation();
                        $input.focus();
                    });

                    // Insert counter before the input field
                    $input.before($counter);
                }
            }

            // Event bindings with proper timing
            this.on('item_add', function (value) {
                // Use setTimeout to ensure DOM is updated
                setTimeout(updateItemDisplay, 0);
            });

            this.on('item_remove', function (value) {
                setTimeout(updateItemDisplay, 0);
            });

            this.on('initialize', function () {
                // Multiple timing strategies to catch all initialization scenarios
                updateItemDisplay(); // Immediate
                setTimeout(updateItemDisplay, 0); // Next tick
                setTimeout(updateItemDisplay, 10); // Small delay for complex layouts
            });

            this.on('ready', function () {
                // Ready event fires after all initial items are loaded
                setTimeout(updateItemDisplay, 0);
            });

            this.on('clear', function () {
                updateItemDisplay();
            });

            // Handle case where items are loaded via setValue or initial values
            this.on('change', function () {
                setTimeout(updateItemDisplay, 0);
            });

            $(window).on('resize', function () {
                updateItemDisplay();
            });

            this.$control.on('click', '.item .remove', function (e) {
                e.preventDefault();
                e.stopPropagation();
                var $item = $(this).closest('.item');
                var value = $item.data('value');
                self.removeItem(value);
                self.refreshOptions(false);
            });
        };
    })();
});

/**
 * Plugin: Checkbox Options
 * 
 * This plugin adds checkboxes to each option in the dropdown, allowing users to
 * visually see which items are selected and toggle selections by clicking either
 * the checkbox or the option itself.
 * 
 * Features:
 * - Visual checkboxes for each dropdown option
 * - Synchronized checkbox state with item selection
 * - Click handling for both checkbox and option area
 * - Maintains selected items in dropdown (disables hideSelected)
 * - Proper event propagation handling
 * 
 * Dependencies:
 * - Assumes Bootstrap classes (form-check-input) for checkbox styling
 * - Requires the option template to support HTML modification
 */
Selectize.define('checkbox_options', function (options) {
    var self = this;

    // Force disable hideSelected to keep selected options visible in dropdown
    self.settings.hideSelected = false;

    /**
     * Updates the checked state of a checkbox element
     * @param {HTMLInputElement} checkbox - The checkbox element to update
     * @param {boolean} toCheck - Whether the checkbox should be checked
     */
    var UpdateChecked = function (checkbox, toCheck) {
        checkbox.checked = toCheck;
    };

    /**
     * Updates the checkbox state for a specific option element
     * @param {HTMLElement} option - The option element containing the checkbox
     */
    var UpdateCheckbox = function (option) {
        var checkbox = option.querySelector('input.form-check-input');
        if (checkbox instanceof HTMLInputElement) {
            var value = option.getAttribute('data-value');
            // Check if this option's value is in the selected items array
            UpdateChecked(checkbox, self.items.indexOf(value) > -1);
        }
    };

    /**
     * Updates all checkboxes in the dropdown to reflect current selection state
     * Called after dropdown operations to ensure synchronization
     */
    var UpdateAllCheckboxes = function () {
        var options = self.$dropdown_content.find('.option');
        options.each(function () {
            UpdateCheckbox(this);
        });
    };

    /**
     * Override the original setup method to add checkbox functionality
     */
    var orig_setup = self.setup;
    self.setup = function () {
        // Call original setup first
        orig_setup.apply(self, arguments);

        // Store reference to original option renderer
        var orig_render_option = self.settings.render.option;

        /**
         * Override the option renderer to inject checkboxes
         * @param {Object} data - Option data object
         * @param {Function} escape - HTML escape function
         * @returns {HTMLElement} - Modified option element with checkbox
         */
        self.settings.render.option = function (data, escape) {
            // Get the original rendered option
            var rendered = orig_render_option.call(self, data, escape);
            var div = document.createElement('div');
            div.innerHTML = rendered;
            rendered = div.firstChild;

            // Create checkbox element
            var checkbox = document.createElement('input');
            checkbox.classList.add('form-check-input');
            checkbox.type = 'checkbox';

            // Add click handler for checkbox-specific interactions
            checkbox.addEventListener('click', function (evt) {
                evt.stopPropagation(); // Prevent option click from firing
                var option = evt.target.closest('.option');
                if (!option) return;
                var value = option.getAttribute('data-value');
                if (!value) return;

                // Toggle selection based on current state
                if (self.items.indexOf(value) > -1) {
                    self.removeItem(value);
                    option.classList.remove('active');
                } else {
                    self.addItem(value);
                    option.classList.add('active');
                }
                UpdateCheckbox(option);
                self.refreshOptions(false);
            });

            // Set initial checkbox state based on current selection
            var value = data[self.settings.valueField];
            UpdateChecked(checkbox, self.items.indexOf(value) > -1);

            // Insert checkbox at the beginning of the option
            rendered.insertBefore(checkbox, rendered.firstChild);

            return rendered;
        };

        /**
         * Add click handler for option area (excluding checkbox clicks)
         * This allows users to click anywhere on the option to toggle selection
         */
        this.$dropdown.on('click', '.option', function (e) {
            if (e.target.tagName === 'INPUT') return; // Ignore direct checkbox clicks

            var option = e.currentTarget;
            var value = option.getAttribute('data-value');
            if (!value) return;

            // Toggle selection state
            if (option.classList.contains('active')) {
                self.removeItem(value);
                option.classList.remove('active');
            } else {
                self.addItem(value);
                option.classList.add('active');
            }
            UpdateCheckbox(option);
            self.refreshOptions(false);
            e.preventDefault();
        });

        /**
         * Event binding: Update checkboxes when dropdown opens
         * Uses setTimeout to ensure DOM is ready after dropdown animation
         */
        this.on('dropdown_open', function () {
            setTimeout(UpdateAllCheckboxes, 0);
        });

        /**
         * Override refreshOptions to maintain checkbox synchronization
         * This ensures checkboxes stay in sync after any option refresh
         */
        var orig_refreshOptions = self.refreshOptions;
        self.refreshOptions = function () {
            orig_refreshOptions.apply(self, arguments);
            // Use setTimeout to ensure DOM updates are complete
            setTimeout(UpdateAllCheckboxes, 0);
        };
    };

    /**
     * Event binding: Update checkbox when item is removed
     * Ensures the corresponding option's checkbox is unchecked
     */
    self.on('item_remove', function (value) {
        var option = self.getOption(value)[0];
        if (option) {
            option.classList.remove('active');
            UpdateCheckbox(option);
        }
    });

    /**
     * Event binding: Update checkbox when item is added
     * Ensures the corresponding option's checkbox is checked
     */
    self.on('item_add', function (value) {
        var option = self.getOption(value)[0];
        if (option) {
            option.classList.add('active');
            UpdateCheckbox(option);
        }
    });
});