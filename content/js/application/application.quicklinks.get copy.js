

export const getQuickLinks = () => globalRequest.get(globalURI.buildURI('get-user-quicklinks', "start"));