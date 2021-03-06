import Drawer from './drawer';
import * as util from './util';
// import timeImg from './assets/timestamp.svg';

/**
 * @typedef {Object} CanvasEntry
 * @private
 * @property {HTMLElement} wave The wave node
 * @property {CanvasRenderingContext2D} waveCtx The canvas rendering context
 * @property {?HTMLElement} progress The progress wave node
 * @property {?CanvasRenderingContext2D} progressCtx The progress wave canvas
 * rendering context
 * @property {HTMLElement} patientWave The patient wave node
 * @property {CanvasRenderingContext2D} patientWaveCtx The patient canvas rendering context
 * @property {?HTMLElement} patientProgress The patient progress wave node
 * @property {?CanvasRenderingContext2D} patientProgressCtx The patient progress wave canvas
 * @property {?number} start Start of the area the canvas should render, between 0 and 1
 * @property {?number} end End of the area the canvas should render, between 0 and 1
 */

/**
 * MultiCanvas renderer for wavesurfer. Is currently the default and sole built
 * in renderer.
 */
export default class MultiCanvas extends Drawer {
    /**
     * @param {HTMLElement} container The container node of the wavesurfer instance
     * @param {WavesurferParams} params The wavesurfer initialisation options
     */
    constructor(container, params) {
        super(container, params);
        /**
         * @type {number}
         * @private
         */
        this.maxCanvasWidth = params.maxCanvasWidth;
        /**
         * @private
         * @type {number}
         */
        this.maxCanvasElementWidth = Math.round(
            params.maxCanvasWidth / params.pixelRatio
        );

        /**
         * Whether or not the progress wave is renderered. If the `waveColor`
         * and `progressColor` are the same colour it is not.
         * @type {boolean}
         */
        this.hasProgressCanvas = params.waveColor != params.progressColor;
        /**
         * @private
         * @type {number}
         */
        this.halfPixel = 0.5 / params.pixelRatio;
        /**
         * @private
         * @type {Array}
         */
        this.canvases = [];
        /** @private */
        this.progressWave = null; // doctor's progress part
        /** @private */
        this.patientProgressWave = null; // patient's progress part
        // Elements for displaying time on cursor
        this.currTimeText = null;
        this.totalTimeText = null;
        this.currTime = null;
        this.totalTime = null;
        this.durationRendered = false;
        // Element for metadata
        this.metadata = null;
        this.metadataText = null;
    }

    /**
     * Added by MinSun:
     * Render the timestamps on this.timestamps element
     * @param {number[]} arr List of percent values where comments were made on
     * the waveform: currentTime/totalTime
     */
    updateTimestamps(arr) {
        const width = 3; // width of each timestamp
        const x = 0; // start of a timestamp - dummy val.
        const startCanvas = Math.floor(x / this.maxCanvasWidth);
        const endCanvas = Math.min(
            Math.ceil((x + width) / this.maxCanvasWidth) + 1,
            this.canvases.length
        );
        let i;

        for (i = startCanvas; i < endCanvas; i++) {
            const entry = this.canvases[i];
            // Remove all timestamps before drawing new ones.
            entry.timesCtx.clearRect(
                0,
                0,
                entry.timesCtx.canvas.width,
                entry.timesCtx.canvas.height
            );

            let pixelOffset;
            for (let ind in arr) {
                /* Image wouldn't load.. Try drawing on canvas
                let timestampImg = document.createElement('img');
                timestampImg.src = timeImg;
                timestampImg.style.zIndex = 4;
                timestampImg.style.height = '10px';
                timestampImg.style.marginLeft = arr[pixelOffset] + 'px';
                timestampImg.style.marginTop = '-380px';
                */
                // Width of entire waveform (not just the visible part)
                // Copied-Pasted from updateSize() - no idea how this works..
                let canvasWidth =
                    this.maxCanvasWidth +
                    2 * Math.ceil(this.params.pixelRatio / 2);
                if (i == this.canvases.length - 1) {
                    canvasWidth =
                        this.width -
                        this.maxCanvasWidth * (this.canvases.length - 1);
                }
                pixelOffset = arr[ind] * canvasWidth;
                // * Always do fillStyle first before fillRect
                entry.timesCtx.fillStyle = '#5F78FF';
                entry.timesCtx.fillRect(pixelOffset, 0, 3, 15); // x,y,width,height
            }
        }
    }

    /**
     * Initialise the drawer
     */
    init() {
        this.createWrapper();
        this.createElements();
    }

    /**
     * Create the canvas elements and style them
     * MinSun: initialized patientWave and patientProgressWave
     *
     * @private
     */
    createElements() {
        this.progressWave = this.wrapper.appendChild(
            // for doctor part
            this.style(document.createElement('wave'), {
                position: 'absolute',
                zIndex: 4,
                left: 0,
                top: 0,
                bottom: 0,
                overflow: 'hidden',
                width: '0',
                display: 'none',
                boxSizing: 'border-box',
                borderRightStyle: 'solid',
                pointerEvents: 'none'
                // backgroundColor: this.params.progressBackgroundColor
            })
        );
        this.patientProgressWave = this.wrapper.appendChild(
            this.style(document.createElement('wave'), {
                position: 'absolute',
                zIndex: 3,
                left: 0,
                top: 0,
                bottom: 0,
                overflow: 'hidden',
                width: '0',
                display: 'none',
                boxSizing: 'border-box',
                // borderRightStyle: 'solid',
                pointerEvents: 'none',
                backgroundColor: this.params.progressBackgroundColor
            })
        );
        this.currTime = document.createElement('currTime');
        this.totalTime = document.createElement('totalTime');
        this.wrapper.appendChild(this.currTime);
        this.wrapper.appendChild(this.totalTime);
        this.currTime.style.fontSize = '13px';
        this.currTime.style.color = '#ffffff';
        this.currTime.style.position = 'absolute';
        this.currTime.style.left = '-60px';
        this.currTime.style.top = '150px';
        this.totalTime.style.fontSize = '13px';
        this.totalTime.style.color = '#5F78FF';
        this.totalTime.style.position = 'absolute';
        this.totalTime.style.left = '8px';
        this.totalTime.style.top = '150px';
        this.addCanvas();
        this.updateCursor();
    }

    /**
     * Update cursor style from params.
     */
    updateCursor() {
        this.style(this.progressWave, {
            borderRightWidth: this.params.cursorWidth + 'px',
            borderRightColor: this.params.cursorColor
        });
    }

    /**
     * Adjust to the updated size by adding or removing canvases
     */
    updateSize() {
        const totalWidth = Math.round(this.width / this.params.pixelRatio);
        const requiredCanvases = Math.ceil(
            totalWidth / this.maxCanvasElementWidth
        );

        while (this.canvases.length < requiredCanvases) {
            this.addCanvas();
        }

        while (this.canvases.length > requiredCanvases) {
            this.removeCanvas();
        }

        this.canvases.forEach((entry, i) => {
            // Add some overlap to prevent vertical white stripes, keep the width even for simplicity.
            let canvasWidth =
                this.maxCanvasWidth + 2 * Math.ceil(this.params.pixelRatio / 2);

            if (i == this.canvases.length - 1) {
                canvasWidth =
                    this.width -
                    this.maxCanvasWidth * (this.canvases.length - 1);
            }

            this.updateDimensions(entry, canvasWidth, this.height);
            this.clearWaveForEntry(entry);
        });
    }

    /**
     * Add a canvas to the canvas list
     * MinSun: added canvases for patient's waves.
     *
     * @private
     */
    addCanvas() {
        const entry = {};
        const leftOffset = this.maxCanvasElementWidth * this.canvases.length;

        // Default wave - for doctor's part
        entry.wave = this.wrapper.appendChild(
            this.style(document.createElement('canvas'), {
                position: 'absolute',
                zIndex: 2,
                left: leftOffset + 'px',
                top: 0,
                bottom: 0,
                height: '100%',
                pointerEvents: 'none',
                maxWidth: 'none'
            })
        );
        entry.waveCtx = entry.wave.getContext('2d');

        // Progress wave - for doctor's part
        if (this.hasProgressCanvas) {
            entry.progress = this.progressWave.appendChild(
                this.style(document.createElement('canvas'), {
                    position: 'absolute',
                    left: leftOffset + 'px',
                    top: 0,
                    bottom: 0,
                    height: '100%',
                    maxWidth: 'none'
                })
            );
            entry.progressCtx = entry.progress.getContext('2d');
        }

        // Default wave - for patient's part
        entry.patientWave = this.wrapper.appendChild(
            this.style(document.createElement('canvas'), {
                position: 'absolute',
                zIndex: 2,
                left: leftOffset + 'px',
                top: 0,
                bottom: 0,
                height: '100%',
                pointerEvents: 'none',
                maxWidth: 'none'
            })
        );
        entry.patientWaveCtx = entry.patientWave.getContext('2d');

        // Progress wave - for patient's part
        if (this.hasProgressCanvas) {
            entry.patientProgress = this.patientProgressWave.appendChild(
                this.style(document.createElement('canvas'), {
                    position: 'absolute',
                    left: leftOffset + 'px',
                    top: 0,
                    bottom: 0,
                    height: '100%',
                    maxWidth: 'none'
                })
            );
            entry.patientProgressCtx = entry.patientProgress.getContext('2d');
        }

        // Create canvas for rendering timestamps - copying default waves settings
        entry.times = this.wrapper.appendChild(
            this.style(document.createElement('canvas'), {
                position: 'absolute',
                zIndex: 4,
                left: leftOffset + 'px',
                top: 0,
                bottom: 0,
                height: '100%',
                pointerEvents: 'none',
                maxWidth: 'none'
            })
        );
        entry.timesCtx = entry.times.getContext('2d');

        this.canvases.push(entry);
    }

    /**
     * Pop one canvas from the list
     * MinSun: pop patient's canvas too.
     *
     * @private
     */
    removeCanvas() {
        const lastEntry = this.canvases.pop();
        lastEntry.wave.parentElement.removeChild(lastEntry.wave);
        lastEntry.patientWave.parentElement.removeChild(lastEntry.patientWave);
        lastEntry.times.parentElement.removeChild(lastEntry.times);
        if (this.hasProgressCanvas) {
            lastEntry.progress.parentElement.removeChild(lastEntry.progress);
            lastEntry.patientProgress.parentElement.removeChild(
                lastEntry.patientProgress
            );
        }
    }

    /**
     * Update the dimensions of a canvas element
     * MinSun: update dimensions for patient's waves too.
     *
     * @private
     * @param {CanvasEntry} entry
     * @param {number} width The new width of the element
     * @param {number} height The new height of the element
     */
    updateDimensions(entry, width, height) {
        const elementWidth = Math.round(width / this.params.pixelRatio);
        const totalWidth = Math.round(this.width / this.params.pixelRatio);

        // Where the canvas starts and ends in the waveform, represented as a decimal between 0 and 1.
        entry.start = entry.waveCtx.canvas.offsetLeft / totalWidth || 0;
        entry.end = entry.start + elementWidth / totalWidth;

        entry.waveCtx.canvas.width = width;
        entry.waveCtx.canvas.height = height;
        this.style(entry.waveCtx.canvas, { width: elementWidth + 'px' });

        // Added by MinSun START:
        entry.patientWaveCtx.canvas.width = width;
        entry.patientWaveCtx.canvas.height = height;
        this.style(entry.patientWaveCtx.canvas, { width: elementWidth + 'px' });

        entry.timesCtx.canvas.width = width;
        entry.timesCtx.canvas.height = height;
        this.style(entry.timesCtx.canvas, { width: elementWidth + 'px' });
        // ENDS here.

        this.style(this.progressWave, { display: 'block' });

        if (this.hasProgressCanvas) {
            entry.progressCtx.canvas.width = width;
            entry.progressCtx.canvas.height = height;
            this.style(entry.progressCtx.canvas, {
                width: elementWidth + 'px'
            });
        }

        // Added by MinSun START:
        this.style(this.patientProgressWave, { display: 'block' });

        if (this.hasProgressCanvas) {
            entry.patientProgressCtx.canvas.width = width;
            entry.patientProgressCtx.canvas.height = height;
            this.style(entry.patientProgressCtx.canvas, {
                width: elementWidth + 'px'
            });
        }
        // ENDS here.
    }

    /**
     * Clear the whole waveform
     */
    clearWave() {
        this.canvases.forEach(entry => this.clearWaveForEntry(entry));
    }

    /**
     * Clear one canvas
     * MinSun: clear patient canvas too.
     *
     * @private
     * @param {CanvasEntry} entry
     */
    clearWaveForEntry(entry) {
        entry.waveCtx.clearRect(
            0,
            0,
            entry.waveCtx.canvas.width,
            entry.waveCtx.canvas.height
        );
        entry.patientWaveCtx.clearRect(
            0,
            0,
            entry.patientWaveCtx.canvas.width,
            entry.patientWaveCtx.canvas.height
        );
        entry.timesCtx.clearRect(
            0,
            0,
            entry.timesCtx.canvas.width,
            entry.timesCtx.canvas.height
        );
        if (this.hasProgressCanvas) {
            entry.progressCtx.clearRect(
                0,
                0,
                entry.progressCtx.canvas.width,
                entry.progressCtx.canvas.height
            );
        }
        if (this.hasProgressCanvas) {
            entry.patientProgressCtx.clearRect(
                0,
                0,
                entry.patientProgressCtx.canvas.width,
                entry.patientProgressCtx.canvas.height
            );
        }
    }

    /**
     * Draw a waveform with bars
     *
     * Edited by MinSun.
     * Alter this; take in an array of starts & ends and loop through to render bars:
     * Also take in a second parameter - for patient's color.
     * As long as barWidth exists when we declare WaveSurfer instance in client,
     * we only need to change this. Otherwise, alter drawWave().
     *
     * @param {number[]|number[][]} peaks Can also be an array of arrays for split channel
     * rendering
     * @param {number} channelIndex The index of the current channel. Normally
     * should be 0. Must be an integer.
     * @param {number} start The x-offset of the beginning of the area that
     * should be rendered
     * @param {number} end The x-offset of the end of the area that should be
     * rendered
     * @param {number[]} doctorsRangePerc List of points that divide doctors' part and
     * patient's speaking (in percent)
     * EX) [0, 2, 5, 10, 15, 18] means the doctor spoke [0, 2], [5, 10], [15, 18] percent.
     * The rest is patient speaking.
     */
    drawBars(peaks, channelIndex, start, end, doctorsRangePerc) {
        return this.prepareDraw(
            peaks,
            channelIndex,
            start, // MinSun: not sure how this start/end will be used in prepareDraw
            end,
            ({ absmax, hasMinVals, height, offsetY, halfH, peaks }) => {
                // if drawBars was called within ws.empty we don't pass a start and
                // don't want anything to happen
                if (start === undefined) {
                    return;
                }
                // Skip every other value if there are negatives.
                const peakIndexScale = hasMinVals ? 2 : 1;
                const length = peaks.length / peakIndexScale;
                const bar = this.params.barWidth * this.params.pixelRatio;
                const gap =
                    this.params.barGap === null
                        ? Math.max(this.params.pixelRatio, ~~(bar / 2))
                        : Math.max(
                              this.params.pixelRatio,
                              this.params.barGap * this.params.pixelRatio
                          );
                const step = bar + gap;

                const scale = length / this.width;

                const first = start;
                const last = end;

                // MinSun: Start editing here
                // First, convert seconds into pixel values
                // Not sure how these values are significant here.
                const width = 3; // width of each timestamp - dummy val.
                const x = 0; // start of a timestamp - dummy val.
                const startCanvas = Math.floor(x / this.maxCanvasWidth);
                const endCanvas = Math.min(
                    Math.ceil((x + width) / this.maxCanvasWidth) + 1,
                    this.canvases.length
                );
                let i;
                let canvasWidth;
                for (i = startCanvas; i < endCanvas; i++) {
                    const entry = this.canvases[i];
                    canvasWidth =
                        this.maxCanvasWidth +
                        2 * Math.ceil(this.params.pixelRatio / 2);
                    if (i == this.canvases.length - 1) {
                        canvasWidth =
                            this.width -
                            this.maxCanvasWidth * (this.canvases.length - 1);
                    }
                }

                let doctorsRangePix = [];
                for (i = 0; i < doctorsRangePerc.length; i++) {
                    doctorsRangePix.push(doctorsRangePerc[i] * canvasWidth);
                }

                // Draw bars one by one
                // TRUE if doctorsRangePix[drInx] ends the doctor's range
                let inDoctorsRange = false;
                let drInd = 0;

                for (i = first; i < last; i += step) {
                    const peak =
                        peaks[Math.floor(i * scale * peakIndexScale)] || 0;
                    const h = Math.round((peak / absmax) * halfH);

                    // Draw dots in silent parts
                    /*
                    if (h <= 0) {
                        h = 1;
                    }
                    */

                    // Time to update drInd
                    if (i > doctorsRangePix[drInd]) {
                        if (drInd < doctorsRangePix.length) {
                            drInd++;
                            inDoctorsRange = !inDoctorsRange;
                        }
                    }
                    // We can draw the bars now.
                    if (inDoctorsRange) {
                        // Draw the DOCTOR's parts
                        this.fillRect(
                            // halfPixel = 1 / (2 * params.pixelRatio)
                            i + this.halfPixel, // x = start of current bar
                            halfH - h + offsetY, // y
                            bar + this.halfPixel, // width = bar width
                            h * 2, // height
                            true // drawDoctor
                        );
                    } else {
                        // Draw the PATIENT's parts
                        this.fillRect(
                            // halfPixel = 1 / (2 * params.pixelRatio)
                            i + this.halfPixel, // x = start of current bar
                            halfH - h + offsetY, // y
                            bar + this.halfPixel, // width = bar width
                            h * 2, // height
                            false // drawDoctor
                        );
                    }
                }
            }
        );
    }

    /**
     * Draw a waveform
     * MinSun: ignore this part. client never reaches here.
     *
     * @param {number[]|number[][]} peaks Can also be an array of arrays for split channel
     * rendering
     * @param {number} channelIndex The index of the current channel. Normally
     * should be 0
     * @param {number?} start The x-offset of the beginning of the area that
     * should be rendered (If this isn't set only a flat line is rendered)
     * @param {number?} end The x-offset of the end of the area that should be
     * rendered
     */
    drawWave(peaks, channelIndex, start, end) {
        return this.prepareDraw(
            peaks,
            channelIndex,
            start,
            end,
            ({ absmax, hasMinVals, height, offsetY, halfH, peaks }) => {
                if (!hasMinVals) {
                    const reflectedPeaks = [];
                    const len = peaks.length;
                    let i;
                    for (i = 0; i < len; i++) {
                        reflectedPeaks[2 * i] = peaks[i];
                        reflectedPeaks[2 * i + 1] = -peaks[i];
                    }
                    peaks = reflectedPeaks;
                }

                // if drawWave was called within ws.empty we don't pass a start and
                // end and simply want a flat line
                if (start !== undefined) {
                    this.drawLine(peaks, absmax, halfH, offsetY, start, end);
                }

                // Always draw a median line
                this.fillRect(
                    0,
                    halfH + offsetY - this.halfPixel,
                    this.width,
                    this.halfPixel
                    // MinSun: technically need a last ctx parameter here but our client code doesn't get here.
                );
            }
        );
    }

    /**
     * Tell the canvas entries to render their portion of the waveform
     * MinSun: ignore this part. client never reaches here.
     *
     * @private
     * @param {number[]} peaks Peak data
     * @param {number} absmax Maximum peak value (absolute)
     * @param {number} halfH Half the height of the waveform
     * @param {number} offsetY Offset to the top
     * @param {number} start The x-offset of the beginning of the area that
     * should be rendered
     * @param {number} end The x-offset of the end of the area that
     * should be rendered
     */
    drawLine(peaks, absmax, halfH, offsetY, start, end) {
        this.canvases.forEach(entry => {
            this.setFillStyles(entry);
            this.drawLineToContext(
                entry,
                entry.waveCtx,
                peaks,
                absmax,
                halfH,
                offsetY,
                start,
                end
            );
            this.drawLineToContext(
                entry,
                entry.progressCtx,
                peaks,
                absmax,
                halfH,
                offsetY,
                start,
                end
            );
        });
    }

    /**
     * Render the actual waveform line on a canvas
     * MinSun: ignore this part. client never reaches here.
     *
     * @private
     * @param {CanvasEntry} entry
     * @param {Canvas2DContextAttributes} ctx Essentially `entry.[wave|progress]Ctx`
     * @param {number[]} peaks
     * @param {number} absmax Maximum peak value (absolute)
     * @param {number} halfH Half the height of the waveform
     * @param {number} offsetY Offset to the top
     * @param {number} start The x-offset of the beginning of the area that
     * should be rendered
     * @param {number} end The x-offset of the end of the area that
     * should be rendered
     */
    drawLineToContext(entry, ctx, peaks, absmax, halfH, offsetY, start, end) {
        if (!ctx) {
            return;
        }

        const length = peaks.length / 2;
        const scale =
            this.params.fillParent && this.width != length
                ? this.width / length
                : 1;

        const first = Math.round(length * entry.start);
        // Use one more peak value to make sure we join peaks at ends -- unless,
        // of course, this is the last canvas.
        const last = Math.round(length * entry.end) + 1;
        if (first > end || last < start) {
            return;
        }
        const canvasStart = Math.min(first, start);
        const canvasEnd = Math.max(last, end);
        let i;
        let j;

        ctx.beginPath();
        ctx.moveTo(
            (canvasStart - first) * scale + this.halfPixel,
            halfH + offsetY
        );

        for (i = canvasStart; i < canvasEnd; i++) {
            const peak = peaks[2 * i] || 0;
            const h = Math.round((peak / absmax) * halfH);
            ctx.lineTo(
                (i - first) * scale + this.halfPixel,
                halfH - h + offsetY
            );
        }

        // Draw the bottom edge going backwards, to make a single
        // closed hull to fill.
        for (j = canvasEnd - 1; j >= canvasStart; j--) {
            const peak = peaks[2 * j + 1] || 0;
            const h = Math.round((peak / absmax) * halfH);
            ctx.lineTo(
                (j - first) * scale + this.halfPixel,
                halfH - h + offsetY
            );
        }

        ctx.closePath();
        ctx.fill();
    }

    /**
     * Draw a rectangle on the waveform
     *
     * @param {number} x // starting position of current bar
     * @param {number} y
     * @param {number} width // single bar width
     * @param {number} height
     * @param {boolean} drawDoctor // true if we're drawing doctor's part
     */
    fillRect(x, y, width, height, drawDoctor) {
        const startCanvas = Math.floor(x / this.maxCanvasWidth);
        const endCanvas = Math.min(
            Math.ceil((x + width) / this.maxCanvasWidth) + 1,
            this.canvases.length
        );
        let i;

        for (i = startCanvas; i < endCanvas; i++) {
            const entry = this.canvases[i];
            const leftOffset = i * this.maxCanvasWidth;

            const intersection = {
                x1: Math.max(x, i * this.maxCanvasWidth),
                y1: y,
                x2: Math.min(
                    x + width,
                    i * this.maxCanvasWidth + entry.waveCtx.canvas.width
                ),
                y2: y + height
            };

            if (intersection.x1 < intersection.x2) {
                // Coloring - separated from drawing the rectangles
                this.setFillStyles(entry);

                // Drawing the rectangles - on both wave and progress canvases
                // MinSun: Edit here
                if (drawDoctor) {
                    this.fillRectToContext(
                        entry.waveCtx,
                        intersection.x1 - leftOffset,
                        intersection.y1,
                        intersection.x2 - intersection.x1,
                        intersection.y2 - intersection.y1
                    );
                    this.fillRectToContext(
                        entry.progressCtx,
                        intersection.x1 - leftOffset,
                        intersection.y1,
                        intersection.x2 - intersection.x1,
                        intersection.y2 - intersection.y1
                    );
                } else {
                    this.fillRectToContext(
                        entry.patientWaveCtx,
                        intersection.x1 - leftOffset,
                        intersection.y1,
                        intersection.x2 - intersection.x1,
                        intersection.y2 - intersection.y1
                    );
                    this.fillRectToContext(
                        entry.patientProgressCtx,
                        intersection.x1 - leftOffset,
                        intersection.y1,
                        intersection.x2 - intersection.x1,
                        intersection.y2 - intersection.y1
                    );
                }
            }
        }
    }

    /**
     * Performs preparation tasks and calculations which are shared by drawBars and drawWave
     *
     * @private
     * @param {number[]|number[][]} peaks Can also be an array of arrays for split channel
     * rendering
     * @param {number} channelIndex The index of the current channel. Normally
     * should be 0
     * @param {number?} start The x-offset of the beginning of the area that
     * should be rendered (If this isn't set only a flat line is rendered)
     * @param {number?} end The x-offset of the end of the area that should be
     * rendered
     * @param {function} fn The render function to call
     */
    prepareDraw(peaks, channelIndex, start, end, fn) {
        return util.frame(() => {
            // Split channels and call this function with the channelIndex set
            if (peaks[0] instanceof Array) {
                const channels = peaks;
                if (this.params.splitChannels) {
                    this.setHeight(
                        channels.length *
                            this.params.height *
                            this.params.pixelRatio
                    );
                    return channels.forEach((channelPeaks, i) =>
                        this.prepareDraw(channelPeaks, i, start, end, fn)
                    );
                }
                peaks = channels[0];
            }
            // calculate maximum modulation value, either from the barHeight
            // parameter or if normalize=true from the largest value in the peak
            // set
            let absmax = 1 / this.params.barHeight;
            if (this.params.normalize) {
                const max = util.max(peaks);
                const min = util.min(peaks);
                absmax = -min > max ? -min : max;
            }

            // Bar wave draws the bottom only as a reflection of the top,
            // so we don't need negative values
            const hasMinVals = [].some.call(peaks, val => val < 0);
            const height = this.params.height * this.params.pixelRatio;
            const offsetY = height * channelIndex || 0;
            const halfH = height / 2;

            return fn({
                absmax: absmax,
                hasMinVals: hasMinVals,
                height: height,
                offsetY: offsetY,
                halfH: halfH,
                peaks: peaks
            });
        })();
    }

    /**
     * Draw the actual rectangle on a canvas - this doesn't color anything!
     *
     * @private
     * @param {Canvas2DContextAttributes} ctx
     * @param {number} x
     * @param {number} y
     * @param {number} width
     * @param {number} height
     */
    fillRectToContext(ctx, x, y, width, height) {
        if (!ctx) {
            return;
        }
        if (height == 0) {
            height = 1;
        }
        ctx.fillRect(x, y, width, height);
    }

    /**
     * Edited by MinSun:
     * Set the fill styles for a certain entry (wave and progress)
     *
     * @private
     * @param {CanvasEntry} entry
     */
    setFillStyles(entry) {
        entry.waveCtx.fillStyle = this.params.waveColor;
        entry.patientWaveCtx.fillStyle = '#313c77'; // lighter/darker blue
        if (this.hasProgressCanvas) {
            entry.progressCtx.fillStyle = this.params.progressColor;
            entry.patientProgressCtx.fillStyle = '#5F78FF'; // blue
        }
    }

    /**
     * Return image data of the waveform
     *
     * @param {string} type='image/png' An optional value of a format type.
     * @param {number} quality=0.92 An optional value between 0 and 1.
     * @return {string|string[]} images A data URL or an array of data URLs
     */
    getImage(type, quality) {
        const images = this.canvases.map(entry =>
            entry.wave.toDataURL(type, quality)
        );
        return images.length > 1 ? images : images[0];
    }

    /**
     * Render the new progress
     *
     * @param {number} position X-Offset of progress position in pixels
     * @param {number} curr Current time in seconds
     * @param {number} duration Duration of entire audio file in seconds
     */
    updateProgress(position, curr, duration) {
        this.style(this.progressWave, { width: position + 'px' });
        this.style(this.patientProgressWave, { width: position + 'px' });
        // Remove existing text node from currTime, then add a new one
        if (this.currTime.firstChild) {
            this.currTime.removeChild(this.currTime.firstChild);
        }
        let currHr = Math.floor(curr / 3600);
        let currMin = Math.floor(curr / 60);
        let currSec = Math.floor(curr % 60);
        this.currTimeText = document.createTextNode(
            ('0' + currHr).slice(-2) +
                ':' +
                ('0' + currMin).slice(-2) +
                ':' +
                ('0' + currSec).slice(-2)
        );
        this.currTime.appendChild(this.currTimeText);
        // Render duration just once and no more
        if (!this.durationRendered) {
            let durHr = Math.floor(duration / 3600);
            let durMin = Math.floor(duration / 60);
            let durSec = Math.floor(duration % 60);
            this.totalTimeText = document.createTextNode(
                ('0' + durHr).slice(-2) +
                    ':' +
                    ('0' + durMin).slice(-2) +
                    ':' +
                    ('0' + durSec).slice(-2)
            );
            this.totalTime.appendChild(this.totalTimeText);
            this.durationRendered = true;
        }
        this.currTime.style.left = position - 60 + 'px';
        this.totalTime.style.left = position + 8 + 'px';
    }
}
