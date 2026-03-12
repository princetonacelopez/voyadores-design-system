export default function loadIndicators() {
    const cacheKey      = "visualIndicators";
    const maxAge        = 3 * 24 * 60 * 60 * 1000; // 3 days
    const indicator     = new Indicator();

    // Try to read a single JSON entry { time: <ms>, value: <object> }
    try {
        const cached = localStorage.getItem(cacheKey);

        if (cached) {
            const cachedObj     = JSON.parse(cached);
            const hasValidAge   = (Date.now() - cachedObj.time) < maxAge && cachedObj.value;

            if (cachedObj && cachedObj.time && hasValidAge) {
                // cachedObj.value expected to be the JSON payload with .features
                indicator.render(cachedObj.value.features);
                return;
            }
        }
    } 
    catch (e) {
        try { localStorage.removeItem(cacheKey); } catch (er) {}
    }

    // Fetch and cache as a single entry
    $.getJSON("/home/user/get-visual-indicators")
        .then((data) => {
            try {
                // getJSON typically returns parsed JSON; if it's a string, parse it
                const jsonVal   = (typeof data === 'string') ? JSON.parse(data) : data;
                const cacheObj  = { time: Date.now(), value: jsonVal };
                
                localStorage.setItem(cacheKey, JSON.stringify(cacheObj));
                indicator.render(jsonVal.features);
            } catch (err) {
                console.error('[Visual Indicator] Failed to parse response', err);
            }
        })
        .catch(() => {
            console.error("[Visual Indicator] Failed to load Visual Indicators JSON.");
        });
}