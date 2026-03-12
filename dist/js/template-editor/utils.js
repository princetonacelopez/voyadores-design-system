export class Observable {
    constructor() {
        this.listeners = [];
    }
    subscribe(listener) {
        this.listeners.push(listener);
    }
    notify(data) {
        this.listeners.forEach(listener => listener(data));
    }
    unsubscribe(listener) {
        this.listeners = this.listeners.filter(l => l !== listener);
    }
}

export class DomHelper {
    static createElement(tag, attributes = {}, innerHTML = '') {
        const element = document.createElement(tag);
        Object.entries(attributes).forEach(([key, value]) => {
            if (key === 'className') {
                element.className = value;
            } else if (key === 'checked') {
                element.checked = !!value; // Set DOM property
                if (value === true) {
                    element.setAttribute('checked', 'checked');
                } else {
                    element.removeAttribute('checked');
                }
            } else {
                element.setAttribute(key, value);
            }
        });
        element.innerHTML = innerHTML;
        return element;
    }
    static appendChildren(parent, ...children) {
        children.forEach(child => child && parent.appendChild(child));
    }
    static clear(element) {
        element.innerHTML = '';
    }
}

export function debounce(func, wait) {
    let timeout;
    return function (...args) {
        clearTimeout(timeout);
        timeout = setTimeout(() => func(...args), wait);
    };
}

export function generateUUID() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
        const r = Math.random() * 16 | 0;
        const v = c === 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
}

export const Config = {
    debounceDelay: 300,
    toolbarClass: 'position-fixed top-0 end-0 m-3 p-2 bg-light border rounded shadow-sm',
    buttonClass: 'btn btn-outline-secondary m-1',
};