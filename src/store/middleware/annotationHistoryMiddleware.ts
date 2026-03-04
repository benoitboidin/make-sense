import { MiddlewareAPI, Dispatch, AnyAction } from 'redux';
import { Action } from '../Actions';
import { AnnotationHistoryManager } from '../../logic/history/AnnotationHistoryManager';
import { AppState } from '..';

export const annotationHistoryMiddleware =
    (api: MiddlewareAPI<Dispatch, AppState>) =>
    (next: Dispatch) =>
    (action: AnyAction) => {
        if (action.type === Action.UPDATE_IMAGE_DATA_BY_ID && !AnnotationHistoryManager.isPaused) {
            const state = api.getState();
            const existing = state.labels.imagesData.find((img) => img.id === action.payload.id);
            if (existing) {
                const { labelRects, labelPoints, labelLines, labelPolygons } = existing;
                const newData = action.payload.newImageData;
                if (
                    labelRects !== newData.labelRects ||
                    labelPoints !== newData.labelPoints ||
                    labelLines !== newData.labelLines ||
                    labelPolygons !== newData.labelPolygons
                ) {
                    AnnotationHistoryManager.record(action.payload.id, {
                        labelRects,
                        labelPoints,
                        labelLines,
                        labelPolygons,
                    });
                }
            }
        }
        return next(action);
    };
