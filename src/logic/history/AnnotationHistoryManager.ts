import { store } from '../../index';
import { ImageData, LabelLine, LabelPoint, LabelPolygon, LabelRect } from '../../store/labels/types';
import { updateImageDataById } from '../../store/labels/actionCreators';
import { LabelsSelector } from '../../store/selectors/LabelsSelector';

const MAX_HISTORY_SIZE = 50;

export type AnnotationSnapshot = {
    labelRects: LabelRect[];
    labelPoints: LabelPoint[];
    labelLines: LabelLine[];
    labelPolygons: LabelPolygon[];
};

export class AnnotationHistoryManager {
    private static undoStacks: Map<string, AnnotationSnapshot[]> = new Map();
    private static redoStacks: Map<string, AnnotationSnapshot[]> = new Map();
    public static isPaused: boolean = false;

    public static record(imageId: string, snapshot: AnnotationSnapshot): void {
        if (AnnotationHistoryManager.isPaused) return;

        if (!AnnotationHistoryManager.undoStacks.has(imageId)) {
            AnnotationHistoryManager.undoStacks.set(imageId, []);
        }
        const stack = AnnotationHistoryManager.undoStacks.get(imageId)!;
        stack.push(snapshot);
        if (stack.length > MAX_HISTORY_SIZE) {
            stack.shift();
        }
        AnnotationHistoryManager.redoStacks.set(imageId, []);
    }

    public static applyUndo(imageId: string): void {
        const undoStack = AnnotationHistoryManager.undoStacks.get(imageId);
        if (!undoStack || undoStack.length === 0) return;

        const previousSnapshot = undoStack.pop()!;
        const currentImageData: ImageData = LabelsSelector.getImageDataById(imageId);
        if (!currentImageData) return;

        if (!AnnotationHistoryManager.redoStacks.has(imageId)) {
            AnnotationHistoryManager.redoStacks.set(imageId, []);
        }
        AnnotationHistoryManager.redoStacks.get(imageId)!.push({
            labelRects: currentImageData.labelRects,
            labelPoints: currentImageData.labelPoints,
            labelLines: currentImageData.labelLines,
            labelPolygons: currentImageData.labelPolygons,
        });

        AnnotationHistoryManager.isPaused = true;
        store.dispatch(updateImageDataById(imageId, { ...currentImageData, ...previousSnapshot }));
        AnnotationHistoryManager.isPaused = false;
    }

    public static applyRedo(imageId: string): void {
        const redoStack = AnnotationHistoryManager.redoStacks.get(imageId);
        if (!redoStack || redoStack.length === 0) return;

        const nextSnapshot = redoStack.pop()!;
        const currentImageData: ImageData = LabelsSelector.getImageDataById(imageId);
        if (!currentImageData) return;

        if (!AnnotationHistoryManager.undoStacks.has(imageId)) {
            AnnotationHistoryManager.undoStacks.set(imageId, []);
        }
        AnnotationHistoryManager.undoStacks.get(imageId)!.push({
            labelRects: currentImageData.labelRects,
            labelPoints: currentImageData.labelPoints,
            labelLines: currentImageData.labelLines,
            labelPolygons: currentImageData.labelPolygons,
        });

        AnnotationHistoryManager.isPaused = true;
        store.dispatch(updateImageDataById(imageId, { ...currentImageData, ...nextSnapshot }));
        AnnotationHistoryManager.isPaused = false;
    }

    public static canUndo(imageId: string): boolean {
        const stack = AnnotationHistoryManager.undoStacks.get(imageId);
        return stack ? stack.length > 0 : false;
    }

    public static canRedo(imageId: string): boolean {
        const stack = AnnotationHistoryManager.redoStacks.get(imageId);
        return stack ? stack.length > 0 : false;
    }

    public static clear(imageId: string): void {
        AnnotationHistoryManager.undoStacks.delete(imageId);
        AnnotationHistoryManager.redoStacks.delete(imageId);
    }

    public static clearAll(): void {
        AnnotationHistoryManager.undoStacks.clear();
        AnnotationHistoryManager.redoStacks.clear();
    }
}
