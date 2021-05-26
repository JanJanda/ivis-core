'use strict';

import React, {Component} from "react";
import {translate} from "react-i18next";
import {Panel} from "../../lib/panel";
import {
    requiresAuthenticatedUser,
    withPageHelpers
} from "../../lib/page";
import {
    withErrorHandling
} from "../../lib/error-handling";
import {withComponentMixins} from "../../lib/decorator-helpers";
import {withTranslation} from "../../lib/i18n";
import RunConsole from "./RunConsole";

@withComponentMixins([
    withTranslation,
    withErrorHandling,
    withPageHelpers,
    requiresAuthenticatedUser
])
export default class RunOutput extends Component {

    render() {
        const t = this.props.t;
        const run = this.props.entity;

        return (
            <Panel title={t('Output of run ') + run.id}>
                <RunConsole jobId={run.job} runId={run.id}/>
            </Panel>
        );
    }
}