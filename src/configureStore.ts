import { createStore, applyMiddleware, compose } from 'redux';
import { rootReducer } from './store';
import { annotationHistoryMiddleware } from './store/middleware/annotationHistoryMiddleware';

export default function configureStore() {
    const composeEnhancers =
        (typeof window !== 'undefined' && (window as any).__REDUX_DEVTOOLS_EXTENSION_COMPOSE__) || compose;
    return createStore(
        rootReducer,
        composeEnhancers(applyMiddleware(annotationHistoryMiddleware))
    );
}