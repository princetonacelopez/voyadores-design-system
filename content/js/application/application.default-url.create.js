export const saveDirectUrl = (params) => {
    const _default = {
        linkUrl : ""
    }

    const parameters = Object.assign(_default, params);
    const errors = validateDefaultUrlParams(parameters);
    if (errors)
        return Promise.reject(new Error(errors));

    return globalRequest.post(buildUrl("save-direct-url"), buildDefaultUrl(parameters));
}

export const removeDirectUrl = () => globalRequest.post(buildUrl("remove-default-url"));

const validateDefaultUrlParams = (params) => {
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


const buildDefaultUrl = (params) => {
    return {
        directUrl     : params.linkUrl,
    }
}

const buildUrl = (action) => `${window.location.origin}/user/${action}`;
