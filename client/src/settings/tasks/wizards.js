'use strict';
import {TaskType, subtypesByType, WizardType} from "../../../../shared/tasks";

const defaultPythonWizards = {
    [WizardType.BLANK]: 'Blank',
    [WizardType.BASIC]: 'Api Showcase',
    [WizardType.MOVING_AVERAGE]: 'Moving average example',
    [WizardType.AGGREGATION]: 'Aggregation example'
};

const wizardSpecs = {
    [TaskType.PYTHON]: {
        wizards: defaultPythonWizards,
        subtypes: {
            [subtypesByType[TaskType.PYTHON].ENERGY_PLUS]: {
                wizards: {
                    ...defaultPythonWizards,
                    [WizardType.MODEL_COMPARISON]: 'Model comparison example'
                }
            },
            [subtypesByType[TaskType.PYTHON].NUMPY]: {
                wizards: {
                    ...defaultPythonWizards,
                    [WizardType.ENERGY_PLUS]: 'Energy plus example'

                }
            },
        }
    }
}

function getWizardsForType(taskType, subtype = null) {
    const specsForType = wizardSpecs[taskType];

    if (!specsForType) {
        return null;
    }

    if (!subtype) {
        return specsForType.wizards;
    }

    if (!specsForType.subtypes) {
        return null;
    }

    return specsForType.subtypes[subtype] ? specsForType.subtypes[subtype].wizards : null;
}

export {
    WizardType,
    getWizardsForType
};
