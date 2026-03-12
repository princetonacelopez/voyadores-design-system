class Chunk {
    constructor(data = [], size = 10) {
        try {
            // Validation
            this.validateChunk(data);

            // Initialize class variables
            this.data = data;
            this.size = size;
            this.chunkedData = this.getChunkData(); // Default flat chunking
        } catch (e) {
            const res = e.response;
            if (res) {
                this.notify(res.data, "error");
            } else {
                this.notify(e.message, "error");
            }

            return null;
        }
    }

    validateChunk(data) {
        if (data.length <= 0) {
            throw new Error('Chunk data cannot be empty');
        }
    }

    getChunkData() {
        // Generate flat chunked data
        const totalChunks = Math.ceil(this.data.length / this.size);
        let chunkedData = [];

        for (let i = 0; i < totalChunks; i++) {
            const start = i * this.size;
            const end = Math.min(start + this.size, this.data.length);
            const chunk = this.data.slice(start, end);

            // Push each chunk into the array
            chunkedData.push(chunk);
        }

        return chunkedData;
    }

    // Method to chunk a specified property of the data
    chunkArray(property) {
        const chunked = []; // Array to hold the chunked result

        // Iterate over each item in the data
        this.data.forEach(item => {
            const { [property]: logs, ...rest } = item; // Destructure to get the specified property and the rest

            // Check if the property exists and is an array
            if (Array.isArray(logs)) {
                // Chunk the specified property into smaller arrays
                for (let i = 0; i < logs.length; i += this.size) {
                    const chunk = logs.slice(i, i + this.size); // Create a chunk

                    // Push a new object that includes all item data, replacing the specified property with the chunk
                    chunked.push({
                        ...rest, // Include all other properties
                        [property]: chunk, // Use the property name dynamically
                    });
                }
            }
        });

        return chunked; // Return the array of chunked results
    }

    notify(message, type) {
        console.error(`${type.toUpperCase()}: ${message}`);
    }
}