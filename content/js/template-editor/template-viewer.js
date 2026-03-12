import { DomHelper } from './utils.js';

export class TemplateViewer {
    constructor(containerId, options = { data: {}, previewMode: false, onCompletionChange, submitId: 'submit-view', submitText: 'Submit', titleAction: '', onAutoSave }) {
        const {
            data = {},
            previewMode = false,
            onCompletionChange = () => { },
            submitId = 'submit-view',
            submitText = 'Finish',
            titleAction = '',
            onAutoSave = () => { }
        } = options;

        this.container = document.getElementById(containerId);
        if (!this.container) {
            throw new Error(`Container with ID '${containerId}' not found`);
        }

        if (!data || typeof data !== 'object' || Array.isArray(data)) {
            throw new Error('Data must be a single FormTemplate object');
        }

        if (!previewMode) {
            this.validateReview(data);
        }

        this._formData = this.initializeReview(data);
        this._lastSavedData = !previewMode ? JSON.stringify(this._formData) : null; // Track last saved state only in non-preview mode
        this.previewMode = previewMode;
        this.currentSection = 0;
        this.onCompletionChange = typeof onCompletionChange === 'function' ? onCompletionChange : () => {};
        this.onAutoSave = typeof onAutoSave === 'function' ? onAutoSave : () => {};
        this.nextButton = null;
        this.submitId = submitId;
        this.submitText = submitText;
        this.titleAction = titleAction;
        this.saveState = 'idle'; // State: idle, changed, saving, saved, lastEdited
        this.lastSaveTime = null; // Timestamp of last save
        this.updateInterval = null; // Interval for updating last edited time
        this.lastEditedTimeout = null; // Timeout for transitioning to lastEdited

        this.review = this._formData;
        this.formData = this._formData;
        if (!this.previewMode) {
            this.fields = this.generateFields();
        }

        this.debounce = (func, wait) => {
            let timeout;
            return (...args) => {
                clearTimeout(timeout);
                timeout = setTimeout(() => func.apply(this, args), wait);
            };
        };

        // Debounced autosave function
        this.autoSaveDebounced = this.debounce(() => {
            // Only autosave if not in preview mode
            if (this.previewMode) return;

            // Check if there are actual changes before saving
            const currentDataString = JSON.stringify(this._formData);
            if (currentDataString !== this._lastSavedData) {
                this.saveState = 'saving';
                this.render();
                this.onAutoSave(this._formData);
                this._lastSavedData = currentDataString; // Update last saved state

                // Transition to saved after 2 seconds
                setTimeout(() => {
                    this.saveState = 'saved';
                    this.lastSaveTime = Date.now();
                    this.render();
                    // Schedule transition to lastEdited after 1 minute if no changes
                    this.lastEditedTimeout = setTimeout(() => {
                        if (this.saveState === 'saved') { // Only transition if still idle
                            this.saveState = 'lastEdited';
                            this.render();
                            // Start interval to update time every minute
                            if (this.updateInterval) {
                                clearInterval(this.updateInterval);
                            }
                            this.updateInterval = setInterval(() => {
                                this.render();
                            }, 60000); // Update every minute
                        }
                    }, 60000); // 1 minute
                }, 2000);
            }
        }, 2000);

        this.render();
        if (!this.previewMode) {
            this.checkCompletion();
        }
    }

    get data() {
        return this._formData;
    }

    set data(value) {
        if (!this.previewMode) {
            this.validateReview(value);
        }
        this._formData = this.initializeReview(value);
        if (!this.previewMode) {
            this._lastSavedData = JSON.stringify(this._formData); // Reset last saved state (only in non-preview mode)
        }
        this.review = this._formData;
        this.formData = this._formData;
        this.currentSection = 0;
        this.saveState = 'idle';
        this.lastSaveTime = null;
        if (this.updateInterval) {
            clearInterval(this.updateInterval);
            this.updateInterval = null;
        }
        if (this.lastEditedTimeout) {
            clearTimeout(this.lastEditedTimeout);
            this.lastEditedTimeout = null;
        }
        if (!this.previewMode) {
            this.fields = this.generateFields();
        }
        this.render();
        if (!this.previewMode) {
            this.checkCompletion();
        }
    }

    initializeReview(data) {
        const initializedData = {
            id: data.id || null,
            title: data.title || 'Untitled Form',
            description: data.description || '',
            positionName: data.positionName || '',
            createdBy: data.createdBy || '',
            reviewee: data.reviewee || '',
            sections: data.sections.map(section => ({
                ...section,
                questions: section.questions.map(question => {
                    const initialAnswer = question.answer !== undefined ? question.answer : 
                                        question.type === 'text' ? '' : null;
                    
                    return {
                        ...question,
                        // For linear scale questions, only set existing answers, otherwise null
                        // For text questions, use empty string only if there's an existing answer
                        answer: initialAnswer
                    };
                })
            }))
        };
        
        return initializedData;
    }

    validateReview(review) {
        if (!review.sections || !Array.isArray(review.sections) || review.sections.length === 0) {
            throw new Error('Review must have a non-empty array of sections');
        }

        review.sections.forEach((section, sectionIndex) => {
            if (!section.questions || !Array.isArray(section.questions) || section.questions.length === 0) {
                throw new Error(`Section ${sectionIndex} must have a non-empty array of questions`);
            }

            section.questions.forEach((question, questionIndex) => {
                if (question.type === 'linearScale') {
                    if (!('minScore' in question) || !('maxScore' in question)) {
                        throw new Error(`Question ${questionIndex} in section ${sectionIndex} must define minScore and maxScore for linearScale`);
                    }
                } else if (question.type !== 'text') {
                    throw new Error(`Question ${questionIndex} in section ${sectionIndex} has an invalid type`);
                }
            });
        });
    }

    generateFields() {
        const fields = {};

        this._formData.sections.forEach((section, sectionIndex) => {
            section.questions.forEach((question, questionIndex) => {
                const questionId = `q-${sectionIndex}-${questionIndex}`;
                fields[questionId] = {
                    highlightPlacement: (element) => element.closest('.template-question-card'),
                    errorPlacement: (element) => {
                        const container = element.closest('.template-question-container');
                        return container ? container.next() || container.parentElement : null;
                    }
                };
            });
        });

        return fields;
    }

    getTotalQuestions() {
        return this._formData.sections.reduce((acc, section) => acc + (section.questions?.length || 0), 0);
    }

    navigate(direction) {
        const totalSections = this._formData.sections.length;

        if (direction === 'back' && this.currentSection > 0) {
            this.currentSection--;
            this.render();
            this.scrollToSectionTop();
        } else if (direction === 'next' && this.currentSection < totalSections - 1) {
            const requiredAnswered = this.areRequiredQuestionsAnswered();
            
            if (this.previewMode || requiredAnswered) {
                this.currentSection++;
                this.render();
                this.scrollToSectionTop();
            } else {
                // Navigation blocked - show validation feedback
                this.showValidationFeedback();
            }
        } else {
            this.render();
        }
    }

    scrollToSectionTop() {
        const sectionContainer = this.container.querySelector('.template-section-container');
        if (sectionContainer) {
            sectionContainer.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
    }

    updateAnswer(sectionIndex, questionIndex, value) {
        const question = this._formData.sections[sectionIndex].questions[questionIndex];

        // Only update if the value has actually changed
        if (question.answer !== value) {
            question.answer = value;
            this.render();
            if (!this.previewMode) {
                this.checkCompletion();

                // Check if the current data differs from the last saved state
                const currentDataString = JSON.stringify(this._formData);
                if (currentDataString !== this._lastSavedData) {
                    // Data has changed, set state to 'changed' and trigger autosave
                    this.saveState = 'changed';
                    if (value !== null && value !== undefined && value !== '') {
                        // Clear lastEdited timeout to prevent transition if changes occur
                        if (this.lastEditedTimeout) {
                            clearTimeout(this.lastEditedTimeout);
                            this.lastEditedTimeout = null;
                        }
                        this.autoSaveDebounced();
                    }
                } else {
                    // Data matches last saved state, revert to appropriate state
                    if (this.lastSaveTime) {
                        this.saveState = 'saved';
                        // Schedule transition to lastEdited if no further changes
                        this.lastEditedTimeout = setTimeout(() => {
                            if (this.saveState === 'saved') {
                                this.saveState = 'lastEdited';
                                this.render();
                                if (this.updateInterval) {
                                    clearInterval(this.updateInterval);
                                }
                                this.updateInterval = setInterval(() => {
                                    this.render();
                                }, 60000);
                            }
                        }, 60000);
                    } else {
                        this.saveState = 'idle';
                    }
                    // Clear any pending autosave
                    clearTimeout(this.autoSaveDebounced.timeout);
                }
                this.render();
            }
        }
    }

    checkCompletion() {
        const allQuestions = this._formData.sections.flatMap(section => section.questions);
        const requiredQuestions = allQuestions.filter(q => q.required);

        const allAnswered = requiredQuestions.every(question => {
            let isAnswered = false;
            
            if (question.type === 'linearScale') {
                if (question.answer === null || question.answer === undefined) {
                    isAnswered = false;
                } else {
                    // Check if the answer is within the valid range
                    const minScore = question.minScore || 0;
                    const maxScore = question.maxScore || 5;
                    isAnswered = question.answer >= minScore && question.answer <= maxScore;
                }
            } else if (question.type === 'text') {
                isAnswered = question.answer !== null && 
                       question.answer !== undefined && 
                       question.answer.toString().trim() !== '';
            } else {
                // Default case
                isAnswered = question.answer !== null && question.answer !== undefined;
            }
            
            return isAnswered;
        });
        this.onCompletionChange(allAnswered);

        const currentSectionQuestions = this._formData.sections[this.currentSection]?.questions || [];
        
        const isCurrentSectionComplete = currentSectionQuestions.every(question => {
            if (!question.required) {
                return true;
            }
            
            let isAnswered = false;
            
            if (question.type === 'linearScale') {
                if (question.answer === null || question.answer === undefined) {
                    isAnswered = false;
                } else {
                    // Check if the answer is within the valid range
                    const minScore = question.minScore || 0;
                    const maxScore = question.maxScore || 5;
                    isAnswered = question.answer >= minScore && question.answer <= maxScore;
                }
            } else if (question.type === 'text') {
                isAnswered = question.answer !== null && 
                       question.answer !== undefined && 
                       question.answer.toString().trim() !== '';
            } else {
                // Default case
                isAnswered = question.answer !== null && question.answer !== undefined;
            }
            
            return isAnswered;
        });

        return isCurrentSectionComplete;
    }

    areRequiredQuestionsAnswered() {
        const section = this._formData.sections[this.currentSection];
        
        const result = section.questions.every(question => {
            if (!question.required) {
                return true;
            }
            
            let isAnswered = false;
            
            // For linear scale questions, null means no selection, 0 is a valid selection ONLY if minScore is 0
            if (question.type === 'linearScale') {
                if (question.answer === null || question.answer === undefined) {
                    isAnswered = false;
                } else {
                    // Check if the answer is within the valid range
                    const minScore = question.minScore || 0;
                    const maxScore = question.maxScore || 5;
                    isAnswered = question.answer >= minScore && question.answer <= maxScore;
                }
            } else if (question.type === 'text') {
                // For text questions, check for null/undefined or empty string
                isAnswered = question.answer !== null && 
                       question.answer !== undefined && 
                       question.answer.toString().trim() !== '';
            } else {
                // Default case
                isAnswered = question.answer !== null && question.answer !== undefined;
            }
            
            return isAnswered;
        });
        
        return result;
    }

    showValidationFeedback() {
        // Get unanswered required questions in current section
        const section = this._formData.sections[this.currentSection];
        
        const unansweredQuestions = section.questions
            .map((question, index) => ({ question, index }))
            .filter(({ question }) => {
                if (!question.required) return false;
                
                if (question.type === 'linearScale') {
                    if (question.answer === null || question.answer === undefined) {
                        return true; // Unanswered
                    } else {
                        // Check if the answer is within the valid range
                        const minScore = question.minScore || 0;
                        const maxScore = question.maxScore || 5;
                        return !(question.answer >= minScore && question.answer <= maxScore);
                    }
                }
                if (question.type === 'text') {
                    return question.answer === null || 
                           question.answer === undefined || 
                           question.answer.toString().trim() === '';
                }
                // Default case
                return question.answer === null || question.answer === undefined;
            });

        if (unansweredQuestions.length === 0) return;

        // Highlight the first unanswered question
        const firstUnanswered = unansweredQuestions[0];
        const questionId = `q-${this.currentSection}-${firstUnanswered.index}`;
        
        // Find the question card using the fieldset's aria-labelledby attribute
        const fieldset = document.querySelector(`fieldset[aria-labelledby="${questionId}"]`);
        
        if (fieldset) {
            const card = fieldset.closest('.template-question-card');
            if (card) {
                // Add validation error styling
                card.classList.add('border-danger', 'border-2');
                card.scrollIntoView({ behavior: 'smooth', block: 'center' });
                
                // Focus the first input in the question
                const firstInput = card.querySelector('input[type="radio"], textarea');
                if (firstInput) {
                    firstInput.focus();
                }

                // Remove highlight after 3 seconds
                setTimeout(() => {
                    card.classList.remove('border-danger', 'border-2');
                }, 3000);
            }
        }

        // Show validation message
        this.showValidationMessage(unansweredQuestions.length);
    }

    showValidationMessage(count) {
        // Remove any existing validation message
        const existingMessage = this.container.querySelector('.validation-message');
        if (existingMessage) {
            existingMessage.remove();
        }

        // Create validation message
        const messageDiv = DomHelper.createElement('div', {
            className: 'validation-message alert alert-warning d-flex align-items-center gap-2 mt-3',
            role: 'alert'
        });

        const iconSpan = DomHelper.createElement('span', {
            className: 'vi-solid vi-exclamation-triangle',
            'aria-hidden': 'true'
        });

        const messageText = count === 1 
            ? 'Please complete the highlighted required question before continuing.'
            : `Please complete all ${count} required questions in this section before continuing.`;

        const textSpan = DomHelper.createElement('span', {}, messageText);

        messageDiv.appendChild(iconSpan);
        messageDiv.appendChild(textSpan);

        // Insert message before navigation
        const navigation = this.container.querySelector('.template-navigation');
        if (navigation) {
            navigation.parentNode.insertBefore(messageDiv, navigation);
        }

        // Auto-remove message after 5 seconds
        setTimeout(() => {
            if (messageDiv && messageDiv.parentNode) {
                messageDiv.remove();
            }
        }, 5000);
    }

    save() {
        return this._formData;
    }

    render() {
        if (!this.container) return;
        DomHelper.clear(this.container);

        if (!this.previewMode) {
            const descContainer = DomHelper.createElement('div', { className: 'template-description-container' });

            // Add save state indicator (visible after interaction)
            let stateText = '';
            let stateIcon = '';
            let stateClass = '';
            if (this.saveState) {
                switch (this.saveState) {
                    case 'changed':
                        stateText = 'Unsaved Changes';
                        stateIcon = 'vi-exclamation-circle';
                        stateClass = 'text-warning';
                        break;
                    case 'saving':
                        stateText = 'Saving...';
                        stateIcon = 'vi-repeat';
                        stateClass = 'text-info';
                        break;
                    case 'saved':
                        stateText = 'Saved';
                        stateIcon = 'vi-check-circle';
                        stateClass = 'text-success';
                        break;
                    case 'lastEdited':
                        const elapsedMs = Date.now() - this.lastSaveTime;
                        const elapsedMin = Math.floor(elapsedMs / 60000);
                        stateText = `Last edited ${elapsedMin} minute${elapsedMin === 1 ? '' : 's'} ago`;
                        stateIcon = 'vi-clock';
                        stateClass = 'text-secondary';
                        break;
                }

                const stateContainer = DomHelper.createElement('div', { className: 'template-save-state d-flex flex-column gap-2 mb-2 text-secondary' });
                const paraElement = DomHelper.createElement('p', { className: `template-save-state-text d-flex align-items-center gap-2 ${stateClass}` });
                const autosaveDivElement = DomHelper.createElement('div', { className: `form-check form-switch` });
                const autosaveLabelElement = DomHelper.createElement('label', { for: "inp-template-autosave", className: `form-check-label opacity-100 pt-1` }, 'Autosave');
                const autosaveInputElement = DomHelper.createElement('input', { id: "inp-template-autosave", className: `form-check-input`, type: "checkbox", checked: true, switch: true, disabled: true });
                const autosaveInfoElement = DomHelper.createElement('span', { className: `vi-regular vi-info-circle fs-5 text-info ms-3`, title: 'All changes are saved automatically' });
                const stateIconElement = DomHelper.createElement('span', { className: `vi-solid ${stateIcon} fs-5` });
                const stateTextElement = DomHelper.createElement('span', {}, stateText);

                autosaveInfoElement.setAttribute('data-toggle', 'tooltip');
                autosaveDivElement.appendChild(autosaveInputElement);
                autosaveDivElement.appendChild(autosaveLabelElement);
                autosaveDivElement.appendChild(autosaveInfoElement);
                paraElement.appendChild(stateIconElement);
                paraElement.appendChild(stateTextElement);
                DomHelper.appendChildren(stateContainer, autosaveDivElement, paraElement);
                descContainer.appendChild(stateContainer);
            }

            const titleElement = DomHelper.createElement('h3', { className: 'template-title' }, `${this.titleAction}${this._formData.title || 'Untitled Form'}`);
            descContainer.appendChild(titleElement);

            if (this._formData.description) {
                const descElement = DomHelper.createElement('p', { className: 'template-description' }, this._formData.description);
                descContainer.appendChild(descElement);
            }

            const dlElement = DomHelper.createElement('dl');
            const dlElementReviewee = DomHelper.createElement('dl');
            if (this._formData.positionName) {
                const dtPos = DomHelper.createElement('dt', {}, 'Position');
                const positionSpan = DomHelper.createElement('span', { className: 'template-score-badge' }, this._formData.positionName);
                const ddPos = DomHelper.createElement('dd', {});
                ddPos.appendChild(positionSpan);
                DomHelper.appendChildren(dlElement, dtPos, ddPos);
            }

            if (this._formData.createdBy) {
                const dtCreator = DomHelper.createElement('dt', {}, 'Reviewer');
                const ddCreator = DomHelper.createElement('dd', {});
                const reviewerWrapper = DomHelper.createElement('span', {});

                const reviewerName = this._formData.createdBy;
                let initials = '';
                if (reviewerName) {
                    const nameParts = reviewerName.split(', ');
                    if (nameParts.length === 2) {
                        initials = (nameParts[1][0] + nameParts[0][0]).toUpperCase();
                    } else {
                        const words = reviewerName.split(' ');
                        initials = words.length > 1 ? (words[0][0] + words[1][0]).toUpperCase() : (words[0][0] || '').toUpperCase();
                    }
                }

                const avatarSpan = DomHelper.createElement('span', { className: 'template-avatar-reviewer' }, initials);
                const reviewerSpan = DomHelper.createElement('span', { className: 'template-reviewer' }, reviewerName);

                reviewerWrapper.appendChild(avatarSpan);
                reviewerWrapper.appendChild(reviewerSpan);
                ddCreator.appendChild(reviewerWrapper);
                DomHelper.appendChildren(dlElement, dtCreator, ddCreator);
            }

            if (this._formData.reviewee) {
                const dtReviewee = DomHelper.createElement('dt', {}, 'Reviewee');
                const ddReviewee = DomHelper.createElement('dd', {});
                const revieweeWrapper = DomHelper.createElement('span', {});

                const revieweeName = this._formData.reviewee;
                let initials = '';
                if (revieweeName) {
                    const nameParts = revieweeName.split(', ');
                    if (nameParts.length === 2) {
                        initials = (nameParts[1][0] + nameParts[0][0]).toUpperCase();
                    } else {
                        const words = revieweeName.split(' ');
                        initials = words.length > 1 ? (words[0][0] + words[1][0]).toUpperCase() : (words[0][0] || '').toUpperCase();
                    }
                }

                const avatarSpan = DomHelper.createElement('span', { className: 'template-avatar-reviewee' }, initials);
                const revieweeSpan = DomHelper.createElement('span', { className: 'template-reviewee' }, revieweeName);

                revieweeWrapper.appendChild(avatarSpan);
                revieweeWrapper.appendChild(revieweeSpan);
                ddReviewee.appendChild(revieweeWrapper);
                DomHelper.appendChildren(dlElementReviewee, dtReviewee, ddReviewee);
            }

            descContainer.appendChild(dlElementReviewee);
            descContainer.appendChild(dlElement);
            this.container.appendChild(descContainer);
        }

        const sectionContainer = DomHelper.createElement('div', { className: 'template-section-container' });
        const totalSections = this._formData.sections.length;

        if (totalSections > 0 && this.currentSection < totalSections) {
            const sectionElement = DomHelper.createElement('section', { className: 'template-section' });
            const section = this._formData.sections[this.currentSection];
            const totalQuestions = this.getTotalQuestions();
            const questionsBefore = this._formData.sections
                .slice(0, this.currentSection)
                .reduce((acc, sec) => acc + sec.questions.length, 0);
            const progress = totalQuestions > 0 ?
                Math.min(100, Math.round(((questionsBefore + section.questions.length) / totalQuestions) * 100)) : 0;

            const sectionInfo = DomHelper.createElement('div', { className: 'template-section-info-container' });
            const titleDiv = DomHelper.createElement('div');
            const sectionTitle = DomHelper.createElement('h4', { className: 'template-section-title' }, `${this.currentSection + 1}. ${section.title || `Section ${this.currentSection + 1}`}`);
            const sectionDesc = section.description ? DomHelper.createElement('p', { className: 'template-section-description' }, section.description) : null;
            DomHelper.appendChildren(titleDiv, sectionTitle, sectionDesc);
            sectionInfo.appendChild(titleDiv);
            sectionElement.appendChild(sectionInfo);

            const questionsContainer = DomHelper.createElement('div', { className: 'template-questions-container' });
            section.questions.forEach((question, questionIndex) => {
                const questionCard = DomHelper.createElement('div', { className: 'template-question-card' });
                const questionId = `q-${this.currentSection}-${questionIndex}`;
                const fieldset = DomHelper.createElement('fieldset', { className: 'template-question-container', 'aria-labelledby': questionId });
                
                // Add visual indicator for incomplete required questions
                const isQuestionIncomplete = !this.previewMode && question.required && 
                    ((question.type === 'linearScale' && (
                        question.answer === null || 
                        question.answer === undefined || 
                        question.answer < (question.minScore || 0) || 
                        question.answer > (question.maxScore || 5)
                    )) ||
                     (question.type === 'text' && (question.answer === null || question.answer === undefined || question.answer.toString().trim() === '')) ||
                     (question.type !== 'linearScale' && question.type !== 'text' && (question.answer === null || question.answer === undefined)));
                if (isQuestionIncomplete) {
                    questionCard.classList.add('template-question-required-incomplete');
                }
                
                const infoContainer = DomHelper.createElement('div', { className: 'template-question-info-container' });
                const qNumber = DomHelper.createElement('span', { className: 'template-question-number' }, `Question ${questionIndex + 1}`);
                DomHelper.appendChildren(infoContainer, qNumber);
                const qTitle = DomHelper.createElement('legend', { className: 'template-question-title' }, question.title);
                if (question.required) {
                    qTitle.appendChild(DomHelper.createElement('span', { className: 'required text-danger' }, ' *'));
                }

                if (question.type === 'linearScale') {
                    const scaleContainer = DomHelper.createElement('div', {
                        className: 'template-question-linear-scale-container',
                        role: 'radiogroup',
                        'aria-labelledby': questionId
                    });
                    const minScore = question.minScore || 0;
                    const maxScore = question.maxScore || 5;

                    for (let value = minScore; value <= maxScore; value++) {
                        const isChecked = question.answer === value;
                        const isFirst = value === minScore;
                        const inputAttributes = {
                            type: 'radio',
                            className: 'btn-check',
                            name: questionId,
                            id: `${questionId}-${value}`,
                            value: value,
                            checked: isChecked
                        };
                        if (isFirst && !this.previewMode && question.required) {
                            inputAttributes.required = true;
                        }
                        const input = DomHelper.createElement('input', inputAttributes);
                        const labelText = value === 0 ? "N/A" : value.toString();

                        const label = DomHelper.createElement('label', {
                            className: `btn ${isChecked ? 'btn-primary' : 'btn-outline-secondary'} flex-fill`,
                            for: `${questionId}-${value}`
                        }, labelText);

                        input.addEventListener('change', (e) => {
                            const selectedValue = parseInt(e.target.value);
                            
                            // Handle the special case where value 0 might not be a valid answer
                            let answerValue = selectedValue;
                            
                            // If minScore is 1 or higher, and user selects 0 (N/A), treat it as null for validation
                            if (selectedValue === 0 && (question.minScore > 0)) {
                                answerValue = null;
                            }
                            
                            this.updateAnswer(this.currentSection, questionIndex, answerValue);
                        });
                        DomHelper.appendChildren(scaleContainer, input, label);
                    }

                    const labelContainer = DomHelper.createElement('div', { className: 'template-question-linear-scale-label-container' });
                    DomHelper.appendChildren(labelContainer,
                        DomHelper.createElement('span', { className: 'template-question-linear-scale-label' }, question.minLabel || 'Poor'),
                        DomHelper.createElement('span', { className: 'template-question-linear-scale-label' }, question.maxLabel || 'Excellent')
                    );

                    DomHelper.appendChildren(fieldset, infoContainer, qTitle, scaleContainer, labelContainer);
                } else if (question.type === 'text') {
                    const textContainer = DomHelper.createElement('div', { className: 'vstack gap-4' });
                    const textarea = DomHelper.createElement('textarea', {
                        className: 'form-control lh-base p-3 bg-body rounded-2',
                        name: questionId,
                        rows: '3',
                        'aria-label': 'Text response',
                        value: question.answer || ''
                    });
                    if (!this.previewMode && question.required) {
                        textarea.required = true;
                    }
                    textarea.addEventListener('input', (e) => {
                        this.updateAnswer(this.currentSection, questionIndex, e.target.value);
                    });
                    textContainer.appendChild(textarea);

                    DomHelper.appendChildren(fieldset, infoContainer, qTitle, textContainer);
                }

                questionCard.appendChild(fieldset);
                questionsContainer.appendChild(questionCard);
            });

            sectionElement.appendChild(questionsContainer);

            const navDiv = DomHelper.createElement('div', { className: 'template-navigation' });
            if (this.currentSection > 0) {
                const backBtn = DomHelper.createElement('button', { className: 'btn btn-subtle-secondary template-navigation-button-back', type: 'button' }, 'Back');
                backBtn.addEventListener('click', () => this.navigate('back'));
                navDiv.appendChild(backBtn);
            }

            const progressDiv = DomHelper.createElement('div', {
                className: 'progress',
                role: 'progressbar',
                'aria-label': 'Review progress',
                'aria-valuenow': progress,
                'aria-valuemin': '0',
                'aria-valuemax': '100'
            });
            const progressBar = DomHelper.createElement('div', {
                className: 'progress-bar',
                style: `width: ${progress}%`
            }, `${progress}%`);
            progressDiv.appendChild(progressBar);
            navDiv.appendChild(progressDiv);

            if (this.currentSection < totalSections - 1) {
                this.nextButton = DomHelper.createElement('button', {
                    className: 'btn btn-primary template-navigation-button-next',
                    type: 'button'
                }, 'Next');
                const nextWrapperSpan = DomHelper.createElement('span');
                
                const isCurrentSectionComplete = this.checkCompletion();
                
                if (!this.previewMode && !isCurrentSectionComplete) {
                    this.nextButton.disabled = true;
                    
                    // Get count of unanswered required questions for better tooltip
                    const section = this._formData.sections[this.currentSection];
                    const unansweredCount = section.questions.filter(q => {
                        if (!q.required) return false;
                        
                        if (q.type === 'linearScale') {
                            if (q.answer === null || q.answer === undefined) {
                                return true; // Unanswered
                            } else {
                                // Check if the answer is within the valid range
                                const minScore = q.minScore || 0;
                                const maxScore = q.maxScore || 5;
                                return !(q.answer >= minScore && q.answer <= maxScore);
                            }
                        }
                        if (q.type === 'text') {
                            return q.answer === null || q.answer === undefined || q.answer.toString().trim() === '';
                        }
                        // Default case
                        return q.answer === null || q.answer === undefined;
                    }).length;
                    
                    const tooltipText = unansweredCount === 1 
                        ? 'Complete the required question (*) to continue'
                        : `Complete all ${unansweredCount} required questions (*) to continue`;
                    
                    nextWrapperSpan.setAttribute('title', tooltipText);
                    nextWrapperSpan.setAttribute('data-toggle', 'tooltip');
                    nextWrapperSpan.setAttribute('data-placement', 'top');
                }
                
                this.nextButton.addEventListener('click', (e) => {
                    const isComplete = this.checkCompletion();
                    
                    if (!this.previewMode && !isComplete) {
                        // Prevent navigation and show feedback
                        e.preventDefault();
                        e.stopPropagation();
                        this.showValidationFeedback();
                        return false;
                    }
                    this.navigate('next');
                });
                nextWrapperSpan.appendChild(this.nextButton);
                navDiv.appendChild(nextWrapperSpan);
            } else {
                const submitBtn = DomHelper.createElement('button', {
                    id: this.submitId,
                    className: 'btn btn-primary template-navigation-button-submit',
                    type: 'submit'
                });
                const submitTextSpan = DomHelper.createElement('span', {}, `${this.submitText || "Submit"}`);
                submitBtn.appendChild(submitTextSpan);

                // Apply the same validation logic as Next button
                const submitWrapperSpan = DomHelper.createElement('span');
                const isCurrentSectionComplete = this.checkCompletion();

                if (this.previewMode) {
                    submitBtn.disabled = true;
                } else if (!isCurrentSectionComplete) {
                    submitBtn.disabled = true;
                    
                    // Get count of unanswered required questions for better tooltip
                    const section = this._formData.sections[this.currentSection];
                    const unansweredCount = section.questions.filter(q => {
                        if (!q.required) return false;
                        
                        if (q.type === 'linearScale') {
                            if (q.answer === null || q.answer === undefined) {
                                return true; // Unanswered
                            } else {
                                // Check if the answer is within the valid range
                                const minScore = q.minScore || 0;
                                const maxScore = q.maxScore || 5;
                                return !(q.answer >= minScore && q.answer <= maxScore);
                            }
                        }
                        if (q.type === 'text') {
                            return q.answer === null || q.answer === undefined || q.answer.toString().trim() === '';
                        }
                        // Default case
                        return q.answer === null || q.answer === undefined;
                    }).length;
                    
                    const tooltipText = unansweredCount === 1 
                        ? 'Complete the required question (*) to finish'
                        : `Complete all ${unansweredCount} required questions (*) to finish`;
                    
                    submitWrapperSpan.setAttribute('title', tooltipText);
                    submitWrapperSpan.setAttribute('data-toggle', 'tooltip');
                    submitWrapperSpan.setAttribute('data-placement', 'top');
                }

                // Add click event listener for validation
                submitBtn.addEventListener('click', (e) => {
                    const isComplete = this.checkCompletion();
                    
                    if (!this.previewMode && !isComplete) {
                        // Prevent submission and show feedback
                        e.preventDefault();
                        e.stopPropagation();
                        this.showValidationFeedback();
                        return false;
                    }
                    // Let the form submit naturally or handle submission logic here
                });

                submitWrapperSpan.appendChild(submitBtn);
                navDiv.appendChild(submitWrapperSpan);
            }

            sectionElement.appendChild(navDiv);
            sectionContainer.appendChild(sectionElement);
        } else if (totalSections === 0) {
            const noSections = DomHelper.createElement('p', { className: 'mb-0' }, 'No sections added yet');
            sectionContainer.appendChild(noSections);
        }

        this.container.appendChild(sectionContainer);
    }

    removeEventListeners() {
        if (!this.container) return;

        // Remove event listeners from navigation buttons
        const backButton = this.container.querySelector('.template-navigation-button-back');
        if (backButton) {
            backButton.removeEventListener('click', () => this.navigate('back'));
        }

        const nextButton = this.container.querySelector('.template-navigation-button-next');
        if (nextButton) {
            nextButton.removeEventListener('click', () => this.navigate('next'));
        }

        // Remove event listeners from question inputs
        this._formData.sections.forEach((section, sectionIndex) => {
            section.questions.forEach((question, questionIndex) => {
                const questionId = `q-${sectionIndex}-${questionIndex}`;
                if (question.type === 'linearScale') {
                    const minScore = question.minScore || 0;
                    const maxScore = question.maxScore || 5;
                    for (let value = minScore; value <= maxScore; value++) {
                        const input = this.container.querySelector(`#${questionId}-${value}`);
                        if (input) {
                            input.removeEventListener('change', (e) => this.updateAnswer(sectionIndex, questionIndex, parseInt(e.target.value)));
                        }
                    }
                } else if (question.type === 'text') {
                    const textarea = this.container.querySelector(`textarea[name="${questionId}"]`);
                    if (textarea) {
                        textarea.removeEventListener('input', (e) => this.updateAnswer(sectionIndex, questionIndex, e.target.value));
                    }
                }
            });
        });
    }

    destroy() {
        // Clear any pending autosave debounce timeout
        if (this.autoSaveDebounced.timeout) {
            clearTimeout(this.autoSaveDebounced.timeout);
            this.autoSaveDebounced.timeout = null;
        }

        // Clear the update interval for last edited time
        if (this.updateInterval) {
            clearInterval(this.updateInterval);
            this.updateInterval = null;
        }

        // Clear the last edited timeout
        if (this.lastEditedTimeout) {
            clearTimeout(this.lastEditedTimeout);
            this.lastEditedTimeout = null;
        }

        // Remove event listeners from DOM elements
        this.removeEventListeners();

        // Clear the container's content
        if (this.container) {
            DomHelper.clear(this.container);
            this.container = null;
        }

        // Reset instance properties to prevent memory leaks
        this._formData = null;
        this._lastSavedData = null;
        this.review = null;
        this.formData = null;
        this.fields = null;
        this.nextButton = null;
        this.onCompletionChange = null;
        this.onAutoSave = null;
    }
}