import { saveDirectUrl, removeDirectUrl } from "./application.default-url.create.js";
import { getDirectUrl } from "./application.default-url.get.js";

(async function () {
    const urlPath               = window.location.pathname;

    let directUrl = await $.callAsync(getDirectUrl);

    $(document).ready(() => {
        setDefaultUrlHtml();
        const defaultUrlBtn = $("#btn-set-default-url");
        let message = '';

        // Check if there's already a default Page set
        let hasDefaultUrl = directUrl.data && directUrl.data.RedirectUrl && directUrl.data.RedirectUrl.trim() !== '';
        let isCurrentPageDefault = hasDefaultUrl && (urlPath === directUrl.data.RedirectUrl);

        if (isCurrentPageDefault) {
            // Current page is the default Page
            message = 'Remove as Default Page';
            tooltipMessage(message);
            defaultUrlBtn.prop('checked', true);
            defaultUrlBtn.prop('disabled', false);
        } else if (hasDefaultUrl) {
            // Another page is set as default Page - show override option
            const defaultPageName = formatPageNameFromUrl(directUrl.data.RedirectUrl);
            message = `Set as Default Page`;
            tooltipMessage(message);
            defaultUrlBtn.prop('checked', false);
            defaultUrlBtn.prop('disabled', false);
        } else {
            // No default Page is set
            message = 'Set as Default Page';
            tooltipMessage(message);
            defaultUrlBtn.prop('checked', false);
            defaultUrlBtn.prop('disabled', false);
        }

        defaultUrlBtn.off().change(async function (e) {
            const isDefaultUrl = defaultUrlBtn.is(":checked");
            const linkUrl = urlPath;
            let message = '';

            if (isDefaultUrl) {
                // Check if there's already a default URL set (and it's not current page)
                if (hasDefaultUrl && !isCurrentPageDefault) {
                    // Prevent the checkbox from being checked until confirmed
                    e.preventDefault();
                    defaultUrlBtn.prop('checked', false);

                    // Show confirmation popover
                    const currentDefaultPageName = formatPageNameFromUrl(directUrl.data.RedirectUrl);
                    const currentPageName = formatPageNameFromUrl(urlPath);
                    showOverridePopover($("label[for=btn-set-default-url]"), currentDefaultPageName, currentPageName, async () => {
                        // User confirmed - check the button and save default
                        defaultUrlBtn.prop('checked', true);
                        const params = { linkUrl };
                        await $.callAsync(saveDirectUrl, params);
                        // Refresh directUrl to get the latest state
                        directUrl = await $.callAsync(getDirectUrl);
                        message = 'Remove as Default Page';
                        tooltipMessage(message);
                        // Update state variables
                        hasDefaultUrl = directUrl.data && directUrl.data.RedirectUrl && directUrl.data.RedirectUrl.trim() !== '';
                        isCurrentPageDefault = hasDefaultUrl && (urlPath === directUrl.data.RedirectUrl);
                    }, () => {
                        // User cancelled - keep button unchecked
                        defaultUrlBtn.prop('checked', false);
                    });
                } else {
                    // No existing default or current page is default - save directly
                    const params = { linkUrl };
                    await $.callAsync(saveDirectUrl, params);
                    // Refresh directUrl to get the latest state
                    directUrl = await $.callAsync(getDirectUrl);
                    message = 'Remove as Default Page';
                    tooltipMessage(message);
                    // Update state variables
                    hasDefaultUrl = directUrl.data && directUrl.data.RedirectUrl && directUrl.data.RedirectUrl.trim() !== '';
                    isCurrentPageDefault = hasDefaultUrl && (urlPath === directUrl.data.RedirectUrl);
                }
            } else {
                // Remove default
                await $.callAsync(removeDirectUrl);
                // Refresh directUrl to get the latest state
                directUrl = await $.callAsync(getDirectUrl);
                message = 'Set as Default URL';
                tooltipMessage(message);
                // Update state variables
                hasDefaultUrl = directUrl.data && directUrl.data.RedirectUrl && directUrl.data.RedirectUrl.trim() !== '';
                isCurrentPageDefault = hasDefaultUrl && (urlPath === directUrl.data.RedirectUrl);
            }
        });
    });

    function showOverridePopover(element, currentDefaultPage, newDefaultPage, onConfirm, onCancel) {
        const popoverId = 'overrideDefaultUrlPopover';

        // Dismiss any existing popovers
        if (element.data('bs.popover')) {
            element.popover('dispose');
        }

        const popoverContent = `
            <div id="${popoverId}">
                <p class="mb-4">
                    <small><strong class="text-primary-emphasis">${currentDefaultPage}</strong> is your current default page. Set <strong class="text-primary-emphasis">${newDefaultPage}</strong> as the new default?</small>
                </p>
                <div class="d-flex gap-3">
                    <button id="cancelOverride" type="button" class="btn btn-sm btn-subtle-secondary py-0 ms-auto">Cancel</button>
                    <button id="confirmOverride" type="button" class="btn btn-sm btn-primary py-0">Set as Default</button>
                </div>
            </div>
        `;

        // Initialize popover with better positioning
        const popover = new bootstrap.Popover(element[0], {
            content: popoverContent,
            html: true,
            placement: 'bottom',
            trigger: 'manual',
            container: 'body',
            sanitize: false,
            offset: [0, 0],
            template: '<div class="popover" role="tooltip" style="margin-inline-start:6px !important;"><div class="popover-arrow"></div><div class="popover-body"></div></div>'
        });

        // Show popover
        popover.show();

        // Wait for popover to be rendered, then attach event handlers
        setTimeout(() => {
            // Handle confirm button
            $(document).on('click', `#${popoverId} #confirmOverride`, function (e) {
                e.preventDefault();
                e.stopPropagation();
                popover.dispose();
                onConfirm();
                $(document).off('click', `#${popoverId} #confirmOverride`);
                $(document).off('click', `#${popoverId} #cancelOverride`);
                $(document).off('click.popover-outside');
            });

            // Handle cancel button
            $(document).on('click', `#${popoverId} #cancelOverride`, function (e) {
                e.preventDefault();
                e.stopPropagation();
                popover.dispose();
                onCancel();
                $(document).off('click', `#${popoverId} #confirmOverride`);
                $(document).off('click', `#${popoverId} #cancelOverride`);
                $(document).off('click.popover-outside');
            });

            // Handle click outside to cancel
            $(document).on('click.popover-outside', function (e) {
                if (!$(e.target).closest('.popover, #btn-set-default-url, label[for="btn-set-default-url"]').length) {
                    popover.dispose();
                    onCancel();
                    $(document).off('click', `#${popoverId} #confirmOverride`);
                    $(document).off('click', `#${popoverId} #cancelOverride`);
                    $(document).off('click.popover-outside');
                }
            });
        }, 50);
    }

    function formatPageNameFromUrl(url) {
        if (!url) return 'Unknown Page';

        // Remove leading slash and split by '/'
        const segments = url.replace(/^\//, '').split('/');

        // Take the last segment for the page name
        const pageName = segments[segments.length - 1] || segments[segments.length - 2] || 'Unknown Page';

        // Convert kebab-case or snake_case to Title Case
        return pageName
            .replace(/[-_]/g, ' ')
            .split(' ')
            .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
            .join(' ');
    }

    function tooltipMessage(message, state = '') {
        const labelTooltip = $("label[for=btn-set-default-url]");
        const dvTooltip = $("#dv-set-default-url");

        if (state === 'disabled') {
            dvTooltip.attr({
                "data-toggle": "tooltip",
                "data-bs-original-title": message,
                "aria-label": message
            });
            labelTooltip.addClass('disabled text-muted');
        } else {
            labelTooltip.removeClass('disabled text-muted');
        }

        labelTooltip.removeAttr('title');
        labelTooltip.attr({
            "data-bs-original-title": message,
            "aria-label": message
        });
    }

    function setDefaultUrlHtml() {
        const quickLinkInput = $('#btn-set-quick-link');
        if (!quickLinkInput.length) return;

        const quickLinkData = quickLinkInput.data();
        const html = `<div id="dv-set-default-url" class="ms-3">
                            <input id="btn-set-default-url" class="btn-check" type="checkbox" autocomplete="off" data-default-url-name="${quickLinkData.quickLinkName}" data-default-url-icon="${quickLinkData.quickLinkIcon}">
                            <label class="btn text-primary px-0" for="btn-set-default-url" title="Set as Default Page" data-toggle="tooltip">
                                <span class="vi-regular vi-home-dash"></span>
                                <span class="vi-solid vi-home-dash"></span>
                            </label>
                        </div>`;

        const quickLinkContainer = $('#dv-set-quicklink');
        if (!quickLinkContainer.length) return;
        quickLinkContainer.before(html);
    }
})();