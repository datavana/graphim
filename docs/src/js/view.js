/**
 * View layer: Handles UI components and user interactions
 */

/**
 * Base class for all UI widgets
 */
class BaseWidgetClass {

    constructor(elementId, parent, events) {

        this.parent = parent;
        this.events = events;
        if (!this.events && this.parent) {
            this.events = this.parent.events;
        }

        this.element = document.getElementById(elementId);
    }

    /**
     * Overwrite in subclasses
     */
    initEvents() {

    }

    /**
     * Overwrite in subclasses
     */
    reset() {

    }

    show() {
        if (this.element) {
            this.element.style.display = "block";
        }
    }

    hide() {
        if (this.element) {
            this.element.style.display = "none";
        }
    }

}

class PageWidget extends BaseWidgetClass {
    constructor(elementId, events) {
        super(elementId, null, events);

        this.setMode();

        this.tableWidget = new TableWidget('tableWidget', this);
        this.folderWidget = new TableWidget('folderWidget', this);

        this.logWidget = new LogWidget( 'logWidget', this);
        this.fetchWidget = new FetchWidget('fetchWidget', this);
        this.thumbsWidget = new ThumbsWidget( 'thumbsWidget', this);

        this.initEvents();
    }

    initEvents() {
        document.getElementById("startOverBtn").addEventListener(
            "click", () => this.events.emit('app:reset:start')
        );
    }

    reset() {
        this.tableWidget.reset();
        this.folderWidget.reset();

        this.logWidget.reset();
        this.fetchWidget.reset();
        this.thumbsWidget.reset();

        this.clearStage();
        this.setStage('start');
    }

    setMode() {
        const queryString = window.location.search;
        const urlParams = new URLSearchParams(queryString);
        const mode = urlParams.get('mode');

        this.element.classList.add(`mode-${mode}`);
    }

    clearStage(stage) {
        if (!stage) {
            Utils.removeClasses(this.element, 'stage-');
        } else {
            Utils.removeClasses(this.element, 'stage-' + stage);
        }
    }

    /**
     * Replace stage CSS class
     *
     * @param {String} stage
     */
    setStage(stage) {
        this.element.classList.add(`stage-${stage}`);
    }
}

class FetchWidget extends BaseWidgetClass {

    constructor(elementId, parent) {
        super(elementId, parent);
        this.initEvents();
    }

    initEvents() {
        document.getElementById("csvFile").addEventListener(
            "change", () => this.events.emit('app:input:changed', {'sourceName' : 'csv'})
        );
        document.getElementById("imgFolder").addEventListener(
            "change", () => this.events.emit('app:input:changed', {'sourceName' : 'folder'})
        );
        document.getElementById("downloadZipBtn").addEventListener(
            "click", () => this.events.emit('app:download:start', {'sourceName' : 'csv', 'targetName': 'zip'})
        );
        document.getElementById("downloadCsvBtn").addEventListener(
            "click", () => this.events.emit('app:download:start', {'sourceName' : 'folder', 'targetName': 'csv'})
        );
        document.getElementById("fetchBtn").addEventListener(
            "click", () => this.events.emit('app:fetch:start')
        );
        document.getElementById("stopBtn").addEventListener(
            "click", () => this.events.emit('app:fetch:stop')
        );
        document.getElementById("extractBtn").addEventListener(
            "click", () => this.events.emit('app:extract:start')
        )

        this.events.on('data:progress:step', (data) => this.updateProgress(data));

    }

    reset() {
        // Reset form and UI
        document.getElementById("csvFile").value = "";
        document.getElementById("urlColumn").innerHTML = "";
        document.getElementById("progress").textContent = "";
        document.getElementById('fileName').textContent = "";
    }

    getCsvFile() {
        const inputElm = document.getElementById("csvFile");
        if (!inputElm.files.length) return;
        const file = inputElm.files[0];
        document.getElementById('fileName').textContent = file.name;
        inputElm.value = "";
        return file;
    }
    getFolderFiles() {
        const inputElm = document.getElementById("imgFolder");
        const files = Array.from(inputElm.files);
        inputElm.value = "";
        return  files;
    }

    getSettings() {
        const urlCol = document.getElementById("urlColumn").value;
        return {
            column: urlCol
        }
    }

    updateColumnSelector(data) {
        const select = document.getElementById("urlColumn");
        select.innerHTML = "";
        data.headers.forEach(header => {
            if (!header.startsWith('inm_')) {
                const option = document.createElement("option");
                option.value = header;
                option.textContent = header;
                select.appendChild(option);
            }
        });
    }

    /**
     * Update progress display
     *
     * @param {Object} data A progress object with the properties current and total.
     */
    updateProgress(data) {
        const progressDiv = document.getElementById("progress");
        progressDiv.textContent = `Processed ${data.current} of ${data.total}`;
    }

}

class ThumbsWidget extends BaseWidgetClass {

    constructor(elementId, parent) {
        super(elementId, parent);
        this.events.on('data:node:updated', (nodeData) => this.addThumbnail(nodeData.thumbnail));
    }

    reset() {
        this.element.innerHTML = "";
    }
    
    /**
     * Add thumbnail to display
     */
    addThumbnail(thumbnailData) {
        const img = document.createElement("img");
        img.src = thumbnailData;
        img.style.maxWidth = "50px";
        img.style.maxHeight = "50px";
        this.element.appendChild(img);

        // Keep only last 10 thumbnails
        while (this.element.children.length > 10) {
            this.element.removeChild(this.element.firstChild);
        }
    }

}

/**
 * Class for table widgets
 */
class TableWidget extends BaseWidgetClass {

    constructor(elementId, parent, dataSource) {
        super(elementId, parent);

        this.dataSource = dataSource;
        this.events.on('data:node:updated', (nodeData) => {
            if (nodeData.source === this.dataSource) {
                this.updateRowStatus(nodeData);
                this.updateRowData(nodeData);
            }
        });
        this.events.on('data:node:error', (nodeData) => {
            if (nodeData.source === this.dataSource) {
                this.updateRowStatus(nodeData);
                this.updateRowData(nodeData);
            }
        });
    }

    setSource(dataSource) {
        this.dataSource = dataSource;
    }

    reset() {
        this.element.innerHTML = '';
    }

    /**
     * Renders the preview table (moved from original renderPreview method)
     *
     * @param {Object} data An object with the properties headers and rows.
     *                      Headers is a list of header names.
     *                      Rows is a list of rows.
     *                      Each row is an object with keys matching the headers.
       * @param {int} limit Maximum rows to show
     */
    showData(data, limit = 20) {

        if (!this.element) return;
        this.reset();

        const thead = document.createElement("thead");
        const headRow = document.createElement("tr");

        // Add row number column
        const rowNumTh = document.createElement("th");
        rowNumTh.textContent = "#";
        rowNumTh.classList.add("row-number");
        headRow.appendChild(rowNumTh);

        // Add table headers
        const allHeaders = [...data.headers];
        allHeaders.forEach(h => {
            const th = document.createElement("th");
            if (h.startsWith('inm_')) {
                th.classList.add('inm-column');
            }
            th.textContent = h;
            headRow.appendChild(th);
        });
        thead.appendChild(headRow);
        this.element.appendChild(thead);

        const tbody = document.createElement("tbody");

        const rows = data.rows.slice(0, limit);
        rows.forEach((row, idx) => {
           this.addRow(tbody, allHeaders, row, idx)
        });
        this.element.appendChild(tbody);

     // Create footer with total row count
        const tfoot = document.createElement("tfoot");
        const footRow = document.createElement("tr");
        const footCell = document.createElement("td");
        footCell.colSpan = allHeaders.length + 1;
        footCell.textContent = `Total rows: ${data.rows.length}`;
        footRow.appendChild(footCell);
        tfoot.appendChild(footRow);
        this.element.appendChild(tfoot);
    }


    addRow(tbody, headers, row, rowIndex = 0) {
        const tr = document.createElement("tr");
        
        // Add row number cell
        const rowNumTd = document.createElement("td");
        rowNumTd.classList.add("row-number");
        rowNumTd.textContent = (rowIndex + 1).toString();
        tr.appendChild(rowNumTd);
        
        // Table cells
        headers.forEach(h => {
            const td = document.createElement("td");
            td.textContent = row[h] || "";
            tr.appendChild(td);
        });
        tbody.appendChild(tr);
    }

    /**
     * Update table row status (for preview table)
     */
    updateRowStatus(data) {

        const rowIndex = data.idx;
        const status = data.status;

        const table = this.element;
        const tbody = table.querySelector("tbody");
        if (!tbody) return;

        const row = tbody.children[rowIndex];
        if (!row) return;

        row.classList.remove("success", "fail");
        if (status === 'success') {
            row.classList.add("success");
        }
        else if (status && status !== '') {
            row.classList.add("fail");
        }
    }

    /**
     * Updates a row with processed data (filename, thumbnail, status)
     *
     * @param {Object} data - Data object with idx, inm_filename, inm_imgdataurl, inm_status
     */
    updateRowData(data) {

        if (data.idx >= data.source.data.length) {
            throw Error('Invalid row index')
        }

        const rowData = data.source.data[data.idx];
        const rowIndex = data.idx;

        const tbody = this.element.querySelector("tbody");
        if (!tbody) return;

        const row = tbody.children[rowIndex];
        if (!row) return;

        // Find the cells for our added columns
        const cells = row.querySelectorAll("td");
        const headers = ['inm_filename', 'inm_imgdataurl', 'inm_status'];
        
        // Update cells with new data
        headers.forEach((header) => {
            const cellIndex = this.findColumnIndex(header);
            if (cellIndex === undefined) return;
            const cell = cells[cellIndex];
            if (!cell || !rowData.hasOwnProperty(header)) return;
            cell.textContent = rowData[header] || "";
        });
    }

    /**
     * Helper method to find column index by header name
     * @param {string} headerName Name of the header to find
     * @returns {number} Column index or undefined if not found
     */
    findColumnIndex(headerName) {
        const thead = this.element.querySelector("thead");
        if (!thead) return;
        
        const headers = thead.querySelectorAll("th");
        for (let i = 0; i < headers.length; i++) {
            if (headers[i].textContent.trim() === headerName) {
                return i;
            }
        }
        return;
    }

}

/**
 * Handles error logging display
 */
class LogWidget extends BaseWidgetClass {

    constructor(logWidgetId, parent) {
        super(logWidgetId, parent);
        this.debugMode = false;
        this.logViewer =  this.element.querySelector('.log-data');
        this.initEvents();
    }

    reset() {
        this.clearLog();
    }

    initEvents() {
        this.events.on('app:log:add', (data) => this.addMessage(data));
        this.events.on('app:log:clear', () => this.clearLog());

        // TODO: Simplify. One button should rule them all!
        document.getElementById("toggleLogBtn").addEventListener("click", () => this.toggleLog());
        document.getElementById("showLogBtn").addEventListener("click", () => this.showLog());
    }

    toggleLog() {
        const logWidget = document.getElementById("logWidget");
        const toggleBtn = document.getElementById("toggleLogBtn");
        const showLogBtn = document.getElementById("showLogBtn");

        // TODO: Don't! Let CSS classes handle visibility!
        if (logWidget.style.display === "none") {
            logWidget.style.display = "block";
            toggleBtn.textContent = "Hide Log";
            showLogBtn.style.display = "none";
        } else {
            logWidget.style.display = "none";
            toggleBtn.textContent = "Show Log";
            showLogBtn.style.display = "inline-block";
        }
    }

    showLog() {
        const logWidget = document.getElementById("logWidget");
        const toggleBtn = document.getElementById("toggleLogBtn");
        const showLogBtn = document.getElementById("showLogBtn");

        // TODO: Don't! Let CSS classes handle visibility.
        logWidget.style.display = "block";
        toggleBtn.textContent = "Hide Log";
        showLogBtn.style.display = "none";
    }

    /**
     * Add structured log message
     *
     * @param {Object} logData Structured log data {timestamp, severity, msg, details}
     */
    addMessage(logData) {
        if (this.debugMode) {
            console[logData.severity === 'error' ? 'error' : 'log'](
                `[${logData.timestamp}] ${logData.msg}`,
                logData.details
            );
        }

        const logEntry = document.createElement("div");
        logEntry.className = "log-entry";
        logEntry.innerHTML = `
            <div class="log-meta">
                <div class="log-timestamp">${logData.timestamp}</div>
                <div class="log-msg">${logData.msg}</div>
            </div>
            <div class="log-details">${this.formatDetails(logData.details)}</div>
        `;
        this.logViewer.appendChild(logEntry);

        this.element.classList.remove('log-empty');
        this.element.classList.add('log-notempty');
        this.logViewer.scrollTop = this.logViewer.scrollHeight;
    }

    /**
     * Format details object for display
     *
     * @param {Object} details Details object
     * @returns {string} Formatted details string
     */
    formatDetails(details) {
        if (!details || Object.keys(details).length === 0) return '';
        
        const parts = [];
        if (details.statusCode || details.statusText) {
            parts.push(`Status: ${details.statusCode} ${details.statusText}`);
        }
        if (details.row) parts.push(`Row: ${details.row}`);
        
        return parts.join(' | ');
    }

    clearLog() {
        this.element.classList.add('log-empty');
        this.element.classList.remove('log-notempty');
        this.logViewer.innerHTML = "";
    }
}