import { Section, QuestionFactory } from './model.js';
import { generateUUID } from './utils.js';

export class AddSectionCommand {
    constructor(viewModel, section) {
        this.viewModel = viewModel;
        this.section = section;
    }

    execute() {
        this.viewModel.formTemplate.sections.push(this.section);
        this.viewModel.calculateWeights();
        this.viewModel.notifyUpdate();
    }

    undo() {
        this.viewModel.formTemplate.sections.pop();
        this.viewModel.calculateWeights();
        this.viewModel.notifyUpdate();
    }
}

export class AddQuestionCommand {
    constructor(viewModel, sectionIndex, question) {
        this.viewModel = viewModel;
        this.sectionIndex = sectionIndex;
        this.question = question;
    }

    execute() {
        this.viewModel.formTemplate.sections[this.sectionIndex].questions.push(this.question);
        this.viewModel.calculateWeights();
        this.viewModel.notifyUpdate();
    }

    undo() {
        this.viewModel.formTemplate.sections[this.sectionIndex].questions.pop();
        this.viewModel.calculateWeights();
        this.viewModel.notifyUpdate();
    }
}

export class UpdatePropertyCommand {
    constructor(viewModel, sectionIndex, questionIndex, property, newValue, oldValue, scope = 'section') {
        this.viewModel = viewModel;
        this.sectionIndex = sectionIndex;
        this.questionIndex = questionIndex;
        this.property = property;
        this.newValue = newValue;
        this.oldValue = oldValue;
        this.scope = scope;
    }

    execute() {
        if (this.scope === 'template') {
            this.viewModel.formTemplate[this.property] = this.newValue;
        } else if (this.questionIndex === null) {
            const section = this.viewModel.formTemplate.sections[this.sectionIndex];
            if (section) section[this.property] = this.newValue;
        } else {
            const section = this.viewModel.formTemplate.sections[this.sectionIndex];
            if (section && section.questions[this.questionIndex]) {
                section.questions[this.questionIndex][this.property] = this.newValue;
            }
        }
        this.viewModel.notifyUpdate();
    }

    undo() {
        if (this.scope === 'template') {
            this.viewModel.formTemplate[this.property] = this.oldValue;
        } else if (this.questionIndex === null) {
            const section = this.viewModel.formTemplate.sections[this.sectionIndex];
            if (section) section[this.property] = this.oldValue;
        } else {
            const section = this.viewModel.formTemplate.sections[this.sectionIndex];
            if (section && section.questions[this.questionIndex]) {
                section.questions[this.questionIndex][this.property] = this.oldValue;
            }
        }
        this.viewModel.notifyUpdate();
    }
}

export class DeleteSectionCommand {
    constructor(viewModel, sectionIndex) {
        this.viewModel = viewModel;
        this.sectionIndex = sectionIndex;
        this.deletedSection = null;
    }

    execute() {
        this.deletedSection = this.viewModel.formTemplate.sections.splice(this.sectionIndex, 1)[0];
        this.viewModel.calculateWeights();
        this.viewModel.notifyUpdate();
    }

    undo() {
        this.viewModel.formTemplate.sections.splice(this.sectionIndex, 0, this.deletedSection);
        this.viewModel.calculateWeights();
        this.viewModel.notifyUpdate();
    }
}

export class DeleteQuestionCommand {
    constructor(viewModel, sectionIndex, questionIndex) {
        this.viewModel = viewModel;
        this.sectionIndex = sectionIndex;
        this.questionIndex = questionIndex;
        this.deletedQuestion = null;
    }

    execute() {
        this.deletedQuestion = this.viewModel.formTemplate.sections[this.sectionIndex].questions.splice(this.questionIndex, 1)[0];
        this.viewModel.calculateWeights();
        this.viewModel.notifyUpdate();
    }

    undo() {
        this.viewModel.formTemplate.sections[this.sectionIndex].questions.splice(this.questionIndex, 0, this.deletedQuestion);
        this.viewModel.calculateWeights();
        this.viewModel.notifyUpdate();
    }
}

export class DuplicateSectionCommand {
    constructor(viewModel, sectionIndex) {
        this.viewModel = viewModel;
        this.sectionIndex = sectionIndex;
        this.newSection = null;
    }

    execute() {
        const original = this.viewModel.formTemplate.sections[this.sectionIndex];
        this.newSection = new Section(
            `${original.title} (Copy)`,
            original.description,
            generateUUID(),
            original.weightScore
        );
        this.newSection.orderNumber = this.sectionIndex + 1;
        this.newSection.questions = original.questions.map(q => QuestionFactory.create(
            q.type,
            this.newSection.id,
            q.title,
            {
                id: generateUUID(),
                required: q.required,
                answer: q.answer,
                weightScore: q.weightScore,
                weightedType: q.weightedType,
                orderNumber: q.orderNumber,
                minScore: q.minScore,
                maxScore: q.maxScore,
                minLabel: q.minLabel,
                maxLabel: q.maxLabel
            }
        ));
        this.viewModel.formTemplate.sections.splice(this.sectionIndex + 1, 0, this.newSection);
        this.viewModel.calculateWeights();
        this.viewModel.notifyUpdate();
    }

    undo() {
        this.viewModel.formTemplate.sections.splice(this.sectionIndex + 1, 1);
        this.viewModel.calculateWeights();
        this.viewModel.notifyUpdate();
    }
}

export class DuplicateQuestionCommand {
    constructor(viewModel, sectionIndex, questionIndex) {
        this.viewModel = viewModel;
        this.sectionIndex = sectionIndex;
        this.questionIndex = questionIndex;
        this.newQuestion = null;
    }

    execute() {
        const original = this.viewModel.formTemplate.sections[this.sectionIndex].questions[this.questionIndex];
        const section = this.viewModel.formTemplate.sections[this.sectionIndex];
        this.newQuestion = QuestionFactory.create(
            original.type,
            section.id,
            `${original.title} (Copy)`,
            {
                id: generateUUID(),
                required: original.required,
                answer: original.answer,
                weightScore: original.weightScore,
                weightedType: original.weightedType,
                orderNumber: this.questionIndex + 1,
                minScore: original.minScore,
                maxScore: original.maxScore,
                minLabel: original.minLabel,
                maxLabel: original.maxLabel
            }
        );
        section.questions.splice(this.questionIndex + 1, 0, this.newQuestion);
        section.questions.forEach((q, index) => {
            q.orderNumber = index;
            this.viewModel.calculateWeights();
        });
        this.viewModel.notifyUpdate();
    }

    undo() {
        this.viewModel.formTemplate.sections[this.sectionIndex].questions.splice(this.questionIndex + 1, 1);
        this.viewModel.calculateWeights();
        this.viewModel.notifyUpdate();
    }
}

export class ReorderSectionCommand {
    constructor(viewModel, fromIndex, toIndex) {
        this.viewModel = viewModel;
        this.fromIndex = fromIndex;
        this.toIndex = toIndex;
        this.movedSection = null;
    }

    execute() {
        this.movedSection = this.viewModel.formTemplate.sections.splice(this.fromIndex, 1)[0];
        this.viewModel.formTemplate.sections.splice(this.toIndex, 0, this.movedSection);
        this.viewModel.formTemplate.sections.forEach((section, index) => {
            section.orderNumber = index;
        });
        this.viewModel.notifyUpdate();
    }

    undo() {
        this.viewModel.formTemplate.sections.splice(this.toIndex, 1);
        this.viewModel.formTemplate.sections.splice(this.fromIndex, 0, this.movedSection);
        this.viewModel.formTemplate.sections.forEach((section, index) => {
            section.orderNumber = index;
        });
        this.viewModel.notifyUpdate();
    }
}

export class ReorderQuestionCommand {
    constructor(viewModel, sectionIndex, fromIndex, toIndex) {
        this.viewModel = viewModel;
        this.sectionIndex = sectionIndex;
        this.fromIndex = fromIndex;
        this.toIndex = toIndex;
        this.movedQuestion = null;
    }

    execute() {
        this.movedQuestion = this.viewModel.formTemplate.sections[this.sectionIndex].questions.splice(this.fromIndex, 1)[0];
        this.viewModel.formTemplate.sections[this.sectionIndex].questions.splice(this.toIndex, 0, this.movedQuestion);
        this.viewModel.formTemplate.sections[this.sectionIndex].questions.forEach((question, index) => {
            question.orderNumber = index;
        });
        this.viewModel.notifyUpdate();
    }

    undo() {
        this.viewModel.formTemplate.sections[this.sectionIndex].questions.splice(this.toIndex, 1);
        this.viewModel.formTemplate.sections[this.sectionIndex].questions.splice(this.fromIndex, 0, this.movedQuestion);
        this.viewModel.formTemplate.sections[this.sectionIndex].questions.forEach((question, index) => {
            question.orderNumber = index;
        });
        this.viewModel.notifyUpdate();
    }
}

export class TransferQuestionCommand {
    constructor(viewModel, fromSectionIndex, toSectionIndex, fromQuestionIndex, toQuestionIndex) {
        this.viewModel = viewModel;
        this.fromSectionIndex = fromSectionIndex;
        this.toSectionIndex = toSectionIndex;
        this.fromQuestionIndex = fromQuestionIndex;
        this.toQuestionIndex = toQuestionIndex;
        this.movedQuestion = null;
    }

    execute() {
        this.movedQuestion = this.viewModel.formTemplate.sections[this.fromSectionIndex].questions.splice(this.fromQuestionIndex, 1)[0];
        const toSection = this.viewModel.formTemplate.sections[this.toSectionIndex];
        this.movedQuestion.sectionId = toSection.id;
        toSection.questions.splice(this.toQuestionIndex, 0, this.movedQuestion);
        this.viewModel.formTemplate.sections[this.fromSectionIndex].questions.forEach((question, index) => {
            question.orderNumber = index;
        });
        toSection.questions.forEach((question, index) => {
            question.orderNumber = index;
        });
        this.viewModel.notifyUpdate();
    }

    undo() {
        const fromSection = this.viewModel.formTemplate.sections[this.fromSectionIndex];
        this.viewModel.formTemplate.sections[this.toSectionIndex].questions.splice(this.toQuestionIndex, 1);
        this.movedQuestion.sectionId = fromSection.id;
        fromSection.questions.splice(this.fromQuestionIndex, 0, this.movedQuestion);
        fromSection.questions.forEach((question, index) => {
            question.orderNumber = index;
        });
        this.viewModel.formTemplate.sections[this.toSectionIndex].questions.forEach((question, index) => {
            question.orderNumber = index;
        });
        this.viewModel.notifyUpdate();
    }
}