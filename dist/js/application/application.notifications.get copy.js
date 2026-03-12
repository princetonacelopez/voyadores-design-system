import ViewModelBase from "./application.view-model.js";

export default class UserNotificationGetViewModel extends ViewModelBase {
    constructor(basePath, httpClient) {
        super(basePath, httpClient);
    }

    getAllNotifications = () => this.get("get-all-notifications");

    getTopNotifications = () => this.get("get-top-notifications")

    readAll = () => this.post("read-all");

    read = (id) => this.post("read", { id });
}