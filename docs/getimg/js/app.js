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
            const dataSource = this.dataModule.getDataSource(data.type);

            if (data.type == 'csv') {
                const file = this.pageWidget.fetchWidget.getCsvFile();
                const result = await dataSource.load(file);

                this.pageWidget.fetchWidget.updateColumnSelector(result);
                this.pageWidget.tableWidget.showData(result);
                this.pageWidget.clearStage('start');
                this.pageWidget.setStage('select-urls');
            }

            if (data.type == 'folder') {
                const files = this.pageWidget.fetchWidget.getFolderFiles();
                const result = await dataSource.load(files);

                this.pageWidget.folderWidget.showData(result);
                this.pageWidget.clearStage('start');
                this.pageWidget.setStage('select-imgs');
            }

        } catch (error) {
            const logEntry = Utils.createLogEntry('error', 'DATA_LOAD_ERROR', {
                originalMessage: error.message,
                errorType: error.name
            });
            this.eventBus.emit('app:log:add', logEntry);
        }
    }

    /**
     * TODO: Merge actionFetchSart and actionExtractStart
     *
     * @returns {Promise<void>}
     */
    async actionFetchStart() {

        this.pageWidget.clearStage();
        this.pageWidget.setStage('fetch')

        const fetchSettings = this.pageWidget.fetchWidget.getSettings();
        const nodes = this.dataModule.getSeedNodes('csv', fetchSettings);
        const source = this.dataModule.getDataSource('csv');
        const target = this.dataModule.getDataTarget('zip');
        this.requestModule.processBatch(nodes, source, target);
    }

    async actionExtractStart() {

        this.pageWidget.clearStage();
        this.pageWidget.setStage('extract')

        const fetchSettings = {'column': 'fileobject'};
        const nodes = this.dataModule.getSeedNodes('folder', fetchSettings);
        const source = this.dataModule.getDataSource('folder');
        const target = this.dataModule.getDataTarget('csv');
        this.requestModule.processBatch(nodes, source, target);
    }

    actionFetchStop() {
        this.requestModule.stop();
    }

    async actionDownload(data) {
        const target = this.dataModule.getDataTarget(data.targetType);
        const source = this.dataModule.getDataSource(data.sourceType);
        target.download(source);
    }

    onBatchReady() {
        this.pageWidget.clearStage();
        this.pageWidget.setStage('ready');
    }

}

// Initialize application
const app = new WebApp();