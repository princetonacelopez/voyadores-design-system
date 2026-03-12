function UserOnboardingUpdateViewModel() {

    globalURI.baseURI = '/start';

    this.getUser = function () {
        return globalRequest.get(globalURI.buildURI('get-user-onboarding'));
    }

    this.activate = function (id) {
        return globalRequest.get(globalURI.buildURI('user-activation'), {id:id});
    }
}