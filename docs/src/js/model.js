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

            const { seed, idx, row } = nodes[i];
            let nodeData = {
                idx: idx,
                row: row,
                seed: seed,
                source: dataSource,
                target: dataTarget
            };

            if (!seed) {
                nodeData.status = 'empty';
                this.events.emit('data:add:node', nodeData)
            } else {
                try {
                    nodeData = await dataSource.fetch(nodeData);
                    nodeData.status = 'success';
                    this.events.emit('data:add:node', nodeData)
                } catch (error) {
                    nodeData.error = error;
                    nodeData.status = 'fail';
                    this.events.emit('data:node:error', nodeData)
                }
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

class HTTPError extends Error {
  constructor(response) {
    super(`Failed to fetch ${response.url}`);
    this.name = "HTTPError";
    this.statusCode = response.status;
    this.statusText = response.statusText;
    this.url = response.url;
  }
}

class NetworkError extends Error {
  constructor(url) {
    super(`Failed to fetch ${url}`);
    this.name = "NetworkError";
    this.statusCode = '';
    this.statusText = 'Network or CORS error';
    this.url = url;
  }
}


class BaseDataSource {
    constructor() {
        this.data = [];
        this.headers = [];
        this.clear();
    }

    clear() {
        this.data = [];
        this.headers = [];
    }

    async fetch() {
        return;
    }
}

class CsvDataSource extends BaseDataSource {
    constructor() {
        super();
    }

    clear() {
        super.clear();
        this.headers = ["inm_status","inm_imgdataurl","inm_filename"];
        this.usedFilenames = new Set();
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
                    this.clear();
                    this.data = results.data;
                    this.headers = [...this.headers, ...results.meta.fields];

                    resolve({
                        headers: this.headers,
                        rows: this.data
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
     * @param {Object} nodeData An object with the image URL in the seed property
     * @returns {Object} nodeData with added properties:
     *                          - filename
     *                          - raw
     *                          - thumbnail
     */
    async fetch(nodeData) {
        let response;
        try {
            response = await fetch(nodeData.seed);
        }
        catch (error) {
             if (error instanceof TypeError) {
                 throw new NetworkError(nodeData.seed);
             } else {
                 // Re-throw other errors
                 throw error;
             }
        }

        if (!response) {
            throw new Error('Response error');
        }

        if (!response.ok) {
            throw new HTTPError(response);
        }

        nodeData.raw = await response.blob();
        nodeData.filename = this.uniqueFilename(nodeData);
        nodeData.thumbnail = await Utils.createThumbnailFromBlob(nodeData.raw);

        return nodeData;
    }

    uniqueFilename(nodeData) {
        const filename = Utils.generateUniqueFilename(nodeData.seed, nodeData.idx, this.usedFilenames);
        this.usedFilenames.add(filename);
        return filename;
    }
}

class FolderDataSource extends BaseDataSource {
    constructor() {
        super();
    }

        clear() {
            super.clear();
            this.headers = ["inm_status","inm_imgdataurl","inm_filename"];
    }


     async load(files) {
        return new Promise((resolve, reject) => {

            this.clear();

            this.data = Array.from(files)
                .filter(file => file.type.startsWith('image/'))
                .map(file => ({
                    inm_filename: file.name,
                    fileobject: file
                }));


             resolve({
                    headers: this.headers,
                    rows: this.data
                });
        });
    }

    /**
     * Fetches an image from a file
     *
     * @param {Object} nodeData An object with the file object in the seed property
     * @returns {Object} nodeData with added properties:
     *                          - thumbnail
     */
    async fetch(nodeData) {
        nodeData.thumbnail = await Utils.createThumbnailFromFile(nodeData.seed);
        return (nodeData);
    }

}

class BaseDataTarget {
    constructor(eventBus) {
        this.events = eventBus;
    }

    init() {

    }

    clear() {

    }

    add(data) {

    }

    download(dataSource) {

    }
}

class DataTargetZip extends BaseDataTarget {
    constructor(eventBus) {
        super(eventBus);

        this.zip = null;
    }

    init() {
        this.zip = new JSZip();
        this.zip.folder("images");
    }

    clear() {
        this.zip = null;
    }

    /**
     * Add new data
     *
     * @param {Object} data Object with properties source, target, idx, seed, raw
     * @returns {Promise<void>}
     */
    async add(data) {
        try {
            const dataSource = data.source;
            const row = dataSource.data[data.idx] || null;
            if (!row) {
                throw Error('Invalid node index');
            }

            row.inm_status = data.status;

            if (data.raw && data.thumbnail) {

                // Add to table
                row.inm_filename = data.filename;
                row.inm_imgdataurl = data.thumbnail;

                // Add to ZIP
                if (this.zip && data.filename) {
                    const imgFolder = this.zip.folder("images");
                    imgFolder.file(data.filename, data.raw);
                }
            }

            this.events.emit('data:node:added', {data: data, row: row})
        } catch (error) {
            this.events.emit('app:log:add', Utils.createLogEntry("error", error.message, error));
        }
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
            saveAs(content, "imgnetmaker.zip");
        } catch (error) {
            const logEntry = Utils.createLogEntry(
                'error',
                'Could not generate download file',
                {
                    originalMessage: error.message,
                    errorType: error.name
                });
            this.events.emit('app:log:add', logEntry);
        }
    }
}

class DataTargetCsv extends BaseDataTarget {
    constructor(eventBus) {
        super(eventBus);
    }


    /**
     * Add new data
     *
     * @param {Object} data Object with properties source, target, idx, seed, raw
     * @returns {Promise<void>}
     */
    async add(data) {

        const dataSource = data.source;
        const row = dataSource.data[data.idx] || null;
        if (!row) {
            throw Error('Invalid node index');
        }
        row.inm_status = 'success';
        row.inm_imgdataurl = data.thumbnail;

        this.events.emit('data:node:added', {data: data, row: row})
    }

/**
     * Generates CSV file and sends it for downloading
     *
     */
    async download(dataSource) {
        try {

            let csv = Papa.unparse(dataSource.data, {columns : dataSource.headers});
            csv = new Blob([csv], {type: "text/csv;charset=utf-8"});
            saveAs(csv, "imgnetmaker.csv");
        } catch (error) {
            const logEntry = Utils.createLogEntry(
                'error',
                'Could not generate download file', {
                    originalMessage: error.message,
                    errorType: error.name
                });
            this.events.emit('app:log:add', logEntry);
        }
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
        } else if (targetType === 'zip') {
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
     * Returns a list of seed node items
     *
     * @param {Object} fetchSettings An object with the key column
     * @returns {{seed: *, idx: *, row: *, sourceType: *}[]}
     */
    getSeedNodes(sourceType = 'csv', fetchSettings = {}) {
        const dataSource = this.getDataSource(sourceType);
        return dataSource.data
            .map((row, index) => ({
                seed: row[fetchSettings.column], // A URL or a file object
                idx: index,
                row: row,
                sourceType : sourceType
            }));
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
     * @param {Object} data An Object with the properties idx, row, seed, raw, status, source
     */
    async addNode(data) {
        data.target.add(data);
    }

    /**
     * Handle errors
     *
     * @param {Object} data Object with properties idx, row, url, status, error, source
     */
    addError(data) {
        if (!data.error) {
            return;
        }

        // Add error to table
        const dataSource = data.source;
        if ((data.idx >= 0) && (data.idx < dataSource.data.length)) {
            dataSource.data[data.idx].inm_status = `${data.error.name} ${data.error.statusCode} ${data.error.statusText}`;
        }

        // Log error
        const msg = `${data.error.name}: ${data.error.message}`;
        const details = data.error;
        details.row = data.idx + 1;
        this.events.emit('app:log:add', Utils.createLogEntry("error", msg, details));
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