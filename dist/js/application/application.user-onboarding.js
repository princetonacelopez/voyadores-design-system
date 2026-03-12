$(document).ready(function () {

    const viewModel     = new UserOnboardingUpdateViewModel();
    const viewportWidth = $(window).width();
    const modal         = $('#dv-onboarding-modal');
    const domainURL     = $('#voyadores-cdn-url').val();
    let user;

    viewModel.getUser()
        .then(response => {
            user = response.data;

            $('html').attr('data-bs-theme') === 'dark' ? setLogoTheme('dark') : setLogoTheme('light');
            modal.find('#spn-user-name').text(user.Fullname);

            modal.modal('show');
        })
        .catch(error => {
            const message = error?.response?.data || error;
            notify(message, 'error');
        });

    modal.find('#dv-onboarding-carousel').on('slid.bs.carousel', function () {
        const activeStep    = modal.find('#dv-onboarding-carousel .carousel-item.active');
        const startTourBtn  = modal.find('#btn-start-tour');
        const nextBtn       = modal.find('#btn-onboarding-next');
        const previousBtn   = modal.find('#btn-onboarding-previous');

        if (activeStep.attr('id') === 'dv-onboarding-tour-step') {
            startTourBtn.removeClass('d-none');
            nextBtn.addClass('d-none');
            previousBtn.addClass('d-none');
        } else {
            startTourBtn.addClass('d-none');
            nextBtn.removeClass('d-none');
            previousBtn.removeClass('d-none');
        }

        if (activeStep.attr('id') === 'dv-onboarding-welcome-step') {
            previousBtn.prop('disabled', true);
        }
        else {
            previousBtn.prop('disabled', false);
        }
    });

    // Start Tour
    modal.find('#btn-start-tour').on('click', function () {
        modal.modal('hide');

        let userTour; 
        const driver = window.driver.js.driver;

        const hasAnnouncement = $('#dv-help-tips-container').hasClass('d-none') ? true : false;

        const announcementTourObj = {
            element         : '#dv-announcement-container',
            popover         : {
                title       : 'Announcements',
                description : 'Stay informed about the latest company-wide updates, important notices, and system maintenance announcements that could impact your workflow.',
                side        : "left",
                align       : 'start'
            },
        };

        const helpTipsTourObj = {
            element         : '#dv-help-tips-container',
            popover         : {
                title       : 'Help Tips',
                description : 'Explore helpful tips, guides, and tutorials that will assist you in better understanding how to use the platform effectively and get the most out of its features.',
                side        : "left",
                align       : 'start'
            },
        };

        const steps = [
            {
                element         : '#module-menu',
                popover         : {
                    title       : 'Modules Menu',
                    description : 'From this menu, you can access all the available modules and features within the platform. Options displayed here are personalized based on your role and access permissions.',
                    side        : "bottom",
                    align       : viewportWidth <= 768 ? 'center' : 'end'
                },
            },
            {
                element         : '#btn-open-notification',
                popover         : {
                    title       : 'Notifications',
                    description : 'Get notified about important transaction updates—such as status changes, pending approvals, or failed operations—so you can respond quickly and keep things moving smoothly.',
                    side        : "bottom",
                    align       : 'end'
                }
            },
            {
                element         : '#btn-open-account',
                popover         : {
                    title       : 'Profile',
                    description : 'This section allows you to manage your account preferences, update your profile details, change your password, and log out from the application securely.',
                    side        : "bottom",
                    align       : 'end'
                }
            },
            hasAnnouncement ? announcementTourObj : helpTipsTourObj,
            {
                element         : '#dv-quick-links',
                popover         : {
                    title       : 'Quick Links',
                    description : 'Access shortcuts to the most frequently used sections of the platform. These links are designed to help you navigate faster and more efficiently to important areas.',
                    side        : "right",
                    align       : 'start'
                }
            },
            {
                element         : '#dv-user-tasks',
                popover         : {
                    title       : 'User Tasks',
                    description : 'Here you can view and manage your assigned tasks, deadlines, and priorities. Keep track of your workload and stay organized by reviewing your task list.',
                    side        : "top",
                    align       : 'center'
                }
            },
            {
                popover: {
                    description: `
                    <div class="vstack align-items-center justify-content-center text-center">
                        <div class="p-7">
                            <img class="img-fluid" src="${domainURL}/content/images/illustrations/home.start.onboarding.finish.svg" alt="" width="80" />
                        </div>
                        <div>
                            <h4 class="fw-semibold fs-3">You’re all set!</h4>
                            <p class="text-secondary text-balance">That’s a wrap on the tour. You’re now ready to navigate Voyadores with ease and confidence. Let’s get to work!</p>
                        </div>
                    </div>`,
                },
            },
        ];

        // Initialize the tour
        userTour = driver({
            showProgress        : true,
            allowClose          : false,
            smoothScroll        : true,
            allowKeyboardControl: true,
            doneBtnText         : 'Finish',
            steps               : steps,
            onDestroyStarted    : () => {
                if (!userTour.hasNextStep()) {                 
                    updateUserStatus();
                    userTour.destroy();
                }
            },
        });

        window.userTour = userTour;
        userTour.drive();
    });

    // Skip Onboarding
    modal.find('#btn-skip-onboarding').on('click', function () {
        updateUserStatus();
    });

    function updateUserStatus() {
        if (user && user.Id) {
            return viewModel.activate(user.Id);
        }
    }

    function setLogoTheme(theme) {
        modal.find('#img-voyadores-logo').attr('src', `${domainURL}/content/images/voyadores-logo-combination-horizontal-${theme}.svg`);
    }
});