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

    uniqueFilename(nodeData) {
        const filename = Utils.generateUniqueFilename(nodeData.seed, nodeData.idx, this.usedFilenames);
        this.usedFilenames.add(filename);
        return filename;
    }

    /**
     * Processes a batch of image URLs
     * @param {Array} nodes Array of URLs or file nodes to process
     * @param {BaseDataSource} dataSource
     * @param {BaseDataTarget} dataTarget
     * @param {String} fetchMethod
     */
    async process(nodes, dataSource, dataTarget, fetchMethod) {
        this.reset();
        let processed = 0;
        const total = nodes.length;

        this.events.emit('data:batch:start', {source: dataSource, target: dataTarget});

        for (let i = 0; i < nodes.length; i++) {
            if (this.stopFlag) break;

            let nodeData = nodes[i];
            nodeData.target =  dataTarget;

            if (!nodeData.seed) {
                nodeData.status = 'empty';
                this.events.emit('data:node:update', nodeData)
            } else {
                try {
                    nodeData = await this.fetch(nodeData, fetchMethod);
                    nodeData.status = 'success';
                    this.events.emit('data:node:update', nodeData)
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
        this.usedFilenames = new Set();
    }

    /**
     * Fetches an image from a URL
     *
     * @param {Object} nodeData An object with node data
     * @param {String} method The fetch method to invoke
     * @returns {Object} nodeData with added properties
     */
    async fetch(nodeData, method) {
        if (method === 'thumbnail') {
            return this.fetchThumbnail(nodeData);
        }
        else if (method === 'http') {
            return this.fetchHttp(nodeData);
        }
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
    async fetchHttp(nodeData) {
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

        nodeData.blob = await response.blob();
        nodeData.filename = this.uniqueFilename(nodeData);
        nodeData.thumbnail = await Utils.createThumbnailFromBlob(nodeData.blob);

        return nodeData;
    }

    /**
     * Fetches an image from a file
     *
     * @param {Object} nodeData An object with the file object in the seed property
     * @returns {Object} nodeData with added properties:
     *                          - thumbnail
     */
    async fetchThumbnail(nodeData) {
        nodeData.thumbnail = await Utils.createThumbnailFromFile(nodeData.seed);
        return nodeData;
    }

}

class HTTPError extends Error {
  constructor(response) {
    super(`Failed to fetch ${response.url}`);
    this.name = "HTTPError";
    this.statusCode = response.status;
    this.statusText = response.statusText;
    this.url = response.url;

    if (this.statusText === "") {
        if (this.statusCode === 429) {
            this.statusText = "Too many requests"
        }
    }
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
    constructor(name, eventBus) {
        this.name = name;
        this.events = eventBus;
        this.data = [];
        this.headers = [];
        this.zip = null;

        this.clear();
    }

    clear() {
        this.zip = null;
        this.data = [];
        this.headers = ["inm_status","inm_imgdataurl","inm_filename"];
    }

    load() {
        return;
    }

    /**
     * Returns a list of seed node items
     *
     * @param {Object} fetchSettings An object with the key column
     * @returns {{seed: *, idx: *, row: *, source: *}[]}
     */
    seeds(fetchSettings = {}) {
        return this.data
            .map((row, index) => ({
                seed: row[fetchSettings.column], // A URL or a file object
                idx: index,
                row: row,
                source : this
            }));
    }

    update(nodeData) {
        try {
            const row = this.data[nodeData.idx] || null;
            if (!row) {
                throw Error('Invalid node index');
            }

            row.inm_status = nodeData.status || 'success';

            if (nodeData.thumbnail) {
                row.inm_imgdataurl = nodeData.thumbnail;
            }

            if (nodeData.filename) {
                row.inm_filename = nodeData.filename;
            }

            if (nodeData.blob && nodeData.filename) {
                this.addFile(nodeData);
            }

            this.events.emit('data:node:updated', nodeData)
        } catch (error) {
            this.events.emit('app:log:add', Utils.createLogEntry("error", error.message, error));
        }
    }


    getZip() {
        if (!this.zip) {
            this.zip = new JSZip();
        }
        return this.zip;
    }

    /**
     * Add new file to archive
     *
     * @param {Object} nodeData Object with properties filename and blob
     * @returns {Promise<void>}
     */
    async addFile(nodeData) {
        try {

            const zip = this.getZip();
            if (nodeData.filename && nodeData.blob) {
                const imgFolder = zip.folder("images");
                imgFolder.file(nodeData.filename, nodeData.blob);
            }

        } catch (error) {
            this.events.emit('app:log:add', Utils.createLogEntry("error", error.message, error));
        }
    }
}

class CsvDataSource extends BaseDataSource {

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
}

class FolderDataSource extends BaseDataSource {

    /**
     * Loads uploaded file names and objects
     *
     * @param {File[]} files
     * @returns {Promise<Object>}
     */
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
}

class BaseDataTarget {
    constructor(name, eventBus) {
        this.name = name;
        this.events = eventBus;
    }

    download(dataSource) {

    }
}

class DataTargetZip extends BaseDataTarget {

    /**
     * Generates ZIP file with images and updated CSV and sends it for downloading
     *
     */
    async download(dataSource) {
        try {
            const zip = dataSource.getZip();

            // Add CSV to ZIP
            const csv = Papa.unparse(dataSource.data);
            zip.file("images.csv", csv);

            // Generate and send ZIP
            const content = await zip.generateAsync({type: "blob"});
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


    /**
     * Generates CSV file and sends it for downloading
     *
     */
    async download(dataSource) {
        try {
            let csv = Papa.unparse(dataSource.data, {columns: dataSource.headers});
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

    getDataSource(sourceName = 'csv') {
        if (this.dataSources[sourceName]) {
            return this.dataSources[sourceName];
        }

        if (sourceName === 'csv') {
            this.dataSources[sourceName] = new CsvDataSource(sourceName, this.events);
        } else if (sourceName === 'folder')  {
            this.dataSources[sourceName] = new FolderDataSource(sourceName, this.events);
        } else {
            throw Error('Unsupported data source');
        }

        return this.dataSources[sourceName];
    }

    clearDataSources() {
        this.dataSources = {};
    }

    getDataTarget(targetName = 'csv') {
        if (this.dataTargets[targetName]) {
            return this.dataTargets[targetName];
        }

        if (targetName === 'csv') {
            this.dataTargets[targetName] = new DataTargetCsv(targetName, this.events);
        } else if (targetName === 'zip') {
            this.dataTargets[targetName] = new DataTargetZip(targetName, this.events);
        } else {
            throw Error('Unsupported target');
        }

        return this.dataTargets[targetName];
    }

    clearDataTargets() {
        this.dataTargets = {};
    }

    initEvents() {
        this.events.on('data:batch:start', (data) => this.onBatchStart(data));
        this.events.on('data:batch:finish', (data) => this.onBatchFinish(data));

        this.events.on('data:node:update', (data) => this.updateNode(data));
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
     * Initialize batch (not used by now)
     */
    onBatchStart(data) {

    }

    /**
     * Finish batch
     */
    onBatchFinish() {
        this.events.emit('app:batch:ready');
    }

    /**
     * Update node in source and target
     *
     * @param {Object} data An Object with the properties idx, row, seed, raw, status, source, target
     */
    async updateNode(data) {
        data.source.update(data);
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
    getStats(dataSource) {
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