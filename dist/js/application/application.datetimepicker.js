$(function () {
    $('.fld-date-format').each(function () {
        $(this).html(moment($(this).html(), 'M/D/YYYY hh:mm:ss A').format('MMM DD, YYYY'));
    });

    $('.fld-date-time-format').each(function () {
        $(this).html(moment($(this).html(), 'M/D/YYYY hh:mm:ss A').format('h:mm A MMM DD, YYYY'));
    });

    $('.fld-date-picker').datetimepicker({
        format          : 'm/d/Y',
        timepicker      : false,
        defaultSelect   : true,
        insideParent    : true,
        scrollInput     : false,
    });

    $('.fld-date-picker-min-date').datetimepicker({
        format          : 'm/d/Y',
        timepicker      : false,
        minDate         : moment().subtract(7, 'days').format('YYYY/M/D'),
        insideParent    : true,
        scrollInput     : false,
    });

    $('.fld-date-picker-max-date').datetimepicker({
        format          : 'm/d/Y',
        timepicker      : false,
        defaultSelect   : true,
        insideParent    : true,
        scrollInput     : false,
        minDate         : new Date(),
        maxDate         : moment().add(7, 'days').format('YYYY/M/D'),
    });
});

function formatDate(date) {
    var re  = /-?\d+/;
    var m   = re.exec(date);
    var d   = new Date(parseInt(m[0]));

    return d.toLocaleDateString() + " " + d.toLocaleTimeString();
}

function formatDateTime12(date) {
    var hours   = date.getHours();
    var minutes = date.getMinutes();
    var ampm    = hours >= 12 ? 'pm' : 'am';
    hours       = hours % 12;
    hours       = hours ? hours : 12; // the hour '0' should be '12'
    minutes     = minutes < 10 ? '0' + minutes : minutes;
    var strTime = hours + ':' + minutes + ' ' + ampm;

    return strTime;
}