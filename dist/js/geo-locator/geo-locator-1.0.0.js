const GeoLocator = (() => {
    /**
     * Get the current position of the user.
     * @param {Function} onSuccess - Callback function executed on successful retrieval of location.
     * @param {Function} onError - Callback function executed on error (optional).
     * @param {Object} options - Geolocation options (optional).
     */
    const getCurrentPosition = (onSuccess, onError = defaultErrorHandler, options = { enableHighAccuracy: true }) => {
        if ("geolocation" in navigator) {
            navigator.geolocation.getCurrentPosition(onSuccess, onError, options);
        } else {
            handleUnsupportedDevice(onError);
        }
    };

    /**
    * Get the current position of the user and resolve it to a human-readable location name.
    * @param {Function} onSuccess - Callback function executed on successful retrieval of location name.
    * @param {Function} onError - Callback function executed on error (optional).
    * @param {Object} options - Geolocation options (optional).
    * @param {boolean} [options.enableHighAccuracy=true] - Whether to enable high-accuracy mode.
    */
    const getCurrentPositionName = (onSuccess, onError = defaultErrorHandler, options = { enableHighAccuracy: true }) => {
        if ("geolocation" in navigator) {
            navigator.geolocation.getCurrentPosition(
                (position) => {
                    const { latitude, longitude } = position.coords;

                    getLocationNameFromCoordinates(latitude, longitude,
                        (data) => {
                            onSuccess(data, latitude, longitude);
                        },
                        (error) => {
                            onError(error);
                        }
                    );
                },
                onError,
                options
            );
        } else {
            handleUnsupportedDevice(onError);
        }
    };

    /**
     * Get the location name from the coordinates (latitude and longitude).
     * @param {number} latitude - Latitude of the location.
     * @param {number} longitude - Longitude of the location.
     * @param {Function} onSuccess - Callback function executed on successful retrieval of location name.
     * @param {Function} onError - Callback function executed on error (optional).
     */
    const getLocationNameFromCoordinates = (latitude, longitude, onSuccess, onError = defaultErrorHandler) => {
        // Nominatim (OpenStreetMap) API URL
        const geocodeUrl = `https://nominatim.openstreetmap.org/reverse?lat=${latitude}&lon=${longitude}&format=json`;

        // Fetching the location data
        fetch(geocodeUrl)
            .then(response => response.json())
            .then(data => {
                if (data.error) {
                    onError("Error retrieving location from geocoding API.");
                } else {
                    // Extracting location name
                    const locationName = data.display_name;

                    // Calling onSuccess with location name
                    onSuccess(locationName);
                }
            })
            .catch(error => {
                console.error("Error fetching geolocation data:", error);
                onError(error);
            });
    };

    /**
     * Default error handler for geolocation errors.
     * @param {Object} error - Error object containing code and message.
     */
    const defaultErrorHandler = (error) => {
        switch (error.code) {
            case error.PERMISSION_DENIED:
                console.error("User denied the request for Geolocation.");
                break;
            case error.POSITION_UNAVAILABLE:
                console.error("Location information is unavailable.");
                break;
            case error.TIMEOUT:
                console.error("The request to get user location timed out.");
                break;
            default:
                console.error("An unknown error occurred.");
                break;
        }
    };

    /**
     * Calculate distance between two geographic coordinates using the Haversine formula.
     * @param {Object} pointA - First point { latitude, longitude }.
     * @param {Object} pointB - Second point { latitude, longitude }.
     * @returns {number} Distance in meters.
     */
    const calculateDistance = (pointA, pointB) => {
        const toRadians = (degrees) => (degrees * Math.PI) / 180;

        const R = 6371000; // Earth's radius in meters
        const dLat = toRadians(pointB.latitude - pointA.latitude);
        const dLon = toRadians(pointB.longitude - pointA.longitude);

        const lat1 = toRadians(pointA.latitude);
        const lat2 = toRadians(pointB.latitude);

        const a =
            Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

        return R * c; // Distance in meters
    };

    /**
    * Handle unsupported devices with a custom error.
    * @param {Function} onError - Callback to handle the error.
    */
    const handleUnsupportedDevice = (onError) => {
        console.error("Geolocation is not supported by your browser or device.");
        const unsupportedError = new Error("Geolocation is not supported by your browser or device.");
        unsupportedError.code = "UNSUPPORTED_DEVICE";
        onError(unsupportedError);
    };

    return {
        getCurrentPosition,
        getCurrentPositionName,
        getLocationNameFromCoordinates,
        calculateDistance,
    };
})();

// Export the library for use in module-based environments (optional).
// Uncomment the following line if you need it in a Node.js or module environment.
// export default GeoLocator;
