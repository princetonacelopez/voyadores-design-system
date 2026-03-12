(function ($) {

    'use strict';

    const elementTypes = [
        'textarea',
        'select',
        'input[type="text"]',
        'input[type="password"]',
        'input[type="email"]',
        'input[type="tel"]',
        'input[type="url"]',
        'input[type="search"]',
        'input[type="number"]',
        'input[type="range"]',
        'input[type="date"]',
        'input[type="checkbox"]',
        'input[type="radio"]',
        'input[type="file"]',
        'input[type="time"]'
    ].join(", ");

    const premadePatterns = {
        // At least 8 chars, 1 uppercase letter, 1 lowercase letter, 1 number, special chars [!@#$%&_=+-]
        "[password]": /^(?=.*[A-Z])(?=.*[a-z])(?=.*\d)(?=.*[!@#$%&_=+-])[A-Za-z\d!@#$%&_=+-]{8,}$/,
        // Test for domain names like google.com, my-domain.com, etc.
        "[domain]": /^([a-zA-Z0-9-]+\.)+[a-zA-Z]{2,}$/
    }

    const utils = {
        instanceOf: function (obj, constructor) {
            // Check if the value is an object
            if (typeof obj === "object" && obj !== null) {
                return obj instanceof constructor;
            }

            // If not an object, directly return false
            return false;
        },
        cleanHtml: function (html) {
            // Create a new DOM parser
            var parser = new DOMParser();
            // Parse the HTML string into a new document
            var doc = parser.parseFromString(html, 'text/html');
            // Use textContent to extract only the text
            return doc.body.textContent || "";
        },
        formDataMapper: function (model) {
            const formData = new FormData();

            function appendFormData(data, keyPrefix) {
                if (typeof data === 'object' && data !== null) {
                    if ($.isArray(data)) {
                        // Handle array of objects
                        data.forEach(function (item, index) {
                            appendFormData(item, `${keyPrefix}[${index}]`);
                        });
                    } else if (data instanceof File) {
                        // Handle file objects
                        formData.append(keyPrefix, data);
                    } else {
                        // Handle nested objects
                        for (const key in data) {
                            if (!data.hasOwnProperty(key)) continue;

                            appendFormData(data[key], keyPrefix ? `${keyPrefix}.${key}` : key);
                        }
                    }
                } else {
                    // Handle primitive values (strings, numbers, etc.)
                    formData.append(keyPrefix, data);
                }
            }

            appendFormData(model, '');

            return formData;
        },
        getCustomRule: function (name, settings, attr) {
            const customRules = settings.fields?.[name]?.rules;
            const valueTypes = {
                pattern: RegExp,
                required: "boolean",
                min: "number",
                max: "number",
                minlength: "number",
                maxlength: "number",
            }

            if (!customRules) return null;

            // check if a custom rule is allowed within the valueTypes range.
            const allowedCustomRule = Array.from(Object.keys(customRules)).includes(attr);

            if (!allowedCustomRule) return null;

            if (attr !== "pattern") return (typeof customRules[attr] === valueTypes[attr]) ? customRules[attr] : null;

            // if pattern rule uses the premade patterns
            if (typeof customRules[attr] === "string") return premadePatterns[customRules[attr]] ?? null;

            // otherwise, it must be a RegExp literal
            return utils.instanceOf(customRules[attr], valueTypes.pattern) ? customRules[attr] : null;
        },
        getElementTag: function (field) {
            if (utils.instanceOf(field, HTMLInputElement)) {
                const inputType = $(field).attr("type");
                return `input:${inputType}`;
            }

            if (utils.instanceOf(field, HTMLTextAreaElement)) {
                return "textarea";
            }

            if (utils.instanceOf(field, HTMLSelectElement)) {
                return "select";
            }

            throw new Error("Unsupported element");
        },
        extractForm: function ($form) {
            const formData = {};

            // include fieldsets that are outside of the <form> element
            // that are associated via [form={id}] attribute
            const fieldSets = $(`fieldset[form="${$form.attr("id")}"]`).find(elementTypes).toArray();
            const elements = [...$form.find(elementTypes).toArray(), ...fieldSets];

            elements.forEach(element => {
                const name = element.name;
                const id = element.id;
                const elementTag = utils.getElementTag(element);

                // Skip elements without a name attribute
                if (!name) return;

                // Check if the element is a checkbox or radio button
                if (element.type === "checkbox" || element.type === "radio") {

                    // Find if the group already exists in formData
                    if (formData[name]) {
                        // If the element is checked, add its value to the existing group
                        if (element.checked) {
                            formData[name].value.push(element.value === 'on' ? true : element.value);
                        }

                        return;
                    }

                    // If no group exists, create a new group
                    formData[name] = {
                        tag: elementTag,
                    }

                    if (element.checked) {
                        formData[name].value = [element.value === 'on' ? true : element.value];
                    } else {
                        // If no checkboxes or radios are checked, ensure empty value
                        formData[name].value = [];
                    }

                    formData[name].$fields = $form.find(`[name="${name}"]`);
                }

                else {
                    // For all other input types, add them as a single key-value pair
                    formData[name] = {
                        tag: elementTag,
                        $fields: $(element)
                    }

                    // check for file input type
                    if (element.type === "file") {
                        formData[name].value = element.files.length > 1 ? Array.from(element.files) : element.files[0];
                    }
                    else {
                        formData[name].value = element.value;
                    }
                }

                formData[name].name = name;

                const $label = $form.find(`label[for="${id}"]`);

                if ($label.length == 1) {
                    formData[name].label = $label.text().replace(/[^a-zA-Z0-9 ]/g, '');
                }
            });

            return formData;
        },
        loader: {
            set: function (fields) {
                const $this = $(fields);

                if (!(utils.instanceOf($this, jQuery)))
                    throw new Error("Button is not a jQuery instance");

                $this.data("_html", $this.html());
                $this.prop("disabled", true);
                $this.attr("style", `width: ${$this.outerWidth().toFixed(2)}px; height: ${$this.outerHeight().toFixed(2)}px`);
                $this.html(`<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span>`);
            },
            unset: function (fields) {
                const $this = $(fields);

                if (!(utils.instanceOf($this, jQuery)))
                    throw new Error("Button is not a jQuery instance");

                $this.prop("disabled", false);
                $this.html($this.data("_html"));
                $this.removeAttr("style");
            }
        }
    }

    const validations = {
        required: {
            applicable: ["input:text", "input:email", "input:password", "input:tel", "input:url", "input:search", "input:number", "input:file", "input:time", "input:radio", "input:checkbox", "select", "textarea"],
            message: function ({ label }) {
                return label ? `${label} is required` : "This field is required";
            },
            valid: function ({ value }) {
                if (typeof value === "string" && (!value || $.trim(value).length === 0)) return false; // for values that are strings
                if ($.isArray(value) && value.length === 0) return false; // for values that are arrays
                if (!value) return false; // if not string, or array

                return true;
            }
        },
        pattern: {
            applicable: ["input:text", "input:password", "input:search"],
            message: function () {
                return "This format is invalid";
            },
            valid: function ({ value, attrValue }) {
                if (!value) return true;

                if (attrValue instanceof RegExp) {
                    return attrValue.test(value);
                }

                try {
                    const regex = new RegExp(attrValue);
                    return true && regex.test(value);
                } catch {
                    return false;
                }
            }
        },
        min: {
            applicable: ["input:number", "input:range"],
            message: function ({ attrValue, label }) {
                return label ? `${label} must have a minimum value of ${attrValue}` : `This field must have a minimum value of ${attrValue}`;
            },
            valid: function ({ value, attrValue }) {
                if (!value) return true;
                return !(+value < +attrValue);
            }
        },
        max: {
            applicable: ["input:number", "input:range"],
            message: function ({ attrValue, label }) {
                return label ? `${label} must have a maximum value of ${attrValue}` : `This field must have a maximum value of ${attrValue}`;
            },
            valid: function ({ value, attrValue }) {
                if (!value) return true;
                return !(+value > +attrValue);
            }
        },
        minlength: {
            applicable: ["input:text", "input:password", "input:search"],
            message: function ({ attrValue, label }) {
                return label ? `${label} must be a minimum of ${attrValue} characters` : `This field must be a minimum of ${attrValue} characters`;
            },
            valid: function ({ value, attrValue }) {
                if (!value) return true;
                return !(+value.length < +attrValue);
            }
        },
        maxlength: {
            applicable: ["input:text", "input:password", "input:search"],
            message: function ({ attrValue, label }) {
                return label ? `${label} must be a maximum of ${attrValue} characters` : `This field must be a maximum of ${attrValue} characters`;
            },
            valid: function ({ value, attrValue }) {
                if (!value) return true;
                return !(+value.length > +attrValue);
            }
        },
        accept: {
            applicable: ["input:file"],
            message: function ({ attrValue, label }) {
                const validExt = attrValue.split(',')                   
                    .filter(ext => ext.trim().startsWith('.'))
                    .join(', ');

                return label ? `${label} only accepts ${validExt.replace(/,([^,]+)$/, ', and$1')} file types` : `This field only accepts ${validExt.replace(/,([^,]+)$/, ', and$1')} file types`;
            },
            valid: function ({ value, attrValue }) {
                if ($.isArray(value) && value.length === 0) return true; 
                if (!value) return true; 

                if ($.isArray(value)) {
                    value = [...value];
                } else {
                    value = [value];
                }

                const fileTypes = [];

                value.forEach(file => {
                    const extensionMatch = file.name.match(/\.([a-zA-Z0-9]+)$/);
                    const acceptedTypes = attrValue.match(/\.\w+/g).map(ext => ext.slice(1));

                    fileTypes.push(acceptedTypes.includes(extensionMatch ? extensionMatch[1] : null));
                });

                return fileTypes.every(accepted => accepted);
            }
        },
        email: {
            applicable: ["input:email"],
            typeValidation: true,
            message: function () {
                return "Invalid email format"
            },
            valid: function ({ value }) {
                if (!value) return true;

                const emailPattern = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

                return emailPattern.test(value);
            }
        },
        url: {
            applicable: ["input:url"],
            typeValidation: true,
            message: function () {
                return "Invalid url format"
            },
            valid: function ({ value }) {
                if (!value) return true;
                const strictUrlPattern = /^(https?:\/\/)?([\w-]+\.)+[\w-]+(\/[\w- ;,./?%&=]*)?$/;
                try {
                    new URL(value);
                    return true && strictUrlPattern.test(value);
                } catch {
                    return false;
                }
            }
        },
        tel: {
            applicable: ["input:tel"],
            typeValidation: true,
            message: function ({ label }) {
                return label ? `${label} must be a valid phone number` : "This field must be a valid phone number";
            },
            valid: function ({ value }) {
                if (!value) return true;

                // Ref. https://stackoverflow.com/questions/16699007/regular-expression-to-match-standard-10-digit-phone-number/16702965#16702965
                // Pattern matches the ff. and more:
                // 18005551234
                // 1 800 555 1234
                // + 1 800 555 - 1234
                // + 86 800 555 1234
                // 1 - 800 - 555 - 1234
                // 1(800) 555 - 1234
                // (800)555 - 1234
                // (800) 555 - 1234
                // (800)5551234
                // 800 - 555 - 1234
                // 800.555.1234
                // 800 555 1234x5678
                // 8005551234 x5678
                // 1    800    555 - 1234
                // 1----800----555 - 1234

                const phonePatterns = /^\s*(?:\+?(\d{1,3}))?[-. (]*(\d{3})[-. )]*(\d{3})[-. ]*(\d{4})(?: *x(\d+))?\s*$/;

                return phonePatterns.test(value);
            }
        }
    };

    // list of timeouts created using the [timeout] trigger
    const registeredTimeouts = [];

    const formMethods = {
        reset: function (settings, callback = undefined) {
            const $form = settings._$form;
            const id = $form.attr("id");
            const $submitBtn = $form.find("[type='submit']").length > 0 ? $form.find("[type='submit']") : $(`[form=${id}][type="submit"]`);
            const fieldsObj = utils.extractForm($form);

            $form[0].reset();

            // resets any timeouts that are created
            registeredTimeouts.forEach(t => clearTimeout(t));
            registeredTimeouts.length = 0;

            // get the 'cssClass' options
            const { fieldInvalid, fieldValid } = settings.cssClass;

            // remove field error highlights
            $(`.${fieldInvalid}, .${fieldValid}`).removeClass([fieldValid, fieldInvalid]);
            $("span[data-error]").remove();

            $submitBtn.each(function () {
                utils.loader.unset(this);
            });

            if (typeof callback === "function") {
                const fieldMapping = Object.entries(fieldsObj)
                    .reduce((acc, [key, obj]) => {
                        acc[key] = obj.$fields;
                        return acc;
                    }, {});

                callback(fieldMapping);
            }

            else if (typeof settings.onReset === "function") {
                const fieldMapping = Object.entries(fieldsObj)
                    .reduce((acc, [key, obj]) => {
                        acc[key] = obj.$fields;
                        return acc;
                    }, {});

                settings.onReset(fieldMapping);
            }
        },
    };

    const validationBehaviors = {
        timeout: function (settings) {
            const $form = settings._$form;
            const timeoutSeconds = 2000; 
            const forValidation = Object.entries(utils.extractForm($form));

            let formTimeout = setTimeout(function () {
                for (const [name] of forValidation) {
                    // we call `utils.extractForm` to rebuild the data
                    const mapping = utils.extractForm($form);

                    const validAttribute = runAttributeValidations(mapping[name], settings);

                    if (validAttribute) {
                        runCustomFieldValidations(name, mapping, settings);
                    }
                }
            }, timeoutSeconds);

            // store the timeout for later clearing if 
            // [reset] method is called
            registeredTimeouts.push(formTimeout)

            $form.off("change input").on("change input", function () {
                // clear timeout first
                clearTimeout(formTimeout);

                formTimeout = setTimeout(function () {
                    for (const [name] of forValidation) {
                        // we call `utils.extractForm` to rebuild the data
                        const mapping = utils.extractForm($form);

                        const validAttribute = runAttributeValidations(mapping[name], settings);

                        if (validAttribute) {
                            runCustomFieldValidations(name, mapping, settings);
                        }
                    }
                }, timeoutSeconds);
            })
        },
        blur: function (settings) {
            const $form = settings._$form;
            const forValidation = Object.entries(utils.extractForm($form));

            for (const [name, { $fields }] of forValidation) {
                const triggerPlacement = settings.fields?.[name]?.triggerPlacement?.($fields) ?? $fields.last();

                triggerPlacement.parent().off("focusout").on("focusout", () => {

                    // we call `utils.extractForm` to rebuild the data
                    const mapping = utils.extractForm($form);

                    const validAttribute = runAttributeValidations(mapping[name], settings);

                    if (validAttribute) {
                        runCustomFieldValidations(name, mapping, settings);
                    }
                });
            }
        },
        submit: function (settings) {
            const $form = settings._$form;
            const mapping = utils.extractForm($form);
            const forValidation = Object.entries(mapping);
            const validationResults = [];

            for (const [name, metadata] of forValidation) {

                let validFieldCustom = true;
                let validAttribute = runAttributeValidations(metadata, settings);

                if (validAttribute) {
                    validFieldCustom = runCustomFieldValidations(name, mapping, settings);
                }

                validationResults.push(validAttribute && validFieldCustom);
            }

            // validate custom globals if set
            const validGlobalCustom = runCustomGlobalValidations(settings);

            validationResults.push(validGlobalCustom);

            // all validations should be true, otherwise return false;
            return !validationResults.some(valid => !valid);
        }
    }

    $.fn.formValidate = function (params = {}, action) {

        const $form = $(this);
        const id = $form.attr("id");

        if (!$form.is("form")) {
            throw new Error(`'${id}' is not an HTML Form element`);
        }

        // Form must have a 'novalidate' attribute
        if ($form.attr("novalidate") === undefined) {
            throw new Error(`'${id}' must have a [novalidate] attribute added`);
        }

        const $submitBtn = $form.find("[type='submit']").length > 0 ? $form.find("[type='submit']") : $(`[form=${id}][type="submit"]`);
        const $resetBtn = $form.find("[type='reset']").length > 0 ? $form.find("[type='reset']") : $(`[form=${id}][type="reset"]`);

        let settings = $form.data("formValidate") || null;

        if ($.isPlainObject(params)) {
            params._id = id;
            params._$form = $form;

            // If a new options is passed, overwrite the previous setting stored
            // in the element itself
            settings = $.extend({}, $.fn.formValidate.default, params, true);

            if (!["blur", "submit", "timeout"].includes(settings.trigger)) {
                console.warn(`No trigger option \`${settings.trigger}\` available`);
                settings.trigger = "submit";
            }

            $form.data("formValidate", settings);
        }

        if (typeof params === "string") {

            if (!settings) {
                throw new Error(`No \`formValidate\` instance found for #${id}`);
            }

            if (!(params in formMethods)) {
                console.warn(`No callable \`formValidate\` action found with the name of \`${params}\``);
            }

            formMethods?.[params]?.(settings, action);

            return $form;
        }

        // reserve submit behvaior for the form submission
        if (settings.trigger !== "submit") {
            validationBehaviors[settings.trigger](settings);
        }

        if ($submitBtn.length === 0) {
            console.error(`Unable to find the associated submit button for '${id}'. You must add a button or input of [type="submit"] inside the form or if it's outside, use [form="{id}"] to associate.`);
            return $form;
        }

        // add reset click event if a reset button exists
        if ($resetBtn.length > 0) {
            $resetBtn.off("click").click(() => formMethods.reset(settings));
        }

        $form.off("submit").on("submit", function (event) {

            event.preventDefault();
            event.stopPropagation();

            const formIsValid = validationBehaviors.submit(settings);

            if (!formIsValid || typeof settings.onSubmit !== "function") return;

            $submitBtn.each(function () {
                utils.loader.set(this);
            });

            const formData = Object.entries(utils.extractForm($form))
                .reduce((acc, [key, obj]) => {

                    if ($.isArray(obj.value)) {
                        if (obj.value.length === 0) {
                            obj.value = false;
                        }

                        if (obj.value.length === 1) {
                            obj.value = obj.value[0];
                        }
                    }

                    acc[key] = typeof obj.value === "string" ? obj.value.trim() : obj.value;

                    return acc;
                }, {});

            settings.onSubmit(formData, (statusOrFalse, data, callback) => {
                // if there is no need for handling async errors
                if (typeof statusOrFalse === "boolean" && !statusOrFalse) {
                    $submitBtn.each(function () {
                        utils.loader.unset(this);
                    });

                    return;
                }

                const badRequest = 400;

                // if no server-side validation found run the user-defined callback and stop further actions
                if (statusOrFalse !== badRequest || !data?.HasFieldErrors || data?.Errors.length == 0) {
                    callback?.();

                    $submitBtn.each(function () {
                        utils.loader.unset(this);
                    });

                    return;
                }

                const errorsArray = data.Errors;

                for (const err of errorsArray) {
                    const name = err.Field;
                    const $fields = $form.find(`[name="${name}"]`);

                    if ($fields.length === 0) continue;

                    // get the custom 'fields' options
                    const fieldOptions = settings.fields?.[name];
                    const error = fieldOptions?.errorPlacement?.($fields) ?? $fields.last();
                    const highlight = fieldOptions?.highlightPlacement?.($fields) ?? $fields;

                    // get the custom 'cssClass' options
                    const { fieldInvalid, fieldValid, messageInvalid } = settings.cssClass;

                    error.after(`<span class="${messageInvalid} text-truncate" title="${err.Message}" data-error="${name}" style="color: #fe5b4c">${err.Message}</span>`);
                    highlight.removeClass(fieldValid).addClass(fieldInvalid);
                }

                $submitBtn.each(function () {
                    utils.loader.unset(this);
                });
            }, utils.formDataMapper);

            // reset form when `resetOnSubmit` option is set to `true`
            if (settings.resetOnSubmit) {
                formMethods.reset(settings);
            }
        })

        return $form;
    }

    // Exposed public default options that can be modified by consumer
    $.fn.formValidate.default = {
        onSubmit: null,
        onReset: null,
        resetOnSubmit: false,
        trigger: "submit",
        custom: [],
        fields: {},
        cssClass: {
            fieldValid: "form-item-valid",
            fieldInvalid: "form-item-invalid",
            messageInvalid: "invalid-feedback"
        },
        errors: {
            required: null,
            pattern: null,
            min: null,
            max: null,
            minlength: null,
            maxlength: null,
            email: null,
            url: null,
            tel: null
        }
    }

    function runCustomGlobalValidations(settings) {
        const validations = [];
        const customValidations = settings.custom;

        if (!$.isArray(customValidations) || customValidations.length == 0) return true;

        // get the 'cssClass' options
        const { fieldInvalid, fieldValid, messageInvalid } = settings.cssClass;

        for (const v of customValidations) {
            if (!$.isPlainObject(v)) continue;

            // get the custom error and highlight placements
            const error = v?.errorPlacement?.();
            const highlight = v?.highlightPlacement?.();

            if (!(error instanceof jQuery) || error.length == 0) {
                console.warn("No `errorPlacement` element found for global validation");
                continue;
            }

            if (typeof v.valid !== "function") {
                console.warn("No `valid` function found for global validation");
                continue;
            }

            // remove previous error and highlight
            error.next("span[data-error]").remove();
            highlight?.removeClass([fieldInvalid, fieldValid]);

            const isValid = v.valid();

            if (!isValid) {
                const errMessage = v.error ?? "This field is invalid";
                error.after(`<span class="${messageInvalid} text-truncate" title="${errMessage}" data-error style="color: #fe5b4c">${errMessage}</span>`);
                highlight?.removeClass(fieldValid).addClass(fieldInvalid);

                validations.push(false);
                continue;
            }

            validations.push(true);
        }

        return validations.every(isValid => isValid);
    }

    function runCustomFieldValidations(name, formDataMapping, settings) {
        let valid = true;
        const customValidations = settings.fields?.[name]?.custom;

        if (!customValidations) return valid;

        // get the custom 'cssClass' options
        const { fieldInvalid, fieldValid, messageInvalid } = settings.cssClass;

        for (const v of customValidations) {
            if (typeof v.valid !== "function") continue;

            const $fields = formDataMapping[name].$fields;
            const isValid = v.valid(formDataMapping);

            // get the custom 'fields' options
            const fieldOptions = settings.fields?.[name];
            const error = fieldOptions?.errorPlacement?.($fields) ?? $fields.last();
            const highlight = fieldOptions?.highlightPlacement?.($fields) ?? $fields;

            if (!isValid) {
                const errMessage = v.error ?? "This field is invalid";
                error.after(`<span class="${messageInvalid} text-truncate" title="${errMessage}" data-error="${name}" style="color: #fe5b4c">${errMessage}</span>`);
                highlight.removeClass(fieldValid).addClass(fieldInvalid);

                valid = !valid;
                break;
            }
        }

        return valid;
    }

    function runAttributeValidations(metadata, settings) {
        let valid = true;
        const validatedAttr = [];
        const $form = settings._$form;

        const { name, tag, value, $fields, label } = metadata;

        // get the custom 'cssClass' options
        const { fieldInvalid, fieldValid, messageInvalid } = settings.cssClass;
        const validationList = Object.entries(validations);

        for (const [attrName, v] of validationList) {
            if (!v.applicable.includes(tag)) continue;

            // get the custom 'fields' options
            const fieldsOption = settings.fields?.[name];

            const error = fieldsOption?.errorPlacement?.($fields) ?? $fields.last();
            const highlight = fieldsOption?.highlightPlacement?.($fields) ?? $fields;
            const fieldsOptionMessage = fieldsOption?.errors?.[attrName];
            const finalValue = fieldsOption?.value?.($fields, { clean: utils.cleanHtml }) ?? (typeof value === "string" ? value.trim() : value);

            // get the custom 'errors' options
            const errorsOptionMessage = settings.errors?.[attrName];

            // remove all previous validation errors and highlight
            error.next(`span[data-error="${name}"]`).remove();
            highlight.removeClass([fieldValid, fieldInvalid]);

            // if a 'depends' option is set, only run the validation if it returns
            // true, otherwise bypass the element in question. This is useful if
            // we want to run the validation on a certain condition only.
            const proceedValidation = fieldsOption?.depends?.[attrName]?.(utils.extractForm($form));
            if (typeof proceedValidation === "boolean" && !proceedValidation) continue;

            // check if the elements are checkbox or radio which is
            // grouped into array of elements if they have the same "name" attribute
            // or array of a single element if only one
            if ($fields.length > 1 && (tag == "input:checkbox" || tag == "input:radio")) {
                const canValidate = $fields.is(`[${attrName}]`) || utils.getCustomRule(name, settings, attrName);

                // if no validation required, go to the next element
                if (!canValidate) return valid;

                const isValid = v.valid({ value });

                if (!isValid) {

                    // get the error message to use
                    const message = fieldsOptionMessage ?? errorsOptionMessage ?? v.message({ label });

                    highlight.removeClass(fieldValid).addClass(fieldInvalid)
                    error.after(`<span class="${messageInvalid} text-truncate" title="${message}" data-error="${name}">${message}</span>`)

                    valid = !valid;
                    break;
                }
            }

            // checks for HTML attribute validations, or if
            // a custom rule validation is set as option, or is a non-html 
            // attribute(i.e.validations for type "email", "url", and "tel")
            const attr = $fields.attr(attrName) ?? utils.getCustomRule(name, settings, attrName) ?? v.typeValidation;

            // if falsy, continue to next element
            if (!attr) continue;

            validatedAttr.push(attrName);

            // for fields that are optional, bypass other attribute validations unless 
            // a value is entered. Custom field validations on the other hand will still execute.
            if (!validatedAttr.includes("required") && (!finalValue || finalValue.length === 0)) continue;

            const isValid = v.valid({
                tag,
                $field: $fields,
                value: finalValue,
                attrValue: attr,
            });

            if (!isValid) {

                // get the error message to use
                const message = fieldsOptionMessage ?? errorsOptionMessage ?? v.message({ attrValue: attr, label });

                error.after(`<span class="${messageInvalid} text-truncate" title="${message}" data-error="${name}">${message}</span>`);
                highlight.removeClass(fieldValid).addClass(fieldInvalid);

                valid = !valid;
                break;
            }
        }

        return valid;
    }
}(jQuery));