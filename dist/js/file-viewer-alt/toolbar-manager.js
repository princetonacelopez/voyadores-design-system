import { eventBus } from './event-bus.js';

export class ToolbarManager {
    constructor(viewer, config) {
        this.viewer = viewer;
        this.config = config;
        this.focusableElements = [];
    }

    render() {
        const toolbarDiv = document.createElement('div');
        toolbarDiv.id = 'file-viewer-toolbar';

        // Add skip navigation link
        const skipLink = document.createElement('a');
        skipLink.href = '#file-viewer-content';
        skipLink.className = 'skip-link';
        skipLink.textContent = 'Skip to content';
        toolbarDiv.appendChild(skipLink);

        const toolbarFileTitle = document.createElement('div');
        toolbarFileTitle.className = 'toolbar-file-title';
        const fileTitleSpan = document.createElement('span');
        fileTitleSpan.id = 'file-title';
        fileTitleSpan.textContent = this.viewer.fileName;
        toolbarFileTitle.appendChild(fileTitleSpan);

        toolbarDiv.appendChild(toolbarFileTitle);

        if (this.viewer.isMobile) {
            this.addMobileToolbar(toolbarDiv);
        } else {
            this.addDesktopToolbar(toolbarDiv);
        }

        const container = document.getElementById('file-viewer-container');
        container.insertBefore(toolbarDiv, container.firstChild);

        return toolbarDiv;
    }

    addDesktopToolbar(toolbarDiv) {
        const toolbarFileControls = document.createElement('div');
        toolbarFileControls.className = 'toolbar-file-controls';
        this.config.controls.forEach(btn => {
            const button = this.createButton(btn);
            toolbarFileControls.appendChild(button);
        });
        toolbarDiv.appendChild(toolbarFileControls);

        const toolbarFileShare = document.createElement('div');
        toolbarFileShare.className = 'toolbar-file-share';
        this.config.share.forEach(btn => {
            const button = this.createButton(btn);
            if (btn.id.includes('share') && !this.viewer.canShareFiles) {
                button.disabled = true;
                button.setAttribute('aria-disabled', 'true');
                button.style.opacity = '0.5';
                button.title = this.viewer.isHttps ? 'Share not supported' : 'Share requires HTTPS';
            }
            toolbarFileShare.appendChild(button);
        });
        toolbarDiv.appendChild(toolbarFileShare);
    }

    addMobileToolbar(toolbarDiv) {
        const moreActionsBtn = this.createButton({
            id: 'more-actions',
            title: 'More',
            icon: 'more-vertical',
            action: () => {
                const dialog = document.getElementById('more-actions-dialog');
                dialog.showModal();
                this.trapFocus(dialog);
            }
        });
        toolbarDiv.appendChild(moreActionsBtn);

        const moreActionsDialog = document.createElement('dialog');
        moreActionsDialog.id = 'more-actions-dialog';
        moreActionsDialog.className = 'more-actions-dialog';
        moreActionsDialog.setAttribute('role', 'dialog');
        moreActionsDialog.setAttribute('aria-labelledby', 'more-actions-title');

        const dialogTitle = document.createElement('h2');
        dialogTitle.id = 'more-actions-title';
        dialogTitle.textContent = 'More Actions';
        dialogTitle.style.display = 'none'; // Hidden for screen readers

        const dialogHandle = document.createElement('div');
        dialogHandle.className = 'dialog-handle';
        dialogHandle.setAttribute('aria-label', 'Drag to close dialog');
        dialogHandle.addEventListener('click', () => moreActionsDialog.close());

        const dialogContent = document.createElement('div');
        dialogContent.className = 'more-actions-content';

        const dialogControls = document.createElement('div');
        dialogControls.className = 'toolbar-file-controls';
        this.config.controls.forEach(btn => {
            const button = this.createButton(btn, true);
            dialogControls.appendChild(button);
        });

        const dialogShare = document.createElement('div');
        dialogShare.className = 'toolbar-file-share';
        this.config.share.forEach(btn => {
            const button = this.createButton(btn, true);
            if (btn.id.includes('share') && !this.viewer.canShareFiles) {
                button.disabled = true;
                button.setAttribute('aria-disabled', 'true');
                button.style.opacity = '0.5';
                button.title = this.viewer.isHttps ? 'Share not supported' : 'Share requires HTTPS';
            }
            dialogShare.appendChild(button);
        });


        dialogContent.appendChild(dialogControls);
        dialogContent.appendChild(dialogShare);
        moreActionsDialog.appendChild(dialogTitle);
        moreActionsDialog.appendChild(dialogHandle);
        moreActionsDialog.appendChild(dialogContent);

        moreActionsDialog.addEventListener('click', (e) => {
            if (e.target === moreActionsDialog) moreActionsDialog.close();
        });

        let touchStartY = 0, touchCurrentY = 0;
        dialogHandle.addEventListener('touchstart', (e) => {
            touchStartY = e.touches[0].clientY;
        });
        dialogHandle.addEventListener('touchmove', (e) => {
            touchCurrentY = e.touches[0].clientY;
            const diff = touchCurrentY - touchStartY;
            if (diff > 0) moreActionsDialog.style.transform = `translateY(${diff}px)`;
        });
        dialogHandle.addEventListener('touchend', () => {
            const diff = touchCurrentY - touchStartY;
            if (diff > 50) moreActionsDialog.close();
            moreActionsDialog.style.transform = '';
        });

        moreActionsDialog.addEventListener('close', () => {
            const moreActionsBtn = document.getElementById('more-actions');
            if (moreActionsBtn) moreActionsBtn.focus();
        });

        document.body.appendChild(moreActionsDialog);
    }

    createButton(btn, includeText = false) {
        const button = document.createElement('button');
        button.id = btn.id;
        button.type = 'button';
        button.title = btn.title;
        button.setAttribute('aria-label', btn.title);
        button.innerHTML = `<span class="vi-solid vi-${btn.icon}" aria-hidden="true"></span>${includeText ? ' ' + btn.title : ''}`;
        if (btn.action) button.onclick = btn.action;
        if (button.disabled) button.setAttribute('aria-disabled', 'true');
        return button;
    }

    updateFileName(newFileName) {
        const fileTitleSpan = document.getElementById('file-title');
        if (fileTitleSpan) {
            fileTitleSpan.textContent = newFileName;
        }
    }

    trapFocus(dialog) {
        this.focusableElements = dialog.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
        const firstFocusable = this.focusableElements[0];
        const lastFocusable = this.focusableElements[this.focusableElements.length - 1];

        if (firstFocusable) firstFocusable.focus();

        dialog.addEventListener('keydown', (e) => {
            if (e.key === 'Tab') {
                if (e.shiftKey) {
                    if (document.activeElement === firstFocusable) {
                        e.preventDefault();
                        lastFocusable.focus();
                    }
                } else {
                    if (document.activeElement === lastFocusable) {
                        e.preventDefault();
                        firstFocusable.focus();
                    }
                }
            }
            if (e.key === 'Escape') {
                dialog.close();
            }
        });
    }
}