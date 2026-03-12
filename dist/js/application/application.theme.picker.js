export default class ApplicationThemePicker {
    constructor() {
        // Theme constants
        this.THEMES = {
            Light: '0',
            Dark: '1',
            SystemLight: '4',
            SystemDark: '6'
        };
    }

    //Call the from the menu JavaScript file
    //Or any event that triggers changing of them
    loadTheme = () => {
        const defaultTheme = this.THEMES.Light;
        let savedTheme = this.#getPreferredTheme();
        let selectedTheme = savedTheme || defaultTheme;

        this.#setCookie(selectedTheme);
        //location.reload();
    }

    getCurrentTheme = () => {
        const defaultThemeLabel = 'light';
        const defaultThemeValue = this.THEMES.Light;
        let savedTheme = this.#getPreferredTheme();
        let selectedThemeLabel = defaultThemeLabel;
        let selectedThemeValue = defaultThemeValue;

        if (savedTheme) {
            selectedThemeValue = savedTheme;
            if (savedTheme === this.THEMES.Dark) {
                selectedThemeLabel = 'dark';
            } else if (savedTheme === this.THEMES.SystemLight || savedTheme === this.THEMES.SystemDark) {
                selectedThemeLabel = 'system';
            }
        }

        return { label: selectedThemeLabel, value: selectedThemeValue };
    }

    setTheme = (theme) => {
        const currentTheme = this.#getTheme(theme);
        this.#setCookie(currentTheme);
    }

    getCurrentSystemTheme = () => {
        const defaultTheme = this.THEMES.SystemLight;
        let currentTheme = defaultTheme;
        
        if (window?.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
            currentTheme = this.THEMES.SystemDark;
        }

        return currentTheme;
    }

    changeThemeColor = (theme) => {
        let themeColor = $('meta[name="theme-color"]');

        if (theme === this.THEMES.Dark || theme === this.THEMES.SystemDark || theme === 'dark') {
            themeColor.attr('content', '#272727');
        } else {
            themeColor.attr('content', '#F5F5F5');
        }
    }

    //Light         000 = 0
    //Dark          001 = 1
    //SystemLight   100 = 4
    //SystemDark    110 = 6
    #getTheme = (theme) => {
        const defaultTheme = this.THEMES.Light;
        const currentSystemTheme = this.getCurrentSystemTheme();
        let selectedTheme;

        switch (theme) {
            case 'light':
                selectedTheme = this.THEMES.Light;
                break;
            case 'system':
                selectedTheme = currentSystemTheme;
                break;
            case 'dark':
                selectedTheme = this.THEMES.Dark;
                break;
            default:
                selectedTheme = defaultTheme;
        }

        return selectedTheme;
    }

    #getPreferredTheme = () => {
        const cookieString = document.cookie;
        const cookies = cookieString.split('; ');
        let theme = '';

        for (let c of cookies) {
            const [key, value] = c.split('=');

            if (key === 'theme') {
                theme = value;
                break;
            }
        }

        return theme;
    }

    #setCookie = (theme) => {
        const expirationDate = new Date();
        expirationDate.setFullYear(expirationDate.getFullYear() + 1);

        const appDomain = this.#getAppDomain();

        //Light, System Light, System Dark, Dark
        document.cookie = `theme=${theme}; expires=${expirationDate.toUTCString()}; path=/; domain=${appDomain}`;
    }

    #getAppDomain = () => {
        const hostname = window.location.hostname;
        const parts = hostname.split('.');

        // Check if there is a subdomain (more than one part)
        if (parts.length > 1) {
            return parts.slice(-2).join('.'); // Remove the subdomain and return the main domain
        }

        // No subdomain, return the original hostname
        return hostname;
    }
}

//Initialize theme on load
const themePickerViewModel = new ApplicationThemePicker();
const theme = themePickerViewModel.getCurrentTheme();

themePickerViewModel.changeThemeColor(theme.value);
