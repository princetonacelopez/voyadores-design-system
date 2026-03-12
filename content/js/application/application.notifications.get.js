import ViewModelBase from "./application.viewmodel.js";

export default class UserNotificationGetViewModel extends ViewModelBase {
    constructor(basePath, httpClient) {
        super(basePath, httpClient);
    }

    getAllNotifications = () => this.get("get-all-notifications");

    readAll = () => this.post("read-all");

    read = (id) => this.post("read", { id });
}