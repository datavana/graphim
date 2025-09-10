/**
 * View layer for the Image CSV Processor
 * Handles UI components and user interactions
 */

/**
 * Base class for all UI widgets
 */
class BaseWidgetClass {

    constructor(app, elementId, parent) {
        this.app = app;
        this.parent = parent;
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

    setContent(content) {
        if (this.element) {
            this.element.innerHTML = content;
        }
    }
}

class PageWidget extends BaseWidgetClass {
    constructor(app, elementId) {
        super(app, elementId);

        this.tableWidget = new TableWidget(this.app, 'tableWidget', this);
        this.logWidget = new LogWidget(this.app, 'logWidget', 'logViewer', this);
        this.fetchWidget = new FetchWidget(this.app,'fetchWidget', this);
        this.thumbsWidget = new ThumbsWidget(this.app, 'thumbsWidget', this);

        this.initEvents();
    }

    initEvents() {
        document.getElementById("startOverBtn").addEventListener("click", () => this.app.startOver());
    }

    reset() {
        this.tableWidget.reset();
        this.logWidget.reset();
        this.fetchWidget.reset();
        this.thumbsWidget.reset();
    }
}

class FetchWidget extends BaseWidgetClass {

    constructor(app, elementId, parent) {
        super(app, elementId, parent);
        this.initEvents();
    }

    initEvents() {
        document.getElementById("csvFile").addEventListener("change", () => this.handleFileChange());
        document.getElementById("fetchBtn").addEventListener("click", () => this.handleFetch());
        document.getElementById("stopBtn").addEventListener("click", () => this.handleStop());
        document.getElementById("downloadZipBtn").addEventListener("click", () => this.handleDownloadZip());
    }

    reset() {
        // Reset form and UI
        document.getElementById("csvFile").value = "";
        document.getElementById("urlColumn").innerHTML = "";
        document.getElementById("progress").textContent = "";

        // Reset button visibility
        this.showFileControls();
        this.hideProcessingControls();
    }

    /**
     * Stop processing
     */
    handleStop() {
        this.app.requestModule.stop();
    }

    /**
     * Download ZIP file
     */
    async handleDownloadZip() {
        try {
            await this.app.dataModule.saveZip();
        } catch (error) {
            alert(error.message);
        }
    }

    /**
     * Handle CSV file upload and parsing
     */
    async handleFileChange() {
        const fileInput = document.getElementById("csvFile");
        if (!fileInput.files.length) return;
        const file = fileInput.files[0]

        try {
            document.getElementById('fileName').textContent = file.name;
            const result = await this.app.dataModule.loadCSV(file);

            // Populate column selector
            const select = document.getElementById("urlColumn");
            select.innerHTML = "";
            result.headers.forEach(header => {
                const option = document.createElement("option");
                option.value = header;
                option.textContent = header;
                select.appendChild(option);
            });

            // Show preview table
            this.parent.tableWidget.renderPreview(result.headers, result.data.slice(0, 20));

            // Show fetch controls
            document.getElementById("fetchBar").style.display = "flex";

        } catch (error) {
            alert("Error parsing CSV file: " + error.message);
        }
    }

    /**
     * Handle image fetching process
     *
     * TODO: split MVC steps
     */
    async handleFetch() {
        const urlCol = document.getElementById("urlColumn").value;
        const progressDiv = document.getElementById("progress");

        // Initialize processing
        this.app.dataModule.initializeZip();
        this.app.requestModule.reset();
        this.parent.logWidget.clearErrorLog();

        // Update UI
        this.hideFileControls();
        this.showStopButton();

        // Prepare URLs for processing
        const urls = this.app.dataModule.getAllData()
            .map((row, index) => ({
                url: row[urlCol],
                rowIndex: index,
                row: row
            }))
            .filter(item => item.url);

        // Process images
        await this.app.requestModule.processBatch(
            urls,
            (processed, total) => this.updateProgress(processed, total, progressDiv),
            async (blob, url, rowIndex, row) => this.handleImageSuccess(blob, url, rowIndex, row),
            (error, url, rowIndex, row) => this.handleImageError(error, url, rowIndex, row)
        );

        // Processing complete
        this.showDownloadControls();
    }

    /**
     * Handle successful image processing
     */
    async handleImageSuccess(blob, url, rowIndex, row) {
        const filename = Utils.generateUniqueFilename(url, rowIndex, this.app.dataModule.getUsedFilenames());
        const thumbnailData = await Utils.createThumbnailFromBlob(blob);

        // Update data model
        this.app.dataModule.addResult(rowIndex, filename, thumbnailData, blob);

        // Update thumbnail display
        this.parent.thumbsWidget.addThumbnail(thumbnailData);

        // Update table if in preview range
        this.parent.tableWidget.updateTableRow(rowIndex, "✓");
    }

    /**
     * Handle image processing errors
     */
    handleImageError(error, url, rowIndex, row) {
        // Parse error for user-friendly message
        const rawError = `${error.name}: ${error.message}`;
        let errorMessage = "Failed to fetch image";
        let errorDetails = `${rawError}`;

        if (error.name === "TypeError") {
            errorMessage = "Network or CORS Error";
            errorDetails = `Cannot access this URL from the browser. This could be due to CORS policy, network issues, or server problems.\n\nRaw Error: ${rawError}`;
        } else if (error.message.includes("404")) {
            errorMessage = "Image Not Found (404)";
        } else if (error.message.includes("403")) {
            errorMessage = "Access Forbidden (403)";
        } else if (error.message.includes("500")) {
            errorMessage = "Server Error (500)";
        } else {
            errorMessage = error.message || "Unknown error";
        }

        // Log error
        this.parent.logWidget.addToErrorLog(url, rowIndex, errorMessage, errorDetails);

        // Update data model
        this.app.dataModule.markRowFailed(rowIndex);

        // Update table if in preview range
        this.parent.tableWidget.updateTableRow(rowIndex, "✗");
    }

    /**
     * Update progress display
     */
    updateProgress(processed, total, progressDiv) {
        progressDiv.textContent = `Processed ${processed} of ${total}`;
    }

    showDownloadControls() {
        document.getElementById("stopBtn").style.display = "none";
        document.getElementById("downloadZipBtn").style.display = "inline-block";
        document.getElementById("startOverBtn").style.display = "inline-block";
    }

        /**
     * UI state management methods
     */
    hideFileControls() {
        document.getElementById("fileBar").style.display = "none";
        document.getElementById("urlColumn").style.display = "none";
        document.getElementById("fetchBtn").style.display = "none";
    }

    showFileControls() {
        document.getElementById("fileBar").style.display = "flex";
        document.getElementById("urlColumn").style.display = "inline-block";
        document.getElementById("fetchBtn").style.display = "inline-block";
    }

    showStopButton() {
        document.getElementById("stopBtn").style.display = "inline-block";
    }

    hideProcessingControls() {
        document.getElementById("fetchBar").style.display = "none";
        document.getElementById("stopBtn").style.display = "none";
        document.getElementById("downloadZipBtn").style.display = "none";
        document.getElementById("startOverBtn").style.display = "none";
        document.getElementById("showLogBtn").style.display = "none";
    }

}

class ThumbsWidget extends BaseWidgetClass {

    constructor(app, elementId, parent) {
        super(app, elementId, parent);
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
 * Handles the data table display
 */
class TableWidget extends BaseWidgetClass {

    constructor(app, elementId, parent) {
        super(app, elementId, parent);
    }

    reset() {
        this.setContent("");
    }

    /**
     * Renders the preview table (moved from original renderPreview method)
     *
     * @param {String[]} headers A list of header names
     * @param {Object} rows A list of rows. Each row is an object with keys matching the headers
     */
    renderPreview(headers, rows) {
        if (!this.element) return;

        this.element.innerHTML = "";

        const allHeaders = [...headers, "filename", "imgdata", "_status"];

        const thead = document.createElement("thead");
        const headRow = document.createElement("tr");
        const statusTh = document.createElement("th");
        statusTh.textContent = "";
        headRow.appendChild(statusTh);
        allHeaders.forEach(h => {
            const th = document.createElement("th");
            th.textContent = h;
            headRow.appendChild(th);
        });
        thead.appendChild(headRow);
        this.element.appendChild(thead);

        const tbody = document.createElement("tbody");
        rows.forEach((row, idx) => {
            const tr = document.createElement("tr");
            const statusTd = document.createElement("td");
            statusTd.classList.add("status");
            statusTd.textContent = "";
            tr.appendChild(statusTd);
            allHeaders.forEach(h => {
                const td = document.createElement("td");
                if (h === "imgdata" && row[h]) {
                    const img = document.createElement("img");
                    img.src = row[h];
                    img.style.maxWidth = "30px";
                    img.style.maxHeight = "30px";
                    td.appendChild(img);
                } else {
                    td.textContent = row[h] || "";
                }
                tr.appendChild(td);
            });
            tbody.appendChild(tr);
        });
        this.element.appendChild(tbody);
    }


    /**
     * Update table row status (for preview table)
     */
    updateTableRow(rowIndex, status) {
        if (rowIndex >= 20) return; // Only update preview rows

        const table = document.getElementById("tableWidget");
        const tbody = table.querySelector("tbody");
        if (!tbody) return;

        const row = tbody.children[rowIndex];
        if (row) {
            const statusCell = row.firstChild;
            statusCell.textContent = status;
            row.classList.remove("done", "fail");
            if (status === "✓") row.classList.add("done");
            if (status === "✗") row.classList.add("fail");
        }
    }

    /**
     * Adds a single row
     */
    addRow(rowData) {
        // Simple implementation - just for the interface
        console.log("Row added:", rowData);
    }
}

/**
 * Handles error logging display
 */
class LogWidget extends BaseWidgetClass {

    constructor(app, logWidgetId, logViewerId, parent) {
        super(app, logWidgetId, parent);
        this.logViewer = document.getElementById(logViewerId);
        this.errorLog = [];
        this.initEvents();
    }

    reset() {
        this.clearErrorLog();
    }

    initEvents() {
        document.getElementById("clearLogBtn").addEventListener("click", () => this.handleClearLog());
        document.getElementById("toggleLogBtn").addEventListener("click", () => this.handleToggleLog());
        document.getElementById("showLogBtn").addEventListener("click", () => this.handleShowLog());
    }

      /**
     * Log widget event handlers
     */
    handleClearLog() {
        this.clearErrorLog();
    }

    handleToggleLog() {
        const logWidget = document.getElementById("logWidget");
        const toggleBtn = document.getElementById("toggleLogBtn");
        const showLogBtn = document.getElementById("showLogBtn");

        if (logWidget.style.display === "none") {
            logWidget.style.display = "block";
            toggleBtn.textContent = "Hide Log";
            showLogBtn.style.display = "none";
        } else {
            logWidget.style.display = "none";
            toggleBtn.textContent = "Show Log";
            if (this.errorLog.length > 0) {
                showLogBtn.style.display = "inline-block";
            }
        }
    }

    handleShowLog() {
        const logWidget = document.getElementById("logWidget");
        const toggleBtn = document.getElementById("toggleLogBtn");
        const showLogBtn = document.getElementById("showLogBtn");

        logWidget.style.display = "block";
        toggleBtn.textContent = "Hide Log";
        showLogBtn.style.display = "none";
    }

    addToErrorLog(url, rowIndex, errorMessage, errorDetails) {
        const timestamp = new Date().toLocaleTimeString();
        const logEntry = {
            timestamp,
            url,
            rowIndex: rowIndex + 1,
            errorMessage,
            errorDetails
        };

        this.errorLog.push(logEntry);
        this.updateLogViewer();

        if (this.errorLog.length === 1) {
            document.getElementById("logWidget").style.display = "block";
            document.getElementById("showLogBtn").style.display = "none";
        }
    }

    updateLogViewer() {
        if (!this.logViewer) return;

        this.logViewer.innerHTML = "";

        this.errorLog.forEach(entry => {
            const logEntry = document.createElement("div");
            logEntry.className = "log-entry";
            logEntry.innerHTML = `
                <div class="log-timestamp">${entry.timestamp}</div>
                <div class="log-url">Row ${entry.rowIndex}: <span class="url-text">${entry.url}</span></div>
                <div class="log-error">${entry.errorMessage}</div>
                ${entry.errorDetails ? `<div class="log-details">${entry.errorDetails}</div>` : ''}
            `;
            this.logViewer.appendChild(logEntry);
        });

        this.logViewer.scrollTop = this.logViewer.scrollHeight;
    }

    clearErrorLog() {
        this.errorLog = [];
        this.updateLogViewer();
        document.getElementById("logWidget").style.display = "none";
        document.getElementById("showLogBtn").style.display = "none";
    }
}