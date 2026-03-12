$(function () {
    const minimumSupportedBrowsers = [
        { name: "Chrome", version: 126 },
        { name: "CriOS", version: 126 },    // Chrome for iOS
        { name: "Safari", version: 16 },
        { name: "Firefox", version: 128 },
        { name: "FxiOS", version: 128 },    // Firefox for iOS
        { name: "Edge", version: 126 },
        { name: "EdgA", version: 126 },     // Firefox for Android
        { name: "EdgiOS", version: 126 },   // Firefox for iOS
    ];

    const viewportWidth = $(window).width();
    const alert         = buildAlertDetails();

    function getTimezone() {
        const date       = new Date();
        const utcOffset  = date.getTimezoneOffset();

        return utcOffset;
    }

    function getBrowserDetails() {
        const unsupportedBrowsers    = ['OPR', 'SamsungBrowser', 'OPiOS', 'OPX', 'Presto', 'OPT']
        const userAgent              = navigator.userAgent;
        let browserName              = '';
        let browserVersion           = '';

        /* Checking for Edge */
        if (userAgent.indexOf('Edg') > -1) {
            browserName      = 'Edge';
            browserVersion   = userAgent.match(/Edg\/([0-9.]+)/)[1];
        }

        /* Checking for Edge in Android */
        if (userAgent.indexOf('EdgA') > -1) {
            browserName      = 'EdgA';
            browserVersion   = userAgent.match(/EdgA\/([0-9.]+)/)[1];
        }

        /* Checking for Edge in iOS*/
        if (userAgent.indexOf('EdgiOS') > -1) {
            browserName      = 'EdgiOS';
            browserVersion   = userAgent.match(/EdgiOS\/([0-9.]+)/)[1];
        }

        /* Checking for Safari */
        if (userAgent.indexOf('Chrome') === -1 && userAgent.indexOf('Safari') > -1) {
            browserName      = 'Safari';
            browserVersion   = userAgent.match(/Version\/([0-9.]+)/)[1];
        }

        /* Checking for Firefox */
        if (userAgent.indexOf('Firefox') > -1) {
            browserName      = 'Firefox';
            browserVersion   = userAgent.match(/Firefox\/([0-9.]+)/)[1];
        }

        /* Checking for Firefox in iOS */
        if (userAgent.indexOf('FxiOS') > -1) {
            browserName      = 'FxiOS';
            browserVersion   = userAgent.match(/FxiOS\/([0-9.]+)/)[1];
        }

        /* Checking for Chrome in iOS */
        if (userAgent.indexOf('CriOS') > -1 && userAgent.indexOf('Safari') > -1) {
            browserName      = 'CriOS';
            browserVersion   = userAgent.match(/CriOS\/([0-9.]+)/)[1];
        }

        /* Checking for Chrome */
        if (userAgent.indexOf('Chrome') > -1 && userAgent.indexOf('Safari') > -1) {
            browserName      = 'Chrome';
            browserVersion   = userAgent.match(/Chrome\/([0-9.]+)/)[1];
        }

        /* Special Handling for Unsupported Browsers */
        if (unsupportedBrowsers.some(browser => userAgent.includes(browser))) {
            browserName      = 'Unsupported Browser';
            browserVersion   = 0;
        }

        return { browserName, browserVersion: parseFloat(browserVersion) };
    }

    function getTimezoneName() {
        return Intl.DateTimeFormat().resolvedOptions().timeZone;
    }

    function getTimezoneNameUTC() {
        const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;

        const dtf = new Intl.DateTimeFormat('en-US', {
            timeZone,
            timeZoneName: 'shortOffset',
        });

        const parts  = dtf.formatToParts(new Date());
        const offset = parts.find(p => p.type === 'timeZoneName')?.value.replace('GMT', 'UTC');

        return `${timeZone} (${offset})`;
    }

    function getTimezoneDate() {
        return new Date().toLocaleString("en-US", { timeZone: getTimezoneName() });
    }

    function setCookie(name, value) {
        const expirationDate = new Date();
        expirationDate.setFullYear(expirationDate.getFullYear() + 1);

        const appDomain = getAppDomain(); // Make sure this function exists or remove domain if not needed

        document.cookie = `${name}=${encodeURIComponent(value)}; expires=${expirationDate.toUTCString()}; path=/; domain=${appDomain}`;
    }

    // Set the timezone name and timezone-based date
    setCookie("timezone", getTimezoneNameUTC());
    setCookie("timezoneDate", getTimezoneDate());

    // Refresh timezoneDate cookie every 1 minute
    setInterval(() => {
        setCookie("timezoneDate", getTimezoneDate());
    }, 60000); // 60000 ms = 1 minute

    function getAppDomain() {
        const hostname = window.location.hostname;
        const parts = hostname.split('.');

        // Check if there is a subdomain (more than one part)
        if (parts.length > 1)
            return parts.slice(-2).join('.'); // Remove the subdomain and return the main domain

        // No subdomain, return the original hostname
        return hostname;
    }

    function getBrowserCompatibility() {
        const { browserName, browserVersion }    = getBrowserDetails();
        const compatibleBrowser                  = minimumSupportedBrowsers.find((browser) => browser.name === browserName);

        let hasCompatibleBrowser         = false;
        let hasSupportedBrowserVersion   = false;

        if (compatibleBrowser && browserName != 'Unsupported Browser') {
            hasCompatibleBrowser         = true;
            hasSupportedBrowserVersion   = browserVersion >= compatibleBrowser.version ? true : false;
        } else {
            hasCompatibleBrowser         = false;
        }

        return { hasCompatibleBrowser, hasSupportedBrowserVersion };
    }

    function buildAlertBanner(alertMessage, icon, hasCTA) {
        const seeSupportedBrowsersBtn    = hasCTA ? `<button class="btn-supported-browser btn border-black bg-black text-white flex-shrink-0 d-none d-lg-block">See Supported Browsers</button>` : '';
        const desktopViewMessage         = alertMessage;
        const mobileViewMessage          = alertMessage.split('.')[0];

        return `
            <div id="dv-banner-alert" class="position-fixed top-0 left-0 bg-warning text-black p-5 w-100">
                <div class="d-flex flex-column flex-md-row justify-content-center align-items-center gap-5 h-100">
                    <div id="dv-desktop-message" class="d-none d-lg-flex d-flex-row gap-4 align-items-center justify-content-start">
                        <div class="mt-1 icon-container">
                            ${icon}
                        </div>
                        <div class="hstack gap-8">
                            <span id="spn-desktop-message" class="m-0 align-middle">${desktopViewMessage}</span>
                            ${seeSupportedBrowsersBtn}
                        </div>
                    </div>
                    <div id="dv-mobile-message" class="d-flex d-flex-row gap-4 align-items-center justify-content-start d-lg-none">
                        <div class="mt-1 align-self-start align-self-lg-center">
                            ${icon}
                        </div>
                        <div class="">
                            <span id="spn-mobile-message" class="m-0 align-middle text-balance">${mobileViewMessage}</span>
                            <button id="btn-open-alert" class="btn bg-transparent text-black p-1">
                                <span class="vi-regular vi-info-circle fs-4"></span>
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    function buildAlertModalContent(alertMessage, icon, hasCTA) {
        const modalAlertHeader   = $('#h3-alert-header');
        const modalAlertBody     = $('#p-alert-body');
        const modalAlertImage    = $('#img-alert-image');
        const dismissibleBtn     = $('#btn-dismissible');
        const seeSuppBrowsersBtn = $('#btn-see-supported-browsers');
        const splittedMessage    = alertMessage.split('. ');

        if (!hasCTA) {
            dismissibleBtn.text('Okay');
            seeSuppBrowsersBtn.addClass('d-none');
        }
        else {
            dismissibleBtn.text('Cancel');
            seeSuppBrowsersBtn.removeClass('d-none');
        }

        modalAlertHeader.text(splittedMessage[0]);
        modalAlertBody.text(splittedMessage.slice(1).join('. '));
        modalAlertImage.attr('alt', splittedMessage[0]);
    }

    function buildAlertDetails() {
        const hasSupportedTimezone = getTimezone() == '-480';
        const { hasCompatibleBrowser, hasSupportedBrowserVersion } = getBrowserCompatibility();

        let desktopMessage   = ''
        let mobileMessage    = ''
        let icon             = ''
        let hasCta           = false;
        let cssClass         = '';

        if (!hasSupportedTimezone && !hasCompatibleBrowser) {
            desktopMessage   = 'Unsupported timezone and browser detected. Adjust your settings to the Philippine time zone and switch to a Voyadores-supported browser to prevent issues.';
            mobileMessage    = 'Unsupported timezone and browser detected. Using a different time zone can lead to data issues, while an unsupported browser may result in broken features. To prevent these, adjust your settings to the Philippine Time Zone (UTC+8) and switch to a Voyadores-supported browser.';
            icon             = '<span class="icon vi-solid vi-triangle-exclamation icon-timezone-browser"></span>';
            hasCta           = true;
            cssClass         = 'unsupported-timezone-browser';
        }
        else if (!hasSupportedTimezone && !hasSupportedBrowserVersion) {
            desktopMessage   = 'Unsupported timezone and browser version detected. Adjust your settings to the Philippine time zone and update to a Voyadores-supported browser version to prevent issues.';
            mobileMessage    = 'Unsupported timezone and browser version detected. Using a different time zone can lead to data issues, while an outdated browser may result in broken features. To prevent these, adjust your settings to the Philippine Time Zone (UTC+8) and update to a Voyadores-supported browser version.';
            icon             = '<span class="icon vi-solid vi-triangle-exclamation icon-timezone-browser-version"></span>';
            hasCta           = true;
            cssClass         = 'unsupported-timezone-browser-version';
        }
        else if (!hasSupportedTimezone) {
            desktopMessage   = 'Unsupported timezone detected. Adjust your time settings to the Philippine time zone to prevent any issues.';
            mobileMessage    = 'Unsupported timezone detected. Using a different time zone may cause syncing errors, incorrect timestamps, and data issues. To prevent these issues with Voyadores, set your device to the Philippine Time Zone (UTC+8).';
            icon             = '<svg class="icon" width="24" height="24" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"> <path fill-rule="evenodd" clip-rule="evenodd" d="M1.25 12C1.25 6.073 6.072 1.25 12 1.25C17.928 1.25 22.75 6.073 22.75 12C22.75 12.7576 22.6712 13.4971 22.5214 14.2108C22.4814 14.4015 22.2449 14.4671 22.0975 14.3396C21.8383 14.1153 21.5579 13.9148 21.2598 13.7415C21.1661 13.687 21.1146 13.5806 21.1319 13.4736C21.1635 13.2781 21.1889 13.0805 21.208 12.881C20.958 12.974 20.707 13.128 20.514 13.346V13.346C20.5002 13.3615 20.4782 13.3664 20.4588 13.359C20.2071 13.2631 19.9465 13.1851 19.6787 13.1266C19.3723 13.0597 19.082 12.9143 18.9025 12.6571C18.7115 12.3834 18.5047 12.0434 18.28 11.629C17.4778 10.1499 17.8658 9.31313 18.2573 8.46891C18.3713 8.22293 18.4857 7.97632 18.571 7.71301C18.76 7.15001 18.534 6.08799 18.209 5.16299C17.027 4.08899 15.573 3.31301 13.957 2.96301C13.724 3.45101 13.261 3.84499 12.766 4.00699C11.2092 4.51729 11.1931 5.86334 11.179 7.0351C11.1675 7.99195 11.1574 8.83258 10.311 9.00699C9.99888 9.07091 9.57656 8.84134 9.15722 8.61338C8.7368 8.38484 8.31937 8.15792 8.01898 8.23001C7.64098 8.31901 6.88099 8.977 7.58899 9.711C8.13253 10.2744 8.16493 10.6165 8.19896 10.9759C8.21814 11.1785 8.23785 11.3867 8.34998 11.643C8.67298 12.354 9.65099 12.437 10.818 12.304C11.973 12.16 12.511 12.111 13.333 12.967C13.6529 13.3002 13.8231 13.6871 13.9797 14.0434C14.0404 14.1815 14.0991 14.3149 14.1637 14.4389C14.2828 14.6676 14.2825 14.9601 14.126 15.1651C13.4196 16.0902 13 17.2461 13 18.5C13 19.716 13.3947 20.8399 14.0629 21.7505C14.2934 22.0647 14.1589 22.5395 13.7746 22.6036C13.1972 22.6999 12.6043 22.75 12 22.75C6.072 22.75 1.25 17.927 1.25 12ZM3.27399 8.95999C2.93999 9.91399 2.75 10.934 2.75 12C2.75 16.8 6.42602 20.756 11.111 21.205C11.165 20.525 11.039 19.84 10.821 19.52C10.5097 19.0573 9.98962 18.7857 9.48627 18.5228C8.79304 18.1608 8.13156 17.8153 8.091 17.01C8.06043 16.4028 8.07946 16.0151 8.09476 15.7034C8.11448 15.3016 8.128 15.0262 8.021 14.57C7.97318 14.369 7.62939 14.1943 7.14534 13.9484C5.89839 13.3151 3.72061 12.2088 3.27399 8.95999Z"/> <path fill-rule="evenodd" clip-rule="evenodd" d="M18.5 14C16.0147 14 14 16.0147 14 18.5C14 20.9853 16.0147 23 18.5 23C20.9853 23 23 20.9853 23 18.5C23 16.0147 20.9853 14 18.5 14ZM20.9885 20.9885C20.9228 21.0542 20.8364 21.0875 20.75 21.0875C20.6636 21.0875 20.5772 21.0547 20.5115 20.9885L18.2615 18.7385C18.198 18.6751 18.1625 18.5891 18.1625 18.5V15.3516C18.1625 15.1653 18.3137 15.0141 18.5 15.0141C18.6863 15.0141 18.8375 15.1653 18.8375 15.3516V18.36L20.9885 20.511C21.1204 20.6433 21.1204 20.8567 20.9885 20.9885Z"/> </svg>'
            hasCta           = false;
            cssClass         = 'unsupported-timezone';
        }
        else if (!hasCompatibleBrowser) {
            desktopMessage   = 'Unsupported browser detected. Switch to a Voyadores-supported browser to prevent any issues.';
            mobileMessage    = 'Unsupported browser detected. Using an unsupported browser may cause incompatibility, broken features, or data issues. For a secure and seamless experience, switch to a Voyadores-supported browser.';
            icon             = '<svg class="icon" width="24" height="24" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"> <path d="M9.83026 21.76C8.02026 18.97 6.98026 15.83 6.83026 12.75H2.03027C2.36027 17.19 5.59026 20.82 9.83026 21.76Z" /> <path d="M2.03027 11.25C2.36027 6.81 5.59026 3.17999 9.83026 2.23999C8.02026 5.02999 6.98026 8.17 6.83026 11.25H2.03027Z" /> <path d="M11.8003 2H12.2003L12.5003 2.42999C14.4003 5.12999 15.5103 8.23 15.6703 11.25H8.33026C8.49026 8.23 9.60028 5.12999 11.5003 2.42999L11.8003 2Z" /> <path d="M11.5003 21.57C9.60028 18.87 8.49026 15.77 8.33026 12.75H15.6703C15.6411 13.3016 15.5802 13.8558 15.4885 14.4097L11.9929 20.4644C11.8026 20.794 11.7182 21.1439 11.7221 21.4841C11.7233 21.5829 11.5568 21.6511 11.5003 21.57Z" /> <path d="M20.4806 15.6655C20.6797 16.0103 21.177 15.9924 21.3214 15.6213C21.6719 14.7204 21.8955 13.756 21.9703 12.75H18.0027C18.0026 12.75 18.0026 12.75 18.0027 12.75C18.5404 12.8523 19.0421 13.1739 19.3541 13.7144L20.4806 15.6655Z" /> <path d="M14.1703 2.23999C18.4103 3.17999 21.6403 6.81 21.9703 11.25H17.1703C17.0203 8.17 15.9803 5.02999 14.1703 2.23999Z" /> <path d="M22.1379 20.7036L19.0082 14.8505C18.4019 13.7165 16.7729 13.7165 16.1661 14.8505L13.0364 20.7036C12.4803 21.7438 13.2354 23 14.4172 23H20.7571C21.9384 23 22.694 21.7433 22.1379 20.7036ZM17.2319 17.3157C17.2319 17.1196 17.391 16.9604 17.5871 16.9604C17.7833 16.9604 17.9424 17.1196 17.9424 17.3157V19.2104C17.9424 19.4066 17.7833 19.5657 17.5871 19.5657C17.391 19.5657 17.2319 19.4066 17.2319 19.2104V17.3157ZM17.5966 21.1052C17.3351 21.1052 17.1205 20.893 17.1205 20.6315C17.1205 20.37 17.3304 20.1578 17.5919 20.1578H17.5966C17.8586 20.1578 18.0703 20.37 18.0703 20.6315C18.0703 20.893 17.8581 21.1052 17.5966 21.1052Z" /> </svg>';
            hasCta           = true;
            cssClass         = 'unsupported-browser';
        }
        else if (!hasSupportedBrowserVersion) {
            desktopMessage   = 'Unsupported browser version detected. Update your browser to a Voyadores-supported browser version to prevent any issues.';
            mobileMessage    = 'Unsupported browser version detected. Using an outdated version may lead to incompatibility, security risks, and broken features. To ensure a secure and seamless experience, update your browser to a Voyadores-supported browser version.';
            icon             = '<svg class="icon icon-browser-version" width="24" height="24" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"> <path d="M9.83026 21.76C8.02026 18.97 6.98026 15.83 6.83026 12.75H2.03027C2.36027 17.19 5.59026 20.82 9.83026 21.76Z" /> <path d="M2.03027 11.25C2.36027 6.81 5.59026 3.17999 9.83026 2.23999C8.02026 5.02999 6.98026 8.17 6.83026 11.25H2.03027Z" /> <path d="M11.8003 2H12.2003L12.5003 2.42999C14.4003 5.12999 15.5103 8.23 15.6703 11.25H8.33026C8.49026 8.23 9.60028 5.12999 11.5003 2.42999L11.8003 2Z" /> <path d="M11.5003 21.57C9.60028 18.87 8.49026 15.77 8.33026 12.75H15.6703C15.6411 13.3016 15.5802 13.8558 15.4885 14.4097L11.9929 20.4644C11.8026 20.794 11.7182 21.1439 11.7221 21.4841C11.7233 21.5829 11.5568 21.6511 11.5003 21.57Z" /> <path d="M20.4806 15.6655C20.6797 16.0103 21.177 15.9924 21.3214 15.6213C21.6719 14.7204 21.8955 13.756 21.9703 12.75H18.0027C18.0026 12.75 18.0026 12.75 18.0027 12.75C18.5404 12.8523 19.0421 13.1739 19.3541 13.7144L20.4806 15.6655Z" /> <path d="M14.1703 2.23999C18.4103 3.17999 21.6403 6.81 21.9703 11.25H17.1703C17.0203 8.17 15.9803 5.02999 14.1703 2.23999Z" /> <path d="M22.1379 20.7036L19.0082 14.8505C18.4019 13.7165 16.7729 13.7165 16.1661 14.8505L13.0364 20.7036C12.4803 21.7438 13.2354 23 14.4172 23H20.7571C21.9384 23 22.694 21.7433 22.1379 20.7036ZM17.2319 17.3157C17.2319 17.1196 17.391 16.9604 17.5871 16.9604C17.7833 16.9604 17.9424 17.1196 17.9424 17.3157V19.2104C17.9424 19.4066 17.7833 19.5657 17.5871 19.5657C17.391 19.5657 17.2319 19.4066 17.2319 19.2104V17.3157ZM17.5966 21.1052C17.3351 21.1052 17.1205 20.893 17.1205 20.6315C17.1205 20.37 17.3304 20.1578 17.5919 20.1578H17.5966C17.8586 20.1578 18.0703 20.37 18.0703 20.6315C18.0703 20.893 17.8581 21.1052 17.5966 21.1052Z" /> </svg>';
            hasCta           = true;
            cssClass         = 'unsupported-browser-version';
        }
        else {
            desktopMessage   = ''
            mobileMessage    = ''
            icon             = ''
            hasCta           = false;
            cssClass         = '';
        }

        const message = viewportWidth <= 1023 ? mobileMessage : desktopMessage;

        return { message, icon, hasCta, cssClass };
    }

    /* Rendering for Desktop View */
    const alertHtml = alert.message ? buildAlertBanner(alert.message, alert.icon, alert.hasCta) : '';
    $('body').prepend(alertHtml).addClass(alert.cssClass);

    /* Rendering for Mobile View */
    $('#btn-open-alert').on('click', function () {
        const modal = $('#dv-alert-modal');
        modal.modal('show');

        alert.message ? buildAlertModalContent(alert.message, alert.icon, alert.hasCta) : '';
    });

    $('.btn-supported-browser').on('click', function () {
        window.open("https://help.voyadores.com/get-started/system-requirements#web-browser", "_blank");
    });
});