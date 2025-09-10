/**
 * Main application controller for the Image CSV Processor
 * Orchestrates Model and View components using MVC architecture
 */
class WebApp {
    constructor() {
        // Initialize Model components
        this.dataModule = new DataModule();
        this.requestModule = new RequestModule();
        
        // Initialize View components
        this.tableWidget = new TableWidget('previewTable');
        this.logWidget = new LogWidget('logSection', 'logViewer');
        
        this.initEventListeners();
    }

    /**
     * Handle CSV file upload and parsing
     */
    async handleFileChange() {
        const fileInput = document.getElementById("csvFile");
        if (!fileInput.files.length) return;

        try {
            const result = await this.dataModule.loadCSV(fileInput.files[0]);
            
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
            this.tableWidget.renderPreview(result.headers, result.data.slice(0, 20));
            
            // Show fetch controls
            document.getElementById("fetchBar").style.display = "flex";
            
        } catch (error) {
            alert("Error parsing CSV file: " + error.message);
        }
    }

    /**
     * Handle image fetching process
     */
    async handleFetch() {
        const urlCol = document.getElementById("urlColumn").value;
        const progressDiv = document.getElementById("progress");
        const thumbsDiv = document.getElementById("thumbs");
        
        // Initialize processing
        this.dataModule.initializeZip();
        this.requestModule.reset();
        this.logWidget.clearErrorLog();
        
        // Update UI
        this.hideFileControls();
        this.showStopButton();
        
        // Prepare URLs for processing
        const urls = this.dataModule.getAllData()
            .map((row, index) => ({
                url: row[urlCol],
                rowIndex: index,
                row: row
            }))
            .filter(item => item.url);

        // Process images
        await this.requestModule.processBatch(
            urls,
            (processed, total) => this.updateProgress(processed, total, progressDiv),
            async (blob, url, rowIndex, row) => this.handleImageSuccess(blob, url, rowIndex, row, thumbsDiv),
            (error, url, rowIndex, row) => this.handleImageError(error, url, rowIndex, row)
        );

        // Processing complete
        this.showDownloadControls();
    }

    /**
     * Handle successful image processing
     */
    async handleImageSuccess(blob, url, rowIndex, row, thumbsDiv) {
        const filename = Utils.generateUniqueFilename(url, rowIndex, this.dataModule.getUsedFilenames());
        const thumbnailData = await Utils.createThumbnailFromBlob(blob);
        
        // Update data model
        this.dataModule.addResult(rowIndex, filename, thumbnailData, blob);
        
        // Update thumbnail display
        this.addThumbnail(thumbnailData, thumbsDiv);
        
        // Update table if in preview range
        this.updateTableRow(rowIndex, "✓");
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
        this.logWidget.addToErrorLog(url, rowIndex, errorMessage, errorDetails);
        
        // Update data model
        this.dataModule.markRowFailed(rowIndex);
        
        // Update table if in preview range
        this.updateTableRow(rowIndex, "✗");
    }

    /**
     * Update progress display
     */
    updateProgress(processed, total, progressDiv) {
        progressDiv.textContent = `Processed ${processed} of ${total}`;
    }

    /**
     * Add thumbnail to display
     */
    addThumbnail(thumbnailData, thumbsDiv) {
        const img = document.createElement("img");
        img.src = thumbnailData;
        img.style.maxWidth = "50px";
        img.style.maxHeight = "50px";
        thumbsDiv.appendChild(img);
        
        // Keep only last 10 thumbnails
        while (thumbsDiv.children.length > 10) {
            thumbsDiv.removeChild(thumbsDiv.firstChild);
        }
    }

    /**
     * Update table row status (for preview table)
     */
    updateTableRow(rowIndex, status) {
        if (rowIndex >= 20) return; // Only update preview rows
        
        const table = document.getElementById("previewTable");
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
     * Stop processing
     */
    handleStop() {
        this.requestModule.stop();
    }

    /**
     * Download ZIP file
     */
    async handleDownloadZip() {
        try {
            await this.dataModule.saveZip();
        } catch (error) {
            alert(error.message);
        }
    }

    /**
     * Reset application to initial state
     */
    handleStartOver() {
        // Reset models
        this.dataModule.reset();
        this.requestModule.reset();
        
        // Reset views
        this.tableWidget.setContent("");
        this.logWidget.clearErrorLog();
        
        // Reset form and UI
        document.getElementById("csvFile").value = "";
        document.getElementById("urlColumn").innerHTML = "";
        document.getElementById("thumbs").innerHTML = "";
        document.getElementById("progress").textContent = "";
        
        // Reset button visibility
        this.showFileControls();
        this.hideProcessingControls();
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

    showDownloadControls() {
        document.getElementById("stopBtn").style.display = "none";
        document.getElementById("downloadZipBtn").style.display = "inline-block";
        document.getElementById("startOverBtn").style.display = "inline-block";
    }

    hideProcessingControls() {
        document.getElementById("fetchBar").style.display = "none";
        document.getElementById("stopBtn").style.display = "none";
        document.getElementById("downloadZipBtn").style.display = "none";
        document.getElementById("startOverBtn").style.display = "none";
        document.getElementById("showLogBtn").style.display = "none";
    }

    /**
     * Log widget event handlers
     */
    handleClearLog() {
        this.logWidget.clearErrorLog();
    }

    handleToggleLog() {
        const logSection = document.getElementById("logSection");
        const toggleBtn = document.getElementById("toggleLogBtn");
        const showLogBtn = document.getElementById("showLogBtn");
        
        if (logSection.style.display === "none") {
            logSection.style.display = "block";
            toggleBtn.textContent = "Hide Log";
            showLogBtn.style.display = "none";
        } else {
            logSection.style.display = "none";
            toggleBtn.textContent = "Show Log";
            if (this.logWidget.errorLog.length > 0) {
                showLogBtn.style.display = "inline-block";
            }
        }
    }

    handleShowLog() {
        const logSection = document.getElementById("logSection");
        const toggleBtn = document.getElementById("toggleLogBtn");
        const showLogBtn = document.getElementById("showLogBtn");
        
        logSection.style.display = "block";
        toggleBtn.textContent = "Hide Log";
        showLogBtn.style.display = "none";
    }

    /**
     * Initialize event listeners
     */
    initEventListeners() {
        document.getElementById("csvFile").addEventListener("change", () => this.handleFileChange());
        document.getElementById("fetchBtn").addEventListener("click", () => this.handleFetch());
        document.getElementById("stopBtn").addEventListener("click", () => this.handleStop());
        document.getElementById("downloadZipBtn").addEventListener("click", () => this.handleDownloadZip());
        document.getElementById("clearLogBtn").addEventListener("click", () => this.handleClearLog());
        document.getElementById("toggleLogBtn").addEventListener("click", () => this.handleToggleLog());
        document.getElementById("showLogBtn").addEventListener("click", () => this.handleShowLog());
        document.getElementById("startOverBtn").addEventListener("click", () => this.handleStartOver());
    }
}

// Initialize application
const app = new WebApp();