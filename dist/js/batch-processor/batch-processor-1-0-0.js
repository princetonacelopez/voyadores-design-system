class BatchProcessor {
    constructor(options = {}) {
        // Default options
        const defaults = {
            data                    : [],
            asyncFunc               : null,
            executeParallel : true, // 'parallel' or 'sequential'
        };

        // Merge options with defaults
        this.options = { ...defaults, ...options };

        // Validate the provided options
        this.validateBatchProcessing();
    }

    // Start processing the batch, return a Promise
    process() {
        return new Promise((resolve, reject) => {
            try {
                if (this.options.executeParallel) {
                    this.processInParallel().then(resolve).catch(reject);
                } else {
                    this.processSequentially().then(resolve).catch(reject);
                }
            } catch (e) {
                reject(e);
            }
        });
    }

    // Validate the batch processing options
    validateBatchProcessing() {
        const { data, asyncFunc } = this.options;

        if (!data) {
            throw new Error('Batch processing data cannot be null');
        }

        if (data.length <= 0) {
            throw new Error('Batch processing data cannot be empty');
        }

        if (typeof asyncFunc !== 'function') {
            throw new Error('AsyncFunc must be a function');
        }
    }

    // Process the batch in parallel
    processInParallel() {
        const { data, asyncFunc } = this.options;

        const promises = data.map(item => asyncFunc(item));

        // Return Promise for completion of all parallel tasks
        return Promise.all(promises)
            .then(data => data)
            .catch(e => {
                console.error("An error occured while processing batches in parallel: " + e);
                throw e;
            });
    }

    // Process the batch sequentially
    async processSequentially() {
        const { data, asyncFunc } = this.options;
        const responses = [];

        for (let item of data) {
            try {
                responses.push(await asyncFunc(item));
                // Handle success if needed
            } catch (e) {
                console.error("An error occured while processing batches in sequential: " + e);
                throw e;
            }
        }

        return responses;
    }
}