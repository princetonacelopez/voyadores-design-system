
import UserNotificationGetViewModel from "https://cdn.voyadores.com/content/js/application/application.notifications.get.js";

const basePath           = "/user";
const httpClient         = globalRequest;
const ulNotificationMenu = $('#ul-notification-menu');
const InAppState         = { Unread: 7, Read: 6 };
const btnMarkAsRead      = $('#btn-notification-mark-all-as-read');
const isNotificationPage = location.pathname === "/user/notifications";
const oneMinute          = 60_000;
const notifications      = [];

let isInitialLoad = false;

const getViewModel          = new UserNotificationGetViewModel(basePath, httpClient);
const serviceWorkerChannel  = new BroadcastChannel("service-worker");

// Function to ask notification permission
function askNotificationPermission() {
    if ('Notification' in window) {
        Notification.requestPermission()
    } else {
        console.log('Notifications are not supported in this browser.');
    }
}

// Function to add event listeners based on screen width
function addNotificationEventListeners() {
    const notificationMenu = $('#btn-open-notification');

    // Remove previous event listeners
    notificationMenu.off('hover click');

    if (window.innerWidth >= 992) {
        notificationMenu.hover(askNotificationPermission);
    } else {
        notificationMenu.on('click', askNotificationPermission);
    }
}

addNotificationEventListeners();
$(window).resize(addNotificationEventListeners);

// Notification list
ulNotificationMenu.repeater({
    data            : [],
    mappingFunction : (data) => buildNotificationMenuListHTML(data),
    messageNoResult : 'No notifications available',
    cssClassNoResult: 'text-center status-text flex-grow-1 bg-transparent',
});

// Mark as read
ulNotificationMenu.off("click", ".btn-read").on("click", ".btn-read", async function () {
    const redirect = $(this).attr("data-redirect-to");
    const id = $(this).attr("data-id");
    const status = parseInt($(this).attr("data-status"));



    if (status === InAppState.Read) {
        location.href = redirect;
        return;
    }

    const response = await $.callAsync(getViewModel.read, id);

    if (response) {
        location.href = redirect;
    }

});

// Mark all as read
btnMarkAsRead.clickAsync(async function (loader, reset) {
    loader();

    const response = await $.callAsync(getViewModel.readAll);

    if (response) {
        notifications.filter(a => a.State === InAppState.Unread).forEach(n => n.State = InAppState.Read);

        handleHasUnreadNotifications(0);
        refreshNotification(notifications);
    }
	
    ulNotificationMenu.find('.notification-unread').removeClass('notification-unread');
    ulNotificationMenu.find('.spn-notification-time').addClass('notification-time-unread');
    reset();
});

// Run on first load
if (!isNotificationPage) {
    await notificationInterval();
    setInterval(notificationInterval, oneMinute);
}

async function notificationInterval() {
    notifications.length = 0; // resets to empty

    const response = await $.callAsync(getViewModel.getAllNotifications);

    if (!response) return;

    const unreadCount = response.data.filter(a => a.State === InAppState.Unread).length;
    notifications.push(...response.data.slice(0, 5))

    refreshNotification(notifications);
    handleHasUnreadNotifications(unreadCount);

    // Updates the badge count using the service worker
    serviceWorkerChannel.postMessage({ action: "updateBadge", count: unreadCount });
}

function refreshNotification(data = []) {
    ulNotificationMenu.repeater("refreshData", data);

    if (data.length === 0 && !isInitialLoad) {
        isInitialLoad = true;
        // Custom Notification list empty (Repeater)
        $('#ul-notification-menu > .status-text').append(`<p class="small">Looks like you haven't received any notifications</p>`);
        $('#ul-notification-menu > .status-text').addClass('px-4');
        $('#ul-notification-menu > .status-text > p.fw-bold').removeClass('small text-muted');
        $('#ul-notification-menu > .status-text > p.fw-bold').addClass('mb-2');
		serviceWorkerChannel.postMessage({ action: "updateBadge", count: 0 });
    }
}

function handleHasUnreadNotifications(count) {
    const unreadCount = count;

    if (unreadCount > 0) {
        const maxCount = unreadCount > 99 ? "99+" : unreadCount;
        $('#dv-notification-menu-badge-count')
            .text(maxCount)
            .removeClass('d-none');

        btnMarkAsRead.removeClass("d-none");
        serviceWorkerChannel.postMessage({ action: "updateBadge", count: unreadCount });
        return;
    }

    btnMarkAsRead.addClass("d-none");
    $('#dv-notification-menu-badge-count').addClass('d-none');
    serviceWorkerChannel.postMessage({ action: "updateBadge", count: 0 });
}

function buildNotificationMenuListHTML(notifications) {

    let html = "";

    for (const notification of notifications) {
        let filePath = null;
        const metadata = notification.UnserializedMetadata;

        if (metadata.ImageFilename) {
            filePath = `${notification.AccountFilePath}/${metadata.ImageFilename}`;
        }

        buildAvatarContainer(notification.Id, metadata.PageIcon, filePath);

        const relativeTime = moment(notification.CreatedAt).from(moment());

        html += `<li class="nav-item">
                    <a data-id="${notification.Id}" data-status="${notification.State}" data-redirect-to="${metadata.RedirectPath}" class="btn-read nav-link fs-3 fs-lg-5 p-3 d-flex gap-4 rounded ${notification.State == InAppState.Unread ? 'notification-unread' : ''}" href="javascript:void(0)">
                        <div id="${notification.Id}">
                            <div class="avatar-xl bg-white border rounded-circle d-grid place-items-center flex-shrink-0 position-relative">
                                <span class="text-black">${getInitials(notification.Sender)}</span>
                                <span class="position-absolute bottom-0 end-0 p-2 bg-primary rounded-circle">
                                    <div class="vi-regular ${metadata.PageIcon} text-black fs-6"></div>
                                </span>
                            </div>
                        </div>
                        <div class="vstack">
                            <span class="spn-notification-message fs-6">${notification.Intent}</span>
                            <span class="spn-notification-time small ${notification.State == InAppState.Unread ? '' : 'notification-time-unread'}">${relativeTime}</span>
                        </div>
                    </a>
                </li>`;
    }

    return html;
}

function buildAvatarContainer(id, pageIcon, filePath) {
    if (!filePath) return;

    const imgHtml = `
        <div class="avatar-xl d-grid place-items-center flex-shrink-0 position-relative">
            <img src="${filePath}" class="rounded-circle border object-fit-cover" width="47.99" height="47.99">
            <span class="position-absolute bottom-0 end-0 p-2 bg-primary rounded-circle">
                <div class="vi-regular ${pageIcon} text-black fs-6"></div>
            </span>
        </div>`;

    const img = new Image();

    img.src = filePath;

    img.onload = () => $(`#${id}`).empty().append(imgHtml);
}

//function 

function getInitials(fullName) {
    const nameParts = fullName.split(' ');
    return (nameParts[0].charAt(0) + nameParts[nameParts.length - 1].charAt(0)).toUpperCase();
}
