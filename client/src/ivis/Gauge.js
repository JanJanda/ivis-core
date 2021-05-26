'use strict';

import React, {Component} from "react";
import {withErrorHandling} from "../lib/error-handling";
import PropTypes from "prop-types";
import * as d3Color from "d3-color";
import * as d3Shape from "d3-shape";
import {select} from "d3-selection";
import {withComponentMixins} from "../lib/decorator-helpers";
import {withTranslation} from "../lib/i18n";
import {PropType_d3Color, PropType_d3Color_Required} from "../lib/CustomPropTypes";
import * as d3Scale from "d3-scale";

@withComponentMixins([
    withTranslation,
    withErrorHandling
])
/**
 * Draws a gauge with defined `min`, `max` and `value`. The value is represented by a `bar`.
 * Additional `arcs` can be drawn on the outer side of the `bar` to represent ranges of values.
 * TODO: better needle
 */
export class StaticGauge extends Component {
    constructor(props) {
        super(props);

        this.state = {
            width: 0
        };

        this.resizeListener = () => this.createChart();
    }

    static propTypes = {
        config: PropTypes.shape({
            min: PropTypes.number.isRequired,
            max: PropTypes.number.isRequired,
            value: PropTypes.number.isRequired,
            arcs: PropTypes.arrayOf(PropTypes.shape({
                color: PropType_d3Color_Required(),
                from: PropTypes.number, // if not set, `to` of previous arc is used
                to: PropTypes.number.isRequired,
            })),
        }).isRequired,
        height: PropTypes.number,
        margin: PropTypes.object,
        backgroundColor: PropType_d3Color_Required(),
        barColor: PropType_d3Color(), // if not set, color of current arc is used
        getBarColor: PropTypes.func, // transform `barColor` or arc `color` property to the final color of bar
        withValue: PropTypes.bool,
        //valueTextColor: PropType_d3Color(), // if not set, color of current arc is used
        //getValueTextColor: PropTypes.func, // transform `valueTextColor` or arc `color` property to the final color of the text
        withAxis: PropTypes.bool, // TODO (https://github.com/vasturiano/d3-radial-axis)
        leftAngle: PropTypes.number, // in degrees
        rightAngle: PropTypes.number, // in degrees
        innerRadius: PropTypes.number, // outer radius is `innerRadius + barWidth + arcWidth` + some padding
        barWidth: PropTypes.number,
        arcWidth: PropTypes.number,
        arcPadding: PropTypes.number, // padding between bar and arcs,
        valueRender: PropTypes.func,
        valueClass: PropTypes.string,
        needleWidth: PropTypes.number, // Unless this value is specified, the bar starts at `leftAngle`. If this value is specified, the angular width of the bar is set to `needleWidth`.
        clampValue: PropTypes.bool, // clamp `value` between `min` and `max`
    }

    static defaultProps = {
        getBarColor: color => color,
        //getValueTextColor: color => color,
        margin: {
            left: 5,
            right: 5,
            top: 5,
            bottom: 5
        },
        barWidth: 40,
        arcWidth: 5,
        arcPadding: 0,
        withValue: true,
        withAxis: false,
        leftAngle: -120,
        rightAngle: 120,
        innerRadius: 80,
        backgroundColor: d3Color.color("#d6d6d6"),
        valueRender: function(props) {
            return <text textAnchor={"middle"} dominantBaseline={"middle"} className={props.valueClass} >
                {props.config.value}
            </text>;
        },
        clampValue: true,
    }

    componentDidMount() {
        window.addEventListener('resize', this.resizeListener);
        this.createChart(true);
    }

    componentDidUpdate(prevProps, prevState, prevContext) {
        const forceRefresh = this.prevContainerNode !== this.containerNode
            || prevProps.config !== this.props.config;

        this.createChart(forceRefresh);
        this.prevContainerNode = this.containerNode;
    }

    componentWillUnmount() {
        window.removeEventListener('resize', this.resizeListener);
    }

    createChart(forceRefresh) {
        // prepare width and height
        const width = this.containerNode.getClientRects()[0].width;
        const outerRadius = this.props.innerRadius + this.props.barWidth + this.props.arcPadding + this.props.arcWidth;
        let height = this.props.height;
        if (!height) {
            if (this.props.leftAngle <= -180 || this.props.rightAngle >= 180)
                height = 2 * outerRadius;
            else {
                const biggerAngle = Math.max(-this.props.leftAngle, this.props.rightAngle);
                height = outerRadius - outerRadius * Math.cos(biggerAngle * Math.PI / 180);
            }
        }
        height += this.props.margin.top + this.props.margin.bottom;

        if (this.state.width !== width || this.state.height !== height) {
            this.setState({
                width, height
            });
        }

        if (!forceRefresh && width === this.renderedWidth && height === this.renderedHeight) {
            return;
        }
        this.renderedWidth = width;
        this.renderedHeight = height;

        // compute center
        const innerWidth = width - this.props.margin.left - this.props.margin.right;
        const innerHeight = height - this.props.margin.top - this.props.margin.bottom;
        const centerX = innerWidth / 2 + this.props.margin.left;
        const centerY = outerRadius + this.props.margin.top;
        this.gaugeSelection.attr('transform', `translate(${centerX},${centerY})`);
        this.valueSelection.attr('transform', `translate(${centerX},${centerY})`);

        // prepare scale
        const config = this.props.config;
        const scale = d3Scale.scaleLinear()
            .domain([config.min, config.max])
            .range([this.props.leftAngle * Math.PI / 180, this.props.rightAngle * Math.PI / 180]);

        // prepare arcs thresholds
        let lastFrom = config.min;
        for (const arc of config.arcs) {
            if (!arc.hasOwnProperty('from'))
                arc.from = lastFrom;
            lastFrom = arc.to;
        }

        // draw background
        const background = d3Shape.arc()
            .innerRadius(this.props.innerRadius)
            .outerRadius(this.props.innerRadius + this.props.barWidth)
            .startAngle(scale(config.min))
            .endAngle(scale(config.max));
        this.backgroundSelection.attr('d', background());

        // draw bar
        const value = this.props.clampValue ? Math.min(config.max, Math.max(config.min, config.value)) : config.value;
        const bar = d3Shape.arc()
            .innerRadius(this.props.innerRadius)
            .outerRadius(this.props.innerRadius + this.props.barWidth)
            .startAngle(this.props.needleWidth ? scale(config.value) - this.props.needleWidth * Math.PI / 180 : scale(config.min))
            .endAngle(scale(value));
        this.barSelection.attr('d', bar());
        // bar color
        let barColor = this.props.barColor;
        let currentArc = config.arcs.find(arc => value >= arc.from && value <= arc.to);
        if (!barColor && currentArc)
            barColor = currentArc.color;
        this.barSelection.attr('fill', this.props.getBarColor(barColor, currentArc));

        // draw arcs
        const arcGen = d3Shape.arc()
            .innerRadius(this.props.innerRadius + this.props.barWidth + this.props.arcPadding)
            .outerRadius(this.props.innerRadius + this.props.barWidth + this.props.arcPadding + this.props.arcWidth)
            .startAngle(d => scale(d.from))
            .endAngle(d => scale(d.to));
        const arcs = this.arcsSelection.selectAll('path').data(config.arcs);
        arcs.enter().append('path')
            .merge(arcs)
            .attr('d', arcGen)
            .attr('fill', d => d.color);
        arcs.exit().remove();
    }

    render() {
        return (
            <svg ref={node => this.containerNode = node} height={this.state.height} width="100%">
                <g ref={node => this.gaugeSelection = select(node)} >
                    <path ref={node => this.backgroundSelection = select(node)}
                          fill={this.props.backgroundColor} />
                    <g ref={node => this.arcsSelection = select(node)} />
                    <path ref={node => this.barSelection = select(node)} />
                </g>
                <g ref={node => this.valueSelection = select(node)} >
                    {this.props.valueRender(this.props)}
                </g>
            </svg>
        );
    }
}
