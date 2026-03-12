export const getQuickLinks = () => globalRequest.get(globalURI.buildURI('get-user-quicklinks', "start"));

export const isPageQuickLink = (pageUrl) => globalRequest.get(globalURI.buildURI('is-page-quicklink', "start", { pageUrl: pageUrl }));