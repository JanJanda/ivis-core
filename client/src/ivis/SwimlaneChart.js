'use strict';

import React, {Component} from "react";
import * as d3Axis from "d3-axis";
import * as d3Scale from "d3-scale";
import * as d3Selection from "d3-selection";
import {select} from "d3-selection";
import {withErrorHandling} from "../lib/error-handling";
import PropTypes from "prop-types";
import {PropType_d3Color} from "../lib/CustomPropTypes";
import moment from "moment";
import {withComponentMixins} from "../lib/decorator-helpers";
import {getTextColor} from "./common";
import {withPageHelpers} from "../lib/page-common";
import {createBase, RenderStatus, TimeBasedChartBase, XAxisType} from "./TimeBasedChartBase";

/** get moment object exactly in between two moment object */
function midpoint(ts1, ts2) {
    return ts1.clone().add(ts2.diff(ts1) / 2);
}

/**
 * Displays horizontal lanes with bars
 */
@withComponentMixins([
    withErrorHandling,
])
export class SwimlaneChart extends Component {
    constructor(props) {
        super(props);

        this.state = {

        };
    }

    static propTypes = {
        config: PropTypes.object.isRequired,
        height: PropTypes.number.isRequired,
        margin: PropTypes.object,

        xAxisType: PropTypes.oneOf([XAxisType.DATETIME, XAxisType.NUMBER]).isRequired, // data type on the x-axis
        xAxisTicksCount: PropTypes.number,
        xAxisTicksFormat: PropTypes.func,

        getSvgDefs: PropTypes.func,
        getGraphContent: PropTypes.func, // (this, rows, labels) => graph content; it is expected that `rows` and `labels` are drawn inside the graph content (see default value of the prop)
        createChart: PropTypes.func,
        getQueries: PropTypes.func,
        prepareData: PropTypes.func,
        compareConfigs: PropTypes.func,

        paddingInner: PropTypes.number,
        withLabels: PropTypes.bool,
        getLabelColor: PropTypes.func,

        withCursor: PropTypes.bool,
        withTooltip: PropTypes.bool,
        withZoom: PropTypes.bool,
        zoomUpdateReloadInterval: PropTypes.number, // milliseconds after the zoom ends; set to `null` to disable updates
        withBrush: PropTypes.bool,
        minimumIntervalMs: PropTypes.number,
        loadingOverlayColor: PropType_d3Color(),

        tooltipContentComponent: PropTypes.func,
        tooltipContentRender: PropTypes.func,
        tooltipExtraProps: PropTypes.object,
        tooltipYPosition: PropTypes.number,
    }

    static defaultProps = {
        xAxisType: XAxisType.DATETIME,
        margin: {
            left: 60,
            right: 5,
            top: 5,
            bottom: 30
        },
        getGraphContent: (base, rows, labels) => [rows, labels],
        paddingInner: 0.2,
        withCursor: true,
        withTooltip: true,
        withLabels: true,
        withZoom: false,
        zoomUpdateReloadInterval: 1000,
        useRangeContext: false,
        withBrush: false,
        getLabelColor: getTextColor,
        tooltipContentRender: (props) => props.selection.label,
    }

    /**
     * Draw the rows and bars
     * @param base TimeBasedChartBase
     * @param signalSetsData expected to be an array with rows as the items. Each row must have `label` and array of `bars`, each with `begin` and `end`
     * @param baseState
     * @param interval time interval or range
     * @param xScale
     */
    createChart(base, signalSetsData, baseState, interval, xScale) {
        const width = base.renderedWidth;
        const innerWidth = width - this.props.margin.left - this.props.margin.right;
        const innerHeight = this.props.height - this.props.margin.top - this.props.margin.bottom;

        const yScale = d3Scale.scaleBand()
            .domain(signalSetsData.map(r => r.label))
            .rangeRound([innerHeight, 0])
            .paddingInner(this.props.paddingInner);
        const yAxis = d3Axis.axisLeft(yScale);
        base.yAxisSelection.call(yAxis);

        if (signalSetsData.length === 0 || signalSetsData.every(d => d.bars.length === 0))
            return RenderStatus.NO_DATA;

        const xIsDate = this.props.xAxisType === XAxisType.DATETIME;
        signalSetsData.forEach(r => r.bars.forEach(b => {
            b.beginValue = xIsDate ? moment(b.begin) : b.begin;
            b.endValue = xIsDate ? moment(b.end) : b.end;
            b.row = r.label;
            if (b.color === undefined)
                b.color = r.color;
        }))
        const barHeight = yScale.bandwidth();
        const rows = this.rowsSelection.selectAll('g').data(signalSetsData);
        const bars = rows.enter().append('g')
            .attr('key', d => d.label)
            .merge(rows)
            .selectAll('rect')
            .data(d => d.bars);

        bars.enter()
            .append('rect')
            .merge(bars)
            .attr('key', d => d.begin)
            .attr('x', d => xScale(d.beginValue))
            .attr('y', d => yScale(d.row))
            .attr('width', d => xScale(d.endValue) - xScale(d.beginValue))
            .attr('height', barHeight)
            .attr('fill', d => d.color);

        bars.exit().remove();
        rows.exit().remove();

        if (this.props.withLabels) {
            const labelRows = this.labelsSelection.selectAll('g').data(signalSetsData);
            const labels = labelRows.enter().append('g')
                .attr('key', d => d.label)
                .merge(labelRows)
                .selectAll('text')
                .data(d => d.bars);

            labels.enter()
                .append('text')
                .merge(labels)
                .text(d => d.label || '')
                .attr('text-anchor', "middle")
                .attr('dominant-baseline', "middle")
                .attr('x', d => (xScale(d.beginValue) + xScale(d.endValue)) / 2)
                .attr('y', d => yScale(d.row) + barHeight / 2)
                .attr('font-family', "'Open Sans','Helvetica Neue',Helvetica,Arial,sans-serif")
                .attr('font-size', "12px")
                .attr('pointer-events', "none")
                .attr('fill', d => this.props.getLabelColor(d.color))
                .attr('visibility', function(d) {
                    if (this.getBBox().width > xScale(d.endValue) - xScale(d.beginValue))
                        return 'hidden';
                    return 'visible';
                });

            labels.exit().remove();
            labelRows.exit().remove();
        }

        if (this.props.withCursor)
            this.createChartCursor(base, innerWidth, innerHeight);

        if (this.props.createChart)
            return this.props.createChart(createBase(base, this), signalSetsData, baseState, interval, xScale, yScale);
        return RenderStatus.SUCCESS;
    }

    /** Handles mouse movement to display cursor line.
     *  Called from this.createChart(). */
    createChartCursor(base, xSize, ySize) {
        const self = this;

        const mouseMove = function (bar = null) {
            const containerPos = d3Selection.mouse(base.containerNode);

            base.cursorSelection
                .attr('x1', containerPos[0])
                .attr('x2', containerPos[0])
                .attr('visibility', self.props.withCursor && !base.state.brushInProgress ? 'visible' : "hidden");

            const y = self.props.tooltipYPosition !== undefined
                ? self.props.tooltipYPosition + self.props.margin.top
                : containerPos[1];
            const mousePosition = { x: containerPos[0], y };
            base.setState({
                mousePosition,
                selection: bar,
            });
        };

        const mouseLeave = function () {
            base.cursorSelection.attr('visibility', 'hidden');
            base.setState({
                selection: null,
                mousePosition: null
            });
        }

        base.brushSelection
            .on('mouseenter', mouseMove)
            .on('mousemove', mouseMove)
            .on('mouseleave', mouseLeave);
        this.rowsSelection.selectAll('g').selectAll('rect')
            .on('mouseenter', mouseMove)
            .on('mousemove', mouseMove)
            .on('mouseleave', mouseLeave);
    }

    getGraphContent(base) {
        const rows = <g name={"rows"} key={"rows"} ref={node => this.rowsSelection = select(node)} cursor={"crosshair"} />;
        const labels = <g name={"labels"} key={"labels"} ref={node => this.labelsSelection = select(node)} />
        {this.props.getGraphContent(this)}

        if (this.props.getGraphContent) {
            return this.props.getGraphContent(createBase(base, this), rows, labels);
        } else {
            return [rows, labels];
        }
    }

    getQueries(base, interval, config) {
        return this.props.getQueries(createBase(base, this), interval, config);
    }

    prepareData(base, results) {
        return this.props.prepareData(createBase(base, this), results);
    }

    render() {
        const props = this.props;
        return (
            <TimeBasedChartBase
                config={props.config}
                height={props.height}
                margin={props.margin}
                prepareData={::this.prepareData}
                getQueries={::this.getQueries}
                createChart={::this.createChart}
                getGraphContent={::this.getGraphContent}
                getSvgDefs={props.getSvgDefs}
                //compareConfigs={props.compareConfigs} // TODO
                withTooltip={props.withTooltip}
                withBrush={props.withBrush}
                withZoom={props.withZoom}
                withCursor={props.withCursor}
                zoomUpdateReloadInterval={props.zoomUpdateReloadInterval}
                tooltipContentComponent={props.tooltipContentComponent}
                tooltipContentRender={props.tooltipContentRender}
                tooltipExtraProps={props.tooltipExtraProps}
                loadingOverlayColor={props.loadingOverlayColor}
                displayLoadingTextWhenUpdating={props.displayLoadingTextWhenUpdating}
                minimumIntervalMs={props.minimumIntervalMs}
                xAxisType={props.xAxisType}
                xAxisTicksCount={props.xAxisTicksCount}
                xAxisTicksFormat={props.xAxisTicksFormat}
                drawBrushAreaBehindData={true}
            />
        )
    }
}

/**
 * Displays one lane for each signal, bar is rendered when the signal is `true` (non-zero)
 */
export class BooleanSwimlaneChart extends Component {
    constructor(props) {
        super(props);
    }

    static propTypes = {
        config: PropTypes.shape({
            signalSets: PropTypes.arrayOf(PropTypes.shape({
                cid: PropTypes.string.isRequired,
                tsSigCid: PropTypes.string,
                signals: PropTypes.arrayOf(PropTypes.shape({
                    cid: PropTypes.string.isRequired,
                    label: PropTypes.string.isRequired,
                    color: PropType_d3Color,
                })),
            })).isRequired,
        }).isRequired,
        height: PropTypes.number.isRequired,
        margin: PropTypes.object,

        xAxisType: PropTypes.oneOf([XAxisType.DATETIME, XAxisType.NUMBER]), // data type on the x-axis
        xAxisTicksCount: PropTypes.number,
        xAxisTicksFormat: PropTypes.func,

        getSvgDefs: PropTypes.func,
        getGraphContent: PropTypes.func,
        createChart: PropTypes.func,

        discontinuityInterval: PropTypes.number,
        paddingInner: PropTypes.number,
        withLabels: PropTypes.bool,
        getLabelColor: PropTypes.func,

        withCursor: PropTypes.bool,
        withTooltip: PropTypes.bool,
        withZoom: PropTypes.bool,
        zoomUpdateReloadInterval: PropTypes.number, // milliseconds after the zoom ends; set to `null` to disable updates

        tooltipContentComponent: PropTypes.func,
        tooltipContentRender: PropTypes.func,
        tooltipExtraProps: PropTypes.object,
        tooltipYPosition: PropTypes.number,
    }

    getQueries(base, abs, config) {
        const signalSets = {};
        for (const sigSetConf of config.signalSets) {
            const signals = {};
            for (const signal of sigSetConf.signals) {
                signals[signal.cid] = ["max"];
            }
            signalSets[sigSetConf.cid] = {
                tsSigCid: sigSetConf.tsSigCid || "ts",
                signals,
            }
        }

        return [{
            type: "timeSeries",
            args: [signalSets, abs]
        }]
    }

    prepareData(base, results) {
        const signalSetsData = results[0];
        const config = this.props.config;
        const rows = [];

        for (const sigSetConf of config.signalSets) {
            const main = signalSetsData[sigSetConf.cid].main;

            if (main.length === 0) {
                rows.push(...sigSetConf.signals.map(signal => ({
                    label: signal.label,
                    color: signal.color,
                    bars: [],
                })));
                continue;
            }

            // prev and next data
            if (signalSetsData[sigSetConf.cid].prev)
                main.unshift(signalSetsData[sigSetConf.cid].prev);
            if (signalSetsData[sigSetConf.cid].next)
                main.push(signalSetsData[sigSetConf.cid].next);

            for (const signal of sigSetConf.signals) {
                const bars = [];
                let previous = 0;
                let previousTs = main[0].ts;
                let start = null;

                for (const point of main) {
                    let d = point.data[signal.cid].max;
                    if (d === null || d === undefined)
                        d = 0;
                    if (d > 0 && previous > 0 && point.ts.diff(previousTs, 'seconds') > this.props.discontinuityInterval) {
                        bars.push({
                            begin: start,
                            end: previousTs,
                        });
                        start = point.ts;
                    }
                    else if (d > 0 && previous === 0)
                        start = midpoint(previousTs, point.ts);
                    else if (d === 0 && previous > 0)
                        bars.push({
                            begin: start,
                            end: midpoint(previousTs, point.ts),
                        });
                    previous = d;
                    previousTs = point.ts;
                }
                if (previous > 0) // end of last bar
                    bars.push({
                        begin: start,
                        end: main[main.length - 1].ts,
                    });

                rows.push({
                    label: signal.label,
                    color: signal.color,
                    bars,
                });
            }
        }

        return {
            signalSetsData: rows
        };
    }

    render() {
        return <SwimlaneChart
            withTooltip={false}
            getQueries={::this.getQueries}
            prepareData={::this.prepareData}
            {...this.props}
        />
    }
}

/**
 * Displays only one lane with bar of the color of the signal with highest value
 */
@withComponentMixins([
    withPageHelpers,
])
export class MaximumSwimlaneChart extends Component {
    constructor(props) {
        super(props);

        if (props.config.signalSets.length !== 1)
            this.setFlashMessage("warning", "The MaximumSwimlaneChart component currently works for only one signal set. Only the first signal set will be displayed.");
    }

    static propTypes = {
        config: PropTypes.shape({
            signalSets: PropTypes.arrayOf(PropTypes.shape({
                cid: PropTypes.string.isRequired,
                tsSigCid: PropTypes.string,
                signals: PropTypes.arrayOf(PropTypes.shape({
                    cid: PropTypes.string.isRequired,
                    label: PropTypes.string.isRequired,
                    color: PropType_d3Color,
                })),
            })).isRequired,
        }).isRequired,
        height: PropTypes.number.isRequired,
        margin: PropTypes.object,

        xAxisType: PropTypes.oneOf([XAxisType.DATETIME, XAxisType.NUMBER]), // data type on the x-axis
        xAxisTicksCount: PropTypes.number,
        xAxisTicksFormat: PropTypes.func,

        getSvgDefs: PropTypes.func,
        getGraphContent: PropTypes.func,
        createChart: PropTypes.func,

        discontinuityInterval: PropTypes.number,
        paddingInner: PropTypes.number,
        withLabels: PropTypes.bool,
        getLabelColor: PropTypes.func,
        signalAgg: PropTypes.string,

        withCursor: PropTypes.bool,
        withTooltip: PropTypes.bool,
        withZoom: PropTypes.bool,
        zoomUpdateReloadInterval: PropTypes.number, // milliseconds after the zoom ends; set to `null` to disable updates

        tooltipContentComponent: PropTypes.func,
        tooltipContentRender: PropTypes.func,
        tooltipExtraProps: PropTypes.object,
        tooltipYPosition: PropTypes.number,
    }

    static defaultProps = {
        signalAgg: 'avg'
    }

    getQueries(base, abs, config) {
        const signalSets = {};
        for (const sigSetConf of config.signalSets) {
            const signals = {};
            for (const signal of sigSetConf.signals) {
                signals[signal.cid] = [this.props.signalAgg];
            }
            signalSets[sigSetConf.cid] = {
                tsSigCid: sigSetConf.tsSigCid || "ts",
                signals,
            }
        }

        return [{
            type: "timeSeries",
            args: [signalSets, abs]
        }]
    }

    prepareData(base, results) {
        const data = results[0];
        const config = this.props.config;
        const sigSetConf = config.signalSets[0];
        const main = data[sigSetConf.cid].main;

        const maxs = [];
        for (const point of main) {
            let max = Number.NEGATIVE_INFINITY;
            let maxSignal = null;
            for (const signal of sigSetConf.signals) {
                const d = point.data[signal.cid][this.props.signalAgg];
                if (d > max) {
                    max = d;
                    maxSignal = signal;
                }
            }
            if (maxSignal != null) {
                maxs.push({
                    value: max,
                    signal: maxSignal,
                    ts: point.ts,
                });
            }
        }

        if (maxs.length === 0) {
            return {
                signalSetsData: [{
                    label: "",
                    bars: [],
                }],
            };
        }

        const bars = [];
        let previous = null;
        let startTs = maxs[0].ts;
        for (const point of maxs) {
            if (previous === null) {
                previous = point;
                continue;
            }
            if (point.ts.diff(previous.ts, 'seconds') > this.props.discontinuityInterval) {
                bars.push({
                    begin: startTs,
                    end: previous.ts,
                    color: previous.signal.color,
                    label: previous.signal.label,
                });
                startTs = point.ts;
            }
            else if (point.signal !== previous.signal) {
                bars.push({
                    begin: startTs,
                    end: midpoint(previous.ts, point.ts),
                    color: previous.signal.color,
                    label: previous.signal.label,
                });
                startTs = midpoint(previous.ts, point.ts);
            }
            previous = point;
        }
        // end of last bar
        const last = maxs[maxs.length - 1];
        bars.push({
            begin: startTs,
            end: last.ts,
            color: last.signal.color,
            label: last.signal.label,
        });

        return {
            signalSetsData: [{
                label: "",
                bars,
            }],
        };
    }

    render() {
        return <SwimlaneChart
            withTooltip={false}
            tooltipYPosition={-10}
            getQueries={::this.getQueries}
            prepareData={::this.prepareData}
            {...this.props}
        />
    }
}
