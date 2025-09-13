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
     * Creates a thumbnail from an image file.
     *
     * @param {File} file - Image file to process
     * @param {number} maxSize - Maximum thumb width and height
     * @returns {Promise<string>} - Promise resolving to base64 data URL of the thumbnail
     */
    static async createThumbnailFromFile(file, maxSize = 50) {
      return new Promise((resolve, reject) => {
        const reader = new FileReader();

        reader.onload = event => {
          const img = new Image();
          img.onload = () => {
            let width = img.width;
            let height = img.height;

            if (width > height) {
              if (width > maxSize) {
                height = Math.round(height * (maxSize / width));
                width = maxSize;
              }
            } else {
              if (height > maxSize) {
                width = Math.round(width * (maxSize / height));
                height = maxSize;
              }
            }

            const canvas = document.createElement('canvas');
            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0, width, height);

            const dataURL = canvas.toDataURL('image/png');
            resolve(dataURL);
          };

          img.onerror = error => {console.log(error); reject(error);};
          img.src = event.target.result;
        };

        reader.onerror = error => reject(error);
        try {
            reader.readAsDataURL(file);
        } catch (error) {
            console.log(error);
            reject(error)
        }
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
     * @param {string} msg - Short error message
     * @param {Object} details - Object containing error details
     * @returns {Object} Structured log entry
     */
    static createLogEntry(severity, msg, details = {}) {
        return {
            timestamp: Utils.getCurrentTimestamp(),
            severity: severity,
            msg: msg,
            details: details
        };
    }

    static capitalize(str) {
      if (!str) return "";
      return str.charAt(0).toUpperCase() + str.slice(1);
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