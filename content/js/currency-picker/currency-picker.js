(function ($) {
    // Default currencies list
    const defaultCurrencies = [
        { code: "PHP", label: "Philippine peso", symbol: "₱" },
    ];

    // Main plugin function
    $.fn.currencyPicker = function (methodOrOptions, ...args) {
        if (!this.length) {
            console.warn('[CurrencyPicker]: No elements found. Selector returned empty set.');
            return this;
        }

        // For methods beside init
        if (methods[methodOrOptions]) { 
            return methods[methodOrOptions].apply(this, args); 
        }
        // For init method
        else if (typeof methodOrOptions === "object" || !methodOrOptions) { 
            return methods.init.apply(this, [methodOrOptions]);
        }
        // Unknown method
        else {
            console.warn(`[CurrencyPicker]: Method "${methodOrOptions}" does not exist`);
            return this;
        }
    };

    // Default plugin settings
    $.fn.currencyPicker.defaults = {
        amount: {
            value: null,
            editable: true
        },
        currency: {
            value: null,
            editable: true
        }, 
        currencies: defaultCurrencies,
        load: null, 
        onChange: null 
    };

    const methods = {
        // Initialize plugin
        init: function (options) {

            // Merge defaults with user options
            const settings = $.extend(true, {}, $.fn.currencyPicker.defaults, options); 

            // For each selected element
            return this.each(function () { 
                const $origInput    = $(this);
                const initialized   = $origInput.data("initialized");

                // Save original input attributes
                const origInputId           = $origInput.attr("id") ?? "amount-id";
                const origInputName         = $origInput.attr("name") ?? "amountName";
                const origInputIsRequired   = $origInput.prop("required"); 
                const origInputIsReadOnly   = $origInput.prop('readonly'); 

                // Generate IDs for new elements
                const selectCurrencyId      = `${origInputId}-currency`;    // ID for hidden select
                const selectCurrencyName    = `${origInputName}Currency`;   // Name for hidden select
                const inputAmountId         = `${origInputId}-internal`;    // ID for cloned input

                // DOM element references
                let $currencyAmountContainer    = null; // .vds-currency-amount-container
                let $currencyContainer          = null; // .currency-picker-container
                let $display                    = null; // .currency-picker-item
                let $optionsContainer           = null; // .currency-options-container
                let $currencySelect             = null; // .currency-select-hidden
                let $amount                     = null; // .input-amount

                if (initialized) {
                    const data = $origInput.data("currencyAmountData");

                    if (data) {
                        // Rebuild settings fresh (defaults + new options)
                        const newSettings = $.extend(true, {}, $.fn.currencyPicker.defaults, options);
                        data.settings = newSettings;

                        // Apply new values to the DOM
                        methods.setValue.call($origInput, {
                            currency: newSettings.currency.value,
                            amount: newSettings.amount.value
                        });

                        console.log('[CurrencyPicker]: Already initialized, settings replaced');
                    }

                    return;
                }

                // Mark input as initialized
                $origInput.data("initialized", true);

                // Override currencies if provided
                if (options && options.currencies) {
                    settings.currencies = options.currencies;
                }

                // Load currencies (sync or async) and append UI
                function appendUIWithLoading() {
                    let loadPromise; 

                    // If user provided loader function
                    if (typeof settings.load === "function") { 
                        loadPromise = new Promise(resolve => settings.load(list => resolve(list || [])));
                    }
                    // If currencies is function
                    else if (typeof settings.currencies === "function") { 
                        const result = settings.currencies(); 
                        loadPromise = result instanceof Promise ? result : Promise.resolve(result || []);
                    }
                    // If currencies is a promise
                    else if (settings.currencies instanceof Promise) { 
                        loadPromise = settings.currencies.then(list => list || []); 
                    }
                    // Static array
                    else {
                        loadPromise = Promise.resolve(settings.currencies || []); 
                    }

                    loadPromise
                        .then(function (currencies) { 
                            let normalized = normalizeCurrencies(currencies);

                            // Checks if the loaded currencies is not undefined or null or empty
                            if (!normalized || normalized.length === 0) {
                                console.warn("[CurrencyPicker]: No currencies loaded, using default currencies as fallback.");
                                normalized = defaultCurrencies;
                            }

                            // Find current currency
                            const defaultCurrency   = normalized.find(c => c.isDefault === true);
                            let selectedCurrency    = settings.currency.value || defaultCurrency.code;

                            // Fallback if not found
                            if (!selectedCurrency && normalized.length > 0) {
                                console.warn(`[CurrencyPicker]: No default selected currency was found in the loaded currencies, using the first available currency as fallback.`);

                                selectedCurrency = normalized[0];
                                settings.currency.value = selectedCurrency.code; 
                            }

                            appendUI(normalized, selectedCurrency); 
                        })
                        .catch(function (error) {
                            console.error("[CurrencyPicker]: Failed to load currencies", error);

                            // Fallback to defaultCurrencies if load fails
                            appendUI(defaultCurrencies, defaultCurrencies[0]);
                        });
                }

                // Normalize currency list to {code, label, symbol} format
                function normalizeCurrencies(list) {
                    if (!Array.isArray(list))
                        return [];

                    return list.map(item => {
                        if (typeof item === "string") {
                            return { code: item, label: item, symbol: "" };
                        }

                        if (typeof item === "object" && item !== null) { 
                            return {
                                code: item.code || item.value || "",
                                label: item.label || "",
                                symbol: item.symbol || "",
                                isDefault: item.isDefault || false
                            };
                        }

                        return { code: "", label: "", symbol: "", isDefault: false };
                    });
                }

                // Render currency
                function renderCurrency(currencies, selectedCurrency) {
                    const isDisabled        = !settings.currency.editable;
                    const hasSingleOption   = currencies.length <= 1;

                    // Main container of currency and amount
                    $currencyContainer = $("<div>")
                        .addClass("currency-picker-container");

                    // Currency display/item
                    $display = $("<div>")
                        .addClass("currency-picker-item")
                        .attr("role", "combobox")
                        .attr("aria-expanded", "false")
                        .attr("aria-haspopup", "listbox")
                        .attr("aria-label", "Currency picker")
                        .attr("tabindex", isDisabled ? -1 : 0)
                        .toggleClass("disabled", isDisabled)
                        .toggleClass("has-single-option", hasSingleOption);

                    // Currenct options container
                    $optionsContainer = $("<div>")
                        .addClass("currency-options-container")
                        .attr("role", "listbox")
                        .attr("aria-label", "Currency options")
                        .hide(); 

                    // Native select
                    $currencySelect = $("<select>")
                        .addClass("currency-select-hidden")
                        .attr("id", selectCurrencyId)
                        .attr("name", selectCurrencyName)
                        .prop("disabled", false)
                        .hide();

                    // Populate currencies
                    currencies.forEach(currency => {
                        // Option for custom select
                        const optionHtml = currency.symbol
                            ? `<span class="currency-icon" title="${currency.label}" data-toggle="tooltip">${currency.symbol}</span> <span class="currency-code">${currency.code}</span> <span class="currency-label">${currency.label}</span>`
                            : `${currency.code}`;

                        const $option = $("<div>")
                            .addClass("currency-option")
                            .attr("data-value", currency.code)
                            .attr("data-symbol", currency.symbol)
                            .attr("tabindex", 0)
                            .html(optionHtml);

                        // Append custom option html
                        $optionsContainer.append($option);

                        // Option for native select
                        const optionText = currency.symbol ? `${currency.symbol} ${currency.code}` : currency.code;

                        // Apped native option
                        $currencySelect.append($("<option>")
                            .val(currency.code)
                            .text(optionText).attr("data-symbol", currency.symbol));

                         // Mark selected currency
                        if (currency.code === selectedCurrency) {
                            $option.addClass("selected");
                            $display.html(optionHtml);
                            $currencySelect.val(currency.code);
                        }
                    });

                    // Assemble picker
                    $currencyContainer.append($display, $currencySelect); 

                    // Toggle dropdown visibility
                    $display.on("click", function (e) {
                        e.stopPropagation();

                        $(".currency-options-container")
                            .not($optionsContainer)
                            .hide()
                            .siblings(".currency-picker-container")
                            .removeClass("active");

                        // Toggle current dropdown
                        $optionsContainer.toggle();

                        // Active class
                        $currencyContainer.toggleClass("active", $optionsContainer.is(":visible"));
                    });

                    // Close dropdown on clicking outside
                    $(document).off("click.currencyPicker").on("click.currencyPicker", function () {
                        $(".currency-options-container")
                            .hide()
                            .siblings(".currency-picker-container")
                            .removeClass("active");
                    });

                    // Click handler for currency options
                    $optionsContainer.on("click", ".currency-option", function (e) {
                        e.stopPropagation();

                        const $option   = $(this);
                        const value     = $option.data("value");
                        const text      = $option.html();

                        $currencySelect.val(value).trigger("change");
                        $currencySelect.val(value);
                        $display.html(text);
                        $option.addClass("selected").siblings().removeClass("selected");
                        $optionsContainer.hide();
                        $currencyContainer.removeClass("active");

                        // Trigger onChange callback if exists
                        if (typeof settings.onChange === "function") {
                            const val = methods.getValue.call($origInput);
                            settings.onChange.call($currencyContainer[0], val);
                        }
                    });
                }

                // Render amount
                function renderAmount() {
                    const value         = settings.amount.value !== undefined ? settings.amount.value : 0;
                    const isDisabled    = !settings.amount.editable;

                    // Clone original input
                    $amount = $origInput.clone()
                        .attr("id", inputAmountId)
                        .attr("name", origInputName)
                        .addClass("input-amount")
                        .removeClass("form-control")
                        .val(value)
                        .prop("disabled", isDisabled)
                        .show();

                    $amount.prop("required", origInputIsRequired);

                    $origInput.removeAttr("name")
                        .val(value)
                        .prop("required", false)
                        .hide();

                    $amount.on("input", function () {
                        $origInput.val($(this).val());
                    });
                }

                // Hook input and select events
                function hookEvents() {
                    if (typeof settings.onChange === "function") {
                        $currencyAmountContainer.on("change input", "select, input", function () {
                            const val = methods.getValue.call($origInput);
                            settings.onChange.call($currencyAmountContainer[0], val);
                        });
                    }

                    // pass the blur on the orig input
                    $amount.on("blur", function () {
                        $origInput.trigger("blur");
                    });
                }

                // Append UI to DOM
                function appendUI(currencies, selectedCurrency) {
                    $currencyAmountContainer = $("<div>")
                        .addClass("vds-currency-amount-container")
                        .toggleClass("readonly", origInputIsReadOnly);

                    renderCurrency(currencies, selectedCurrency);
                    renderAmount();
                    hookEvents();
                    $currencyAmountContainer.append($currencyContainer, $optionsContainer, $amount);
                    $origInput.after($currencyAmountContainer);

                    // Store data for later reference
                    $origInput.data("currencyAmountData", {
                        settings,
                        $currencyContainer: $currencyContainer || null,
                        $display: $display || null,
                        $optionsContainer: $optionsContainer || null,
                        $currencySelect: $currencySelect || null,
                        $amount: $amount || null,
                        origInputName,
                        origInputIsRequired,
                        origInputIsReadOnly
                    });
                }

                // Feature Onboarding
                // To-do: Remove on Feb. 5, 2026
                function triggerFeatureOnboarding() {
                    const domainURL             = $('#voyadores-cdn-url').val();
                    const themeLabel            = $('[data-bs-theme]').attr('data-bs-theme');
                    const popoverDescription    = `Work seamlessly with multiple currencies. Set your currency to tailor amount-related fields for your target market.`;
                    const popoverHeader         = `<div class="vstack gap-4" >
                                                        <img id="img-currency-onboarding-image" src="${domainURL}/content/images/tours/currency/currency-${themeLabel}.gif" class="rounded mb-4" alt="Currency feature onboarding"></img>
                                                        <button class="btn driver-popover-close-btn opacity-75" type="button"></button>
                                                        <div><span class="badge text-bg-primary fs-5">NEW</span></div>
                                                        <h4 class="fw-medium mb-0">Introducing Currencies</h4>
                                                    </div>`;

                    // Feature Onboarding Tour Configuration
                    const tableTour = {
                        id: "currency",
                        type: 'global',
                        useDialog: false,
                        driverConfig: {
                            showProgress: false,
                            showButtons: ['next'],
                            doneBtnText: 'Got it'
                        },
                        steps: [
                            {
                                popover: {
                                    title: popoverHeader,
                                    description: popoverDescription
                                },
                            },
                        ]
                    };

                    // Check if TourManager is available before using it
                    if (typeof TourManager !== 'undefined') {
                        try {
                            const tourManager = TourManager.getInstance();
                            tourManager.registerTour(tableTour);
                            tourManager.startPendingTour();

                            console.debug('Table plugin: Feature onboarding tour registered and started');
                        }
                        catch (error) {
                            console.warn('Table plugin: Failed to initialize feature onboarding tour:', error);
                        }
                    }
                    else {
                        console.debug('Table plugin: TourManager not available, skipping feature onboarding');
                    }
                }

                appendUIWithLoading();
                triggerFeatureOnboarding();
            });
        },

        // Get value of currency picker
        getValue: function () {
            const $first    = this.first(); // Use first element if multiple
            const data      = $first.data("currencyAmountData");

            if (!data) {
                console.warn('[CurrencyPicker]: Cannot get value from uninitialized picker. Call .currencyPicker() first.');
                return null;
            }
            
            const rawAmount         = parseFloat(data.$amount?.val());
            const selectedCurrency  = data.$currencySelect?.val() || data.settings.currency.value;
            const selectedOption    = data.$currencySelect?.find(":selected");

            const symbol = selectedOption.length
                ? selectedOption.data("symbol")
                : (data.settings.currencies.find(c => c.code === selectedCurrency)?.symbol || data.settings.currency.symbol);

            // Get the first element if there are multiple
            if (this.length > 1)
                console.warn(`[CurrencyPicker]: getValue() was called on multiple elements. Using the first one only.`);

            console.log(`[CurrencyPicker]: Amount value: ${isNaN(rawAmount) ? data.settings.amount.value : rawAmount} | Currency value: ${selectedCurrency} | Symbol: ${symbol}`)

            return {
                currency: selectedCurrency,
                symbol,
                amount: isNaN(rawAmount) ? data.settings.amount.value : rawAmount
            };
        },

        // Set value of currency picker
        setValue: function (val) {
            return this.each(function () {
                const $origInput    = $(this);
                const data          = $origInput.data("currencyAmountData");

                if (!data) {
                    console.warn('[CurrencyPicker]: Cannot set value on uninitialized picker. Call .currencyPicker() first.');
                    return;
                }

                // Allow setValue only if the argument is an object
                if (typeof val !== "object") { 
                    console.warn('[CurrencyPicker]: setValue() expects an object like {amount: amountValue, currency: currencyCode}');
                    return;
                }

                const { settings, $currencySelect, $display, $optionsContainer, $amount } = data;

                // Track if currency was actually updated
                let currencyUpdated = false;

                // Only update currency if explicitly passed and not null/empty
                if (val.currency !== undefined && val.currency !== null && val.currency !== "") {

                    // Check if the currency exists in the available currencies
                    const currencyExists = $optionsContainer.find(`[data-value="${val.currency}"]`).length > 0;
                    
                    if (!currencyExists) {
                        console.warn(`[CurrencyPicker]: No ${val.currency} was found in the loaded currencies. Value will not be updated.`);
                        return;
                    }
                    
                    settings.currency.value = val.currency;
                    currencyUpdated = true;
                }

                // Only update amount if explicitly provided
                if (val.amount !== undefined) {
                    const num = parseFloat(val.amount);

                    if (val.amount === "" || val.amount === null) {
                        settings.amount.value = null;   
                    } else {
                        settings.amount.value = isNaN(num) ? 0 : num;
                    }
                }

                // Only update <select> if currency was explicitly updated
                if (currencyUpdated && $currencySelect && $currencySelect.length) {
                    $currencySelect.val(settings.currency.value).trigger("change");

                    console.log(`[CurrencyPicker]: Currency value has been updated to ${settings.currency.value}`)
                }

                // Update amount value in DOM
                if (val.amount !== undefined && $amount) {
                    $amount.val(settings.amount.value ?? "");
                    $origInput.val(settings.amount.value ?? "");

                    console.log(`[CurrencyPicker]: Amount value has been updated to ${settings.amount.value}`)
                }

                // Only refresh displayed currency if we updated it
                if (currencyUpdated && $optionsContainer && $optionsContainer.length) {
                    const $selectedOption = $optionsContainer.find(`[data-value="${settings.currency.value}"]`);

                    if ($selectedOption.length) {
                        $optionsContainer.find(".selected").removeClass("selected");
                        $selectedOption.addClass("selected");

                        if ($display && $display.length) {
                            $display.html($selectedOption.html());

                            console.log('[CurrencyPicker]: Currency display has been updated')
                        }
                    }
                }
            });
        },

        // Destroy plugin and restore original input
        destroy: function () {
            return this.each(function () {
                const $origInput    = $(this);
                const data          = $origInput.data("currencyAmountData");
                const $container    = $origInput.siblings(".vds-currency-amount-container");

                if (!data) {
                    console.warn('[CurrencyPicker]: Cannot destroy an uninitialized picker. Call .currencyPicker() first.');
                    return;
                }

                if ($container.length) 
                    $container.remove();

                // Restore original input attributes
                $origInput.attr("name", data.origInputName)
                    .prop("required", data.origInputIsRequired);

                // Restore original value if amount input existed
                if (data.$amount)
                    $origInput.val(data.$amount.val());

                // Unbind event
                $(document).off("click.currencyPicker");
                data.$display?.off("click");
                data.$optionsContainer?.off("click");

                $origInput.show(); 
                $origInput.removeData("currencyAmountData"); 
                $origInput.removeData("initialized"); 
            });
        },

        // Disable amount or currency
        isEditable: function (val) {
            // Getter: return current state if no argument is passed
            if (val === undefined) {
                const $first    = this.first();
                const data      = $first.data("currencyAmountData");

                if (!data) {
                    console.warn('[CurrencyPicker]: Cannot disable or enable an uninitialized picker. Call .currencyPicker() first.');
                    return;
                }

                return {
                    amount: !!data.settings.amount.editable,
                    currency: !!data.settings.currency.editable
                };
            }

            // Setter: apply changes if val is provided
            return this.each(function () {
                const $origInput    = $(this);
                const data          = $origInput.data("currencyAmountData");

                if (!data)
                    return;

                const { settings, $amount, $display } = data;

                if (typeof val !== "object") {
                    console.warn(`[CurrencyPicker]: isEditable() expects an object like {amount: true, currency: false}`);
                    return;
                }

                // Add disable prop in cloned amount
                if (val.amount !== undefined) {
                    if (typeof val.amount !== "boolean") {
                        console.warn(`[CurrencyPicker]: isEditable() expects "amount" to be a boolean (true/false)`);
                    } else {
                        // Update settings
                        settings.amount.editable = val.amount;

                        if ($amount && $amount.length) {
                            $amount.prop("disabled", !settings.amount.editable);
                        }
                    }
                }

                // Add disable class in .currency-picker-item
                if (val.currency !== undefined) {
                    if (typeof val.currency !== "boolean") {
                        console.warn(`[CurrencyPicker]: isEditable() expects "currency" to be a boolean (true/false)`);
                    } else {
                        // Update settings
                        settings.currency.editable = val.currency;

                        if ($display && $display.length) {
                            $display.toggleClass("disabled", !settings.currency.editable);
                        }
                    }
                }
            });
        }
    };
}(jQuery));