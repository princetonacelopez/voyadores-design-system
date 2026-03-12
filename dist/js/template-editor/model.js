import { generateUUID } from './utils.js';

export class FormTemplate {
    constructor(
        id = generateUUID(),
        title = 'Untitled Form',
        description = '',
        positionName = '',
        positionId = '',
        createdBy = '',
        state = 0
    ) {
        this.id = id;
        this.title = title;
        this.description = description;
        this.positionName = positionName;
        this.positionId = positionId;
        this.createdBy = createdBy;
        this.state = state;
        this.sections = [];
    }
}

export class Section {
    constructor(title = 'Section 1', description = '', id = generateUUID(), weightScore = 0, orderNumber = 0) {
        this.id = id;
        this.title = title;
        this.description = description;
        this.weightScore = weightScore;
        this.orderNumber = orderNumber;
        this.questions = [];
    }
}

export class QuestionFactory {
    static create(type, sectionId, title = 'Untitled Question', options = {}) {
        const {
            id = generateUUID(),
            required = true,
            answer = null,
            weightScore = 0,
            weightedType = 'Default',
            orderNumber = 0,
            minScore = type === 'linearScale' ? 1 : null,
            maxScore = type === 'linearScale' ? 5 : null,
            minLabel = type === 'linearScale' ? 'Poor' : null,
            maxLabel = type === 'linearScale' ? 'Excellent' : null
        } = options;

        const normalizedType = typeof type === 'number' ? (type === 0 ? 'linearScale' : type === 1 ? 'text' : null) : type;

        if (!normalizedType || !['linearScale', 'text'].includes(normalizedType)) {
            throw new Error(`Unsupported question type: ${type}`);
        }

        const baseQuestion = {
            id,
            sectionId,
            title,
            type: normalizedType,
            required,
            answer,
            weightScore,
            weightedType,
            orderNumber
        };

        if (normalizedType === 'linearScale') {
            return {
                ...baseQuestion,
                minScore,
                maxScore,
                minLabel,
                maxLabel
            };
        }

        return baseQuestion;
    }
}