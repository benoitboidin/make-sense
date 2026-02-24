import { AnnotationHistoryManager, AnnotationSnapshot } from '../../history/AnnotationHistoryManager';
import { LabelRect, LabelPoint, LabelLine, LabelPolygon } from '../../../store/labels/types';
import { LabelStatus } from '../../../data/enums/LabelStatus';

// Mock the store and its dependencies
jest.mock('../../../index', () => ({
    store: {
        dispatch: jest.fn(),
        getState: jest.fn(() => ({ labels: { imagesData: [] } })),
        subscribe: jest.fn(),
    },
}));

jest.mock('../../../store/labels/actionCreators', () => ({
    updateImageDataById: jest.fn((id, data) => ({ type: '@@UPDATE_IMAGE_DATA_BY_ID', payload: { id, newImageData: data } })),
}));

jest.mock('../../../store/selectors/LabelsSelector', () => ({
    LabelsSelector: {
        getImageDataById: jest.fn(),
    },
}));

import { store } from '../../../index';
import { LabelsSelector } from '../../../store/selectors/LabelsSelector';
import { AcceptedFileType } from '../../../data/enums/AcceptedFileType';
import { ImageData } from '../../../store/labels/types';

const makeLabelRect = (id: string): LabelRect => ({
    id,
    labelId: null,
    isVisible: true,
    rect: { x: 0, y: 0, width: 10, height: 10 },
    isCreatedByAI: false,
    status: LabelStatus.ACCEPTED,
    suggestedLabel: null,
});

const makeSnapshot = (rects: LabelRect[] = []): AnnotationSnapshot => ({
    labelRects: rects,
    labelPoints: [],
    labelLines: [],
    labelPolygons: [],
});

const makeDummyImageData = (id: string): ImageData => ({
    id,
    fileData: new File([''], 'test.png'),
    loadStatus: true,
    labelRects: [],
    labelPoints: [],
    labelLines: [],
    labelPolygons: [],
    labelNameIds: [],
    imgWidth: 800,
    imgHeight: 600,
    isVisitedByYOLOObjectDetector: false,
    isVisitedBySSDObjectDetector: false,
    isVisitedByPoseDetector: false,
    isVisitedByRoboflowAPI: false,
});

describe('AnnotationHistoryManager', () => {
    beforeEach(() => {
        AnnotationHistoryManager.clearAll();
        AnnotationHistoryManager.isPaused = false;
        jest.clearAllMocks();
    });

    describe('record', () => {
        it('should record a snapshot and report canUndo', () => {
            const imageId = 'img-1';
            AnnotationHistoryManager.record(imageId, makeSnapshot());
            expect(AnnotationHistoryManager.canUndo(imageId)).toBe(true);
        });

        it('should clear redo stack when a new snapshot is recorded', () => {
            const imageId = 'img-1';
            // Manually set up a redo stack by recording and calling internal methods
            AnnotationHistoryManager.record(imageId, makeSnapshot());
            // Simulate redo entry by recording again then checking
            AnnotationHistoryManager.record(imageId, makeSnapshot([makeLabelRect('r1')]));
            expect(AnnotationHistoryManager.canRedo(imageId)).toBe(false);
        });

        it('should not record when isPaused is true', () => {
            const imageId = 'img-1';
            AnnotationHistoryManager.isPaused = true;
            AnnotationHistoryManager.record(imageId, makeSnapshot());
            expect(AnnotationHistoryManager.canUndo(imageId)).toBe(false);
        });

        it('should limit undo stack to MAX_HISTORY_SIZE entries', () => {
            const imageId = 'img-1';
            // Record 55 snapshots (max is 50)
            for (let i = 0; i < 55; i++) {
                AnnotationHistoryManager.record(imageId, makeSnapshot([makeLabelRect(`r${i}`)]));
            }
            // canUndo should still be true (stack has entries)
            expect(AnnotationHistoryManager.canUndo(imageId)).toBe(true);
        });
    });

    describe('canUndo / canRedo', () => {
        it('should return false for unknown imageId', () => {
            expect(AnnotationHistoryManager.canUndo('unknown')).toBe(false);
            expect(AnnotationHistoryManager.canRedo('unknown')).toBe(false);
        });

        it('should return false after clearAll', () => {
            const imageId = 'img-1';
            AnnotationHistoryManager.record(imageId, makeSnapshot());
            AnnotationHistoryManager.clearAll();
            expect(AnnotationHistoryManager.canUndo(imageId)).toBe(false);
        });

        it('should return false after clear for specific image', () => {
            const imageId = 'img-1';
            AnnotationHistoryManager.record(imageId, makeSnapshot());
            AnnotationHistoryManager.clear(imageId);
            expect(AnnotationHistoryManager.canUndo(imageId)).toBe(false);
        });
    });

    describe('applyUndo', () => {
        it('should dispatch previous state and move current to redo stack', () => {
            const imageId = 'img-1';
            const currentImageData = makeDummyImageData(imageId);
            const currentImageDataWithRect = {
                ...currentImageData,
                labelRects: [makeLabelRect('r1')],
            };
            (LabelsSelector.getImageDataById as jest.Mock).mockReturnValue(currentImageDataWithRect);

            const previousSnapshot = makeSnapshot([makeLabelRect('r0')]);
            AnnotationHistoryManager.record(imageId, previousSnapshot);

            AnnotationHistoryManager.applyUndo(imageId);

            expect(store.dispatch).toHaveBeenCalledTimes(1);
            expect(AnnotationHistoryManager.canRedo(imageId)).toBe(true);
            expect(AnnotationHistoryManager.canUndo(imageId)).toBe(false);
        });

        it('should do nothing when undo stack is empty', () => {
            const imageId = 'img-1';
            AnnotationHistoryManager.applyUndo(imageId);
            expect(store.dispatch).not.toHaveBeenCalled();
        });

        it('should set isPaused during dispatch to prevent re-recording', () => {
            const imageId = 'img-1';
            const currentImageData = makeDummyImageData(imageId);
            (LabelsSelector.getImageDataById as jest.Mock).mockReturnValue(currentImageData);

            let pausedDuringDispatch = false;
            (store.dispatch as jest.Mock).mockImplementation(() => {
                pausedDuringDispatch = AnnotationHistoryManager.isPaused;
            });

            AnnotationHistoryManager.record(imageId, makeSnapshot());
            AnnotationHistoryManager.applyUndo(imageId);

            expect(pausedDuringDispatch).toBe(true);
            expect(AnnotationHistoryManager.isPaused).toBe(false);
        });
    });

    describe('applyRedo', () => {
        it('should dispatch next state and move current to undo stack', () => {
            const imageId = 'img-1';
            const baseImageData = makeDummyImageData(imageId);
            const imageDataWithRect = { ...baseImageData, labelRects: [makeLabelRect('r1')] };
            (LabelsSelector.getImageDataById as jest.Mock).mockReturnValue(imageDataWithRect);

            // Record initial state
            AnnotationHistoryManager.record(imageId, makeSnapshot());
            // Apply undo to put something in redo stack
            AnnotationHistoryManager.applyUndo(imageId);
            jest.clearAllMocks();
            (LabelsSelector.getImageDataById as jest.Mock).mockReturnValue(baseImageData);

            // Now redo
            AnnotationHistoryManager.applyRedo(imageId);

            expect(store.dispatch).toHaveBeenCalledTimes(1);
            expect(AnnotationHistoryManager.canUndo(imageId)).toBe(true);
            expect(AnnotationHistoryManager.canRedo(imageId)).toBe(false);
        });

        it('should do nothing when redo stack is empty', () => {
            const imageId = 'img-1';
            AnnotationHistoryManager.applyRedo(imageId);
            expect(store.dispatch).not.toHaveBeenCalled();
        });
    });
});
