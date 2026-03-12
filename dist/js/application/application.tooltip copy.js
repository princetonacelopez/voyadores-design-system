$(function () {

    if (!$.isFunction($.fn.tooltip)) return;

    $("body").on('mouseenter', '[data-toggle="tooltip"]', function () {
        const element = $(this);
        // Checks if the element has a class of `text-truncate`
        if (element.hasClass("text-truncate")) {

            const title = element.attr("title") || element.attr("data-bs-original-title");

            element.data("title", title); // Saves the original title in the element internally

            const isTextTruncated = element.prop("scrollWidth") > element.prop("clientWidth");

            // Only show tooltip if text is truncated in the UI
            if (isTextTruncated) {
                element.attr("data-bs-original-title", element.data("title"));
                element.tooltip({ trigger: "hover", container: "body" })
                element.tooltip('toggle');
            } else {
                element.removeAttr("title");
                element.removeAttr("data-bs-original-title");
            }

        } else { // Any element that is not truncatable will show the tooltip as is
            element.tooltip({ trigger: "hover", container: "body" })
            element.tooltip('toggle');
        }

    });

    // Function to check if device is mobile
    const isMobile = () => window.innerWidth < 992;

    // Initialize tooltips
    const initTooltips = () => {
        // Remove any existing tooltips
        $('[data-toggle="tooltip"], [data-bs-toggle="tooltip"]').tooltip('dispose');

        // Only initialize tooltips on desktop
        if (!isMobile()) {
            $('[data-toggle="tooltip"], [data-bs-toggle="tooltip"]').tooltip({
                trigger: 'hover focus'  // Ensure tooltip only shows on hover/focus, not click
            });
        }
    };

    // Remove tooltip data and instances on mobile before button click
    $("body").on('mousedown touchstart', '[data-toggle="tooltip"], [data-bs-toggle="tooltip"]', function () {
        if (isMobile()) {
            // Store the original title
            const originalTitle = $(this).attr('title') || $(this).attr('data-bs-title');

            // Temporarily remove tooltip attributes
            $(this).tooltip('dispose')
                .removeAttr('data-bs-original-title')
                .removeAttr('aria-describedby');

            // Restore original title if needed
            if (originalTitle) {
                $(this).attr('title', originalTitle);
            }
        }
        else {
            $(this).tooltip('hide');
        }
    });

    // Handle window resize
    let resizeTimer;
    $(window).on('resize', () => {
        clearTimeout(resizeTimer);
        resizeTimer = setTimeout(initTooltips, 250);
    });

    // Initial setup
    $(document).ready(initTooltips);

});