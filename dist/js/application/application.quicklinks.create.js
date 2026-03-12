
export const saveQuickLink = (params) => {
    const _default = {
        label: "",
        icon: "",
        linkUrl: ""
    }

    const parameters = Object.assign(_default, params);
    const errors = validateQuicklinkParams(parameters);

    if (errors)
        return Promise.reject(new Error(errors));

    return globalRequest.post(buildUrl("save-quicklink"), buildQuicklinkModel(parameters));
}

export const removeQuickLink = (pageUrl, pageLabel) => globalRequest.post(buildUrl("remove-quicklink"), { pageUrl, pageLabel });

const buildQuicklinkModel = (params) => {
    return {
        PageLabel: params.label,
        PageUrl: params.linkUrl,
        PageIcon: params.icon
    }
}

const validateQuicklinkParams = (params) => {
    let html = '';
    const errors = [];

    if (params.label == "")
        errors.push("- Page label not found.");

    if (params.icon === "")
        errors.push("- Icon not found.");

    if (params.linkUrl == "")
        errors.push("- Page url not found.");

    if (errors.length > 0)
        html = errors.join('<br />');

    return html;
}

const buildUrl = (action) => `${window.location.origin}/start/${action}`;