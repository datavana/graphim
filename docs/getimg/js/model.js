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
     * @param {string} node The image URL to fetch or the file object to use
     * @returns {Promise<Blob>} Promise resolving to image blob
     */
    async fetchBlob(node) {
        const response = await fetch(node);
        if (!response.ok) {
            throw new Error(`Failed to fetch ${node} - ${response.status} ${response.statusText}`);
        }
        return await response.blob();
    }

 /**
     * Fetches an image from a URL
     *
     * @param {string} node The image URL to fetch or the file object to use
     * @returns {Promise<Blob>} Promise resolving to image blob
     */
    async fetchFile(node) {
        // TODO
        return;
    }

    /**
     * Processes a batch of image URLs
     * @param {Array} nodes Array of URLs or file nodes to process
     */
    async processBatch(nodes) {
        this.reset();
        let processed = 0;
        const total = nodes.length;

        this.events.emit('data:batch:start');

        for (let i = 0; i < nodes.length; i++) {
            if (this.stopFlag) break;

            const { seed, rowIndex, row } = nodes[i];
            
            try {
                const blob = await this.fetchBlob(seed);
                this.events.emit('data:add:node', {idx: rowIndex, row: row, url: seed,  status: 'success', blob: blob})
            } catch (error) {
                this.events.emit('data:node:error', {idx: rowIndex, row: row, url: seed, status: 'fail', error: error})
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

class BaseDataSource {
    constructor() {

        this.data = [];
    }

    clear() {
        this.data = [];
    }
}

class CsvDataSource extends BaseDataSource {
    constructor() {
        super();
    }

 /**
     * Loads and parses CSV file
     *
     * @param {File} file The CSV file to parse
     * @returns {Promise<Object>} Promise resolving to and object with headers and rows
     */
    async load(file) {
        return new Promise((resolve, reject) => {
            Papa.parse(file, {
                header: true,
                complete: (results) => {
                    this.data = results.data;
                    const headers = results.meta.fields;

                    // Initialize new columns for all rows
                    // TODO: Better implement a update column / add column / update value method
                    //       that adds columns if necessary
                    this.data.forEach((row, index) => {
                        row.inm_filename = "";
                        row.inm_imgdata = "";
                        row.inm_status = "";
                    });

                    resolve({
                        rows: this.data,
                        headers: headers
                    });
                },
                error: (error) => {
                    reject(error);
                }
            });
        });
    }
}

class FolderDataSource extends BaseDataSource {
    constructor() {
        super();
    }


     async load(files) {
        return new Promise((resolve, reject) => {

            this.data = Array.from(files)
                .filter(file => file.type.startsWith('image/'))
                .map(file => ({
                    filename: file.name,
                    fileobject: file
                }));


             resolve({
                    rows: this.data,
                    headers: ['filename']
                });
        });
    }

}

/**
 * Handles data management and file operations
 */
class DataModule {
    constructor(events) {
        this.events = events;

        this.dataSources = {};

        this.zip = null;
        this.usedFilenames = new Set();

        this.initEvents();
    }

    getDataSource(sourceType = 'csv') {
        if (this.dataSources[sourceType]) {
            return this.dataSources[sourceType];
        }

        if (sourceType === 'csv') {
            this.dataSources[sourceType] = new CsvDataSource();
        } else if (sourceType === 'folder')  {
            this.dataSources[sourceType] = new FolderDataSource();
        }

        return this.dataSources[sourceType];
    }

    clearDataSources() {
        this.dataSources = {};
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
        this.clearDataSources();
        this.zip = null;
        this.usedFilenames.clear();
    }

    /**
     * Returns a list of URLs
     *
     * @param {Object} fetchSettings An object with the key column
     * @returns {{rowIndex: *, row: *, url: *}[]}
     */
    getSeedNodes(sourceType = 'csv', fetchSettings = {}) {
        const dataSource = this.getDataSource(sourceType);
        return dataSource.data
            .map((row, index) => ({
                seed: row[fetchSettings.column], // A URL or a file object
                rowIndex: index,
                row: row,
                sourceType : sourceType
            }))
            .filter(item => item.seed);
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
    async addNode(data, sourceType = 'csv') {
        const dataSource = this.getDataSource(sourceType);
        if ((data.idx < 0) || (data.idx >= dataSource.data.length)) {
            throw new Error(`Invalid row index: ${data.idx}`);
        }

        const usedFilenames = this.getUsedFilenames();
        const filename = Utils.generateUniqueFilename(data.url, data.idx, usedFilenames);
        const thumbnailData = await Utils.createThumbnailFromBlob(data.blob);

        const row = dataSource.data[data.idx];
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
    addError(data, sourceType = 'csv') {
        const dataSource = this.getDataSource(sourceType);
        if ((data.idx >= 0) && (data.idx < dataSource.data.length)) {
            const errorMessage = Utils.humanizeError(data.error);
            dataSource.data[data.idx].inm_status = errorMessage;
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
    async saveZip(sourceType = 'csv') {
        try {
            if (!this.zip) {
                throw new Error("No ZIP archive created yet.");
            }

            // Add updated CSV to ZIP
            const dataSource = this.getDataSource(sourceType);
            const csv = Papa.unparse(dataSource.data);
            this.zip.file("images.csv", csv);

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
    getStats(sourceType = 'csv') {
        const dataSource = this.getDataSource(sourceType);
        const total = dataSource.data.length;
        const successful = dataSource.data.filter(row => row.inm_status === "success").length;
        const failed = dataSource.data.filter(row => row.inm_status && row.inm_status !== "success" && row.inm_status !== "").length;
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