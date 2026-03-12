function notify(message, type) {
    let text = '';
    if (message.constructor === String)
        text = message;
    else if (message.constructor === Error)
        text = message.message;
    else if (message.constructor === Object)
        text = message.data;

    noty({
        text: text,
        type: type,
        dismissQueue: true,
        speed: 100,
        timeout: 5000,
        layout: 'bottomLeft',
    });
}