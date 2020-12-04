'use strict';

import React, {Component} from "react";
import PropTypes from "prop-types";
import {
    LinkButton,
    requiresAuthenticatedUser,
    withPageHelpers
} from "../../lib/page";
import {
    Button,
    ButtonRow, CheckBox,
    filterData,
    Form,
    FormSendMethod,
    InputField,
    TableSelect,
    TextArea,
    withForm, withFormErrorHandlers
} from "../../lib/form";
import "brace/mode/jsx";
import "brace/mode/scss";
import {withErrorHandling} from "../../lib/error-handling";
import {
    NamespaceSelect,
    validateNamespace
} from "../../lib/namespace";
import {DeleteModalDialog} from "../../lib/modals";
import {Panel} from "../../lib/panel";
import ivisConfig from "ivisConfig";
import moment from "moment";
import {withComponentMixins} from "../../lib/decorator-helpers";
import {withTranslation} from "../../lib/i18n";
import testTrigger from "../../lib/alerts-trigger-tester";
import checkCondition from "../../lib/alerts-condition-checker";
import {getSignalTypes} from "../signal-sets/signals/signal-types";

@withComponentMixins([
    withTranslation,
    withForm,
    withErrorHandling,
    withPageHelpers,
    requiresAuthenticatedUser
])
export default class CUD extends Component {
    constructor(props) {
        super(props);

        this.state = {};

        this.signalTypes = getSignalTypes(props.t);

        this.initForm();
    }

    static propTypes = {
        action: PropTypes.string.isRequired,
        entity: PropTypes.object
    }

    componentDidMount() {
        if (this.props.entity) {
            this.getFormValuesFromEntity(this.props.entity);
        } else {
            this.populateFormValues({
                description: '',
                condition: '',
                emails: '',
                phones: '',
                namespace: ivisConfig.user.namespace
            });
        }
    }

    validateNumericalInput(state, key, min) {
        const entered = state.getIn([key, 'value']);

        return (parseInt(entered) === 0 || parseInt(entered) >= min) && (parseInt(entered)).toString() === entered.toString().trim();
    }

    localValidateFormValues(state) {
        const t = this.props.t;

        if (!state.getIn(['name', 'value'])) {
            state.setIn(['name', 'error'], t('Name must not be empty'));
        } else {
            state.setIn(['name', 'error'], null);
        }

        if (!state.getIn(['sigset', 'value'])) {
            state.setIn(['sigset', 'error'], t('Signal Set must not be empty'));
        } else {
            state.setIn(['sigset', 'error'], null);
        }

        if (!this.validateNumericalInput(state, 'duration', 0)) {
            state.setIn(['duration', 'error'], t('This value must be a non-negative number'));
        } else {
            state.setIn(['duration', 'error'], null);
        }

        if (!this.validateNumericalInput(state, 'delay', 0)) {
            state.setIn(['delay', 'error'], t('This value must be a non-negative number'));
        } else {
            state.setIn(['delay', 'error'], null);
        }

        if (!this.validateNumericalInput(state, 'interval', 0)) {
            state.setIn(['interval', 'error'], t('This value must be a non-negative number'));
        } else {
            state.setIn(['interval', 'error'], null);
        }

        const conTest = checkCondition(state.getIn(['condition', 'value']), state.getIn(['sigset', 'value']));
        if (conTest !== 'ok') {
            state.setIn(['condition', 'error'], conTest);
        } else {
            state.setIn(['condition', 'error'], null);
        }

        const minRepeat = 10;
        if (!this.validateNumericalInput(state, 'repeat', minRepeat)) {
            state.setIn(['repeat', 'error'], t(`This value must be 0 or a number greater than ${minRepeat}`));
        } else {
            state.setIn(['repeat', 'error'], null);
        }

        validateNamespace(t, state);
    }

    submitFormValuesMutator(data) {
        return filterData(data, [
            'name',
            'description',
            'sigset',
            'duration',
            'delay',
            'interval',
            'condition',
            'emails',
            'phones',
            'repeat',
            'finalnotification',
            'enabled',
            'namespace',
        ]);
    }

    @withFormErrorHandlers
    async submitHandler(submitAndLeave) {
        const t = this.props.t;

        let sendMethod, url;
        if (this.props.entity) {
            sendMethod = FormSendMethod.PUT;
            url = `rest/alerts/${this.props.entity.id}`
        } else {
            sendMethod = FormSendMethod.POST;
            url = 'rest/alerts'
        }

        try {
            this.disableForm();
            this.setFormStatusMessage('info', t('Saving ...'));

            const submitResult = await this.validateAndSendFormValuesToURL(sendMethod, url);

            if (submitResult) {
                if (this.props.entity) {
                    if (submitAndLeave) {
                        this.navigateToWithFlashMessage('/settings/alerts', 'success', t('Alert updated'));
                    } else {
                        await this.getFormValuesFromURL(`rest/alerts/${this.props.entity.id}`);
                        this.enableForm();
                        this.setFormStatusMessage('success', t('Alert updated'));
                    }
                } else {
                    if (submitAndLeave) {
                        this.navigateToWithFlashMessage('/settings/alerts', 'success', t('Alert saved'));
                    } else {
                        this.navigateToWithFlashMessage(`/settings/alerts/${submitResult}/edit`, 'success', t('Alert saved'));
                    }
                }
            } else {
                this.enableForm();
                this.setFormStatusMessage('warning', t('There are errors in the form. Please fix them and submit again.'));
            }
        } catch (error) {
            throw error;
        }
    }

    render() {
        const t = this.props.t;
        const isEdit = !!this.props.entity;
        const canDelete = isEdit && this.props.entity.permissions.includes('delete');

        const sigSetColumns = [
            { data: 1, title: t('Id') },
            { data: 2, title: t('Name') },
            { data: 3, title: t('Description') },
            { data: 6, title: t('Created'), render: data => moment(data).fromNow() },
            { data: 7, title: t('Namespace') }
        ];

        return (
            <Panel title={isEdit ? t('Edit Alert') : t('Create Alert')}>
                {canDelete &&
                <DeleteModalDialog
                    stateOwner={this}
                    visible={this.props.action === 'delete'}
                    deleteUrl={`rest/alerts/${this.props.entity.id}`}
                    backUrl={`/settings/alerts/${this.props.entity.id}/edit`}
                    successUrl="/settings/alerts"
                    deletingMsg={t('Deleting alert ...')}
                    deletedMsg={t('Alert deleted')}/>
                }

                <Form stateOwner={this} onSubmitAsync={::this.submitHandler}>
                    <InputField id="name" label={t('Name')}/>
                    <TextArea id="description" label={t('Description')} help={t('HTML is allowed')}/>
                    <TableSelect id="sigset" label={t('Signal Set')} withHeader dropdown dataUrl="rest/signal-sets-table" columns={sigSetColumns} selectionLabelIndex={2} help={t('Select signal set to watch.')}/>
                    <InputField id="duration" label={t('Duration')} help={t('How long the condition shall be satisfied before the alert is triggered. Use minutes!')}/>
                    <InputField id="delay" label={t('Delay')} help={t('How long the condition shall not be satisfied before the triggered alert is revoked. Use minutes!')}/>
                    <InputField id="interval" label={t('Maximum interval')} help={t('The alert is triggered if new data do not arrive from the sensors in this time. Use minutes! Use 0 if not applicable!')}/>
                    <TextArea id="condition" label={t('Condition')} help={t('If this condition is satisfied, the data from sensors are unsuitable. Mind that the error check might be one step delayed.')}/>
                    <TextArea id="emails" label={t('Email addresses')} help={t('Email addresses for notifications, one per line!')}/>
                    <TextArea id="phones" label={t('Phone numbers')} help={t('Phone numbers for notifications, one per line!')}/>
                    <InputField id="repeat" label={t('Repeat notification')} help={t('How often the notification shall be repeated during an exceptional situation (time between trigger and revoke events). Use minutes! Use 0 if not applicable!')}/>
                    <CheckBox id="finalnotification" text={t('Issue a notification when the triggered alert is revoked')}/>
                    <CheckBox id="enabled" text={t('Enabled')}/>
                    <NamespaceSelect/>
                    <ButtonRow>
                        <Button type="submit" className="btn-primary" icon="check" label={t('Save')}/>
                        <Button type="submit" className="btn-primary" icon="check" label={t('Save and leave')}
                                onClickAsync={async () => await this.submitHandler(true)}/>
                        {isEdit && <LinkButton className="btn-danger" icon="trash-alt" label={t('Delete')}
                                               to={`/settings/alerts/${this.props.entity.id}/delete`}/>}
                        {isEdit && <Button className="btn-warning" icon="bolt" label={t('Trigger')} title={t('Test this alert with manual trigger')}
                                onClickAsync={async () => {await testTrigger(this.props.entity.id); alert(t('The alert was manually triggered!'))}} /> }
                    </ButtonRow>
                </Form>
            </Panel>
        );
    }
}
