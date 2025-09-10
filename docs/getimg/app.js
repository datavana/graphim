/**
 * Main application controller for the Image CSV Processor
 * Orchestrates Model and View components using MVC architecture
 */
class WebApp {

    constructor() {

        // Initialize View components
        document.addEventListener('DOMContentLoaded', () => {
            // Initialize Model components
            this.dataModule = new DataModule();
            this.requestModule = new RequestModule();

            // Initialize View components
            this.pageWidget = new PageWidget(this, 'pageWidget')
        });
    }

    /**
     * Reset application to initial state
     */
    startOver() {
        // Reset models
        this.dataModule.reset();
        this.requestModule.reset();

        // Reset views
        this.pageWidget.reset();
    }

}

// Initialize application
const app = new WebApp();