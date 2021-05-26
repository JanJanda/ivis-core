'use strict';

import React, {Component} from "react";
import styles
    from "./NanosecondsRangeSelector.scss";
import {
    ActionLink,
    Button,
    Icon
} from "../lib/bootstrap-components";
import _ from "lodash";
import {withComponentMixins} from "../lib/decorator-helpers";
import {withTranslation} from "../lib/i18n";
import {rangeAccessMixin} from "./RangeContext";

/* helper function to split nanoseconds into readable values */
function getSeconds(value) {
    return Math.floor(value / 1000000000);
}
function getMilliseconds(value) {
    return Math.floor(value / 1000000) % 1000;
}
function getMicroseconds(value) {
    return Math.floor(value / 1000) % 1000;
}
function getNanoseconds(value) {
    return Math.floor(value) % 1000;
}

export class NanosecondsSelector extends Component {
    constructor(props) {
        super(props);

        this.formInputId = _.uniqueId("formInputId");
    }

    setValue() {
        const value =
            Number(this.inputSeconds.value) * 1000000000 +
            Number(this.inputMilliseconds.value) * 1000000 +
            Number(this.inputMicroseconds.value) * 1000 +
            Number(this.inputNanoseconds.value);
        this.props.setValue(value);
    }

    nanosecondsChanged(event) {
        this.props.setValue(event.target.value);
    }

    render() {
        return (<div className={`row ${styles.selectorRow}`}>
            <label className={`col-form-label ${styles.timeSelectLabel}`}>{this.props.label}</label>

            <div className={`input-group ${styles.timeSelectInput}`}>
                <input id={this.formInputId + "_s"} className="form-control" ref={node => this.inputSeconds = node}
                       type="number" min={0}
                       value={getSeconds(this.props.value)} onChange={::this.setValue} />
                <span className="input-group-append">
                    <span className="input-group-text">s</span>
                </span>
            </div>

            <div className={`input-group ${styles.timeSelectInput}`}>
                <input id={this.formInputId + "_ms"} className="form-control" ref={node => this.inputMilliseconds = node}
                       type="number" min={0} max={999}
                       value={getMilliseconds(this.props.value)} onChange={::this.setValue} />
                <span className="input-group-append">
                    <span className="input-group-text">ms</span>
                </span>
            </div>

            <div className={`input-group ${styles.timeSelectInput}`}>
                <input id={this.formInputId + "_μs"} className="form-control" ref={node => this.inputMicroseconds = node}
                       type="number" min={0} max={999}
                       value={getMicroseconds(this.props.value)} onChange={::this.setValue} />
                <span className="input-group-append">
                    <span className="input-group-text">μs</span>
                </span>
            </div>

            <div className={`input-group ${styles.timeSelectInput}`}>
                <input id={this.formInputId + "_ns"} className="form-control" ref={node => this.inputNanoseconds = node}
                       type="number" min={0} max={999}
                       value={getNanoseconds(this.props.value)} onChange={::this.setValue} />
                <span className="input-group-append">
                    <span className="input-group-text">ns</span>
                </span>
            </div>

            <label className={`col-form-label ${styles.timeSelectLabelCombined}`} htmlFor={this.formInputId}>As nanoseconds:</label>
            <input id={this.formInputId} type="number" className={`form-control ${styles.timeSelectInputCombined}`} value={Math.floor(this.props.value)} onChange={::this.nanosecondsChanged} />
        </div>)
    }
}

@withComponentMixins([
    rangeAccessMixin,
    withTranslation,
])
export class NanosecondsRangeSelector extends Component {
    constructor(props, context) {
        super(props, context);

        this.state = {
            from: 0,
            to: 0,
            opened: false,
        };
    }

    static propTypes = {}

    componentDidMount() {
        this.updateFromRangeContext();
    }

    componentDidUpdate() {
        if (!this.state.opened)
            this.updateFromRangeContext();
    }

    updateFromRangeContext() {
        this.setValues(...this.getRange());
    }

    setValues(from, to) {
        if (from === undefined) from = this.state.from;
        if (to === undefined) to = this.state.to;
        from = Math.floor(from);
        to = Math.floor(to);
        if (this.state.from !== from || this.state.to !== to)
            this.setState({ from, to });
    }

    setFrom = (value) => this.setValues(value, undefined);
    setTo = (value) => this.setValues(undefined, value);

    updateRangeContext() {
        this.setRange([this.state.from, this.state.to]);
        this.setState({ opened: false });
    }

    getDescription() {
        return (<span>
            <b>From: </b>
            {getSeconds(this.state.from)} s {getMilliseconds(this.state.from)} ms {getMicroseconds(this.state.from)} μs {getNanoseconds(this.state.from)} ns,&emsp;
            <b>To: </b> {getSeconds(this.state.to)} s {getMilliseconds(this.state.to)} ms {getMicroseconds(this.state.to)} μs {getNanoseconds(this.state.to)} ns
        </span>);
    }

    zoom(factor) {
        const middle = (this.state.from + this.state.to) / 2;
        const halfLength = (this.state.to - this.state.from) * factor / 2;
        this.setRange([middle - halfLength, middle + halfLength]);
    }

    move(factor) {
        const offset = (this.state.to - this.state.from) * factor;
        this.setRange([this.state.from + offset, this.state.to + offset]);
    }

    render() {
        const t = this.props.t;

        return (
            <div className={"card"}>
                <div className={`card-header`} onClick={() => this.setState({ opened: !this.state.opened })}>
                    <div className={styles.headingDescription}>{this.getDescription()}</div>
                    <div className={styles.headingButtons}>
                        <ActionLink onClickAsync={async () => this.setState({ opened: !this.state.opened })}><Icon icon="sliders-h" title={t('Open time settings')}/></ActionLink>
                        <ActionLink className={styles.cursorZoomIn} onClickAsync={async () => this.zoom(0.5)}><Icon icon="search-plus" title={t('Zoom in')}/></ActionLink>
                        <ActionLink className={styles.cursorZoomOut} onClickAsync={async () => this.zoom(2)}><Icon icon="search-minus" title={t('Zoom out')}/></ActionLink>
                        <ActionLink onClickAsync={async () => this.move(-0.8)}><Icon icon="arrow-left" title={t('Move left')}/></ActionLink>
                        <ActionLink onClickAsync={async () => this.move(0.8)}><Icon icon="arrow-right" title={t('Move right')}/></ActionLink>
                    </div>
                </div>
                { this.state.opened &&
                    <div className={`card-body container-fluid ${styles.nanosecondsSelector}`}>
                        <NanosecondsSelector label="From time:" value={this.state.from} setValue={::this.setFrom}/>
                        <NanosecondsSelector label="To time:" value={this.state.to} setValue={::this.setTo}/>
                        <div className={"row"}>
                            <Button onClickAsync={::this.updateRangeContext} type="submit" className="btn-primary" label={t('Apply')} />
                        </div>
                    </div>
                }
            </div>
        )
    }
}
