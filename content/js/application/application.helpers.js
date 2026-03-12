$(function () {

    $('input[type=search]').on('search', function () {
        $(this).blur();
        $(this).val('');
    });

    $('.text-char').on("input", function (event) {
        // Get the input value after the paste event
        const inputValue = $(this).val();

        // Use regular expression to allow only 0-9, a-z, dash, and dot
        const regex = /^[0-9a-zA-Z\-\. ]*$/;

        // Check if the input value matches the regex
        if (!regex.test(inputValue)) {
            // Remove invalid characters from the input value using a regular expression
            const cleanedValue = inputValue.replace(/[^0-9a-zA-Z\-\. ]/g, '');

            // Update the input field with the cleaned value
            $(this).val(cleanedValue);
        }
    });

    $('.name-char').on("input", function () {
        // Get the input value after the paste event
        const inputValue = $(this).val();

        // Use regular expression to allow only 0-9, a-z, dash, dot and comma
        const regex = /^[a-zA-Z\-., ]*$/;

        // Check if the input value matches the regex
        if (!regex.test(inputValue)) {
            // Remove invalid characters from the input value using a regular expression
            const cleanedValue = inputValue.replace(/[^a-zA-Z\-., ]/g, '');

            // Update the input field with the cleaned value
            $(this).val(cleanedValue);
        }
    });

    $('.tin-char').on("input", function () {
        // Get the input value after the paste event
        const inputValue = $(this).val();

        // Use regular expression to allow only 0-9 and dash
        const regex = /^[0-9\-]*$/;

        // Check if the input value matches the regex
        if (!regex.test(inputValue)) {
            // Remove invalid characters from the input value using a regular expression
            const cleanedValue = inputValue.replace(/[^0-9\-]/g, '');

            // Update the input field with the cleaned value
            $(this).val(cleanedValue);
        }
    });

    $('.description-char').on("input", function () {
        // Get the input value after the paste event
        const inputValue = $(this).val();

        // Use regular expression to allow only 0-9, a-z, dash, dot and comma
        const regex = /^[0-9a-zA-Z\-., ]*$/;

        // Check if the input value matches the regex
        if (!regex.test(inputValue)) {
            // Remove invalid characters from the input value using a regular expression
            const cleanedValue = inputValue.replace(/[^0-9a-zA-Z\-., ]/g, '');

            // Update the input field with the cleaned value
            $(this).val(cleanedValue);
        }
    });

    $('.code-char').on("input", function () {
        // Get the input value after the paste event
        const inputValue = $(this).val();

        // Use regular expression to allow only 0-9, a-z, dash
        const regex = /^[0-9a-zA-Z\-]*$/;

        // Check if the input value matches the regex
        if (!regex.test(inputValue)) {
            // Remove invalid characters from the input value using a regular expression
            const cleanedValue = inputValue.replace(/[^0-9a-zA-Z\-]/g, '');

            // Update the input field with the cleaned value
            $(this).val(cleanedValue);
        }
    });

    let isPasting = false;

    $(document).on("paste", "input[type=number]", function () {
        isPasting = true
    });

    $(document).on("keydown input", "input[type=number]", function (event) {
        if ((event.ctrlKey || event.metaKey) && event.keyCode === 86)
            isPasting = true;
    });

    $(document).on("keypress input","input[type=number]", function (event) {
        // Get the pressed key as a string
        const key = String.fromCharCode(event.which);

        // Allow digits (0-9) and the dot (.)
        const allowedCharacters = /^[0-9.]*$/;
        const inputValue        = $(this).val();

        //Check if using paste action
       if (isPasting) {
            // Perform your desired actions here when paste is detected
           $(this).val(TextToNumericAndTwoDecimals(inputValue));
           isPasting = false;
        }
        else {
            if (!allowedCharacters.test(key)) {
                // Prevent the default action if the key is not allowed
                event.preventDefault();
            }
            
            // Regular expression to validate two decimal points
            const validNumberRegex = /^\d+(\.\d{0,2})?$/;
            if (!validNumberRegex.test(inputValue) && (inputValue != ''))
                $(this).val(TextToNumericAndTwoDecimals(inputValue));
        }
        
    });

    function TextToNumericAndTwoDecimals(data) {

        let value = '';

        // Remove any non-numeric characters except for dot (.)
        let sanitizedValue = data.replace(/[^0-9.]/g, '');

        // Check if there are multiple dots (.) in the input
        if ((sanitizedValue.match(/\./g) || []).length > 1) {
            // Remove all dots (.) except for the first one
            sanitizedValue = sanitizedValue.replace(/(.*\..*)\./g, '$1');
        }

        // Ensure that the value is a number with at most two decimal places
        const numericValue = parseFloat(sanitizedValue);

        // Update the input value with the sanitized numeric value
        if (!isNaN(numericValue))
            value = numericValue.toFixed(2);

        return value;
    }
});

// GLOBAL FUNCTIONS

// Generate month-year options
function generateMonthYearOptions(years = 3) {
    const now            = new Date();
    const endYear        = now.getFullYear();
    const endMonth       = now.getMonth();
    const totalMonths    = years * 12;

    return Array.from({ length: totalMonths }, (_, index) => {
        const date = new Date(endYear, endMonth - index);
        return {
            value   : date.toISOString().slice(0, 7),
            label   : date.toLocaleString('default', { month: 'long', year: 'numeric' }),
            monthInt: date.getMonth() + 1,
            yearInt : date.getFullYear()
        };
    });
}

// Check month-year options
function checkSelectedOption(selectedValue, options) {
    const { monthInt, yearInt } = options.find(option => option.value == selectedValue) ?? {};
    return monthInt && yearInt ? { monthInt, yearInt } : '';
}


