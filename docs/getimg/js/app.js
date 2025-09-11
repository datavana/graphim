/**
 * Main application controller for the Image CSV Processor
 * Orchestrates Model and View components using MVC architecture
 */
class WebApp {

    constructor() {

        this.eventBus = new EventEmitter();

        document.addEventListener('DOMContentLoaded', () => {
            this.dataModule = new DataModule(this.eventBus);
            this.requestModule = new RequestModule(this.eventBus);
            this.pageWidget = new PageWidget('pageWidget', this.eventBus);

            this.initEvents();
        });
    }

    initEvents() {
        this.eventBus.on('app:progress:step', (data) => this.onProgressStep(data));
        this.eventBus.on('data:batch:ready', () => this.onBatchReady());

        this.eventBus.on('app:reset:start', () => this.actionReset());
        this.eventBus.on('app:input:changed', (data) => this.actionInput(data));
        this.eventBus.on('app:fetch:start', () => this.actionFetchStart());
        this.eventBus.on('app:fetch:stop', () => this.actionFetchStop());
        this.eventBus.on('app:download:start', (data) => this.actionDownload(data));
    }

    /**
     * Reset application to initial state
     */
    actionReset() {
        this.dataModule.reset();
        this.requestModule.reset();
        this.pageWidget.reset();
    }

     /**
     * Load CSV and update user interface
     */
    async actionInput(data) {

        try {
            const file = this.pageWidget.fetchWidget.getInputFile();
            const result = await this.dataModule.loadCSV(file);
            this.pageWidget.fetchWidget.updateColumnSelector(result);
            this.pageWidget.tableWidget.showData(result);

            this.pageWidget.setStage('select');

        } catch (error) {
            this.eventBus.emit(
                'app:log:add',
                { msg: "Error loading CSV file: " + error.message, level: 'serious' }
            )
        }
    }

    async actionFetchStart() {

        this.eventBus.emit('app:log:clear');
        this.pageWidget.setStage('fetch')

        const fetchSettings = this.pageWidget.fetchWidget.getSettings();
        const nodes = this.dataModule.getSeedNodes(fetchSettings.column);
        this.requestModule.processBatch(nodes);
    }

    actionFetchStop() {
        this.requestModule.stop();
    }

    async actionDownload(data) {
        this.dataModule.saveZip();
    }

    onBatchReady() {
        this.pageWidget.setStage('ready');
    }

    async onProgressStep(data){
        this.pageWidget.fetchWidget.updateProgress(data);
    }

}

// Initialize application
const app = new WebApp();