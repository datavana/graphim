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
     * Processes a batch of image URLs
     * @param {Array} nodes Array of URLs or file nodes to process
     */
    async processBatch(nodes, dataSource, dataTarget) {
        this.reset();
        let processed = 0;
        const total = nodes.length;

        this.events.emit('data:batch:start', {source: dataSource, target: dataTarget});

        for (let i = 0; i < nodes.length; i++) {
            if (this.stopFlag) break;

            const { seed, rowIndex, row } = nodes[i];
            
            try {
                const blob = await dataSource.fetch(seed);
                this.events.emit('data:add:node', {idx: rowIndex, row: row, url: seed,  status: 'success', blob: blob, source: dataSource, target: dataTarget})
            } catch (error) {
                this.events.emit('data:node:error', {idx: rowIndex, row: row, url: seed, status: 'fail', error: error, source: dataSource, target: dataTarget})
            }
            
            processed++;
            this.events.emit('data:progress:step', {current: processed, total: total});
        }

        this.events.emit('data:batch:finish', {source: dataSource, target: dataTarget});
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

    async fetch() {
        return;
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

    /**
     * Fetches an image from a URL
     *
     * @param {string} node The image URL to fetch or the file object to use
     * @returns {Promise<Blob>} Promise resolving to image blob
     */
    async fetch(node) {
        const response = await fetch(node);
        if (!response.ok) {
            throw new Error(`Failed to fetch ${node} - ${response.status} ${response.statusText}`);
        }
        return await response.blob();
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

 /**
     * Fetches an image from a file
     *
     * @param {File} node The uploaded file
     * @returns {Promise<Blob>} Promise resolving to image blob
     */
    async fetch(node) {
        return new Promise((resolve, reject) => {
            resolve(node);
        });
    }

}

class BaseDataDarget {
    constructor(eventBus) {
        this.events = eventBus;
    }

    init() {

    }

    clear() {

    }

    add(data, row) {

    }

    download(dataSource) {

    }
}

class DataTargetZip extends BaseDataDarget {
    constructor(eventBus) {
        super(eventBus);

        this.zip = null;
        this.usedFilenames = new Set();
    }

    /**
     * Gets the set of used filenames
     *
     * @returns {Set} Set of used filenames
     */
    getUsedFilenames() {
        return this.usedFilenames;
    }

    init() {
        this.zip = new JSZip();
        this.zip.folder("images");
    }

    clear() {
        this.zip = null;
        this.usedFilenames.clear();
    }

    async add(data, row) {
        const usedFilenames = this.getUsedFilenames();
        const filename = Utils.generateUniqueFilename(data.url, data.idx, usedFilenames);
        const thumbnailData = await Utils.createThumbnailFromBlob(data.blob);

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
     * Generates ZIP file with images and updated CSV and sends it for downloading
     *
     */
    async download(dataSource) {
        try {
            if (!this.zip) {
                throw new Error("No ZIP archive created yet.");
            }

            // Add updated CSV to ZIP
            const csv = Papa.unparse(dataSource.data);
            this.zip.file("images.csv", csv);

            // Generate and download ZIP
            const content = await this.zip.generateAsync({ type: "blob" });
            saveAs(content, "output.zip");
        } catch (error) {
            this.events.emit('app:log:add', {msg: error.message, level: 'serious'});
        }
    }
}

class DataTargetCsv extends BaseDataDarget {
    constructor(eventBus) {
        super(eventBus);
    }
}

/**
 * Handles data management and file operations
 */
class DataModule {
    constructor(events) {
        this.events = events;

        this.dataSources = {};
        this.dataTargets = {};

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
        } else {
            throw Error('Unsupported source type');
        }

        return this.dataSources[sourceType];
    }

    clearDataSources() {
        this.dataSources = {};
    }

    getDataTarget(targetType = 'csv') {
        if (this.dataTargets[targetType]) {
            return this.dataTargets[targetType];
        }

        if (targetType === 'csv') {
            this.dataTargets[targetType] = new DataTargetCsv(this.events);
        } else if (targetType === 'folder') {
            this.dataTargets[targetType] = new DataTargetZip(this.events);
        } else {
            throw Error('Unsupported target type');
        }

        return this.dataTargets[targetType];
    }

    clearDataTargets() {
        this.dataTargets = {};
    }

    initEvents() {
        this.events.on('data:batch:start', (data) => this.onBatchStart(data));
        this.events.on('data:batch:finish', (data) => this.onBatchFinish(data));

        this.events.on('data:add:node', (data) => this.addNode(data));
        this.events.on('data:node:error', (data) => this.addError(data));
    }

    /**
     * Resets all data
     */
    reset() {
        this.clearDataTargets();
        this.clearDataSources();
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
    onBatchStart(data) {
        data.target.init();
    }

    onBatchFinish() {
        this.events.emit('app:batch:ready');
    }

    /**
     * Add node to database
     *
     * @param {Object} data An Object with the properties idx, row, url, blob, status, source
     */
    async addNode(data) {
        const dataSource = data.source;
        const dataTarget = data.target;

        if ((data.idx < 0) || (data.idx >= dataSource.data.length)) {
            throw new Error(`Invalid row index: ${data.idx}`);
        }

        const row = dataSource.data[data.idx];
        dataTarget.add(data, row);
    }

    /**
     * Handle errors
     *
     * @param {Object} data Object with properties idx, row, url, status, error, source
     */
    addError(data) {
        const dataSource = data.source;
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
}