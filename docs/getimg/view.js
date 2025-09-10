/**
 * View layer for the Image CSV Processor
 * Handles UI components and user interactions
 */

/**
 * Base class for all UI widgets
 */
class WidgetElement {
    constructor(elementId) {
        this.elementId = elementId;
        this.element = document.getElementById(elementId);
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

/**
 * Handles the data table display
 */
class TableWidget extends WidgetElement {
    constructor(elementId) {
        super(elementId);
    }

    /**
     * Renders the preview table (moved from original renderPreview method)
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
class LogWidget extends WidgetElement {
    constructor(logSectionId, logViewerId) {
        super(logSectionId);
        this.logViewer = document.getElementById(logViewerId);
        this.errorLog = [];
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
            document.getElementById("logSection").style.display = "block";
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
        document.getElementById("logSection").style.display = "none";
        document.getElementById("showLogBtn").style.display = "none";
    }
}