import { FormTemplate, Section, QuestionFactory } from './model.js';
import {
    AddSectionCommand, AddQuestionCommand, UpdatePropertyCommand,
    DeleteSectionCommand, DeleteQuestionCommand, DuplicateSectionCommand, DuplicateQuestionCommand,
    ReorderSectionCommand, ReorderQuestionCommand, TransferQuestionCommand
} from './commands.js';
import { Observable } from './utils.js';

export class FormViewModel {
    constructor(options = {}) {
        this.formTemplate = new FormTemplate('Untitled Form', '');
        this.selectedSectionIndex = null;
        this.previewSectionIndex = 0;
        this.history = [];
        this.undone = [];
        this.observable = new Observable();
        this.options = {
            isQuestionRequired: true,
            ...options
        };
    }

    notifyUpdate() {
        this.observable.notify(this);
    }

    addSection() {
        const section = new Section(`Section ${this.formTemplate.sections.length + 1}`, '');
        const command = new AddSectionCommand(this, section);
        command.execute();
        this.history.push(command);
        this.undone = [];
        this.selectedSectionIndex = this.formTemplate.sections.length - 1;
    }

    addQuestion(type, title = 'Untitled Question', sectionIndex = this.selectedSectionIndex) {
        // Ensure at least one section exists
        if (!this.formTemplate.sections.length) {
            this.addSection();
            sectionIndex = this.selectedSectionIndex;
        } else if (sectionIndex === null || sectionIndex >= this.formTemplate.sections.length || sectionIndex < 0) {
            // Use the first section if sectionIndex is invalid
            sectionIndex = 0;
        }

        const section = this.formTemplate.sections[sectionIndex];
        if (!section) {
            console.error(`Section at index ${sectionIndex} is undefined`);
            return;
        }

        const question = QuestionFactory.create(type, section.id, title, {
            required: this.options.isQuestionRequired
        });
        const command = new AddQuestionCommand(this, sectionIndex, question);
        command.execute();
        this.history.push(command);
        this.undone = [];
    }

    deleteSection(sectionIndex) {
        const command = new DeleteSectionCommand(this, sectionIndex);
        command.execute();
        this.history.push(command);
        this.undone = [];
        this.selectedSectionIndex = this.formTemplate.sections.length ? 0 : null;
    }

    deleteQuestion(sectionIndex, questionIndex) {
        const command = new DeleteQuestionCommand(this, sectionIndex, questionIndex);
        command.execute();
        this.history.push(command);
        this.undone = [];
    }

    duplicateSection(sectionIndex) {
        const command = new DuplicateSectionCommand(this, sectionIndex);
        command.execute();
        this.history.push(command);
        this.undone = [];
        this.selectedSectionIndex = sectionIndex + 1;
    }

    duplicateQuestion(sectionIndex, questionIndex) {
        const command = new DuplicateQuestionCommand(this, sectionIndex, questionIndex);
        command.execute();
        this.history.push(command);
        this.undone = [];
    }

    reorderSection(fromIndex, toIndex) {
        const command = new ReorderSectionCommand(this, fromIndex, toIndex);
        command.execute();
        this.history.push(command);
        this.undone = [];
        this.selectedSectionIndex = toIndex;
    }

    reorderQuestion(sectionIndex, fromIndex, toIndex) {
        const command = new ReorderQuestionCommand(this, sectionIndex, fromIndex, toIndex);
        command.execute();
        this.history.push(command);
        this.undone = [];
    }

    transferQuestion(fromSectionIndex, toSectionIndex, fromQuestionIndex, toQuestionIndex) {
        const command = new TransferQuestionCommand(this, fromSectionIndex, toSectionIndex, fromQuestionIndex, toQuestionIndex);
        command.execute();
        this.history.push(command);
        this.undone = [];
        this.selectedSectionIndex = toSectionIndex;
    }

    undo() {
        if (!this.history.length) return;
        const command = this.history.pop();
        command.undo();
        this.undone.push(command);
        if (this.selectedSectionIndex >= this.formTemplate.sections.length) {
            this.selectedSectionIndex = this.formTemplate.sections.length - 1;
        }
    }

    redo() {
        if (!this.undone.length) return;
        const command = this.undone.pop();
        command.execute();
        this.history.push(command);
    }

    updateTemplateTitle(title) {
        const oldValue = this.formTemplate.title;
        const command = new UpdatePropertyCommand(this, null, null, 'title', title, oldValue, 'template');
        command.execute();
        this.history.push(command);
        this.undone = [];
    }

    updateTemplateDescription(description) {
        const oldValue = this.formTemplate.description;
        const command = new UpdatePropertyCommand(this, null, null, 'description', description, oldValue, 'template');
        command.execute();
        this.history.push(command);
        this.undone = [];
    }

    updateTemplatePosition(position) {
        const oldValue = this.formTemplate.positionId; // Updated to positionId
        const command = new UpdatePropertyCommand(this, null, null, 'positionId', position, oldValue, 'template');
        command.execute();
        this.history.push(command);
        this.undone = [];
    }

    updateTemplateProperty(property, value) {
        const oldValue = this.formTemplate[property];
        const command = new UpdatePropertyCommand(this, null, null, property, value, oldValue, 'template');
        command.execute();
        this.history.push(command);
        this.undone = [];
    }

    updateSectionTitle(sectionIndex, title) {
        if (this.formTemplate.sections[sectionIndex]) {
            const oldValue = this.formTemplate.sections[sectionIndex].title;
            const command = new UpdatePropertyCommand(this, sectionIndex, null, 'title', title, oldValue);
            command.execute();
            this.history.push(command);
            this.undone = [];
        }
    }

    updateSectionDescription(sectionIndex, description) {
        if (this.formTemplate.sections[sectionIndex]) {
            const oldValue = this.formTemplate.sections[sectionIndex].description;
            const command = new UpdatePropertyCommand(this, sectionIndex, null, 'description', description, oldValue);
            command.execute();
            this.history.push(command);
            this.undone = [];
        }
    }

    updateQuestionTitle(sectionIndex, questionIndex, title) {
        const section = this.formTemplate.sections[sectionIndex];
        if (section && section.questions[questionIndex]) {
            const oldValue = section.questions[questionIndex].title;
            const command = new UpdatePropertyCommand(this, sectionIndex, questionIndex, 'title', title, oldValue);
            command.execute();
            this.history.push(command);
            this.undone = [];
        }
    }

    updateQuestionType(sectionIndex, questionIndex, type) {
        const section = this.formTemplate.sections[sectionIndex];
        if (section && section.questions[questionIndex]) {
            const oldQuestion = section.questions[questionIndex];
            const newQuestion = QuestionFactory.create(type, section.id, oldQuestion.title, {
                id: oldQuestion.id,
                required: oldQuestion.required,
                weightedType: oldQuestion.weightedType,
                minScore: oldQuestion.minScore,
                maxScore: oldQuestion.maxScore,
                minLabel: oldQuestion.minLabel,
                maxLabel: oldQuestion.maxLabel
            });
            const command = {
                execute: () => {
                    section.questions[questionIndex] = newQuestion;
                    this.notifyUpdate();
                },
                undo: () => {
                    section.questions[questionIndex] = oldQuestion;
                    this.notifyUpdate();
                }
            };
            command.execute();
            this.history.push(command);
            this.undone = [];
        }
    }

    updateQuestionRequired(sectionIndex, questionIndex, required, noRender = false) {
        const section = this.formTemplate.sections[sectionIndex];
        if (!section || !section.questions[questionIndex]) {
            throw new Error('Invalid section or question index');
        }

        const oldValue = section.questions[questionIndex].required;
        if (oldValue === required) {
            return;
        }

        const command = new UpdatePropertyCommand(this, sectionIndex, questionIndex, 'required', required, oldValue);
        command.execute();
        this.history.push(command);
        this.undone = [];

        if (!noRender) {
            this.notifyUpdate();
        }
    }

    updateQuestionMinValue(sectionIndex, questionIndex, minValue) {
        const section = this.formTemplate.sections[sectionIndex];
        if (section && section.questions[questionIndex] && section.questions[questionIndex].type === 'linearScale') {
            const oldValue = section.questions[questionIndex].minScore;
            const command = new UpdatePropertyCommand(this, sectionIndex, questionIndex, 'minScore', parseInt(minValue), oldValue);
            command.execute();
            this.history.push(command);
            this.undone = [];
        }
    }

    updateQuestionMaxValue(sectionIndex, questionIndex, maxValue) {
        const section = this.formTemplate.sections[sectionIndex];
        if (section && section.questions[questionIndex] && section.questions[questionIndex].type === 'linearScale') {
            const oldValue = section.questions[questionIndex].maxScore;
            const command = new UpdatePropertyCommand(this, sectionIndex, questionIndex, 'maxScore', parseInt(maxValue), oldValue);
            command.execute();
            this.history.push(command);
            this.undone = [];
        }
    }

    updateQuestionMinLabel(sectionIndex, questionIndex, minLabel) {
        const section = this.formTemplate.sections[sectionIndex];
        if (section && section.questions[questionIndex] && section.questions[questionIndex].type === 'linearScale') {
            const oldValue = section.questions[questionIndex].minLabel;
            const command = new UpdatePropertyCommand(this, sectionIndex, questionIndex, 'minLabel', minLabel, oldValue);
            command.execute();
            this.history.push(command);
            this.undone = [];
        }
    }

    updateQuestionMaxLabel(sectionIndex, questionIndex, maxLabel) {
        const section = this.formTemplate.sections[sectionIndex];
        if (section && section.questions[questionIndex] && section.questions[questionIndex].type === 'linearScale') {
            const oldValue = section.questions[questionIndex].maxLabel;
            const command = new UpdatePropertyCommand(this, sectionIndex, questionIndex, 'maxLabel', maxLabel, oldValue);
            command.execute();
            this.history.push(command);
            this.undone = [];
        }
    }

    updateQuestionWeightedType(sectionIndex, questionIndex, weightedType) {
        const section = this.formTemplate.sections[sectionIndex];
        if (section && section.questions[questionIndex]) {
            const oldValue = section.questions[questionIndex].weightedType;
            const command = new UpdatePropertyCommand(this, sectionIndex, questionIndex, 'weightedType', weightedType, oldValue);
            command.execute();
            this.history.push(command);
            this.undone = [];
        }
    }

    calculateWeights() {
        const totalSections = this.formTemplate.sections.length;
        if (totalSections > 0) {
            const sectionWeight = 1 / totalSections;
            this.formTemplate.sections.forEach(section => {
                section.weightScore = sectionWeight;
                const totalQuestions = section.questions.length;
                if (totalQuestions > 0) {
                    const questionWeight = 1 / totalQuestions;
                    section.questions.forEach(question => {
                        question.weightScore = questionWeight;
                    });
                }
            });
        }
        this.notifyUpdate();
    }

    subscribe(listener) {
        this.observable.subscribe(listener);
    }
}