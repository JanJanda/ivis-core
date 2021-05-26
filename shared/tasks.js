'use strict';

const TaskType = {
    PYTHON: 'python',
};

const defaultSubtypeKey = '__default__';

const PythonSubtypes = {
    ENERGY_PLUS: 'energy_plus',
    NUMPY: 'numpy',
    PANDAS: 'pandas'
};

// File name of every build output
const PYTHON_JOB_FILE_NAME = 'job.py';

const subtypesByType = {
    [TaskType.PYTHON]: PythonSubtypes
};

const BuildState = {
    SCHEDULED: 0,
    PROCESSING: 1,
    FINISHED: 2,
    FAILED: 3,
    UNINITIALIZED: 4,
    INITIALIZING: 5
};

const TaskSource = {
    USER: 'user',
    BUILTIN: 'builtin'
};

function getFinalStates() {
    return [BuildState.FINISHED, BuildState.FAILED, BuildState.UNINITIALIZED];
}

function getTransitionStates() {
    return [BuildState.INITIALIZING, BuildState.PROCESSING, BuildState.SCHEDULED];
}

function isTransitionState(state) {
    return getTransitionStates().includes(state);
}

const WizardType = {
    BLANK: 'blank',
    BASIC: 'basic',
    ENERGY_PLUS: 'energy_plus',
    MOVING_AVERAGE: 'moving_average',
    AGGREGATION: 'aggregation',
    MODEL_COMPARISON: 'model_comparison'
};

module.exports = {
    TaskType,
    subtypesByType,
    PythonSubtypes,
    defaultSubtypeKey,
    BuildState,
    TaskSource,
    getFinalStates,
    getTransitionStates,
    isTransitionState,
    PYTHON_JOB_FILE_NAME,
    WizardType
};
