import { Observable, DomHelper, debounce, Config, generateUUID } from './utils.js';
import { FormViewModel } from './viewModel.js';
import { TemplateViewer } from './template-viewer.js';
import { FormTemplate, Section, QuestionFactory } from './model.js';

export class TemplateBuilder {
    constructor(containerId, options = {}) {
        if (typeof containerId !== 'string') throw new Error('containerId must be a string');
        this.container = document.getElementById(containerId);
        if (!this.container) throw new Error(`Container with ID '${containerId}' not found`);

        const defaultOptions = {
            enablePreview: false,
            previewContainer: '',
            template: {
                title: '',
                description: '',
                positions: [],
                positionName: '',
                positionId: '',
                createdBy: ''
            },
            section: {
                reorder: true,
                showDescription: true,
                maxSection: 20
            },
            question: {
                reorder: true,
                isRequired: true,
                maxQuestions: 20
            },
            data: null
        };

        this.options = {
            ...defaultOptions,
            ...options,
            template: {
                ...defaultOptions.template,
                ...options.template
            },
            section: {
                ...defaultOptions.section,
                ...options.section
            },
            question: {
                ...defaultOptions.question,
                ...options.question
            }
        };

        this.viewModel = new FormViewModel({ isQuestionRequired: this.options.question.isRequired });
        this.viewModel.formTemplate = new FormTemplate(
            generateUUID(),
            this.options.template.title || 'Untitled Form',
            this.options.template.description || '',
            this.options.template.positionName || '',
            this.options.template.positionId || '',
            this.options.template.createdBy || '',
            0
        );

        this.templatePositions = this.options.template.positions.length > 0
            ? this.options.template.positions
            : [{ value: 'top', label: 'Top' }, { value: 'bottom', label: 'Bottom' }];

        this.isUnsaved = true;
        this.stateObservable = new Observable();

        this.debouncedRender = debounce(() => this.render(), 100);
        this.viewModel.subscribe(() => {
            this.setUnsaved(true);
            this.debouncedRender();
            if (this.options.enablePreview && this.preview) {
                this.preview.data = this.viewModel.formTemplate;
                this.preview.render();
            }
        });

        this.newSectionIndex = null;
        this.newQuestion = { sectionIndex: null, questionIndex: null };

        this.updateSectionTitle = (sectionIndex, value) => {
            this.viewModel.updateSectionTitle(sectionIndex, value);
        };
        this.updateSectionDescription = (sectionIndex, value) => {
            this.viewModel.updateSectionDescription(sectionIndex, value);
        };

        this.initializeUI();

        if (this.options.data) {
            let processedData;
            try {
                if (typeof this.options.data === 'string') {
                    processedData = JSON.parse(this.options.data);
                    if (!processedData || typeof processedData !== 'object' || Array.isArray(processedData)) {
                        throw new Error('Parsed JSON data must be a plain object');
                    }
                } else if (typeof this.options.data === 'object' && this.options.data !== null && !Array.isArray(this.options.data)) {
                    processedData = this.options.data;
                } else {
                    throw new Error('Data must be a JSON string or a plain JavaScript object');
                }
                this.loadJsonData(processedData);
            } catch (error) {
                this.render();
                throw error;
            }
        }

        this.render();
        this.setupInputListeners();
    }

    initializeUI() {
        this.toolbar = this.createToolbar();
        this.sectionsContainer = DomHelper.createElement('div', { className: 'template-section-container' });
        if (this.options.section.showDescription) {
            this.minimap = this.createMinimap();
        }
        if (this.options.enablePreview) {
            this.preview = new TemplateViewer(this.options.previewContainer, {
                data: this.viewModel.formTemplate,
                previewMode: true
            });
        }
    }

    getSaveState() {
        return this.isUnsaved ? 'Unsaved' : 'Saved';
    }

    setUnsaved(value) {
        if (this.isUnsaved !== value) {
            this.isUnsaved = value;
            this.stateObservable.notify();
        }
    }

    subscribeToState(listener) {
        this.stateObservable.subscribe(listener);
    }

    save() {
        this.viewModel.formTemplate.sections.forEach((section, sIndex) => {
            section.orderNumber = sIndex;
            section.questions.forEach((question, qIndex) => {
                question.orderNumber = qIndex;
            });
        });

        this.setUnsaved(false);
        return this.viewModel.formTemplate;
    }

    createToolbar() {
        this.toolbar = DomHelper.createElement('div', {
            className: 'template-toolbar',
            role: 'toolbar',
            'aria-label': 'Form builder tools'
        });
        this.addSectionBtn = DomHelper.createElement('button', {
            className: 'btn',
            type: 'button',
            'data-toggle': 'tooltip',
            'aria-label': 'Add a new section',
            'data-bs-original-title': 'Add Section',
            disabled: this.viewModel.formTemplate.sections.length >= this.options.section.maxSection
        }, `<span class="vi-solid vi-grid-web-5"></span>`);
        this.addQuestionBtn = DomHelper.createElement('button', {
            className: 'btn',
            type: 'button',
            'data-toggle': 'tooltip',
            'aria-label': 'Add a new question',
            'data-bs-original-title': 'Add Question',
            disabled: this.isAddQuestionDisabled()
        }, `<span class="vi-solid vi-plus-circle"></span>`);
        const divider = DomHelper.createElement('div', {
            className: 'border border-secondary opacity-25 w-50 mx-auto my-3'
        });
        this.undoBtn = DomHelper.createElement('button', {
            className: 'btn',
            type: 'button',
            title: 'Undo',
            'data-toggle': 'tooltip',
            'aria-label': 'Undo last action'
        }, `<span class="vi-solid vi-arrow-back"></span>`);
        this.redoBtn = DomHelper.createElement('button', {
            className: 'btn',
            type: 'button',
            title: 'Redo',
            'data-toggle': 'tooltip',
            'aria-label': 'Redo last undone action',
            disabled: !(this.viewModel && this.viewModel.undone && this.viewModel.undone.length)
        }, `<span class="vi-solid vi-arrow-forward"></span>`);

        this.addSectionBtn.addEventListener('click', () => {
            if (this.viewModel.formTemplate.sections.length >= this.options.section.maxSection) {
                return;
            }
            const newIndex = this.viewModel.formTemplate.sections.length;
            this.viewModel.addSection();
            this.viewModel.formTemplate.sections[newIndex].orderNumber = newIndex;
            this.newSectionIndex = newIndex;
            this.render();
        });

        this.addQuestionBtn.addEventListener('click', () => {
            const sectionIndex = this.viewModel.selectedSectionIndex !== null ? this.viewModel.selectedSectionIndex : 0;
            const section = this.viewModel.formTemplate.sections[sectionIndex];
            if (!section || section.questions.length >= this.options.question.maxQuestions) {
                return;
            }
            const questionIndex = section.questions.length;
            this.viewModel.addQuestion('linearScale', 'Untitled Question', sectionIndex);
            if (this.viewModel.formTemplate.sections[sectionIndex]) {
                this.viewModel.formTemplate.sections[sectionIndex].questions[questionIndex].orderNumber = questionIndex;
            }
            this.newQuestion = { sectionIndex, questionIndex };
            this.render();
        });

        this.undoBtn.addEventListener('click', () => {
            this.viewModel.undo();
            this.viewModel.formTemplate.sections.forEach((section, sIndex) => {
                section.orderNumber = sIndex;
                section.questions.forEach((question, qIndex) => {
                    question.orderNumber = qIndex;
                });
            });
            this.render();
        });

        this.redoBtn.addEventListener('click', () => {
            this.viewModel.redo();
            this.viewModel.formTemplate.sections.forEach((section, sIndex) => {
                section.orderNumber = sIndex;
                section.questions.forEach((question, qIndex) => {
                    question.orderNumber = qIndex;
                });
            });
            this.render();
        });

        DomHelper.appendChildren(this.toolbar, this.addSectionBtn, this.addQuestionBtn, divider, this.undoBtn, this.redoBtn);
        return this.toolbar;
    }

    isAddQuestionDisabled() {
        const sectionIndex = this.viewModel.selectedSectionIndex !== null ? this.viewModel.selectedSectionIndex : 0;
        const section = this.viewModel.formTemplate.sections[sectionIndex];
        return !section || section.questions.length >= this.options.question.maxQuestions;
    }

    createMinimap() {
        const minimap = DomHelper.createElement('div', {
            className: 'template-section-pane btn-group-vertical',
            role: 'navigation',
            'aria-label': 'Section navigation'
        });
        const minimapTitle = DomHelper.createElement('h6', { className: 'template-section-pane-title' }, 'Sections');
        this.minimapList = DomHelper.createElement('ul', { className: 'template-section-pane-list' });
        DomHelper.appendChildren(minimap, minimapTitle, this.minimapList);
        return minimap;
    }

    loadJsonData(data) {
        try {
            if (!data || typeof data !== 'object' || Array.isArray(data)) {
                throw new Error('Data must be a plain JavaScript object');
            }

            const formTemplate = this.viewModel.formTemplate;

            formTemplate.id = data.id || generateUUID();
            formTemplate.title = data.title || 'Untitled Form';
            formTemplate.description = data.description || '';
            formTemplate.positionName = data.positionName || data.positionId || this.options.template.positionName || '';
            formTemplate.positionId = data.positionId || this.options.template.positionId || '';
            formTemplate.createdBy = data.createdBy || '';
            formTemplate.state = data.state ?? 0;

            if (data.positionId && data.positionName) {
                this.templatePositions = [{
                    value: data.positionId,
                    label: data.positionName
                }];
            }

            const incomingSections = data.sections || [];
            if (!Array.isArray(incomingSections)) throw new Error('Invalid data: "sections" must be an array');
            if (incomingSections.length > this.options.section.maxSection) {
                throw new Error(`Number of sections (${incomingSections.length}) exceeds maximum allowed (${this.options.section.maxSection})`);
            }

            formTemplate.sections = incomingSections.slice(0, this.options.section.maxSection).map((sectionData, sIndex) => {
                const section = new Section(
                    sectionData.title || `Section ${sIndex + 1}`,
                    sectionData.description || '',
                    sectionData.id || generateUUID(),
                    sectionData.weightScore ?? 0
                );
                section.orderNumber = sIndex;
                const questions = sectionData.questions || [];
                if (!Array.isArray(questions)) throw new Error('Invalid data: "questions" must be an array');
                if (questions.length > this.options.question.maxQuestions) {
                    throw new Error(`Number of questions (${questions.length}) in section ${sIndex} exceeds maximum allowed (${this.options.question.maxQuestions})`);
                }

                section.questions = questions.slice(0, this.options.question.maxQuestions).map((questionData, qIndex) => {
                    let type;
                    switch (questionData.type) {
                        case 0:
                        case 'linearScale':
                            type = 'linearScale';
                            break;
                        case 1:
                        case 'text':
                            type = 'text';
                            break;
                        default:
                            throw new Error(`Invalid question type: ${questionData.type}`);
                    }

                    return QuestionFactory.create(
                        type,
                        section.id,
                        questionData.title || 'Untitled Question',
                        {
                            id: questionData.id || generateUUID(),
                            required: questionData.required ?? this.options.question.isRequired,
                            answer: questionData.answer ?? null,
                            weightScore: questionData.weightScore ?? 0,
                            weightedType: questionData.weightedType || 'Default',
                            orderNumber: qIndex,
                            minScore: questionData.minScore ?? (type === 'linearScale' ? 1 : null),
                            maxScore: questionData.maxScore ?? (type === 'linearScale' ? 5 : null),
                            minLabel: questionData.minLabel ?? (type === 'linearScale' ? 'Poor' : null),
                            maxLabel: questionData.maxLabel ?? (type === 'linearScale' ? 'Excellent' : null)
                        }
                    );
                });
                return section;
            });
            this.viewModel.calculateWeights();
            this.viewModel.notifyUpdate();
            this.render();
        } catch (error) {
            this.render();
            throw error;
        }
    }

    deleteSection(sectionIndex) {
        this.viewModel.deleteSection(sectionIndex);
        this.viewModel.formTemplate.sections.forEach((section, sIndex) => {
            section.orderNumber = sIndex;
            section.questions.forEach((question, qIndex) => {
                question.orderNumber = qIndex;
            });
        });
        this.render();
    }

    deleteQuestion(sectionIndex, questionIndex) {
        this.viewModel.deleteQuestion(sectionIndex, questionIndex);
        if (this.viewModel.formTemplate.sections[sectionIndex]) {
            this.viewModel.formTemplate.sections[sectionIndex].questions.forEach((question, qIndex) => {
                question.orderNumber = qIndex;
            });
        }
        this.render();
    }

    undo() {
        if (!this.viewModel.history.length) return;
        this.viewModel.undo();
        this.viewModel.formTemplate.sections.forEach((section, sIndex) => {
            section.orderNumber = sIndex;
            section.questions.forEach((question, qIndex) => {
                question.orderNumber = qIndex;
            });
        });
        this.render();
    }

    redo() {
        if (!this.viewModel.undone.length) return;
        this.viewModel.redo();
        this.viewModel.formTemplate.sections.forEach((section, sIndex) => {
            section.orderNumber = sIndex;
            section.questions.forEach((question, qIndex) => {
                question.orderNumber = qIndex;
            });
        });
        this.render();
    }

    render() {
        if (!this.container) return;

        const focusedElement = document.activeElement;
        const focusedId = focusedElement ? focusedElement.id : null;
        const selectionStart = focusedElement && ['INPUT', 'TEXTAREA'].includes(focusedElement.tagName) ? focusedElement.selectionStart : null;
        const selectionEnd = focusedElement && ['INPUT', 'TEXTAREA'].includes(focusedElement.tagName) ? focusedElement.selectionEnd : null;

        DomHelper.clear(this.container);
        this.undoBtn.disabled = !(this.viewModel && this.viewModel.history && this.viewModel.history.length);
        this.redoBtn.disabled = !(this.viewModel && this.viewModel.undone && this.viewModel.undone.length);
        this.addSectionBtn.disabled = this.viewModel.formTemplate.sections.length >= this.options.section.maxSection;
        this.addQuestionBtn.disabled = this.isAddQuestionDisabled();

        const fragment = document.createDocumentFragment();
        fragment.appendChild(this.renderTemplateDetails());
        fragment.appendChild(this.toolbar);
        fragment.appendChild(this.sectionsContainer);

        DomHelper.clear(this.sectionsContainer);
        const sectionsFragment = document.createDocumentFragment();
        if (!this.viewModel.formTemplate.sections || this.viewModel.formTemplate.sections.length === 0) {
            const emptyMessage = DomHelper.createElement('div', {
                className: 'text-center text-secondary p-6'
            }, 'No sections available. Add a section to start.');
            sectionsFragment.appendChild(emptyMessage);
        } else {
            this.viewModel.formTemplate.sections.forEach((section, index) => {
                if (!section) {
                    return;
                }
                sectionsFragment.appendChild(this.renderSection(section, index));
            });
        }
        this.sectionsContainer.appendChild(sectionsFragment);

        this.container.appendChild(fragment);
        this.setupSortable();
        this.setupEventDelegation();

        if (this.newSectionIndex !== null) {
            const newSection = this.sectionsContainer.querySelector(`[data-section-index="${this.newSectionIndex}"]`);
            if (newSection) {
                newSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
            this.newSectionIndex = null;
        } else if (this.newQuestion.sectionIndex !== null && this.newQuestion.questionIndex !== null) {
            const newQuestion = this.sectionsContainer.querySelector(
                `[data-section-index="${this.newQuestion.sectionIndex}"][data-question-index="${this.newQuestion.questionIndex}"]`
            );
            if (newQuestion) {
                newQuestion.scrollIntoView({ behavior: 'smooth', block: 'center' });
                const titleInput = newQuestion.querySelector('[data-type="question-title"]');
                if (titleInput) {
                    titleInput.focus();
                }
            }
            this.newQuestion = { sectionIndex: null, questionIndex: null };
        }

        if (focusedId) {
            const newFocusedElement = document.getElementById(focusedId);
            if (newFocusedElement && ['INPUT', 'TEXTAREA'].includes(newFocusedElement.tagName)) {
                newFocusedElement.focus();
                if (selectionStart !== null && selectionEnd !== null) {
                    newFocusedElement.setSelectionRange(selectionStart, selectionEnd);
                }
            }
        }
    }

    renderTemplateDetails() {
        const templateDescription = DomHelper.createElement('div', { className: 'template-description', popover: 'auto' });
        const fieldset = DomHelper.createElement('fieldset', { className: 'template-description-container' });

        const titleCol = DomHelper.createElement('div', { className: 'template-description-title' });
        const titleLabel = DomHelper.createElement('label', {
            className: 'form-label',
            for: 'inp-create-template-title'
        }, 'Template Title');
        const titleInput = DomHelper.createElement('input', {
            type: 'text',
            className: 'form-control',
            id: 'inp-create-template-title',
            name: 'title',
            value: this.viewModel.formTemplate.title,
            required: true,
            spellcheck: false,
            'data-ms-editor': true
        });
        DomHelper.appendChildren(titleCol, titleLabel, titleInput);

        const positionCol = DomHelper.createElement('div', { className: 'template-description-position' });
        const positionLabel = DomHelper.createElement('label', {
            className: 'form-label',
            for: 'sel-create-template-position'
        }, 'Position');
        const positionSelect = DomHelper.createElement('select', {
            className: 'form-select',
            id: 'sel-create-template-position',
            name: 'position',
            required: true
        });
        const selectedPosition = this.viewModel.formTemplate.positionId;
        const options = this.templatePositions.map(pos =>
            `<option value="${pos.value}" ${selectedPosition === pos.value ? 'selected' : ''}>${pos.label}</option>`
        ).join('');
        positionSelect.innerHTML = `<option value="">Select position</option>${options}`;
        DomHelper.appendChildren(positionCol, positionLabel, positionSelect);

        const descCol = DomHelper.createElement('div', { className: 'template-description-description' });
        const descLabel = DomHelper.createElement('label', {
            className: 'form-label',
            for: 'txt-create-template-description'
        }, 'Description');
        const descTextarea = DomHelper.createElement('textarea', {
            className: 'form-control lh-base',
            id: 'txt-create-template-description',
            name: 'description',
            rows: '5',
            spellcheck: false,
            'data-ms-editor': true
        });
        descTextarea.value = this.viewModel.formTemplate.description || '';
        DomHelper.appendChildren(descCol, descLabel, descTextarea);

        const createdByCol = DomHelper.createElement('div', { className: 'template-description-created-by' });
        const createdByLabel = DomHelper.createElement('label', {
            className: 'form-label',
            for: 'inp-created-by'
        }, 'Created By');
        const createdByInput = DomHelper.createElement('input', {
            type: 'text',
            className: 'form-control',
            id: 'inp-created-by',
            name: 'createdBy',
            value: this.viewModel.formTemplate.createdBy || '',
            disabled: true
        });
        DomHelper.appendChildren(createdByCol, createdByLabel, createdByInput);

        DomHelper.appendChildren(fieldset, titleCol, positionCol, descCol, createdByCol);
        DomHelper.appendChildren(templateDescription, fieldset);

        if (this.options.section.showDescription && this.minimap) {
            this.renderMinimap();
            DomHelper.appendChildren(templateDescription, this.minimap);
        }

        return templateDescription;
    }

    setupInputListeners() {
        const debouncedRender = debounce(() => this.render(), 100);

        this.container.addEventListener('input', (e) => {
            const target = e.target;
            const sectionIndex = parseInt(target.dataset.sectionIndex);
            const questionIndex = target.dataset.questionIndex !== undefined ? parseInt(target.dataset.questionIndex) : null;

            if (isNaN(sectionIndex) && target.dataset.type && target.dataset.type.includes('section')) {
                return;
            }
            if (target.dataset.type && target.dataset.type.includes('question') && (isNaN(questionIndex) || questionIndex === null)) {
                return;
            }

            if (target.id === 'inp-create-template-title') {
                this.viewModel.updateTemplateTitle(target.value);
                this.viewModel.notifyUpdate();
                debouncedRender();
            } else if (target.id === 'txt-create-template-description') {
                this.viewModel.updateTemplateDescription(target.value);
                this.viewModel.notifyUpdate();
                debouncedRender();
            } else if (target.id === 'sel-create-template-position') {
                this.viewModel.updateTemplatePosition(target.value);
                this.viewModel.formTemplate.positionId = target.value;
                this.viewModel.notifyUpdate();
                this.render();
            } else if (target.dataset.type === 'section-title') {
                this.updateSectionTitle(sectionIndex, target.value);
                this.viewModel.notifyUpdate();
                debouncedRender();
            } else if (target.dataset.type === 'section-description') {
                this.updateSectionDescription(sectionIndex, target.value);
                this.viewModel.notifyUpdate();
                debouncedRender();
            } else if (target.dataset.type === 'question-title' && questionIndex !== null) {
                this.viewModel.updateQuestionTitle(sectionIndex, questionIndex, target.value);
                this.viewModel.notifyUpdate();
                debouncedRender();
            } else if (target.dataset.type === 'question-type' && questionIndex !== null) {
                this.viewModel.updateQuestionType(sectionIndex, questionIndex, target.value);
                this.viewModel.notifyUpdate();
                this.render();
            } else if (target.dataset.type === 'min-value' && questionIndex !== null) {
                this.viewModel.updateQuestionMinValue(sectionIndex, questionIndex, parseInt(target.value));
                this.viewModel.notifyUpdate();
                this.render();
            } else if (target.dataset.type === 'max-value' && questionIndex !== null) {
                this.viewModel.updateQuestionMaxValue(sectionIndex, questionIndex, parseInt(target.value));
                this.viewModel.notifyUpdate();
                this.render();
            } else if (target.dataset.type === 'min-label' && questionIndex !== null) {
                this.viewModel.updateQuestionMinLabel(sectionIndex, questionIndex, target.value);
                this.viewModel.notifyUpdate();
                debouncedRender();
            } else if (target.dataset.type === 'max-label' && questionIndex !== null) {
                this.viewModel.updateQuestionMaxLabel(sectionIndex, questionIndex, target.value);
                this.viewModel.notifyUpdate();
                debouncedRender();
            }
        });
    }

    setupEventDelegation() {
        this.sectionsContainer.removeEventListener('click', this.handleClick);
        this.sectionsContainer.removeEventListener('change', this.handleChange);

        this.handleClick = (e) => {
            if (e.target.closest('input[type="checkbox"], label.form-check-label')) {
                return;
            }

            e.preventDefault();
            const target = e.target.closest('[data-action]');
            if (!target) {
                const section = e.target.closest('[data-section-index]');
                if (section && !e.target.closest('button, input, textarea, select, .dropdown-menu')) {
                    this.viewModel.selectedSectionIndex = parseInt(section.dataset.sectionIndex);
                    this.render();
                }
                return;
            }

            const sectionIndex = parseInt(target.dataset.sectionIndex);
            const questionIndex = target.dataset.questionIndex !== undefined ? parseInt(target.dataset.questionIndex) : null;
            const action = target.dataset.action;

            if (action === 'delete-section') {
                this.deleteSection(sectionIndex);
            } else if (action === 'duplicate-section') {
                if (this.viewModel.formTemplate.sections.length >= this.options.section.maxSection) {
                    return;
                }
                this.viewModel.duplicateSection(sectionIndex);
                this.viewModel.formTemplate.sections.forEach((section, sIndex) => {
                    section.orderNumber = sIndex;
                    section.questions.forEach((question, qIndex) => {
                        question.orderNumber = qIndex;
                    });
                });
                this.newSectionIndex = sectionIndex + 1;
                this.render();
            } else if (action === 'delete-question') {
                this.deleteQuestion(sectionIndex, questionIndex);
            } else if (action === 'duplicate-question') {
                const section = this.viewModel.formTemplate.sections[sectionIndex];
                if (!section || section.questions.length >= this.options.question.maxQuestions) {
                    return;
                }
                this.viewModel.duplicateQuestion(sectionIndex, questionIndex);
                if (this.viewModel.formTemplate.sections[sectionIndex]) {
                    this.viewModel.formTemplate.sections[sectionIndex].questions.forEach((question, qIndex) => {
                        question.orderNumber = qIndex;
                    });
                }
                this.newQuestion = { sectionIndex, questionIndex: questionIndex + 1 };
                this.render();
            }
        };

        this.handleChange = (e) => {
            const target = e.target;
            if (target.type === 'checkbox' && target.classList.contains('form-check-input') && target.dataset.type === 'question-required') {
                const sectionIndex = parseInt(target.dataset.sectionIndex);
                const questionIndex = parseInt(target.dataset.questionIndex);

                if (isNaN(sectionIndex) || isNaN(questionIndex) || !this.viewModel.formTemplate.sections[sectionIndex]?.questions[questionIndex]) {
                    return;
                }

                const newChecked = target.checked;
                const currentRequired = this.viewModel.formTemplate.sections[sectionIndex].questions[questionIndex].required;

                try {
                    this.viewModel.updateQuestionRequired(sectionIndex, questionIndex, newChecked, true);
                    target.checked = newChecked;
                    if (newChecked === true) {
                        target.setAttribute('checked', 'checked');
                    } else {
                        target.removeAttribute('checked');
                    }
                } catch (error) {
                    target.checked = currentRequired;
                    if (currentRequired === true) {
                        target.setAttribute('checked', 'checked');
                    } else {
                        target.removeAttribute('checked');
                    }
                }

                this.setUnsaved(true);
                this.stateObservable.notify();
            }
        };

        this.sectionsContainer.addEventListener('click', this.handleClick);
        this.sectionsContainer.addEventListener('change', this.handleChange, { capture: true });
    }

    renderSection(section, sectionIndex) {
        const sectionElement = DomHelper.createElement('section', {
            className: `template-section ${this.viewModel.selectedSectionIndex === sectionIndex ? 'section-active' : ''}`,
            'data-section-index': sectionIndex,
            'data-section-id': section.id,
            role: 'region',
            'aria-label': `Section ${sectionIndex + 1}`
        });

        const fieldset = DomHelper.createElement('fieldset', { className: 'template-section-description-container' });

        const weightBadgeContainer = DomHelper.createElement('div', { className: 'template-weight-badge-container' });
        const weightBadge = DomHelper.createElement('span', {
            className: 'template-section-weight-score'
        }, `Weight Score: ${((section.weightScore || 0).toFixed(2) * 100).toFixed(0)}%`);
        DomHelper.appendChildren(weightBadgeContainer, weightBadge);
        fieldset.appendChild(weightBadgeContainer);

        const descriptionContainer = DomHelper.createElement('div', { className: 'template-section-description-container' });
        descriptionContainer.appendChild(this.renderSectionTitle(sectionIndex, section.title));
        descriptionContainer.appendChild(this.renderSectionDropdown(sectionIndex));
        if (this.options.section.showDescription) {
            descriptionContainer.appendChild(this.renderSectionDescription(sectionIndex, section.description));
        }

        fieldset.appendChild(descriptionContainer);
        sectionElement.appendChild(fieldset);
        sectionElement.appendChild(this.renderQuestionContainer(sectionIndex, section.questions));

        return sectionElement;
    }

    renderSectionTitle(sectionIndex, title) {
        const titleWrapper = DomHelper.createElement('div', { className: 'template-section-description-title' });
        const titleLabel = DomHelper.createElement('label', {
            className: 'form-label',
            for: `section-title-${sectionIndex}`
        }, 'Section Title');
        const titleInput = DomHelper.createElement('input', {
            type: 'text',
            className: 'form-control',
            value: title,
            id: `section-title-${sectionIndex}`,
            'data-section-index': sectionIndex,
            'data-type': 'section-title',
            spellcheck: false,
            'data-ms-editor': true
        });
        DomHelper.appendChildren(titleWrapper, titleLabel, titleInput);
        return titleWrapper;
    }

    renderSectionDescription(sectionIndex, description) {
        const descWrapper = DomHelper.createElement('div', { className: 'template-section-description-description' });
        const descLabel = DomHelper.createElement('label', {
            className: 'form-label',
            for: `section-description-${sectionIndex}`
        }, 'Section Description');
        const descTextarea = DomHelper.createElement('textarea', {
            className: 'form-control lh-base',
            rows: '5',
            placeholder: 'Section description (optional)',
            id: `section-description-${sectionIndex}`,
            'data-section-index': sectionIndex,
            'data-type': 'section-description',
            spellcheck: false,
            'data-ms-editor': true
        });

        const currentTextarea = document.getElementById(`section-description-${sectionIndex}`);
        if (currentTextarea && document.activeElement === currentTextarea) {
            descTextarea.value = currentTextarea.value;
        } else {
            descTextarea.value = description || '';
        }

        DomHelper.appendChildren(descWrapper, descLabel, descTextarea);
        return descWrapper;
    }

    renderSectionDropdown(sectionIndex) {
        const dropdownWrapper = DomHelper.createElement('div', { className: 'template-section-description-actions' });
        const dropdownBtn = DomHelper.createElement('button', {
            className: 'btn btn-outline-secondary btn-section-dropdown',
            type: 'button',
            'data-bs-toggle': 'dropdown',
            'aria-expanded': 'false'
        }, '<span class="vi-solid vi-more-vertical"></span>');
        const dropdownMenu = DomHelper.createElement('ul', { className: 'dropdown-menu' });

        const deleteItem = DomHelper.createElement('li');
        const deleteLink = DomHelper.createElement('a', {
            className: 'dropdown-item text-danger',
            href: '#',
            'data-section-index': sectionIndex,
            'data-action': 'delete-section'
        }, 'Delete');
        DomHelper.appendChildren(deleteItem, deleteLink);

        const duplicateItem = DomHelper.createElement('li');
        const duplicateLink = DomHelper.createElement('a', {
            className: 'dropdown-item',
            href: '#',
            'data-section-index': sectionIndex,
            'data-action': 'duplicate-section'
        }, 'Duplicate');
        DomHelper.appendChildren(duplicateItem, duplicateLink);

        DomHelper.appendChildren(dropdownMenu, deleteItem, duplicateItem);
        DomHelper.appendChildren(dropdownWrapper, dropdownBtn, dropdownMenu);
        return dropdownWrapper;
    }

    renderQuestionContainer(sectionIndex, questions) {
        const container = DomHelper.createElement('div', {
            className: 'template-questions-container',
            'data-section-index': sectionIndex
        });
        if (!questions || questions.length === 0) {
            const emptyMessage = DomHelper.createElement('div', {
                className: 'text-center text-secondary p-4'
            }, 'No questions in this section. Add a question to start.');
            container.appendChild(emptyMessage);
        } else {
            questions.forEach((question, questionIndex) => {
                if (!question) {
                    return;
                }
                const questionElement = this.renderQuestion(sectionIndex, questionIndex, question);
                container.appendChild(questionElement);
            });
        }
        return container;
    }

    renderQuestion(sectionIndex, questionIndex, question) {
        const questionCard = DomHelper.createElement('div', { className: 'template-question-card' });
        const fieldset = DomHelper.createElement('fieldset', {
            className: 'template-question-container',
            'data-section-index': sectionIndex,
            'data-question-index': questionIndex,
            'data-question-id': question.id
        });

        if (this.options.question.reorder) {
            const handle = DomHelper.createElement('span', {
                className: 'template-question-card-drag-handle',
                style: 'cursor: grabbing;'
            }, '<span class="vi-solid vi-drag-horizontal"></span>');
            fieldset.appendChild(handle);
        }

        const weightBadgeContainer = DomHelper.createElement('div', { className: 'template-weight-badge-container' });
        const weightBadge = DomHelper.createElement('span', {
            className: 'template-question-weight-score'
        }, `Weight Score: ${((question.weightScore || 0).toFixed(2) * 100).toFixed(0)}%`);
        DomHelper.appendChildren(weightBadgeContainer, weightBadge);
        fieldset.appendChild(weightBadgeContainer);

        const descriptionContainer = DomHelper.createElement('div', { className: 'template-question-description-container' });

        const titleCol = DomHelper.createElement('div', { className: 'template-question-description-title' });
        const titleLabel = DomHelper.createElement('label', {
            className: 'form-label',
            for: `question-title-${sectionIndex}-${questionIndex}`
        }, 'Question');
        const titleInput = DomHelper.createElement('input', {
            type: 'text',
            className: 'form-control',
            id: `question-title-${sectionIndex}-${questionIndex}`,
            value: question.title || 'Untitled Question',
            'data-section-index': sectionIndex,
            'data-question-index': questionIndex,
            'data-question-id': question.id,
            'data-type': 'question-title',
            spellcheck: false,
            'data-ms-editor': true
        });
        DomHelper.appendChildren(titleCol, titleLabel, titleInput);

        const typeCol = DomHelper.createElement('div', { className: 'template-question-description-type' });
        const typeLabel = DomHelper.createElement('label', {
            className: 'form-label',
            for: `question-type-${sectionIndex}-${questionIndex}`
        }, 'Type');
        const typeSelect = DomHelper.createElement('select', {
            className: 'form-select',
            id: `question-type-${sectionIndex}-${questionIndex}`,
            'data-section-index': sectionIndex,
            'data-question-index': questionIndex,
            'data-question-id': question.id,
            'data-type': 'question-type'
        });
        typeSelect.innerHTML = `
            <option value="linearScale" ${question.type === 'linearScale' ? 'selected' : ''}>Linear Scale</option>
            <option value="text" ${question.type === 'text' ? 'selected' : ''}>Text</option>
        `;
        DomHelper.appendChildren(typeCol, typeLabel, typeSelect);

        DomHelper.appendChildren(descriptionContainer, titleCol, typeCol);
        fieldset.appendChild(descriptionContainer);

        if (question.type === 'linearScale') {
            fieldset.appendChild(this.renderLinearScaleFields(sectionIndex, questionIndex, question));
        }

        fieldset.appendChild(this.renderQuestionActions(sectionIndex, questionIndex, question));
        questionCard.appendChild(fieldset);
        return questionCard;
    }

    renderLinearScaleFields(sectionIndex, questionIndex, question) {
        const wrapper = DomHelper.createElement('div', { className: 'template-question-linear-scale-type-container' });

        const minCol = DomHelper.createElement('div', { className: 'template-question-linear-scale-type-min-select' });
        const minLabel = DomHelper.createElement('label', {
            className: 'form-label',
            for: `min-value-${sectionIndex}-${questionIndex}`
        }, 'Min Value');
        const minSelect = DomHelper.createElement('select', {
            className: 'form-select',
            id: `min-value-${sectionIndex}-${questionIndex}`,
            'data-section-index': sectionIndex,
            'data-question-index': questionIndex,
            'data-question-id': question.id,
            'data-type': 'min-value'
        });
        const minScore = question.minScore ?? 1;
        minSelect.innerHTML = `
            <option value="0" ${minScore === 0 ? 'selected' : ''}>0</option>
            <option value="1" ${minScore === 1 ? 'selected' : ''}>1</option>
        `;
        DomHelper.appendChildren(minCol, minLabel, minSelect);

        const maxCol = DomHelper.createElement('div', { className: 'template-question-linear-scale-type-max-select' });
        const maxLabel = DomHelper.createElement('label', {
            className: 'form-label',
            for: `max-value-${sectionIndex}-${questionIndex}`
        }, 'Max Value');
        const maxSelect = DomHelper.createElement('select', {
            className: 'form-select',
            id: `max-value-${sectionIndex}-${questionIndex}`,
            'data-section-index': sectionIndex,
            'data-question-index': questionIndex,
            'data-question-id': question.id,
            'data-type': 'max-value'
        });
        const maxScore = question.maxScore ?? 5;
        maxSelect.innerHTML = `
            <option value="2" ${maxScore === 2 ? 'selected' : ''}>2</option>
            <option value="3" ${maxScore === 3 ? 'selected' : ''}>3</option>
            <option value="4" ${maxScore === 4 ? 'selected' : ''}>4</option>
            <option value="5" ${maxScore === 5 ? 'selected' : ''}>5</option>
        `;
        DomHelper.appendChildren(maxCol, maxLabel, maxSelect);

        const minLabelCol = DomHelper.createElement('div', { className: 'template-question-linear-scale-type-min-label' });
        const minLabelLabel = DomHelper.createElement('label', {
            className: 'form-label',
            for: `min-label-${sectionIndex}-${questionIndex}`
        }, 'Min Label');
        const minLabelInput = DomHelper.createElement('input', {
            type: 'text',
            className: 'form-control',
            id: `min-label-${sectionIndex}-${questionIndex}`,
            value: question.minLabel ?? 'Poor',
            'data-section-index': sectionIndex,
            'data-question-index': questionIndex,
            'data-question-id': question.id,
            'data-type': 'min-label',
            spellcheck: false,
            'data-ms-editor': true
        });
        DomHelper.appendChildren(minLabelCol, minLabelLabel, minLabelInput);

        const maxLabelCol = DomHelper.createElement('div', { className: 'template-question-linear-scale-type-max-label' });
        const maxLabelLabel = DomHelper.createElement('label', {
            className: 'form-label',
            for: `max-label-${sectionIndex}-${questionIndex}`
        }, 'Max Label');
        const maxLabelInput = DomHelper.createElement('input', {
            type: 'text',
            className: 'form-control',
            id: `max-label-${sectionIndex}-${questionIndex}`,
            value: question.maxLabel ?? 'Excellent',
            'data-section-index': sectionIndex,
            'data-question-index': questionIndex,
            'data-question-id': question.id,
            'data-type': 'max-label',
            spellcheck: false,
            'data-ms-editor': true
        });
        DomHelper.appendChildren(maxLabelCol, maxLabelLabel, maxLabelInput);

        DomHelper.appendChildren(wrapper, minCol, maxCol, minLabelCol, maxLabelCol);
        return wrapper;
    }

    renderQuestionActions(sectionIndex, questionIndex, question) {
        const actions = DomHelper.createElement('div', { className: 'template-question-actions' });
        const requiredSwitch = DomHelper.createElement('div', { className: 'template-question-actions-required form-check form-switch' });
        const requiredInput = DomHelper.createElement('input', {
            type: 'checkbox',
            className: 'form-check-input',
            id: `required-${sectionIndex}-${questionIndex}`,
            checked: question.required,
            'data-section-index': sectionIndex,
            'data-question-index': questionIndex,
            'data-question-id': question.id,
            'data-type': 'question-required'
        });
        const requiredLabel = DomHelper.createElement('label', {
            className: 'form-check-label',
            for: `required-${sectionIndex}-${questionIndex}`
        }, 'Required');
        DomHelper.appendChildren(requiredSwitch, requiredInput, requiredLabel);

        const deleteBtn = DomHelper.createElement('button', {
            className: 'template-question-actions-delete btn text-danger',
            type: 'button',
            title: 'Delete Question',
            'data-section-index': sectionIndex,
            'data-question-index': questionIndex,
            'data-question-id': question.id,
            'data-action': 'delete-question'
        }, '<span class="vi-solid vi-trash"></span>');

        const duplicateBtn = DomHelper.createElement('button', {
            className: 'template-question-actions-duplicate btn text-secondary',
            type: 'button',
            title: 'Duplicate Question',
            'data-section-index': sectionIndex,
            'data-question-index': questionIndex,
            'data-question-id': question.id,
            'data-action': 'duplicate-question'
        }, '<span class="vi-solid vi-copy"></span>');

        DomHelper.appendChildren(actions, requiredSwitch, deleteBtn, duplicateBtn);
        return actions;
    }

    renderMinimap() {
        DomHelper.clear(this.minimapList);
        if (this.viewModel.formTemplate.sections.length === 0) {
            const emptyMessage = DomHelper.createElement('li', {
                className: 'template-section-pane-list-item text-center text-secondary p-6 section-empty'
            }, 'No sections added yet');
            this.minimapList.appendChild(emptyMessage);
        } else {
            const fragment = document.createDocumentFragment();
            this.viewModel.formTemplate.sections.forEach((section, index) => {
                fragment.appendChild(this.renderMinimapItem(section, index));
            });
            this.minimapList.appendChild(fragment);
        }
        this.setupMinimapSortable();
    }

    renderMinimapItem(section, sectionIndex) {
        const listItem = DomHelper.createElement('li', {
            className: `template-section-pane-list-item template-section-pane-drappable-section`,
            'data-section-index': sectionIndex,
            'data-section-id': section.id,
            role: 'button',
            'aria-label': `Go to section ${sectionIndex + 1}`
        });

        if (this.options.section.reorder) {
            const dragHandle = DomHelper.createElement('span', {
                className: 'vi-solid vi-drag-horizontal template-section-pane-drag-handle',
                style: 'cursor: move;'
            });
            const titleSpan = DomHelper.createElement('span', {
                className: 'template-section-pane-list-title'
            }, section.title || `Section ${sectionIndex + 1}`);
            DomHelper.appendChildren(listItem, dragHandle, titleSpan);
        } else {
            listItem.textContent = section.title || `Section ${sectionIndex + 1}`;
        }

        listItem.addEventListener('click', () => {
            this.viewModel.selectedSectionIndex = sectionIndex;
            const targetSection = this.sectionsContainer.querySelector(`[data-section-index="${sectionIndex}"]`);
            if (targetSection) targetSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
            this.render();
        });

        return listItem;
    }

    setupMinimapSortable() {
        if (this.minimapSortable && typeof this.minimapSortable.destroy === 'function') {
            this.minimapSortable.destroy();
        }

        if (this.options.section.reorder) {
            this.minimapSortable = Sortable.create(this.minimapList, {
                animation: 150,
                onEnd: (evt) => {
                    const fromIndex = evt.oldIndex;
                    const toIndex = evt.newIndex;
                    if (fromIndex !== toIndex) {
                        this.viewModel.reorderSection(fromIndex, toIndex);
                        this.viewModel.formTemplate.sections.forEach((section, sIndex) => {
                            section.orderNumber = sIndex;
                            section.questions.forEach((question, qIndex) => {
                                question.orderNumber = qIndex;
                            });
                        });
                        this.render();
                    }
                }
            });
        }
    }

    setupSortable() {
        if (this.questionSortables) {
            this.questionSortables.forEach(sortable => sortable.destroy());
        }
        this.questionSortables = [];

        if (this.options.question.reorder) {
            const questionContainers = this.container.querySelectorAll('.template-questions-container');
            questionContainers.forEach((container) => {
                const sectionIndex = parseInt(container.dataset.sectionIndex);
                const sortable = Sortable.create(container, {
                    animation: 150,
                    group: 'questions',
                    handle: '.template-question-card-drag-handle',
                    onEnd: (evt) => {
                        const fromSectionIndex = parseInt(evt.from.dataset.sectionIndex);
                        const toSectionIndex = parseInt(evt.to.dataset.sectionIndex);
                        const fromIndex = evt.oldIndex;
                        const toIndex = evt.newIndex;

                        if (fromSectionIndex === toSectionIndex) {
                            if (fromIndex !== toIndex) {
                                this.viewModel.reorderQuestion(fromSectionIndex, fromIndex, toIndex);
                                this.viewModel.formTemplate.sections[fromSectionIndex].questions.forEach((question, qIndex) => {
                                    question.orderNumber = qIndex;
                                });
                            }
                        } else {
                            if (fromIndex < this.viewModel.formTemplate.sections[fromSectionIndex].questions.length &&
                                toIndex <= this.viewModel.formTemplate.sections[toSectionIndex].questions.length &&
                                this.viewModel.formTemplate.sections[toSectionIndex].questions.length < this.options.question.maxQuestions) {
                                this.viewModel.transferQuestion(fromSectionIndex, toSectionIndex, fromIndex, toIndex);
                                this.viewModel.formTemplate.sections[fromSectionIndex].questions.forEach((question, qIndex) => {
                                    question.orderNumber = qIndex;
                                });
                                this.viewModel.formTemplate.sections[toSectionIndex].questions.forEach((question, qIndex) => {
                                    question.orderNumber = qIndex;
                                });
                            }
                        }
                        this.render();
                    }
                });
                this.questionSortables.push(sortable);
            });
        }
    }
}