import { saveQuickLink, removeQuickLink } from "./application.quicklinks.create.js";
import { getQuickLinks } from "./application.quicklinks.get.js";

const urlPath = window.location.pathname;

// don't fetch quicklins if page is home.
if (urlPath !== "/" || urlPath !== "/start") {
    const quickLinkResponse = await $.callAsync(getQuickLinks);

    setupQuickLinkPage(quickLinkResponse);
}


function setupQuickLinkPage(response) {
    if (!response) return;

    const data           = response.data;
    const quickLinkBtn   = $("#btn-set-quick-link");

    setPageQuickLinkState(data);

    quickLinkBtn.off().click(async function (e) {
        const isQuickLink    = !quickLinkBtn.is(":checked"); // invert to get previous state
        const label          = $(this).attr("data-quick-link-name");
        const icon           = $(this).attr("data-quick-link-icon");
        const linkUrl        = $(this).attr("data-quick-link-url");
        let message          = '';

        if (!isQuickLink) {
            const params = {
                label,
                icon,
                linkUrl
            }

            message = 'Remove from Quick Links';
            tooltipMessage(message);

            await $.callAsync(saveQuickLink, params);
        } else {
            message = 'Add to Quick Links';
            tooltipMessage(message);

            await $.callAsync(removeQuickLink, linkUrl, label);
        }
    })
}

function setPageQuickLinkState(data) {
    const quickLinkBtn       = $("#btn-set-quick-link");
    const isPageBookmarked   = data.find(p => p.PageUrl === urlPath);
    const label              = quickLinkBtn.attr("data-quick-link-name");
    const message            = `Maximum number of Quick Links reached. To add ${label} as a Quick Link, remove a link in the Start Page`;

    if (data.length === 0) return;

    if (isPageBookmarked) {
        $("#btn-set-quick-link").prop("checked", true);
    } else if (data.length === 6) {
        quickLinkBtn.prop('disabled', true);
        tooltipMessage(message, 'disabled');
    }
}

function tooltipMessage(message, state = '') {
    const labelTooltip = $("label[for=btn-set-quick-link]");
    const dvTooltip = $("#dv-set-quicklink");

    if (state == 'disabled') {
        dvTooltip.attr("data-toggle", 'tooltip');
        dvTooltip.attr("data-bs-original-title", message);
        dvTooltip.attr("aria-label", message);
    }
    labelTooltip.removeAttr('title');
    labelTooltip.attr("data-bs-original-title", message);
    labelTooltip.attr("aria-label", message);
}