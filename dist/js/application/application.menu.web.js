'use strict';
import ApplicationHomeUserViewModel from './application.account.js';
import ApplicationThemePicker from './application.theme.picker.js';
import loadIndicators from '../application/application.visual-indicator.js';

// Constants
const THEME_VALUES = Object.freeze({
    LIGHT: 0,
    DARK: 1,
    SYSTEM_LIGHT: 4,
    SYSTEM_DARK: 6
});

const VIEWPORT_BREAKPOINT = 1024;
const NAVBAR_HIDE_THRESHOLD = 32;
const SCROLL_DEBOUNCE_MS = 100;
const RESIZE_DEBOUNCE_MS = 300;
const NAVIGATION_DELAY_MS = 500;

const PAGES_PER_SLIDE = {
    LANDSCAPE_MOBILE: 6,
    DEFAULT: 16
};

// State Management
const state = {
    prevScrollPos: $(window).scrollTop(),
    viewportWidth: $(window).width(),
    isScrolling: null,
    resizeTimeout: null,
    isContentLoaded: false
};

// DOM Elements Cache
const elements = {
    navbar: $('.navbar'),
    navbarMenu: $('.navbar-menu'),
    moduleMenu: $('#module-menu'),
    imgLogoPath: $('#img-logo-path'),
    accountAvatar: $('#dv-account-avatar'),
    navProfilePicture: $('#img-nav-profile-picture'),
    accountName: $('#spn-account-name'),
    accountRoles: $('#spn-account-roles'),
    userFullname: $('#inp-hdn-user-fullname'),
    accountName2: $('#spn-account-name-2'),
    accountRoles2: $('#spn-account-roles-2'),
    accountInitial2: $('#spn-account-name-initial-2'),
    loadingOverlay: $('#loading-overlay'),
    fileViewerModal: $('#dv-file-viewer-modal')
};

// Services
const viewModel = new ApplicationHomeUserViewModel('/user', globalRequest);
const themePickerViewModel = new ApplicationThemePicker();

// Broadcast Channel for cross-tab communication
const userSessionChannel = new BroadcastChannel('user-session-channel');

// URL Helpers
const urls = {
    current: window.location.href,
    domainRoot: `${window.location.origin}/`,
    pathname: window.location.pathname
};

// Expose to window
window.isContentLoaded = state.isContentLoaded;
// Utility Functions
const getViewportWidth = () => $(window).width();

const getFirstLetters = (str) => 
    str.split(' ').map(word => word.charAt(0)).join('');

const getDomainURL = () => $('#voyadores-cdn-url')?.val() || '';

const toggleVisibility = (selector, isHidden) => {
    $(selector).toggleClass('d-none', isHidden);
};

const setElementsVisibility = (selectors, visibility) => {
    selectors.forEach(selector => $(selector).css('visibility', visibility));
};

const isLandscapeMobile = () => 
    window.innerWidth > 600 && window.innerHeight < 500;

// Theme Functions
const changeThemeColor = (theme) => {
    const themeColor = $('meta[name="theme-color"]');
    const isDark = ['1', '6', 'dark'].includes(String(theme));
    themeColor.attr('content', isDark ? '#272727' : '#F5F5F5');
};

const getThemeBasedLogo = (theme, domainURL) => {
    const isDark = theme.label === 'dark' || theme.value === THEME_VALUES.SYSTEM_DARK;
    const variant = isDark ? 'dark' : 'light';
    return `${domainURL}/Content/images/voyadores-logo-combination-horizontal-${variant}.svg`;
};

const loadCompanyLogo = ($imgElement, defaultLogoPath) => {
    $imgElement.attr('src', defaultLogoPath);
    
    const img = new Image();
    img.src = '/files/get-account-logo?logoName=account_logo_32x32.png';
    img.onload = () => $imgElement.attr('src', img.src);
};

// Navbar Visibility
const updateNavbarVisibility = () => {
    if (state.isScrolling) return;

    state.isScrolling = setTimeout(() => {
        const currentScrollPos = $(window).scrollTop();
        const viewportWidth = getViewportWidth();
        const shouldHide = viewportWidth < VIEWPORT_BREAKPOINT - 17 && 
                          currentScrollPos > state.prevScrollPos && 
                          state.prevScrollPos > NAVBAR_HIDE_THRESHOLD;

        elements.navbar.toggleClass('invisible', shouldHide);
        elements.navbarMenu.toggleClass('invisible', shouldHide);

        state.prevScrollPos = currentScrollPos;
        state.isScrolling = null;
    }, SCROLL_DEBOUNCE_MS);
};

const updateViewportWidth = () => {
    state.viewportWidth = getViewportWidth();
    elements.navbar.removeClass('invisible');
    elements.navbarMenu.removeClass('invisible');
    renderNavigation();
    setScrollIndicatorState();
};

// Menu Data Processing
const processMenuData = (filteredMenuData) => {
    const modules = filteredMenuData.filter(item => item.Type === 'module');

    const pagesGroupedBySubmodule = filteredMenuData.reduce((acc, menuItem) => {
        if (menuItem.Type === 'page' || menuItem.Type === 'custom-page') {
            const { Module, Submodule = 'Uncategorized', submodulePosition } = menuItem;

            acc[Module] ??= {};
            acc[Module][Submodule] ??= { pages: [], position: 0 };

            acc[Module][Submodule].pages.push(menuItem);

            if (submodulePosition !== undefined) {
                acc[Module][Submodule].position = submodulePosition;
            }
        }
        return acc;
    }, {});

    return modules.map(module => ({
        ...module,
        submodules: Object.entries(pagesGroupedBySubmodule[module.Module] || {})
            .map(([name, { pages, position }]) => ({ name, pages, position }))
            .sort((a, b) => a.position - b.position)
    }));
};

const getProcessedMenu = async () => {
    try {
        const result = await viewModel.getMenuItems();
        return processMenuData(result);
    } catch (error) {
        console.error('Failed to load menu:', error);
        throw error;
    }
};

// Rendering Functions
const renderModules = (modules) => {
    const isActive = urls.pathname === '/';

    const moduleTemplate = (module) => `
        <li class="nav-item nav-module">
            <button id="${module.Url}" class="btn nav-link position-relative p-5" 
                type="button" aria-label="Open ${module.Name} Menu">
                <span class="vi-regular ${module.Icon}"></span>
                <span class="vi-solid vi-caret-down fs-6 d-none d-lg-inline-block" aria-hidden="true"></span>
            </button>
        </li>
    `;

    const homeModule = modules.find(module => module.Name === 'Home');
    const homeHtml = homeModule ? `
        <li class="nav-item nav-module">
            <a id="btn-open-home" class="btn nav-link ${isActive ? 'active' : ''} position-relative p-5 page-active"
               href="${homeModule.Url}" role="button" aria-label="Home">
                <span class="vi-regular ${homeModule.Icon}"></span>
            </a>
        </li>
    ` : '';

    const otherModulesHtml = modules
        .filter(module => module.Name !== 'Home')
        .map(moduleTemplate)
        .join('');

    return `${homeHtml}${otherModulesHtml}`;
};

const renderDesktopPage = (page) => {
    const isActive = urls.pathname === page.Url;
    const isCustomPage = page.Type === 'custom-page';
    
    return `
        <li class="nav-menu-item">
            <a class="nav-menu-link nav-desktop-menu-page ${isActive ? 'active' : ''}" 
               href="${page.Url}" 
               title="${isCustomPage ? 'For internal company use only' : ''}">
               ${page.Name} ${isCustomPage ? '<span class="vi-solid vi-file fs-5"></span>' : ''}
            </a>
        </li>
    `;
};

const renderMobilePage = (page) => {
    const currentPath = urls.pathname;
    const pagePath = new URL(page.Url, window.location.origin).pathname;
    const isActive = currentPath === pagePath;
    
    return `
        <div>
            <a class="nav-link nav-sub-link nav-mobile-menu-page ${isActive ? 'active' : ''}" 
               href="${page.Url}">
                <span class="nav-sub-icon nav-app vi-regular position-relative ${page.Icon}"></span>
                <span class="nav-sub-text text-truncate">${page.Name}</span>
            </a>
        </div>
    `;
};

const renderSubmodules = (module) => {
    const getAllPages = (module) => {
        const modulePages = module.pages || [];
        const submodulePages = module.submodules?.flatMap(submodule => submodule.pages) || [];
        return [...modulePages, ...submodulePages];
    };

    const pages = getAllPages(module);
    const submodules = module.submodules || [];

    const renderMobileView = () => {
        const pagesPerSlide = isLandscapeMobile() 
            ? PAGES_PER_SLIDE.LANDSCAPE_MOBILE 
            : PAGES_PER_SLIDE.DEFAULT;
        
        const slides = [];
        let currentSlide = [];

        pages.forEach((page, index) => {
            currentSlide.push(renderMobilePage(page));

            if ((index + 1) % pagesPerSlide === 0 || index === pages.length - 1) {
                slides.push(currentSlide);
                currentSlide = [];
            }
        });

        const moduleId = module.Name.toLowerCase().replace(/\s+/g, '-');

        if (slides.length === 1) {
            return `
                <div class="nav-grid p-3">
                    ${slides[0].join('')}
                </div>
            `;
        }

        return `
            <div class="scroll-view d-lg-none" style="--num-images: ${slides.length}">
                <div class="scroll-container">
                    ${slides.map((slide, index) => `
                        <div id="#dv-${moduleId}-carousel-${index}" class="scroll-item ${index === 0 ? 'active' : ''}">
                            <div class="nav-grid p-3">
                                ${slide.join('')}
                            </div>
                        </div>
                    `).join('')}
                </div>
                <div class="scroll-indicators">
                    ${slides.map((_, index) => `
                        <div class="indicator ${index === 0 ? 'active' : ''}"></div>
                    `).join('')}
                </div>
            </div>
        `;
    };

    const renderDesktopView = () => `
            <div class="columns">
                ${submodules.map(submodule => `
                    <div class="nav-menu-group">
                        <h6 class="nav-menu-subheader">${submodule.name}</h6>
                        <ul class="nav-menu-list">
                            ${submodule.pages.map(renderDesktopPage).join('')}
                        </ul>
                    </div>
                `).join('')}
            </div>
        `;

    return `
        <dialog id="dv-${module.Name.toLowerCase().replace(/\s+/g, '-')}-menu" class="nav-sheet px-0 px-lg-3">
            <div class="nav-menu-header">
                <button class="btn-close opacity-0 d-lg-none" type="button" tabindex="0" aria-label="Close"></button>
                <h5 class="nav-menu-title">${module.Name}</h5>
                <button class="btn-close invisible d-lg-none" type="button" aria-label="Close"></button>
            </div>
            <div class="nav-sheet-body">
                ${window.innerWidth >= VIEWPORT_BREAKPOINT ? renderDesktopView() : renderMobileView()}
            </div>
        </dialog>
    `;
};

const renderNavigation = async () => {
    try {
        $('nav').nextAll('.nav-sheet').not('.nav-sheet-end').remove();

        const processedMenuData = await getProcessedMenu();
        const modulesHtml = renderModules(processedMenuData);
        elements.moduleMenu.html(modulesHtml);

        const submodulesHtml = processedMenuData.map(renderSubmodules).join('');
        $('nav').after(submodulesHtml);

        if (window.innerWidth < VIEWPORT_BREAKPOINT) {
            renderMobileNavigation();
        }
    } catch (error) {
        console.warn('Error rendering navigation:', error);
    }
};

// Mobile Navigation Handlers
const renderMobileNavigation = () => {
    let lastButtonClicked = '';

    const getDialogIdFromButton = (buttonId) => 
        buttonId.replace('btn-open-', 'dv-') + '-menu';

    const openDialog = (dialogId) => {
        const dialog = document.getElementById(dialogId);
        if (dialog) {
            closeAllDialogs();
            dialog.show();
        }
    };

    const closeAllDialogs = () => {
        document.querySelectorAll('dialog[open]').forEach(dialog => dialog.close());
    };

    const closeDialog = () => {
        const openDialog = document.querySelector('dialog[open]');
        openDialog?.close();
    };

    const handleButtonClicks = () => {
        $('button[id^="btn-open"]').on('click', function() {
            const dialogId = getDialogIdFromButton(this.id);

            if (lastButtonClicked === this.id) {
                closeAllDialogs();
                lastButtonClicked = '';
            } else {
                lastButtonClicked = this.id;
                openDialog(dialogId);
            }
        });
    };

    const handleLinkClicks = () => {
        $('.nav-sub-link').on('click', function(e) {
            e.preventDefault();
            const targetUrl = $(this).attr('href');
            closeDialog();
            setTimeout(() => {
                window.location.href = targetUrl;
            }, NAVIGATION_DELAY_MS);
        });
    };

    const handleBackdropClicks = () => {
        $('.dialog-backdrop').on('click', closeDialog);
    };

    const handleCloseButtonClicks = () => {
        $('.btn-close').on('click', closeDialog);
    };

    handleButtonClicks();
    handleLinkClicks();
    handleBackdropClicks();
    handleCloseButtonClicks();
};

// User Profile and Account Setup
const setupUserAvatar = (userProfile, userFullname, domainURL) => {
    const profilePlaceholder = `${domainURL}/content/images/states/empty/general.image-thumbnail.empty.jpg`;
    const profilePictureURL = userProfile 
        ? `/files/get-file?fileName=${userProfile}` 
        : profilePlaceholder;

    const avatarHtml = `
        <img 
            id="img-user-avatar-menu" 
            src="${profilePictureURL}" 
            class="avatar-xl rounded-circle img-thumbnail object-fit-cover p-0" 
            width="48" 
            height="48" 
        />
    `;
    
    elements.accountAvatar.html(avatarHtml);

    // Handle avatar load errors
    $('#img-user-avatar-menu').one('error', function() {
        if ($(this).attr('src') !== profilePlaceholder) {
            $(this).attr('src', profilePlaceholder);
        }
    });

    // Handle nav profile picture errors
    elements.navProfilePicture
        .off('error')
        .one('error', function() {
            if ($(this).attr('src') !== profilePlaceholder) {
                $(this).attr('src', profilePlaceholder);
            }
        })
        .attr('src', profilePictureURL);
};

const setupUserInfo = (userFullname, accountRoles) => {
    const accountNameInitial = getFirstLetters(userFullname);

    elements.accountName.text(userFullname);
    elements.accountRoles.text(accountRoles);
    elements.userFullname.val(userFullname);
    elements.accountName2.text(userFullname);
    elements.accountRoles2.text(accountRoles);
    elements.accountInitial2.text(accountNameInitial);
};

const setupThemeSelector = (currentTheme) => {
    $(`input[name='themes'][value=${currentTheme.label}]`).prop('checked', true);

    // Reflect visual pressed state for labels (accessibility)
    $('#dv-theme-switcher label').attr('aria-pressed', 'false');
    const selectedInput = $(`input[name='themes'][value=${currentTheme.label}]`);
    if (selectedInput.length) {
        $(`label[for='${selectedInput.attr('id')}']`).attr('aria-pressed', 'true');
    }

    if (currentTheme.label === 'system') {
        const currentSystemTheme = themePickerViewModel.getCurrentSystemTheme();
        if (currentTheme.value !== currentSystemTheme) {
            themePickerViewModel.setTheme(currentTheme.label);
            themePickerViewModel.loadTheme();
        }
    }
};

const setupThemeChangeHandler = (domainURL) => {
    $('input:radio[name="themes"]').change(function() {
        const theme = $(this).val();
        const lightImage = `${domainURL}/Content/images/voyadores-logo-combination-horizontal-light.svg`;
        const darkImage = `${domainURL}/Content/images/voyadores-logo-combination-horizontal-dark.svg`;

        themePickerViewModel.setTheme(theme);

        let logo = theme === 'dark' ? darkImage : lightImage;
        const current = themePickerViewModel.getCurrentTheme();

        if (theme === 'system') {
            const systemTheme = current.value === THEME_VALUES.SYSTEM_DARK ? 'dark' : 'light';
            logo = current.value === THEME_VALUES.SYSTEM_DARK ? darkImage : lightImage;
            $('html[data-bs-theme]').attr('data-bs-theme', systemTheme);
        } else {
            $('html[data-bs-theme]').attr('data-bs-theme', theme);
        }

        changeThemeColor(current.value);
        loadCompanyLogo(elements.imgLogoPath, logo);

        // Update label pressed states for assistive tech and styling
        $('#dv-theme-switcher label').attr('aria-pressed', 'false');
        $(`label[for='${$(this).attr('id')}']`).attr('aria-pressed', 'true');
    });
};

// Initialize Account Information
const initializeAccountInfo = async () => {
    try {
        // FIRST: Get current user to validate user ID and detect changes
        const currentUser = await viewModel.getCurrentUser();
        
        // THEN: Get account info for display
        const response = await viewModel.getAccount();
        
        const theme = themePickerViewModel.getCurrentTheme();
        const domainURL = getDomainURL();

        // Set up logo
        const defaultLogoPath = getThemeBasedLogo(theme, domainURL);
        loadCompanyLogo(elements.imgLogoPath, defaultLogoPath);

        // Set up user info
        const { userFullname, userProfile, accountRoleNames } = response;
        setupUserAvatar(userProfile, userFullname, domainURL);
        setupUserInfo(userFullname, accountRoleNames);

        // Set up theme
        setupThemeSelector(theme);
        setupThemeChangeHandler(domainURL);
    } catch (error) {
        console.error('Error fetching account information:', error);
    }
};

// Scroll Indicator
const setScrollIndicatorState = () => {
    const checkElement = setInterval(() => {
        const $scrollableElement = $('.scroll-container');
        const $scrollItems = $('.scroll-item');
        const $indicators = $('.indicator');

        if ($scrollableElement.length > 0) {
            clearInterval(checkElement);
        }

        const removeActiveClass = () => {
            $scrollItems.removeClass('active');
            $indicators.removeClass('active');
        };

        const resetToFirst = () => {
            removeActiveClass();
            $scrollItems.eq(0).addClass('active');
            $indicators.eq(0).addClass('active');
        };

        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    removeActiveClass();
                    $(entry.target).addClass('active');
                    const index = $scrollItems.index(entry.target);
                    $indicators.eq(index).addClass('active');
                }
            });
        }, { threshold: 0.5 });

        $scrollItems.each(function() {
            observer.observe(this);
        });
    }, 100);
};

// Modal Theme Handler
const setupFileViewerModal = () => {
    elements.fileViewerModal.on('show.bs.modal hidden.bs.modal', function(e) {
        const $modal = $(this);
        const $html = $('html');
        let $metaTheme = $('meta[name="theme-color"]');

        if ($metaTheme.length === 0) {
            $metaTheme = $('<meta name="theme-color">').appendTo('head');
        }

        const theme = $html.attr('data-bs-theme') || 'light';
        const currentTheme = themePickerViewModel.getCurrentTheme();

        if (e.type === 'show') {
            const color = theme === 'dark' ? '#161616' : '#ffffff';
            $metaTheme.attr('content', color);
            $modal.find('.modal-content').css('background-color', color);
        } else if (e.type === 'hidden') {
            changeThemeColor(currentTheme.value);
        }
    });
};

// Event Handlers
const setupEventHandlers = () => {
    $(window).on('beforeunload', () => {
        toggleVisibility('#loading-overlay', false);
        
        // Clear storage on page unload if navigating to logout
        if (window.location.href.includes('/logout')) {
            localStorage.clear();
            sessionStorage.clear();
        }
    });

    $(window).on('resize', () => {
        const newViewportWidth = getViewportWidth();

        if (state.viewportWidth !== newViewportWidth) {
            clearTimeout(state.resizeTimeout);
            state.resizeTimeout = setTimeout(() => {
                state.viewportWidth = newViewportWidth;
                loadIndicators();
            }, RESIZE_DEBOUNCE_MS);
        }

        setScrollIndicatorState();
    });

    $(window).on('scroll touchmove', updateNavbarVisibility);
    $(window).on('orientationchange', updateViewportWidth);
    
    // Handle logout - clear all storage
    $(document).on('click', 'a.nav-menu-link[href="/logout"], a[href="/logout"]', function(e) {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        
        // Broadcast logout to other tabs BEFORE clearing storage
        try {
            userSessionChannel.postMessage({
                type: 'USER_LOGOUT',
                timestamp: Date.now()
            });
        } catch (error) {
            console.error('[BroadcastChannel] Failed to broadcast logout:', error);
        }
        
        // Clear all storage synchronously
        try {
            localStorage.clear();
            sessionStorage.clear();
        } catch (error) {
            // Silent error handling
        }
        
        // Use location.replace to prevent back navigation and ensure clean logout
        setTimeout(() => {
            window.location.replace('/logout');
        }, 100);
        
        return false;
    });
};

// Clean up whitespace nodes
const cleanupWhitespace = () => {
    $('body').contents().filter(function() {
        return this.nodeType === 3 && !/\S/.test(this.nodeValue);
    }).remove();
};

// Main Initialization
const initialize = async () => {
    toggleVisibility('#loading-overlay', false);

    // Initialize account info FIRST to detect user changes before loading menu
    await initializeAccountInfo();
    
    // Now render navigation - this will use cached menu if same user, or fresh if different user
    await renderNavigation();
    loadIndicators();

    setScrollIndicatorState();
    setupFileViewerModal();
    setupEventHandlers();
    cleanupWhitespace();

    if (urls.current === urls.domainRoot) {
        state.isContentLoaded = true;
        window.isContentLoaded = true;
    }

    toggleVisibility('#loading-overlay', true);
    setElementsVisibility(['nav', 'body > header', 'main', 'footer'], 'visible');
};

// Start Application
$(document).ready(() => {
    initialize();
});
