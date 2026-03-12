function ApplicationPermissionViewModel(rolePermissionsSource) {

    let _rolePermissions = [];
    if (isArray(rolePermissionsSource))
        _rolePermissions = rolePermissionsSource;

    if (isFunction(rolePermissionsSource)) {
        _rolePermissions = rolePermissionsSource();
    }

    if (isString(rolePermissionsSource)) {
        $.ajax({
            url: rolePermissionsSource,
            statusCode: {
                200: function (permissions) {
                    _rolePermissions = permissions;
                }
            },
        });
    }

    this.hasPermission = function (element) {
        return _rolePermissions.includes(element);
    }

    function isString(u) {
        return (typeof u === 'string' || u instanceof String);
    }

    function isFunction(f) {
        return f && {}.toString.call(f) === '[object Function]';
    }

    function isArray(obj) {
        return !!obj && obj.constructor === Array;
    }
}