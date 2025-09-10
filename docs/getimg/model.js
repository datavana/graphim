/**
 * Model layer for the ImageNetMaker
 * Handles data operations, network requests, and file processing
 */

/**
 * Handles HTTP requests and network operations
 */
class RequestModule {
    constructor() {
        this.stopFlag = false;
    }

    /**
     * Fetches an image from a URL
     * @param {string} url - The image URL to fetch
     * @returns {Promise<Blob>} Promise resolving to image blob
     */
    async fetchImage(url) {
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`Failed to fetch ${url} - ${response.status} ${response.statusText}`);
        }
        return await response.blob();
    }

    /**
     * Processes a batch of image URLs
     * @param {Array} urls - Array of URLs to process
     * @param {Function} onProgress - Callback for progress updates
     * @param {Function} onSuccess - Callback for successful fetches
     * @param {Function} onError - Callback for failed fetches
     */
    async processBatch(urls, onProgress, onSuccess, onError) {
        let processed = 0;
        const total = urls.length;

        for (let i = 0; i < urls.length; i++) {
            if (this.stopFlag) break;

            const { url, rowIndex, row } = urls[i];
            
            try {
                const blob = await this.fetchImage(url);
                await onSuccess(blob, url, rowIndex, row);
            } catch (error) {
                onError(error, url, rowIndex, row);
            }
            
            processed++;
            onProgress(processed, total);
        }
    }

    /**
     * Stops the current batch processing
     */
    stop() {
        this.stopFlag = true;
    }

    /**
     * Resets the stop flag for new processing
     */
    reset() {
        this.stopFlag = false;
    }

    /**
     * Logs a message with timestamp
     * @param {string} level - Log level (info, error, warning)
     * @param {string} message - Message to log
     * @param {Object} details - Additional details
     */
    logMessage(level, message, details = null) {
        const timestamp = Utils.getCurrentTimestamp();
        const logEntry = {
            timestamp,
            level,
            message,
            details
        };
        
        // Emit event for listeners
        this.emit('log', logEntry);
        
        // Console logging for development
        console[level === 'error' ? 'error' : 'log'](`[${timestamp}] ${message}`, details);
    }

    /**
     * Simple event emitter functionality
     */
    emit(eventName, data) {
        if (this.listeners && this.listeners[eventName]) {
            this.listeners[eventName].forEach(callback => callback(data));
        }
    }

    /**
     * Add event listener
     */
    on(eventName, callback) {
        if (!this.listeners) this.listeners = {};
        if (!this.listeners[eventName]) this.listeners[eventName] = [];
        this.listeners[eventName].push(callback);
    }
}

/**
 * Handles data management and file operations
 */
class DataModule {
    constructor() {
        this.parsedData = [];
        this.zip = null;
        this.usedFilenames = new Set();
    }

    /**
     * Loads and parses CSV file
     * @param {File} file - The CSV file to parse
     * @returns {Promise<Object>} Promise resolving to parsed data and headers
     */
    async loadCSV(file) {
        return new Promise((resolve, reject) => {
            Papa.parse(file, {
                header: true,
                complete: (results) => {
                    this.parsedData = results.data;
                    const headers = results.meta.fields;
                    
                    // Initialize new columns for all rows
                    this.parsedData.forEach((row, index) => {
                        row.filename = "";
                        row.imgdata = "";
                        row._status = "";
                    });
                    
                    resolve({
                        data: this.parsedData,
                        headers: headers
                    });
                },
                error: (error) => {
                    reject(error);
                }
            });
        });
    }

    /**
     * Initializes ZIP file for image storage
     */
    initializeZip() {
        this.zip = new JSZip();
        return this.zip.folder("images");
    }

    /**
     * Adds a result (image + metadata) to the dataset
     * @param {number} rowIndex - Index of the row to update
     * @param {string} filename - Generated filename
     * @param {string} thumbnailData - Base64 thumbnail data
     * @param {Blob} imageBlob - Original image blob
     * @param {string} status - Processing status
     */
    addResult(rowIndex, filename, thumbnailData, imageBlob, status = "") {
        if (rowIndex < 0 || rowIndex >= this.parsedData.length) {
            throw new Error(`Invalid row index: ${rowIndex}`);
        }

        const row = this.parsedData[rowIndex];
        row.filename = filename;
        row.imgdata = thumbnailData;
        row._status = status;

        // Add to ZIP if successful
        if (status === "" && this.zip) {
            const imgFolder = this.zip.folder("images");
            imgFolder.file(filename, imageBlob);
            this.usedFilenames.add(filename);
        }
    }

    /**
     * Marks a row as failed
     * @param {number} rowIndex - Index of the row to mark as failed
     */
    markRowFailed(rowIndex) {
        if (rowIndex >= 0 && rowIndex < this.parsedData.length) {
            this.parsedData[rowIndex]._status = "";
        }
    }

    /**
     * Gets a subset of data for preview
     * @param {number} limit - Maximum number of rows to return
     * @returns {Array} Subset of parsed data
     */
    getPreviewData(limit = 20) {
        return this.parsedData.slice(0, limit);
    }

    /**
     * Gets all parsed data
     * @returns {Array} All parsed data
     */
    getAllData() {
        return this.parsedData;
    }

    /**
     * Generates and downloads ZIP file with images and updated CSV
     * @returns {Promise<void>}
     */
    async saveZip() {
        if (!this.zip) {
            throw new Error("No ZIP archive created yet.");
        }

        // Add updated CSV to ZIP
        const csv = Papa.unparse(this.parsedData);
        this.zip.file("updated_images.csv", csv);

        // Generate and download ZIP
        const content = await this.zip.generateAsync({ type: "blob" });
        saveAs(content, "ImgNetMaker_output.zip");
    }

    /**
     * Gets processing statistics
     * @returns {Object} Statistics about processed data
     */
    getStats() {
        const total = this.parsedData.length;
        const successful = this.parsedData.filter(row => row._status === "").length;
        const failed = this.parsedData.filter(row => row._status === "").length;
        const pending = total - successful - failed;

        return {
            total,
            successful,
            failed,
            pending,
            progress: total > 0 ? (successful + failed) / total : 0
        };
    }

    /**
     * Resets all data
     */
    reset() {
        this.parsedData = [];
        this.zip = null;
        this.usedFilenames.clear();
    }

    /**
     * Gets the set of used filenames
     * @returns {Set} Set of used filenames
     */
    getUsedFilenames() {
        return this.usedFilenames;
    }
}