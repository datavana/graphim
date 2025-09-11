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
            this.pageWidget = new PageWidget('pageWidget', this.eventBus, this);

            this.initEvents();
        });
    }

    initEvents() {
        this.eventBus.on('app:reset:start', () => this.actionReset());
        this.eventBus.on('app:input:changed', (data) => this.actionInput(data));
        this.eventBus.on('app:fetch:start', () => this.actionFetchStart());
        this.eventBus.on('app:extract:start', () => this.actionExtractStart());
        this.eventBus.on('app:fetch:stop', () => this.actionFetchStop());
        this.eventBus.on('app:batch:ready', () => this.onBatchReady());
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
            if (data.type == 'csv') {
                const file = this.pageWidget.fetchWidget.getCsvFile();
                const result = await this.dataModule.loadCSV(file);
                this.pageWidget.fetchWidget.updateColumnSelector(result);
                this.pageWidget.tableWidget.showData(result);
                this.pageWidget.clearStage('start');
                this.pageWidget.setStage('select-urls');
            }

            if (data.type == 'folder') {
                const files = this.pageWidget.fetchWidget.getFolderFiles();
                console.log(files);

                const result = await this.dataModule.loadFolder(files);
                this.pageWidget.folderWidget.showData(result);
                this.pageWidget.clearStage('start');
                this.pageWidget.setStage('select-imgs');
            }

        } catch (error) {
            this.eventBus.emit(
                'app:log:add',
                { msg: "Error loading data: " + error.message, level: 'serious' }
            )
        }
    }

    async actionFetchStart() {

        this.eventBus.emit('app:log:clear');
        this.pageWidget.clearStage();
        this.pageWidget.setStage('fetch')

        const fetchSettings = this.pageWidget.fetchWidget.getSettings();
        const nodes = this.dataModule.getSeedNodes(fetchSettings.column);
        this.requestModule.processBatch(nodes);
    }

    asynch actionExtractStart() {

        // this.eventBus.emit('app:log:clear');
        this.pageWidget.clearStage();
        this.pageWidget.setStage('extract')

        const nodes = this.dataModule.getAllNodes();
        this.requestModule.processBatch(nodes, true);
    }

    actionFetchStop() {
        this.requestModule.stop();
    }

    async actionDownload(data) {
        this.dataModule.saveZip();
    }

    onBatchReady() {
        this.pageWidget.clearStage();
        this.pageWidget.setStage('ready');
    }

}

// Initialize application
const app = new WebApp();