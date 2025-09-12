/**
 * Utility functions for the Image CSV Processor
 * Static functions that don't depend on application state
 */
class Utils {

    /**
     * Remove all CSS classes starting with a prefix
     *
     * @param {HTMLElement} element
     * @param {String} prefix
     */
    static removeClasses(element, prefix) {
         [...element.classList]
            .filter(cls => cls.startsWith(prefix))
            .forEach(cls => element.classList.remove(cls));
    }

    /**
     * Generates a unique filename from a URL, handling duplicates
     *
     * @param {string} url - The image URL
     * @param {number} index - Row index for fallback naming
     * @param {Set} usedFilenames - Set of already used filenames
     * @param {string} defaultExtension The extension to add if the path does not end with a file extension
     * @returns {string} Unique filename
     */
    static generateUniqueFilename(url, index, usedFilenames, defaultExtension = '.jpg') {
        try {
            const urlObj = new URL(url);
            let filename = urlObj.pathname.split("/").pop() || `image_${index}`;
            
            // Remove query parameters if they exist
            filename = filename.split('?')[0];
            
            // Add extension if missing
            if (!filename.includes(".") || filename.endsWith(".")) {
                filename = filename.replace(/\.$/, '') + defaultExtension;
            }
            
            // Ensure image filename uniqueness by adding suffix if needed
            let uniqueFilename = filename;
            let suffix = 1;
            while (usedFilenames.has(uniqueFilename)) {
                const lastDotIndex = filename.lastIndexOf('.');
                if (lastDotIndex > 0) {
                    const name = filename.substring(0, lastDotIndex);
                    const ext = filename.substring(lastDotIndex);
                    uniqueFilename = `${name}_${suffix}${ext}`;
                } else {
                    uniqueFilename = `${filename}_${suffix}`;
                }
                suffix++;
            }
            
            return uniqueFilename;
        } catch (e) {
            // If URL parsing fails, use fallback
            let fallback = `image_${index}.jpg`;
            let suffix = 1;
            while (usedFilenames.has(fallback)) {
                fallback = `image_${index}_${suffix}.jpg`;
                suffix++;
            }
            return fallback;
        }
    }

    /**
     * Creates a thumbnail from a blob
     *
     * @param {Blob} blob - The image blob
     * @param {number} maxSize - Maximum thumbnail size in pixels
     * @returns {Promise<string>} Promise resolving to data URL
     */
    static async createThumbnailFromBlob(blob, maxSize = 50) {
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.onload = () => {
                const canvas = document.createElement("canvas");
                const ctx = canvas.getContext("2d");
                let scale = Math.min(maxSize / img.width, maxSize / img.height);
                canvas.width = img.width * scale;
                canvas.height = img.height * scale;
                ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
                resolve(canvas.toDataURL("image/jpeg"));
            };
            img.onerror = reject;
            img.src = URL.createObjectURL(blob);
        });
    }

    /**
     * Formats timestamp for logging
     * @returns {string} Formatted timestamp
     */
    static getCurrentTimestamp() {
        return new Date().toISOString().substring(11, 19);
    }

    /**
     * Creates a structured error log entry
     * @param {string} severity - 'error', 'warn', 'info'  
     * @param {string} name - Short error identifier
     * @param {Object} details - Object containing error specifics
     * @returns {Object} Structured log entry
     */
    static createLogEntry(severity, name, details = {}) {
        return {
            timestamp: Utils.getCurrentTimestamp(),
            severity: severity.toLowerCase(),
            name: name,
            details: details
        };
    }

    /**
     * Converts an HTTP error into structured log data
     * @param {Error} error - The error object
     * @param {string} url - The URL that failed
     * @param {number} rowIndex - Row index in the dataset
     * @returns {Object} Structured error data for logging
     */
    static structureHttpError(error, url, rowIndex) {
        let errorName = "UNKNOWN_ERROR";
        let severity = "error";

        if (error.name === "TypeError") {
            errorName = "NETWORK_ERROR";
        }
        else if (error.message.includes("404")) {
            errorName = "NOT_FOUND";
        }
        else if (error.message.includes("403")) {
            errorName = "ACCESS_DENIED";
        }
        else if (error.message.includes("500")) {
            errorName = "SERVER_ERROR";
        }

        const statusCode = Utils.extractStatusCode(error.message);

        const details = {
            statusCode: statusCode,
            url: url,
            row: rowIndex + 1,
            originalMessage: error.message,
            errorType: error.name
        };

        return Utils.createLogEntry(severity, errorName, details);
    }

    /**
     * Extracts status code from error message
     * @param {string} message - Error message
     * @returns {string|null} Status code or null
     */
    static extractStatusCode(message) {
        const match = message.match(/(\d{3})/);
        return match ? match[1] : null;
    }

    /**
     * Validates if a string is a valid URL
     *
     * @param {string} string - The string to validate
     * @returns {boolean} True if valid URL
     */
    static isValidUrl(string) {
        try {
            new URL(string);
            return true;
        } catch (_) {
            return false;
        }
    }

    static humanizeError(error) {
        if (error.name === "TypeError") {
            return "Network Error";
        } else if (error.message.includes("404")) {
            return "File Not Found (404)";
        } else if (error.message.includes("403")) {
            return "Access Forbidden (403)";
        } else if (error.message.includes("500")) {
            return "Server Error (500)";
        } else {
            return error.message || "Unknown error";
        }
    }
}