/**
 * Model layer for the ImageNetMaker
 * Handles data operations, network requests, and file processing
 */

/**
 * Handles HTTP requests and network operations
 */
class RequestModule {

    constructor(events) {
        this.events = events;
        this.stopFlag = false;
    }

    /**
     * Fetches an image from a URL
     *
     * @param {string} url - The image URL to fetch
     * @returns {Promise<Blob>} Promise resolving to image blob
     */
    async fetchBlob(url) {
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`Failed to fetch ${url} - ${response.status} ${response.statusText}`);
        }
        return await response.blob();
    }

    /**
     * Processes a batch of image URLs
     * @param {Array} urls Array of URLs to process
     * @param {Function} onError - Callback for failed fetches
     */
    async processBatch(urls,  onError) {
        this.reset();
        let processed = 0;
        const total = urls.length;

        this.events.emit('data:batch:start');

        for (let i = 0; i < urls.length; i++) {
            if (this.stopFlag) break;

            const { url, rowIndex, row } = urls[i];
            
            try {
                const blob = await this.fetchBlob(url);
                this.events.emit('data:add:node', {idx: rowIndex, row: row, url: url,  status: 'success', blob: blob})
            } catch (error) {
                this.events.emit('data:node:error', {idx: rowIndex, row: row, url: url, status: 'fail', error: error})
            }
            
            processed++;
            this.events.emit('data:progress:step', {current: processed, total: total});
        }

        this.events.emit('data:batch:finish');
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

}

/**
 * Handles data management and file operations
 */
class DataModule {
    constructor(events) {
        this.events = events;

        this.parsedData = [];
        this.loadedFiles = [];

        this.zip = null;
        this.usedFilenames = new Set();

        this.initEvents();
    }

    initEvents() {
        this.events.on('data:batch:start', () => this.onBatchStart());
        this.events.on('data:batch:finish', () => this.onBatchFinish());

        this.events.on('data:add:node', (data) => this.addNode(data));
        this.events.on('data:node:error', (data) => this.addError(data));
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
     * Loads and parses CSV file
     *
     * @param {File} file The CSV file to parse
     * @returns {Promise<Object>} Promise resolving to and object with headers and rows
     */
    async loadCSV(file) {
        return new Promise((resolve, reject) => {
            Papa.parse(file, {
                header: true,
                complete: (results) => {
                    this.parsedData = results.data;
                    const headers = results.meta.fields;
                    
                    // Initialize new columns for all rows
                    // TODO: Better implement a update column / add column / update value method
                    //       that adds columns if necessary
                    this.parsedData.forEach((row, index) => {
                        row.inm_filename = "";
                        row.inm_imgdata = "";
                        row.inm_status = "";
                    });
                    
                    resolve({
                        rows: this.parsedData,
                        headers: headers
                    });
                },
                error: (error) => {
                    reject(error);
                }
            });
        });
    }

     async loadFolder(files) {
        return new Promise((resolve, reject) => {

            this.loadedFiles = Array.from(files)
                .filter(file => file.type.startsWith('image/'))
                .map(file => ({
                    filename: file.name,
                    fileobject: file
                }));


             resolve({
                    rows: this.loadedFiles,
                    headers: ['filename']
                });
        });
    }

    /**
     * Returns a list of URLs
     *
     * @param {String} urlCol The column containing an URL
     * @returns {{rowIndex: *, row: *, url: *}[]}
     */
    getSeedNodes(urlCol) {
        return this.parsedData
            .map((row, index) => ({
                url: row[urlCol],
                rowIndex: index,
                row: row
            }))
            .filter(item => item.url);
    }

    /**
     * Initializes ZIP file for image storage
     */
    onBatchStart() {
        this.zip = new JSZip();
        this.zip.folder("images");
    }

    onBatchFinish() {
        this.events.emit('app:batch:ready');
    }

    /**
     * Add node to database
     *
     * @param {Object} data An Object with the properties idx, row, url, blob, status
     */
    async addNode(data) {

        if ((data.idx < 0) || (data.idx >= this.parsedData.length)) {
            throw new Error(`Invalid row index: ${data.idx}`);
        }

        const usedFilenames = this.getUsedFilenames();
        const filename = Utils.generateUniqueFilename(data.url, data.idx, usedFilenames);
        const thumbnailData = await Utils.createThumbnailFromBlob(data.blob);

        const row = this.parsedData[data.idx];
        row.inm_filename = filename;
        row.inm_imgdata = thumbnailData;
        row.inm_status = 'success';

        // Add to ZIP
        if (this.zip) {
            const imgFolder = this.zip.folder("images");
            imgFolder.file(filename, data.blob);
            this.usedFilenames.add(filename);
        }

        this.events.emit('data:node:added', {idx: data.idx, status: data.status, thumb: thumbnailData})
    }

    /**
     * Handle errors
     *
     * @param {Object} data Object with properties idx, row, url, status, error
     */
    addError(data) {
        if ((data.idx >= 0) && (data.idx < this.parsedData.length)) {
            const errorMessage = Utils.humanizeError(data.error);
            this.parsedData[data.idx].inm_status = errorMessage;
        }

        // Log error
        let errorDetails = `${data.error.name}: ${data.error.message}`;
        const logMessage = `${Utils.humanizeError(data.error)}. ${data.url}. Row ${data.idx + 1}.`;
        this.events.emit('app:log:add', {level: 'log', msg: logMessage, details: errorDetails})
    }

    /**
     * Generates ZIP file with images and updated CSV and sends it for downloading
     *
     */
    async saveZip() {
        try {
            if (!this.zip) {
                throw new Error("No ZIP archive created yet.");
            }

            // Add updated CSV to ZIP
            const csv = Papa.unparse(this.parsedData);
            this.zip.file("updated_images.csv", csv);

            // Generate and download ZIP
            const content = await this.zip.generateAsync({ type: "blob" });
            saveAs(content, "output.zip");
        } catch (error) {
            this.events.emit('app:log:add', {msg: error.message, level: 'serious'});
        }
    }

    /**
     * Gets processing statistics
     *
     * @returns {Object} Statistics about processed data
     */
    getStats() {
        const total = this.parsedData.length;
        const successful = this.parsedData.filter(row => row.inm_status === "success").length;
        const failed = this.parsedData.filter(row => row.inm_status && row.inm_status !== "success" && row.inm_status !== "").length;
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
     * Gets the set of used filenames
     *
     * @returns {Set} Set of used filenames
     */
    getUsedFilenames() {
        return this.usedFilenames;
    }
}