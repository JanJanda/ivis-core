'use strict';

import React, {Component} from "react";
import PropTypes from "prop-types";
import {createComponentMixin, withComponentMixins} from "../lib/decorator-helpers";
import {panelConfigAccessMixin} from "./PanelConfig";

export const RangeReactContext = React.createContext(null);

@withComponentMixins([
    panelConfigAccessMixin
])
export class RangeContext extends Component {
    constructor(props) {
        super(props);

        this.state = {
            range: props.initialRange,
        };

        this.exportData();
    }

    exportData() {
        const owner = this.props.panelConfigOwner;
        if (owner) {
            owner.updatePanelConfig(this.props.configPath, { range: this.state.range });
        }
    };

    getRange() {
        return this.state.range;
    }

    setRange(newRange) {
        if (!Array.isArray(newRange)) throw new TypeError('Range must be an array.');
        if (newRange.length !== 2) throw new TypeError('Range must contain exactly two elements.');
        if (this.props.min !== undefined && newRange[0] < this.props.min)
            newRange[0] = this.props.min;
        if (this.props.max !== undefined && newRange[1] > this.props.max)
            newRange[1] = this.props.max;
        if (this.state.range[0] !== newRange[0] || this.state.range[1] !== newRange[1])
            this.setState({range: newRange}, ::this.exportData);
    }

    static propTypes = {
        initialRange: PropTypes.array,
        configPath: PropTypes.array,
        min: PropTypes.number,
        max: PropTypes.number,
    }

    static defaultProps = {
        configPath: ['rangeContext'],
        initialRange: [0, 1],
    }

    render() {
        return (
            <RangeReactContext.Provider value={{
                self: this,
                range: this.state.range,
            }}>
                {this.props.children}
            </RangeReactContext.Provider>
        );
    }
}

export const rangeAccessMixin = createComponentMixin({
    contexts: [{context: RangeReactContext, propName: 'rangeContext'}],
    decoratorFn: (TargetClass, InnerClass) => {
        const inst = InnerClass.prototype;

        inst.getRange = function (props) {
            props = props || this.props;
            if (props.rangeContext !== undefined && props.rangeContext !== null)
                return props.rangeContext.range;
            return null;
        };

        inst.setRange = function (newRange) {
            if (this.props.rangeContext !== undefined && this.props.rangeContext !== null)
                this.props.rangeContext.self.setRange(newRange);
        }

        return {};
    }
});

export const withRangeAccess = withComponentMixins([
    rangeAccessMixin
]);
