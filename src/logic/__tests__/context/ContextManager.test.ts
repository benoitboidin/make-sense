import { ContextManager } from '../../context/ContextManager';

// Minimal mocks so the module loads without side-effects
jest.mock('../../../index', () => ({
    store: {
        dispatch: jest.fn(),
        getState: jest.fn(() => ({ general: { activeContext: null } })),
        subscribe: jest.fn(),
    },
}));
jest.mock('../../context/EditorContext', () => ({ EditorContext: { getActions: () => [] } }));
jest.mock('../../context/PopupContext', () => ({ PopupContext: { getActions: () => [] } }));
jest.mock('../../../store/general/actionCreators', () => ({
    updateActiveContext: jest.fn((ctx) => ({ type: '@@UPDATE_CONTEXT', payload: { activeContext: ctx } })),
}));
jest.mock('../../../store/selectors/GeneralSelector', () => ({
    GeneralSelector: { getActiveContext: jest.fn(() => null) },
}));
jest.mock('../../../staticModels/EditorModel', () => ({
    EditorModel: { editor: null, isEditorFocused: false },
}));

const fireKeyDown = (key: string) => {
    const event = new KeyboardEvent('keydown', { key, bubbles: true });
    window.dispatchEvent(event);
};

const fireKeyUp = (key: string) => {
    const event = new KeyboardEvent('keyup', { key, bubbles: true });
    window.dispatchEvent(event);
};

describe('ContextManager phantom key fix', () => {
    beforeAll(() => {
        ContextManager.init();
    });

    beforeEach(() => {
        ContextManager.onFocus(); // clears activeCombo
    });

    it('removes non-modifier keys from combo when Meta is released', () => {
        // Simulate: Meta down, z down, Meta up (z keyup swallowed on macOS)
        fireKeyDown('Meta');
        fireKeyDown('z');
        expect(ContextManager.getActiveCombo()).toEqual(['Meta', 'z']);

        // Meta up — z should be cleared too (macOS phantom key fix)
        fireKeyUp('Meta');

        expect(ContextManager.getActiveCombo()).toEqual([]);
    });

    it('removes non-modifier keys from combo when Control is released', () => {
        fireKeyDown('Control');
        fireKeyDown('z');
        expect(ContextManager.getActiveCombo()).toEqual(['Control', 'z']);

        fireKeyUp('Control');

        expect(ContextManager.getActiveCombo()).toEqual([]);
    });

    it('retains other modifier keys when Meta is released', () => {
        // Shift is retained (it has its own key-up and is harmless to keep)
        fireKeyDown('Meta');
        fireKeyDown('Shift');
        fireKeyDown('Z');
        expect(ContextManager.getActiveCombo()).toEqual(['Meta', 'Shift', 'Z']);

        // Meta up — Z should be cleared, Shift retained
        fireKeyUp('Meta');

        expect(ContextManager.getActiveCombo()).toEqual(['Shift']);
    });

    it('normal keyup (non-modifier) removes only that key', () => {
        fireKeyDown('Control');
        fireKeyDown('z');
        fireKeyUp('z'); // normal keyup, no cleanup needed
        expect(ContextManager.getActiveCombo()).toEqual(['Control']);

        fireKeyUp('Control');
        expect(ContextManager.getActiveCombo()).toEqual([]);
    });
});
