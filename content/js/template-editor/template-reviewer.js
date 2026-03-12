import { DomHelper } from './utils.js';

export class TemplateReview {
    constructor(containerId, options = { data: {}, previewMode: false, showScoreSection: true, showScores: true, onCompletionChange, submitId: 'submit-review', submitText: 'Submit', titleAction: '', submitEnable: true, onAutoSave }) {
        const {
            data = {},
            previewMode = false,
            showScoreSection = true,
            showScores = true,
            onCompletionChange = () => { },
            submitId = 'submit-review',
            submitText = 'Finish',
            titleAction = '',
            submitEnable = true,
            onAutoSave = () => { }
        } = options;

        this.container = document.getElementById(containerId);
        if (!this.container) {
            throw new Error(`Container with ID '${containerId}' not found`);
        }

        if (!data || typeof data !== 'object' || Array.isArray(data)) {
            throw new Error('Data must be a single FormTemplate object');
        }

        this.validateReview(data);

        this.review = data;
        this.previewMode = previewMode;
        this.showScoreSection = showScoreSection;
        this.showScores = showScores;
        this.currentSection = 0;
        this.currentQuestion = 0;
        this.onCompletionChange = onCompletionChange;
        this.nextButton = null;
        this.submitId = submitId;
        this.submitText = submitText;
        this.titleAction = titleAction;
        this.submitEnable = submitEnable;
        this.onAutoSave = onAutoSave;
        this.saveState = 'idle'; // State: idle, changed, saving, saved, lastEdited
        this.lastSaveTime = null; // Timestamp of last save
        this.updateInterval = null; // Interval for updating last edited time
        this.lastEditedTimeout = null; // Timeout for transitioning to lastEdited
    // Track visited questions to decide when to show validation errors on re-render
    this.visitedQuestions = new Set();

        this.formData = data || {
            id: null,
            title: 'Untitled Form',
            description: '',
            position: '',
            reviewer: '',
            reviewee: '',
            sections: []
        };

        this.debounce = (func, wait) => {
            let timeout;
            return (...args) => {
                clearTimeout(timeout);
                timeout = setTimeout(() => func.apply(this, args), wait);
            };
        };

        // Debounced autosave function
        this.autoSaveDebounced = this.debounce(() => {
            this.saveState = 'saving';
            this.updateSaveStateIndicator();
            this.onAutoSave(this.review);
            // Transition to saved after 2 seconds
            setTimeout(() => {
                this.saveState = 'saved';
                this.lastSaveTime = Date.now();
                this.updateSaveStateIndicator();
                // Schedule transition to lastEdited after 1 minute if no changes
                this.lastEditedTimeout = setTimeout(() => {
                    if (this.saveState === 'saved') { // Only transition if still idle
                        this.saveState = 'lastEdited';
                        this.updateSaveStateIndicator();
                        // Start interval to update time every minute
                        if (this.updateInterval) {
                            clearInterval(this.updateInterval);
                        }
                        this.updateInterval = setInterval(() => {
                            this.updateSaveStateIndicator();
                        }, 60000); // Update every minute
                    }
                }, 60000); // 1 minute
            }, 2000);
        }, 2000);

        // Mark the initial question as visited so validation can display if needed
        this.markVisited(this.currentSection, this.currentQuestion);
        this.render();
        this.checkCompletion();
        this.initializePreExistingData();
    }

    // Generate a stable key for a question
    getQuestionKey(sectionIndex, questionIndex) {
        return `${sectionIndex}:${questionIndex}`;
    }

    // Mark a question as visited
    markVisited(sectionIndex, questionIndex) {
        this.visitedQuestions.add(this.getQuestionKey(sectionIndex, questionIndex));
    }

    // Determine whether to show an Agreed Score validation error for a question
    shouldShowAgreedError(question, sectionIndex, questionIndex) {
        if (this.previewMode) return false;
        const key = this.getQuestionKey(sectionIndex, questionIndex);
        const visited = this.visitedQuestions.has(key);
        const needsAgreed = question.type === 'linearScale' && (question.finalScore === null || question.finalScore === undefined);
        return visited && needsAgreed;
    }

    // Initialize pre-existing finalScore and remarks in the DOM
    initializePreExistingData() {
        if (this.previewMode) return; // Skip in preview mode

        this.review.sections.forEach((section, sectionIndex) => {
            section.questions.forEach((question, questionIndex) => {
                if (question.type === 'linearScale' && question.finalScore !== null) {
                    this.updateFinalScoreDOM(sectionIndex, questionIndex, question.finalScore);
                }
                if (question.remarks && question.remarks.trim() !== '') {
                    const textarea = document.getElementById(`q-${sectionIndex}-${questionIndex}-remarks`);
                    if (textarea) {
                        textarea.value = question.remarks;
                    } else {
                        console.warn(`Textarea not found for q-${sectionIndex}-${questionIndex}-remarks`);
                    }
                }
            });
        });
    }

    // Update agreed score radio buttons in the DOM
    updateFinalScoreDOM(sectionIndex, questionIndex, value) {
        const question = this.review.sections[sectionIndex].questions[questionIndex];
        const questionId = `q-${sectionIndex}-${questionIndex}`;
        const minValue = question.minValue || 0;
        const maxValue = question.maxValue || 5;

        for (let val = minValue; val <= maxValue; val++) {
            const input = document.getElementById(`${questionId}-agreed-${val}`);
            const label = input?.nextElementSibling;
            if (input && label) {
                input.checked = val === value;
                label.className = `btn ${val === value ? 'btn-success' : 'btn-outline-secondary'} flex-fill`;
            }
        }
    }

    get data() {
        return this.review;
    }

    set data(value) {
        this.validateReview(value);
        this.review = value;
        this.formData = value || {
            id: null,
            title: 'Untitled Form',
            description: '',
            position: '',
            reviewer: '',
            reviewee: '',
            sections: []
        };
        this.currentSection = 0;
        this.currentQuestion = 0;
    this.visitedQuestions = new Set();
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
    // Mark initial question as visited for validation
    this.markVisited(this.currentSection, this.currentQuestion);
    this.render();
        this.checkCompletion();
        this.initializePreExistingData();
    }

    // Helper to update only the save state indicator
    updateSaveStateIndicator() {
        if (this.previewMode) return; // Skip in preview mode
        const descContainer = this.container.querySelector('.template-description-container');
        if (!descContainer) return;

        // Find or create the state container
        let stateContainer = descContainer.querySelector('.template-save-state');
        if (!stateContainer) {
            stateContainer = DomHelper.createElement('div', { className: 'template-save-state d-flex flex-column gap-2 mb-2 text-secondary' });
            // Insert before the title
            const titleElement = descContainer.querySelector('.template-title');
            if (titleElement) {
                descContainer.insertBefore(stateContainer, titleElement);
            } else {
                descContainer.insertBefore(stateContainer, descContainer.firstChild);
            }
        } else {
            DomHelper.clear(stateContainer);
        }

        let stateText = '';
        let stateIcon = '';
        let stateClass = '';

        // If save state is 'idle', default to saved state for display
        if (this.saveState === 'idle') {
            stateText = 'Saved';
            stateIcon = 'vi-check-circle';
            stateClass = 'text-success';
        } else {
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
        }

        const paraElement = DomHelper.createElement('p', { className: `template-save-state-text d-flex align-items-center gap-2 ${stateClass}` });
        const autosaveDivElement = DomHelper.createElement('div', { className: `form-check form-switch` });
        const autosaveLabelElement = DomHelper.createElement('label', { for: 'inp-template-autosave', className: `form-check-label opacity-100 pt-1` }, 'Autosave');
        const autosaveInputElement = DomHelper.createElement('input', { id: 'inp-template-autosave', className: `form-check-input`, type: 'checkbox', checked: true, switch: true, disabled: true });
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
    }

    validateReview(review) {
        if (!review.sections || !Array.isArray(review.sections) || review.sections.length === 0) {
            throw new Error('Review must have a non-empty array of sections');
        }

        review.sections.forEach((section, sectionIndex) => {
            if (!section.questions || !Array.isArray(section.questions) || section.questions.length === 0) {
                throw new Error(`Section ${sectionIndex} must have a non-empty array of questions`);
            }
            if (typeof section.weightScore !== 'number' || section.weightScore < 0 || section.weightScore > 1) {
                throw new Error(`Section ${sectionIndex} must have a valid weightScore between 0 and 1`);
            }

            section.questions.forEach((question, questionIndex) => {
                if (typeof question.weightScore !== 'number' || question.weightScore < 0 || question.weightScore > 1) {
                    throw new Error(`Question ${questionIndex} in section ${sectionIndex} must have a valid weightScore between 0 and 1`);
                }
                if (question.type === 'linearScale') {
                    if (typeof question.revieweeAnswer !== 'number' && question.revieweeAnswer !== null) {
                        throw new Error(`Question ${questionIndex} in section ${sectionIndex} has an invalid revieweeAnswer for linearScale`);
                    }
                    if (typeof question.reviewerAnswer !== 'number' && question.reviewerAnswer !== null) {
                        throw new Error(`Question ${questionIndex} in section ${sectionIndex} has an invalid reviewerAnswer for linearScale`);
                    }
                } else if (question.type === 'text') {
                    if (typeof question.revieweeAnswer !== 'string' && question.revieweeAnswer !== null) {
                        throw new Error(`Question ${questionIndex} in section ${sectionIndex} has an invalid revieweeAnswer for text`);
                    }
                    if (typeof question.reviewerAnswer !== 'string' && question.reviewerAnswer !== null) {
                        throw new Error(`Question ${questionIndex} in section ${sectionIndex} has an invalid reviewerAnswer for text`);
                    }
                }
                if ('finalScore' in question && question.finalScore !== null && typeof question.finalScore !== 'number') {
                    throw new Error(`Question ${questionIndex} in section ${sectionIndex} has an invalid finalScore; must be a number or null`);
                }
                if ('remarks' in question && question.remarks !== null && typeof question.remarks !== 'string') {
                    throw new Error(`Question ${sectionIndex} in section ${sectionIndex} has an invalid remarks; must be a string or null`);
                }
            });
        });
    }

    getTotalQuestions() {
        return this.formData.sections.reduce((acc, section) => acc + (section.questions?.length || 0), 0);
    }

    getCurrentGlobalQuestionIndex() {
        let index = 0;
        for (let i = 0; i < this.currentSection; i++) {
            index += this.formData.sections[i].questions.length;
        }
        return index + this.currentQuestion;
    }

    navigate(direction) {
        const totalSections = this.formData.sections.length;
        const isScoreTally = this.currentSection === totalSections && this.showScoreSection;
        const currentSectionQuestions = this.formData.sections[this.currentSection]?.questions.length || 0;

        if (isScoreTally && direction === 'back') {
            this.currentSection = totalSections - 1;
            this.currentQuestion = this.formData.sections[this.currentSection].questions.length - 1;
        } else if (direction === 'back' && this.currentQuestion > 0) {
            this.currentQuestion--;
        } else if (direction === 'back' && this.currentSection > 0) {
            this.currentSection--;
            this.currentQuestion = this.formData.sections[this.currentSection].questions.length - 1;
        } else if (direction === 'next' && this.currentQuestion < currentSectionQuestions - 1) {
            this.currentQuestion++;
        } else if (direction === 'next' && this.currentSection < totalSections - 1) {
            this.currentSection++;
            this.currentQuestion = 0;
        } else if (direction === 'next' && this.currentSection === totalSections - 1 && this.showScoreSection) {
            this.currentSection = totalSections;
            this.currentQuestion = 0;
        }
        // Mark newly navigated question as visited before rendering (only if on a question page)
        const totalSectionsAfterNav = this.formData.sections.length;
        const isOnQuestion = this.currentSection < totalSectionsAfterNav;
        if (isOnQuestion) {
            this.markVisited(this.currentSection, this.currentQuestion);
        }
    this.render();
        // Update "Next" button state after navigation
        const isCurrentQuestionComplete = this.checkCompletion();
        if (this.nextButton) {
            this.nextButton.disabled = !this.previewMode && !isCurrentQuestionComplete;
        }
    }

    updateAnswer(sectionIndex, questionIndex, role, value) {
        const question = this.review.sections[sectionIndex].questions[questionIndex];
        if (role === 'Reviewee') {
            question.revieweeAnswer = value;
        } else if (role === 'Reviewer') {
            question.reviewerAnswer = value;
        }

        // If both answers are equal (and non-null), auto-set agreed score unless manually overridden
        if (question.type === 'linearScale') {
            const bothAnswered = question.revieweeAnswer !== null && question.reviewerAnswer !== null;
            const answersEqual = question.revieweeAnswer === question.reviewerAnswer;
            if (bothAnswered && answersEqual && !question.finalScoreOverridden) {
                question.finalScore = question.revieweeAnswer;
            }
        }

        this.render();
        this.checkCompletion();
    }

    updateFinalScore(sectionIndex, questionIndex, value) {
        if (this.previewMode) return; // Skip in preview mode

        const question = this.review.sections[sectionIndex].questions[questionIndex];
        question.finalScore = value;
    // Mark as manually overridden to prevent auto-sync on equal answers
    question.finalScoreOverridden = true;

        // Update the agreed score radio buttons immediately
        this.updateFinalScoreDOM(sectionIndex, questionIndex, value);

        // Trigger overall completion check
        const allQuestions = this.review.sections.flatMap(section => section.questions);
        const linearScaleQuestions = allQuestions.filter(q => q.type === 'linearScale');
        const allAnswered = linearScaleQuestions.every(q => q.finalScore !== null && q.finalScore !== undefined && q.finalScore !== 0);
        this.onCompletionChange(allAnswered);

        // Add this line to update the score tally when finalScore changes
        this.debounce(this.updateScoreTally.bind(this), 500)();

        // Trigger autosave if value is non-empty/non-null
        if (value !== null && value !== undefined) {
            this.saveState = 'changed';
            if (this.lastEditedTimeout) {
                clearTimeout(this.lastEditedTimeout);
                this.lastEditedTimeout = null;
            }
            this.updateSaveStateIndicator();
            this.autoSaveDebounced();
        }

        // Update Next button state
        const isCurrentQuestionComplete = this.checkCompletion();
        if (this.nextButton) {
            this.nextButton.disabled = !this.previewMode && !isCurrentQuestionComplete;
        }
    }

    updateRemarks(sectionIndex, questionIndex, value) {
        if (this.previewMode) return; // Skip in preview mode

        const question = this.review.sections[sectionIndex].questions[questionIndex];
        question.remarks = value;
        const textarea = document.getElementById(`q-${sectionIndex}-${questionIndex}-remarks`);
        if (textarea) {
            textarea.value = value;
        }
        this.debounce(this.updateScoreTally.bind(this), 500)();
        this.checkCompletion();

        // Trigger autosave if value is non-empty/non-null
        if (value !== null && value !== undefined && value !== '') {
            this.saveState = 'changed';
            if (this.lastEditedTimeout) {
                clearTimeout(this.lastEditedTimeout);
                this.lastEditedTimeout = null;
            }
            this.updateSaveStateIndicator();
            this.autoSaveDebounced();
        }
    }

    updateScoreTally() {
        if (this.currentSection === this.formData.sections.length && this.showScoreSection) {
            this.render();
        }
    }

    checkCompletion() {
        const allQuestions = this.review.sections.flatMap(section => section.questions);
        const linearScaleQuestions = allQuestions.filter(q => q.type === 'linearScale');

        // Overall completion for onCompletionChange callback
        const allAnswered = linearScaleQuestions.every(question => {
            return question.finalScore !== null && question.finalScore !== undefined;
        });
        this.onCompletionChange(allAnswered);

        // Check completion for the current question (for enabling Next button)
        const currentQuestion = this.formData.sections[this.currentSection]?.questions[this.currentQuestion];
        const isCurrentQuestionComplete = currentQuestion && currentQuestion.type === 'linearScale'
            ? (currentQuestion.finalScore !== null && currentQuestion.finalScore !== undefined) ||
            (currentQuestion.revieweeAnswer === currentQuestion.reviewerAnswer && currentQuestion.revieweeAnswer !== null)
            : true; // For text questions or non-existent questions, assume complete

        return isCurrentQuestionComplete;
    }

    getInitials(name) {
        const names = (name || '').split(' ').filter(Boolean);
        if (names.length === 0) return '??';
        if (names.length === 1) return names[0].slice(0, 2).toUpperCase();
        return (names[0][0] + names[names.length - 1][0]).toUpperCase();
    }

    calculateSectionAverage(section, role) {
        const linearQuestions = section.questions.filter(q => q.type === 'linearScale');
        if (linearQuestions.length === 0) return null;
        const answers = linearQuestions
            .map(q => role === 'Reviewee' ? q.revieweeAnswer : q.reviewerAnswer)
            .filter(answer => answer !== null);
        if (answers.length === 0) return null;
        const sum = answers.reduce((acc, val) => acc + val, 0);
        return (sum / linearQuestions.length);
    }

    calculateWeightedScore(section, role) {
        const avg = this.calculateSectionAverage(section, role);
        if (avg === null) return null;
    // Return numeric weighted score; defer rounding to final aggregation
    return (avg * section.weightScore);
    }

    calculateTotalWeightedAverage(role) {
        const weightedScores = this.review.sections
            .map(section => this.calculateWeightedScore(section, role))
            .filter(score => score !== null);
        if (weightedScores.length === 0) return null;
    const sum = weightedScores.reduce((acc, val) => acc + parseFloat(val), 0);
    // Round to 1 decimal place; avoid 4.999999 -> 4.9 using EPSILON
    const rounded = Math.round((sum + Number.EPSILON) * 10) / 10;
    return rounded.toFixed(1);
    }

    calculateOverallPerformanceScore() {
        // Get all sections with their weights and final scores
        const sectionScores = this.review.sections.map(section => ({
            finalScore: this.calculateSectionFinalScore(section) === 'N/A' ? null : parseFloat(this.calculateSectionFinalScore(section)),
            weightScore: section.weightScore
        })).filter(s => s.finalScore !== null);

        if (sectionScores.length === 0) return 'N/A';

        // Filter out sections with zero scores
        const validSections = sectionScores.filter(s => s.finalScore > 0);
        if (validSections.length === 0) return '0.0'; // All section scores are zero

        // Calculate total weight of valid sections to normalize
        const totalValidWeight = validSections.reduce((acc, s) => acc + s.weightScore, 0);

        // Calculate weighted sum with normalized weights
        const weightedSum = validSections.reduce((acc, s) => {
            // Normalize the weight: original weight / total valid weight
            const normalizedWeight = s.weightScore / totalValidWeight;
            return acc + (s.finalScore * normalizedWeight);
        }, 0);

    // Round to 1 decimal place; avoid 4.999999 -> 4.9 using EPSILON
    const rounded = Math.round((weightedSum + Number.EPSILON) * 10) / 10;
    return rounded.toFixed(1);
    }

    calculateSectionFinalScore(section) {
        const finalScores = section.questions
            .filter(q => q.type === 'linearScale' && q.finalScore !== null)
            .map(q => ({ finalScore: q.finalScore, weightScore: q.weightScore }));

        if (finalScores.length === 0) return 'N/A';

        // Calculate total weight of questions with non-zero scores
        const validScores = finalScores.filter(q => q.finalScore !== 0);
        if (validScores.length === 0) return '0.0'; // All scores are zero

        // Calculate total weight of valid questions to normalize
        const totalValidWeight = validScores.reduce((acc, q) => acc + q.weightScore, 0);

        // Calculate weighted sum with normalized weights
        const weightedSum = validScores.reduce((acc, q) => {
            // Normalize the weight: original weight / total valid weight
            const normalizedWeight = q.weightScore / totalValidWeight;
            return acc + (q.finalScore * normalizedWeight);
        }, 0);

        return weightedSum.toFixed(1);
    }

    calculateQuestionContribution(question, section) {
        if (question.type !== 'linearScale' || question.finalScore === null) return 0;
        if (question.finalScore === 0) return 0;

        // Get all questions with non-zero scores in this section
        const validQuestions = section.questions.filter(q =>
            q.type === 'linearScale' &&
            q.finalScore !== null &&
            q.finalScore !== 0
        );

        if (validQuestions.length === 0) return 0;

        // Calculate total weight of valid questions
        const totalValidWeight = validQuestions.reduce((acc, q) => acc + q.weightScore, 0);

        // Calculate normalized weight for this question
        const normalizedWeight = question.weightScore / totalValidWeight;

        // Return contribution to section score
        return question.finalScore * normalizedWeight;
    }

    render() {
        if (!this.container) return;
        DomHelper.clear(this.container);

        // Template Description Container
        const descContainer = DomHelper.createElement('div', { className: 'template-description-container' });

        const titleElement = DomHelper.createElement('h3', { className: 'template-title' }, `${this.titleAction}${this.formData.title || 'Untitled Form'}`);
        descContainer.appendChild(titleElement);

        if (this.formData.description) {
            const descElement = DomHelper.createElement('p', { className: 'template-description' }, this.formData.description);
            descContainer.appendChild(descElement);
        }

        const dlElement = DomHelper.createElement('dl');
        if (this.formData.position) {
            const dtPos = DomHelper.createElement('dt', {}, 'Position');
            const ddPos = DomHelper.createElement('dd');
            const posBadge = DomHelper.createElement('span', { className: 'template-score-badge template-badge-outline' }, this.formData.position);
            ddPos.appendChild(posBadge);
            DomHelper.appendChildren(dlElement, dtPos, ddPos);
        }

        if (this.formData.reviewee) {
            const dtReviewee = DomHelper.createElement('dt', {}, 'Reviewee');
            const ddReviewee = DomHelper.createElement('dd');
            const revieweeSpan = DomHelper.createElement('span');
            const revieweeAvatar = DomHelper.createElement('span', { className: 'template-avatar-reviewee' }, this.getInitials(this.formData.reviewee));
            const revieweeName = DomHelper.createElement('span', { className: 'template-reviewee' }, this.formData.reviewee);
            DomHelper.appendChildren(revieweeSpan, revieweeAvatar, revieweeName);
            ddReviewee.appendChild(revieweeSpan);
            DomHelper.appendChildren(dlElement, dtReviewee, ddReviewee);
        }

        if (this.formData.reviewer) {
            const dtReviewer = DomHelper.createElement('dt', {}, 'Reviewer');
            const ddReviewer = DomHelper.createElement('dd');
            const reviewerSpan = DomHelper.createElement('span');
            const reviewerAvatar = DomHelper.createElement('span', { className: 'template-avatar-reviewer' }, this.getInitials(this.formData.reviewer));
            const reviewerName = DomHelper.createElement('span', { className: 'template-reviewer' }, this.formData.reviewer);
            DomHelper.appendChildren(reviewerSpan, reviewerAvatar, reviewerName);
            ddReviewer.appendChild(reviewerSpan);
            DomHelper.appendChildren(dlElement, dtReviewer, ddReviewer);
        }

        descContainer.appendChild(dlElement);
        this.container.appendChild(descContainer);

        // Render save state indicator after appending descContainer
        // Modified: Always show the save state indicator when not in preview mode
        if (!this.previewMode) {
            this.updateSaveStateIndicator();
        }

        // Template Section Container
        const sectionContainer = DomHelper.createElement('div', { className: 'template-section-container' });
        const totalSections = this.formData.sections.length;
        const isScoreTally = this.currentSection === totalSections && this.showScoreSection;

        if (totalSections > 0 && this.currentSection <= (this.showScoreSection ? totalSections : totalSections - 1)) {
            const sectionElement = DomHelper.createElement('section', { className: 'template-section' });

            if (isScoreTally) {
                const tallyTitle = DomHelper.createElement('h4', { className: 'template-section-title' }, 'Score Tally');
                sectionElement.appendChild(tallyTitle);

                const table = DomHelper.createElement('table', { className: 'table table-striped align-middle' });
                const thead = DomHelper.createElement('thead');
                const headerRow = DomHelper.createElement('tr', {});
                DomHelper.appendChildren(headerRow,
                    DomHelper.createElement('th', {}, 'Section'),
                    DomHelper.createElement('th', {}, 'Agreed Score')
                );
                thead.appendChild(headerRow);
                table.appendChild(thead);

                const tbody = DomHelper.createElement('tbody', { className: 'table-group-divider' });
                this.review.sections.forEach((section, idx) => {
                    const scoreRow = DomHelper.createElement('tr');
                    const finalScore = this.calculateSectionFinalScore(section);
                    DomHelper.appendChildren(scoreRow,
                        DomHelper.createElement('td', { width: '60%', className: 'text-wrap' }, `${idx + 1}. ${section.title}`),
                        DomHelper.createElement('td', { width: '40%', className: 'text-center' }, finalScore)
                    );
                    tbody.appendChild(scoreRow);

                    const remarksList = section.questions
                        .filter(q => q.remarks && q.remarks.trim() !== '')
                        .map(q => q.remarks);
                    const remarksRow = DomHelper.createElement('tr');
                    const remarksCell = DomHelper.createElement('td', {
                        colSpan: '2',
                        className: 'template-table-remarks'
                    });
                    if (remarksList.length > 0) {
                        remarksList.forEach(remark => {
                            const remarkP = DomHelper.createElement('p', { className: 'mb-1' }, remark);
                            remarksCell.appendChild(remarkP);
                        });
                    } else {
                        const remarkP = DomHelper.createElement('p', { className: 'mb-1' }, 'No remarks');
                        remarksCell.appendChild(remarkP);
                    }
                    remarksRow.appendChild(remarksCell);
                    tbody.appendChild(remarksRow);
                });
                table.appendChild(tbody);

                // Add table footer with wavy-circle
                const tfoot = DomHelper.createElement('tfoot', { className: 'table-group-divider' });
                const overallRow = DomHelper.createElement('tr', {});
                const overallScore = this.calculateOverallPerformanceScore();
                const scoreBadge = DomHelper.createElement('span', { className: overallScore >= 3.5 ? 'wavy-circle' : 'wavy-circle silver' }, overallScore);
                const scoreCell = DomHelper.createElement('td', { className: 'text-center text-primary position-relative' });
                scoreCell.appendChild(scoreBadge);

                DomHelper.appendChildren(overallRow,
                    DomHelper.createElement('th', {}, 'Overall Performance Score'),
                    scoreCell
                );
                tfoot.appendChild(overallRow);
                table.appendChild(tfoot);

                sectionElement.appendChild(table);

                // Navigation with Back and Submit buttons
                const navDiv = DomHelper.createElement('div', { className: 'template-navigation' });
                const backBtn = DomHelper.createElement('button', { className: 'btn btn-subtle-secondary template-navigation-button-back', type: 'button' }, 'Back');
                backBtn.addEventListener('click', () => this.navigate('back'));
                navDiv.appendChild(backBtn);

                // Conditionally render submit button based on submitEnable
                if (this.submitEnable) {
                    const submitBtn = DomHelper.createElement('button', {
                        id: this.submitId,
                        className: 'btn btn-primary template-navigation-button-submit',
                        type: 'button'
                    }, `${this.submitText || "Submit"}`);
                    navDiv.appendChild(submitBtn);
                }

                sectionElement.appendChild(navDiv);
            } else {
                const section = this.formData.sections[this.currentSection];
                const question = section.questions[this.currentQuestion];
                const totalQuestions = this.getTotalQuestions();
                const currentGlobalIndex = this.getCurrentGlobalQuestionIndex();
                const progress = totalQuestions > 0 ? Math.round((currentGlobalIndex / totalQuestions) * 100) : 0;

                // Auto-set finalScore if revieweeAnswer matches reviewerAnswer
                if (question.type === 'linearScale' &&
                    question.revieweeAnswer === question.reviewerAnswer &&
                    question.revieweeAnswer !== null &&
                    question.finalScore === null &&
                    !question.finalScoreOverridden) {
                    question.finalScore = question.revieweeAnswer;
                }

                const sectionInfo = DomHelper.createElement('div', { className: 'template-section-info-container' });
                const titleDiv = DomHelper.createElement('div');
                const sectionTitle = DomHelper.createElement('h4', { className: 'template-section-title' }, `${this.currentSection + 1}. ${section.title || `Section ${this.currentSection + 1}`}`);
                const sectionDesc = section.description ? DomHelper.createElement('p', { className: 'template-section-description' }, section.description) : null;
                DomHelper.appendChildren(titleDiv, sectionTitle, sectionDesc);
                const weightScore = this.showScores ? DomHelper.createElement('span', { className: 'template-section-weight-score' }, `${(section.weightScore * 100).toFixed(0)}%`) : null;
                DomHelper.appendChildren(sectionInfo, titleDiv, weightScore);
                sectionElement.appendChild(sectionInfo);

                const questionsContainer = DomHelper.createElement('div', { className: 'template-questions-container' });
                const questionCard = DomHelper.createElement('div', { className: 'template-question-card' });
                const questionId = `q-${this.currentSection}-${this.currentQuestion}`;

                const fieldset = DomHelper.createElement('fieldset', { className: 'template-question-container', 'aria-labelledby': questionId });
                const infoContainer = DomHelper.createElement('div', { className: 'template-question-info-container' });
                const qNumber = DomHelper.createElement('span', { className: 'template-question-number' }, `Question ${this.currentQuestion + 1}`);
                const qWeight = this.showScores ? DomHelper.createElement('span', { className: 'template-question-weight-score' }, `${(question.weightScore * 100).toFixed(0)}%`) : null;
                DomHelper.appendChildren(infoContainer, qNumber, qWeight);
                const qTitle = DomHelper.createElement('legend', { className: 'template-question-title' }, question.title);
                if (question.required) qTitle.appendChild(DomHelper.createElement('span', { className: 'required text-danger' }, ' *'));

                if (question.type === 'linearScale') {
                    const scaleContainer = DomHelper.createElement('div', {
                        className: 'template-question-linear-scale-container',
                        role: 'radiogroup',
                        'aria-labelledby': questionId,
                        'aria-required': question.required
                    });
                    const minValue = question.minValue || 0;
                    const maxValue = question.maxValue || 5;
                    const revieweeAnswer = question.revieweeAnswer;
                    const reviewerAnswer = question.reviewerAnswer;
                    const revieweeInitials = this.getInitials(this.review.reviewee);
                    const reviewerInitials = this.getInitials(this.review.reviewer);

                    for (let value = minValue; value <= maxValue; value++) {
                        const isRevieweeChecked = revieweeAnswer === value;
                        const isReviewerChecked = reviewerAnswer === value;
                        const input = DomHelper.createElement('input', {
                            type: 'checkbox',
                            className: 'btn-check',
                            name: questionId,
                            id: `${questionId}-${value}`,
                            value: value,
                            disabled: true,
                            checked: isRevieweeChecked || isReviewerChecked
                        });
                        const labelClass = `btn flex-fill ${isRevieweeChecked && isReviewerChecked ? 'btn-success' : isRevieweeChecked ? 'btn-outline-info' : isReviewerChecked ? 'btn-outline-warning' : 'btn-outline-secondary'}`;
                        const labelText = value === 0 ? 'N/A' : value.toString();
                        const label = DomHelper.createElement('label', { className: labelClass, for: `${questionId}-${value}` }, labelText);
                        if (isRevieweeChecked) label.appendChild(DomHelper.createElement('span', { className: 'template-avatar-reviewee' }, revieweeInitials));
                        if (isReviewerChecked) label.appendChild(DomHelper.createElement('span', { className: 'template-avatar-reviewer' }, reviewerInitials));
                        DomHelper.appendChildren(scaleContainer, input, label);
                    }

                    const labelContainer = DomHelper.createElement('div', { className: 'template-question-linear-scale-label-container' });
                    DomHelper.appendChildren(labelContainer,
                        DomHelper.createElement('span', { className: 'template-question-linear-scale-label' }, question.minLabel || 'Poor'),
                        DomHelper.createElement('span', { className: 'template-question-linear-scale-label' }, question.maxLabel || 'Excellent')
                    );

                    if (this.previewMode) {
                        const agreedFieldset = DomHelper.createElement('fieldset', { className: 'template-question-card-agreed' });
                        const agreedLegend = DomHelper.createElement('legend', { className: 'form-label' }, 'Agreed Score');
                        const agreedScale = DomHelper.createElement('div', { className: 'template-question-linear-scale-container', role: 'radiogroup', 'aria-labelledby': questionId });
                        const answersDiffer = revieweeAnswer !== reviewerAnswer;
                        for (let value = minValue; value <= maxValue; value++) {
                            const isChecked = question.finalScore === value;
                            const input = DomHelper.createElement('input', {
                                type: 'radio',
                                className: 'btn-check',
                                name: `${questionId}-agreed`,
                                id: `${questionId}-agreed-${value}`,
                                value: value,
                                disabled: true,
                                checked: isChecked
                            });
                            const labelText = value === 0 ? 'N/A' : value.toString();
                            const label = DomHelper.createElement('label', {
                                className: `btn ${isChecked ? 'btn-success' : 'btn-outline-secondary'} flex-fill`,
                                for: `${questionId}-agreed-${value}`
                            }, labelText);
                            DomHelper.appendChildren(agreedScale, input, label);
                        }
                        const agreedLabels = DomHelper.createElement('div', { className: 'template-question-linear-scale-label-container' });
                        DomHelper.appendChildren(agreedLabels,
                            DomHelper.createElement('span', { className: 'template-question-linear-scale-label' }, question.minLabel || 'Poor'),
                            DomHelper.createElement('span', { className: 'template-question-linear-scale-label' }, question.maxLabel || 'Excellent')
                        );
                        // Validation message in preview mode is not shown
                        DomHelper.appendChildren(agreedFieldset, agreedLegend, agreedScale, agreedLabels);

                        const remarksFieldset = DomHelper.createElement('fieldset', { className: 'template-question-card-agreed' });
                        const remarksLabel = DomHelper.createElement('label', { className: 'form-label', for: `${questionId}-remarks` }, 'Remarks');
                        const remarksTextarea = DomHelper.createElement('textarea', {
                            className: 'form-control lh-base p-3 bg-body rounded-2',
                            rows: '6',
                            id: `${questionId}-remarks`,
                            'aria-label': 'Remarks',
                            disabled: true
                        }, question.remarks || '');
                        DomHelper.appendChildren(remarksFieldset, remarksLabel, remarksTextarea);

                        DomHelper.appendChildren(fieldset, infoContainer, qTitle, scaleContainer, labelContainer, agreedFieldset, remarksFieldset);
                    } else {
                        const answersDiffer = revieweeAnswer !== reviewerAnswer;
                        const collapseBtn = DomHelper.createElement('button', {
                            className: 'btn template-button-collapse',
                            type: 'button',
                            'data-bs-toggle': 'collapse',
                            'data-bs-target': `#${questionId}-collapse`,
                            'aria-expanded': answersDiffer || question.finalScore !== null,
                            'aria-controls': `${questionId}-collapse`
                        }, 'Set final score or remarks <span class="vi-solid vi-angle-down"></span>');

                        const collapseDiv = DomHelper.createElement('div', {
                            className: `template-question-card-agreed-container collapse ${answersDiffer || question.finalScore !== null ? 'show' : ''}`,
                            id: `${questionId}-collapse`
                        });

                        const agreedFieldset = DomHelper.createElement('fieldset', { className: 'template-question-card-agreed' });
                        const agreedLegend = DomHelper.createElement('legend', { className: 'form-label' }, 'Agreed Score');
                        const agreedScale = DomHelper.createElement('div', { className: 'template-question-linear-scale-container', role: 'radiogroup', 'aria-labelledby': questionId });
                        for (let value = minValue; value <= maxValue; value++) {
                            const isChecked = question.finalScore === value;
                            const input = DomHelper.createElement('input', {
                                type: 'radio',
                                className: 'btn-check',
                                name: `${questionId}-agreed`,
                                id: `${questionId}-agreed-${value}`,
                                value: value,
                                required: value === minValue,
                                checked: isChecked
                            });
                            const labelText = value === 0 ? 'N/A' : value.toString();
                            const label = DomHelper.createElement('label', {
                                className: `btn ${isChecked ? 'btn-success' : 'btn-outline-secondary'} flex-fill`,
                                for: `${questionId}-agreed-${value}`
                            }, labelText);
                            input.addEventListener('change', (e) => this.updateFinalScore(this.currentSection, this.currentQuestion, parseInt(e.target.value)));
                            DomHelper.appendChildren(agreedScale, input, label);
                        }
                        const agreedLabels = DomHelper.createElement('div', { className: 'template-question-linear-scale-label-container' });
                        DomHelper.appendChildren(agreedLabels,
                            DomHelper.createElement('span', { className: 'template-question-linear-scale-label' }, question.minLabel || 'Poor'),
                            DomHelper.createElement('span', { className: 'template-question-linear-scale-label' }, question.maxLabel || 'Excellent')
                        );
                        // If visited and agreed score missing, show error highlight and message
                        if (this.shouldShowAgreedError(question, this.currentSection, this.currentQuestion)) {
                            agreedFieldset.className += ' border border-danger rounded-2';
                            agreedScale.setAttribute('aria-invalid', 'true');
                            const errorMsg = DomHelper.createElement('div', { className: 'text-danger small mt-2' }, 'Please select an agreed score.');
                            DomHelper.appendChildren(agreedFieldset, agreedLegend, agreedScale, agreedLabels, errorMsg);
                        } else {
                            DomHelper.appendChildren(agreedFieldset, agreedLegend, agreedScale, agreedLabels);
                        }

                        const remarksFieldset = DomHelper.createElement('fieldset', { className: 'template-question-card-agreed' });
                        const remarksLabel = DomHelper.createElement('label', { className: 'form-label', for: `${questionId}-remarks` }, 'Remarks');
                        const remarksTextarea = DomHelper.createElement('textarea', {
                            className: 'form-control lh-base p-3 bg-body rounded-2',
                            rows: '6',
                            id: `${questionId}-remarks`,
                            'aria-label': 'Remarks'
                        }, question.remarks || '');
                        remarksTextarea.addEventListener('input', (e) => this.updateRemarks(this.currentSection, this.currentQuestion, e.target.value));
                        DomHelper.appendChildren(remarksFieldset, remarksLabel, remarksTextarea);

                        DomHelper.appendChildren(collapseDiv, agreedFieldset, remarksFieldset);
                        DomHelper.appendChildren(fieldset, infoContainer, qTitle, scaleContainer, labelContainer, collapseBtn, collapseDiv);
                    }
                } else if (question.type === 'text') {
                    const textContainer = DomHelper.createElement('div', { className: 'vstack gap-4' });
                    const roles = [
                        { name: this.review.reviewee || 'Reviewee', answer: question.revieweeAnswer, className: 'template-avatar-reviewee' },
                        { name: this.review.reviewer || 'Reviewer', answer: question.reviewerAnswer, className: 'template-avatar-reviewer' }
                    ];

                    roles.forEach(participant => {
                        const answerRow = DomHelper.createElement('div', { className: 'd-flex gap-3' });
                        const avatar = DomHelper.createElement('span', { className: participant.className }, this.getInitials(participant.name));
                        const answerText = DomHelper.createElement('p', { className: 'mb-0 p-3 bg-body rounded-2' }, participant.answer || 'No response provided');
                        DomHelper.appendChildren(answerRow, avatar, answerText);
                        textContainer.appendChild(answerRow);
                    });

                    if (this.previewMode) {
                        const remarksFieldset = DomHelper.createElement('fieldset', { className: 'template-question-card-agreed' });
                        const remarksLabel = DomHelper.createElement('label', { className: 'form-label', for: `${questionId}-remarks` }, 'Remarks');
                        const remarksTextarea = DomHelper.createElement('textarea', {
                            className: 'form-control lh-base p-3 bg-body rounded-2',
                            rows: '6',
                            id: `${questionId}-remarks`,
                            'aria-label': 'Remarks',
                            disabled: true
                        }, question.remarks || '');
                        DomHelper.appendChildren(remarksFieldset, remarksLabel, remarksTextarea);
                        DomHelper.appendChildren(fieldset, infoContainer, qTitle, textContainer, remarksFieldset);
                    } else {
                        const collapseBtn = DomHelper.createElement('button', {
                            className: 'btn template-button-collapse',
                            type: 'button',
                            'data-bs-toggle': 'collapse',
                            'data-bs-target': `#${questionId}-collapse`,
                            'aria-expanded': 'false',
                            'aria-controls': `${questionId}-collapse`
                        }, 'Show remarks <span class="vi-solid vi-angle-down"></span>');

                        const collapseDiv = DomHelper.createElement('div', { className: 'template-question-card-agreed-container collapse', id: `${questionId}-collapse` });
                        const remarksFieldset = DomHelper.createElement('fieldset', { className: 'template-question-card-agreed' });
                        const remarksLabel = DomHelper.createElement('label', { className: 'form-label', for: `${questionId}-remarks` }, 'Remarks');
                        const remarksTextarea = DomHelper.createElement('textarea', {
                            className: 'form-control lh-base p-3 bg-body rounded-2',
                            rows: '6',
                            id: `${questionId}-remarks`,
                            'aria-label': 'Remarks'
                        }, question.remarks || '');
                        remarksTextarea.addEventListener('input', (e) => this.updateRemarks(this.currentSection, this.currentQuestion, e.target.value));
                        DomHelper.appendChildren(remarksFieldset, remarksLabel, remarksTextarea);
                        DomHelper.appendChildren(collapseDiv, remarksFieldset);
                        DomHelper.appendChildren(fieldset, infoContainer, qTitle, textContainer, collapseBtn, collapseDiv);
                    }
                }

                questionCard.appendChild(fieldset);
                questionsContainer.appendChild(questionCard);
                sectionElement.appendChild(questionsContainer);

                // Navigation with Back, Progress, and Next buttons
                const navDiv = DomHelper.createElement('div', { className: 'template-navigation' });
                if (this.currentSection > 0 || this.currentQuestion > 0) {
                    const backBtn = DomHelper.createElement('button', { className: 'btn btn-subtle-secondary template-navigation-button-back', type: 'button' }, 'Back');
                    backBtn.addEventListener('click', () => this.navigate('back'));
                    navDiv.appendChild(backBtn);
                }

                // Progress Bar based on current question index
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

                if (this.currentSection < totalSections || (this.currentSection === totalSections - 1 && this.currentQuestion < this.formData.sections[this.currentSection].questions.length - 1)) {
                    const isCurrentQuestionComplete = this.checkCompletion();
                    this.nextButton = DomHelper.createElement('button', {
                        className: 'btn btn-primary template-navigation-button-next',
                        type: 'button'
                    }, 'Next');
                    if (!this.previewMode && !isCurrentQuestionComplete) {
                        this.nextButton.setAttribute('disabled', '');
                    }
                    this.nextButton.addEventListener('click', () => this.navigate('next'));
                    navDiv.appendChild(this.nextButton);
                }
                sectionElement.appendChild(navDiv);
            }

            sectionContainer.appendChild(sectionElement);
        } else if (totalSections === 0) {
            const noSections = DomHelper.createElement('p', { className: 'mb-0' }, 'No sections added yet');
            sectionContainer.appendChild(noSections);
        }

        this.container.appendChild(sectionContainer);
    }

    destroy() {
        if (this.updateInterval) {
            clearInterval(this.updateInterval);
            this.updateInterval = null;
        }
        if (this.lastEditedTimeout) {
            clearTimeout(this.lastEditedTimeout);
            this.lastEditedTimeout = null;
        }
    }
}