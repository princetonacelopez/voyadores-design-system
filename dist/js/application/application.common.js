$(function () {
    const fileViewer = $('#dv-file-viewer').length;
    let viewportScalable = $('meta[name="viewport"]');
    let currentOpenDropdown = null;

    if (fileViewer) {
        viewportScalable.replaceWith(`<meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover">`);
    }

    // Prevent multiple selectize dropdown open
    if (typeof $.fn.selectize !== 'undefined') {
        // Prevent multiple selectize dropdown open
        $.fn.selectize.defaults = $.extend($.fn.selectize.defaults, {
            onDropdownOpen: function () {
                if (currentOpenDropdown && currentOpenDropdown !== this) {
                    currentOpenDropdown.close();
                    currentOpenDropdown.blur();
                }
                currentOpenDropdown = this;
            }
        });

        // Close dropdown when clicking outside
        $(document).on('click', function (event) {
            if (!$(event.target).closest('.selectize-control').length) {
                if (currentOpenDropdown) {
                    currentOpenDropdown.close();
                    currentOpenDropdown.blur();
                    currentOpenDropdown = null;
                }
            }
        });
    }

    $('[data-bs-toggle="popover"]').each(function () { $(this).popover(); });

    // Register service worker
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('../../../service-worker.js')
            .catch(function () {
                console.error('Service Worker registration failed');
            });
    }

    // Remove aria-hidden on modals
    $(document).on('hidden.bs.modal', function (event) {
        const $modal = $(event.target);
        if ($modal.attr('aria-hidden')) {
            $modal.removeAttr('aria-hidden');
        }
    });
});